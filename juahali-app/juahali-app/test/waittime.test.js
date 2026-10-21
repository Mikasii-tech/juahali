const test = require('node:test');
const assert = require('node:assert');
const { avgMinutes } = require('../services/waittime');

const NOW = Date.parse('2026-10-20T10:00:00Z');
const C = (mins) => ({ consultStartAt: new Date(NOW), completedAt: new Date(NOW + mins * 60000) });

test('averages recent consultation lengths', () => assert.strictEqual(avgMinutes([C(10), C(20)], 5), 15));
test('uses the default when there is no data', () => assert.strictEqual(avgMinutes([], 10), 10));
test('ignores lengths under 1 minute or over 2 hours', () => assert.strictEqual(avgMinutes([C(0.2), C(500), C(8)], 10), 8));
test('uses only the newest N valid consultations', () => assert.strictEqual(avgMinutes([C(10), C(10), C(100)], 5, 2), 10));
test('falls back when every record is invalid', () => assert.strictEqual(avgMinutes([C(0), C(300)], 12), 12));
