// Storage for folders, items and file blobs: Supabase when configured, otherwise IndexedDB.
import { supabase } from './supabase';

export type ItemType = 'link' | 'note' | 'file' | 'task';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  createdAt: number;
}

export interface Item {
  id: string;
  folderId: string;
  type: ItemType;
  title: string;
  text?: string;
  url?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  dueAt?: number;
  done?: boolean;
  remindedAt?: number;
  createdAt: number;
}

type Store = 'folders' | 'items' | 'blobs';
type Table = 'folders' | 'items';

// ---- Local backend (IndexedDB), used when Supabase is not configured ----

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('coffre', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('folders', { keyPath: 'id' });
      db.createObjectStore('items', { keyPath: 'id' });
      db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// ---- Cloud backend (Supabase): rows use snake_case columns ----

const toRow = (table: Table, v: Folder | Item): Record<string, unknown> => {
  if (table === 'folders') {
    const f = v as Folder;
    return { id: f.id, name: f.name, parent_id: f.parentId, icon: f.icon, created_at: f.createdAt };
  }
  const i = v as Item;
  return {
    id: i.id, folder_id: i.folderId, type: i.type, title: i.title, text: i.text ?? null, url: i.url ?? null,
    file_name: i.fileName ?? null, mime: i.mime ?? null, size: i.size ?? null, due_at: i.dueAt ?? null,
    done: i.done ?? null, reminded_at: i.remindedAt ?? null, created_at: i.createdAt,
  };
};

const fromRow = (table: Table, r: any): Folder | Item => {
  if (table === 'folders') {
    return { id: r.id, name: r.name, parentId: r.parent_id, icon: r.icon, createdAt: Number(r.created_at) };
  }
  const num = (x: unknown) => (x === null || x === undefined ? undefined : Number(x));
  return {
    id: r.id, folderId: r.folder_id, type: r.type, title: r.title, text: r.text ?? undefined, url: r.url ?? undefined,
    fileName: r.file_name ?? undefined, mime: r.mime ?? undefined, size: num(r.size), dueAt: num(r.due_at),
    done: r.done ?? undefined, remindedAt: num(r.reminded_at), createdAt: Number(r.created_at),
  };
};

async function userId(): Promise<string> {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new Error('Non connecté');
  return data.session.user.id;
}

const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
  return data;
};

// ---- Public API (same for both backends) ----

export const uid = () => crypto.randomUUID();

export async function getAll<T>(table: Table): Promise<T[]> {
  if (!supabase) return run<T[]>(table, 'readonly', (s) => s.getAll());
  const rows = check(await supabase.from(table).select('*')) ?? [];
  return rows.map((r) => fromRow(table, r) as T);
}

export async function put(table: Table, value: Folder | Item) {
  if (!supabase) return run(table, 'readwrite', (s) => s.put(value));
  check(await supabase.from(table).upsert(toRow(table, value)));
}

export async function remove(store: Store, id: string) {
  if (!supabase) return run(store, 'readwrite', (s) => s.delete(id));
  if (store === 'blobs') check(await supabase.storage.from('files').remove([`${await userId()}/${id}`]));
  else check(await supabase.from(store).delete().eq('id', id));
}

export async function putBlob(id: string, blob: Blob) {
  if (!supabase) return run('blobs', 'readwrite', (s) => s.put(blob, id));
  check(await supabase.storage.from('files').upload(`${await userId()}/${id}`, blob, {
    upsert: true, contentType: blob.type || 'application/octet-stream',
  }));
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  if (!supabase) return run<Blob | undefined>('blobs', 'readonly', (s) => s.get(id));
  const { data } = await supabase.storage.from('files').download(`${await userId()}/${id}`);
  return data ?? undefined;
}

/** Calls onChange whenever another device changes this user's data. */
export function subscribe(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel('coffre-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}

// ---- Backup ----

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function exportBackup(): Promise<Blob> {
  const folders = await getAll<Folder>('folders');
  const items = await getAll<Item>('items');
  const blobs: Record<string, string> = {};
  for (const it of items) {
    if (it.type !== 'file') continue;
    const b = await getBlob(it.id);
    if (b) blobs[it.id] = await toDataUrl(b);
  }
  return new Blob([JSON.stringify({ app: 'coffre', version: 1, folders, items, blobs })], { type: 'application/json' });
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'coffre') throw new Error('Fichier de sauvegarde invalide');
  for (const f of data.folders as Folder[]) await put('folders', f);
  for (const it of data.items as Item[]) await put('items', it);
  for (const [id, url] of Object.entries(data.blobs as Record<string, string>)) {
    await putBlob(id, await (await fetch(url)).blob());
  }
}

// ---- Browser bookmarks (Netscape HTML export from Chrome/Firefox/Edge/Safari) ----

export async function importBookmarks(file: File, parentId: string | null): Promise<number> {
  const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
  let count = 0;
  const now = Date.now();

  const makeFolder = async (name: string, parent: string | null) => {
    const f: Folder = { id: uid(), name, parentId: parent, icon: '🔖', createdAt: now };
    await put('folders', f);
    return f.id;
  };

  const walk = async (dl: Element, folderId: string) => {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const a = dt.querySelector(':scope > a');
      const h3 = dt.querySelector(':scope > h3');
      if (a?.getAttribute('href')?.startsWith('http')) {
        await put('items', {
          id: uid(), folderId, type: 'link', url: a.getAttribute('href')!,
          title: a.textContent?.trim() || a.getAttribute('href')!, createdAt: now,
        });
        count++;
      } else if (h3) {
        const sub = dt.querySelector(':scope > dl');
        if (sub) await walk(sub, await makeFolder(h3.textContent?.trim() || 'Dossier', folderId));
      }
    }
  };

  const root = doc.querySelector('dl');
  if (root) await walk(root, await makeFolder('Favoris importés', parentId));
  return count;
}
