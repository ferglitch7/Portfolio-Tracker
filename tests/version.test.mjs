// The installed app reloads when version.json differs from the version it runs.
// Both must change together on every release, or every launch would reload.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('version.json matches the version in js/update.js', () => {
  const json = JSON.parse(fs.readFileSync(new URL('../version.json', import.meta.url), 'utf8'));
  const src = fs.readFileSync(new URL('../js/update.js', import.meta.url), 'utf8');
  const m = src.match(/APP_VERSION = '([^']+)'/);
  assert.ok(m, 'APP_VERSION not found');
  assert.equal(json.version, m[1]);
});

test('the offline shell lists every script the app loads', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const scripts = fs.readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js'));
  for (const f of scripts) assert.ok(sw.includes(`'js/${f}'`), `sw.js SHELL misses js/${f}`);
});
