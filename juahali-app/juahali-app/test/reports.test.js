const test = require('node:test');
const assert = require('node:assert');
const { waitByTier, fcfsReplay, timeSaved, median } = require('../services/reports');

const T0 = Date.parse('2026-10-20T08:00:00Z');
const at = (m) => new Date(T0 + m * 60000);
const R = (tier, arrive, called) => ({ severityTier: tier, checkInAt: at(arrive), calledAt: called == null ? null : at(called) });

test('median works for odd and even lists', () => { assert.strictEqual(median([5, 1, 3]), 3); assert.strictEqual(median([1, 2, 3, 4]), 2.5); assert.strictEqual(median([]), 0); });

test('waiting time by tier ignores patients who were never called', () => {
  const t = waitByTier([R('Critical', 0, 2), R('Critical', 0, 4), R('Mild', 0, null)]);
  const c = t.find((x) => x.tier === 'Critical'), m = t.find((x) => x.tier === 'Mild');
  assert.strictEqual(c.n, 2); assert.strictEqual(c.avg, 3); assert.strictEqual(c.max, 4); assert.strictEqual(m.n, 0);
});

test('FCFS replay: a critical patient who arrived last but was served first waits longer under FCFS', () => {
  // arrivals 0, 1, 2 (mild, mild, critical); calls at 3, 4, 5 with the critical patient served first
  const rows = [R('Mild', 0, 4), R('Mild', 1, 5), R('Critical', 2, 3)];
  const out = timeSaved([rows]);
  const c = out.find((x) => x.tier === 'Critical'), m = out.find((x) => x.tier === 'Mild');
  assert.strictEqual(c.actual, 1); assert.strictEqual(c.fcfs, 3); assert.strictEqual(c.saved, 2);
  assert.strictEqual(m.actual, 4); assert.strictEqual(m.fcfs, 3); assert.strictEqual(m.saved, -1);
});

test('FCFS replay never gives negative waits', () => {
  fcfsReplay([R('Mild', 10, 12), R('Mild', 11, 13)]).forEach((x) => { assert.ok(x.fcfs >= 0 && x.actual >= 0); });
});

test('when the order is already first-come-first-served, nothing is saved', () => {
  const out = timeSaved([[R('Mild', 0, 3), R('Mild', 1, 5), R('Mild', 2, 8)]]);
  assert.strictEqual(out.find((x) => x.tier === 'Mild').saved, 0);
});
