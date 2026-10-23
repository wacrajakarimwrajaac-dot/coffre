import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { fileUrl, saveItem, type Item } from '@/lib/data';
import { C } from '@/lib/theme';
import { fileKind, formatDue, formatSize, hostOf, linkKind, platformOf, youtubeThumb } from '@/lib/util';
import { Chip, s } from './ui';

function useFileUrl(item: Item, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (enabled) fileUrl(item.id).then(setUrl).catch(() => {});
  }, [item.id, enabled]);
  return url;
}

export function ItemCard({ item, folderLabel, onChanged }: { item: Item; folderLabel?: string; onChanged: () => void }) {
  const isImage = item.type === 'file' && !!item.mime?.startsWith('image/');
  const thumb = useFileUrl(item, isImage);
  const open = () => router.push({ pathname: '/item/[id]', params: { id: item.id } });

  if (item.type === 'task') {
    const overdue = !item.done && !!item.dueAt && item.dueAt < Date.now();
    const toggle = async () => {
      await saveItem({ ...item, done: !item.done });
      onChanged();
    };
    return (
      <Pressable onPress={open} style={[s.card, { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' }]}>
        <Pressable onPress={toggle} hitSlop={12}
          style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: item.done ? C.primary : C.muted,
            backgroundColor: item.done ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {item.done && <Text style={{ color: C.primaryInk, fontWeight: '900' }}>✓</Text>}
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: item.done ? C.muted : C.text, fontSize: 16, fontWeight: '600',
            textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.title}</Text>
          {item.dueAt ? (
            <Text style={{ color: overdue ? C.danger : C.ok, fontSize: 13 }}>
              ⏰ {formatDue(item.dueAt)}{overdue ? ' · en retard' : ''}
            </Text>
          ) : null}
          {folderLabel ? <Text style={s.muted}>{folderLabel}</Text> : null}
        </View>
      </Pressable>
    );
  }

  let chip = <Chip label="Note" />;
  let image: string | null = null;
  let subtitle: string | undefined = item.text;
  if (item.type === 'link' && item.url) {
    const p = platformOf(item.url);
    const kind = linkKind(item.url);
    chip = <Chip label={`${p?.name ?? 'Lien'}${kind ? ` · ${kind}` : ''}`} color={p?.color} />;
    image = youtubeThumb(item.url);
    subtitle = item.text || hostOf(item.url);
  } else if (item.type === 'file') {
    chip = <Chip label={fileKind(item.mime)} />;
    image = thumb;
    subtitle = formatSize(item.size);
  }

  return (
    <Pressable
      onPress={open}
      onLongPress={() => item.url && Linking.openURL(item.url)}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      {image && <Image source={image} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }} contentFit="cover" />}
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {chip}
          {item.type === 'file' && item.mime?.startsWith('video/') && <Text style={s.muted}>▶︎</Text>}
          {item.type === 'file' && item.mime?.startsWith('audio/') && <Text style={s.muted}>🎤</Text>}
        </View>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
        {subtitle ? <Text style={{ color: '#cdd3e3', fontSize: 14 }} numberOfLines={item.type === 'note' ? 5 : 1}>{subtitle}</Text> : null}
        {folderLabel ? <Text style={s.muted}>{folderLabel}</Text> : null}
      </View>
    </Pressable>
  );
}
