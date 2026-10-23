// Local-only storage (IndexedDB): folders, items, and file blobs.

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

export const uid = () => crypto.randomUUID();

export const getAll = <T>(store: 'folders' | 'items') => run<T[]>(store, 'readonly', (s) => s.getAll());
export const put = (store: 'folders' | 'items', value: Folder | Item) => run(store, 'readwrite', (s) => s.put(value));
export const remove = (store: Store, id: string) => run(store, 'readwrite', (s) => s.delete(id));
export const putBlob = (id: string, blob: Blob) => run('blobs', 'readwrite', (s) => s.put(blob, id));
export const getBlob = (id: string) => run<Blob | undefined>('blobs', 'readonly', (s) => s.get(id));

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
