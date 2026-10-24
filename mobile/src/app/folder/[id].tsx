import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddSheet } from '@/components/AddSheet';
import { ItemRow, MediaThumb } from '@/components/ItemRow';
import { Empty, PromptModal, Sheet, SheetRow, s } from '@/components/ui';
import { deleteFolder, saveFolder, type Item } from '@/lib/data';
import { kindOf, type Kind } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { uid } from '@/lib/util';

type Filter = 'all' | 'media' | 'link' | 'note' | 'audio' | 'doc' | 'task';
const FILTERS: [Filter, string][] = [['all', 'Tout'], ['media', 'Photos & vidéos'], ['link', 'Liens'], ['note', 'Notes'], ['audio', 'Vocaux'], ['doc', 'Documents'], ['task', 'Tâches']];
const SECTIONS: { kind: Kind; title: string; filter: Filter }[] = [
  { kind: 'photo', title: 'Photos', filter: 'media' }, { kind: 'video', title: 'Vidéos', filter: 'media' },
  { kind: 'link', title: 'Liens', filter: 'link' }, { kind: 'note', title: 'Notes', filter: 'note' },
  { kind: 'audio', title: 'Vocaux', filter: 'audio' }, { kind: 'doc', title: 'Documents', filter: 'doc' },
  { kind: 'task', title: 'Tâches', filter: 'task' },
];
const MEDIA_PREVIEW = 6; // thumbnails shown per section in the "Tout" view

type Row =
  | { k: 'header'; id: string; title: string; count: number; more?: Filter }
  | { k: 'grid'; id: string; items: Item[] }
  | { k: 'item'; id: string; item: Item };
const ICONS = ['📁', '💡', '📚', '🎬', '🎵', '💼', '🏋️', '🍳', '✈️', '🏠', '💻', '🎨', '🛒', '❤️', '📥', '🔖'];

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const insets = useSafeAreaInsets();
  const folder = st.folders.find((f) => f.id === id);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [prompt, setPrompt] = useState<'sub' | 'rename' | null>(null);
  const [iconPicker, setIconPicker] = useState(false);
  const [uploading, setUploading] = useState(0);

  if (!folder) return <Empty title="Dossier introuvable" />;

  const subs = st.childrenOf(folder.id);
  const { width } = useWindowDimensions();
  const gap = 6;
  const thumb = Math.floor((width - 32 - gap * 2) / 3);

  const rows = useMemo<Row[]>(() => {
    const own = st.items.filter((i) => i.folderId === folder.id);
    const out: Row[] = [];
    for (const sec of SECTIONS) {
      if (filter !== 'all' && filter !== sec.filter) continue;
      const list = own.filter((i) => kindOf(i) === sec.kind);
      if (!list.length) continue;
      const isMediaSection = sec.kind === 'photo' || sec.kind === 'video';
      const limited = filter === 'all' && isMediaSection && list.length > MEDIA_PREVIEW;
      out.push({ k: 'header', id: `h-${sec.kind}`, title: sec.title, count: list.length, more: limited ? sec.filter : undefined });
      if (isMediaSection) {
        const shown = limited ? list.slice(0, MEDIA_PREVIEW) : list;
        for (let i = 0; i < shown.length; i += 3) out.push({ k: 'grid', id: `g-${sec.kind}-${i}`, items: shown.slice(i, i + 3) });
      } else {
        for (const item of list) out.push({ k: 'item', id: item.id, item });
      }
    }
    return out;
  }, [st.items, folder.id, filter]);

  const remove = () => {
    const n = st.items.filter((i) => i.folderId === folder.id).length;
    Alert.alert('Supprimer le dossier ?', `« ${folder.name} », ses sous-dossiers et ${n} élément(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteFolder(folder.id, st.folders, st.items);
        await st.reload();
        router.back();
      } },
    ]);
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{
        title: `${folder.icon} ${folder.name}`,
        headerRight: () => <Pressable hitSlop={10} onPress={() => setMenu(true)}><Text style={{ color: C.text, fontSize: 22 }}>⋯</Text></Pressable>,
      }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            {subs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {subs.map((f) => (
                  <Pressable key={f.id} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
                    style={[s.card, { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 8 }]}>
                    <Text>{f.icon}</Text><Text style={{ color: C.text }}>{f.name}</Text>
                    <Text style={s.muted}>{st.countIn(f.id) || ''}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {FILTERS.map(([t, label]) => (
                <Pressable key={t} onPress={() => setFilter(t)}
                  style={{ borderWidth: 1, borderColor: filter === t ? C.primary : C.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ color: filter === t ? C.primary : C.muted }}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {uploading > 0 && (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
                <Text style={s.muted}>Envoi de {uploading} fichier(s)…</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Empty title="Rien ici pour l'instant" hint="Appuie sur ＋ pour ajouter un lien, une note, un vocal, une photo…" />}
        renderItem={({ item: r }) => {
          if (r.k === 'header') {
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
                  {r.title} <Text style={{ color: C.muted, fontWeight: '400' }}>{r.count}</Text>
                </Text>
                {r.more && <Text onPress={() => setFilter(r.more!)} style={{ color: C.primary }}>Voir tout ›</Text>}
              </View>
            );
          }
          if (r.k === 'grid') {
            return (
              <View style={{ flexDirection: 'row', gap }}>
                {r.items.map((m) => <MediaThumb key={m.id} item={m} size={thumb} />)}
              </View>
            );
          }
          return <ItemRow item={r.item} onChanged={st.reload} />;
        }}
      />

      <Pressable onPress={() => setAdding(true)}
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + 20, width: 62, height: 62, borderRadius: 31,
          backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <Text style={{ color: C.primaryInk, fontSize: 32, marginTop: -2 }}>＋</Text>
      </Pressable>

      <AddSheet visible={adding} folderId={folder.id} onClose={() => setAdding(false)} onUploading={setUploading} onDone={st.reload} />

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetRow icon="📁" label="Nouveau sous-dossier" onPress={() => { setMenu(false); setPrompt('sub'); }} />
        <SheetRow icon="✏️" label="Renommer" onPress={() => { setMenu(false); setPrompt('rename'); }} />
        <SheetRow icon="😀" label="Changer l'icône" onPress={() => { setMenu(false); setIconPicker(true); }} />
        <SheetRow icon="🗑️" label="Supprimer le dossier" onPress={() => { setMenu(false); remove(); }} />
      </Sheet>

      <Sheet visible={iconPicker} onClose={() => setIconPicker(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 8 }}>
          {ICONS.map((icon) => (
            <Pressable key={icon} onPress={async () => { setIconPicker(false); await saveFolder({ ...folder, icon }); st.reload(); }}
              style={{ width: 54, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: icon === folder.icon ? C.card : 'transparent' }}>
              <Text style={{ fontSize: 28 }}>{icon}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <PromptModal visible={prompt !== null} title={prompt === 'sub' ? 'Nouveau sous-dossier' : 'Renommer le dossier'}
        initial={prompt === 'rename' ? folder.name : ''} onCancel={() => setPrompt(null)}
        onSubmit={async (name) => {
          const kind = prompt;
          setPrompt(null);
          if (kind === 'rename') await saveFolder({ ...folder, name });
          else await saveFolder({ id: uid(), name, parentId: folder.id, icon: '📁', createdAt: Date.now() });
          st.reload();
        }} />
    </View>
  );
}
