import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECURRENCE_LABELS, WEEKDAYS_SHORT, dayKey, type Habit, type Recurrence } from '@/lib/discipline';
import { ACCENTS, C } from '@/lib/theme';
import { uid } from '@/lib/util';
import { ACCENT_CHOICES, Icon, ICON_CHOICES, makeIcon, parseIcon } from './Icon';
import { TimePicker } from './TimePicker';
import { Button, Input, Pill, s } from './ui';

const RECURRENCES: [Recurrence, string, string][] = [
  ['daily', 'Chaque jour', 'Tous les jours.'], ['weekly', 'Chaque semaine', 'Seulement certains jours de la semaine.'],
  ['monthly', 'Chaque mois', 'Un jour précis du mois.'], ['challenge', 'Défi', 'Chaque jour, pendant une durée fixe.'],
];
const DURATIONS = [7, 21, 30, 60, 90, 180];

export function newHabit(): Habit {
  return {
    id: uid(), title: '', icon: 'target:green', recurrence: 'daily', weekdays: [0, 1, 2, 3, 4], monthDay: 1, startDate: dayKey(new Date()),
    durationDays: 90, reminderTime: null, archivedDay: null, createdAt: Date.now(),
  };
}

/** Create / edit a habit: title, icon + color, recurrence (day, week, month, challenge) and reminder. */
export function HabitForm({ initial, submitLabel, busy, onSubmit }: {
  initial: Habit; submitLabel: string; busy?: boolean; onSubmit: (h: Habit) => void;
}) {
  const [h, setH] = useState<Habit>(initial);
  const set = (patch: Partial<Habit>) => setH((x) => ({ ...x, ...patch }));
  const toggleDay = (d: number) => set({ weekdays: h.weekdays.includes(d) ? h.weekdays.filter((x) => x !== d) : [...h.weekdays, d].sort() });
  const valid = h.title.trim().length > 0 && (h.recurrence !== 'weekly' || h.weekdays.length > 0);
  const cur = parseIcon(h.icon, 'target:green');

  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={s.label}>Que veux-tu faire ?</Text>
        <Input autoFocus={!initial.title} value={h.title} onChangeText={(title) => set({ title })} placeholder="Ex. Courir 30 min, lire 20 pages…" maxLength={200} />
      </View>

      <View>
        <Text style={s.label}>Icône et couleur</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {ACCENT_CHOICES.map((a) => (
            <Pressable key={a} onPress={() => set({ icon: makeIcon(cur.name, a) })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENTS[a], borderWidth: cur.accent === a ? 3 : 0, borderColor: C.text }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ICON_CHOICES.map((n) => (
            <Pressable key={n} onPress={() => set({ icon: makeIcon(n, cur.accent) })} style={{ width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
              backgroundColor: cur.name === n ? `${cur.color}26` : C.card }}>
              <Icon name={n} size={22} color={cur.name === n ? cur.color : C.muted} />
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text style={s.label}>Répétition</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RECURRENCES.map(([r, label]) => <Pill key={r} label={label} on={h.recurrence === r} onPress={() => set({ recurrence: r })} />)}
        </View>
        <Text style={[s.muted, { marginTop: 8 }]}>{RECURRENCES.find(([r]) => r === h.recurrence)![2]}</Text>
      </View>

      {h.recurrence === 'weekly' && (
        <View>
          <Text style={s.label}>Quels jours ?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WEEKDAYS_SHORT.map((d, i) => <Pill key={d} label={d} on={h.weekdays.includes(i)} onPress={() => toggleDay(i)} />)}
          </View>
        </View>
      )}

      {h.recurrence === 'monthly' && (
        <View>
          <Text style={s.label}>Quel jour du mois ?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Button kind="ghost" title="−" onPress={() => set({ monthDay: Math.max(1, (h.monthDay ?? 1) - 1) })} />
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', minWidth: 44, textAlign: 'center' }}>{h.monthDay ?? 1}</Text>
            <Button kind="ghost" title="+" onPress={() => set({ monthDay: Math.min(31, (h.monthDay ?? 1) + 1) })} />
          </View>
          {(h.monthDay ?? 1) > 28 && <Text style={s.muted}>Les mois plus courts : le dernier jour du mois.</Text>}
        </View>
      )}

      {h.recurrence === 'challenge' && (
        <View>
          <Text style={s.label}>Durée du défi</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DURATIONS.map((d) => <Pill key={d} label={`${d} jours`} on={h.durationDays === d} onPress={() => set({ durationDays: d })} />)}
          </View>
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
