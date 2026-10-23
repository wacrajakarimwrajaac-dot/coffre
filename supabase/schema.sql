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
