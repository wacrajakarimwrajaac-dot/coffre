import type { Folder, Item } from './data';

export type Kind = 'photo' | 'video' | 'audio' | 'doc' | 'link' | 'note';

export function kindOf(i: Item): Kind {
  if (i.type !== 'file') return i.type;
  if (i.mime?.startsWith('image/')) return 'photo';
  if (i.mime?.startsWith('video/')) return 'video';
  if (i.mime?.startsWith('audio/')) return 'audio';
  return 'doc';
}

export const isMedia = (i: Item) => {
  const k = kindOf(i);
  return k === 'photo' || k === 'video';
};

export interface FolderUsage { folder: Folder; bytes: number; files: number }

/** Storage used per top-level folder (subfolders included), biggest first. Sizes are the files' declared sizes. */
export function folderUsage(folders: Folder[], items: Item[]): FolderUsage[] {
  const root = new Map<string, string>(); // folderId -> top-level folder id
  const byId = new Map(folders.map((f) => [f.id, f]));
  const topOf = (id: string): string => {
    if (root.has(id)) return root.get(id)!;
    const f = byId.get(id);
    const top = !f || !f.parentId || !byId.has(f.parentId) ? id : topOf(f.parentId);
    root.set(id, top);
    return top;
  };
  const acc = new Map<string, FolderUsage>();
  for (const f of folders) if (!f.parentId || !byId.has(f.parentId)) acc.set(f.id, { folder: f, bytes: 0, files: 0 });
  for (const i of items) {
    if (i.type !== 'file') continue;
    const u = acc.get(topOf(i.folderId));
    if (u) {
      u.bytes += i.size ?? 0;
      u.files++;
    }
  }
  return [...acc.values()].sort((a, b) => b.bytes - a.bytes || a.folder.name.localeCompare(b.folder.name));
}

export interface TypeUsage { kind: Kind; label: string; bytes: number; files: number }

export function typeUsage(items: Item[]): TypeUsage[] {
  const defs: [Kind, string][] = [['photo', 'Photos'], ['video', 'Vidéos'], ['audio', 'Vocaux'], ['doc', 'Documents']];
  return defs.map(([kind, label]) => {
    const list = items.filter((i) => kindOf(i) === kind);
    return { kind, label, bytes: list.reduce((n, i) => n + (i.size ?? 0), 0), files: list.length };
  });
}
