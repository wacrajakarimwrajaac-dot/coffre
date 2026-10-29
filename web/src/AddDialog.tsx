import { useRef, useState } from 'react';
import { uid, type Folder, type Item } from './db';
import { Icon } from './icons';
import { Modal } from './ItemDialog';
import { Recorder } from './Recorder';
import { hostOf, normalizeUrl } from './util';

export type AddKind = 'link' | 'note' | 'voice' | 'file';
const TITLES: Record<AddKind, string> = { link: 'Nouveau lien', note: 'Nouvelle note', voice: 'Nouveau vocal', file: 'Ajouter des fichiers' };

/** Adds a link, a note, a voice note or files; everything is saved on the phone. */
export function AddDialog(p: {
  kind: AddKind; folders: Folder[]; folderLabel: (id: string) => string; defaultFolder: string;
  onClose: () => void; onSave: (item: Item) => void; onFiles: (files: File[], folderId: string) => void;
}) {
  const [folderId, setFolderId] = useState(p.defaultFolder);
  const [main, setMain] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = { id: uid(), folderId, createdAt: Date.now() };
    if (p.kind === 'link') {
      const url = normalizeUrl(main);
      if (!url) return setError('Colle une adresse valide, par exemple https://www.instagram.com/reel/…');
      p.onSave({ ...base, type: 'link', url, title: extra.trim() || hostOf(url) });
    } else if (p.kind === 'note') {
      if (!main.trim() && !extra.trim()) return setError('Écris un titre ou un texte.');
      p.onSave({ ...base, type: 'note', title: main.trim() || extra.trim().split('\n')[0].slice(0, 60), text: extra.trim() });
    }
  };

  return (
    <Modal title={TITLES[p.kind]} onClose={p.onClose}>
      <form className="form" onSubmit={submit}>
        <label>Dossier
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            {p.folders.map((f) => <option key={f.id} value={f.id}>{p.folderLabel(f.id)}</option>)}
          </select>
        </label>
        {p.kind === 'link' && (
          <>
            <label>Lien<input autoFocus placeholder="Reel Instagram, vidéo Facebook, YouTube, article…" value={main}
              onChange={(e) => { setMain(e.target.value); setError(''); }} /></label>
            <label>Titre (optionnel)<input value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
          </>
        )}
        {p.kind === 'note' && (
          <>
            <label>Titre<input autoFocus value={main} onChange={(e) => { setMain(e.target.value); setError(''); }} /></label>
            <label>Texte<textarea rows={7} placeholder="Écris ton idée…" value={extra} onChange={(e) => { setExtra(e.target.value); setError(''); }} /></label>
          </>
        )}
        {p.kind === 'voice' && <Recorder onSave={(f) => p.onFiles([f], folderId)} />}
        {p.kind === 'file' && (
          <>
            <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={26} />
              <span>Choisir des photos, vidéos ou documents</span>
              <span className="muted small">ou glisse-les directement dans la page</span>
            </button>
            <input ref={fileRef} type="file" multiple hidden
              onChange={(e) => { if (e.target.files?.length) p.onFiles(Array.from(e.target.files), folderId); e.target.value = ''; }} />
          </>
        )}
        {error && <p className="error">{error}</p>}
        {(p.kind === 'link' || p.kind === 'note') && (
          <div className="modal-actions"><span className="grow" /><button type="button" className="ghost" onClick={p.onClose}>Annuler</button><button className="btn primary">Ajouter</button></div>
        )}
      </form>
    </Modal>
  );
}
