import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File as FsFile, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon, parseIcon } from '@/components/Icon';
import { Button, Chip, Empty, Input, Sheet, SheetRow, s } from '@/components/ui';
import { deleteItem, fileUrl, saveItem, type Item } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { fileKind, formatSize, normalizeUrl, platformOf } from '@/lib/util';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const original = st.items.find((i) => i.id === id);
  const [it, setIt] = useState<Item | undefined>(original);
  const [url, setUrl] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (original?.type === 'file') fileUrl(original.id).then(setUrl).catch(() => {});
  }, [original?.id, original?.type]);

  if (!it || !original) return <Empty title="Élément introuvable" />;
  const set = (patch: Partial<Item>) => setIt({ ...it, ...patch });
  const dirty = JSON.stringify(it) !== JSON.stringify(original);

  const save = async () => {
    const link = it.type === 'link' ? normalizeUrl(it.url ?? '') : undefined;
    if (it.type === 'link' && !link) return Alert.alert('Lien invalide');
    setBusy(true);
    try {
      await saveItem({ ...it, ...(link ? { url: link } : {}) });
      await st.reload();
      router.back();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Supprimer cet élément ?', it.title, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteItem(original);
        await st.reload();
        router.back();
      } },
    ]);

  const share = async () => {
    if (!url) return;
    setBusy(true);
    try {
      // Share a copy carrying the original file name (the library keeps files under their id).
      const dest = new FsFile(Paths.cache, it.fileName ?? `${it.id}`);
      if (dest.exists) dest.delete();
      await new FsFile(url).copy(dest);
      await Sharing.shareAsync(dest.uri, { mimeType: it.mime });
    } catch (e) {
      Alert.alert('Partage impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const platform = it.url ? platformOf(it.url) : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {it.type === 'file' && url && it.mime?.startsWith('image/') && (
          <Image source={url} style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} contentFit="contain" />
        )}
        {it.type === 'file' && url && it.mime?.startsWith('video/') && <VideoBox uri={url} />}
        {it.type === 'file' && url && it.mime?.startsWith('audio/') && <AudioBox uri={url} />}
        {it.type === 'file' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Chip label={fileKind(it.mime)} />
            <Text style={s.muted}>{formatSize(it.size)} · {it.fileName}</Text>
          </View>
        )}
        {it.type === 'link' && it.url && (
          <Button title={`Ouvrir dans ${platform?.name ?? 'le navigateur'}`} onPress={() => Linking.openURL(it.url!)} />
        )}

        <View>
          <Text style={s.label}>Titre</Text>
          <Input value={it.title} onChangeText={(title) => set({ title })} />
        </View>
        {it.type === 'link' && (
          <View>
            <Text style={s.label}>Lien</Text>
            <Input value={it.url} onChangeText={(u) => set({ url: u })} autoCapitalize="none" keyboardType="url" />
          </View>
        )}
        {it.type !== 'file' && (
          <View>
            <Text style={s.label}>{it.type === 'note' ? 'Texte' : 'Notes'}</Text>
            <Input value={it.text ?? ''} onChangeText={(text) => set({ text })} multiline />
          </View>
        )}
        <View>
          <Text style={s.label}>Dossier</Text>
          <Pressable onPress={() => setMoving(true)} style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Text style={{ flex: 1, color: C.text, fontSize: 16 }}>{st.folderPath(it.folderId)}</Text>
            <Icon name="chevron-down" size={18} color={C.muted} />
          </Pressable>
        </View>

        {dirty && <Button title="Enregistrer" busy={busy} onPress={save} />}
        {it.type === 'file' && <Button kind="ghost" title="Partager / Enregistrer sur le téléphone" busy={busy} onPress={share} />}
        <Button kind="danger" title="Supprimer" onPress={remove} />
      </ScrollView>

      <Sheet visible={moving} onClose={() => setMoving(false)} title="Déplacer vers">
        {st.folders.map((f) => (
          <SheetRow key={f.id} icon={parseIcon(f.icon).name} selected={f.id === it.folderId} label={st.folderPath(f.id)}
            onPress={() => { set({ folderId: f.id }); setMoving(false); }} />
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function VideoBox({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} nativeControls fullscreenOptions={{ enable: true }} />;
}

function AudioBox({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  return (
    <View style={[s.card, { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }]}>
      <Pressable onPress={() => (st.playing ? player.pause() : (st.didJustFinish || st.currentTime >= st.duration ? (player.seekTo(0), player.play()) : player.play()))}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={st.playing ? 'pause' : 'play'} size={22} color={C.primaryInk} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 4, backgroundColor: C.line, borderRadius: 2 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: C.primary, width: `${st.duration ? (st.currentTime / st.duration) * 100 : 0}%` }} />
        </View>
        <Text style={s.muted}>{fmt(st.currentTime)} / {fmt(st.duration || 0)}</Text>
      </View>
    </View>
  );
}
