// The link to the phone: pairing by QR code, then encrypted requests over the relay (see link/protocol.ts).
// It carries nothing on its own: the computer talks to the phone only when the person presses "Synchroniser".
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import type { Folder, Item } from './db';
import { fingerprint, fromB64, keyPair, Link, PART, qrText, sharedKey, toB64, type Header, type KeyPair } from './link/protocol';
import type { Manifest, Tomb } from './link/sync';
import { supabase } from './supabase';
import type { Usage } from './library';

export type Status = 'unavailable' | 'pairing' | 'linked';

export interface LinkState {
  status: Status;
  /** QR code text to scan with the app (pairing only). */
  qr?: string;
  /** Check code shown on both screens right after pairing. */
  code?: string;
  /** True once the person just paired: the first sync should start by itself. */
  justPaired: boolean;
}

export interface SyncReply {
  folders: Folder[];
  items: Item[];
  tombs: Tomb[];
  wantFolders: string[];
  wantItems: string[];
  wantTombs: string[];
  /** Ids of file items whose content is on the phone. */
  files: string[];
  usage?: Usage;
  phone?: string;
}

const SAVED = 'coffre.link';

/** The relay only carries sealed messages, so it uses its own anonymous connection, apart from the signed-in account. */
let relayClient: SupabaseClient | null = null;
function relay(): SupabaseClient {
  relayClient ??= createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { storageKey: 'coffre-relay', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return relayClient;
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const newId = () => toB64(random(12));

export function browserName(): string {
  const ua = navigator.userAgent;
  if (/Electron\//.test(ua)) return /Windows/.test(ua) ? 'Coffre PC (Windows)' : /Mac OS X/.test(ua) ? 'Coffre PC (Mac)' : 'Coffre PC (Linux)';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : /iPhone|iPad/.test(ua) ? 'iOS' : '';
  return os ? `${browser} sur ${os}` : browser;
}

interface Pending {
  resolve: (v: Blob | Header | void) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  ms: number;
  parts?: Uint8Array[];
  got?: number;
  onProgress?: (done: number, total: number) => void;
}

const NO_ANSWER = 'Ton téléphone ne répond pas. Ouvre Coffre sur ton téléphone (avec internet) puis réessaie.';

class PhoneLink {
  state: LinkState = { status: 'pairing', justPaired: false };
  private listeners = new Set<() => void>();
  private link: Link | null = null;
  private pending = new Map<string, Pending>();
  private started = false;
  /** Called when the link is removed (here or from the phone): the local copy goes with it. */
  onForget: (() => void) | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  private set(patch: Partial<LinkState>) {
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
  }

  private startPairing() {
    const channelId = newId() + newId();
    const kp: KeyPair = keyPair(random);
    const link = new Link({
      client: relay(), channelId, side: 'w', random, key: null,
      onMessage: (h, body) => this.onMessage(h, body),
      onPair: (phonePublic) => {
        if (link.key) return; // first phone wins
        const key = sharedKey(kp, phonePublic, kp.publicKey, phonePublic);
        link.key = key;
        localStorage.setItem(SAVED, JSON.stringify({ channelId, key: toB64(key) }));
        this.set({ status: 'linked', qr: undefined, code: fingerprint(key), justPaired: true });
      },
    });
    this.link = link;
    link.open();
    this.set({ status: 'pairing', qr: qrText(channelId, kp.publicKey), code: undefined, justPaired: false });
  }

  private connect(channelId: string, key: Uint8Array) {
    this.link = new Link({ client: relay(), channelId, side: 'w', random, key, onMessage: (h, body) => this.onMessage(h, body) });
    this.link.open();
    this.set({ status: 'linked', justPaired: false });
  }

  acknowledgePairing() {
    if (this.state.justPaired) this.set({ justPaired: false });
  }

  private onMessage(h: Header, body: Uint8Array) {
    switch (h.t) {
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
      case 'syncReply': {
        const p = this.pending.get(String(h.req));
        if (!p) return;
        this.pending.delete(String(h.req));
        clearTimeout(p.timer);
        p.resolve(h);
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

  private keepAlive(req: string) {
    const p = this.pending.get(req);
    if (!p) return;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      this.pending.delete(req);
      p.reject(new Error(NO_ANSWER));
    }, p.ms);
  }

  /** Waits for the phone's answer to `req`. */
  private expect(req: string, ms: number, extra: Partial<Pending> = {}) {
    if (!this.link?.key) return Promise.reject(new Error('Téléphone non connecté'));
    return new Promise<Blob | Header | void>((resolve, reject) => {
      this.pending.set(req, { resolve, reject, timer: setTimeout(() => {}, 0), ms, ...extra });
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

  private request(h: Header, ms: number, extra: Partial<Pending> = {}) {
    const req = newId();
    const answer = this.expect(req, ms, extra);
    this.link?.send({ ...h, req }).catch((e) => this.fail(req, e));
    return answer;
  }

  // ---- What a sync needs ----

  /** Sends our manifest; the phone answers with its records, what it wants and which files it has. */
  async syncStart(manifest: Manifest): Promise<SyncReply> {
    return (await this.request({ t: 'syncStart', manifest, name: browserName() }, 25_000)) as unknown as SyncReply;
  }

  async syncApply(folders: Folder[], items: Item[], tombs: Tomb[]) {
    await this.request({ t: 'syncApply', folders, items, tombs }, 60_000);
  }

  /** A stored file, streamed from the phone. */
  fetchFile(id: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
    return this.request({ t: 'get', id }, 30_000, { onProgress }) as Promise<Blob>;
  }

  /** Sends a file to the phone; the phone answers once the last part is written. */
  async uploadFile(blob: Blob, item: Item, onProgress?: (done: number, total: number) => void) {
    const req = newId();
    const n = Math.max(1, Math.ceil(blob.size / PART));
    const done = this.expect(req, 30_000);
    try {
      const inFlight: Promise<void>[] = [];
      for (let i = 0; i < n && this.pending.has(req); i++) {
        const bytes = new Uint8Array(await blob.slice(i * PART, (i + 1) * PART).arrayBuffer());
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

  /** Removes the link on this computer (and tells the phone, unless it asked). */
  async forget(tellPhone = true) {
    if (tellPhone) await this.link?.send({ t: 'unlink' }).catch(() => {});
    this.link?.close();
    this.link = null;
    localStorage.removeItem(SAVED);
    this.onForget?.();
    for (const p of this.pending.values()) p.reject(new Error('Déconnecté'));
    this.pending.clear();
    this.startPairing();
  }
}

export const phone = new PhoneLink();

export function useLink(): LinkState {
  return useSyncExternalStore(phone.subscribe, () => phone.state);
}
