// Coffre Web, website side: shows the library that lives on the phone, through the encrypted link.
// Nothing is stored on a server. Opened files are cached in this browser (IndexedDB) until the link is removed.
import { useSyncExternalStore } from 'react';
import { cacheClear, cacheDelete, cacheGet, cacheKeys, cachePut, type Folder, type Item } from './db';
import { fingerprint, keyPair, Link, PART, qrText, sharedKey, toB64, fromB64, type Header, type KeyPair } from './link/protocol';
import { supabase } from './supabase';

export type Status = 'unavailable' | 'pairing' | 'connecting' | 'online' | 'offline';

export interface Usage {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
}

export interface PhoneState {
  status: Status;
  /** QR code text to scan with the app (pairing only). */
  qr?: string;
  /** Check code shown on both screens right after pairing. */
  code?: string;
  phone?: string;
  folders: Folder[];
  items: Item[];
  usage?: Usage;
  /** False until the phone has sent its library once. */
  loaded: boolean;
}

const SAVED = 'coffre.link';
const OFFLINE_AFTER = 40_000;
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const newId = () => toB64(random(12));

function browserName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : /iPhone|iPad/.test(ua) ? 'iOS' : '';
  return os ? `${browser} sur ${os}` : browser;
}

interface Pending {
  resolve: (v: Blob | void) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  parts?: Uint8Array[];
  got?: number;
  onProgress?: (done: number, total: number) => void;
}

class Phone {
  state: PhoneState = { status: 'connecting', folders: [], items: [], loaded: false };
  private listeners = new Set<() => void>();
  private link: Link | null = null;
  private lastSeen = 0;
  private pending = new Map<string, Pending>();
  private downloads = new Map<string, Promise<Blob>>();
  private started = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  private set(patch: Partial<PhoneState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (!supabase) return this.set({ status: 'unavailable' });
    let saved: { channelId: string; key: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null');
    } catch {
      /* ignore */
    }
    if (saved?.channelId && saved.key) this.connect(saved.channelId, fromB64(saved.key));
    else this.startPairing();

    setInterval(() => {
      const { status } = this.state;
      if (status !== 'online' && status !== 'connecting' && status !== 'offline') return;
      if (Date.now() - this.lastSeen > OFFLINE_AFTER) {
        if (status !== 'offline') this.set({ status: 'offline' });
        void this.hello(); // the phone answers as soon as Coffre is opened on it
      } else if (!this.state.loaded) {
        void this.hello(); // just linked or reconnected: ask again until the library arrives
      }
    }, 5_000);
  }

  private startPairing() {
    const channelId = newId() + newId();
    const kp: KeyPair = keyPair(random);
    const link = new Link({
      client: supabase!, channelId, side: 'w', random, key: null,
      onMessage: (h, body) => this.onMessage(h, body),
      onPair: (phonePublic) => {
        if (link.key) return; // first phone wins
        const key = sharedKey(kp, phonePublic, kp.publicKey, phonePublic);
        link.key = key;
        localStorage.setItem(SAVED, JSON.stringify({ channelId, key: toB64(key) }));
        this.lastSeen = Date.now();
        this.set({ status: 'connecting', qr: undefined, code: fingerprint(key) });
        void this.hello();
      },
    });
    this.link = link;
    link.open();
    this.set({ status: 'pairing', qr: qrText(channelId, kp.publicKey), folders: [], items: [], loaded: false, code: undefined, phone: undefined });
  }

  private connect(channelId: string, key: Uint8Array) {
    this.link = new Link({ client: supabase!, channelId, side: 'w', random, key, onMessage: (h, body) => this.onMessage(h, body) });
    this.link.open();
    this.lastSeen = Date.now();
    this.set({ status: 'connecting' });
    void this.hello();
  }

  private hello() {
    return this.link?.key ? this.link.send({ t: 'hello', name: browserName() }).catch(() => {}) : Promise.resolve();
  }

  private onMessage(h: Header, body: Uint8Array) {
    this.lastSeen = Date.now();
    if (this.state.status !== 'online') this.set({ status: 'online' });
    switch (h.t) {
      case 'state': {
        const items = (h.items as Item[]) ?? [];
        this.set({ folders: (h.folders as Folder[]) ?? [], items, usage: h.usage as Usage, phone: String(h.phone ?? ''), loaded: true });
        void this.pruneCache(items);
        return;
      }
      case 'ok':
      case 'err': {
        const p = this.pending.get(String(h.req));
        if (!p) return;
        this.pending.delete(String(h.req));
        clearTimeout(p.timer);
        if (h.t === 'ok') p.resolve();
        else p.reject(new Error(String(h.message ?? 'Erreur sur le téléphone')));
        return;
      }
      case 'part': {
        const req = String(h.req);
        const p = this.pending.get(req);
        if (!p) return;
        const n = Number(h.n);
        const i = Number(h.i);
        p.parts ??= new Array(n);
        if (p.parts[i] === undefined) {
          p.parts[i] = body.slice();
          p.got = (p.got ?? 0) + 1;
        }
        this.keepAlive(req);
        p.onProgress?.(p.got ?? 0, n);
        if ((p.got ?? 0) >= n) {
          this.pending.delete(req);
          clearTimeout(p.timer);
          p.resolve(new Blob(p.parts as BlobPart[], { type: String(h.mime ?? '') }));
        }
        return;
      }
      case 'unlink':
        return void this.forget(false);
    }
  }

  private keepAlive(req: string, ms = 30_000) {
    const p = this.pending.get(req);
    if (!p) return;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      this.pending.delete(req);
      p.reject(new Error(this.state.status === 'offline' ? 'Ton téléphone est hors ligne : ouvre Coffre dessus.' : 'Le téléphone ne répond pas.'));
    }, ms);
  }

  /** Waits for the phone's answer to `req` (ok / err, or the parts of a file). */
  private expect(req: string, extra: Partial<Pending> = {}): Promise<Blob | void> {
    if (!this.link?.key) return Promise.reject(new Error('Téléphone non connecté'));
    if (this.state.status === 'offline') return Promise.reject(new Error('Ton téléphone est hors ligne : ouvre Coffre dessus.'));
    return new Promise((resolve, reject) => {
      this.pending.set(req, { resolve, reject, timer: setTimeout(() => {}, 0), ...extra });
      this.keepAlive(req);
    });
  }

  private fail(req: string, e: unknown) {
    const p = this.pending.get(req);
    if (!p) return;
    this.pending.delete(req);
    clearTimeout(p.timer);
    p.reject(e instanceof Error ? e : new Error(String(e)));
  }

  /** Sends a request and waits for the phone's answer. */
  private request(h: Header, extra: Partial<Pending> = {}): Promise<Blob | void> {
    const req = newId();
    const answer = this.expect(req, extra);
    this.link?.send({ ...h, req }).catch((e) => this.fail(req, e));
    return answer;
  }

  // ---- Library operations (all applied on the phone, which then sends the new state) ----

  saveFolder = (folder: Folder) => this.request({ t: 'saveFolder', folder }) as Promise<void>;
  deleteFolder = (id: string) => this.request({ t: 'deleteFolder', id }) as Promise<void>;
  saveItem = (item: Item) => this.request({ t: 'saveItem', item }) as Promise<void>;
  deleteItem = (id: string) => this.request({ t: 'deleteItem', id }) as Promise<void>;
  saveMany = (folders: Folder[], items: Item[]) => this.request({ t: 'saveMany', folders, items }) as Promise<void>;

  /** Sends a file from this computer to the phone. */
  async upload(file: File, item: Item, onProgress?: (done: number, total: number) => void) {
    const req = newId();
    const n = Math.max(1, Math.ceil(file.size / PART));
    const done = this.expect(req); // the phone answers once the last part is written
    try {
      const inFlight: Promise<void>[] = [];
      for (let i = 0; i < n && this.pending.has(req); i++) {
        const bytes = new Uint8Array(await file.slice(i * PART, (i + 1) * PART).arrayBuffer());
        inFlight.push(this.link!.send({ t: 'up', req, i, n, item }, bytes).then(() => {
          this.keepAlive(req);
          onProgress?.(i + 1, n);
        }));
        if (inFlight.length >= 4) await inFlight.shift();
      }
      await Promise.all(inFlight);
    } catch (e) {
      this.fail(req, e);
    }
    await done;
  }

  /** A stored file, from this browser's cache or streamed from the phone. */
  getBlob(id: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
    const running = this.downloads.get(id);
    if (running) return running;
    const task = (async () => {
      const cached = await cacheGet(id);
      if (cached) return cached;
      const blob = (await this.request({ t: 'get', id }, { onProgress })) as Blob;
      await cachePut(id, blob).catch(() => {});
      return blob;
    })().finally(() => this.downloads.delete(id));
    this.downloads.set(id, task);
    return task;
  }

  private async pruneCache(items: Item[]) {
    const live = new Set(items.map((i) => i.id));
    for (const id of await cacheKeys().catch(() => [] as string[])) if (!live.has(id)) await cacheDelete(id).catch(() => {});
  }

  /** Removes the link on this browser (and tells the phone, unless it asked). */
  async forget(tellPhone = true) {
    if (tellPhone) await this.link?.send({ t: 'unlink' }).catch(() => {});
    this.link?.close();
    this.link = null;
    localStorage.removeItem(SAVED);
    await cacheClear().catch(() => {});
    for (const p of this.pending.values()) p.reject(new Error('Déconnecté'));
    this.pending.clear();
    this.startPairing();
  }
}

export const phone = new Phone();

export function usePhone(): PhoneState {
  return useSyncExternalStore(phone.subscribe, () => phone.state);
}
