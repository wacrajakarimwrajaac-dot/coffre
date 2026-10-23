import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackupDialog, useAutoBackup } from './Backup';
import { Card } from './Card';
import {
  exportBackup, getAll, importBackup, importBookmarks, put, putBlob, remove, subscribe, uid,
  type Folder, type Item, type ItemType,
} from './db';
import { supabase } from './supabase';
import { beep, download, formatDue, hostOf, normalizeUrl, toLocalInput } from './util';

type View = { kind: 'all' } | { kind: 'tasks' } | { kind: 'folder'; id: string };
type Mode = 'link' | 'note' | 'task' | 'file';

const TYPE_LABELS: Record<ItemType, string> = { link: 'Liens', note: 'Notes', file: 'Fichiers', task: 'Tâches' };
const ICONS = ['📁', '💡', '📚', '🎬', '🎵', '💼', '🏋️', '🍳', '✈️', '🏠', '💻', '🎨', '🛒', '❤️'];

export default function App({ email }: { email?: string }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reload = useCallback(async () => {
    let fs = await getAll<Folder>('folders');
    if (fs.length === 0) {
      const inbox: Folder = { id: uid(), name: 'Boîte de réception', parentId: null, icon: '📥', createdAt: Date.now() };
      await put('folders', inbox);
      fs = [inbox];
    }
    setFolders(fs.sort((a, b) => a.createdAt - b.createdAt));
    setItems((await getAll<Item>('items')).sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const toast = useCallback((text: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  useEffect(() => {
    reload().catch((e) => toast((e as Error).message));
    const unsubscribe = subscribe(() => void reload());
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [reload, toast]);

  useAutoBackup(toast);

  // ---- Reminders: checked while the page is open ----
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      const due = itemsRef.current.filter((i) => i.type === 'task' && !i.done && i.dueAt && i.dueAt <= now && !i.remindedAt);
      if (due.length === 0) return;
      for (const t of due) {
        await put('items', { ...t, remindedAt: now });
        toast(`⏰ ${t.title}`);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Rappel', { body: t.title });
        }
      }
      beep();
      reload();
    };
    tick();
    const h = setInterval(tick, 15000);
    return () => clearInterval(h);
  }, [reload, toast]);

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
    } else if (view.kind === 'tasks') {
      list = list
        .filter((i) => i.type === 'task')
        .sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
    }
    return typeFilter ? list.filter((i) => i.type === typeFilter) : list;
  }, [items, query, view, typeFilter]);

  const countIn = (id: string) => items.filter((i) => i.folderId === id).length;
  const pendingTasks = items.filter((i) => i.type === 'task' && !i.done).length;

  const pathOf = (id: string): Folder[] => {
    const f = folderById.get(id);
    return f ? [...(f.parentId ? pathOf(f.parentId) : []), f] : [];
  };
  const folderLabel = (id: string) => pathOf(id).map((f) => f.name).join(' / ');

  // ---- Actions ----
  const addItem = async (partial: Omit<Item, 'id' | 'createdAt' | 'folderId'>, folderId = targetFolderId) => {
    if (!folderId) return;
    await put('items', { id: uid(), createdAt: Date.now(), folderId, ...partial });
    await reload();
  };

  const addFiles = async (files: FileList | File[], folderId = targetFolderId) => {
    if (!folderId) return;
    const list = Array.from(files); // the input's live FileList is cleared right after
    for (const file of list) {
      const id = uid();
      await putBlob(id, file);
      await put('items', {
        id, folderId, type: 'file', title: file.name, fileName: file.name,
        mime: file.type, size: file.size, createdAt: Date.now(),
      });
    }
    toast(`${list.length} fichier(s) ajouté(s)`);
    await reload();
  };

  const createFolder = async (parentId: string | null) => {
    const name = prompt(parentId ? 'Nom du sous-dossier' : 'Nom du dossier (sujet)');
    if (!name?.trim()) return;
    const f: Folder = { id: uid(), name: name.trim(), parentId, icon: '📁', createdAt: Date.now() };
    await put('folders', f);
    await reload();
    setView({ kind: 'folder', id: f.id });
    setMenuOpen(false);
  };

  const renameFolder = async (f: Folder) => {
    const name = prompt('Nouveau nom', f.name);
    if (name?.trim()) {
      await put('folders', { ...f, name: name.trim() });
      reload();
    }
  };

  const deleteFolder = async (f: Folder) => {
    const ids = descendants(f.id);
    const n = items.filter((i) => ids.includes(i.folderId)).length;
    if (!confirm(`Supprimer « ${f.name} », ses sous-dossiers et ${n} élément(s) ?`)) return;
    for (const i of items.filter((i) => ids.includes(i.folderId))) {
      await remove('items', i.id);
      if (i.type === 'file') await remove('blobs', i.id);
    }
    for (const id of ids) await remove('folders', id);
    setView({ kind: 'all' });
    reload();
  };

  const toggleTask = async (i: Item) => {
    await put('items', { ...i, done: !i.done });
    reload();
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
    : view.kind === 'tasks' ? 'Tâches & rappels'
    : currentFolder ? `${currentFolder.icon} ${currentFolder.name}`
    : 'Tout';

  return (
    <div className="app">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="logo">◆</span> Coffre
        </div>
        <nav>
          <NavRow active={view.kind === 'all' && !query} icon="🗂️" label="Tout" count={items.length}
            onClick={() => { setView({ kind: 'all' }); setQuery(''); setMenuOpen(false); }} />
          <NavRow active={view.kind === 'tasks' && !query} icon="⏰" label="Tâches & rappels" count={pendingTasks}
            onClick={() => { setView({ kind: 'tasks' }); setQuery(''); setMenuOpen(false); }} />
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
        <Tools reload={reload} toast={toast} email={email} />
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main
        className={`main${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}
      >
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
              <IconPicker value={currentFolder.icon} onChange={async (icon) => { await put('folders', { ...currentFolder, icon }); reload(); }} />
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
                <span>{f.icon}</span> {f.name} <span className="meta">{countIn(f.id)}</span>
              </button>
            ))}
          </div>
        )}

        {!query && (
          <Composer
            defaultMode={view.kind === 'tasks' ? 'task' : 'link'}
            folderName={currentFolder ? currentFolder.name : folderById.get(targetFolderId ?? '')?.name ?? ''}
            onAdd={(p) => addItem(p)}
            onFiles={(f) => addFiles(f)}
          />
        )}

        <div className="filters">
          {[null, 'link', 'note', 'file', 'task'].map((t) => (
            <button key={t ?? 'all'} className={`filter${typeFilter === t ? ' on' : ''}`}
              onClick={() => setTypeFilter(t as ItemType | null)}>
              {t ? TYPE_LABELS[t as ItemType] : 'Tous'}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <p>Rien ici pour l'instant.</p>
            <p className="meta">Colle un lien, écris une note, ajoute une tâche ou glisse des fichiers dans cette page.</p>
          </div>
        ) : (
          <div className="grid">
            {visible.map((i) => (
              <Card key={i.id} item={i}
                folderLabel={view.kind === 'folder' && !query ? undefined : folderLabel(i.folderId)}
                onEdit={() => setEditing(i)} onToggle={() => toggleTask(i)} />
            ))}
          </div>
        )}
        {dragging && <div className="drop-hint">Dépose ici pour ajouter à « {folderById.get(targetFolderId ?? '')?.name} »</div>}
      </main>

      {editing && (
        <EditDialog item={editing} folders={folders} folderLabel={folderLabel}
          onClose={() => setEditing(null)}
          onSave={async (it) => { await put('items', it); setEditing(null); reload(); }}
          onDelete={async (it) => {
            await remove('items', it.id);
            if (it.type === 'file') await remove('blobs', it.id);
            setEditing(null);
            reload();
          }} />
      )}

      <div className="toasts">
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
            <span>{f.icon}</span><span className="grow">{f.name}</span><span className="meta">{p.countIn(f.id) || ''}</span>
          </button>
          <FolderTree {...p} parentId={f.id} depth={p.depth + 1} />
        </div>
      ))}
    </>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="icon-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Icône">
      {[...new Set([value, ...ICONS])].map((i) => <option key={i} value={i}>{i}</option>)}
    </select>
  );
}

function Composer(p: {
  defaultMode: Mode; folderName: string;
  onAdd: (item: Omit<Item, 'id' | 'createdAt' | 'folderId'>) => void; onFiles: (f: FileList) => void;
}) {
  const [mode, setMode] = useState<Mode>(p.defaultMode);
  const [main, setMain] = useState('');
  const [extra, setExtra] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMode(p.defaultMode), [p.defaultMode]);

  const reset = () => { setMain(''); setExtra(''); setDue(''); setError(''); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'link') {
      const url = normalizeUrl(main);
      if (!url) return setError('Lien invalide');
      p.onAdd({ type: 'link', url, title: extra.trim() || hostOf(url) });
    } else if (mode === 'note') {
      if (!main.trim() && !extra.trim()) return;
      p.onAdd({ type: 'note', title: main.trim() || extra.trim().split('\n')[0].slice(0, 60), text: extra.trim() });
    } else if (mode === 'task') {
      if (!main.trim()) return;
      p.onAdd({ type: 'task', title: main.trim(), done: false, dueAt: due ? new Date(due).getTime() : undefined });
    }
    reset();
  };

  const tabs: [Mode, string][] = [['link', '🔗 Lien'], ['note', '📝 Note'], ['task', '⏰ Tâche'], ['file', '📎 Fichier']];

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
      {mode === 'task' && (
        <div className="fields">
          <input placeholder="Que faut-il faire ?" value={main} onChange={(e) => setMain(e.target.value)} />
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Rappel" />
        </div>
      )}
      {mode === 'file' && (
        <div className="fields">
          <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
            Choisir des documents, images ou vidéos — ou glisse-les dans la page
          </button>
          <input ref={fileRef} type="file" multiple hidden
            onChange={(e) => { if (e.target.files?.length) p.onFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {mode !== 'file' && (
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
    const dueChanged = it.dueAt !== p.item.dueAt;
    p.onSave({ ...it, ...(url ? { url } : {}), ...(dueChanged ? { remindedAt: undefined } : {}) });
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
        {it.type === 'task' && (
          <label>Rappel
            <input type="datetime-local" value={toLocalInput(it.dueAt)}
              onChange={(e) => set({ dueAt: e.target.value ? new Date(e.target.value).getTime() : undefined })} />
            {it.dueAt && <span className="meta">{formatDue(it.dueAt)}</span>}
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

function Tools(p: { reload: () => Promise<void>; toast: (t: string) => void; email?: string }) {
  const bookmarksRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [driveOpen, setDriveOpen] = useState(false);
  const [notif, setNotif] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  return (
    <div className="tools">
      {notif === 'default' && (
        <button className="btn-ghost small" onClick={async () => setNotif(await Notification.requestPermission())}>
          🔔 Activer les notifications
        </button>
      )}
      <button className="btn-ghost small" onClick={() => setDriveOpen(true)}>☁️ Sauvegarde Google Drive</button>
      <button className="btn-ghost small" onClick={() => bookmarksRef.current?.click()}>⭐ Importer les favoris du navigateur</button>
      <button className="btn-ghost small" onClick={async () => download(await exportBackup(), `coffre-${new Date().toISOString().slice(0, 10)}.json`)}>
        💾 Exporter un fichier de sauvegarde
      </button>
      <button className="btn-ghost small" onClick={() => backupRef.current?.click()}>↩︎ Restaurer un fichier de sauvegarde</button>
      {supabase ? (
        <>
          <p className="meta small-print">☁️ Synchronisé · {p.email}</p>
          <button className="btn-ghost small" onClick={() => supabase!.auth.signOut()}>Se déconnecter</button>
        </>
      ) : (
        <p className="meta small-print">Mode local : tes données restent dans ce navigateur. Exporte une sauvegarde régulièrement.</p>
      )}

      {driveOpen && <BackupDialog onClose={() => setDriveOpen(false)} onRestored={() => void p.reload()} />}
      <input ref={bookmarksRef} type="file" accept=".html,.htm" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const n = await importBookmarks(f, null);
        p.toast(`${n} favori(s) importé(s)`);
        p.reload();
      }} />
      <input ref={backupRef} type="file" accept=".json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          await importBackup(f);
          p.toast('Sauvegarde restaurée');
          p.reload();
        } catch (err) {
          p.toast((err as Error).message);
        }
      }} />
    </div>
  );
}
