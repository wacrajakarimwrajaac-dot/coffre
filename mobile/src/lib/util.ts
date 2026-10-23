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
  const m = url.match(/^https?:\/\/([^/?#]+)/i);
  return (m ? m[1] : url).replace(/^www\./, '');
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

/** Extracts the first URL from shared text (e.g. "Regarde ça https://instagram.com/reel/…"). */
export function normalizeUrl(raw: string): string | null {
  const found = raw.match(/https?:\/\/\S+/i)?.[0] ?? raw.trim();
  if (!found || /\s/.test(found)) return null;
  const withProto = /^https?:\/\//i.test(found) ? found : `https://${found}`;
  return /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(withProto) ? withProto : null;
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

export function fileKind(mime = ''): string {
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Vidéo';
  if (mime.startsWith('audio/')) return 'Vocal';
  if (mime.includes('pdf')) return 'PDF';
  return 'Document';
}

export const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
