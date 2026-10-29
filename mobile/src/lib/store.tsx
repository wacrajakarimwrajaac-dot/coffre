import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import { getUsage, libraryExists, loadAll, openLibrary, subscribe, writeLibrary, type Folder, type Item, type Usage } from './data';
import { migrateFromCloud } from './migrate';
import { C } from './theme';

interface Store {
  folders: Folder[];
  items: Item[];
  usage: Usage | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  childrenOf: (id: string | null) => Folder[];
  folderPath: (id: string) => string;
  countIn: (id: string) => number;
}

const Ctx = createContext<Store | null>(null);

type Setup = { phase: 'checking' } | { phase: 'migrating'; done: number; total: number; label: string } | { phase: 'failed'; message: string } | { phase: 'ready' };

/** Opens the user's library on this phone; on first launch, copies the old cloud data here first. */
export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [setup, setSetup] = useState<Setup>({ phase: 'checking' });

  const prepare = useCallback(async (skipMigration = false) => {
    openLibrary(userId);
    if (libraryExists()) return setSetup({ phase: 'ready' });
    if (skipMigration) {
      await writeLibrary({ folders: [], items: [], migratedAt: Date.now() });
      return setSetup({ phase: 'ready' });
    }
    try {
      setSetup({ phase: 'migrating', done: 0, total: 1, label: '' });
      await migrateFromCloud(userId, (done, total, label) => setSetup({ phase: 'migrating', done, total, label }));
      setSetup({ phase: 'ready' });
    } catch (e) {
      setSetup({ phase: 'failed', message: (e as Error).message });
    }
  }, [userId]);

  useEffect(() => {
    prepare();
  }, [prepare]);

  if (setup.phase === 'ready') return <Library>{children}</Library>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 28, gap: 16 }}>
      {setup.phase === 'failed' ? (
        <>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>Transfert interrompu</Text>
          <Text style={{ color: C.muted, lineHeight: 20 }}>
            Tes données n’ont pas pu être copiées sur ce téléphone ({setup.message}). Vérifie ta connexion et réessaie. Rien n’a été perdu.
          </Text>
          <Pressable onPress={() => prepare()} style={{ backgroundColor: C.primary, borderRadius: 14, padding: 15, alignItems: 'center' }}>
            <Text style={{ color: C.primaryInk, fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
          <Pressable onPress={() => prepare(true)} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: C.muted }}>Commencer avec un Coffre vide</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={C.primary} />
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
            {setup.phase === 'migrating' ? 'Transfert de tes données sur ce téléphone' : 'Ouverture…'}
          </Text>
          {setup.phase === 'migrating' && (
            <>
              <Text style={{ color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                Coffre garde maintenant tout sur ton téléphone, comme WhatsApp. C’est fait une seule fois.
              </Text>
              {setup.total > 1 && (
                <>
                  <View style={{ height: 5, backgroundColor: C.track, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: 5, width: `${(setup.done / setup.total) * 100}%`, backgroundColor: C.primary }} />
                  </View>
                  <Text style={{ color: C.muted, textAlign: 'center' }} numberOfLines={1}>{setup.done}/{setup.total} · {setup.label}</Text>
                </>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

function Library({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await loadAll();
      setFolders(data.folders);
      setItems(data.items);
      setError(null);
      getUsage().then(setUsage).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const unsubscribe = subscribe(() => void reload());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [reload]);

  const value = useMemo<Store>(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const folderPath = (id: string): string => {
      const f = byId.get(id);
      if (!f) return '';
      return f.parentId ? `${folderPath(f.parentId)} / ${f.name}` : f.name;
    };
    return {
      folders, items, usage, loading, error, reload, folderPath,
      childrenOf: (id) => folders.filter((f) => f.parentId === id),
      countIn: (id) => items.filter((i) => i.folderId === id).length,
    };
  }, [folders, items, usage, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider manquant');
  return s;
}
