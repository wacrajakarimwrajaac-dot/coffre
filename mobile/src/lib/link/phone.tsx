// Coffre Web, phone side: the phone serves its library to the websites it is linked to, like WhatsApp Web.
// Messages (website -> phone): hello, ping, get, saveFolder, deleteFolder, saveItem, deleteItem, saveMany, up, unlink.
// Messages (phone -> website): state, part, ok, err, alive, unlink.
// Links are only open while the app is in the foreground.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import { File as FsFile, FileMode, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import {
  deleteFolder, deleteItem, getItem, getUsage, itemFile, loadAll, saveFolder, saveItem, saveMany, subscribe,
  type Folder, type Item,
} from '../data';
import { supabase } from '../supabase';
import { checkWebAccess, type WebAccess } from './access';
import { fingerprint, fromB64, keyPair, Link, parseQr, PART, sharedKey, toB64, type Header } from './protocol';

export interface Device {
  /** Relay channel id, from the QR code. */
  id: string;
  /** Shared secret (base64). Stays on this phone. */
  key: string;
  name: string;
  linkedAt: number;
  lastSeen?: number;
}

const random = (n: number) => getRandomBytes(n);
const storageKey = (userId: string) => `coffre.link.${userId}`;
const PHONE_NAME = Platform.OS === 'ios' ? 'iPhone' : 'Téléphone Android';

// ---- Validation of what the website sends ----

const str = (x: unknown, max = 100_000) => (typeof x === 'string' ? x.slice(0, max) : undefined);
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

function cleanFolder(x: unknown): Folder | null {
  const f = x as Record<string, unknown> | null;
  const id = str(f?.id, 64);
  const name = str(f?.name, 200)?.trim();
  if (!id || !name) return null;
  return { id, name, parentId: str(f?.parentId, 64) ?? null, icon: str(f?.icon, 40) ?? 'folder:violet', createdAt: num(f?.createdAt) ?? Date.now() };
}

function cleanItem(x: unknown): Item | null {
  const i = x as Record<string, unknown> | null;
  const id = str(i?.id, 64);
  const folderId = str(i?.folderId, 64);
  const type = i?.type;
  if (!id || !folderId || (type !== 'link' && type !== 'note' && type !== 'file')) return null;
  return {
    id, folderId, type, title: str(i?.title, 500) ?? '', text: str(i?.text), url: str(i?.url, 4000),
    fileName: str(i?.fileName, 300), mime: str(i?.mime, 120), size: num(i?.size), createdAt: num(i?.createdAt) ?? Date.now(),
  };
}

// ---- Serving one website ----

interface Upload {
  item: Item;
  tmp: FsFile;
  n: number;
  next: number;
  early: Map<number, Uint8Array>;
}

class Session {
  link: Link;
  private uploads = new Map<string, Upload>();
  /** Last time the website said something: library changes are only pushed while it is around. */
  private heardAt = 0;

  constructor(public device: Device, private events: { seen: (id: string, name?: string) => void; unlinked: (id: string) => void }) {
    this.link = new Link({
      client: supabase, channelId: device.id, side: 'p', random, key: fromB64(device.key),
      onMessage: (h, body) => {
        this.heardAt = Date.now();
        void this.handle(h, body).catch((e) => this.reply(h, e));
      },
    });
  }

  open() {
    this.link.open();
    void this.sendState(true);
  }

  close() {
    this.link.close();
    for (const u of this.uploads.values()) if (u.tmp.exists) u.tmp.delete();
    this.uploads.clear();
  }

  async sendState(force = false) {
    if (!force && Date.now() - this.heardAt > 150_000) return;
    const { folders, items } = await loadAll();
    const usage = await getUsage();
    await this.link.send({ t: 'state', folders, items, usage, phone: PHONE_NAME }).catch(() => {});
  }

  private reply(h: Header, e?: unknown) {
    if (typeof h.req !== 'string') return;
    const msg = e ? { t: 'err', req: h.req, message: e instanceof Error ? e.message : String(e) } : { t: 'ok', req: h.req };
    void this.link.send(msg).catch(() => {});
  }

  private async handle(h: Header, body: Uint8Array) {
    switch (h.t) {
      case 'hello':
        this.events.seen(this.device.id, str(h.name, 80));
        return this.sendState(true);
      case 'ping': // presence is only answered, never sent on its own (it would use up relay messages)
        return void this.link.send({ t: 'alive' }).catch(() => {});
      case 'get':
        return this.sendFile(h);
      case 'saveFolder': {
        const f = cleanFolder(h.folder);
        if (!f) throw new Error('Dossier invalide');
        await saveFolder(f);
        return this.reply(h);
      }
      case 'deleteFolder':
        await deleteFolder(String(h.id));
        return this.reply(h);
      case 'saveItem': {
        const it = cleanItem(h.item);
        if (!it) throw new Error('Élément invalide');
        const existing = await getItem(it.id);
        if (it.type === 'file' || existing?.type === 'file') {
          // Only the title and folder of a stored file can change from the website.
          if (!existing || existing.type !== 'file') throw new Error('Fichier introuvable sur le téléphone');
          await saveItem({ ...existing, title: it.title, folderId: it.folderId });
        } else {
          await saveItem(it);
        }
        return this.reply(h);
      }
      case 'saveMany': {
        const folders = (Array.isArray(h.folders) ? h.folders : []).map(cleanFolder).filter((f): f is Folder => !!f);
        const items = (Array.isArray(h.items) ? h.items : []).map(cleanItem).filter((i): i is Item => !!i && i.type !== 'file');
        await saveMany(folders, items);
        return this.reply(h);
      }
      case 'deleteItem': {
        const it = await getItem(String(h.id));
        if (it) await deleteItem(it);
        return this.reply(h);
      }
      case 'up':
        return this.receivePart(h, body);
      case 'unlink':
        return this.events.unlinked(this.device.id);
    }
  }

  /** Streams a file to the website, PART bytes per message. */
  private async sendFile(h: Header) {
    const it = await getItem(String(h.id));
    const file = it?.type === 'file' ? itemFile(it) : null;
    if (!it || !file?.exists) throw new Error('Fichier introuvable sur le téléphone');
    const size = file.size ?? 0;
    const n = Math.max(1, Math.ceil(size / PART));
    const handle = file.open(FileMode.ReadOnly);
    try {
      const inFlight: Promise<void>[] = [];
      for (let i = 0; i < n; i++) {
        handle.offset = i * PART;
        const bytes = handle.readBytesSync(Math.min(PART, size - i * PART));
        inFlight.push(this.link.send({ t: 'part', req: h.req, i, n, size, mime: it.mime ?? '' }, bytes));
        if (inFlight.length >= 4) await inFlight.shift();
      }
      await Promise.all(inFlight);
    } finally {
      handle.close();
    }
  }

  /** Receives a file sent from the website; parts are written in order, then the item is saved. */
  private async receivePart(h: Header, body: Uint8Array) {
    const req = str(h.req, 64);
    const i = num(h.i);
    const n = num(h.n);
    if (!req || i === undefined || n === undefined || !Number.isInteger(i) || !Number.isInteger(n) || n < 1 || i < 0 || i >= n) return;
    let u = this.uploads.get(req);
    if (!u) {
      const item = cleanItem(h.item);
      if (!item || item.type !== 'file') throw new Error('Fichier invalide');
      const tmp = new FsFile(Paths.cache, `link-upload-${req.replace(/[^\w-]/g, '')}`);
      if (tmp.exists) tmp.delete();
      tmp.create();
      u = { item, tmp, n, next: 0, early: new Map() };
      this.uploads.set(req, u);
    }
    u.early.set(i, body.slice());
    const handle = u.tmp.open(FileMode.Append);
    try {
      while (u.early.has(u.next)) {
        handle.writeBytesSync(u.early.get(u.next)!);
        u.early.delete(u.next++);
      }
    } finally {
      handle.close();
    }
    if (u.next < u.n) return;
    this.uploads.delete(req);
    const target = itemFile(u.item);
    if (target.exists) target.delete();
    u.tmp.moveSync(target);
    await saveItem({ ...u.item, size: target.size ?? u.item.size });
    this.reply(h);
  }
}

// ---- Provider: the list of linked websites and their live sessions ----

interface LinkCtx {
  devices: Device[];
  /** Whether Coffre Web may run for this account (null while checking). */
  access: WebAccess | null;
  /** Asks the server again (e.g. when the Coffre Web screen opens). */
  refreshAccess: () => Promise<WebAccess>;
  /** Links this phone to the website that shows `qr`; returns the check code shown on both screens. */
  pair: (qr: string) => Promise<string>;
  unlink: (id: string) => Promise<void>;
}

const Ctx = createContext<LinkCtx | null>(null);

export function LinkProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [access, setAccess] = useState<WebAccess | null>(null);
  const accessRef = useRef<WebAccess | null>(null);
  const devicesRef = useRef<Device[]>([]);
  const sessions = useRef(new Map<string, Session>());

  const persist = useCallback(async (next: Device[]) => {
    devicesRef.current = next;
    setDevices(next);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    sessions.current.get(id)?.close();
    sessions.current.delete(id);
    await persist(devicesRef.current.filter((d) => d.id !== id));
  }, [persist]);

  const sessionEvents = useMemo(() => ({
    seen: (id: string, name?: string) =>
      void persist(devicesRef.current.map((d) => (d.id === id ? { ...d, lastSeen: Date.now(), name: name || d.name } : d))),
    unlinked: (id: string) => void remove(id),
  }), [persist, remove]);

  const start = useCallback((d: Device) => {
    if (sessions.current.has(d.id) || !accessRef.current?.active) return;
    const s = new Session(d, sessionEvents);
    sessions.current.set(d.id, s);
    s.open();
  }, [sessionEvents]);

  const stopAll = useCallback(() => {
    for (const s of sessions.current.values()) s.close();
    sessions.current.clear();
  }, []);

  // Checks the account's access (server, or last answer), then connects the linked websites while the app is in the foreground.
  const refreshAccess = useCallback(async () => {
    const a = await checkWebAccess(userId);
    accessRef.current = a;
    setAccess(a);
    if (a.active) devicesRef.current.forEach(start);
    else stopAll();
    return a;
  }, [userId, start, stopAll]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey(userId)).then(async (raw) => {
      if (!alive) return;
      const list = (JSON.parse(raw ?? '[]') as Device[]).filter((d) => d?.id && d?.key);
      devicesRef.current = list;
      setDevices(list);
      if (list.length && AppState.currentState === 'active') await refreshAccess();
    }).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAccess();
      else if (state === 'background') stopAll();
    });
    return () => {
      alive = false;
      sub.remove();
      stopAll();
    };
  }, [userId, refreshAccess, stopAll]);

  // Push every change of the library to the linked websites.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => sessions.current.forEach((s) => void s.sendState()), 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const pair = useCallback(async (qr: string) => {
    const code = parseQr(qr.trim());
    if (!code) throw new Error('Ce QR code ne vient pas du site Coffre.');
    const a = await refreshAccess();
    if (!a.active) throw new Error('Coffre Web n’est pas actif sur ton compte.');
    const mine = keyPair(random);
    const key = sharedKey(mine, code.webPublic, code.webPublic, mine.publicKey);
    const device: Device = { id: code.channelId, key: toB64(key), name: 'Navigateur', linkedAt: Date.now() };
    const s = new Session(device, sessionEvents);
    s.link.open();
    try {
      await s.link.sendPairing(mine.publicKey);
    } catch (e) {
      s.close();
      throw e;
    }
    sessions.current.get(device.id)?.close();
    sessions.current.set(device.id, s);
    s.open();
    await persist([...devicesRef.current.filter((d) => d.id !== device.id), device]);
    return fingerprint(key);
  }, [persist, sessionEvents, refreshAccess]);

  const unlink = useCallback(async (id: string) => {
    await sessions.current.get(id)?.link.send({ t: 'unlink' }).catch(() => {});
    await remove(id);
  }, [remove]);

  return <Ctx.Provider value={{ devices, access, refreshAccess, pair, unlink }}>{children}</Ctx.Provider>;
}

export function useLink(): LinkCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLink outside LinkProvider');
  return v;
}

/** Forgets every linked website on this phone (account deletion). */
export async function forgetDevices(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId));
}
