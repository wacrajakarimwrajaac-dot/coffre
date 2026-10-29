// Coffre Web link: the phone keeps the data; the website shows it through an end-to-end encrypted relay
// (Supabase Realtime broadcast). The relay only sees encrypted frames, never folders, items or files.
//
// KEEP IN SYNC: this file is identical in web/src/link/protocol.ts and mobile/src/lib/link/protocol.ts
// (checked by `node scripts/check-link-protocol.mjs`).
//
// Pairing, like WhatsApp Web:
//   1. The website makes an x25519 key pair and a random channel id, and shows them in a QR code.
//   2. The phone scans it, makes its own key pair and sends its public key on the channel ("pair").
//   3. Both derive the same secret key (x25519 + HKDF). Someone who photographs the QR code only has a public key.
// Every message is then sealed with XChaCha20-Poly1305 (random 24-byte nonce, sender side as associated data),
// timestamped and deduplicated, and split into frames small enough for the relay.
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export const PROTOCOL = 1;
const QR_PREFIX = 'coffre-link:1:';
/** Base64 characters per relay frame (Supabase free plan accepts 256 KB per broadcast). */
const FRAME = 120_000;
/** Raw bytes of a file per message: one message = one frame. */
export const PART = 64 * 1024;
/** Messages older than this (or replayed) are ignored. */
const MAX_AGE = 30 * 60_000;
const IN_FLIGHT = 4;

export type Side = 'w' | 'p'; // website, phone
export type Header = { t: string } & Record<string, unknown>;
export type Random = (n: number) => Uint8Array;

// ---- Encoding helpers (no TextDecoder / atob on every React Native engine) ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) B64_INDEX[B64.charCodeAt(i)] = i;

/** URL-safe base64 without padding. */
export function toB64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '');
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64_INDEX[s.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error('base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out.subarray(0, o);
}

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      c = Math.min(c, 0x10ffff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return Uint8Array.from(out);
}

export function fromUtf8(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

// ---- Keys and QR code ----

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function keyPair(random: Random): KeyPair {
  const secretKey = random(32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

/** The secret both sides share once the phone has scanned the code. */
export function sharedKey(mine: KeyPair, theirPublic: Uint8Array, webPublic: Uint8Array, phonePublic: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(mine.secretKey, theirPublic);
  const salt = new Uint8Array(64);
  salt.set(webPublic, 0);
  salt.set(phonePublic, 32);
  return hkdf(sha256, shared, salt, utf8('coffre-link-v1'), 32);
}

export function qrText(channelId: string, webPublic: Uint8Array): string {
  return `${QR_PREFIX}${channelId}.${toB64(webPublic)}`;
}

export function parseQr(text: string): { channelId: string; webPublic: Uint8Array } | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  const [channelId, pub] = text.slice(QR_PREFIX.length).split('.');
  try {
    const webPublic = fromB64(pub ?? '');
    return /^[A-Za-z0-9_-]{16,64}$/.test(channelId ?? '') && webPublic.length === 32 ? { channelId, webPublic } : null;
  } catch {
    return null;
  }
}

/** Short code shown on both screens so the person can check they paired the right devices. */
export function fingerprint(key: Uint8Array): string {
  const h = sha256(key);
  return Array.from(h.subarray(0, 3), (b) => b.toString().padStart(3, '0')).join(' ');
}

// ---- Link: one encrypted conversation over one relay channel ----

interface Options {
  client: SupabaseClient;
  channelId: string;
  side: Side;
  random: Random;
  key: Uint8Array | null;
  onMessage: (h: Header, body: Uint8Array) => void;
  /** Website only: the phone sent its public key. */
  onPair?: (phonePublic: Uint8Array) => void;
  onStatus?: (connected: boolean) => void;
}

const EMPTY = new Uint8Array(0);

export class Link {
  key: Uint8Array | null;
  private channel: RealtimeChannel | null = null;
  private ready: Promise<void> = Promise.resolve();
  private markReady: () => void = () => {};
  private seen = new Map<string, number>();
  private partial = new Map<string, { parts: string[]; got: number; at: number }>();
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private o: Options) {
    this.key = o.key;
  }

  open() {
    if (this.channel) return;
    this.ready = new Promise((r) => (this.markReady = r));
    const ch = this.o.client.channel(`coffre-link-${this.o.channelId}`, { config: { broadcast: { ack: true, self: false } } });
    ch.on('broadcast', { event: 'f' }, ({ payload }) => this.onFrame(payload));
    ch.on('broadcast', { event: 'pair' }, ({ payload }) => {
      try {
        const pub = fromB64(String(payload?.pub ?? ''));
        if (pub.length === 32) this.o.onPair?.(pub);
      } catch {
        /* malformed */
      }
    });
    ch.subscribe((status) => {
      const up = status === 'SUBSCRIBED';
      if (up) this.markReady();
      this.o.onStatus?.(up);
    });
    this.channel = ch;
  }

  close() {
    const ch = this.channel;
    this.channel = null;
    if (ch) void this.o.client.removeChannel(ch);
    this.waiting.splice(0).forEach((w) => w());
  }

  private whenReady(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Relais injoignable : vérifie ta connexion internet.')), 20_000);
    });
    return Promise.race([this.ready, timeout]).finally(() => clearTimeout(timer));
  }

  /** Phone only: announces its public key to the website that showed the QR code. */
  async sendPairing(phonePublic: Uint8Array) {
    await this.whenReady();
    const r = await this.channel?.send({ type: 'broadcast', event: 'pair', payload: { pub: toB64(phonePublic) } });
    if (r !== 'ok') throw new Error('Le site ne répond pas. Recharge la page et scanne le nouveau code.');
  }

  /** Encrypts and sends one message; resolves once the relay accepted every frame. */
  async send(h: Header, body: Uint8Array = EMPTY) {
    if (!this.key) throw new Error('Appareils non associés');
    const header = utf8(JSON.stringify({ ...h, _ts: Date.now(), _id: toB64(this.o.random(12)) }));
    const plain = new Uint8Array(4 + header.length + body.length);
    new DataView(plain.buffer).setUint32(0, header.length);
    plain.set(header, 4);
    plain.set(body, 4 + header.length);
    const nonce = this.o.random(24);
    const sealed = xchacha20poly1305(this.key, nonce, utf8(this.o.side)).encrypt(plain);
    const packet = new Uint8Array(24 + sealed.length);
    packet.set(nonce, 0);
    packet.set(sealed, 24);
    const data = toB64(packet);
    const n = Math.max(1, Math.ceil(data.length / FRAME));
    const m = toB64(this.o.random(9));
    const frames: Promise<void>[] = [];
    for (let i = 0; i < n; i++) frames.push(this.frame({ m, i, n, d: data.slice(i * FRAME, (i + 1) * FRAME) }));
    await Promise.all(frames);
  }

  private async frame(payload: { m: string; i: number; n: number; d: string }) {
    await this.whenReady();
    if (this.active >= IN_FLIGHT) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try {
      for (let attempt = 0; ; attempt++) {
        if (!this.channel) throw new Error('Connexion fermée');
        const r = await this.channel.send({ type: 'broadcast', event: 'f', payload });
        if (r === 'ok') return;
        if (attempt >= 3) throw new Error(`Relais indisponible (${r})`);
        await new Promise((res) => setTimeout(res, 400 * 2 ** attempt));
      }
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private onFrame(p: unknown) {
    const f = p as { m?: unknown; i?: unknown; n?: unknown; d?: unknown } | null;
    if (!f || typeof f.m !== 'string' || typeof f.d !== 'string') return;
    const n = Number(f.n);
    const i = Number(f.i);
    if (!Number.isInteger(n) || !Number.isInteger(i) || n < 1 || n > 4000 || i < 0 || i >= n) return;
    if (n === 1) return this.unseal(f.d);
    const now = Date.now();
    for (const [k, e] of this.partial) if (now - e.at > 120_000) this.partial.delete(k);
    let e = this.partial.get(f.m);
    if (!e) this.partial.set(f.m, (e = { parts: new Array<string>(n), got: 0, at: now }));
    if (e.parts.length !== n || e.parts[i] !== undefined) return;
    e.parts[i] = f.d;
    if (++e.got < n) return;
    this.partial.delete(f.m);
    this.unseal(e.parts.join(''));
  }

  private unseal(data: string) {
    if (!this.key) return;
    let plain: Uint8Array;
    try {
      const packet = fromB64(data);
      const other: Side = this.o.side === 'w' ? 'p' : 'w';
      plain = xchacha20poly1305(this.key, packet.subarray(0, 24), utf8(other)).decrypt(packet.subarray(24));
    } catch {
      return; // not sealed with our key: ignore
    }
    const len = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
    let h: Header & { _ts?: unknown; _id?: unknown };
    try {
      h = JSON.parse(fromUtf8(plain.subarray(4, 4 + len)));
    } catch {
      return;
    }
    const now = Date.now();
    if (typeof h?.t !== 'string' || typeof h._ts !== 'number' || typeof h._id !== 'string') return;
    if (Math.abs(now - h._ts) > MAX_AGE || this.seen.has(h._id)) return;
    this.seen.set(h._id, now);
    if (this.seen.size > 5000) for (const [k, at] of this.seen) if (now - at > MAX_AGE) this.seen.delete(k);
    this.o.onMessage(h, plain.subarray(4 + len));
  }
}
