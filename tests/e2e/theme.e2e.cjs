// Ajustes → Tema: follow the iPhone, or force light or dark; the goal sits after Rendimiento.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('force light on a dark iPhone and back; kept after reload, applied before paint', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: {} }, scheme: 'dark' });
  const { p } = h;
  await h.wait(2500);
  const bg = () => p.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg').trim() || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  assert.equal(await bg(), '#000000', 'auto follows the dark iPhone');
  const choose = async label => {
    await p.tap('#btn-settings'); await h.wait(800);
    await p.tap(`.theme-pick .seg button:has-text("${label}")`); await h.wait(400);
    await p.tap('.sheet-view:last-child .close'); await h.wait(900);
  };
  await choose('Claro');
  assert.equal(await bg(), '#f2f2f7');
  assert.equal(await p.$eval('meta[name="theme-color"][media*="dark"]', m => m.content), '#f2f2f7', 'status bar follows');
  await p.reload(); await h.wait(200);
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light', 'set before the app starts');
  await h.wait(2000);
  await choose('Auto');
  assert.equal(await bg(), '#000000');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme || ''), '');

  // order on the home screen: assets, Rendimiento, goal
  const ids = await p.evaluate(() => [...document.querySelectorAll('#list, #perf, #goal, #watch')].map(e => e.id));
  assert.deepEqual(ids, ['list', 'perf', 'goal', 'watch']);
  assert.deepEqual(h.errors, []);
  await h.close();
});
