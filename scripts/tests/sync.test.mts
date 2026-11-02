import { plan, stampOf, fileMoves, isDeletedBy, type Manifest, type Tomb } from '../../web/src/link/sync.ts';

type Rec = { id: string; createdAt: number; updatedAt?: number; v: string; file?: boolean };
class Replica {
  folders = new Map<string, Rec>(); items = new Map<string, Rec>(); tombs = new Map<string, Tomb>(); files = new Set<string>();
  manifest(): Manifest {
    return { folders: [...this.folders.values()].map((x) => ({ id: x.id, u: stampOf(x) })), items: [...this.items.values()].map((x) => ({ id: x.id, u: stampOf(x) })), tombs: [...this.tombs.values()], files: [...this.files] };
  }
  bag(k: 'folder' | 'item') { return k === 'folder' ? this.folders : this.items; }
  put(k: 'folder' | 'item', r: Rec) { // remote record arrives
    const t = this.tombs.get(r.id);
    if (isDeletedBy(r, t)) return;
    this.bag(k).set(r.id, { ...r }); if (t) this.tombs.delete(r.id);
  }
  tomb(t: Tomb) { // remote deletion arrives
    const r = this.bag(t.kind).get(t.id);
    if (r && stampOf(r) > t.at) return;
    this.bag(t.kind).delete(t.id); this.files.delete(t.id);
    const old = this.tombs.get(t.id); if (!old || old.at < t.at) this.tombs.set(t.id, t);
  }
  local(k: 'folder' | 'item', r: Rec, now: number) { this.bag(k).set(r.id, { ...r, updatedAt: now }); this.tombs.delete(r.id); }
  del(k: 'folder' | 'item', id: string, now: number) { this.bag(k).delete(id); this.files.delete(id); this.tombs.set(id, { id, kind: k, at: now }); }
}

function sync(pc: Replica, phone: Replica) {
  const mp = pc.manifest(), mh = phone.manifest();
  const planPhone = plan(mh, mp); // phone's view
  // phone replies with what it sends; PC applies
  for (const id of planPhone.sendFolders) pc.put('folder', phone.folders.get(id)!);
  for (const id of planPhone.sendItems) pc.put('item', phone.items.get(id)!);
  for (const t of planPhone.sendTombs) pc.tomb(t);
  // PC sends what the phone wants
  for (const id of planPhone.wantFolders) { const r = pc.folders.get(id); if (r) phone.put('folder', r); }
  for (const id of planPhone.wantItems) { const r = pc.items.get(id); if (r) phone.put('item', r); }
  for (const t of planPhone.applyTombs) phone.tomb(t);
  // files
  const live = [...pc.items.values()].filter((x) => x.file).map((x) => x.id);
  const mv = fileMoves(live, [...pc.files], mh.files);
  for (const id of mv.push) phone.files.add(id);
  for (const id of mv.pull) pc.files.add(id);
}

let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
function snapshot(r: Replica) {
  return JSON.stringify({ f: [...r.folders.values()].map((x) => [x.id, x.v, stampOf(x)]).sort(), i: [...r.items.values()].map((x) => [x.id, x.v, stampOf(x), [...r.files].includes(x.id)]).sort() });
}
let runs = 0;
for (let s = 0; s < 2000; s++) {
  const a = new Replica(), b = new Replica(); const reps = [a, b]; let clock = 1000, nid = 0;
  const steps = 5 + Math.floor(rnd() * 25);
  for (let n = 0; n < steps; n++) {
    clock += 1 + Math.floor(rnd() * 5);
    const r = pick(reps); const k = pick(['folder', 'item'] as const); const bag = r.bag(k); const op = rnd();
    if (op < 0.4 || bag.size === 0) { const id = `${k}${nid++}`; const isFile = k === 'item' && rnd() < 0.5; r.local(k, { id, createdAt: clock, v: `v${clock}`, file: isFile }, clock); if (isFile) r.files.add(id); }
    else if (op < 0.75) { const x = pick([...bag.values()]); r.local(k, { ...x, v: `e${clock}` }, clock); }
    else { r.del(k, pick([...bag.keys()]), clock); }
    if (rnd() < 0.15) { clock += 1; sync(a, b); }
  }
  clock += 10; sync(a, b);
  const sa = snapshot(a), sb = snapshot(b);
  if (sa !== sb) { console.error('DIVERGED at run', s, '\nA', sa, '\nB', sb); process.exit(1); }
  // second sync must be a no-op
  const p = plan(b.manifest(), a.manifest());
  if (p.sendFolders.length + p.sendItems.length + p.sendTombs.length + p.wantFolders.length + p.wantItems.length + p.applyTombs.length) { console.error('not idempotent', s, p); process.exit(1); }
  runs++;
}
console.log('ok', runs, 'random scenarios: both replicas converge and a second sync changes nothing');

// Hand-made cases
const A = new Replica(), B = new Replica();
A.local('item', { id: 'x', createdAt: 1, v: 'orig' }, 1); sync(A, B);
B.del('item', 'x', 5); A.local('item', { id: 'x', createdAt: 1, v: 'edited later' }, 9); sync(A, B);
console.log('edit after delete wins:', B.items.get('x')?.v === 'edited later' && A.items.get('x')?.v === 'edited later');
A.del('item', 'x', 20); B.local('item', { id: 'x', createdAt: 1, v: 'older edit' }, 15); sync(A, B);
console.log('delete after edit wins:', !A.items.has('x') && !B.items.has('x'));
A.local('item', { id: 'y', createdAt: 30, v: '1' }, 30); B.local('item', { id: 'y', createdAt: 30, v: '2' }, 31); sync(A, B);
console.log('latest edit wins:', A.items.get('y')?.v === '2' && B.items.get('y')?.v === '2');
