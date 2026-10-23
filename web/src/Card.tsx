import { useEffect, useState } from 'react';
import { getBlob, type Item } from './db';
import { download, formatDue, formatSize, hostOf, linkKind, platformOf, youtubeThumb } from './util';

function useBlobUrl(id: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let objectUrl: string | null = null;
    let alive = true;
    getBlob(id).then((b) => {
      if (!b || !alive) return;
      objectUrl = URL.createObjectURL(b);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled]);
  return url;
}

interface Props {
  item: Item;
  folderLabel?: string;
  onEdit: () => void;
  onToggle: () => void;
}

export function Card({ item, folderLabel, onEdit, onToggle }: Props) {
  const isMedia = item.type === 'file' && /^(image|video|audio)\//.test(item.mime ?? '');
  const blobUrl = useBlobUrl(item.id, isMedia);
  const overdue = item.type === 'task' && !item.done && item.dueAt !== undefined && item.dueAt < Date.now();

  const openFile = async () => {
    const b = await getBlob(item.id);
    if (!b) return;
    if (/pdf|^text\//.test(item.mime ?? '')) window.open(URL.createObjectURL(b), '_blank');
    else download(b, item.fileName ?? item.title);
  };

  return (
    <article className={`card card-${item.type}${item.done ? ' is-done' : ''}`}>
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
          {blobUrl && item.mime?.startsWith('image/') && <img className="thumb" src={blobUrl} alt={item.title} />}
          {blobUrl && item.mime?.startsWith('video/') && <video className="thumb" src={blobUrl} controls preload="metadata" />}
          {blobUrl && item.mime?.startsWith('audio/') && <audio className="audio" src={blobUrl} controls />}
          <div className="card-body">
            <span className="chip">{fileKind(item.mime)}</span>
            <h3>{item.title}</h3>
            <p className="meta">{formatSize(item.size)}</p>
            {!isMedia && <button className="btn-ghost small" onClick={openFile}>Ouvrir</button>}
          </div>
        </>
      )}

      {item.type === 'task' && (
        <div className="card-body task-row">
          <input type="checkbox" checked={!!item.done} onChange={onToggle} aria-label="Terminée" />
          <div>
            <h3>{item.title}</h3>
            {item.text && <p className="meta">{item.text}</p>}
            {item.dueAt && (
              <p className={`due${overdue ? ' overdue' : ''}`}>⏰ {formatDue(item.dueAt)}{overdue ? ' · en retard' : ''}</p>
            )}
          </div>
        </div>
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
