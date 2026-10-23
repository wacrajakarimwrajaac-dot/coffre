import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { C } from '@/lib/theme';
import { formatDue } from '@/lib/util';
import { Button, s } from './ui';

/** Date + time for a task reminder. Android opens two native dialogs, iOS shows an inline picker. */
export function DuePicker({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  const [iosOpen, setIosOpen] = useState(false);
  const base = value ? new Date(value) : nextHour();

  const pick = () => {
    if (Platform.OS !== 'android') return setIosOpen((o) => !o);
    DateTimePickerAndroid.open({
      value: base, mode: 'date', minimumDate: new Date(),
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date, mode: 'time', is24Hour: true,
          onChange: (e2, time) => e2.type === 'set' && time && onChange(time.getTime()),
        });
      },
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={pick} style={[s.input, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <Text style={{ color: value ? C.text : C.muted, fontSize: 16 }}>{value ? `⏰ ${formatDue(value)}` : 'Ajouter un rappel'}</Text>
        {value ? <Text onPress={() => onChange(undefined)} style={{ color: C.muted }}>✕</Text> : null}
      </Pressable>
      {iosOpen && Platform.OS === 'ios' && (
        <>
          <DateTimePicker value={base} mode="datetime" display="inline" minimumDate={new Date()} themeVariant="dark"
            onChange={(_, d) => d && onChange(d.getTime())} />
          <Button kind="ghost" title="OK" onPress={() => setIosOpen(false)} />
        </>
      )}
    </View>
  );
}

function nextHour() {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return d;
}
