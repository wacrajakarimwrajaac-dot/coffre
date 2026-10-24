import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { saveItem, type Item } from '@/lib/data';
import {
  RECURRENCE_LABELS, addDays, challengeProgress, currentStreak, describe, groupByRecurrence, habitSummary, isDone, isDue, overallRate, weeklySeries,
  type Habit,
} from '@/lib/discipline';
import { useHabits } from '@/lib/habitsStore';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatDue } from '@/lib/util';
import { Icon, IconTile } from './Icon';
import { Empty, Ring, SectionLabel, s } from './ui';

export const Check = ({ checked, size = 26 }: { checked: boolean; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.8, borderColor: checked ? C.ok : C.muted, backgroundColor: checked ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
    {checked && <Icon name="check" size={size * 0.56} color="#06251b" strokeWidth={3} />}
  </View>
);

const Flame = ({ n, size = 15 }: { n: number; size?: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    <Icon name="flame" size={size} color={C.warn} />
    <Text style={{ color: C.warn, fontWeight: '700', fontSize: size - 1 }}>{n}</Text>
  </View>
);

export const pctColor = (pct: number | null) => (pct === null ? C.muted : pct >= 70 ? C.ok : pct >= 40 ? C.warn : C.danger);

const Bar = ({ pct, color = C.primary }: { pct: number; color?: string }) => (
  <View style={{ height: 4, backgroundColor: C.track, borderRadius: 2, overflow: 'hidden' }}>
    <View style={{ height: 4, width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
  </View>
);

const goHabit = (id: string) => router.push({ pathname: '/discipline/[id]', params: { id } });

// ---------------------------------------------------------------- Today

export function TodayView() {
  const hb = useHabits();
  const st = useStore();
  const due = hb.habits.filter((h) => isDue(h, hb.today));
  const done = due.filter((h) => isDone(hb.checks, h.id, hb.today)).length;
  const pct = due.length ? done / due.length : 0;
  const bestStreak = Math.max(0, ...hb.habits.map((h) => currentStreak(h, hb.checks, hb.today)));
  const overall = overallRate(hb.habits, hb.checks, addDays(hb.today, -29), hb.today, hb.today);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const tasks = st.items.filter((i) => i.type === 'task' && !i.done && !!i.dueAt && i.dueAt <= endOfToday.getTime()).sort((a, b) => a.dueAt! - b.dueAt!);

  const toggleTask = async (t: Item) => {
    await saveItem({ ...t, done: true });
    st.reload();
  };
  const toggle = (id: string) => hb.toggle(id, hb.today).catch((e) => Alert.alert('Erreur', (e as Error).message));

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 6 }}>
        <Ring pct={pct} size={116} stroke={11} color={pct === 1 ? C.ok : C.primary}>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -1 }}>{done}/{due.length}</Text>
          <Text style={s.muted}>aujourd’hui</Text>
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.muted}>30 derniers jours</Text>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -1 }}>{overall.pct === null ? '—' : `${overall.pct} %`}</Text>
          <Text style={s.muted}>{overall.due ? `${overall.done} faites sur ${overall.due}` : 'de régularité'}</Text>
          {bestStreak > 0 && <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><Flame n={bestStreak} size={16} /></View>}
        </View>
      </View>

      <SectionLabel>Habitudes du jour</SectionLabel>
      {due.length === 0 ? (
        <Empty title="Aucune habitude aujourd’hui" hint="Crée une habitude : chaque jour, certains jours, chaque mois ou un défi." />
      ) : (
        due.map((h, i) => {
          const ok = isDone(hb.checks, h.id, hb.today);
          const streak = currentStreak(h, hb.checks, hb.today);
          return (
            <Pressable key={h.id} onPress={() => toggle(h.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13,
              borderBottomWidth: i === due.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
              <Check checked={ok} />
              <IconTile icon={h.icon} size={36} fallback="target:green" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: ok ? C.muted : C.text, fontSize: 15.5, fontWeight: '600', textDecorationLine: ok ? 'line-through' : 'none' }}>{h.title}</Text>
                <Text style={s.muted}>
                  {h.recurrence === 'challenge' ? `Jour ${challengeProgress(h, hb.checks, hb.today).dayNo} sur ${h.durationDays}` : RECURRENCE_LABELS[h.recurrence]}
                  {h.reminderTime ? ` · ${h.reminderTime}` : ''}
                </Text>
              </View>
              {streak > 0 && <Flame n={streak} />}
              <Pressable hitSlop={10} onPress={() => goHabit(h.id)}><Icon name="chevron-right" size={18} color={C.muted} /></Pressable>
            </Pressable>
          );
        })
      )}

      <SectionLabel right={<Text onPress={() => router.push('/tasks')} style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Toutes</Text>}>Tâches à faire</SectionLabel>
      {tasks.length === 0 ? (
        <Text style={s.muted}>Aucune tâche prévue aujourd’hui ou en retard.</Text>
      ) : tasks.map((t, i) => {
        const overdue = t.dueAt! < Date.now();
        return (
          <Pressable key={t.id} onPress={() => toggleTask(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13,
            borderBottomWidth: i === tasks.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
            <Check checked={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }}>{t.title}</Text>
              <Text style={[s.muted, { color: overdue ? C.danger : C.muted }]}>{formatDue(t.dueAt!)}{overdue ? ' · en retard' : ''}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Habits list

export function HabitsView() {
  const hb = useHabits();
  const groups = groupByRecurrence(hb.habits);
  const from90 = addDays(hb.today, -89);

  if (!hb.habits.length) return <Empty title="Aucune habitude" hint="Appuie sur + pour créer ta première habitude ou un défi de 90 jours." />;

  return (
    <View>
      {groups.map((g) => (
        <View key={g.recurrence}>
          <SectionLabel>{`${RECURRENCE_LABELS[g.recurrence]} · ${g.habits.length}`}</SectionLabel>
          {g.habits.map((h, i) => {
            const streak = currentStreak(h, hb.checks, hb.today);
            const cp = h.recurrence === 'challenge' ? challengeProgress(h, hb.checks, hb.today) : null;
            const sum = habitSummary(h, hb.checks, from90, hb.today);
            return (
              <Pressable key={h.id} onPress={() => goHabit(h.id)} style={({ pressed }) => [{ paddingVertical: 12, gap: 9,
                borderBottomWidth: i === g.habits.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon={h.icon} size={38} fallback="target:green" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }}>{h.title}</Text>
                    <Text style={s.muted}>{describe(h)}{h.reminderTime ? ` · ${h.reminderTime}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{cp ? `${cp.dayNo}/${cp.total}` : sum.rate.pct === null ? '—' : `${sum.rate.pct} %`}</Text>
                    {streak > 0 && <Flame n={streak} size={13} />}
                  </View>
                </View>
                <Bar pct={cp ? (cp.dayNo / (cp.total || 1)) * 100 : sum.rate.pct ?? 0} color={cp ? C.primary : pctColor(sum.rate.pct)} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Statistics: one entry per habit

/** Tiny bar chart of the last weeks (one bar per week). */
export function Spark({ values, height = 26, color }: { values: (number | null)[]; height?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }}>
      {values.map((v, i) => (
        <View key={i} style={{ width: 6, height: v === null ? 3 : Math.max((v / 100) * height, 3), borderRadius: 2, backgroundColor: v === null ? C.track : color ?? pctColor(v) }} />
      ))}
    </View>
  );
}

export function StatsView() {
  const hb = useHabits();
  const from = addDays(hb.today, -89);
  const rows = useMemo(
    () => hb.habits.map((h) => ({ h, sum: habitSummary(h, hb.checks, from, hb.today), weeks: weeklySeries(h, hb.checks, hb.today, 10) }))
      .sort((a, b) => (b.sum.rate.pct ?? -1) - (a.sum.rate.pct ?? -1)),
    [hb.habits, hb.checks, hb.today, from],
  );

  if (!rows.length) return <Empty title="Pas encore de statistiques" hint="Crée une habitude : ses statistiques apparaissent ici, une par une." />;

  return (
    <View>
      <Text style={[s.muted, { marginTop: 4, lineHeight: 19 }]}>Chaque habitude a ses propres statistiques. Touche-en une pour voir sa régularité, ses séries, ses meilleurs jours et son historique.</Text>
      <SectionLabel>Sur 90 jours</SectionLabel>
      {rows.map(({ h, sum, weeks }, i) => (
        <Pressable key={h.id} onPress={() => goHabit(h.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
          borderBottomWidth: i === rows.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
          <IconTile icon={h.icon} size={38} fallback="target:green" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }}>{h.title}</Text>
            <Text style={s.muted}>{RECURRENCE_LABELS[h.recurrence]} · série {sum.streak} · record {sum.best}</Text>
          </View>
          <Spark values={weeks.map((w) => w.pct)} />
          <Text style={{ color: pctColor(sum.rate.pct), fontWeight: '700', fontSize: 16, width: 52, textAlign: 'right' }}>{sum.rate.pct === null ? '—' : `${sum.rate.pct} %`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export type { Habit };
