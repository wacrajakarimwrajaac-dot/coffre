import { useEffect, useRef, useState } from 'react';
import type { Item } from './db';
import { Icon, type IconName } from './icons';
import { phone } from './phone';
import { formatSize, hostOf, linkKind, platformOf, youtubeThumb } from './util';

export type Kind = 'photo' | 'video' | 'audio' | 'doc' | 'link' | 'note';

export function kindOf(i: Item): Kind {
  if (i.type !== 'file') return i.type;
  const m = i.mime ?? '';
  return m.startsWith('image/') ? 'photo' : m.startsWith('video/') ? 'video' : m.startsWith('audio/') ? 'audio' : 'doc';
}

export function fileKind(mime = ''): string {
  if (mime.startsWith('image/')) return 'Photo';
  if (mime.startsWith('video/')) return 'Vidéo';
  if (mime.startsWith('audio/')) return 'Vocal';
  if (mime.includes('pdf')) return 'PDF';
  return 'Document';
}

/** Object URL of a stored file, fetched from the phone (or this browser's cache) once `enabled`. */
export function useBlobUrl(id: string, enabled: boolean) {
  const [state, setState] = useState<{ url: string | null; progress: number | null; error: string | null }>({ url: null, progress: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let objectUrl: string | null = null;
    let alive = true;
    phone.getBlob(id, (done, total) => alive && setState((s) => ({ ...s, progress: Math.round((done / total) * 100) })))
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setState({ url: objectUrl, progress: null, error: null });
      })
      .catch((e: Error) => alive && setState({ url: null, progress: null, error: e.message }));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled]);
  return state;
}

/** True once the element has come near the screen (photos load only when you scroll to them). */
export function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/** Flat row with a hairline underneath, like the app. */
export function ItemRow({ item, folderLabel, onOpen }: { item: Item; folderLabel?: string; onOpen: () => void }) {
  const kind = kindOf(item);
  const [ref, seen] = useSeen<HTMLDivElement>();
  const photo = useBlobUrl(item.id, kind === 'photo' && seen);

  let icon: IconName = 'file-text';
  let tint = 'var(--muted)';
  let subtitle = '';
  let image: string | null = null;
  if (item.type === 'link' && item.url) {
    const p = platformOf(item.url);
    const k = linkKind(item.url);
    icon = 'link';
    tint = p?.color ?? 'var(--primary)';
    image = youtubeThumb(item.url);
    subtitle = `${p?.name ?? 'Lien'}${k ? ` · ${k}` : ''} · ${hostOf(item.url)}`;
  } else if (item.type === 'note') {
    tint = 'var(--warn)';
    subtitle = (item.text ?? '').replace(/\s+/g, ' ').trim() || 'Note';
  } else {
    icon = kind === 'audio' ? 'mic' : kind === 'video' ? 'video' : kind === 'photo' ? 'image' : 'file';
    tint = kind === 'audio' ? 'var(--primary)' : kind === 'doc' ? 'var(--muted)' : 'var(--ok)';
    image = photo.url;
    subtitle = `${fileKind(item.mime)} · ${formatSize(item.size)}`;
  }

  return (
    <div ref={ref} className="row" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}>
      <span className="row-thumb" style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}>
        <Icon name={icon} size={20} />
        {image && <img src={image} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />}
      </span>
      <span className="row-text">
        <span className="row-title ellipsis">{item.title || hostOf(item.url ?? '') || 'Sans titre'}</span>
        <span className="muted ellipsis">{subtitle}</span>
        {folderLabel && <span className="muted small ellipsis">{folderLabel}</span>}
      </span>
      {item.type === 'link' && item.url && (
        <a className="icon-btn" href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Ouvrir le lien" aria-label="Ouvrir le lien">
          <Icon name="external-link" size={17} />
        </a>
      )}
    </div>
  );
}

/** Square tile of the media grid: photos load when visible, videos show a play badge. */
export function MediaTile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const photo = kindOf(item) === 'photo';
  const [ref, seen] = useSeen<HTMLButtonElement>();
  const blob = useBlobUrl(item.id, photo && seen);
  return (
    <button ref={ref} className="media-tile" onClick={onOpen} title={item.title}>
      {photo ? (
        blob.url ? <img src={blob.url} alt={item.title} /> : <span className="muted small">{blob.error ? '!' : blob.progress !== null ? `${blob.progress} %` : ''}</span>
      ) : (
        <>
          <span className="play"><Icon name="play" size={18} /></span>
          <span className="media-size">{formatSize(item.size)}</span>
        </>
      )}
    </button>
  );
}
