// One-time copy of the data stored by the old cloud version (Supabase tables + "files" bucket) onto
// the phone. Runs on first launch of the local version; tasks are not carried over (removed feature).
// Nothing is deleted from the cloud here.
import { File as FsFile } from 'expo-file-system';
import { INBOX, itemFile, writeLibrary, type Folder, type Item } from './data';
import { supabase } from './supabase';

type Row = Record<string, unknown>;
const num = (x: unknown) => (x === null || x === undefined ? undefined : Number(x));
const str = (x: unknown) => (x === null || x === undefined ? undefined : String(x));

export type MigrationProgress = (done: number, total: number, label: string) => void;

export async function migrateFromCloud(userId: string, progress: MigrationProgress = () => {}): Promise<{ items: number; files: number; failed: number }> {
  progress(0, 1, 'Lecture de tes données…');
  const [f, i] = await Promise.all([supabase.from('folders').select('*'), supabase.from('items').select('*')]);
  if (f.error) throw new Error(f.error.message);
  if (i.error) throw new Error(i.error.message);

  const folders: Folder[] = (f.data as Row[]).map((r) => ({
    id: String(r.id), name: String(r.name), parentId: (r.parent_id as string | null) ?? null,
    icon: String(r.icon ?? 'folder:violet'), createdAt: Number(r.created_at),
  }));
  const items: Item[] = (i.data as Row[])
    .filter((r) => r.type === 'link' || r.type === 'note' || r.type === 'file')
    .map((r) => ({
      id: String(r.id), folderId: String(r.folder_id), type: r.type as Item['type'], title: String(r.title ?? ''),
      text: str(r.text), url: str(r.url), fileName: str(r.file_name), mime: str(r.mime), size: num(r.size),
      createdAt: Number(r.created_at),
    }));

  // Keep a single inbox (older versions could create duplicates).
  const inboxes = folders.filter((x) => !x.parentId && x.name === INBOX).sort((a, b) => a.createdAt - b.createdAt);
  for (const extra of inboxes.slice(1)) {
    for (const it of items) if (it.folderId === extra.id) it.folderId = inboxes[0].id;
    for (const fo of folders) if (fo.parentId === extra.id) fo.parentId = inboxes[0].id;
  }
  const kept = folders.filter((x) => !inboxes.slice(1).includes(x));

  const files = items.filter((it) => it.type === 'file');
  let failed = 0;
  for (const [n, it] of files.entries()) {
    progress(n, files.length, it.title);
    const target = itemFile(it);
    if (target.exists && (target.size ?? 0) > 0) continue; // already copied by an interrupted run
    const { data } = await supabase.storage.from('files').createSignedUrl(`${userId}/${it.id}`, 3600);
    if (!data?.signedUrl) {
      failed++;
      continue;
    }
    try {
      await FsFile.downloadFileAsync(data.signedUrl, target, { idempotent: true });
      it.size = target.size ?? it.size;
    } catch {
      failed++;
    }
  }

  await writeLibrary({ folders: kept, items, migratedAt: Date.now() });
  progress(files.length, files.length, 'Terminé');
  return { items: items.length, files: files.length - failed, failed };
}
