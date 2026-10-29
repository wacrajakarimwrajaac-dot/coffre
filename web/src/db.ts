// Types shared with the app, the browser cache of opened files, and the bookmarks importer.
// The library itself lives on the phone (see phone.ts).

export type ItemType = 'link' | 'note' | 'file';

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
  createdAt: number;
}

export const uid = () => crypto.randomUUID();

export const INBOX = 'Boîte de réception';

// ---- Cache of files already opened in this browser (IndexedDB) ----

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('coffre-web-cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('blobs', mode).objectStore('blobs'));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const cacheGet = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const cachePut = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id));
export const cacheDelete = (id: string) => run('readwrite', (s) => s.delete(id));
export const cacheKeys = () => run<string[]>('readonly', (s) => s.getAllKeys());
export const cacheClear = () => run('readwrite', (s) => s.clear());

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
