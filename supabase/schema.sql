-- Coffre: schéma Supabase (Postgres + Storage).
-- Idempotent : peut être relancé sans risque.

create table if not exists public.folders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders (id) on delete cascade,
  icon text not null default '📁',
  created_at bigint not null
);

create table if not exists public.items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  type text not null check (type in ('link', 'note', 'file', 'task')),
  title text not null default '',
  text text,
  url text,
  file_name text,
  mime text,
  size bigint,
  due_at bigint,
  done boolean,
  reminded_at bigint,
  created_at bigint not null
);

create index if not exists folders_user_idx on public.folders (user_id);
create index if not exists items_user_idx on public.items (user_id);
create index if not exists items_folder_idx on public.items (folder_id);

-- Chaque utilisateur ne voit et ne modifie que ses propres données.
alter table public.folders enable row level security;
alter table public.items enable row level security;

drop policy if exists "folders_own" on public.folders;
create policy "folders_own" on public.folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "items_own" on public.items;
create policy "items_own" on public.items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid()))
  );

-- Synchronisation en temps réel entre le site et l'app mobile.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'folders') then
    alter publication supabase_realtime add table public.folders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;

-- Fichiers (documents, images, vidéos) : bucket privé, chemin "<user_id>/<item_id>".
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists "files_own" on storage.objects;
create policy "files_own" on storage.objects for all to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- Formules et quota de stockage (contrôlé côté serveur)
-- ============================================================================

create table if not exists public.plans (
  id text primary key,
  name text not null,
  quota_bytes bigint not null,
  max_file_bytes bigint not null
);

insert into public.plans (id, name, quota_bytes, max_file_bytes) values
  ('free',    'Gratuit',  500::bigint * 1024 * 1024,        50::bigint * 1024 * 1024),
  ('plus',    'Plus',     10::bigint * 1024 * 1024 * 1024,  500::bigint * 1024 * 1024),
  ('premium', 'Premium',  50::bigint * 1024 * 1024 * 1024,  2::bigint * 1024 * 1024 * 1024)
on conflict (id) do update
  set name = excluded.name, quota_bytes = excluded.quota_bytes, max_file_bytes = excluded.max_file_bytes;

alter table public.plans enable row level security;
drop policy if exists "plans_read" on public.plans;
create policy "plans_read" on public.plans for select to anon, authenticated using (true);

-- Formule de chaque utilisateur. Pas de ligne = 'free'. Seul l'admin (ou un futur webhook de paiement) la modifie.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' references public.plans (id),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

-- Espace réellement occupé : taille des fichiers dans le stockage (pas la taille déclarée par l'app).
create or replace function public.used_bytes(uid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'files' and (storage.foldername(o.name))[1] = uid::text
$$;
revoke all on function public.used_bytes(uuid) from public, anon, authenticated;

create or replace function public.storage_usage()
returns table (plan text, used_bytes bigint, quota_bytes bigint, max_file_bytes bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, public.used_bytes((select auth.uid())), p.quota_bytes, p.max_file_bytes
  from public.plans p
  where p.id = coalesce((select pr.plan from public.profiles pr where pr.user_id = (select auth.uid())), 'free')
$$;
revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

-- Refuse un nouveau fichier si la formule ne le permet pas (taille max ou espace plein).
create or replace function public.check_file_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.plans;
begin
  if new.type <> 'file' then return new; end if;
  if tg_op = 'UPDATE' and new.size is not distinct from old.size then return new; end if;
  select pl.* into p from public.plans pl
  where pl.id = coalesce((select pr.plan from public.profiles pr where pr.user_id = new.user_id), 'free');
  if coalesce(new.size, 0) > p.max_file_bytes then
    raise exception 'Fichier trop lourd pour la formule % (max % Mo)', p.name, p.max_file_bytes / 1048576
      using errcode = 'P0001';
  end if;
  if public.used_bytes(new.user_id) + coalesce(new.size, 0) > p.quota_bytes then
    raise exception 'Espace plein : la formule % comprend % Mo', p.name, p.quota_bytes / 1048576
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists items_file_quota on public.items;
create trigger items_file_quota before insert or update of size, type on public.items
  for each row execute function public.check_file_quota();

-- Un fichier ne peut être envoyé que si sa fiche (vérifiée par le quota) existe déjà.
drop policy if exists "files_own" on storage.objects;
drop policy if exists "files_read_own" on storage.objects;
drop policy if exists "files_delete_own" on storage.objects;
drop policy if exists "files_write_checked" on storage.objects;
drop policy if exists "files_update_checked" on storage.objects;

create policy "files_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "files_write_checked" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.items i
      where i.user_id = (select auth.uid()) and i.type = 'file' and i.id::text = storage.filename(name)
    )
  );

create policy "files_update_checked" on storage.objects for update to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.items i
      where i.user_id = (select auth.uid()) and i.type = 'file' and i.id::text = storage.filename(name)
    )
  );

-- ============================================================================
-- Signalements (problèmes, suggestions) envoyés depuis l'app et le site
-- Consultables par l'admin dans Supabase → Table Editor → reports
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('bug', 'suggestion', 'account', 'other')),
  message text not null check (char_length(message) between 3 and 5000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  platform text check (platform is null or char_length(platform) <= 100),
  app_version text check (app_version is null or char_length(app_version) <= 50),
  device text check (device is null or char_length(device) <= 300),
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_user_idx on public.reports (user_id, created_at desc);
alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'new' and admin_reply is null
    and (screenshot_path is null or screenshot_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports for select to authenticated
  using (user_id = (select auth.uid()));
-- Pas de modification ni de suppression par les utilisateurs : seul l'admin répond / change le statut.

-- Anti-abus : 20 signalements maximum par 24 h et par utilisateur.
create or replace function public.limit_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports r
      where r.user_id = new.user_id and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Trop de signalements aujourd’hui, réessaie demain.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reports_limit on public.reports;
create trigger reports_limit before insert on public.reports
  for each row execute function public.limit_reports();

-- Captures d'écran jointes : bucket privé, chemin "<user_id>/<fichier>", 5 Mo max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "reports_files_insert" on storage.objects;
create policy "reports_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "reports_files_read" on storage.objects;
create policy "reports_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "reports_files_delete" on storage.objects;
create policy "reports_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- Suppression de compte (exigée par Google Play et l'App Store)
-- L'app supprime d'abord les fichiers via l'API Storage, puis appelle cette fonction.
-- Dossiers, éléments, profil et signalements sont supprimés en cascade.
-- ============================================================================

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Non connecté' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- Discipline : habitudes récurrentes, défis (ex. 90 jours) et suivi quotidien
-- ============================================================================

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  icon text not null default '✅',
  -- daily : chaque jour · weekly : certains jours de la semaine · monthly : un jour du mois
  -- challenge : chaque jour pendant duration_days à partir de start_date (ex. 90 jours)
  recurrence text not null check (recurrence in ('daily', 'weekly', 'monthly', 'challenge')),
  weekdays smallint[] not null default '{}',            -- 0 = lundi … 6 = dimanche (weekly)
  month_day smallint check (month_day between 1 and 31), -- monthly (31 → dernier jour des mois courts)
  start_date date not null,
  duration_days integer check (duration_days between 1 and 3650),
  reminder_time text check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  archived_at timestamptz,
  created_at bigint not null
);

create table if not exists public.habit_checks (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (habit_id, day)
);

create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists habit_checks_user_idx on public.habit_checks (user_id, day);

alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;

drop policy if exists "habits_own" on public.habits;
create policy "habits_own" on public.habits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "habit_checks_own" on public.habit_checks;
create policy "habit_checks_own" on public.habit_checks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

-- Anti-abus : 200 habitudes maximum par utilisateur.
create or replace function public.limit_habits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.habits h where h.user_id = new.user_id) >= 200 then
    raise exception 'Limite de 200 habitudes atteinte' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists habits_limit on public.habits;
create trigger habits_limit before insert on public.habits
  for each row execute function public.limit_habits();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'habits') then
    alter publication supabase_realtime add table public.habits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'habit_checks') then
    alter publication supabase_realtime add table public.habit_checks;
  end if;
end $$;

-- ============================================================================
-- Coffre Web (site relié au téléphone) : essai gratuit puis abonnement
-- ============================================================================

-- Abonnement de chaque compte. Écrit uniquement par le webhook de paiement (clé service_role),
-- jamais par l'app ni par le site.
create table if not exists public.web_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'inactive',            -- active | cancelled | expired | inactive
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,                     -- fin de la période payée
  updated_at timestamptz not null default now()
);
alter table public.web_subscriptions enable row level security;
drop policy if exists "web_subscriptions_read_own" on public.web_subscriptions;
create policy "web_subscriptions_read_own" on public.web_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- L'essai gratuit commence la première fois que le compte demande son accès (site ou téléphone).
create table if not exists public.web_trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.web_trials enable row level security;

-- Accès à Coffre Web du compte connecté : abonnement payé, sinon essai de 7 jours, sinon refusé.
create or replace function public.web_access()
returns table (active boolean, reason text, until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  sub public.web_subscriptions;
  started timestamptz;
begin
  if uid is null then
    return query select false, 'signed_out'::text, null::timestamptz;
    return;
  end if;

  select s.* into sub from public.web_subscriptions s where s.user_id = uid;
  if found and sub.status in ('active', 'cancelled') and (sub.current_period_end is null or sub.current_period_end > now()) then
    return query select true, 'subscription'::text, sub.current_period_end;
    return;
  end if;

  insert into public.web_trials (user_id) values (uid) on conflict (user_id) do nothing;
  select t.started_at into started from public.web_trials t where t.user_id = uid;
  if started + interval '7 days' > now() then
    return query select true, 'trial'::text, started + interval '7 days';
  else
    return query select false, 'expired'::text, started + interval '7 days';
  end if;
end $$;
revoke all on function public.web_access() from public, anon;
grant execute on function public.web_access() to authenticated;
