import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GOOGLE_CLIENT_ID, accountEmail, authorize, backupDue, backupToDrive, disconnect, latestBackupDate,
  loadSettings, restoreFromDrive, saveSettings, type DriveSettings, type Frequency,
} from './drive';
import { formatDue } from './util';

/** Runs the scheduled Drive backup while the app is open (checked at start, then every 30 min). */
export function useAutoBackup(onDone: (text: string) => void) {
  const running = useRef(false);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const check = async () => {
      const s = loadSettings();
      if (running.current || !backupDue(s)) return;
      running.current = true;
      try {
        await authorize(false, s.email);
        const { uploaded } = await backupToDrive();
        saveSettings({ ...loadSettings(), lastBackupAt: Date.now() });
        onDone(`☁️ Sauvegarde Google Drive terminée${uploaded ? ` (${uploaded} nouveau(x) fichier(s))` : ''}`);
      } catch {
        onDone('☁️ Sauvegarde Google Drive en attente : ouvre « Sauvegarde Google Drive » pour l’autoriser.');
      } finally {
        running.current = false;
      }
    };
    const first = setTimeout(check, 5000);
    const h = setInterval(check, 30 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(h);
    };
  }, [onDone]);
}

export function BackupDialog({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const [s, setS] = useState<DriveSettings>(loadSettings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [driveDate, setDriveDate] = useState<number | null>(null);

  const update = (patch: Partial<DriveSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  const task = async (fn: () => Promise<string>) => {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await fn() });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (s.email) authorize(false, s.email).then(latestBackupDate).then(setDriveDate).catch(() => {});
  }, [s.email]);

  const connect = () =>
    task(async () => {
      disconnect();
      await authorize(true);
      const email = await accountEmail();
      update({ email, frequency: s.frequency === 'off' ? 'daily' : s.frequency });
      setDriveDate(await latestBackupDate());
      return `Connecté à ${email}`;
    });

  const backupNow = () =>
    task(async () => {
      await authorize(false, s.email).catch(() => authorize(true, s.email));
      const { uploaded } = await backupToDrive((t) => setStatus({ text: t }));
      const now = Date.now();
      update({ lastBackupAt: now });
      setDriveDate(now);
      return `Sauvegarde terminée${uploaded ? ` · ${uploaded} nouveau(x) fichier(s) envoyé(s)` : ''}`;
    });

  const restore = () => {
    if (!confirm('Restaurer la sauvegarde Google Drive ? Les éléments sauvegardés seront ajoutés ou remis à jour dans ce compte.')) return;
    task(async () => {
      await authorize(false, s.email).catch(() => authorize(true, s.email));
      const { items } = await restoreFromDrive((t) => setStatus({ text: t }));
      onRestored();
      return `${items} élément(s) restauré(s)`;
    });
  };

  // Portal: the sidebar is a sticky stacking context, so the dialog must live under <body>.
  return createPortal(
    <div className="modal-bg" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>☁️ Sauvegarde Google Drive</h2>
        <p className="meta block">
          Comme WhatsApp : tes dossiers, notes, liens, tâches et fichiers (images, vidéos, documents) sont copiés dans un
          dossier « Coffre » de ton Google Drive. Seuls les nouveaux fichiers sont envoyés à chaque fois.
        </p>

        {!GOOGLE_CLIENT_ID ? (
          <p className="error">Google n’est pas encore configuré pour ce site (VITE_GOOGLE_CLIENT_ID manquant).</p>
        ) : !s.email ? (
          <button className="btn-primary" disabled={busy} onClick={connect}>Connecter mon compte Google</button>
        ) : (
          <>
            <div className="row-between">
              <div>
                <div>Compte Google</div>
                <div className="meta">{s.email}</div>
              </div>
              <button className="btn-ghost small" disabled={busy} onClick={connect}>Changer</button>
            </div>
            <label>
              Sauvegarde automatique
              <select value={s.frequency} onChange={(e) => update({ frequency: e.target.value as Frequency })}>
                <option value="off">Jamais (seulement quand je clique)</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            </label>
            <p className="meta block">
              Dernière sauvegarde : {driveDate ? formatDue(driveDate) : s.lastBackupAt ? formatDue(s.lastBackupAt) : 'jamais'}
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" disabled={busy} onClick={restore}>Restaurer</button>
              <span className="grow" />
              <button className="btn-primary" disabled={busy} onClick={backupNow}>Sauvegarder maintenant</button>
            </div>
            <button className="btn-ghost small danger" disabled={busy}
              onClick={() => { disconnect(); update({ email: undefined, frequency: 'off' }); setDriveDate(null); }}>
              Déconnecter Google Drive
            </button>
          </>
        )}

        {status && <p className={status.error ? 'error' : 'meta block'}>{busy ? '⏳ ' : ''}{status.text}</p>}
        <div className="modal-actions">
          <span className="grow" />
          <button className="btn-ghost" disabled={busy} onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
