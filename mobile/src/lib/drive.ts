// Google Drive backup, same layout and manifest as the website (a visible "Coffre" folder, real files,
// coffre-sauvegarde.json), so a backup made on one device can be restored on the other.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as FsFile, Paths, UploadType } from 'expo-file-system';
import { deleteFolder, fileUrl, loadAll, saveFolder, saveItem, uploadBody, type Folder, type Item } from './data';
import { accessToken, hasDriveAccount } from './driveAuth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MANIFEST = 'coffre-sauvegarde.json';

// ---- Settings (per device) ----

export type Frequency = 'off' | 'daily' | 'weekly';
export interface DriveSettings {
  frequency: Frequency;
  email?: string;
  lastBackupAt?: number;
  lastError?: string;
  /** Allow backups over mobile data (default: Wi-Fi only, like WhatsApp). */
  cellular?: boolean;
}
const SETTINGS_KEY = 'coffre.drive.settings';

export async function loadSettings(): Promise<DriveSettings> {
  try {
    return { frequency: 'off', ...JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '{}') };
  } catch {
    return { frequency: 'off' };
  }
}

export async function saveSettings(patch: Partial<DriveSettings>): Promise<DriveSettings> {
  const next = { ...(await loadSettings()), ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function backupDue(s: DriveSettings, now = Date.now()): boolean {
  if (s.frequency === 'off' || !s.email) return false;
  const every = s.frequency === 'daily' ? 864e5 : 7 * 864e5;
  return !s.lastBackupAt || now - s.lastBackupAt >= every;
}

async function networkAllowed(s: DriveSettings): Promise<boolean> {
  try {
    const Network = require('expo-network') as typeof import('expo-network');
    const n = await Network.getNetworkStateAsync();
    if (!n.isConnected || n.isInternetReachable === false) return false;
    return s.cellular ? true : n.type === Network.NetworkStateType.WIFI || n.type === Network.NetworkStateType.ETHERNET;
  } catch {
    return true;
  }
}

// ---- Drive helpers ----

async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers } });
  if (!res.ok) throw new Error(`Google Drive : erreur ${res.status}`);
  return res;
}
const json = async <T>(url: string, init?: RequestInit) => (await gfetch(url, init)).json() as Promise<T>;

export async function accountEmail(): Promise<string> {
  const r = await json<{ user: { emailAddress: string } }>(`${API}/about?fields=user(emailAddress)`);
  return r.user.emailAddress;
}

async function findOne(query: string): Promise<string | null> {
  const r = await json<{ files: { id: string }[] }>(
    `${API}/files?q=${encodeURIComponent(`${query} and trashed=false`)}&fields=files(id)&pageSize=1`,
  );
  return r.files[0]?.id ?? null;
}

async function createFolder(name: string, parent: string): Promise<string> {
  const r = await json<{ id: string }>(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  });
  return r.id;
}

async function patch(id: string, meta: object, from?: string, to?: string) {
  const move = from && to && from !== to ? `&addParents=${to}&removeParents=${from}` : '';
  await gfetch(`${API}/files/${id}?fields=id${move}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

/** Opens a resumable upload session and returns its URL. */
async function startUpload(meta: { name: string; parents?: string[] }, mime: string, size: number, existingId?: string) {
  const res = await gfetch(
    existingId ? `${UPLOAD}/files/${existingId}?uploadType=resumable` : `${UPLOAD}/files?uploadType=resumable&fields=id`,
    {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify(existingId ? {} : meta),
    },
  );
  const location = res.headers.get('Location');
  if (!location) throw new Error('Google Drive : envoi impossible');
  return location;
}

/** Streams a local file to Drive from disk (no memory spike for large videos). */
async function uploadFile(file: FsFile, meta: { name: string; parents: string[] }, mime: string): Promise<string> {
  const location = await startUpload(meta, mime, file.size ?? 0);
  const res = await file.upload(location, {
    httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: { 'Content-Type': mime }, mimeType: mime,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Google Drive : envoi interrompu (${res.status})`);
  return (JSON.parse(res.body) as { id: string }).id;
}

async function uploadManifest(body: string, parent: string, existingId: string | null) {
  const bytes = new TextEncoder().encode(body).length;
  const location = await startUpload({ name: MANIFEST, parents: [parent] }, 'application/json', bytes, existingId ?? undefined);
  const res = await fetch(location, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
  if (!res.ok) throw new Error(`Google Drive : sauvegarde interrompue (${res.status})`);
}

// ---- Backup / restore ----

interface Manifest {
  app: 'coffre';
  version: 2;
  createdAt: number;
  folders: Folder[];
  items: Item[];
  driveFolders: Record<string, { id: string; name: string; parent: string }>;
  driveFiles: Record<string, { id: string; parent: string }>;
}

export type Progress = (text: string) => void;

async function rootFolder(create: boolean): Promise<string | null> {
  const found = await findOne(`name='Coffre' and mimeType='${FOLDER_MIME}' and 'root' in parents`);
  return found ?? (create ? createFolder('Coffre', 'root') : null);
}

async function readManifest(root: string): Promise<{ id: string | null; data: Manifest | null }> {
  const id = await findOne(`name='${MANIFEST}' and '${root}' in parents`);
  if (!id) return { id: null, data: null };
  return { id, data: await json<Manifest>(`${API}/files/${id}?alt=media`) };
}

let running = false;

export async function backupToDrive(progress: Progress = () => {}): Promise<{ uploaded: number }> {
  if (running) throw new Error('Une sauvegarde est déjà en cours');
  running = true;
  try {
    progress('Connexion à Google Drive…');
    const root = (await rootFolder(true))!;
    const { id: manifestId, data: prev } = await readManifest(root);
    const { folders, items } = await loadAll();
    const driveFolders = { ...prev?.driveFolders };
    const driveFiles = { ...prev?.driveFiles };

    const byId = new Map(folders.map((f) => [f.id, f]));
    const ensureFolder = async (f: Folder): Promise<string> => {
      const parent = f.parentId && byId.has(f.parentId) ? await ensureFolder(byId.get(f.parentId)!) : root;
      const known = driveFolders[f.id];
      if (!known) {
        driveFolders[f.id] = { id: await createFolder(f.name, parent), name: f.name, parent };
      } else if (known.name !== f.name || known.parent !== parent) {
        await patch(known.id, { name: f.name }, known.parent, parent);
        driveFolders[f.id] = { ...known, name: f.name, parent };
      }
      return driveFolders[f.id].id;
    };
    for (const f of folders) await ensureFolder(f);

    const files = items.filter((i) => i.type === 'file');
    let uploaded = 0;
    for (const [n, it] of files.entries()) {
      const parent = driveFolders[it.folderId]?.id ?? root;
      const known = driveFiles[it.id];
      if (known) {
        if (known.parent !== parent) {
          await patch(known.id, {}, known.parent, parent);
          driveFiles[it.id] = { ...known, parent };
        }
        continue;
      }
      progress(`Envoi ${n + 1}/${files.length} : ${it.title}`);
      const url = await fileUrl(it.id);
      if (!url) continue;
      const tmp = new FsFile(Paths.cache, `backup-${it.id}`);
      try {
        const local = await FsFile.downloadFileAsync(url, tmp, { idempotent: true });
        const id = await uploadFile(local, { name: it.fileName ?? it.title, parents: [parent] }, it.mime ?? 'application/octet-stream');
        driveFiles[it.id] = { id, parent };
        uploaded++;
      } finally {
        if (tmp.exists) tmp.delete();
      }
    }

    // Drive copies of deleted items/folders go to Drive's bin (recoverable for 30 days).
    const live = new Set(items.map((i) => i.id));
    for (const [itemId, f] of Object.entries(driveFiles)) {
      if (!live.has(itemId)) {
        await patch(f.id, { trashed: true }).catch(() => {});
        delete driveFiles[itemId];
      }
    }
    for (const [folderId, f] of Object.entries(driveFolders)) {
      if (!byId.has(folderId)) {
        await patch(f.id, { trashed: true }).catch(() => {});
        delete driveFolders[folderId];
      }
    }

    progress('Enregistrement de la sauvegarde…');
    const manifest: Manifest = { app: 'coffre', version: 2, createdAt: Date.now(), folders, items, driveFolders, driveFiles };
    await uploadManifest(JSON.stringify(manifest, null, 1), root, manifestId);
    return { uploaded };
  } finally {
    running = false;
  }
}

export async function latestBackupDate(): Promise<number | null> {
  const root = await rootFolder(false);
  if (!root) return null;
  return (await readManifest(root)).data?.createdAt ?? null;
}

export async function restoreFromDrive(progress: Progress = () => {}): Promise<{ items: number }> {
  if (running) throw new Error('Une sauvegarde est en cours');
  running = true;
  try {
    progress('Recherche de la sauvegarde…');
    const root = await rootFolder(false);
    const data = root ? (await readManifest(root)).data : null;
    if (!data) throw new Error('Aucune sauvegarde Coffre trouvée dans ce Google Drive');

    // A fresh account auto-creates an empty inbox: drop it when the backup brings its own.
    const local = await loadAll();
    const backupIds = new Set(data.folders.map((f) => f.id));
    for (const f of local.folders) {
      if (!backupIds.has(f.id) && !f.parentId && f.name === 'Boîte de réception'
        && !local.items.some((i) => i.folderId === f.id)
        && data.folders.some((b) => !b.parentId && b.name === f.name)) {
        await deleteFolder(f.id, local.folders, local.items);
      }
    }

    // Parents before children.
    const done = new Set<string>();
    const pending = [...data.folders];
    while (pending.length) {
      const i = pending.findIndex((f) => !f.parentId || done.has(f.parentId) || !pending.some((p) => p.id === f.parentId));
      const [f] = pending.splice(i === -1 ? 0 : i, 1);
      await saveFolder(f);
      done.add(f.id);
    }

    const files = data.items.filter((i) => i.type === 'file');
    let n = 0;
    const errors: string[] = [];
    for (const it of data.items) {
      if (it.type !== 'file') {
        await saveItem(it);
        continue;
      }
      const drive = data.driveFiles[it.id];
      if (!drive) continue;
      progress(`Téléchargement ${++n}/${files.length} : ${it.title}`);
      const tmp = new FsFile(Paths.cache, `restore-${it.id}`);
      try {
        const local = await FsFile.downloadFileAsync(`${API}/files/${drive.id}?alt=media`, tmp, {
          idempotent: true, headers: { Authorization: `Bearer ${await accessToken()}` },
        });
        await saveItem(it); // row first: the server checks the quota, then accepts the upload
        await uploadBody(it.id, local.uri, it.mime ?? 'application/octet-stream');
      } catch (e) {
        errors.push(`${it.title} : ${(e as Error).message}`);
      } finally {
        if (tmp.exists) tmp.delete();
      }
    }
    if (errors.length) throw new Error(`Restauré, sauf : ${errors.join(' ; ')}`);
    return { items: data.items.length };
  } finally {
    running = false;
  }
}

/** Runs the scheduled backup if it is due and the network allows it. Never throws. */
export async function runScheduledBackup(): Promise<'done' | 'skipped' | 'failed'> {
  try {
    const s = await loadSettings();
    if (!backupDue(s) || !(await hasDriveAccount()) || !(await networkAllowed(s))) return 'skipped';
    await backupToDrive();
    await saveSettings({ lastBackupAt: Date.now(), lastError: undefined });
    return 'done';
  } catch (e) {
    await saveSettings({ lastError: (e as Error).message }).catch(() => {});
    return 'failed';
  }
}
