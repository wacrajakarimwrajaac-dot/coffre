import { View } from 'react-native';
import type { Usage } from '@/lib/data';
import { C } from '@/lib/theme';

/** Phone storage: what Coffre takes, what the rest of the phone takes, and what is free. */
export function StorageBar({ usage }: { usage: Usage }) {
  const total = usage.totalBytes || usage.usedBytes + usage.freeBytes || 1;
  const coffre = Math.min(100, (usage.usedBytes / total) * 100);
  const others = Math.max(0, Math.min(100 - coffre, ((total - usage.freeBytes - usage.usedBytes) / total) * 100));
  const low = usage.totalBytes > 0 && usage.freeBytes / usage.totalBytes < 0.05;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden', flexDirection: 'row' }}>
      <View style={{ width: `${Math.max(coffre, usage.usedBytes ? 1 : 0)}%`, backgroundColor: low ? C.danger : C.primary }} />
      <View style={{ width: `${others}%`, backgroundColor: C.muted, opacity: 0.35 }} />
    </View>
  );
}
