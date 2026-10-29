import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, IconTile } from '@/components/Icon';
import { StorageBar } from '@/components/StorageBar';
import { SectionLabel, s } from '@/components/ui';
import type { IconName } from '@/lib/icons';
import { folderUsage, typeUsage } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatSize } from '@/lib/util';

const TYPE_ICON: Record<string, IconName> = { photo: 'image', video: 'video', audio: 'mic', doc: 'file' };

function Bar({ pct, color = C.primary }: { pct: number; color?: string }) {
  return (
    <View style={{ height: 5, backgroundColor: C.track, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 5, width: `${Math.max(Math.min(pct, 100), pct > 0 ? 2 : 0)}%`, backgroundColor: color }} />
    </View>
  );
}

export default function Storage() {
  const st = useStore();
  const usage = st.usage;
  const folders = useMemo(() => folderUsage(st.folders, st.items), [st.folders, st.items]);
  const types = useMemo(() => typeUsage(st.items), [st.items]);
  const total = folders.reduce((n, f) => n + f.bytes, 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
      <Stack.Screen options={{ title: 'Espace de stockage' }} />

      {usage && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ color: C.text, fontSize: 38, fontWeight: '700', letterSpacing: -1.2 }}>{formatSize(usage.usedBytes)}</Text>
          <Text style={s.muted}>utilisés par Coffre sur ce téléphone</Text>
          <View style={{ marginTop: 4 }}><StorageBar usage={usage} /></View>
          {usage.totalBytes > 0 && <Text style={s.muted}>Il reste {formatSize(usage.freeBytes)} libres sur le téléphone ({formatSize(usage.totalBytes)} au total)</Text>}
        </View>
      )}

      <SectionLabel>Par type</SectionLabel>
      {types.map((t, i) => (
        <View key={t.kind} style={{ paddingVertical: 12, gap: 8, borderBottomWidth: i === types.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={TYPE_ICON[t.kind]} size={19} color={C.muted} />
            <Text style={{ color: C.text, flex: 1, fontSize: 15, fontWeight: '600' }}>{t.label} <Text style={[s.muted, { fontWeight: '400' }]}>· {t.files}</Text></Text>
            <Text style={s.muted}>{formatSize(t.bytes)}</Text>
          </View>
          <Bar pct={total ? (t.bytes / total) * 100 : 0} />
        </View>
      ))}

      <SectionLabel>Par dossier · du plus lourd au plus léger</SectionLabel>
      {folders.map((u, i) => (
        <Pressable key={u.folder.id} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: u.folder.id } })}
          style={({ pressed }) => [{ paddingVertical: 12, gap: 9, borderBottomWidth: i === folders.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon={u.folder.icon} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }} numberOfLines={1}>{u.folder.name}</Text>
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
      {!folders.length && <Text style={s.muted}>Aucun dossier.</Text>}

      <Text style={[s.muted, { textAlign: 'center', marginTop: 24, lineHeight: 19 }]}>
        Pour libérer de l’espace, ouvre un dossier lourd et supprime les fichiers dont tu n’as plus besoin. Les notes et les liens ne comptent presque pas. Pense à sauvegarder sur Google Drive avant de supprimer.
      </Text>
    </ScrollView>
  );
}
