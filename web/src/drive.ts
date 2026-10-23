// Google Drive backup, WhatsApp-style: a visible "Coffre" folder in the user's own Drive.
// Folder tree is mirrored, files are uploaded once (incremental), and everything else
// (folders, notes, links, tasks + Drive ids) lives in "coffre-sauvegarde.json".
import { getAll, getBlob, parentsFirst, put, putBlob, remove, type Folder, type Item } from './db';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MANIFEST = 'coffre-sauvegarde.json';

// ---- Settings (per device, like WhatsApp) ----

export type Frequency = 'off' | 'daily' | 'weekly';
export interface DriveSettings {
  frequency: Frequency;
  email?: string;
  lastBackupAt?: number;
}
const SETTINGS_KEY = 'coffre.drive';

export function loadSettings(): DriveSettings {
  try {
    return { frequency: 'off', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { frequency: 'off' };
  }
}
export function saveSettings(s: DriveSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export function backupDue(s: DriveSettings, now = Date.now()): boolean {
  if (s.frequency === 'off' || !s.email) return false;
  const every = s.frequency === 'daily' ? 864e5 : 7 * 864e5;
  return !s.lastBackupAt || now - s.lastBackupAt >= every;
}

// ---- OAuth (Google Identity Services) ----

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string; login_hint?: string }): void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient(c: {
      client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void;
    }): TokenClient } } };
  }
}

let gisLoaded: Promise<void> | null = null;
function loadGis(): Promise<void> {
  gisLoaded ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Impossible de charger Google'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

let token: { value: string; expiresAt: number } | null = null;

/** interactive=false tries a silent grant (works when the user already consented). */
export async function authorize(interactive: boolean, loginHint?: string): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  if (!GOOGLE_CLIENT_ID) throw new Error('Google n’est pas configuré (VITE_GOOGLE_CLIENT_ID)');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error ?? 'Autorisation refusée'));
        token = { value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Fenêtre Google fermée' : 'Autorisation Google impossible')),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '', login_hint: loginHint });
  });
}

export function disconnect() {
  token = null;
}

async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const t = await authorize(false);
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...init.headers } });
  if (!res.ok) throw new Error(`Google Drive : erreur ${res.status}`);
  return res;
}

const json = async <T>(url: string, init?: RequestInit) => (await gfetch(url, init)).json() as Promise<T>;

export async function accountEmail(): Promise<string> {
  const r = await json<{ user: { emailAddress: string } }>(`${API}/about?fields=user(emailAddress)`);
  return r.user.emailAddress;
}

// ---- Drive helpers ----

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

/** Resumable upload: works for large videos. Creates a new file, or replaces content of `existingId`. */
async function upload(blob: Blob, meta: { name: string; parents?: string[] }, existingId?: string): Promise<string> {
  const t = await authorize(false);
  const start = await fetch(
    existingId ? `${UPLOAD}/files/${existingId}?uploadType=resumable` : `${UPLOAD}/files?uploadType=resumable&fields=id`,
    {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'application/octet-stream',
      },
      body: JSON.stringify(existingId ? {} : meta),
    },
  );
  const location = start.headers.get('Location');
  if (!start.ok || !location) throw new Error(`Google Drive : envoi impossible (${start.status})`);
  const done = await fetch(location, { method: 'PUT', body: blob });
  if (!done.ok) throw new Error(`Google Drive : envoi interrompu (${done.status})`);
  return ((await done.json()) as { id: string }).id;
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

async function rootFolder(): Promise<string> {
  return (
    (await findOne(`name='Coffre' and mimeType='${FOLDER_MIME}' and 'root' in parents`)) ??
    (await createFolder('Coffre', 'root'))
  );
}

async function readManifest(root: string): Promise<{ id: string | null; data: Manifest | null }> {
  const id = await findOne(`name='${MANIFEST}' and '${root}' in parents`);
  if (!id) return { id: null, data: null };
  return { id, data: await json<Manifest>(`${API}/files/${id}?alt=media`) };
}

export async function backupToDrive(progress: Progress = () => {}): Promise<{ uploaded: number }> {
  progress('Connexion à Google Drive…');
  const root = await rootFolder();
  const { id: manifestId, data: prev } = await readManifest(root);
  const folders = await getAll<Folder>('folders');
  const items = await getAll<Item>('items');
  const driveFolders = { ...prev?.driveFolders };
  const driveFiles = { ...prev?.driveFiles };

  // Mirror the folder tree (parents first).
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

  // Upload new files, move the ones that changed folder.
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
    const blob = await getBlob(it.id);
    if (!blob) continue;
    progress(`Envoi ${n + 1}/${files.length} : ${it.title}`);
    driveFiles[it.id] = { id: await upload(blob, { name: it.fileName ?? it.title, parents: [parent] }), parent };
    uploaded++;
  }

  // Trash Drive copies of deleted items/folders (recoverable from Drive's bin for 30 days).
  const liveItems = new Set(items.map((i) => i.id));
  for (const [itemId, f] of Object.entries(driveFiles)) {
    if (!liveItems.has(itemId)) {
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
  const body = new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' });
  await upload(body, { name: MANIFEST, parents: [root] }, manifestId ?? undefined);
  return { uploaded };
}

export async function latestBackupDate(): Promise<number | null> {
  const root = await findOne(`name='Coffre' and mimeType='${FOLDER_MIME}' and 'root' in parents`);
  if (!root) return null;
  return (await readManifest(root)).data?.createdAt ?? null;
}

export async function restoreFromDrive(progress: Progress = () => {}): Promise<{ items: number }> {
  progress('Recherche de la sauvegarde…');
  const root = await findOne(`name='Coffre' and mimeType='${FOLDER_MIME}' and 'root' in parents`);
  const data = root ? (await readManifest(root)).data : null;
  if (!data) throw new Error('Aucune sauvegarde Coffre trouvée dans ce Google Drive');

  // A fresh device auto-creates an empty inbox; drop it when the backup brings its own.
  const backupIds = new Set(data.folders.map((f) => f.id));
  const localItems = await getAll<Item>('items');
  for (const f of await getAll<Folder>('folders')) {
    if (!backupIds.has(f.id) && !f.parentId && f.name === 'Boîte de réception' && !localItems.some((i) => i.folderId === f.id)
      && data.folders.some((b) => !b.parentId && b.name === f.name)) {
      await remove('folders', f.id);
    }
  }

  for (const f of parentsFirst(data.folders)) await put('folders', f);

  const files = data.items.filter((i) => i.type === 'file');
  let n = 0;
  for (const it of data.items) {
    const drive = data.driveFiles[it.id];
    if (it.type === 'file') {
      if (!drive) continue;
      progress(`Téléchargement ${++n}/${files.length} : ${it.title}`);
      const blob = await (await gfetch(`${API}/files/${drive.id}?alt=media`)).blob();
      await put('items', it); // row first: the server checks the quota and then allows the upload
      await putBlob(it.id, blob);
      continue;
    }
    await put('items', it);
  }
  return { items: data.items.length };
}
