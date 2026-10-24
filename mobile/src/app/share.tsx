import { router } from 'expo-router';
import { useShareIntentContext, type ShareIntentFile } from 'expo-share-intent';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Input, s } from '@/components/ui';
import { addFile, saveItem } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { fileKind, formatSize, hostOf, linkKind, normalizeUrl, platformOf, uid } from '@/lib/util';

/** Receives what the user shared from Instagram, Facebook, YouTube, the gallery… and files it in a folder. */
export default function Share() {
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const st = useStore();

  const url = useMemo(() => {
    const candidate = shareIntent.webUrl ?? shareIntent.text ?? '';
    return shareIntent.files?.length ? null : normalizeUrl(candidate);
  }, [shareIntent]);
  const files: ShareIntentFile[] = shareIntent.files ?? [];
  const text = (shareIntent.text ?? '').trim();

  const inbox = st.folders.find((f) => !f.parentId && f.name === 'Boîte de réception') ?? st.folders[0];
  const [folderId, setFolderId] = useState<string | undefined>(inbox?.id);
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(() => shareIntent.meta?.title?.trim() ?? '');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    resetShareIntent();
    await st.reload();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const cancel = () => {
    resetShareIntent();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const save = async () => {
    if (!folderId) return;
    setBusy(true);
    try {
      const base = { id: uid(), folderId, createdAt: Date.now() };
      if (files.length) {
        const errors: string[] = [];
        for (const f of files) {
          try {
            await addFile(folderId, {
              uri: f.path.startsWith('/') ? `file://${f.path}` : f.path,
              name: f.fileName, mime: f.mimeType || 'application/octet-stream', size: f.size ?? undefined,
              title: files.length === 1 && title.trim() ? title.trim() : undefined,
            }, uid());
          } catch (e) {
            errors.push(`${f.fileName} : ${(e as Error).message}`);
          }
        }
        if (errors.length) Alert.alert('Certains fichiers n’ont pas été ajoutés', errors.join('\n'));
      } else if (url) {
        await saveItem({ ...base, type: 'link', url, title: title.trim() || hostOf(url),
          text: text.replace(url, '').trim() || undefined });
      } else if (text) {
        await saveItem({ ...base, type: 'note', title: title.trim() || text.split('\n')[0].slice(0, 60), text });
      } else {
        return cancel();
      }
      await finish();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const platform = url ? platformOf(url) : null;
  const kind = url ? linkKind(url) : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { padding: 14, gap: 8 }]}>
          {url ? (
            <>
              <Chip label={`${platform?.name ?? 'Lien'}${kind ? ` · ${kind}` : ''}`} color={platform?.color} />
              <Text style={{ color: C.text }} numberOfLines={3}>{url}</Text>
            </>
          ) : files.length ? (
            files.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Chip label={fileKind(f.mimeType)} />
                <Text style={{ color: C.text, flex: 1 }} numberOfLines={1}>{f.fileName}</Text>
                <Text style={s.muted}>{formatSize(f.size ?? 0)}</Text>
              </View>
            ))
          ) : text ? (
            <>
              <Chip label="Note" />
              <Text style={{ color: C.text }} numberOfLines={6}>{text}</Text>
            </>
          ) : (
            <Text style={s.muted}>Rien à enregistrer.</Text>
          )}
        </View>

        {(url || text || files.length === 1) && (
          <View>
            <Text style={s.label}>Titre (optionnel)</Text>
            <Input value={title} onChangeText={setTitle} placeholder={url ? hostOf(url) : files.length === 1 ? files[0].fileName : 'Titre'} />
          </View>
        )}

        <View>
          <Text style={s.label}>Enregistrer dans</Text>
          <Pressable onPress={() => setPicking((p) => !p)} style={s.input}>
            <Text style={{ color: C.text, fontSize: 16 }}>{folderId ? `📁 ${st.folderPath(folderId)}` : 'Choisir un dossier'}</Text>
          </Pressable>
          {picking && (
            <View style={[s.card, { marginTop: 8 }]}>
              {st.folders.map((f) => (
                <Pressable key={f.id} onPress={() => { setFolderId(f.id); setPicking(false); }}
                  style={{ padding: 14, flexDirection: 'row', gap: 10, backgroundColor: f.id === folderId ? C.panel : 'transparent' }}>
                  <Text>{f.icon}</Text>
                  <Text style={{ color: C.text }}>{st.folderPath(f.id)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Button title="Enregistrer" busy={busy} disabled={!folderId || (!url && !text && !files.length)} onPress={save} />
        <Button kind="ghost" title="Annuler" onPress={cancel} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
