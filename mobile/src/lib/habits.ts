import { supabase } from './supabase';
import { buildChecks, dayKey, type Checks, type Habit, type Recurrence } from './discipline';

type Row = Record<string, any>;

const fromRow = (r: Row): Habit => ({
  id: r.id, title: r.title, icon: r.icon ?? '✅', recurrence: r.recurrence as Recurrence,
  weekdays: (r.weekdays ?? []).map(Number), monthDay: r.month_day ?? null, startDate: r.start_date,
  durationDays: r.duration_days ?? null, reminderTime: r.reminder_time ?? null,
  archivedDay: r.archived_at ? dayKey(new Date(r.archived_at)) : null, createdAt: Number(r.created_at),
});

const toRow = (h: Habit): Row => ({
  id: h.id, title: h.title.trim(), icon: h.icon, recurrence: h.recurrence,
  weekdays: h.recurrence === 'weekly' ? h.weekdays : [], month_day: h.recurrence === 'monthly' ? h.monthDay : null,
  start_date: h.startDate, duration_days: h.recurrence === 'challenge' ? h.durationDays : null,
  reminder_time: h.reminderTime, created_at: h.createdAt,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function loadHabits(): Promise<{ habits: Habit[]; checks: Checks }> {
  const [h, c] = await Promise.all([
    supabase.from('habits').select('*').is('archived_at', null).order('created_at'),
    supabase.from('habit_checks').select('habit_id, day'),
  ]);
  return {
    habits: (check(h) as Row[]).map(fromRow),
    checks: buildChecks((check(c) as Row[]).map((r) => ({ habitId: r.habit_id, day: r.day }))),
  };
}

export async function saveHabit(h: Habit) {
  check(await supabase.from('habits').upsert(toRow(h)));
}

/** Archived habits keep their history (statistics) but disappear from the lists. */
export async function archiveHabit(id: string) {
  check(await supabase.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', id));
}

export async function deleteHabit(id: string) {
  check(await supabase.from('habits').delete().eq('id', id));
}

export async function setChecked(habitId: string, day: string, done: boolean) {
  if (done) check(await supabase.from('habit_checks').upsert({ habit_id: habitId, day }));
  else check(await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('day', day));
}

export function subscribeHabits(onChange: () => void): () => void {
  const channel = supabase
    .channel('coffre-habits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_checks' }, onChange)
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
