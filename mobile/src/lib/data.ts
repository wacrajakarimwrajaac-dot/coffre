// Local-first storage, like WhatsApp: everything lives on the phone, in the app's private folder
//   <documents>/coffre/<userId>/library.json   folders + items
//   <documents>/coffre/<userId>/files/<itemId>.<ext>   photos, videos, voice notes, documents
// Google Drive is the backup. The server only knows the account (sign-in); it stores no content.
import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { isDeletedBy, pruneTombs, stampOf, type Manifest, type Tomb } from './link/sync';
import { uid } from './util';

export type ItemType = 'link' | 'note' | 'file';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  createdAt: number;
  /** Time of the last change (ms). Missing on old data: createdAt is used then. */
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

export interface Usage {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
}

interface Library {
  version: 1;
  folders: Folder[];
  items: Item[];
  /** Deletions, kept so they can reach the other devices at their next sync. */
  deleted: Tomb[];
  /** Set once the data of the old cloud version has been copied here. */
  migratedAt?: number;
}

export const INBOX = 'Boîte de réception';

// ---- Where things live ----

let currentUser: string | null = null;
let lib: Library | null = null;

/** Must be called (once per signed-in user) before any other function. */
export function openLibrary(userId: string) {
  if (currentUser !== userId) {
    currentUser = userId;
    lib = null;
  }
}

function userDir(): Directory {
  if (!currentUser) throw new Error('Bibliothèque non ouverte');
  return new Directory(Paths.document, 'coffre', currentUser);
}
const filesDir = () => new Directory(userDir(), 'files');
const libraryFile = () => new FsFile(userDir(), 'library.json');

export function libraryExists(): boolean {
  return libraryFile().exists;
}

function ensureDirs() {
  const d = filesDir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/webm': '.webm',
  'audio/ogg': '.ogg', 'application/pdf': '.pdf',
};

/** Extension kept on disk so players (video, audio, PDF viewers) recognise the format. */
function extOf(i: Pick<Item, 'fileName' | 'mime'>): string {
  const fromName = i.fileName?.match(/\.[a-z0-9]{1,6}$/i)?.[0];
  return (fromName ?? EXT_BY_MIME[i.mime ?? ''] ?? '').toLowerCase();
}

/** The local file holding an item's content. */
export function itemFile(i: Pick<Item, 'id' | 'fileName' | 'mime'>): FsFile {
  return new FsFile(filesDir(), `${i.id}${extOf(i)}`);
}

// ---- Change notifications (screens reload when the library changes) ----

const listeners = new Set<() => void>();
export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}
const notify = () => listeners.forEach((l) => l());

// ---- Load / persist ----

async function read(): Promise<Library> {
  if (lib) return lib;
  ensureDirs();
  const f = libraryFile();
  if (f.exists) {
    const parsed = JSON.parse(await f.text()) as Library;
    lib = {
      version: 1, folders: parsed.folders ?? [], migratedAt: parsed.migratedAt, deleted: parsed.deleted ?? [],
      items: (parsed.items ?? []).filter((i) => i.type === 'link' || i.type === 'note' || i.type === 'file'),
    };
  } else {
    lib = { version: 1, folders: [], items: [], deleted: [] };
  }
  if (!lib.folders.length) lib.folders.push({ id: uid(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: Date.now() });
  return lib;
}

let writing: Promise<void> = Promise.resolve();

/** Writes the library atomically (temp file, then rename), one write at a time. */
function persist(): Promise<void> {
  const snapshot = JSON.stringify(lib);
  writing = writing.then(async () => {
    ensureDirs();
    const tmp = new FsFile(userDir(), 'library.tmp.json');
    if (tmp.exists) tmp.delete();
    await tmp.write(snapshot);
    const target = libraryFile();
    if (target.exists) target.delete();
    tmp.moveSync(target);
  });
  return writing;
}

async function commit() {
  if (lib) lib.deleted = pruneTombs(lib.deleted);
  await persist();
  notify();
}

/** Replaces the whole library (used by the cloud migration and restores). */
export async function writeLibrary(data: { folders: Folder[]; items: Item[]; migratedAt?: number }) {
  lib = { version: 1, folders: data.folders, items: data.items, deleted: lib?.deleted ?? [], migratedAt: data.migratedAt ?? lib?.migratedAt };
  if (!lib.folders.length) lib.folders.push({ id: uid(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: Date.now() });
  await commit();
}

export async function loadAll(): Promise<{ folders: Folder[]; items: Item[] }> {
  const l = await read();
  if (!libraryFile().exists) await persist();
  return {
    folders: [...l.folders].sort((a, b) => a.createdAt - b.createdAt),
    items: [...l.items].sort((a, b) => b.createdAt - a.createdAt),
  };
}

// ---- Folders ----

const now = () => Date.now();

/** Marks a record as changed now; a change made by the sync keeps the stamp it arrived with. */
function touch<T extends { updatedAt?: number }>(r: T, keepStamp?: boolean): T {
  return keepStamp && r.updatedAt !== undefined ? r : { ...r, updatedAt: now() };
}

function forget(l: Library, id: string) {
  l.deleted = l.deleted.filter((x) => x.id !== id);
}

export async function saveFolder(f: Folder, opts: { keepStamp?: boolean } = {}) {
  const l = await read();
  const rec = touch(f, opts.keepStamp);
  const i = l.folders.findIndex((x) => x.id === f.id);
  if (i >= 0) l.folders[i] = rec;
  else l.folders.push(rec);
  forget(l, f.id);
  await commit();
}

export async function deleteFolder(id: string) {
  const l = await read();
  const ids = new Set<string>();
  const walk = (fid: string) => {
    ids.add(fid);
    l.folders.filter((f) => f.parentId === fid).forEach((c) => walk(c.id));
  };
  walk(id);
  const at = now();
  for (const it of l.items) {
    if (!ids.has(it.folderId)) continue;
    if (it.type === 'file') removeFile(it);
    l.deleted.push({ id: it.id, kind: 'item', at });
  }
  for (const fid of ids) l.deleted.push({ id: fid, kind: 'folder', at });
  l.items = l.items.filter((it) => !ids.has(it.folderId));
  l.folders = l.folders.filter((f) => !ids.has(f.id));
  if (!l.folders.length) l.folders.push({ id: uid(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: now(), updatedAt: now() });
  await commit();
}

// ---- Items ----

export async function saveItem(it: Item, opts: { keepStamp?: boolean } = {}) {
  const l = await read();
  const rec = touch(it, opts.keepStamp);
  const i = l.items.findIndex((x) => x.id === it.id);
  if (i >= 0) l.items[i] = rec;
  else l.items.push(rec);
  forget(l, it.id);
  await commit();
}

/** Adds or replaces many folders and items in one write. */
export async function saveMany(folders: Folder[], items: Item[]) {
  const l = await read();
  for (const f of folders) {
    const rec = touch(f);
    const i = l.folders.findIndex((x) => x.id === f.id);
    if (i >= 0) l.folders[i] = rec;
    else l.folders.push(rec);
    forget(l, f.id);
  }
  for (const it of items) {
    const rec = touch(it);
    const i = l.items.findIndex((x) => x.id === it.id);
    if (i >= 0) l.items[i] = rec;
    else l.items.push(rec);
    forget(l, it.id);
  }
  await commit();
}

export async function getItem(id: string): Promise<Item | undefined> {
  return (await read()).items.find((x) => x.id === id);
}

function removeFile(it: Item) {
  try {
    const f = itemFile(it);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
}

export async function deleteItem(it: Item) {
  const l = await read();
  if (it.type === 'file') removeFile(it);
  l.items = l.items.filter((x) => x.id !== it.id);
  forget(l, it.id);
  l.deleted.push({ id: it.id, kind: 'item', at: now() });
  await commit();
}

/** Copies a picked / shared / recorded / downloaded file into the library (content:// URIs included). */
export async function importFile(target: FsFile, uri: string) {
  ensureDirs();
  if (target.exists) target.delete();
  const source = new FsFile(uri);
  try {
    await source.copy(target);
  } catch {
    // Some providers (e.g. Android share sheets) only allow streaming the content.
    await target.write(new Uint8Array(await source.arrayBuffer()));
  }
}

export async function addFile(
  folderId: string,
  file: { uri: string; name: string; mime: string; size?: number; title?: string },
  newId: string,
): Promise<Item> {
  const item: Item = {
    id: newId, folderId, type: 'file', title: file.title ?? file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name, mime: file.mime, size: file.size, createdAt: Date.now(),
  };
  const target = itemFile(item);
  await importFile(target, file.uri);
  item.size = target.size ?? file.size ?? 0;
  await saveItem(item);
  return item;
}

/** Local URI to display / play a stored file (null if the file is missing). */
export async function fileUrl(itemId: string): Promise<string | null> {
  const l = await read();
  const it = l.items.find((x) => x.id === itemId);
  if (!it || it.type !== 'file') return null;
  const f = itemFile(it);
  return f.exists ? f.uri : null;
}

export async function getUsage(): Promise<Usage> {
  const l = await read();
  let used = 0;
  for (const it of l.items) if (it.type === 'file') used += it.size ?? 0;
  let free = 0;
  let total = 0;
  try {
    free = Paths.availableDiskSpace;
    total = Paths.totalDiskSpace;
  } catch {
    /* not available on this platform */
  }
  return { usedBytes: used, freeBytes: free, totalBytes: total };
}

/** Deletes everything stored on this phone for the current account. */
export function wipeLocal() {
  const d = userDir();
  if (d.exists) d.delete();
  lib = null;
  currentUser = null; // closed: nothing can recreate the library before sign-out
}

export async function migratedAt(): Promise<number | undefined> {
  return (await read()).migratedAt;
}

// ---- Sync with a computer (see link/sync.ts) ----

export async function syncManifest(): Promise<Manifest> {
  const l = await read();
  return {
    folders: l.folders.map((f) => ({ id: f.id, u: stampOf(f) })),
    items: l.items.map((i) => ({ id: i.id, u: stampOf(i) })),
    tombs: l.deleted,
    files: l.items.filter((i) => i.type === 'file' && itemFile(i).exists).map((i) => i.id),
  };
}

export async function recordsById(folderIds: string[], itemIds: string[]): Promise<{ folders: Folder[]; items: Item[] }> {
  const l = await read();
  const f = new Set(folderIds);
  const i = new Set(itemIds);
  return { folders: l.folders.filter((x) => f.has(x.id)), items: l.items.filter((x) => i.has(x.id)) };
}

/** Applies what the other side sent, then repairs anything left without a home (a folder deleted on one side while an item was added on the other). */
export async function applyRemote(data: { folders: Folder[]; items: Item[]; tombs: Tomb[] }) {
  const l = await read();
  const tomb = new Map(l.deleted.map((x) => [x.id, x]));
  const upsert = <T extends Folder | Item>(list: T[], r: T) => {
    if (isDeletedBy(r, tomb.get(r.id))) return;
    const rec = { ...r, updatedAt: stampOf(r) };
    const i = list.findIndex((x) => x.id === r.id);
    if (i >= 0) list[i] = rec;
    else list.push(rec);
    forget(l, r.id);
  };
  for (const f of data.folders) upsert(l.folders, f);
  for (const it of data.items) upsert(l.items, it);
  for (const t of data.tombs) {
    const list = t.kind === 'folder' ? l.folders : l.items;
    const i = list.findIndex((x) => x.id === t.id);
    if (i >= 0 && stampOf(list[i]) > t.at) continue; // changed after the deletion: it stays
    if (i >= 0) {
      const gone = list.splice(i, 1)[0] as Folder | Item;
      if (t.kind === 'item' && (gone as Item).type === 'file') removeFile(gone as Item);
    }
    forget(l, t.id);
    l.deleted.push(t);
  }

  const folderIds = new Set(l.folders.map((f) => f.id));
  for (const f of l.folders) if (f.parentId && !folderIds.has(f.parentId)) Object.assign(f, { parentId: null, updatedAt: now() });
  const orphans = l.items.filter((it) => !folderIds.has(it.folderId));
  if (orphans.length) {
    let home = l.folders.find((f) => !f.parentId && f.name === INBOX);
    if (!home) {
      home = { id: uid(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: now(), updatedAt: now() };
      l.folders.push(home);
    }
    for (const it of orphans) Object.assign(it, { folderId: home.id, updatedAt: now() });
  }
  await commit();
}

/** Stores a file received from the computer next to its (already saved) item. */
export function itemHasFile(it: Item): boolean {
  return it.type === 'file' && itemFile(it).exists;
}
