import { useEffect, useState } from 'react';
import type { Folder, Item } from './db';
import { ACCENTS, Icon, ICON_CHOICES, ICONS, parseIcon, type AccentName, type IconName } from './icons';
import { fileKind, kindOf, useBlobUrl } from './ItemRow';
import { phone } from './phone';
import { download, formatSize, hostOf, normalizeUrl, platformOf } from './util';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Detail of one element: preview, edit, move, download, delete. */
export function ItemDialog(p: {
  item: Item; folders: Folder[]; folderLabel: (id: string) => string;
  onClose: () => void; onSave: (i: Item) => void; onDelete: (i: Item) => void;
}) {
  const [it, setIt] = useState<Item>(p.item);
  const set = (patch: Partial<Item>) => setIt((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(it) !== JSON.stringify(p.item);
  const kind = kindOf(p.item);
  const [play, setPlay] = useState(kind === 'photo');
  const blob = useBlobUrl(p.item.id, play);
  const [error, setError] = useState('');
  const platform = p.item.url ? platformOf(p.item.url) : null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = it.type === 'link' ? normalizeUrl(it.url ?? '') : undefined;
    if (it.type === 'link' && !url) return setError('Lien invalide');
    p.onSave({ ...it, ...(url ? { url } : {}) });
  };

  const fetchFile = async (open: boolean) => {
    try {
      const b = await phone.getBlob(p.item.id);
      if (open) window.open(URL.createObjectURL(b), '_blank');
      else download(b, p.item.fileName ?? p.item.title);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const loading = play && !blob.url && !blob.error;
  return (
    <Modal title={p.item.type === 'link' ? 'Lien' : p.item.type === 'note' ? 'Note' : fileKind(p.item.mime)} onClose={p.onClose} wide={kind === 'photo' || kind === 'video'}>
      <form className="form" onSubmit={save}>
        {p.item.type === 'file' && (kind === 'photo' || kind === 'video' || kind === 'audio') && (
          <div className={`preview ${kind}`}>
            {blob.url ? (
              kind === 'photo' ? <img src={blob.url} alt={p.item.title} />
              : kind === 'video' ? <video src={blob.url} controls autoPlay />
              : <audio src={blob.url} controls autoPlay />
            ) : (
              <button type="button" className="preview-load" onClick={() => setPlay(true)} disabled={loading}>
                {blob.error ? blob.error : loading ? `Chargement depuis le téléphone… ${blob.progress ?? 0} %`
                  : <><Icon name="play" size={18} /> {kind === 'video' ? 'Lire la vidéo' : 'Écouter'} · {formatSize(p.item.size)}</>}
              </button>
            )}
          </div>
        )}
        {p.item.type === 'file' && <p className="muted">{fileKind(p.item.mime)} · {formatSize(p.item.size)} · {p.item.fileName}</p>}
        {p.item.type === 'link' && p.item.url && (
          <a className="btn primary" href={p.item.url} target="_blank" rel="noreferrer">
            <Icon name="external-link" size={17} /> Ouvrir dans {platform?.name ?? hostOf(p.item.url)}
          </a>
        )}

        <label>Titre<input value={it.title} onChange={(e) => set({ title: e.target.value })} /></label>
        {it.type === 'link' && <label>Lien<input value={it.url ?? ''} onChange={(e) => { set({ url: e.target.value }); setError(''); }} /></label>}
        {it.type !== 'file' && (
          <label>{it.type === 'note' ? 'Texte' : 'Notes'}
            <textarea rows={it.type === 'note' ? 8 : 3} value={it.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          </label>
        )}
        <label>Dossier
          <select value={it.folderId} onChange={(e) => set({ folderId: e.target.value })}>
            {p.folders.map((f) => <option key={f.id} value={f.id}>{p.folderLabel(f.id)}</option>)}
          </select>
        </label>
        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost danger" onClick={() => confirm('Supprimer cet élément ? Il sera supprimé de ton téléphone.') && p.onDelete(p.item)}>
            <Icon name="trash" size={17} /> Supprimer
          </button>
          <span className="grow" />
          {p.item.type === 'file' && (kind === 'doc' && /pdf|^text\//.test(p.item.mime ?? '')) && (
            <button type="button" className="ghost" onClick={() => fetchFile(true)}><Icon name="external-link" size={17} /> Ouvrir</button>
          )}
          {p.item.type === 'file' && <button type="button" className="ghost" onClick={() => fetchFile(false)}><Icon name="download" size={17} /> Télécharger</button>}
          {dirty && <button className="btn primary">Enregistrer</button>}
        </div>
      </form>
    </Modal>
  );
}

/** Icon + color of a folder, same choices as the app. */
export function FolderIconDialog({ folder, onClose, onSave }: { folder: Folder; onClose: () => void; onSave: (icon: string) => void }) {
  const start = parseIcon(folder.icon);
  const [name, setName] = useState<IconName>(start.name);
  const [accent, setAccent] = useState<AccentName>(start.accent);
  const color = ACCENTS[accent];
  return (
    <Modal title={`Icône de « ${folder.name} »`} onClose={onClose}>
      <div className="form">
        <div className="accents">
          {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
            <button key={a} className={`accent${a === accent ? ' on' : ''}`} style={{ background: ACCENTS[a] }} onClick={() => setAccent(a)} aria-label={a} />
          ))}
        </div>
        <div className="icon-grid">
          {ICON_CHOICES.filter((n) => n in ICONS).map((n) => (
            <button key={n} className={`icon-choice${n === name ? ' on' : ''}`} onClick={() => setName(n)}
              style={n === name ? { background: `${color}26`, color, borderColor: color } : undefined} aria-label={n}>
              <Icon name={n} size={20} />
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <span className="grow" />
          <button className="ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={() => onSave(`${name}:${accent}`)}>Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}
