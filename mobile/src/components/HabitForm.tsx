import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECURRENCE_LABELS, WEEKDAYS_SHORT, dayKey, type Habit, type Recurrence } from '@/lib/discipline';
import { C } from '@/lib/theme';
import { uid } from '@/lib/util';
import { TimePicker } from './TimePicker';
import { Button, Input, s } from './ui';

const ICONS = ['✅', '💪', '🏃', '📚', '💧', '🧘', '🥗', '😴', '💊', '🧹', '✍️', '🎯', '🎸', '💻', '🌅', '🙏'];
const RECURRENCES: [Recurrence, string, string][] = [
  ['daily', 'Chaque jour', 'Tous les jours'], ['weekly', 'Chaque semaine', 'Certains jours'],
  ['monthly', 'Chaque mois', 'Un jour du mois'], ['challenge', 'Défi', '30, 60, 90 jours…'],
];
const DURATIONS = [7, 21, 30, 60, 90, 180];

export function newHabit(): Habit {
  return {
    id: uid(), title: '', icon: '✅', recurrence: 'daily', weekdays: [0, 1, 2, 3, 4], monthDay: 1, startDate: dayKey(new Date()),
    durationDays: 90, reminderTime: null, archivedDay: null, createdAt: Date.now(),
  };
}

const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ borderWidth: 1, borderColor: on ? C.primary : C.line, backgroundColor: on ? '#ff6b5b1f' : 'transparent',
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}>
    <Text style={{ color: on ? C.primary : C.text, fontWeight: on ? '700' : '400' }}>{label}</Text>
  </Pressable>
);

/** Create / edit a habit: title, icon, recurrence (day, week, month, challenge) and reminder. */
export function HabitForm({ initial, submitLabel, busy, onSubmit }: {
  initial: Habit; submitLabel: string; busy?: boolean; onSubmit: (h: Habit) => void;
}) {
  const [h, setH] = useState<Habit>(initial);
  const set = (patch: Partial<Habit>) => setH((x) => ({ ...x, ...patch }));
  const toggleDay = (d: number) => set({ weekdays: h.weekdays.includes(d) ? h.weekdays.filter((x) => x !== d) : [...h.weekdays, d].sort() });
  const valid = h.title.trim().length > 0 && (h.recurrence !== 'weekly' || h.weekdays.length > 0);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={s.label}>Que veux-tu faire ?</Text>
        <Input autoFocus={!initial.title} value={h.title} onChangeText={(title) => set({ title })} placeholder="Ex. Courir 30 min, Lire 20 pages…" maxLength={200} />
      </View>

      <View>
        <Text style={s.label}>Icône</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ICONS.map((i) => (
            <Pressable key={i} onPress={() => set({ icon: i })} style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: h.icon === i ? C.primary : C.line, backgroundColor: h.icon === i ? '#ff6b5b1f' : 'transparent' }}>
              <Text style={{ fontSize: 22 }}>{i}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text style={s.label}>Répétition</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RECURRENCES.map(([r, label]) => <Chip key={r} label={label} on={h.recurrence === r} onPress={() => set({ recurrence: r })} />)}
        </View>
        <Text style={[s.muted, { marginTop: 6 }]}>{RECURRENCES.find(([r]) => r === h.recurrence)![2]}</Text>
      </View>

      {h.recurrence === 'weekly' && (
        <View>
          <Text style={s.label}>Quels jours ?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WEEKDAYS_SHORT.map((d, i) => <Chip key={d} label={d} on={h.weekdays.includes(i)} onPress={() => toggleDay(i)} />)}
          </View>
        </View>
      )}

      {h.recurrence === 'monthly' && (
        <View>
          <Text style={s.label}>Quel jour du mois ?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Button kind="ghost" title="−" onPress={() => set({ monthDay: Math.max(1, (h.monthDay ?? 1) - 1) })} />
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '700', minWidth: 40, textAlign: 'center' }}>{h.monthDay ?? 1}</Text>
            <Button kind="ghost" title="+" onPress={() => set({ monthDay: Math.min(31, (h.monthDay ?? 1) + 1) })} />
          </View>
          {(h.monthDay ?? 1) > 28 && <Text style={s.muted}>Les mois plus courts : le dernier jour du mois.</Text>}
        </View>
      )}

      {h.recurrence === 'challenge' && (
        <View>
          <Text style={s.label}>Durée du défi</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DURATIONS.map((d) => <Chip key={d} label={`${d} jours`} on={h.durationDays === d} onPress={() => set({ durationDays: d })} />)}
          </View>
          <Text style={[s.muted, { marginTop: 6 }]}>Chaque jour, du début au jour {h.durationDays}.</Text>
        </View>
      )}

      <View>
        <Text style={s.label}>Rappel (optionnel)</Text>
        <TimePicker value={h.reminderTime} onChange={(reminderTime) => set({ reminderTime })} />
      </View>

      <Button title={submitLabel} busy={busy} disabled={!valid} onPress={() => onSubmit({ ...h, title: h.title.trim() })} />
    </View>
  );
}

export { RECURRENCE_LABELS };
