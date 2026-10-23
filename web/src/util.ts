export interface Platform {
  name: string;
  color: string;
}

const PLATFORMS: [RegExp, Platform][] = [
  [/(^|\.)instagram\.com$/, { name: 'Instagram', color: '#e1306c' }],
  [/(^|\.)(facebook\.com|fb\.watch)$/, { name: 'Facebook', color: '#1877f2' }],
  [/(^|\.)(youtube\.com|youtu\.be)$/, { name: 'YouTube', color: '#ff0033' }],
  [/(^|\.)tiktok\.com$/, { name: 'TikTok', color: '#25f4ee' }],
  [/(^|\.)(x\.com|twitter\.com)$/, { name: 'X', color: '#a0a8c0' }],
  [/(^|\.)linkedin\.com$/, { name: 'LinkedIn', color: '#0a66c2' }],
  [/(^|\.)pinterest\.\w+$/, { name: 'Pinterest', color: '#e60023' }],
];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function platformOf(url: string): Platform | null {
  const host = hostOf(url);
  for (const [re, p] of PLATFORMS) if (re.test(host)) return p;
  return null;
}

export function linkKind(url: string): string | null {
  if (/instagram\.com\/(reel|reels)\//.test(url)) return 'Reel';
  if (/facebook\.com\/(reel|watch)|fb\.watch/.test(url)) return 'Vidéo';
  if (/youtube\.com\/shorts\//.test(url)) return 'Short';
  return null;
}

export function youtubeThumb(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
}

export function formatSize(bytes = 0): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
  return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
}

export function formatDue(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// "2026-10-23T14:30" for <input type="datetime-local">
export function toLocalInput(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    /* audio unavailable */
  }
}
