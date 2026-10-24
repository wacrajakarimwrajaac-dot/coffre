import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fileUrl, saveItem, type Item } from '@/lib/data';
import { kindOf } from '@/lib/media';
import { C } from '@/lib/theme';
import { fileKind, formatDue, formatSize, hostOf, linkKind, platformOf, youtubeThumb } from '@/lib/util';

export function useFileUrl(itemId: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (enabled) fileUrl(itemId).then(setUrl).catch(() => {});
  }, [itemId, enabled]);
  return url;
}

export const openItem = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

/** Square thumbnail of a photo or video (videos show a play badge). */
export function MediaThumb({ item, size }: { item: Item; size: number }) {
  const photo = kindOf(item) === 'photo';
  const url = useFileUrl(item.id, photo);
  return (
    <Pressable onPress={() => openItem(item.id)} style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: C.card }}>
      {photo ? (
        url ? <Image source={url} style={{ width: size, height: size }} contentFit="cover" recyclingKey={item.id} transition={120} /> : null
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101830' }}>
          <Text style={{ fontSize: size / 3, color: C.text }}>▶</Text>
          <Text style={{ position: 'absolute', bottom: 4, right: 6, color: C.muted, fontSize: 11 }}>{formatSize(item.size)}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Compact list row for links, notes, voice notes, documents and tasks. */
export function ItemRow({ item, folderLabel, onChanged }: { item: Item; folderLabel?: string; onChanged: () => void }) {
  const kind = kindOf(item);
  const photo = kind === 'photo';
  const thumb = useFileUrl(item.id, photo);

  let icon = '📝';
  let tint: string | undefined;
  let subtitle = '';
  let image: string | null = null;
  if (item.type === 'link' && item.url) {
    const p = platformOf(item.url);
    const k = linkKind(item.url);
    icon = '🔗';
    tint = p?.color;
    image = youtubeThumb(item.url);
    subtitle = `${p?.name ?? 'Lien'}${k ? ` · ${k}` : ''} · ${hostOf(item.url)}`;
  } else if (item.type === 'note') {
    subtitle = (item.text ?? '').replace(/\s+/g, ' ').trim() || 'Note';
  } else if (item.type === 'task') {
    subtitle = item.dueAt ? `⏰ ${formatDue(item.dueAt)}` : 'Tâche';
  } else {
    icon = kind === 'audio' ? '🎤' : kind === 'video' ? '🎬' : kind === 'photo' ? '🖼️' : '📄';
    image = thumb;
    subtitle = `${fileKind(item.mime)} · ${formatSize(item.size)}`;
  }

  const overdue = item.type === 'task' && !item.done && !!item.dueAt && item.dueAt < Date.now();

  return (
    <Pressable onPress={() => openItem(item.id)} style={({ pressed }) => [{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: C.card,
      borderWidth: 1, borderColor: C.line }, pressed && { opacity: 0.85 }]}>
      {item.type === 'task' ? (
        <Pressable hitSlop={10} onPress={async () => { await saveItem({ ...item, done: !item.done }); onChanged(); }}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: item.done ? C.primary : C.muted,
            backgroundColor: item.done ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {item.done && <Text style={{ color: C.primaryInk, fontWeight: '900', fontSize: 13 }}>✓</Text>}
          </View>
        </Pressable>
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          backgroundColor: tint ? `${tint}26` : C.panel }}>
          {image ? <Image source={image} style={{ width: 44, height: 44 }} contentFit="cover" recyclingKey={item.id} />
            : <Text style={{ fontSize: 20 }}>{icon}</Text>}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: item.done ? C.muted : C.text, fontSize: 15, fontWeight: '600',
          textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ color: overdue ? C.danger : C.muted, fontSize: 13 }}>{subtitle}</Text>
        {folderLabel ? <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>📁 {folderLabel}</Text> : null}
      </View>
    </Pressable>
  );
}
