import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { dayKey, type Checks, type Habit } from './discipline';
import { archiveHabit, deleteHabit, loadHabits, saveHabit, setChecked, subscribeHabits } from './habits';
import { syncHabitReminders } from './reminders';

interface HabitsStore {
  habits: Habit[];
  checks: Checks;
  today: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  toggle: (habitId: string, day: string) => Promise<void>;
  save: (h: Habit) => Promise<void>;
  archive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const Ctx = createContext<HabitsStore | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checks, setChecks] = useState<Checks>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => dayKey(new Date()));

  const reload = useCallback(async () => {
    try {
      const data = await loadHabits();
      setHabits(data.habits);
      setChecks(data.checks);
      setError(null);
      syncHabitReminders(data.habits).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setToday(dayKey(new Date()));
    }
  }, []);

  useEffect(() => {
    reload();
    const unsubscribe = subscribeHabits(() => void reload());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void reload());
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [reload]);

  const toggle = useCallback(async (habitId: string, day: string) => {
    const was = checks.get(habitId)?.has(day) ?? false;
    // Optimistic update: the tick shows instantly, and is undone if the server refuses.
    const apply = (done: boolean) =>
      setChecks((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(habitId) ?? []);
        if (done) set.add(day); else set.delete(day);
        next.set(habitId, set);
        return next;
      });
    apply(!was);
    try {
      await setChecked(habitId, day, !was);
    } catch (e) {
      apply(was);
      throw e;
    }
  }, [checks]);

  const value = useMemo<HabitsStore>(() => ({
    habits, checks, today, loading, error, reload, toggle,
    save: async (h) => { await saveHabit(h); await reload(); },
    archive: async (id) => { await archiveHabit(id); await reload(); },
    remove: async (id) => { await deleteHabit(id); await reload(); },
  }), [habits, checks, today, loading, error, reload, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHabits(): HabitsStore {
  const s = useContext(Ctx);
  if (!s) throw new Error('HabitsProvider manquant');
  return s;
}
