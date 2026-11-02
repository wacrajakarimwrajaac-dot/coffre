import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, PRICE_LABEL } from './Account';
import { AddDialog, type AddKind } from './AddDialog';
import { parseBookmarks, uid, type Folder, type Item } from './db';
import { Icon, IconTile, type IconName } from './icons';
import { FolderIconDialog, ItemDialog } from './ItemDialog';
import { ItemRow, MediaTile } from './ItemRow';
import { library, useLibrary } from './library';
import { phone, useLink } from './phone';
import { syncer, useSync } from './syncer';
import { setThemePref, useThemePref, type ThemePref } from './theme';
import { formatSize, hostOf, normalizeUrl } from './util';

type View = { kind: 'home' } | { kind: 'media' } | { kind: 'folder'; id: string };
type Filter = 'all' | 'link' | 'note' | 'file';

const FILTERS: [Filter, string][] = [['all', 'Tout'], ['link', 'Liens'], ['note', 'Notes'], ['file', 'Fichiers']];
const QUICK: [AddKind, IconName, string][] = [['link', 'link', 'Lien'], ['note', 'file-text', 'Note'], ['voice', 'mic', 'Vocal'], ['file', 'upload', 'Fichier']];
const THEMES: [ThemePref, IconName, string][] = [['system', 'sun-moon', 'Automatique'], ['light', 'sun', 'Clair'], ['dark', 'moon', 'Sombre']];
function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
const isMedia = (i: Item) => i.type === 'file' && /^(image|video)\//.test(i.mime ?? '');

export default function App() {
  const st = useLibrary();
  const link = useLink();
  const sync = useSync();
  const account = useAccount();
  const folders = useMemo(() => [...st.folders].sort((a, b) => a.createdAt - b.createdAt), [st.folders]);
  const items = useMemo(() => [...st.items].sort((a, b) => b.createdAt - a.createdAt), [st.items]);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Item | null>(null);
  const [adding, setAdding] = useState<AddKind | null>(null);
  const [iconFor, setIconFor] = useState<Folder | null>(null);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const bookmarksRef = useRef<HTMLInputElement>(null);
  const theme = useThemePref();

  const toast = useCallback((text: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const attempt = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  }, [toast]);

  const runSync = useCallback(async () => {
    try {
      const r = await syncer.run();
      const parts = [
        r.receivedRecords || r.filesIn ? `reçu : ${r.receivedRecords} changement(s), ${r.filesIn} fichier(s)` : '',
        r.sentRecords || r.filesOut ? `envoyé : ${r.sentRecords} changement(s), ${r.filesOut} fichier(s)` : '',
      ].filter(Boolean);
      if (r.cancelled) toast('Synchronisation annulée');
      else if (r.failed.length) toast(`Synchronisation incomplète : ${r.failed[0]}${r.failed.length > 1 ? ` (+${r.failed.length - 1})` : ''}`);
      else toast(parts.length ? `Synchronisé · ${parts.join(' · ')}` : 'Déjà à jour');
    } catch (e) {
      toast((e as Error).message);
    }
  }, [toast]);

  // Right after pairing, copy the library from the phone without waiting for a click.
  useEffect(() => {
    if (link.justPaired) {
      phone.acknowledgePairing();
      void runSync();
    }
  }, [link.justPaired, runSync]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const childrenOf = useCallback(
    (id: string | null) => folders.filter((f) => (id === null ? !f.parentId || !folderById.has(f.parentId) : f.parentId === id)),
    [folders, folderById],
  );
  const descendants = useCallback((id: string): string[] => [id, ...folders.filter((f) => f.parentId === id).flatMap((c) => descendants(c.id))], [folders]);
  const countIn = (id: string) => {
    const ids = new Set(descendants(id));
    return items.filter((i) => ids.has(i.folderId)).length;
  };
  const pathOf = (id: string): Folder[] => {
    const f = folderById.get(id);
    return f ? [...(f.parentId ? pathOf(f.parentId) : []), f] : [];
  };
  const folderLabel = (id: string) => pathOf(id).map((f) => f.name).join(' / ');

  const current = view.kind === 'folder' ? folderById.get(view.id) : undefined;
  const inbox = folders.find((f) => !f.parentId && f.name === 'Boîte de réception') ?? folders[0];
  const target = current ?? inbox;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((i) => [i.title, i.text, i.url, i.fileName].some((v) => v?.toLowerCase().includes(q)));
    else if (view.kind === 'folder') list = list.filter((i) => i.folderId === view.id);
    else if (view.kind === 'media') list = list.filter(isMedia);
    return filter === 'all' || view.kind === 'media' ? list : list.filter((i) => i.type === filter);
  }, [items, query, view, filter]);

  const go = (v: View) => {
    setView(v);
    setQuery('');
    setFilter('all');
    setMenuOpen(false);
  };

  // ---- Actions: applied on the phone, which sends back its updated library ----

  const addFiles = async (files: FileList | File[], folderId = target?.id) => {
    if (!folderId) return;
    const list = Array.from(files); // the input's live FileList is cleared right after
    let added = 0;
    for (const [n, file] of list.entries()) {
      const item: Item = {
        id: uid(), folderId, type: 'file', title: file.name.replace(/\.[^.]+$/, '') || file.name, fileName: file.name,
        mime: file.type || 'application/octet-stream', size: file.size, createdAt: Date.now(),
      };
      const label = list.length > 1 ? `${n + 1}/${list.length} · ${file.name}` : file.name;
      setSending(`Enregistrement · ${label}`);
      const ok = await attempt(() => library.addFile(file, item));
      if (ok) added++;
    }
    setSending(null);
    if (added) toast(`${added} fichier${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} · à synchroniser avec ton téléphone`);
  };

  const createFolder = async (parentId: string | null) => {
    const name = prompt(parentId ? 'Nom du sous-dossier' : 'Nom du dossier');
    if (!name?.trim()) return;
    const f: Folder = { id: uid(), name: name.trim(), parentId, icon: 'folder:violet', createdAt: Date.now() };
    if (await attempt(() => library.saveFolder(f))) go({ kind: 'folder', id: f.id });
  };

  const renameFolder = (f: Folder) => {
    const name = prompt('Nouveau nom', f.name);
    if (name?.trim() && name.trim() !== f.name) void attempt(() => library.saveFolder({ ...f, name: name.trim() }));
  };

  const deleteFolder = async (f: Folder) => {
    const n = countIn(f.id);
    if (!confirm(`Supprimer « ${f.name} », ses sous-dossiers et ${n} élément${n > 1 ? 's' : ''} ?\nIls seront supprimés de cet ordinateur, et de ton téléphone à la prochaine synchronisation.`)) return;
    if (await attempt(() => library.deleteFolder(f.id))) go({ kind: 'home' });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) return void addFiles(e.dataTransfer.files);
    const url = normalizeUrl(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
    if (url && target) void attempt(() => library.saveItem({ id: uid(), folderId: target.id, type: 'link', url, title: hostOf(url), createdAt: Date.now() }));
  };

  // ---- Layout ----

  const roots = childrenOf(null);
  const subs = current ? childrenOf(current.id) : [];
  const title = query.trim() ? 'Recherche' : view.kind === 'media' ? 'Médias' : current ? current.name : 'Mon Coffre';
  const subtitle = query.trim()
    ? `${visible.length} résultat${visible.length > 1 ? 's' : ''} pour « ${query.trim()} »`
    : view.kind === 'media' ? `${visible.length} photo${visible.length > 1 ? 's' : ''} et vidéo${visible.length > 1 ? 's' : ''}`
    : current ? (current.parentId ? folderLabel(current.id) : `${countIn(current.id)} élément${countIn(current.id) > 1 ? 's' : ''}`)
    : `${items.length} élément${items.length > 1 ? 's' : ''} · enregistrés sur cet ordinateur`;
  const usedHere = items.reduce((n, i) => n + (i.type === 'file' && st.files.has(i.id) ? i.size ?? 0 : 0), 0);
  const usage = st.phoneUsage;

  return (
    <div className="app">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="logo"><img src="/logo-mark.png" alt="" width={28} height={28} /> Coffre</div>

        <nav className="nav">
          <NavRow icon="house" label="Accueil" active={view.kind === 'home' && !query} onClick={() => go({ kind: 'home' })} count={items.length} />
          <NavRow icon="images" label="Médias" active={view.kind === 'media' && !query} onClick={() => go({ kind: 'media' })} count={items.filter(isMedia).length} />
        </nav>

        <div className="side-label">
          <span>Dossiers</span>
          <button className="icon-btn" onClick={() => createFolder(null)} title="Nouveau dossier" aria-label="Nouveau dossier"><Icon name="plus" size={17} /></button>
        </div>
        <nav className="nav tree">
          <FolderTree parentId={null} depth={0} childrenOf={childrenOf} countIn={countIn}
            activeId={view.kind === 'folder' && !query ? view.id : null} onSelect={(id) => go({ kind: 'folder', id })} />
        </nav>

        <div className="side-foot">
          <div className="device">
            <span className="device-icon"><Icon name="smartphone" size={18} /></span>
            <div className="grow">
              <div className="device-name ellipsis">{st.phone || 'Téléphone'}</div>
              <div className="muted small">{st.lastSync ? `Synchronisé ${ago(st.lastSync)}` : 'Pas encore synchronisé'}</div>
            </div>
          </div>
          <button className="btn primary sync-btn" disabled={sync.running} onClick={() => void runSync()}>
            <Icon name="refresh" size={17} className={sync.running ? 'spin' : undefined} /> {sync.running ? 'Synchronisation…' : 'Synchroniser'}
          </button>
          {sync.running && (
            <div className="storage">
              {sync.fraction !== null && <div className="bar"><span className="fill" style={{ width: `${Math.round(sync.fraction * 100)}%` }} /></div>}
              <div className="muted small">{sync.text}</div>
              <button className="text-btn muted" onClick={() => syncer.cancel()}>Annuler</button>
            </div>
          )}
          <div className="storage">
            <div className="muted small">{formatSize(usedHere)} sur cet ordinateur{usage ? ` · ${formatSize(usage.usedBytes)} sur le téléphone` : ''}</div>
          </div>
          <button className="side-btn" onClick={() => bookmarksRef.current?.click()}><Icon name="bookmark" size={17} /> Importer les favoris du navigateur</button>
          <div className="segmented" role="radiogroup" aria-label="Thème">
            {THEMES.map(([p, icon, label]) => (
              <button key={p} role="radio" aria-checked={theme === p} className={theme === p ? 'on' : ''} title={label} onClick={() => setThemePref(p)}>
                <Icon name={icon} size={16} /> {label}
              </button>
            ))}
          </div>
          <button className="side-btn" onClick={() => {
            if (confirm('Déconnecter ce téléphone ?\nLa copie de ton Coffre sur cet ordinateur sera supprimée (elle reste sur ton téléphone). Tu pourras la récupérer en scannant un QR code.')) void phone.forget();
          }}><Icon name="smartphone" size={17} /> Déconnecter le téléphone</button>
          <button className="side-btn danger" onClick={() => void account.signOut()} title={account.email}>
            <Icon name="log-out" size={17} /> <span className="ellipsis">Se déconnecter · {account.email}</span>
          </button>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className={`main${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}>
        <div className="content">
          {account.access.reason === 'trial' && account.access.until && (
            <div className="banner info">
              Essai gratuit : encore {Math.max(1, Math.ceil((account.access.until.getTime() - Date.now()) / 86_400_000))} jour(s).
              {account.subscribeUrl && <> <a className="text-btn" href={account.subscribeUrl} target="_blank" rel="noreferrer">S’abonner · {PRICE_LABEL}</a></>}
            </div>
          )}
          {!st.lastSync && !sync.running && (
            <div className="banner info"><Icon name="refresh" size={18} /> Appuie sur « Synchroniser » pour copier ton Coffre depuis ton téléphone. Coffre doit être ouvert sur ton téléphone.</div>
          )}
          <div className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu"><Icon name="menu" /></button>
            <label className="search">
              <Icon name="search" size={18} />
              <input type="search" placeholder="Rechercher dans tes dossiers" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {current && current.parentId && !query && (
            <div className="crumbs">
              {pathOf(current.id).slice(0, -1).map((f) => (
                <button key={f.id} className="text-btn muted" onClick={() => go({ kind: 'folder', id: f.id })}>{f.name} <Icon name="chevron-right" size={14} /></button>
              ))}
            </div>
          )}

          <header className="page-head">
            {current && !query && <IconTile icon={current.icon} size={48} />}
            <div className="grow">
              <h1>{title}</h1>
              <p className="muted">{subtitle}</p>
            </div>
            {current && !query && (
              <div className="head-actions">
                <button className="ghost" onClick={() => createFolder(current.id)}><Icon name="folder-plus" size={17} /> Sous-dossier</button>
                <button className="ghost" onClick={() => setIconFor(current)}><Icon name="palette" size={17} /> Icône</button>
                <button className="ghost" onClick={() => renameFolder(current)}><Icon name="pencil" size={17} /> Renommer</button>
                <button className="ghost danger" onClick={() => deleteFolder(current)} title="Supprimer le dossier" aria-label="Supprimer le dossier"><Icon name="trash" size={17} /></button>
              </div>
            )}
          </header>

          {!query && view.kind !== 'media' && (
            <div className="pills">
              {QUICK.map(([kind, icon, label]) => (
                <button key={kind} className="pill" onClick={() => setAdding(kind)}><Icon name={icon} size={17} /> {label}</button>
              ))}
            </div>
          )}

          {!query && view.kind === 'home' && (
            <>
              <SectionLabel right={<button className="text-btn" onClick={() => createFolder(null)}>Nouveau</button>}>Dossiers</SectionLabel>
              <div className="folders">
                {roots.map((f) => <FolderCard key={f.id} folder={f} count={countIn(f.id)} subs={childrenOf(f.id).length} onClick={() => go({ kind: 'folder', id: f.id })} />)}
              </div>
            </>
          )}

          {!query && subs.length > 0 && (
            <>
              <SectionLabel>Sous-dossiers</SectionLabel>
              <div className="folders">
                {subs.map((f) => <FolderCard key={f.id} folder={f} count={countIn(f.id)} subs={childrenOf(f.id).length} onClick={() => go({ kind: 'folder', id: f.id })} />)}
              </div>
            </>
          )}

          {view.kind === 'media' && !query ? (
            visible.length ? (
              <div className="media-grid">{visible.map((i) => <MediaTile key={i.id} item={i} onOpen={() => setOpen(i)} />)}</div>
            ) : <Empty title="Aucune photo ni vidéo" hint="Ajoute-en depuis l’app, ou glisse-les dans cette page." />
          ) : (
            <>
              <SectionLabel right={
                <div className="tabs">
                  {FILTERS.map(([f, label]) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{label}</button>)}
                </div>
              }>{view.kind === 'home' && !query ? 'Récents' : 'Éléments'}</SectionLabel>
              {visible.length ? (
                <div className="rows">
                  {visible.map((i) => <ItemRow key={i.id} item={i} folderLabel={view.kind === 'folder' && !query ? undefined : folderLabel(i.folderId)} onOpen={() => setOpen(i)} />)}
                </div>
              ) : (
                <Empty title={query ? 'Aucun résultat' : 'Rien ici pour l’instant'}
                  hint={query ? undefined : 'Ajoute un lien, une note ou un vocal, ou glisse des fichiers dans cette page : tout est enregistré sur cet ordinateur, puis copié sur ton téléphone quand tu synchronises.'} />
              )}
            </>
          )}
        </div>
        {dragging && target && <div className="drop-hint"><Icon name="upload" size={28} /> Dépose ici pour ajouter à « {target.name} »</div>}
      </main>

      {open && (
        <ItemDialog item={items.find((i) => i.id === open.id) ?? open} folders={folders} folderLabel={folderLabel} onClose={() => setOpen(null)}
          onSave={async (it) => { if (await attempt(() => library.saveItem(it))) setOpen(null); }}
          onDelete={async (it) => { if (await attempt(() => library.deleteItem(it.id))) setOpen(null); }} />
      )}
      {adding && target && (
        <AddDialog kind={adding} folders={folders} folderLabel={folderLabel} defaultFolder={target.id} onClose={() => setAdding(null)}
          onSave={async (item) => { if (await attempt(() => library.saveItem(item))) setAdding(null); }}
          onFiles={(files, folderId) => { setAdding(null); void addFiles(files, folderId); }} />
      )}
      {iconFor && (
        <FolderIconDialog folder={iconFor} onClose={() => setIconFor(null)}
          onSave={async (icon) => { if (await attempt(() => library.saveFolder({ ...iconFor, icon }))) setIconFor(null); }} />
      )}

      <input ref={bookmarksRef} type="file" accept=".html,.htm" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          const { folders: fs, items: its } = await parseBookmarks(f, null);
          await library.saveMany(fs, its);
          toast(`${its.length} favori${its.length > 1 ? 's' : ''} importé${its.length > 1 ? 's' : ''}`);
        } catch (err) {
          toast((err as Error).message);
        }
      }} />

      <div className="toasts">
        {sending && <div className="toast">{sending}</div>}
        {toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
      </div>
    </div>
  );
}

function NavRow(p: { icon: IconName; label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button className={`nav-row${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <Icon name={p.icon} size={19} /><span className="grow">{p.label}</span><span className="count">{p.count || ''}</span>
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
          <button className={`nav-row${p.activeId === f.id ? ' active' : ''}`} style={{ paddingLeft: 10 + p.depth * 18 }} onClick={() => p.onSelect(f.id)}>
            <IconTile icon={f.icon} size={26} /><span className="grow ellipsis">{f.name}</span><span className="count">{p.countIn(f.id) || ''}</span>
          </button>
          {p.depth < 6 && <FolderTree {...p} parentId={f.id} depth={p.depth + 1} />}
        </div>
      ))}
    </>
  );
}

function FolderCard({ folder, count, subs, onClick }: { folder: Folder; count: number; subs: number; onClick: () => void }) {
  return (
    <button className="folder-card" onClick={onClick}>
      <IconTile icon={folder.icon} size={42} />
      <span className="grow">
        <span className="folder-name ellipsis">{folder.name}</span>
        <span className="muted small">{count} élément{count > 1 ? 's' : ''}{subs ? ` · ${subs} sous-dossier${subs > 1 ? 's' : ''}` : ''}</span>
      </span>
      <Icon name="chevron-right" size={18} className="muted" />
    </button>
  );
}

function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return <div className="section-label"><span>{children}</span>{right}</div>;
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}
