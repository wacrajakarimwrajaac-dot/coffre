// Types shared with the app, the computer's own copy of the library (IndexedDB) and the bookmarks importer.

export type ItemType = 'link' | 'note' | 'file';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  createdAt: number;
  /** Time of the last change (ms); createdAt when missing. */
  updatedAt?: number;
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
  createdAt: number;
  updatedAt?: number;
}

export const uid = () => crypto.randomUUID();

export const INBOX = 'Boîte de réception';

// ---- Local storage: the computer keeps a full copy of the library, files included ----

type Store = 'folders' | 'items' | 'blobs' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('coffre-pc', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('folders', { keyPath: 'id' });
      db.createObjectStore('items', { keyPath: 'id' });
      db.createObjectStore('blobs');
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Stockage local interrompu'));
  });
}

export const idb = {
  all: <T,>(store: Store) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  keys: (store: Store) => run<string[]>(store, 'readonly', (s) => s.getAllKeys() as IDBRequest),
  get: <T,>(store: Store, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  put: (store: Store, value: unknown, key?: string) => run(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: Store, key: string) => run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: Store) => run(store, 'readwrite', (s) => s.clear()),
};

export async function wipeLocalData() {
  for (const s of ['folders', 'items', 'blobs', 'meta'] as const) await idb.clear(s);
}

// ---- Browser bookmarks (Netscape HTML export from Chrome/Firefox/Edge/Safari) ----

/** Turns an exported bookmarks file into folders and links, under a new "Favoris importés" folder. */
export async function parseBookmarks(file: File, parentId: string | null): Promise<{ folders: Folder[]; items: Item[] }> {
  const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
  const folders: Folder[] = [];
  const items: Item[] = [];
  const now = Date.now();

  const makeFolder = (name: string, parent: string | null) => {
    const f: Folder = { id: uid(), name, parentId: parent, icon: 'bookmark:yellow', createdAt: now + folders.length };
    folders.push(f);
    return f.id;
  };

  const walk = (dl: Element, folderId: string) => {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const a = dt.querySelector(':scope > a');
      const h3 = dt.querySelector(':scope > h3');
      if (a?.getAttribute('href')?.startsWith('http')) {
        items.push({ id: uid(), folderId, type: 'link', url: a.getAttribute('href')!, title: a.textContent?.trim() || a.getAttribute('href')!, createdAt: now });
      } else if (h3) {
        const sub = dt.querySelector(':scope > dl');
        if (sub) walk(sub, makeFolder(h3.textContent?.trim() || 'Dossier', folderId));
      }
    }
  };

  const root = doc.querySelector('dl');
  if (root) walk(root, makeFolder('Favoris importés', parentId));
  return { folders, items };
}
