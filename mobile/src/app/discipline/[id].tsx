import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { HabitForm } from '@/components/HabitForm';
import { Icon, IconTile } from '@/components/Icon';
import { pctColor } from '@/components/discipline';
import { Button, Empty, Ring, SectionLabel, Tabs, s } from '@/components/ui';
import {
  PERIOD_LABELS, WEEKDAYS_SHORT, addDays, challengeProgress, dayState, describe, habitMonthly, habitSummary, parseDay, periodStart, weekdayBreakdown, weeklySeries,
  type Habit, type Period,
} from '@/lib/discipline';
import { useHabits } from '@/lib/habitsStore';
import { C } from '@/lib/theme';

const PERIODS: [Period, string][] = (Object.keys(PERIOD_LABELS) as Period[]).map((p) => [p, PERIOD_LABELS[p]]);

/** Vertical bars with a % on top and a label below. */
function Bars({ data, height = 96 }: { data: { label: string; pct: number | null; sub?: string }[]; height?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          <Text style={{ color: C.muted, fontSize: 10.5, height: 14 }}>{d.pct === null ? '' : d.pct}</Text>
          <View style={{ width: '72%', height: d.pct === null ? 3 : Math.max((d.pct / 100) * height, 3), borderRadius: 4, backgroundColor: d.pct === null ? C.track : pctColor(d.pct) }} />
          <Text style={{ color: C.muted, fontSize: 10.5 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const Kpi = ({ value, label }: { value: string; label: string }) => (
  <View style={{ flex: 1, gap: 2 }}>
    <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6 }}>{value}</Text>
    <Text style={[s.muted, { fontSize: 12 }]}>{label}</Text>
  </View>
);

export default function HabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hb = useHabits();
  const habit = hb.habits.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState<Period>('90');

  const today = hb.today;
  const from = periodStart(period, today);
  const sum = useMemo(() => (habit ? habitSummary(habit, hb.checks, from, today) : null), [habit, hb.checks, from, today]);
  const weeks = useMemo(() => (habit ? weeklySeries(habit, hb.checks, today, period === '30' ? 6 : period === '90' ? 12 : 26) : []), [habit, hb.checks, today, period]);
  const months = useMemo(() => (habit ? habitMonthly(habit, hb.checks, today, period === '365' ? 12 : 6) : []), [habit, hb.checks, today, period]);
  const days = useMemo(() => (habit ? weekdayBreakdown(habit, hb.checks, from, today) : []), [habit, hb.checks, from, today]);

  if (!habit || !sum) return <Empty title="Habitude introuvable" />;

  const cp = habit.recurrence === 'challenge' ? challengeProgress(habit, hb.checks, today) : null;
  const bestDay = [...days].filter((d) => d.due >= 2 && d.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];

  // Last 5 weeks as a calendar (Monday first), ending with the current week.
  const monday = addDays(today, -((parseDay(today).getDay() + 6) % 7));
  const calendar = Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(monday, (w - 4) * 7 + d)));

  const toggle = (day: string) => hb.toggle(habit.id, day).catch((e) => Alert.alert('Erreur', (e as Error).message));
  const save = async (h: Habit) => {
    setBusy(true);
    try {
      await hb.save(h);
      setEditing(false);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = (title: string, message: string, label: string, action: () => Promise<void>) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: label, style: 'destructive', onPress: async () => { try { await action(); router.back(); } catch (e) { Alert.alert('Erreur', (e as Error).message); } } },
    ]);

  if (editing) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
        <Stack.Screen options={{ title: 'Modifier l’habitude' }} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 8 }} keyboardShouldPersistTaps="handled">
          <HabitForm initial={habit} submitLabel="Enregistrer" busy={busy} onSubmit={save} />
          <Button kind="ghost" title="Annuler" onPress={() => setEditing(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: '' }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconTile icon={habit.icon} size={56} fallback="target:green" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }} numberOfLines={2}>{habit.title}</Text>
          <Text style={s.muted}>{describe(habit)}{habit.reminderTime ? ` · rappel ${habit.reminderTime}` : ''}</Text>
        </View>
      </View>

      {cp && (
        <View style={{ marginTop: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>Jour {cp.dayNo} sur {cp.total}</Text>
            <Text style={s.muted}>{cp.finished ? 'Défi terminé' : `encore ${cp.left} jours`}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: C.track, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${(cp.dayNo / (cp.total || 1)) * 100}%`, backgroundColor: C.primary }} />
          </View>
        </View>
      )}

      <View style={{ marginTop: 22 }}><Tabs items={PERIODS} value={period} onChange={setPeriod} /></View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 20 }}>
        <Ring pct={(sum.rate.pct ?? 0) / 100} size={112} stroke={11} color={pctColor(sum.rate.pct)}>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', letterSpacing: -1 }}>{sum.rate.pct === null ? '—' : `${sum.rate.pct}%`}</Text>
          <Text style={s.muted}>discipline</Text>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{sum.rate.done} faites sur {sum.rate.due}</Text>
          <Text style={s.muted}>{sum.perWeek ? `environ ${sum.perWeek} fois par semaine` : 'pas encore de données'}</Text>
          {bestDay && <Text style={s.muted}>Ton meilleur jour : {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][bestDay.weekday]}</Text>}
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 22 }}>
        <Kpi value={String(sum.streak)} label="Série en cours" />
        <Kpi value={String(sum.best)} label="Record de série" />
        <Kpi value={String(sum.totalDone)} label="Total fait" />
      </View>

      <SectionLabel>Par semaine · % de réussite</SectionLabel>
      <Bars data={weeks.map((w, i) => ({ label: i % 2 === (weeks.length - 1) % 2 ? String(Number(w.start.slice(8))) : '', pct: w.pct }))} />

      <SectionLabel>Par mois</SectionLabel>
      <Bars data={months.map((m) => ({ label: m.label, pct: m.pct }))} />

      {habit.recurrence !== 'monthly' && (
        <>
          <SectionLabel>Par jour de la semaine</SectionLabel>
          <Bars data={days.map((d) => ({ label: WEEKDAYS_SHORT[d.weekday].slice(0, 1), pct: d.pct }))} />
        </>
      )}

      <SectionLabel>Historique · touche un jour pour corriger</SectionLabel>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.muted, fontSize: 11 }}>{d}</Text>)}
      </View>
      {calendar.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          {week.map((day) => {
            const st = dayState(habit, hb.checks, day, today);
            return (
              <Pressable key={day} disabled={st === 'future' || st === 'off'} onPress={() => toggle(day)}
                style={{ flex: 1, aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: st === 'done' ? C.ok : st === 'missed' ? `${C.danger}26` : 'transparent',
                  borderWidth: st === 'pending' || day === today ? 1.8 : 0, borderColor: C.primary, opacity: st === 'future' ? 0.3 : st === 'off' ? 0.4 : 1 }}>
                {st === 'done' ? <Icon name="check" size={15} color="#06251b" strokeWidth={3} /> : <Text style={{ color: st === 'missed' ? C.danger : C.muted, fontSize: 12 }}>{Number(day.slice(8))}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={{ gap: 8, marginTop: 26 }}>
        <Button title="Modifier" kind="ghost" icon="pencil" onPress={() => setEditing(true)} />
        <Button title="Archiver (garder l’historique)" kind="ghost" icon="archive" onPress={() =>
          confirm('Archiver cette habitude ?', 'Elle disparaît des listes mais ses statistiques passées restent comptées.', 'Archiver', () => hb.archive(habit.id))} />
        <Button title="Supprimer définitivement" kind="danger" icon="trash" onPress={() =>
          confirm('Supprimer cette habitude ?', 'Tout son historique est effacé, y compris des statistiques.', 'Supprimer', () => hb.remove(habit.id))} />
      </View>
    </ScrollView>
  );
}
