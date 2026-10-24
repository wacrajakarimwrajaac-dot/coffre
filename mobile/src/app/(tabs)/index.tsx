import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ItemRow } from '@/components/ItemRow';
import { Logo } from '@/components/Logo';
import { Empty, Input, PromptModal, s } from '@/components/ui';
import { saveFolder, type Folder } from '@/lib/data';
import { folderUsage } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatSize, uid } from '@/lib/util';

const QUICK: [string, string, string][] = [['link', '🔗', 'Lien'], ['note', '📝', 'Note'], ['voice', '🎤', 'Vocal'], ['task', '⏰', 'Tâche']];

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
  const top = useMemo(() => folderUsage(st.folders, st.items).filter((u) => u.bytes > 0).slice(0, 3), [st.folders, st.items]);
  const usage = st.usage;

  const refresh = async () => {
    setRefreshing(true);
    await st.reload();
    setRefreshing(false);
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 6 }}>
      <Logo size={30} />
      <Input placeholder="🔍  Rechercher partout…" value={query} onChangeText={setQuery} clearButtonMode="while-editing" returnKeyType="search" />
      {!query && (
        <>
          {inbox && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {QUICK.map(([type, icon, label]) => (
                <Pressable key={type} onPress={() => router.push({ pathname: '/add', params: { type, folder: inbox.id } })}
                  style={({ pressed }) => [s.card, { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 }, pressed && { opacity: 0.8 }]}>
                  <Text style={{ fontSize: 24 }}>{icon}</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1 }]}>Dossiers</Text>
            <Pressable hitSlop={10} onPress={() => setNewFolder(true)}><Text style={{ color: C.primary, fontSize: 15 }}>＋ Nouveau</Text></Pressable>
          </View>
        </>
      )}
      {st.error && <Text style={{ color: C.danger }}>{st.error}</Text>}
    </View>
  );

  const footer = (
    <View style={{ gap: 10, paddingTop: 18 }}>
      {recent.length > 0 && (
        <>
          <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1 }]}>Récents</Text>
          {recent.map((item) => <ItemRow key={item.id} item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} />)}
        </>
      )}
      {usage && (
        <Pressable onPress={() => router.push('/storage')} style={[s.card, { padding: 16, gap: 10, marginTop: 8 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Espace utilisé</Text>
            <Text style={{ color: C.primary }}>Gérer ›</Text>
          </View>
          <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100)}%`,
              backgroundColor: usage.usedBytes / usage.quotaBytes > 0.9 ? C.danger : C.ok }} />
          </View>
          <Text style={s.muted}>{formatSize(usage.usedBytes)} sur {formatSize(usage.quotaBytes)}</Text>
          {top.map((u) => (
            <View key={u.folder.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text }} numberOfLines={1}>{u.folder.icon} {u.folder.name}</Text>
              <Text style={s.muted}>{formatSize(u.bytes)}</Text>
            </View>
          ))}
        </Pressable>
      )}
    </View>
  );

  // Keep the 2-column grid even: an odd last tile would stretch to full width.
  const gridData: (Folder | null)[] = roots.length % 2 ? [...roots, null] : roots;

  const folderTile = ({ item: f }: { item: Folder | null }) => {
    if (!f) return <View style={{ flex: 1 }} />;
    const subs = st.childrenOf(f.id).length;
    const n = st.countIn(f.id);
    return (
      <Pressable onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
        style={({ pressed }) => [s.card, { flex: 1, padding: 16, gap: 10, minHeight: 112 }, pressed && { opacity: 0.85 }]}>
        <Text style={{ fontSize: 30 }}>{f.icon}</Text>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{f.name}</Text>
        <Text style={s.muted}>{n} élément{n > 1 ? 's' : ''}{subs ? ` · ${subs} 📁` : ''}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {query ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Empty title="Aucun résultat" />}
          renderItem={({ item }) => <ItemRow item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          key="grid"
          data={gridData}
          numColumns={2}
          keyExtractor={(f, i) => f?.id ?? `spacer-${i}`}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
          renderItem={folderTile}
        />
      )}
      <PromptModal visible={newFolder} title="Nouveau dossier (sujet)" placeholder="Ex. Fitness, Voyage, Recettes…"
        onCancel={() => setNewFolder(false)}
        onSubmit={async (name) => {
          setNewFolder(false);
          const id = uid();
          await saveFolder({ id, name, parentId: null, icon: '📁', createdAt: Date.now() });
          await st.reload();
          router.push({ pathname: '/folder/[id]', params: { id } });
        }} />
    </SafeAreaView>
  );
}
