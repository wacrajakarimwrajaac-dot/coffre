import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { saveItem, type Item } from '@/lib/data';
import {
  PERIOD_LABELS, RECURRENCE_LABELS, addDays, challengeProgress, currentStreak, describe, groupByRecurrence, heatmap, isDone, isDue,
  monthlySeries, overallRate, periodStart, rankHabits, rateOf, type Habit, type Period, type Recurrence,
} from '@/lib/discipline';
import { useHabits } from '@/lib/habitsStore';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatDue } from '@/lib/util';
import { Empty, s } from './ui';

const Box = ({ checked }: { checked: boolean }) => (
  <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: checked ? C.ok : C.muted, backgroundColor: checked ? C.ok : 'transparent',
    alignItems: 'center', justifyContent: 'center' }}>
  {checked && <Text style={{ color: C.primaryInk, fontWeight: '900' }}>✓</Text>}
  </View>
);

const Section = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginLeft: 4 }}>
      <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1 }]}>{title}</Text>
      {right}
    </View>
    {children}
  </View>
);

const Stat = ({ value, label, hint }: { value: string; label: string; hint?: string }) => (
  <View style={[s.card, { flex: 1, minWidth: '45%', padding: 14, gap: 2 }]}>
    <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>{value}</Text>
    <Text style={{ color: C.text, fontSize: 13 }}>{label}</Text>
    {hint ? <Text style={s.muted}>{hint}</Text> : null}
  </View>
);

const Bar = ({ pct, color = C.ok }: { pct: number; color?: string }) => (
  <View style={{ height: 6, backgroundColor: C.line, borderRadius: 3, overflow: 'hidden' }}>
    <View style={{ height: 6, width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
  </View>
);

// ---------------------------------------------------------------- Today

export function TodayView() {
  const hb = useHabits();
  const st = useStore();
  const due = hb.habits.filter((h) => isDue(h, hb.today));
  const done = due.filter((h) => isDone(hb.checks, h.id, hb.today)).length;
  const pct = due.length ? Math.round((done / due.length) * 100) : 0;
  const bestStreak = Math.max(0, ...hb.habits.map((h) => currentStreak(h, hb.checks, hb.today)));

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const tasks = st.items.filter((i) => i.type === 'task' && !i.done && !!i.dueAt && i.dueAt <= endOfToday.getTime())
    .sort((a, b) => a.dueAt! - b.dueAt!);

  const toggleTask = async (t: Item) => {
    await saveItem({ ...t, done: true });
    st.reload();
  };

  const toggle = (id: string) => hb.toggle(id, hb.today).catch((e) => Alert.alert('Erreur', (e as Error).message));

  return (
    <View style={{ gap: 18 }}>
      <View style={[s.card, { padding: 18, gap: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: '800' }}>{done}/{due.length}</Text>
          <Text style={s.muted}>{bestStreak > 0 ? `🔥 série de ${bestStreak} jour${bestStreak > 1 ? 's' : ''}` : 'Commence ta série aujourd’hui'}</Text>
        </View>
        <Bar pct={pct} color={pct === 100 ? C.ok : C.primary} />
        <Text style={s.muted}>
          {!due.length ? 'Rien de prévu aujourd’hui.' : pct === 100 ? 'Bravo, tout est fait aujourd’hui 🎉' : `${due.length - done} à faire aujourd’hui`}
        </Text>
      </View>

      <Section title="Habitudes du jour">
        {due.length === 0 ? (
          <Empty title="Aucune habitude aujourd’hui" hint="Crée une habitude avec le bouton ＋ : chaque jour, certains jours, chaque mois ou un défi." />
        ) : (
          due.map((h) => {
            const ok = isDone(hb.checks, h.id, hb.today);
            const streak = currentStreak(h, hb.checks, hb.today);
            return (
              <Pressable key={h.id} onPress={() => toggle(h.id)} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }, pressed && { opacity: 0.85 }]}>
                <Box checked={ok} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ok ? C.muted : C.text, fontSize: 16, fontWeight: '600', textDecorationLine: ok ? 'line-through' : 'none' }}>{h.icon} {h.title}</Text>
                  <Text style={s.muted}>{h.recurrence === 'challenge' ? `Jour ${challengeProgress(h, hb.checks, hb.today).dayNo}/${h.durationDays}` : RECURRENCE_LABELS[h.recurrence]}{h.reminderTime ? ` · 🔔 ${h.reminderTime}` : ''}</Text>
                </View>
                {streak > 0 && <Text style={{ color: '#f5b84b', fontWeight: '700' }}>🔥 {streak}</Text>}
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/discipline/[id]', params: { id: h.id } })}><Text style={s.muted}>⋯</Text></Pressable>
              </Pressable>
            );
          })
        )}
      </Section>

      <Section title="Tâches à faire" right={<Text onPress={() => router.push('/tasks')} style={{ color: C.primary }}>Toutes ›</Text>}>
        {tasks.length === 0 ? (
          <Text style={[s.muted, { marginLeft: 4 }]}>Aucune tâche prévue aujourd’hui ou en retard.</Text>
        ) : tasks.map((t) => {
          const overdue = t.dueAt! < Date.now();
          return (
            <Pressable key={t.id} onPress={() => toggleTask(t)} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }]}>
              <Box checked={false} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{t.title}</Text>
                <Text style={{ color: overdue ? C.danger : C.ok, fontSize: 13 }}>⏰ {formatDue(t.dueAt!)}{overdue ? ' · en retard' : ''}</Text>
              </View>
            </Pressable>
          );
        })}
      </Section>
    </View>
  );
}

// ---------------------------------------------------------------- Habits list

export function HabitsView() {
  const hb = useHabits();
  const groups = groupByRecurrence(hb.habits);
  const from90 = addDays(hb.today, -89);

  if (!hb.habits.length) {
    return <Empty title="Aucune habitude" hint="Appuie sur ＋ pour créer ta première habitude ou un défi de 90 jours." />;
  }

  return (
    <View style={{ gap: 18 }}>
      {groups.map((g) => (
        <Section key={g.recurrence} title={`${RECURRENCE_LABELS[g.recurrence]} · ${g.habits.length}`}>
          {g.habits.map((h) => {
            const rate = rateOf(h, hb.checks, from90, hb.today, hb.today);
            const streak = currentStreak(h, hb.checks, hb.today);
            const cp = h.recurrence === 'challenge' ? challengeProgress(h, hb.checks, hb.today) : null;
            return (
              <Pressable key={h.id} onPress={() => router.push({ pathname: '/discipline/[id]', params: { id: h.id } })}
                style={({ pressed }) => [s.card, { padding: 14, gap: 8 }, pressed && { opacity: 0.85 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{h.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{h.title}</Text>
                    <Text style={s.muted}>{describe(h)}{h.reminderTime ? ` · 🔔 ${h.reminderTime}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{cp ? `${cp.dayNo}/${cp.total}` : rate.pct === null ? '—' : `${rate.pct} %`}</Text>
                    {streak > 0 && <Text style={{ color: '#f5b84b', fontSize: 13 }}>🔥 {streak}</Text>}
                  </View>
                </View>
                <Bar pct={cp ? (cp.dayNo / (cp.total || 1)) * 100 : rate.pct ?? 0} color={cp ? C.primary : C.ok} />
              </Pressable>
            );
          })}
        </Section>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Statistics

const heatColor = (r: number | null) => (r === null ? '#141c33' : r === 0 ? '#2b3555' : `rgba(79, 209, 165, ${0.3 + 0.7 * r})`);

export function StatsView() {
  const hb = useHabits();
  const st = useStore();
  const [period, setPeriod] = useState<Period>('90');
  const [filter, setFilter] = useState<Recurrence | 'all'>('all');
  const from = periodStart(period, hb.today);
  const fromTs = new Date(from + 'T00:00:00').getTime();

  const tasks = useMemo(() => st.items.filter((i) => i.type === 'task'), [st.items]);
  const overall = overallRate(hb.habits, hb.checks, from, hb.today, hb.today);
  const habitsCreated = hb.habits.filter((h) => h.createdAt >= fromTs).length;
  const tasksIn = tasks.filter((t) => t.createdAt >= fromTs);
  const tasksDone = tasksIn.filter((t) => t.done).length;
  const best = Math.max(0, ...hb.habits.map((h) => currentStreak(h, hb.checks, hb.today)));
  const months = monthlySeries(hb.habits, hb.checks, tasks, hb.today, period === '30' ? 4 : period === '90' ? 6 : 12);
  const maxTasks = Math.max(1, ...months.map((m) => m.tasksCreated));
  const cells = heatmap(hb.habits, hb.checks, addDays(hb.today, -(Math.min(Number(period), 119) - 1)), hb.today);
  const ranking = rankHabits(hb.habits.filter((h) => filter === 'all' || h.recurrence === filter), hb.checks, from, hb.today);

  // Heatmap as columns of 7 days (weeks), aligned so the last column ends today.
  const cols: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={{ borderWidth: 1, borderColor: period === p ? C.primary : C.line,
            backgroundColor: period === p ? '#ff6b5b1f' : 'transparent', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7 }}>
            <Text style={{ color: period === p ? C.primary : C.muted, fontWeight: '600' }}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat value={overall.pct === null ? '—' : `${overall.pct} %`} label="Discipline" hint={`${overall.done} faites sur ${overall.due}`} />
        <Stat value={best ? `🔥 ${best}` : '0'} label="Meilleure série en cours" hint="jours d’affilée" />
        <Stat value={String(habitsCreated)} label="Habitudes créées" hint={`${hb.habits.length} actives`} />
        <Stat value={`${tasksDone}/${tasksIn.length}`} label="Tâches terminées" hint="créées sur la période" />
      </View>

      <Section title="Discipline par mois">
        <View style={[s.card, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 }}>
            {months.map((m) => (
              <View key={m.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
                <Text style={{ color: C.muted, fontSize: 11 }}>{m.pct === null ? '' : `${m.pct}%`}</Text>
                <View style={{ width: '70%', height: Math.max(((m.pct ?? 0) / 100) * 90, m.pct === null ? 0 : 3), borderRadius: 5,
                  backgroundColor: (m.pct ?? 0) >= 70 ? C.ok : (m.pct ?? 0) >= 40 ? '#f5b84b' : C.danger }} />
                <Text style={{ color: C.muted, fontSize: 11 }}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Section>

      <Section title="Tâches créées par mois">
        <View style={[s.card, { padding: 16, gap: 10 }]}>
          {months.map((m) => (
            <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: C.muted, width: 40, fontSize: 12 }}>{m.label}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ height: 8, width: `${(m.tasksCreated / maxTasks) * 100}%`, minWidth: m.tasksCreated ? 4 : 0, backgroundColor: C.primary, borderRadius: 4 }} />
                <View style={{ height: 8, width: `${(m.tasksDone / maxTasks) * 100}%`, minWidth: m.tasksDone ? 4 : 0, backgroundColor: C.ok, borderRadius: 4 }} />
              </View>
              <Text style={{ color: C.muted, fontSize: 12, width: 52, textAlign: 'right' }}>{m.tasksDone}/{m.tasksCreated}</Text>
            </View>
          ))}
          <Text style={s.muted}>🟠 créées  ·  🟢 terminées  ·  habitudes créées : {months.map((m) => m.habitsCreated).join(' · ')}</Text>
        </View>
      </Section>

      <Section title="Régularité jour par jour">
        <View style={[s.card, { padding: 16, gap: 8 }]}>
          <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
            {cols.map((col, i) => (
              <View key={i} style={{ gap: 4 }}>
                {col.map((c) => <View key={c.day} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: heatColor(c.ratio) }} />)}
              </View>
            ))}
          </View>
          <Text style={[s.muted, { textAlign: 'center' }]}>Plus c’est vert, plus tu as tout fait ce jour-là.</Text>
        </View>
      </Section>

      <Section title="Classement de tes habitudes">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {([['all', 'Toutes'], ['daily', 'Jour'], ['weekly', 'Semaine'], ['monthly', 'Mois'], ['challenge', 'Défis']] as [Recurrence | 'all', string][]).map(([k, label]) => (
            <Pressable key={k} onPress={() => setFilter(k)} style={{ borderWidth: 1, borderColor: filter === k ? C.primary : C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: filter === k ? C.primary : C.muted, fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {ranking.length === 0 ? (
          <Text style={[s.muted, { marginLeft: 4 }]}>Aucune habitude dans cette catégorie.</Text>
        ) : ranking.map((r, i) => (
          <Pressable key={r.habit.id} onPress={() => router.push({ pathname: '/discipline/[id]', params: { id: r.habit.id } })} style={[s.card, { padding: 14, gap: 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: i === 0 && r.rate.pct !== null ? '#f5b84b' : C.muted, fontWeight: '800', width: 22 }}>{i + 1}</Text>
              <Text style={{ fontSize: 20 }}>{r.habit.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600' }} numberOfLines={1}>{r.habit.title}</Text>
                <Text style={s.muted}>{RECURRENCE_LABELS[r.habit.recurrence]} · {r.rate.done}/{r.rate.due} · meilleure série {r.best}</Text>
              </View>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{r.rate.pct === null ? '—' : `${r.rate.pct} %`}</Text>
            </View>
            <Bar pct={r.rate.pct ?? 0} color={(r.rate.pct ?? 0) >= 70 ? C.ok : (r.rate.pct ?? 0) >= 40 ? '#f5b84b' : C.danger} />
          </Pressable>
        ))}
      </Section>
    </View>
  );
}
