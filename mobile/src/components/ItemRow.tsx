import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fileUrl, type Item } from '@/lib/data';
import type { IconName } from '@/lib/icons';
import { kindOf } from '@/lib/media';
import { C } from '@/lib/theme';
import { fileKind, formatSize, hostOf, linkKind, platformOf, youtubeThumb } from '@/lib/util';
import { Icon } from './Icon';
import { s } from './ui';

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
    <Pressable onPress={() => openItem(item.id)} style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: C.card }}>
      {photo ? (
        url ? <Image source={url} style={{ width: size, height: size }} contentFit="cover" recyclingKey={item.id} transition={120} /> : null
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${C.text}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={16} color={C.text} />
          </View>
          <Text style={{ position: 'absolute', bottom: 5, right: 7, color: C.muted, fontSize: 11 }}>{formatSize(item.size)}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Flat list row (hairline underneath) for links, notes, voice notes, and documents. */
export function ItemRow({ item, folderLabel, last }: { item: Item; folderLabel?: string; onChanged?: () => void; last?: boolean }) {
  const kind = kindOf(item);
  const thumb = useFileUrl(item.id, kind === 'photo');

  let icon: IconName = 'file-text';
  let tint: string = C.muted;
  let subtitle = '';
  let image: string | null = null;
  if (item.type === 'link' && item.url) {
    const p = platformOf(item.url);
    const k = linkKind(item.url);
    icon = 'link';
    tint = p?.color ?? C.primary;
    image = youtubeThumb(item.url);
    subtitle = `${p?.name ?? 'Lien'}${k ? ` · ${k}` : ''} · ${hostOf(item.url)}`;
  } else if (item.type === 'note') {
    tint = C.warn;
    subtitle = (item.text ?? '').replace(/\s+/g, ' ').trim() || 'Note';
  } else {
    icon = kind === 'audio' ? 'mic' : kind === 'video' ? 'video' : kind === 'photo' ? 'image' : 'file';
    tint = kind === 'audio' ? C.primary : kind === 'doc' ? C.muted : C.ok;
    image = thumb;
    subtitle = `${fileKind(item.mime)} · ${formatSize(item.size)}`;
  }


  return (
    <Pressable onPress={() => openItem(item.id)} style={({ pressed }) => [{
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}22` }}>
          {image ? <Image source={image} style={{ width: 40, height: 40 }} contentFit="cover" recyclingKey={item.id} /> : <Icon name={icon} size={20} color={tint} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }}>{item.title}</Text>
        <Text numberOfLines={1} style={s.muted}>{subtitle}</Text>
        {folderLabel ? <Text numberOfLines={1} style={[s.muted, { fontSize: 12 }]}>{folderLabel}</Text> : null}
      </View>
    </Pressable>
  );
}
