import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { HabitForm, newHabit } from '@/components/HabitForm';
import { s } from '@/components/ui';
import type { Habit } from '@/lib/discipline';
import { useHabits } from '@/lib/habitsStore';

export default function NewHabit() {
  const hb = useHabits();
  const [busy, setBusy] = useState(false);
  const [initial] = useState(newHabit);

  const submit = async (h: Habit) => {
    setBusy(true);
    try {
      await hb.save(h);
      router.back();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <Stack.Screen options={{ title: 'Nouvelle habitude' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <HabitForm initial={initial} submitLabel="Créer l’habitude" busy={busy} onSubmit={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
