const test = require('node:test');
const assert = require('node:assert');
const { waitFactor, rankQueue } = require('../services/urgency');

const NOW = Date.parse('2026-10-19T10:00:00Z');
const E = (id, weight, minsAgo) => ({ _id: id, severityWeight: weight, checkInAt: new Date(NOW - minsAgo * 60000) });
const order = (list) => rankQueue(list, NOW).map((r) => r._id);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} should equal ${b}`);

test('wait factor grows slowly, then faster after 20 minutes', () => {
  close(waitFactor(0), 0); close(waitFactor(10), 0.1); close(waitFactor(20), 0.2);
  close(waitFactor(40), 1.2); close(waitFactor(60), 2.2);
});

test('Critical patients always come first, even against a very long wait', () => {
  assert.deepStrictEqual(order([E('severe-100min', 3, 100), E('critical-new', 4, 0)]), ['critical-new', 'severe-100min']);
});

test('Critical patients are ordered by earlier check-in', () => {
  assert.deepStrictEqual(order([E('c-late', 4, 2), E('c-early', 4, 9)]), ['c-early', 'c-late']);
});

test('Aging: a mild patient who has waited 45 min outranks a new moderate patient', () => {
  assert.deepStrictEqual(order([E('moderate-new', 2, 5), E('mild-45', 1, 45)]), ['mild-45', 'moderate-new']);
});

test('Aging: a mild patient who has waited only 10 min does not', () => {
  assert.deepStrictEqual(order([E('moderate-new', 2, 5), E('mild-10', 1, 10)]), ['moderate-new', 'mild-10']);
});

test('Ceiling: after 60 min a mild patient goes ahead of a severe patient, but behind Critical', () => {
  assert.deepStrictEqual(order([E('severe-10', 3, 10), E('mild-65', 1, 65), E('critical-new', 4, 1)]), ['critical-new', 'mild-65', 'severe-10']);
});

test('Ceiling: promoted patients are ordered by earlier check-in', () => {
  assert.deepStrictEqual(order([E('p-late', 3, 62), E('p-early', 1, 90)]), ['p-early', 'p-late']);
});

test('Ties on score go to the earlier check-in, then to id', () => {
  assert.deepStrictEqual(order([E('b', 2, 5), E('a', 2, 5)]), ['a', 'b']);
});

test('Ranking is deterministic: shuffling the input never changes the order', () => {
  const list = [E('a', 4, 3), E('b', 3, 15), E('c', 1, 45), E('d', 2, 5), E('e', 1, 65), E('f', 1, 0)];
  const expected = order(list);
  for (let i = 0; i < 25; i++) assert.deepStrictEqual(order([...list].sort(() => Math.random() - 0.5)), expected);
});

test('Critical is never flagged as ceiling-promoted', () => {
  const r = rankQueue([E('c', 4, 120)], NOW)[0];
  assert.strictEqual(r.critical, true); assert.strictEqual(r.promoted, false);
});
