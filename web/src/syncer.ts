// "Synchroniser": makes the computer's copy and the phone's copy identical, in both directions.
// 1. send our manifest, the phone answers with its newer records, deletions, and what it wants from us
// 2. apply the phone's changes here, send ours
// 3. copy the file contents that exist on one side only
import { useSyncExternalStore } from 'react';
import type { Item } from './db';
import { library } from './library';
import { fileMoves } from './link/sync';
import { phone } from './phone';

export interface SyncProgress {
  running: boolean;
  /** What is happening, e.g. "Réception 3/12 · Photo du riad · 45 %". */
  text: string;
  /** 0..1 while files are moving. */
  fraction: number | null;
}

export interface SyncResult {
  receivedRecords: number;
  sentRecords: number;
  filesIn: number;
  filesOut: number;
  failed: string[];
  cancelled: boolean;
}

class Syncer {
  state: SyncProgress = { running: false, text: '', fraction: null };
  private listeners = new Set<() => void>();
  private cancelled = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  private set(patch: Partial<SyncProgress>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  cancel() {
    this.cancelled = true;
  }

  async run(): Promise<SyncResult> {
    if (this.state.running) throw new Error('Une synchronisation est déjà en cours');
    this.cancelled = false;
    const result: SyncResult = { receivedRecords: 0, sentRecords: 0, filesIn: 0, filesOut: 0, failed: [], cancelled: false };
    this.set({ running: true, text: 'Connexion à ton téléphone…', fraction: null });
    try {
      await library.load();

      // 1 + 2: records
      const reply = await phone.syncStart(library.manifest());
      result.receivedRecords = reply.folders.length + reply.items.length + reply.tombs.length;
      this.set({ text: 'Mise à jour de la bibliothèque…' });
      await library.applyRemote({ folders: reply.folders, items: reply.items, tombs: reply.tombs });

      const s = library.state;
      const folders = s.folders.filter((f) => reply.wantFolders.includes(f.id));
      const items = s.items.filter((i) => reply.wantItems.includes(i.id));
      const tombs = library.tombsFor(reply.wantTombs);
      result.sentRecords = folders.length + items.length + tombs.length;
      if (result.sentRecords) await phone.syncApply(folders, items, tombs);

      // 3: file contents that exist on one side only
      const live = library.state.items.filter((i) => i.type === 'file').map((i) => i.id);
      const moves = fileMoves(live, [...library.state.files], reply.files);
      const byId = new Map(library.state.items.map((i) => [i.id, i]));
      const jobs = [...moves.pull.map((id) => ({ id, dir: 'in' as const })), ...moves.push.map((id) => ({ id, dir: 'out' as const }))];
      for (const [n, job] of jobs.entries()) {
        if (this.cancelled) {
          result.cancelled = true;
          break;
        }
        const item = byId.get(job.id) as Item;
        const label = `${job.dir === 'in' ? 'Réception' : 'Envoi'} ${n + 1}/${jobs.length} · ${item.title}`;
        const step = (done: number, total: number) => this.set({ text: `${label} · ${Math.round((done / total) * 100)} %`, fraction: (n + done / total) / jobs.length });
        this.set({ text: label, fraction: n / jobs.length });
        try {
          if (job.dir === 'in') {
            await library.putBlob(job.id, await phone.fetchFile(job.id, step));
            result.filesIn++;
          } else {
            const blob = await library.getBlob(job.id);
            if (!blob) throw new Error('fichier introuvable sur cet ordinateur');
            await phone.uploadFile(blob, item, step);
            result.filesOut++;
          }
        } catch (e) {
          result.failed.push(`${item.title} : ${(e as Error).message}`);
          if (/ne répond pas|Déconnecté|Relais/.test((e as Error).message)) break; // the phone is gone: stop here
        }
      }

      await library.finishSync({ phone: reply.phone, usage: reply.usage, complete: !result.cancelled && !result.failed.length });
      return result;
    } finally {
      this.set({ running: false, text: '', fraction: null });
    }
  }
}

export const syncer = new Syncer();
phone.onForget = () => void library.wipe();

export function useSync(): SyncProgress {
  return useSyncExternalStore(syncer.subscribe, () => syncer.state);
}
