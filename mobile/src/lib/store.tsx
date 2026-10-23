import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getUsage, loadAll, subscribe, type Folder, type Item, type Usage } from './data';
import { syncReminders } from './reminders';

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

export function StoreProvider({ children }: { children: ReactNode }) {
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
      syncReminders(data.items).catch(() => {});
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
