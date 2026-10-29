import { useEffect, useRef, useState } from 'react';
import type { Item } from './db';
import { phone } from './phone';
import { download, formatSize, hostOf, linkKind, platformOf, youtubeThumb } from './util';

/** Loads a stored file from the phone (or this browser's cache) once `enabled`. */
function useBlobUrl(id: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let objectUrl: string | null = null;
    let alive = true;
    phone.getBlob(id, (done, total) => alive && setProgress(Math.round((done / total) * 100)))
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setProgress(null));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled]);
  return { url, progress, error };
}

/** True once the element has been on screen (photos load only when you scroll to them). */
function useSeen<T extends Element>() {
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

interface Props {
  item: Item;
  folderLabel?: string;
  onEdit: () => void;
}

export function Card({ item, folderLabel, onEdit }: Props) {
  const kind = item.type === 'file' ? (item.mime ?? '').split('/')[0] : '';
  const isPhoto = kind === 'image';
  const isPlayable = kind === 'video' || kind === 'audio';
  const [ref, seen] = useSeen<HTMLElement>();
  const [play, setPlay] = useState(false);
  const blob = useBlobUrl(item.id, (isPhoto && seen) || (isPlayable && play));

  const openFile = async () => {
    try {
      const b = await phone.getBlob(item.id);
      if (/pdf|^text\//.test(item.mime ?? '')) window.open(URL.createObjectURL(b), '_blank');
      else download(b, item.fileName ?? item.title);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <article ref={ref} className={`card card-${item.type}`}>
      {item.type === 'link' && item.url && <LinkBody url={item.url} title={item.title} text={item.text} />}

      {item.type === 'note' && (
        <div className="card-body">
          <span className="chip">Note</span>
          <h3>{item.title}</h3>
          {item.text && <p className="note-text">{item.text}</p>}
        </div>
      )}

      {item.type === 'file' && (
        <>
          {isPhoto && (blob.url ? <img className="thumb" src={blob.url} alt={item.title} /> : <div className="thumb placeholder">{blob.error ?? (blob.progress !== null ? `${blob.progress} %` : '')}</div>)}
          {kind === 'video' && (blob.url ? <video className="thumb" src={blob.url} controls autoPlay /> : (
            <button className="thumb placeholder play" onClick={() => setPlay(true)} disabled={play && !blob.error}>
              {blob.error ?? (play ? `Chargement depuis le téléphone… ${blob.progress ?? 0} %` : `▶ Lire la vidéo (${formatSize(item.size)})`)}
            </button>
          ))}
          {kind === 'audio' && (blob.url ? <audio className="audio" src={blob.url} controls autoPlay /> : (
            <button className="btn-ghost small audio-load" onClick={() => setPlay(true)} disabled={play && !blob.error}>
              {blob.error ?? (play ? `Chargement… ${blob.progress ?? 0} %` : '▶ Écouter')}
            </button>
          ))}
          <div className="card-body">
            <span className="chip">{fileKind(item.mime)}</span>
            <h3>{item.title}</h3>
            <p className="meta">{formatSize(item.size)}</p>
            {!isPhoto && !isPlayable && <button className="btn-ghost small" onClick={openFile}>Ouvrir</button>}
          </div>
        </>
      )}

      <footer className="card-foot">
        <span className="meta">{folderLabel}</span>
        <button className="btn-ghost small" onClick={onEdit}>Modifier</button>
      </footer>
    </article>
  );
}

function LinkBody({ url, title, text }: { url: string; title: string; text?: string }) {
  const platform = platformOf(url);
  const kind = linkKind(url);
  const thumb = youtubeThumb(url);
  return (
    <>
      {thumb && (
        <a href={url} target="_blank" rel="noreferrer">
          <img className="thumb" src={thumb} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
        </a>
      )}
      <div className="card-body">
        <span className="chip" style={platform ? { background: platform.color + '26', color: platform.color } : undefined}>
          {platform?.name ?? 'Lien'}{kind ? ` · ${kind}` : ''}
        </span>
        <h3>
          <a href={url} target="_blank" rel="noreferrer">{title}</a>
        </h3>
        {text && <p className="note-text">{text}</p>}
        <p className="meta">
          <img src={`https://icons.duckduckgo.com/ip3/${hostOf(url)}.ico`} alt="" width={14} height={14} loading="lazy" onError={(e) => e.currentTarget.remove()} />
          {hostOf(url)}
        </p>
      </div>
    </>
  );
}

function fileKind(mime = ''): string {
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Vidéo';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.includes('pdf')) return 'PDF';
  return 'Document';
}
