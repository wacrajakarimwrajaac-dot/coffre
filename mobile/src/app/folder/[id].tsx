import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddSheet } from '@/components/AddSheet';
import { ACCENT_CHOICES, Icon, ICON_CHOICES, IconTile, makeIcon, parseIcon } from '@/components/Icon';
import { ItemRow, MediaThumb } from '@/components/ItemRow';
import { Empty, Pill, PromptModal, Sheet, SheetRow, s } from '@/components/ui';
import { deleteFolder, saveFolder, type Item } from '@/lib/data';
import { kindOf, type Kind } from '@/lib/media';
import { useStore } from '@/lib/store';
import { ACCENTS, C } from '@/lib/theme';
import { uid } from '@/lib/util';

type Filter = 'all' | 'media' | 'link' | 'note' | 'audio' | 'doc';
const FILTERS: [Filter, string][] = [['all', 'Tout'], ['media', 'Photos & vidéos'], ['link', 'Liens'], ['note', 'Notes'], ['audio', 'Vocaux'], ['doc', 'Documents']];
const SECTIONS: { kind: Kind; title: string; filter: Filter }[] = [
  { kind: 'photo', title: 'Photos', filter: 'media' }, { kind: 'video', title: 'Vidéos', filter: 'media' },
  { kind: 'link', title: 'Liens', filter: 'link' }, { kind: 'note', title: 'Notes', filter: 'note' },
  { kind: 'audio', title: 'Vocaux', filter: 'audio' }, { kind: 'doc', title: 'Documents', filter: 'doc' },
];
const MEDIA_PREVIEW = 6; // thumbnails shown per section in the "Tout" view

type Row =
  | { k: 'header'; id: string; title: string; count: number; more?: Filter }
  | { k: 'grid'; id: string; items: Item[] }
  | { k: 'item'; id: string; item: Item; last: boolean };

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
  const { width } = useWindowDimensions();
  const gap = 6;
  const thumb = Math.floor((width - 40 - gap * 2) / 3);

  const rows = useMemo<Row[]>(() => {
    const own = st.items.filter((i) => i.folderId === folder?.id);
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
        list.forEach((item, i) => out.push({ k: 'item', id: item.id, item, last: i === list.length - 1 }));
      }
    }
    return out;
  }, [st.items, folder?.id, filter]);

  if (!folder) return <Empty title="Dossier introuvable" />;

  const subs = st.childrenOf(folder.id);
  const current = parseIcon(folder.icon);

  const remove = () => {
    const n = st.items.filter((i) => i.folderId === folder.id).length;
    Alert.alert('Supprimer le dossier ?', `« ${folder.name} », ses sous-dossiers et ${n} élément(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteFolder(folder.id);
        await st.reload();
        router.back();
      } },
    ]);
  };

  const setIcon = async (name: typeof current.name, accent: typeof current.accent) => {
    await saveFolder({ ...folder, icon: makeIcon(name, accent) });
    st.reload();
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{
        title: folder.name,
        headerRight: () => <Pressable hitSlop={12} onPress={() => setMenu(true)}><Icon name="ellipsis" size={22} /></Pressable>,
      }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 6 }}>
            {subs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {subs.map((f) => (
                  <Pressable key={f.id} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderRadius: 14, paddingVertical: 8, paddingLeft: 8, paddingRight: 14 }}>
                    <IconTile icon={f.icon} size={30} />
                    <Text style={{ color: C.text, fontWeight: '600' }}>{f.name}</Text>
                    <Text style={s.muted}>{st.countIn(f.id) || ''}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {FILTERS.map(([t, label]) => <Pill key={t} label={label} on={filter === t} onPress={() => setFilter(t)} />)}
            </ScrollView>
            {uploading > 0 && (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
                <Text style={s.muted}>Envoi de {uploading} fichier(s)…</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Empty title="Rien ici pour l’instant" hint="Appuie sur + pour ajouter un lien, une note, un vocal, une photo…" />}
        renderItem={({ item: r }) => {
          if (r.k === 'header') {
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 }}>
                <Text style={s.sectionLabel}>{r.title} · {r.count}</Text>
                {r.more && <Text onPress={() => setFilter(r.more!)} style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Voir tout</Text>}
              </View>
            );
          }
          if (r.k === 'grid') {
            return (
              <View style={{ flexDirection: 'row', gap, marginBottom: gap }}>
                {r.items.map((m) => <MediaThumb key={m.id} item={m} size={thumb} />)}
              </View>
            );
          }
          return <ItemRow item={r.item} onChanged={st.reload} last={r.last} />;
        }}
      />

      <Pressable onPress={() => setAdding(true)}
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + 20, width: 58, height: 58, borderRadius: 29, backgroundColor: C.primary,
          alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <Icon name="plus" size={26} color={C.primaryInk} strokeWidth={2.2} />
      </Pressable>

      <AddSheet visible={adding} folderId={folder.id} onClose={() => setAdding(false)} onUploading={setUploading} onDone={st.reload} />

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetRow icon="folder" label="Nouveau sous-dossier" onPress={() => { setMenu(false); setPrompt('sub'); }} />
        <SheetRow icon="pencil" label="Renommer" onPress={() => { setMenu(false); setPrompt('rename'); }} />
        <SheetRow icon="palette" label="Icône et couleur" onPress={() => { setMenu(false); setIconPicker(true); }} />
        <SheetRow icon="trash" label="Supprimer le dossier" danger onPress={() => { setMenu(false); remove(); }} />
      </Sheet>

      <Sheet visible={iconPicker} onClose={() => setIconPicker(false)} title="Icône et couleur">
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingVertical: 10 }}>
          {ACCENT_CHOICES.map((a) => (
            <Pressable key={a} onPress={() => setIcon(current.name, a)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENTS[a],
              borderWidth: current.accent === a ? 3 : 0, borderColor: C.text }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
          {ICON_CHOICES.map((n) => (
            <Pressable key={n} onPress={() => setIcon(n, current.accent)} style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
              backgroundColor: current.name === n ? `${current.color}26` : C.surface }}>
              <Icon name={n} size={24} color={current.name === n ? current.color : C.muted} />
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
          else await saveFolder({ id: uid(), name, parentId: folder.id, icon: 'folder:violet', createdAt: Date.now() });
          st.reload();
        }} />
    </View>
  );
}
