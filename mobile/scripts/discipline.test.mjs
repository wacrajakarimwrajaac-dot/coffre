// Run: node --test scripts/discipline.test.mjs   (Node 22+, no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/lib/discipline.ts';

const H = (o) => ({ id: 'h', title: 't', icon: '✅', recurrence: 'daily', weekdays: [], monthDay: null, startDate: '2026-10-01',
  durationDays: null, reminderTime: null, archivedDay: null, createdAt: Date.UTC(2026, 9, 1), ...o });
const checks = (id, days) => D.buildChecks(days.map((day) => ({ habitId: id, day })));

test('daily is due every day from its start, not before', () => {
  const h = H({});
  assert.equal(D.isDue(h, '2026-09-30'), false);
  assert.equal(D.isDue(h, '2026-10-01'), true);
  assert.equal(D.isDue(h, '2027-01-01'), true);
});

test('weekly is due on chosen weekdays (Mon=0)', () => {
  const h = H({ recurrence: 'weekly', weekdays: [0, 2, 4] }); // Mon Wed Fri
  assert.equal(D.weekdayOf('2026-10-05'), 0); // Monday
  assert.deepEqual(D.dueDays(h, '2026-10-05', '2026-10-11'), ['2026-10-05', '2026-10-07', '2026-10-09']);
});

test('monthly clamps day 31 to short months', () => {
  const h = H({ recurrence: 'monthly', monthDay: 31, startDate: '2026-01-01' });
  assert.deepEqual(D.dueDays(h, '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('challenge lasts exactly durationDays', () => {
  const h = H({ recurrence: 'challenge', durationDays: 90, startDate: '2026-10-01' });
  assert.equal(D.challengeEnd(h), '2026-12-29');
  assert.equal(D.isDue(h, '2026-12-29'), true);
  assert.equal(D.isDue(h, '2026-12-30'), false);
  assert.equal(D.dueDays(h, '2026-10-01', '2027-03-01').length, 90);
});

test('archived habits stop being due after the archive day', () => {
  const h = H({ archivedDay: '2026-10-10' });
  assert.equal(D.isDue(h, '2026-10-10'), true);
  assert.equal(D.isDue(h, '2026-10-11'), false);
});

test('current streak: pending today does not break it; a missed day does', () => {
  const h = H({});
  assert.equal(D.currentStreak(h, checks('h', ['2026-10-03', '2026-10-04', '2026-10-05']), '2026-10-06'), 3);
  assert.equal(D.currentStreak(h, checks('h', ['2026-10-03', '2026-10-05', '2026-10-06']), '2026-10-06'), 2);
  assert.equal(D.currentStreak(h, checks('h', ['2026-10-04', '2026-10-05']), '2026-10-07'), 0);
});

test('best streak keeps the longest run', () => {
  const h = H({});
  const c = checks('h', ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06']);
  assert.equal(D.bestStreak(h, c, '2026-10-06'), 3);
});

test('rate ignores an unfinished today and days before the start', () => {
  const h = H({ startDate: '2026-10-03' });
  const c = checks('h', ['2026-10-03', '2026-10-04']);
  const r = D.rateOf(h, c, '2026-09-01', '2026-10-06', '2026-10-06'); // 3,4,5 due & past; 6 is today pending
  assert.deepEqual(r, { done: 2, due: 3, pct: 67 });
  assert.equal(D.rateOf(h, c, '2026-10-06', '2026-10-06', '2026-10-06').pct, null);
});

test('overall rate and ranking', () => {
  const a = H({ id: 'a' }), b = H({ id: 'b' });
  const c = D.buildChecks([
    ...['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ habitId: 'a', day })),
    { habitId: 'b', day: '2026-10-01' },
  ]);
  assert.equal(D.overallRate([a, b], c, '2026-10-01', '2026-10-03', '2026-10-04').pct, 67); // 4/6
  const ranked = D.rankHabits([b, a], c, '2026-10-01', '2026-10-04');
  assert.deepEqual(ranked.map((r) => r.habit.id), ['a', 'b']);
});

test('monthly series counts created habits and tasks per month', () => {
  const habits = [H({ id: 'a', createdAt: new Date(2026, 8, 15).getTime(), startDate: '2026-09-15' })];
  const tasks = [
    { createdAt: new Date(2026, 9, 2).getTime(), done: true },
    { createdAt: new Date(2026, 9, 9).getTime(), done: false },
    { createdAt: new Date(2026, 8, 20).getTime(), done: true },
  ];
  const s = D.monthlySeries(habits, new Map(), tasks, '2026-10-20', 3);
  assert.deepEqual(s.map((m) => m.key), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(s.map((m) => m.tasksCreated), [0, 1, 2]);
  assert.deepEqual(s.map((m) => m.tasksDone), [0, 1, 1]);
  assert.deepEqual(s.map((m) => m.habitsCreated), [0, 1, 0]);
});

test('heatmap marks days with nothing due as null', () => {
  const h = H({ recurrence: 'weekly', weekdays: [0] });
  const cells = D.heatmap([h], checks('h', ['2026-10-05']), '2026-10-04', '2026-10-06');
  assert.deepEqual(cells.map((c) => c.ratio), [null, 1, null]);
});

test('challenge progress', () => {
  const h = H({ recurrence: 'challenge', durationDays: 90, startDate: '2026-10-01' });
  const p = D.challengeProgress(h, checks('h', ['2026-10-01', '2026-10-02']), '2026-10-10');
  assert.deepEqual(p, { total: 90, dayNo: 10, done: 2, left: 80, finished: false });
  assert.equal(D.challengeProgress(h, new Map(), '2027-01-01').finished, true);
});
