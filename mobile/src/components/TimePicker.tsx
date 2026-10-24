import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { C } from '@/lib/theme';
import { Button, s } from './ui';

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Time of day ("HH:MM") for a habit reminder. */
export function TimePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [iosOpen, setIosOpen] = useState(false);
  const base = toDate(value ?? '08:00');

  const pick = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: base, mode: 'time', is24Hour: true, onChange: (e, d) => e.type === 'set' && d && onChange(toHHMM(d)) });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={pick} style={[s.input, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <Text style={{ color: value ? C.text : C.muted, fontSize: 16 }}>{value ? `🔔 Rappel à ${value}` : 'Ajouter un rappel'}</Text>
        {value ? <Text onPress={() => onChange(null)} style={{ color: C.muted }}>✕</Text> : null}
      </Pressable>
      {iosOpen && Platform.OS === 'ios' && (
        <>
          <DateTimePicker value={base} mode="time" display="spinner" themeVariant="dark" onChange={(_, d) => d && onChange(toHHMM(d))} />
          <Button kind="ghost" title="OK" onPress={() => setIosOpen(false)} />
        </>
      )}
    </View>
  );
}
