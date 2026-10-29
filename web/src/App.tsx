import { useCallback, useMemo, useRef, useState } from 'react';
import { Card } from './Card';
import { Recorder } from './Recorder';
import { parseBookmarks, uid, type Folder, type Item, type ItemType } from './db';
import { phone, usePhone, type PhoneState } from './phone';
import { formatSize, hostOf, normalizeUrl } from './util';

type View = { kind: 'all' } | { kind: 'folder'; id: string };
type Mode = 'link' | 'note' | 'voice' | 'file';

const TYPE_LABELS: Record<ItemType, string> = { link: 'Liens', note: 'Notes', file: 'Fichiers' };
// Folders made in the mobile app use icons like "plane:blue"; the website shows a plain folder for those.
const glyph = (i: string) => (/^[a-z0-9-]+:[a-z]+$/.test(i) ? '📁' : i);

export default function App() {
  const st = usePhone();
  const folders = useMemo(() => [...st.folders].sort((a, b) => a.createdAt - b.createdAt), [st.folders]);
  const items = useMemo(() => [...st.items].sort((a, b) => b.createdAt - a.createdAt), [st.items]);
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const toast = useCallback((text: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const childrenOf = useCallback((id: string | null) => folders.filter((f) => f.parentId === id), [folders]);
  const descendants = useCallback(
    (id: string): string[] => [id, ...childrenOf(id).flatMap((c) => descendants(c.id))],
    [childrenOf],
  );

  const currentFolder = view.kind === 'folder' ? folderById.get(view.id) : undefined;
  const targetFolderId = currentFolder?.id ?? folders[0]?.id;

  const visible = useMemo(() => {
    let list = items;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => [i.title, i.text, i.url, i.fileName].some((s) => s?.toLowerCase().includes(q)));
    } else if (view.kind === 'folder') {
      list = list.filter((i) => i.folderId === view.id);
    }
    return typeFilter ? list.filter((i) => i.type === typeFilter) : list;
  }, [items, query, view, typeFilter]);

  const countIn = (id: string) => items.filter((i) => i.folderId === id).length;

  const pathOf = (id: string): Folder[] => {
    const f = folderById.get(id);
    return f ? [...(f.parentId ? pathOf(f.parentId) : []), f] : [];
  };
  const folderLabel = (id: string) => pathOf(id).map((f) => f.name).join(' / ');

  // ---- Actions (applied on the phone, which then sends back its updated library) ----
  const attempt = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  }, [toast]);

  const addItem = (partial: Omit<Item, 'id' | 'createdAt' | 'folderId'>, folderId = targetFolderId) => {
    if (!folderId) return;
    void attempt(() => phone.saveItem({ id: uid(), createdAt: Date.now(), folderId, ...partial } as Item));
  };

  const [sending, setSending] = useState<string | null>(null);
  const addFiles = async (files: FileList | File[], folderId = targetFolderId) => {
    if (!folderId) return;
    const list = Array.from(files); // the input's live FileList is cleared right after
    let added = 0;
    for (const [n, file] of list.entries()) {
      const item: Item = {
        id: uid(), folderId, type: 'file', title: file.name.replace(/\.[^.]+$/, '') || file.name, fileName: file.name,
        mime: file.type || 'application/octet-stream', size: file.size, createdAt: Date.now(),
      };
      const label = list.length > 1 ? `${n + 1}/${list.length} · ${file.name}` : file.name;
      setSending(`Envoi vers le téléphone : ${label}`);
      const ok = await attempt(() => phone.upload(file, item, (done, total) =>
        setSending(`Envoi vers le téléphone : ${label} · ${Math.round((done / total) * 100)} %`)));
      if (ok) added++;
    }
    setSending(null);
    if (added) toast(`${added} fichier(s) ajouté(s) sur ton téléphone`);
  };

  const createFolder = async (parentId: string | null) => {
    const name = prompt(parentId ? 'Nom du sous-dossier' : 'Nom du dossier (sujet)');
    if (!name?.trim()) return;
    const f: Folder = { id: uid(), name: name.trim(), parentId, icon: 'folder:violet', createdAt: Date.now() };
    if (await attempt(() => phone.saveFolder(f))) setView({ kind: 'folder', id: f.id });
    setMenuOpen(false);
  };

  const renameFolder = (f: Folder) => {
    const name = prompt('Nouveau nom', f.name);
    if (name?.trim()) void attempt(() => phone.saveFolder({ ...f, name: name.trim() }));
  };

  const deleteFolder = async (f: Folder) => {
    const ids = descendants(f.id);
    const n = items.filter((i) => ids.includes(i.folderId)).length;
    if (!confirm(`Supprimer « ${f.name} », ses sous-dossiers et ${n} élément(s) ? Ils seront supprimés de ton téléphone.`)) return;
    if (await attempt(() => phone.deleteFolder(f.id))) setView({ kind: 'all' });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) return void addFiles(e.dataTransfer.files);
    const url = normalizeUrl(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
    if (url) addItem({ type: 'link', url, title: hostOf(url) });
  };

  const title =
    query.trim() ? `Résultats pour « ${query.trim()} »`
    : currentFolder ? `${glyph(currentFolder.icon)} ${currentFolder.name}`
    : 'Tout';

  return (
    <div className="app">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} /> Coffre
        </div>
        <nav>
          <NavRow active={view.kind === 'all' && !query} icon="🗂️" label="Tout" count={items.length}
            onClick={() => { setView({ kind: 'all' }); setQuery(''); setMenuOpen(false); }} />
        </nav>
        <div className="side-title">
          <span>Dossiers</span>
          <button className="icon-btn" onClick={() => createFolder(null)} title="Nouveau dossier">＋</button>
        </div>
        <FolderTree
          parentId={null} depth={0} childrenOf={childrenOf} countIn={countIn}
          activeId={view.kind === 'folder' && !query ? view.id : null}
          onSelect={(id) => { setView({ kind: 'folder', id }); setQuery(''); setMenuOpen(false); }}
        />
        <Tools st={st} toast={toast} targetFolder={currentFolder?.id ?? null} />
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main
        className={`main${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}
      >
        {st.status === 'offline' && (
          <div className="banner">Ton téléphone est hors ligne. Ouvre Coffre sur ton téléphone (avec internet) pour voir et modifier ton Coffre.</div>
        )}
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
          <input className="search" type="search" placeholder="Rechercher partout…" value={query}
            onChange={(e) => setQuery(e.target.value)} />
        </header>

        {currentFolder && !query && (
          <div className="crumbs">
            {pathOf(currentFolder.id).map((f, idx, arr) => (
              <span key={f.id}>
                <button className="link-btn" onClick={() => setView({ kind: 'folder', id: f.id })}>{f.name}</button>
                {idx < arr.length - 1 && ' / '}
              </span>
            ))}
          </div>
        )}

        <div className="head">
          <h1>{title}</h1>
          {currentFolder && !query && (
            <div className="head-actions">
              <button className="btn-ghost" onClick={() => createFolder(currentFolder.id)}>＋ Sous-dossier</button>
              <button className="btn-ghost" onClick={() => renameFolder(currentFolder)}>Renommer</button>
              <button className="btn-ghost danger" onClick={() => deleteFolder(currentFolder)}>Supprimer</button>
            </div>
          )}
        </div>

        {currentFolder && !query && childrenOf(currentFolder.id).length > 0 && (
          <div className="subfolders">
            {childrenOf(currentFolder.id).map((f) => (
              <button key={f.id} className="subfolder" onClick={() => setView({ kind: 'folder', id: f.id })}>
                <span>{glyph(f.icon)}</span> {f.name} <span className="meta">{countIn(f.id)}</span>
              </button>
            ))}
          </div>
        )}

        {!query && (
          <Composer
            defaultMode="link"
            folderName={currentFolder ? currentFolder.name : folderById.get(targetFolderId ?? '')?.name ?? ''}
            onAdd={(p) => addItem(p)}
            onFiles={(f) => addFiles(f)}
          />
        )}

        <div className="filters">
          {[null, 'link', 'note', 'file'].map((t) => (
            <button key={t ?? 'all'} className={`filter${typeFilter === t ? ' on' : ''}`}
              onClick={() => setTypeFilter(t as ItemType | null)}>
              {t ? TYPE_LABELS[t as ItemType] : 'Tous'}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <p>Rien ici pour l'instant.</p>
            <p className="meta">Colle un lien, écris une note ou glisse des fichiers dans cette page : ils sont enregistrés sur ton téléphone.</p>
          </div>
        ) : (
          <div className="grid">
            {visible.map((i) => (
              <Card key={i.id} item={i}
                folderLabel={view.kind === 'folder' && !query ? undefined : folderLabel(i.folderId)}
                onEdit={() => setEditing(i)} />
            ))}
          </div>
        )}
        {dragging && <div className="drop-hint">Dépose ici pour ajouter à « {folderById.get(targetFolderId ?? '')?.name} »</div>}
      </main>

      {editing && (
        <EditDialog item={editing} folders={folders} folderLabel={folderLabel}
          onClose={() => setEditing(null)}
          onSave={async (it) => { if (await attempt(() => phone.saveItem(it))) setEditing(null); }}
          onDelete={async (it) => { if (await attempt(() => phone.deleteItem(it.id))) setEditing(null); }} />
      )}

      <div className="toasts">
        {sending && <div className="toast">{sending}</div>}
        {toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </div>
  );
}

function NavRow(p: { active: boolean; icon: string; label: string; count: number; onClick: () => void }) {
  return (
    <button className={`nav-row${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <span>{p.icon}</span><span className="grow">{p.label}</span><span className="meta">{p.count || ''}</span>
    </button>
  );
}

function FolderTree(p: {
  parentId: string | null; depth: number; activeId: string | null;
  childrenOf: (id: string | null) => Folder[]; countIn: (id: string) => number; onSelect: (id: string) => void;
}) {
  return (
    <>
      {p.childrenOf(p.parentId).map((f) => (
        <div key={f.id}>
          <button className={`nav-row${p.activeId === f.id ? ' active' : ''}`} style={{ paddingLeft: 12 + p.depth * 16 }}
            onClick={() => p.onSelect(f.id)}>
            <span>{glyph(f.icon)}</span><span className="grow">{f.name}</span><span className="meta">{p.countIn(f.id) || ''}</span>
          </button>
          <FolderTree {...p} parentId={f.id} depth={p.depth + 1} />
        </div>
      ))}
    </>
  );
}

function Composer(p: {
  defaultMode: Mode; folderName: string;
  onAdd: (item: Omit<Item, 'id' | 'createdAt' | 'folderId'>) => void; onFiles: (f: FileList | File[]) => void;
}) {
  const [mode, setMode] = useState<Mode>(p.defaultMode);
  const [main, setMain] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setMain(''); setExtra(''); setError(''); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'link') {
      const url = normalizeUrl(main);
      if (!url) return setError('Lien invalide');
      p.onAdd({ type: 'link', url, title: extra.trim() || hostOf(url) });
    } else if (mode === 'note') {
      if (!main.trim() && !extra.trim()) return;
      p.onAdd({ type: 'note', title: main.trim() || extra.trim().split('\n')[0].slice(0, 60), text: extra.trim() });
    }
    reset();
  };

  const tabs: [Mode, string][] = [
    ['link', 'Lien'], ['note', 'Note'], ['voice', 'Vocal'], ['file', 'Fichier'],
  ];

  return (
    <form className="composer" onSubmit={submit}>
      <div className="tabs">
        {tabs.map(([m, label]) => (
          <button type="button" key={m} className={`tab${mode === m ? ' on' : ''}`} onClick={() => { setMode(m); setError(''); }}>
            {label}
          </button>
        ))}
        <span className="meta into">→ {p.folderName}</span>
      </div>

      {mode === 'link' && (
        <div className="fields">
          <input autoFocus placeholder="Colle un lien : reel Instagram, vidéo Facebook, YouTube, article…" value={main}
            onChange={(e) => { setMain(e.target.value); setError(''); }} />
          <input placeholder="Titre (optionnel)" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
      )}
      {mode === 'note' && (
        <div className="fields col">
          <input placeholder="Titre" value={main} onChange={(e) => setMain(e.target.value)} />
          <textarea placeholder="Écris ton idée…" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
      )}
      {mode === 'voice' && <Recorder onSave={(f) => p.onFiles([f])} />}
      {mode === 'file' && (
        <div className="fields">
          <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
            Choisir des documents, images ou vidéos — ou glisse-les dans la page
          </button>
          <input ref={fileRef} type="file" multiple hidden
            onChange={(e) => { if (e.target.files?.length) p.onFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {mode !== 'file' && mode !== 'voice' && (
        <div className="composer-foot">
          {error && <span className="error">{error}</span>}
          <button className="btn-primary" type="submit">Ajouter</button>
        </div>
      )}
    </form>
  );
}

function EditDialog(p: {
  item: Item; folders: Folder[]; folderLabel: (id: string) => string;
  onClose: () => void; onSave: (i: Item) => void; onDelete: (i: Item) => void;
}) {
  const [it, setIt] = useState<Item>(p.item);
  const set = (patch: Partial<Item>) => setIt((x) => ({ ...x, ...patch }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = it.type === 'link' ? normalizeUrl(it.url ?? '') : undefined;
    if (it.type === 'link' && !url) return;
    p.onSave({ ...it, ...(url ? { url } : {}) });
  };

  return (
    <div className="modal-bg" onClick={p.onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Modifier</h2>
        <label>Titre<input value={it.title} onChange={(e) => set({ title: e.target.value })} /></label>
        {it.type === 'link' && <label>Lien<input value={it.url} onChange={(e) => set({ url: e.target.value })} /></label>}
        {it.type !== 'file' && (
          <label>{it.type === 'note' ? 'Texte' : 'Notes'}
            <textarea rows={it.type === 'note' ? 6 : 3} value={it.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          </label>
        )}
        <label>Dossier
          <select value={it.folderId} onChange={(e) => set({ folderId: e.target.value })}>
            {p.folders.map((f) => <option key={f.id} value={f.id}>{p.folderLabel(f.id)}</option>)}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-ghost danger"
            onClick={() => confirm('Supprimer cet élément ?') && p.onDelete(it)}>Supprimer</button>
          <span className="grow" />
          <button type="button" className="btn-ghost" onClick={p.onClose}>Annuler</button>
          <button className="btn-primary" type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

function Tools(p: { st: PhoneState; toast: (t: string) => void; targetFolder: string | null }) {
  const bookmarksRef = useRef<HTMLInputElement>(null);
  const { usage } = p.st;

  return (
    <div className="tools">
      <button className="btn-ghost small" onClick={() => bookmarksRef.current?.click()}>Importer les favoris du navigateur</button>
      <div className="usage">
        <div className="usage-head">
          <span>📱 {p.st.phone || 'Téléphone'}</span>
          <span className={`dot ${p.st.status === 'online' ? 'on' : ''}`} title={p.st.status === 'online' ? 'Connecté' : 'Hors ligne'} />
        </div>
        {usage && (
          <span className="meta">{formatSize(usage.usedBytes)} dans Coffre{usage.totalBytes ? ` · ${formatSize(usage.freeBytes)} libres` : ''}</span>
        )}
        <span className="meta">Tes données restent sur ton téléphone. Chiffré de bout en bout.</span>
      </div>
      <button className="btn-ghost small danger" onClick={() => {
        if (confirm('Déconnecter ce navigateur ? Ton Coffre reste sur ton téléphone ; tu pourras te reconnecter en scannant un QR code.')) void phone.forget();
      }}>Déconnecter ce navigateur</button>
      <input ref={bookmarksRef} type="file" accept=".html,.htm" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          const { folders, items } = await parseBookmarks(f, p.targetFolder);
          await phone.saveMany(folders, items);
          p.toast(`${items.length} favori(s) importé(s)`);
        } catch (err) {
          p.toast((err as Error).message);
        }
      }} />
    </div>
  );
}
