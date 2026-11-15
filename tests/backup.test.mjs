// When the "save a copy outside the iPhone" reminder shows up.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  data: {},
  getItem(k) { return k in this.data ? this.data[k] : null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
};
const V = await import('../js/vault.js');
const DAY = 86400e3, now = Date.parse('2026-11-15T12:00:00Z');
const set = o => { localStorage.data = {}; for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); };

test('never saved: reminder after three days of use', () => {
  set({});
  assert.equal(V.backupDue(now), null);
  set({ 'portfolio.since': now - 2 * DAY });
  assert.equal(V.backupDue(now), null);
  set({ 'portfolio.since': now - 4 * DAY });
  assert.equal(V.backupDue(now), 4);
});

test('saved: weekly, but only if something changed since', () => {
  const sig = V.signature('A');
  set({ 'portfolio.since': now - 90 * DAY, 'portfolio.exported': now - 6 * DAY, 'portfolio.exportedSig': sig });
  assert.equal(V.backupDue(now, V.signature('B')), null, 'less than a week');
  localStorage.setItem('portfolio.exported', now - 8 * DAY);
  assert.equal(V.backupDue(now, sig), null, 'nothing new to save');
  assert.equal(V.backupDue(now, V.signature('B')), 8);
});

test('signature tells contents apart', () => {
  assert.equal(V.signature('{"a":1}'), V.signature('{"a":1}'));
  assert.notEqual(V.signature('{"a":1}'), V.signature('{"a":2}'));
});
