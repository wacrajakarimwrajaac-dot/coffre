import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

type Category = 'bug' | 'suggestion' | 'account' | 'other';
const CATEGORIES: [Category, string][] = [['bug', '🐞 Problème'], ['suggestion', '💡 Idée'], ['account', '👤 Compte'], ['other', '✉️ Autre']];
const STATUS: Record<string, string> = { new: 'Reçu', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };

interface Row { id: string; category: Category; message: string; status: string; admin_reply: string | null; created_at: string }

export function ReportDialog({ email, onClose }: { email?: string; onClose: () => void }) {
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(email ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [history, setHistory] = useState<Row[]>([]);

  const load = () =>
    supabase!.from('reports').select('id, category, message, status, admin_reply, created_at')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistory((data as Row[]) ?? []));

  useEffect(() => {
    load();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) return setStatus({ text: 'Décris le problème en quelques mots.', error: true });
    setBusy(true);
    setStatus(null);
    try {
      const { data } = await supabase!.auth.getSession();
      const uid = data.session!.user.id;
      let screenshot_path: string | null = null;
      if (file) {
        const path = `${uid}/${crypto.randomUUID()}.${file.type.includes('png') ? 'png' : 'jpg'}`;
        const up = await supabase!.storage.from('reports').upload(path, file, { contentType: file.type });
        if (!up.error) screenshot_path = path;
      }
      const { error } = await supabase!.from('reports').insert({
        category, message: message.trim(), contact_email: contact.trim() || null, screenshot_path,
        platform: `Web · ${navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] ?? 'navigateur'}`.slice(0, 100),
        device: navigator.platform.slice(0, 300), app_version: 'web',
      });
      if (error) throw new Error(error.message);
      setMessage('');
      setFile(null);
      setStatus({ text: 'Merci 🙏 Ton signalement a bien été envoyé.' });
      load();
    } catch (err) {
      setStatus({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-bg" onClick={() => !busy && onClose()}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
        <h2>🐞 Signaler un problème</h2>
        <p className="meta block">Quelque chose ne marche pas, ou tu as une idée ? On lit chaque message.</p>
        <div className="filters">
          {CATEGORIES.map(([c, label]) => (
            <button type="button" key={c} className={`filter${category === c ? ' on' : ''}`} onClick={() => setCategory(c)}>{label}</button>
          ))}
        </div>
        <label>Message
          <textarea rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={category === 'suggestion' ? 'Ton idée…' : 'Que s’est-il passé ? Qu’est-ce que tu faisais juste avant ?'} />
        </label>
        <label>Email pour te répondre (optionnel)
          <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label>Capture d’écran (optionnel)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {status && <p className={status.error ? 'error' : 'meta block'}>{status.text}</p>}
        <div className="modal-actions">
          <span className="grow" />
          <button type="button" className="btn-ghost" onClick={onClose}>Fermer</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button>
        </div>
        {history.length > 0 && (
          <div className="history">
            <div className="side-title"><span>Mes signalements</span></div>
            {history.map((r) => (
              <div key={r.id} className="card history-row">
                <div className="row-between">
                  <span className="meta">{CATEGORIES.find(([c]) => c === r.category)?.[1]} · {new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  <span className={`status status-${r.status}`}>{STATUS[r.status] ?? r.status}</span>
                </div>
                <p className="note-text">{r.message}</p>
                {r.admin_reply && <p className="reply"><strong>Réponse de l’équipe :</strong> {r.admin_reply}</p>}
              </div>
            ))}
          </div>
        )}
      </form>
    </div>,
    document.body,
  );
}

/** Deletes every stored file, then the account (data cascades). Irreversible. */
export async function deleteAccount() {
  const { data } = await supabase!.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Non connecté');
  for (const bucket of ['files', 'reports']) {
    for (;;) {
      const { data: list, error } = await supabase!.storage.from(bucket).list(uid, { limit: 100 });
      if (error) throw new Error(error.message);
      if (!list?.length) break;
      const rm = await supabase!.storage.from(bucket).remove(list.map((f) => `${uid}/${f.name}`));
      if (rm.error) throw new Error(rm.error.message);
    }
  }
  const { error } = await supabase!.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  await supabase!.auth.signOut({ scope: 'local' });
}
