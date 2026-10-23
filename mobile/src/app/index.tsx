import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ItemCard } from '@/components/ItemCard';
import { Empty, Input, PromptModal, s } from '@/components/ui';
import { saveFolder } from '@/lib/data';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { formatSize, uid } from '@/lib/util';

const PLAN_NAMES: Record<string, string> = { free: 'Gratuit', plus: 'Plus', premium: 'Premium' };

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

  const pending = st.items.filter((i) => i.type === 'task' && !i.done).length;
  const roots = st.childrenOf(null);

  const refresh = async () => {
    setRefreshing(true);
    await st.reload();
    setRefreshing(false);
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={s.h1}><Text style={{ color: C.primary }}>◆</Text> Coffre</Text>
        <Pressable hitSlop={10} onPress={() => Alert.alert('Compte', undefined, [
          { text: 'Se déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() },
          { text: 'Annuler', style: 'cancel' },
        ])}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </Pressable>
      </View>
      <Input placeholder="Rechercher partout…" value={query} onChangeText={setQuery} clearButtonMode="while-editing" returnKeyType="search" />
      {!query && (
        <>
          <Pressable onPress={() => router.push('/tasks')} style={[s.card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <Text style={{ fontSize: 22 }}>⏰</Text>
            <Text style={{ color: C.text, fontSize: 16, flex: 1 }}>Tâches & rappels</Text>
            <Text style={s.muted}>{pending || ''}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <Text style={[s.muted, { textTransform: 'uppercase', letterSpacing: 1 }]}>Dossiers</Text>
            <Pressable hitSlop={10} onPress={() => setNewFolder(true)}><Text style={{ color: C.primary, fontSize: 15 }}>＋ Nouveau</Text></Pressable>
          </View>
        </>
      )}
      {st.error && <Text style={{ color: C.danger }}>{st.error}</Text>}
    </View>
  );

  const usage = st.usage;
  const footer = usage ? (
    <View style={{ paddingVertical: 20, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.muted}>Formule {PLAN_NAMES[usage.plan] ?? usage.plan}</Text>
        <Text style={s.muted}>{formatSize(usage.usedBytes)} / {formatSize(usage.quotaBytes)}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: C.line, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100)}%`,
          backgroundColor: usage.usedBytes / usage.quotaBytes > 0.9 ? C.danger : C.ok }} />
      </View>
    </View>
  ) : undefined;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {query ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Empty title="Aucun résultat" />}
          renderItem={({ item }) => <ItemCard item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={roots}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
          renderItem={({ item: f }) => (
            <Pressable onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
              style={({ pressed }) => [s.card, { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontSize: 24 }}>{f.icon}</Text>
              <Text style={{ color: C.text, fontSize: 16, flex: 1 }}>{f.name}</Text>
              <Text style={s.muted}>{st.countIn(f.id) || ''}{st.childrenOf(f.id).length ? `  ·  ${st.childrenOf(f.id).length} 📁` : ''}</Text>
            </Pressable>
          )}
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
