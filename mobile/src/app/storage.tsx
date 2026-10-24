import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { s } from '@/components/ui';
import { folderUsage, typeUsage } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatSize } from '@/lib/util';

const PLAN_NAMES: Record<string, string> = { free: 'Gratuit', plus: 'Plus', premium: 'Premium' };

function Bar({ pct, color = C.primary }: { pct: number; color?: string }) {
  return (
    <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ height: 8, width: `${Math.max(Math.min(pct, 100), pct > 0 ? 2 : 0)}%`, backgroundColor: color }} />
    </View>
  );
}

export default function Storage() {
  const st = useStore();
  const usage = st.usage;
  const folders = useMemo(() => folderUsage(st.folders, st.items), [st.folders, st.items]);
  const types = useMemo(() => typeUsage(st.items), [st.items]);
  const total = folders.reduce((n, f) => n + f.bytes, 0);
  const pct = usage ? (usage.usedBytes / usage.quotaBytes) * 100 : 0;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 50 }}>
      <Stack.Screen options={{ title: 'Espace de stockage' }} />

      {usage && (
        <View style={[s.card, { padding: 18, gap: 10 }]}>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '800' }}>{formatSize(usage.usedBytes)}</Text>
          <Text style={s.muted}>utilisés sur {formatSize(usage.quotaBytes)} · formule {PLAN_NAMES[usage.plan] ?? usage.plan}</Text>
          <Bar pct={pct} color={pct > 90 ? C.danger : C.ok} />
          <Text style={s.muted}>Il te reste {formatSize(Math.max(usage.quotaBytes - usage.usedBytes, 0))} · fichier max {formatSize(usage.maxFileBytes)}</Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }]}>Par type</Text>
        <View style={[s.card, { padding: 16, gap: 14 }]}>
          {types.map((t) => (
            <View key={t.kind} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.text }}>{t.icon} {t.label} <Text style={s.muted}>· {t.files}</Text></Text>
                <Text style={s.muted}>{formatSize(t.bytes)}</Text>
              </View>
              <Bar pct={total ? (t.bytes / total) * 100 : 0} color={C.primary} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }]}>Par dossier · du plus lourd au plus léger</Text>
        <View style={[s.card, { paddingVertical: 4 }]}>
          {folders.map((u, i) => (
            <Pressable key={u.folder.id} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: u.folder.id } })}
              style={({ pressed }) => [{ padding: 14, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }, pressed && { backgroundColor: '#ffffff0a' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>{u.folder.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{u.folder.name}</Text>
                  <Text style={s.muted}>{u.files} fichier{u.files > 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{formatSize(u.bytes)}</Text>
                  <Text style={s.muted}>{total ? Math.round((u.bytes / total) * 100) : 0} %</Text>
                </View>
              </View>
              <Bar pct={total ? (u.bytes / total) * 100 : 0} />
            </Pressable>
          ))}
          {!folders.length && <Text style={[s.muted, { padding: 16 }]}>Aucun dossier.</Text>}
        </View>
      </View>

      <Text style={[s.muted, { textAlign: 'center' }]}>
        Pour libérer de l’espace, ouvre un dossier lourd et supprime les fichiers dont tu n’as plus besoin. Les notes, liens et tâches ne comptent presque pas.
      </Text>
    </ScrollView>
  );
}
