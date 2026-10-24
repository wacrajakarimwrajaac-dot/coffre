// Pure discipline logic (no React, no network): which habits are due on a day, streaks, rates and
// statistics. Days are local calendar days written "YYYY-MM-DD".

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'challenge';

export interface Habit {
  id: string;
  title: string;
  icon: string;
  recurrence: Recurrence;
  /** 0 = Monday … 6 = Sunday (weekly) */
  weekdays: number[];
  /** 1–31 (monthly): clamped to the last day of short months */
  monthDay: number | null;
  startDate: string;
  /** challenge length in days (e.g. 90) */
  durationDays: number | null;
  /** "HH:MM" */
  reminderTime: string | null;
  /** day the habit was archived (inclusive), if any */
  archivedDay: string | null;
  createdAt: number;
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois', challenge: 'Défis',
};
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ---- Dates ----

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 864e5);
}
/** 0 = Monday … 6 = Sunday */
export function weekdayOf(key: string): number {
  return (parseDay(key).getDay() + 6) % 7;
}
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Last day of a challenge (inclusive). */
export function challengeEnd(h: Habit): string | null {
  return h.recurrence === 'challenge' && h.durationDays ? addDays(h.startDate, h.durationDays - 1) : null;
}

// ---- Which days is a habit due? ----

export function isDue(h: Habit, key: string): boolean {
  if (key < h.startDate) return false;
  if (h.archivedDay && key > h.archivedDay) return false;
  switch (h.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return h.weekdays.includes(weekdayOf(key));
    case 'monthly': {
      const [y, m, d] = key.split('-').map(Number);
      return d === Math.min(h.monthDay ?? 1, daysInMonth(y, m));
    }
    case 'challenge': {
      const end = challengeEnd(h);
      return end === null || key <= end;
    }
  }
}

/** Due days of a habit between two days (inclusive). */
export function dueDays(h: Habit, from: string, to: string): string[] {
  const out: string[] = [];
  const start = from < h.startDate ? h.startDate : from;
  for (let k = start; k <= to; k = addDays(k, 1)) if (isDue(h, k)) out.push(k);
  return out;
}

export type Checks = Map<string, Set<string>>; // habitId -> set of done days

export const isDone = (checks: Checks, habitId: string, key: string) => !!checks.get(habitId)?.has(key);

export function buildChecks(rows: { habitId: string; day: string }[]): Checks {
  const m: Checks = new Map();
  for (const r of rows) {
    if (!m.has(r.habitId)) m.set(r.habitId, new Set());
    m.get(r.habitId)!.add(r.day);
  }
  return m;
}

// ---- Streaks and rates ----

/** Consecutive done due-days ending today (today may still be pending without breaking the streak). */
export function currentStreak(h: Habit, checks: Checks, today: string): number {
  const done = checks.get(h.id);
  const days = dueDays(h, h.startDate, today);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const k = days[i];
    if (done?.has(k)) streak++;
    else if (k === today) continue; // not done yet today
    else break;
  }
  return streak;
}

export function bestStreak(h: Habit, checks: Checks, today: string): number {
  const done = checks.get(h.id);
  let best = 0;
  let run = 0;
  for (const k of dueDays(h, h.startDate, today)) {
    if (done?.has(k)) best = Math.max(best, ++run);
    else if (k !== today) run = 0;
  }
  return best;
}

export interface Rate { done: number; due: number; pct: number | null }

/** Completion of one habit over [from, to]; today counts as due only once it is done (not yet missed). */
export function rateOf(h: Habit, checks: Checks, from: string, to: string, today: string): Rate {
  const done = checks.get(h.id);
  let d = 0;
  let due = 0;
  for (const k of dueDays(h, from, to)) {
    const ok = !!done?.has(k);
    if (k === today && !ok) continue;
    due++;
    if (ok) d++;
  }
  return { done: d, due, pct: due ? Math.round((d / due) * 100) : null };
}

export function overallRate(habits: Habit[], checks: Checks, from: string, to: string, today: string): Rate {
  let done = 0;
  let due = 0;
  for (const h of habits) {
    const r = rateOf(h, checks, from, to, today);
    done += r.done;
    due += r.due;
  }
  return { done, due, pct: due ? Math.round((done / due) * 100) : null };
}

export type Period = '30' | '90' | '365';
export const PERIOD_DAYS: Record<Period, number> = { '30': 30, '90': 90, '365': 365 };
export const PERIOD_LABELS: Record<Period, string> = { '30': '30 jours', '90': '90 jours', '365': 'Année' };

export const periodStart = (p: Period, today: string) => addDays(today, -(PERIOD_DAYS[p] - 1));

// ---- Statistics ----

export interface MonthStat {
  key: string; // YYYY-MM
  label: string;
  habitsCreated: number;
  tasksCreated: number;
  tasksDone: number;
  pct: number | null;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Per-month stats for the last `count` months (oldest first). */
export function monthlySeries(
  habits: Habit[], checks: Checks, tasks: { createdAt: number; done?: boolean }[], today: string, count: number,
): MonthStat[] {
  const [ty, tm] = today.split('-').map(Number);
  const out: MonthStat[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ty, tm - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${pad(m)}`;
    const from = `${key}-01`;
    const to = `${key}-${pad(daysInMonth(y, m))}`;
    const inMonth = (ts: number) => dayKey(new Date(ts)).startsWith(key);
    const created = tasks.filter((t) => inMonth(t.createdAt));
    out.push({
      key, label: MONTHS[m - 1],
      habitsCreated: habits.filter((h) => inMonth(h.createdAt)).length,
      tasksCreated: created.length,
      tasksDone: created.filter((t) => t.done).length,
      pct: overallRate(habits, checks, from, to < today ? to : today, today).pct,
    });
  }
  return out;
}

export interface HabitStat { habit: Habit; rate: Rate; streak: number; best: number }

/** Habits ranked by discipline over the period (best first); habits with no due day yet go last. */
export function rankHabits(habits: Habit[], checks: Checks, from: string, today: string): HabitStat[] {
  return habits
    .map((habit) => ({
      habit, rate: rateOf(habit, checks, from, today, today),
      streak: currentStreak(habit, checks, today), best: bestStreak(habit, checks, today),
    }))
    .sort((a, b) => (b.rate.pct ?? -1) - (a.rate.pct ?? -1) || b.streak - a.streak);
}

/** One cell per day for a heatmap: share of due habits done that day (null = nothing due). */
export function heatmap(habits: Habit[], checks: Checks, from: string, today: string): { day: string; ratio: number | null }[] {
  const cells: { day: string; ratio: number | null }[] = [];
  for (let k = from; k <= today; k = addDays(k, 1)) {
    const due = habits.filter((h) => isDue(h, k));
    if (!due.length) {
      cells.push({ day: k, ratio: null });
      continue;
    }
    const done = due.filter((h) => isDone(checks, h.id, k)).length;
    cells.push({ day: k, ratio: done / due.length });
  }
  return cells;
}

/** Progress of a challenge: day number, days left, completion count. */
export function challengeProgress(h: Habit, checks: Checks, today: string) {
  const total = h.durationDays ?? 0;
  const dayNo = Math.min(Math.max(daysBetween(h.startDate, today) + 1, 0), total);
  const done = checks.get(h.id)?.size ?? 0;
  return { total, dayNo, done, left: Math.max(total - dayNo, 0), finished: !!total && today > addDays(h.startDate, total - 1) };
}

/** Habits grouped for the "Mes habitudes" list, in display order. */
export function groupByRecurrence(habits: Habit[]): { recurrence: Recurrence; habits: Habit[] }[] {
  return (['daily', 'weekly', 'monthly', 'challenge'] as Recurrence[])
    .map((recurrence) => ({ recurrence, habits: habits.filter((h) => h.recurrence === recurrence) }))
    .filter((g) => g.habits.length > 0);
}

/** Human description of a habit's recurrence, e.g. "Lun, Mer, Ven" or "Le 15 de chaque mois". */
export function describe(h: Habit): string {
  switch (h.recurrence) {
    case 'daily': return 'Tous les jours';
    case 'weekly': return h.weekdays.length === 7 ? 'Tous les jours' : [...h.weekdays].sort().map((d) => WEEKDAYS_SHORT[d]).join(', ');
    case 'monthly': return `Le ${h.monthDay ?? 1} de chaque mois`;
    case 'challenge': return `Défi de ${h.durationDays ?? 90} jours`;
  }
}
