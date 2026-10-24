import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { HabitForm } from '@/components/HabitForm';
import { Button, Empty, s } from '@/components/ui';
import {
  addDays, bestStreak, challengeProgress, currentStreak, dayKey, isDone, isDue, parseDay, rateOf, type Habit,
} from '@/lib/discipline';
import { useHabits } from '@/lib/habitsStore';
import { C } from '@/lib/theme';

export default function HabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hb = useHabits();
  const habit = hb.habits.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!habit) return <Empty title="Habitude introuvable" />;

  const today = hb.today;
  const streak = currentStreak(habit, hb.checks, today);
  const best = bestStreak(habit, hb.checks, today);
  const r30 = rateOf(habit, hb.checks, addDays(today, -29), today, today);
  const r90 = rateOf(habit, hb.checks, addDays(today, -89), today, today);
  const total = hb.checks.get(habit.id)?.size ?? 0;
  const cp = habit.recurrence === 'challenge' ? challengeProgress(habit, hb.checks, today) : null;

  // Last 5 weeks as a calendar (Monday first), ending with the current week.
  const monday = addDays(today, -((parseDay(today).getDay() + 6) % 7));
  const weeks = Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(monday, (w - 4) * 7 + d)));

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
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <HabitForm initial={habit} submitLabel="Enregistrer" busy={busy} onSubmit={save} />
          <Button kind="ghost" title="Annuler" onPress={() => setEditing(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: habit.title }} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 44 }}>{habit.icon}</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{habit.title}</Text>
        {cp && <Text style={s.muted}>Défi : jour {cp.dayNo}/{cp.total}{cp.finished ? ' · terminé 🎉' : ` · encore ${cp.left} jours`}</Text>}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[[`🔥 ${streak}`, 'Série en cours'], [String(best), 'Meilleure série'], [String(total), 'Total fait']].map(([v, l]) => (
          <View key={l} style={[s.card, { flex: 1, padding: 12, alignItems: 'center', gap: 2 }]}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{v}</Text>
            <Text style={[s.muted, { textAlign: 'center', fontSize: 12 }]}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['30 jours', r30], ['90 jours', r90]].map(([l, r]) => (
          <View key={l as string} style={[s.card, { flex: 1, padding: 12, alignItems: 'center', gap: 2 }]}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{(r as ReturnType<typeof rateOf>).pct === null ? '—' : `${(r as ReturnType<typeof rateOf>).pct} %`}</Text>
            <Text style={[s.muted, { fontSize: 12 }]}>Discipline · {l as string}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }]}>Historique · touche un jour pour corriger</Text>
        <View style={[s.card, { padding: 14, gap: 6 }]}>
          <View style={{ flexDirection: 'row' }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.muted, fontSize: 12 }}>{d}</Text>)}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', gap: 4 }}>
              {week.map((day) => {
                const due = isDue(habit, day);
                const done = isDone(hb.checks, habit.id, day);
                const future = day > today;
                const missed = due && !done && day < today;
                return (
                  <Pressable key={day} disabled={future || (!due && !done)} onPress={() => toggle(day)}
                    style={{ flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: done ? C.ok : missed ? '#ff5c7a33' : due ? C.line : 'transparent',
                      borderWidth: day === today ? 2 : 0, borderColor: C.primary, opacity: future ? 0.3 : 1 }}>
                    <Text style={{ color: done ? C.primaryInk : C.muted, fontSize: 12, fontWeight: done ? '800' : '400' }}>{Number(day.slice(8))}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <Button title="Modifier" kind="ghost" onPress={() => setEditing(true)} />
      <Button title="Archiver (garder l’historique)" kind="ghost" onPress={() =>
        confirm('Archiver cette habitude ?', 'Elle disparaît des listes mais ses statistiques passées restent comptées.', 'Archiver', () => hb.archive(habit.id))} />
      <Button title="Supprimer définitivement" kind="danger" onPress={() =>
        confirm('Supprimer cette habitude ?', 'Tout son historique est effacé, y compris des statistiques.', 'Supprimer', () => hb.remove(habit.id))} />
    </ScrollView>
  );
}
