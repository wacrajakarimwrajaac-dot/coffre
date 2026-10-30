import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, IconTile } from '@/components/Icon';
import { ItemRow } from '@/components/ItemRow';
import { Logo } from '@/components/Logo';
import { StorageBar } from '@/components/StorageBar';
import { Empty, Input, Pill, PromptModal, SectionLabel, s } from '@/components/ui';
import { saveFolder } from '@/lib/data';
import type { IconName } from '@/lib/icons';
import { folderUsage } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatSize, uid } from '@/lib/util';

const QUICK: [string, IconName, string][] = [['link', 'link', 'Lien'], ['note', 'file-text', 'Note'], ['voice', 'mic', 'Vocal']];

export default function Home() {
  const st = useStore();
  const [query, setQuery] = useState('');
  const [newFolder, setNewFolder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return st.items.filter((i) => [i.title, i.text, i.url, i.fileName].some((v) => v?.toLowerCase().includes(q)));
  }, [query, st.items]);

  const roots = st.childrenOf(null);
  const inbox = roots.find((f) => f.name === 'Boîte de réception') ?? roots[0];
  const recent = st.items.slice(0, 5);
  const usage = st.usage;
  const sizes = useMemo(() => new Map(folderUsage(st.folders, st.items).map((u) => [u.folder.id, u.bytes])), [st.folders, st.items]);


  const refresh = async () => {
    setRefreshing(true);
    await st.reload();
    setRefreshing(false);
  };

  const header = (
    <View style={{ paddingTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={26} />
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="user-round" size={18} color={C.muted} />
        </Pressable>
      </View>

      <Text style={[s.h1, { marginTop: 22 }]}>Mon Coffre</Text>
      <Text style={[s.muted, { fontSize: 14 }]}>{st.items.length} élément{st.items.length > 1 ? 's' : ''} · enregistrés sur ce téléphone</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, marginTop: 16 }}>
        <Icon name="search" size={18} color={C.muted} />
        <Input value={query} onChangeText={setQuery} placeholder="Rechercher dans tes dossiers" returnKeyType="search" clearButtonMode="while-editing"
          style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 14, fontSize: 15 }} />
      </View>

      {!query && (
        <>
          {inbox && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 16 }}>
              {QUICK.map(([type, icon, label]) => (
                <Pill key={type} icon={icon} label={label} onPress={() => router.push({ pathname: '/add', params: { type, folder: inbox.id } })} />
              ))}
            </ScrollView>
          )}

          <SectionLabel right={<Text onPress={() => setNewFolder(true)} style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Nouveau</Text>}>Dossiers</SectionLabel>
        </>
      )}
      {st.error && <Text style={{ color: C.danger }}>{st.error}</Text>}
    </View>
  );

  const footer = (
    <View>
      {recent.length > 0 && (
        <>
          <SectionLabel>Récents</SectionLabel>
          {recent.map((item, i) => <ItemRow key={item.id} item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} last={i === recent.length - 1} />)}
        </>
      )}
      {usage && (
        <Pressable onPress={() => router.push('/storage')} style={{ marginTop: 26, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.sectionLabel}>Espace</Text>
            <Text style={s.muted}>{formatSize(usage.usedBytes)} sur ce téléphone</Text>
          </View>
          <StorageBar usage={usage} />
          {usage.totalBytes > 0 && <Text style={s.muted}>{formatSize(usage.freeBytes)} libres sur le téléphone</Text>}
          <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Voir ce qui prend de la place</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {query ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Empty title="Aucun résultat" />}
          renderItem={({ item, index }) => <ItemRow item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} last={index === results.length - 1} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={roots}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
          renderItem={({ item: f, index }) => {
            const subs = st.childrenOf(f.id).length;
            const n = st.countIn(f.id);
            const bytes = sizes.get(f.id) ?? 0;
            return (
              <Pressable onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: index === roots.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
                <IconTile icon={f.icon} size={42} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.muted}>{n} élément{n > 1 ? 's' : ''}{subs ? ` · ${subs} sous-dossier${subs > 1 ? 's' : ''}` : ''}{bytes ? ` · ${formatSize(bytes)}` : ''}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={C.muted} />
              </Pressable>
            );
          }}
        />
      )}
      <PromptModal visible={newFolder} title="Nouveau dossier" placeholder="Ex. Fitness, Voyage, Recettes…"
        onCancel={() => setNewFolder(false)}
        onSubmit={async (name) => {
          setNewFolder(false);
          const id = uid();
          await saveFolder({ id, name, parentId: null, icon: 'folder:violet', createdAt: Date.now() });
          await st.reload();
          router.push({ pathname: '/folder/[id]', params: { id } });
        }} />
    </SafeAreaView>
  );
}
