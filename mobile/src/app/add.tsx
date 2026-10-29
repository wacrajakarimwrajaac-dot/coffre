import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { Button, Input, s } from '@/components/ui';
import { addFile, saveItem } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { hostOf, normalizeUrl, uid } from '@/lib/util';

const TITLES: Record<string, string> = { link: 'Nouveau lien', note: 'Nouvelle note', voice: 'Nouveau vocal' };

export default function Add() {
  const { type = 'link', folder } = useLocalSearchParams<{ type?: string; folder: string }>();
  const st = useStore();
  const [main, setMain] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  // Pre-fill a link copied from Instagram/Facebook/YouTube ("Copier le lien").
  useEffect(() => {
    if (type !== 'link') return;
    Clipboard.getStringAsync().then((t) => { const u = normalizeUrl(t ?? ''); if (u) setMain(u); }).catch(() => {});
  }, [type]);

  const done = async () => {
    await st.reload();
    router.back();
  };

  const save = async () => {
    const base = { id: uid(), folderId: folder, createdAt: Date.now() };
    setBusy(true);
    try {
      if (type === 'link') {
        const url = normalizeUrl(main);
        if (!url) return Alert.alert('Lien invalide', 'Colle une adresse qui commence par https://');
        await saveItem({ ...base, type: 'link', url, title: extra.trim() || hostOf(url) });
      } else if (type === 'note') {
        if (!main.trim() && !extra.trim()) return;
        await saveItem({ ...base, type: 'note', title: main.trim() || extra.trim().split('\n')[0].slice(0, 60), text: extra.trim() });
      }
      await done();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveVoice = async (uri: string, name: string) => {
    setBusy(true);
    try {
      await addFile(folder, { uri, name: `${name}.m4a`, mime: 'audio/mp4', title: name }, uid());
      await done();
    } catch (e) {
      Alert.alert('Vocal non enregistré', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <Stack.Screen options={{ title: TITLES[type] ?? 'Ajouter' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={s.muted}>Dans : {st.folderPath(folder)}</Text>
        {type === 'voice' ? (
          <VoiceRecorder onSave={saveVoice} busy={busy} />
        ) : (
          <>
            {type === 'link' && (
              <>
                <Input autoFocus placeholder="Colle le lien : reel Instagram, vidéo Facebook, YouTube…" value={main} onChangeText={setMain}
                  autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <Input placeholder="Titre (optionnel)" value={extra} onChangeText={setExtra} />
                <Text style={[s.muted, { color: C.muted }]}>Astuce : dans Instagram ou Facebook, « Partager → Copier le lien », puis reviens ici.</Text>
              </>
            )}
            {type === 'note' && (
              <>
                <Input autoFocus placeholder="Titre" value={main} onChangeText={setMain} />
                <Input placeholder="Écris ton idée…" value={extra} onChangeText={setExtra} multiline />
              </>
            )}
            <Button title="Ajouter" busy={busy} onPress={save} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
