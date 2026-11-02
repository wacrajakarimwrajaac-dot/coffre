// Two-way sync between the phone and a computer. Both sides keep a full copy of the library; nothing is sent
// until the person presses "Synchroniser" on the computer.
//
// KEEP IN SYNC: this file is identical in web/src/link/sync.ts and mobile/src/lib/link/sync.ts
// (checked by `node scripts/check-link-protocol.mjs`).
//
// How it decides (same rule on both sides, so they always agree):
//   - every folder / item has a stamp: the time of its last change (updatedAt, or createdAt for old data);
//   - a deletion leaves a tombstone { id, kind, at } so it can travel to the other side;
//   - for each id the newest of (record stamp, tombstone time) wins; on a tie a deletion wins;
//   - file contents never change once stored (only the item's title / folder do), so a file is copied
//     only where it is missing.
// Clocks of the two devices are trusted to be roughly right.

export type Kind = 'folder' | 'item';

export interface Stamped {
  id: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Tomb {
  id: string;
  kind: Kind;
  at: number;
}

/** What one side tells the other about its library (no content, only stamps). */
export interface Manifest {
  folders: { id: string; u: number }[];
  items: { id: string; u: number }[];
  tombs: Tomb[];
  /** Ids of file items whose content is stored on this side. */
  files: string[];
}

export const stampOf = (x: Stamped) => x.updatedAt ?? x.createdAt;

/** Tombstones are kept this long, so a device that stays away for months still learns about deletions. */
export const TOMB_KEEP_MS = 365 * 864e5;

interface Entry {
  deleted: boolean;
  at: number;
}

function entryOf(rec: number | undefined, tomb: number | undefined): Entry | null {
  if (tomb !== undefined && (rec === undefined || tomb >= rec)) return { deleted: true, at: tomb };
  if (rec !== undefined) return { deleted: false, at: rec };
  return null;
}

/** 1 if `a` wins over `b`, -1 if `b` wins, 0 if they agree. A missing entry always loses. */
function compare(a: Entry | null, b: Entry | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.at !== b.at) return a.at > b.at ? 1 : -1;
  if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
  return 0;
}

export interface Plan {
  /** Live records this side must send (the other side lacks them or has an older version). */
  sendFolders: string[];
  sendItems: string[];
  /** Deletions this side must send. */
  sendTombs: Tomb[];
  /** Live records this side asks the other side for. */
  wantFolders: string[];
  wantItems: string[];
  /** Deletions the other side knows about and this side must apply. */
  applyTombs: Tomb[];
}

/** From the point of view of the side that owns `local`. */
export function plan(local: Manifest, remote: Manifest): Plan {
  const out: Plan = { sendFolders: [], sendItems: [], sendTombs: [], wantFolders: [], wantItems: [], applyTombs: [] };
  const tl = new Map(local.tombs.map((t) => [t.id, t]));
  const tr = new Map(remote.tombs.map((t) => [t.id, t]));

  const run = (kind: Kind, l: { id: string; u: number }[], r: { id: string; u: number }[]) => {
    const ll = new Map(l.map((x) => [x.id, x.u]));
    const rr = new Map(r.map((x) => [x.id, x.u]));
    const ids = new Set<string>([...ll.keys(), ...rr.keys()]);
    for (const [id, t] of [...tl, ...tr]) if (t.kind === kind) ids.add(id);
    for (const id of ids) {
      const a = entryOf(ll.get(id), tl.get(id)?.kind === kind ? tl.get(id)!.at : undefined);
      const b = entryOf(rr.get(id), tr.get(id)?.kind === kind ? tr.get(id)!.at : undefined);
      const c = compare(a, b);
      if (c === 0) continue;
      if (c > 0) {
        if (a!.deleted) out.sendTombs.push({ id, kind, at: a!.at });
        else (kind === 'folder' ? out.sendFolders : out.sendItems).push(id);
      } else if (b!.deleted) out.applyTombs.push({ id, kind, at: b!.at });
      else (kind === 'folder' ? out.wantFolders : out.wantItems).push(id);
    }
  };
  run('folder', local.folders, remote.folders);
  run('item', local.items, remote.items);
  return out;
}

/** Drops tombstones that are too old to matter. */
export function pruneTombs(tombs: Tomb[], now = Date.now()): Tomb[] {
  return tombs.filter((t) => now - t.at < TOMB_KEEP_MS);
}

/** Whether a tombstone makes an incoming record obsolete (deleted after it was last changed). */
export function isDeletedBy(rec: Stamped, tomb: Tomb | undefined): boolean {
  return !!tomb && tomb.at >= stampOf(rec);
}

export interface FileMoves {
  /** File items this side has and the other lacks. */
  push: string[];
  /** File items the other side has and this side lacks. */
  pull: string[];
}

/** After both libraries agree: which file contents still have to travel. `live` = ids of file items that exist. */
export function fileMoves(live: string[], mine: string[], theirs: string[]): FileMoves {
  const m = new Set(mine);
  const t = new Set(theirs);
  return {
    push: live.filter((id) => m.has(id) && !t.has(id)),
    pull: live.filter((id) => t.has(id) && !m.has(id)),
  };
}
