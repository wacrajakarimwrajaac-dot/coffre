// The computer's own copy of the library: folders, items and file contents, stored in this browser / app (IndexedDB).
// It works without the phone being around; the phone and the computer only exchange changes when the person
// presses "Synchroniser" (see syncer.ts).
import { useSyncExternalStore } from 'react';
import { idb, INBOX, uid, wipeLocalData, type Folder, type Item } from './db';
import { isDeletedBy, pruneTombs, stampOf, type Manifest, type Tomb } from './link/sync';

export interface Usage {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
}

export interface LibraryState {
  loaded: boolean;
  folders: Folder[];
  items: Item[];
  /** Ids of file items whose content is stored on this computer. */
  files: ReadonlySet<string>;
  /** Last successful sync (ms). */
  lastSync?: number;
  phone?: string;
  phoneUsage?: Usage;
}

const now = () => Date.now();

class Library {
  state: LibraryState = { loaded: false, folders: [], items: [], files: new Set() };
  private deleted: Tomb[] = [];
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  private set(patch: Partial<LibraryState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Reads everything from the local storage (once). */
  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        await navigator.storage?.persist?.(); // asks the browser not to clear this copy when disk space runs low
      } catch {
        /* not supported */
      }
      const [folders, items, keys, deleted, lastSync, phone, phoneUsage] = await Promise.all([
        idb.all<Folder>('folders'), idb.all<Item>('items'), idb.keys('blobs'), idb.get<Tomb[]>('meta', 'deleted'),
        idb.get<number>('meta', 'lastSync'), idb.get<string>('meta', 'phone'), idb.get<Usage>('meta', 'phoneUsage'),
      ]);
      this.deleted = deleted ?? [];
      this.set({ loaded: true, folders, items, files: new Set(keys), lastSync, phone, phoneUsage });
    })();
    return this.loading;
  }

  private async saveDeleted() {
    this.deleted = pruneTombs(this.deleted);
    await idb.put('meta', this.deleted, 'deleted');
  }

  // ---- Changes made on this computer ----

  async saveFolder(f: Folder) {
    const rec = { ...f, updatedAt: now() };
    await idb.put('folders', rec);
    this.deleted = this.deleted.filter((x) => x.id !== f.id);
    await this.saveDeleted();
    this.set({ folders: [...this.state.folders.filter((x) => x.id !== f.id), rec] });
  }

  async saveItem(it: Item, keepStamp = false) {
    const rec = keepStamp && it.updatedAt !== undefined ? it : { ...it, updatedAt: now() };
    await idb.put('items', rec);
    this.deleted = this.deleted.filter((x) => x.id !== it.id);
    await this.saveDeleted();
    this.set({ items: [...this.state.items.filter((x) => x.id !== it.id), rec] });
  }

  async saveMany(folders: Folder[], items: Item[]) {
    const at = now();
    const fs = folders.map((f) => ({ ...f, updatedAt: at }));
    const its = items.map((i) => ({ ...i, updatedAt: at }));
    for (const f of fs) await idb.put('folders', f);
    for (const it of its) await idb.put('items', it);
    const ids = new Set([...fs, ...its].map((x) => x.id));
    this.deleted = this.deleted.filter((x) => !ids.has(x.id));
    await this.saveDeleted();
    this.set({ folders: [...this.state.folders.filter((x) => !ids.has(x.id)), ...fs], items: [...this.state.items.filter((x) => !ids.has(x.id)), ...its] });
  }

  async deleteItem(id: string) {
    const it = this.state.items.find((x) => x.id === id);
    if (!it) return;
    await idb.del('items', id);
    await idb.del('blobs', id);
    this.deleted = this.deleted.filter((x) => x.id !== id).concat({ id, kind: 'item', at: now() });
    await this.saveDeleted();
    const files = new Set(this.state.files);
    files.delete(id);
    this.set({ items: this.state.items.filter((x) => x.id !== id), files });
  }

  async deleteFolder(id: string) {
    const ids = new Set<string>();
    const walk = (fid: string) => {
      ids.add(fid);
      this.state.folders.filter((f) => f.parentId === fid).forEach((c) => walk(c.id));
    };
    walk(id);
    const at = now();
    const files = new Set(this.state.files);
    for (const it of this.state.items.filter((x) => ids.has(x.folderId))) {
      await idb.del('items', it.id);
      await idb.del('blobs', it.id);
      files.delete(it.id);
      this.deleted.push({ id: it.id, kind: 'item', at });
    }
    for (const fid of ids) {
      await idb.del('folders', fid);
      this.deleted.push({ id: fid, kind: 'folder', at });
    }
    await this.saveDeleted();
    this.set({ items: this.state.items.filter((x) => !ids.has(x.folderId)), folders: this.state.folders.filter((x) => !ids.has(x.id)), files });
  }

  /** Stores the content of a file item (picked on this computer, or received from the phone). */
  async putBlob(id: string, blob: Blob) {
    await idb.put('blobs', blob, id);
    this.set({ files: new Set(this.state.files).add(id) });
  }

  async addFile(file: File, item: Item) {
    await this.putBlob(item.id, file);
    await this.saveItem(item);
  }

  getBlob(id: string): Promise<Blob | undefined> {
    return idb.get<Blob>('blobs', id);
  }

  // ---- Sync ----

  manifest(): Manifest {
    return {
      folders: this.state.folders.map((f) => ({ id: f.id, u: stampOf(f) })),
      items: this.state.items.map((i) => ({ id: i.id, u: stampOf(i) })),
      tombs: this.deleted,
      files: [...this.state.files],
    };
  }

  /** The deletions this computer knows about, for the given ids. */
  tombsFor(ids: string[]): Tomb[] {
    const want = new Set(ids);
    return this.deleted.filter((t) => want.has(t.id));
  }

  /** Applies what the phone sent, then repairs anything left without a home. */
  async applyRemote(data: { folders: Folder[]; items: Item[]; tombs: Tomb[] }) {
    let folders = [...this.state.folders];
    let items = [...this.state.items];
    const files = new Set(this.state.files);
    const tomb = new Map(this.deleted.map((x) => [x.id, x]));

    for (const r of data.folders) {
      if (isDeletedBy(r, tomb.get(r.id))) continue;
      const rec = { ...r, updatedAt: stampOf(r) };
      await idb.put('folders', rec);
      folders = [...folders.filter((x) => x.id !== r.id), rec];
      this.deleted = this.deleted.filter((x) => x.id !== r.id);
    }
    for (const r of data.items) {
      if (isDeletedBy(r, tomb.get(r.id))) continue;
      const rec = { ...r, updatedAt: stampOf(r) };
      await idb.put('items', rec);
      items = [...items.filter((x) => x.id !== r.id), rec];
      this.deleted = this.deleted.filter((x) => x.id !== r.id);
    }
    for (const t of data.tombs) {
      const existing = (t.kind === 'folder' ? folders : items).find((x) => x.id === t.id);
      if (existing && stampOf(existing) > t.at) continue; // changed after the deletion: it stays
      if (existing) {
        if (t.kind === 'folder') {
          await idb.del('folders', t.id);
          folders = folders.filter((x) => x.id !== t.id);
        } else {
          await idb.del('items', t.id);
          await idb.del('blobs', t.id);
          items = items.filter((x) => x.id !== t.id);
          files.delete(t.id);
        }
      }
      this.deleted = this.deleted.filter((x) => x.id !== t.id).concat(t);
    }

    const folderIds = new Set(folders.map((f) => f.id));
    for (const f of folders) {
      if (f.parentId && !folderIds.has(f.parentId)) {
        const fixed = { ...f, parentId: null, updatedAt: now() };
        await idb.put('folders', fixed);
        folders = folders.map((x) => (x.id === f.id ? fixed : x));
      }
    }
    const orphans = items.filter((it) => !folderIds.has(it.folderId));
    if (orphans.length) {
      let home = folders.find((f) => !f.parentId && f.name === INBOX);
      if (!home) {
        home = { id: uid(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: now(), updatedAt: now() };
        await idb.put('folders', home);
        folders = [...folders, home];
      }
      for (const it of orphans) {
        const fixed = { ...it, folderId: home.id, updatedAt: now() };
        await idb.put('items', fixed);
        items = items.map((x) => (x.id === it.id ? fixed : x));
      }
    }
    await this.saveDeleted();
    this.set({ folders, items, files });
  }

  /** Records the phone's name and storage, and the sync time when everything went through. */
  async finishSync(info: { phone?: string; usage?: Usage; complete: boolean }) {
    if (info.phone) await idb.put('meta', info.phone, 'phone');
    if (info.usage) await idb.put('meta', info.usage, 'phoneUsage');
    const patch: Partial<LibraryState> = { phone: info.phone ?? this.state.phone, phoneUsage: info.usage ?? this.state.phoneUsage };
    if (info.complete) {
      const at = now();
      await idb.put('meta', at, 'lastSync');
      patch.lastSync = at;
    }
    this.set(patch);
  }

  /** Removes the whole local copy (sign-out, unlinking the phone). */
  async wipe() {
    await wipeLocalData();
    this.deleted = [];
    this.set({ folders: [], items: [], files: new Set(), lastSync: undefined, phone: undefined, phoneUsage: undefined });
  }
}

export const library = new Library();

export function useLibrary(): LibraryState {
  return useSyncExternalStore(library.subscribe, () => library.state);
}
