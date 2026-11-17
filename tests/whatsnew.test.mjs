// When the "Novedades" card shows after an update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { notesFor, newer, NOTES } from '../js/whatsnew.js';
import { APP_VERSION } from '../js/update.js';

const N = [
  { version: '2026.12.01-2', items: [{ title: 'C' }] },
  { version: '2026.11.17-10', items: [{ title: 'B' }] },
  { version: '2026.11.17-9', items: [{ title: 'A' }] },
];

test('versions compare by number, not as text', () => {
  assert.equal(newer('2026.11.17-10', '2026.11.17-9'), true);
  assert.equal(newer('2026.11.17-9', '2026.11.17-10'), false);
  assert.equal(newer('2026.11.17-1', '2026.11.17-1'), false);
});

test('shows what came out since the version last opened', () => {
  assert.deepEqual(notesFor('2026.11.17-9', '2026.11.17-10', true, N).items.map(i => i.title), ['B']);
  assert.deepEqual(notesFor('2026.11.01-1', '2026.12.01-2', true, N).items.map(i => i.title), ['C', 'B', 'A']);
  assert.equal(notesFor('2026.11.17-10', '2026.11.17-11', true, N), null, 'a fix without notes stays silent');
});

test('first launch shows nothing; someone who used it before sees the latest', () => {
  assert.equal(notesFor(null, '2026.12.01-2', false, N), null);
  assert.deepEqual(notesFor(null, '2026.12.01-2', true, N).items.map(i => i.title), ['C']);
  assert.equal(notesFor(null, '2026.11.17-10', true, N).version, '2026.11.17-10', 'notes of unreleased versions wait');
});

test('the notes are short and none is newer than the app', () => {
  for (const n of NOTES) {
    assert.ok(!newer(n.version, APP_VERSION), `${n.version} is ahead of ${APP_VERSION}`);
    assert.ok(n.items.length >= 1 && n.items.length <= 3);
    for (const it of n.items) assert.ok(it.title.length <= 32 && it.text.length <= 140, it.title);
  }
});
