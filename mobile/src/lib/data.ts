// Same Supabase schema as the website (supabase/schema.sql): folders, items, private "files" bucket.
import { File as FsFile } from 'expo-file-system';
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

export interface Usage {
  plan: string;
  usedBytes: number;
  quotaBytes: number;
  maxFileBytes: number;
}

type Row = Record<string, unknown>;
const num = (x: unknown) => (x === null || x === undefined ? undefined : Number(x));
const str = (x: unknown) => (x === null || x === undefined ? undefined : String(x));

const folderFromRow = (r: Row): Folder => ({
  id: String(r.id), name: String(r.name), parentId: (r.parent_id as string | null) ?? null,
  icon: String(r.icon ?? 'folder:violet'), createdAt: Number(r.created_at),
});

const itemFromRow = (r: Row): Item => ({
  id: String(r.id), folderId: String(r.folder_id), type: r.type as ItemType, title: String(r.title ?? ''),
  text: str(r.text), url: str(r.url), fileName: str(r.file_name), mime: str(r.mime), size: num(r.size),
  dueAt: num(r.due_at), done: (r.done as boolean | null) ?? undefined, remindedAt: num(r.reminded_at),
  createdAt: Number(r.created_at),
});

const itemToRow = (i: Item): Row => ({
  id: i.id, folder_id: i.folderId, type: i.type, title: i.title, text: i.text ?? null, url: i.url ?? null,
  file_name: i.fileName ?? null, mime: i.mime ?? null, size: i.size ?? null, due_at: i.dueAt ?? null,
  done: i.done ?? null, reminded_at: i.remindedAt ?? null, created_at: i.createdAt,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Non connecté');
  return data.session.user.id;
}

const path = async (itemId: string) => `${await userId()}/${itemId}`;

const INBOX = 'Boîte de réception';

export async function loadAll(): Promise<{ folders: Folder[]; items: Item[] }> {
  const [f, i] = await Promise.all([supabase.from('folders').select('*'), supabase.from('items').select('*')]);
  let folders = (check(f) as Row[]).map(folderFromRow).sort((a, b) => a.createdAt - b.createdAt);
  let items = (check(i) as Row[]).map(itemFromRow).sort((a, b) => b.createdAt - a.createdAt);
  if (folders.length === 0) {
    // The inbox id is the user id: concurrent first loads (app, website, other devices) upsert the same row.
    const inbox: Folder = { id: await userId(), name: INBOX, parentId: null, icon: 'inbox:violet', createdAt: Date.now() };
    await saveFolder(inbox);
    folders = [inbox];
  } else if (folders.filter((x) => !x.parentId && x.name === INBOX).length > 1) {
    ({ folders, items } = await mergeDuplicateInboxes(folders, items));
  }
  return { folders, items };
}

/** Repairs duplicate inboxes created by older versions: keeps the oldest, moves contents into it. */
async function mergeDuplicateInboxes(folders: Folder[], items: Item[]) {
  const inboxes = folders.filter((x) => !x.parentId && x.name === INBOX); // sorted oldest first
  const keep = inboxes[0];
  for (const extra of inboxes.slice(1)) {
    check(await supabase.from('items').update({ folder_id: keep.id }).eq('folder_id', extra.id));
    check(await supabase.from('folders').update({ parent_id: keep.id }).eq('parent_id', extra.id));
    check(await supabase.from('folders').delete().eq('id', extra.id));
  }
  const removed = new Set(inboxes.slice(1).map((x) => x.id));
  return {
    folders: folders
      .filter((x) => !removed.has(x.id))
      .map((x) => (x.parentId && removed.has(x.parentId) ? { ...x, parentId: keep.id } : x)),
    items: items.map((x) => (removed.has(x.folderId) ? { ...x, folderId: keep.id } : x)),
  };
}

export async function saveFolder(f: Folder) {
  check(await supabase.from('folders').upsert({
    id: f.id, name: f.name, parent_id: f.parentId, icon: f.icon, created_at: f.createdAt,
  }));
}

export async function deleteFolder(id: string, allFolders: Folder[], allItems: Item[]) {
  const ids: string[] = [];
  const walk = (fid: string) => {
    ids.push(fid);
    allFolders.filter((f) => f.parentId === fid).forEach((c) => walk(c.id));
  };
  walk(id);
  const files = allItems.filter((i) => ids.includes(i.folderId) && i.type === 'file');
  if (files.length) {
    const uidStr = await userId();
    await supabase.storage.from('files').remove(files.map((i) => `${uidStr}/${i.id}`));
  }
  check(await supabase.from('folders').delete().eq('id', id)); // children and items cascade
}

export async function saveItem(i: Item) {
  check(await supabase.from('items').upsert(itemToRow(i)));
}

export async function deleteItem(i: Item) {
  if (i.type === 'file') await supabase.storage.from('files').remove([await path(i.id)]);
  check(await supabase.from('items').delete().eq('id', i.id));
}

/** Uploads the bytes of a file whose row already exists (the server checks the quota on the row). */
export async function uploadBody(itemId: string, uri: string, mime: string) {
  const body = await new FsFile(uri).arrayBuffer();
  check(await supabase.storage.from('files').upload(await path(itemId), body, { contentType: mime, upsert: true }));
}

/** Creates the file row first (the server checks the quota), then uploads; rolls back on failure. */
export async function addFile(
  folderId: string,
  file: { uri: string; name: string; mime: string; size?: number; title?: string },
  newId: string,
): Promise<Item> {
  const size = file.size ?? new FsFile(file.uri).size ?? 0;
  const item: Item = {
    id: newId, folderId, type: 'file', title: file.title ?? file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name, mime: file.mime, size, createdAt: Date.now(),
  };
  await saveItem(item);
  try {
    await uploadBody(item.id, file.uri, file.mime);
  } catch (e) {
    await supabase.from('items').delete().eq('id', item.id);
    throw e;
  }
  return item;
}

const urlCache = new Map<string, { url: string; expires: number }>();

/** Short-lived private URL to display/play a stored file. */
export async function fileUrl(itemId: string): Promise<string | null> {
  const hit = urlCache.get(itemId);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from('files').createSignedUrl(await path(itemId), 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(itemId, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function getUsage(): Promise<Usage | null> {
  const { data, error } = await supabase.rpc('storage_usage');
  const r = (data as Row[] | null)?.[0];
  if (error || !r) return null;
  return { plan: String(r.plan), usedBytes: Number(r.used_bytes), quotaBytes: Number(r.quota_bytes), maxFileBytes: Number(r.max_file_bytes) };
}

/** Calls onChange whenever this user's data changes (other device or website). */
export function subscribe(onChange: () => void): () => void {
  const channel = supabase
    .channel('coffre-mobile')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
