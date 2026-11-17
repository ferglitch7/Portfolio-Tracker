// Ajustes → Distribución: bar, ring or list; filtering works in all three.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('three styles, each filters by class and shows the target', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: { targets: { crypto: 50, metal: 30, cash: 20 } } } });
  const { p } = h;
  await h.wait(2500);
  const shown = () => p.evaluate(() => ['alloc-bar', 'alloc-ringcard', 'alloc-rows'].filter(id => !document.getElementById(id).hidden));
  assert.deepEqual(await shown(), ['alloc-bar'], 'the bar by default');

  const choose = async label => {
    await p.tap('#btn-settings'); await h.wait(800);
    await p.tap(`.alloc-style .seg button:has-text("${label}")`); await h.wait(300);
    await p.tap('.sheet-view:last-child .close'); await h.wait(1000);
  };
  const filterBy = async sel => { await p.tap(sel); await h.wait(500); const n = await h.names(); await p.tap(sel); await h.wait(500); return n; };

  assert.deepEqual(await filterBy('#alloc-legend .chip:has-text("Metales")'), ['Oro']);

  await choose('Anillo');
  assert.deepEqual(await shown(), ['alloc-ringcard']);
  assert.equal(await p.$$eval('.ring-arc', e => e.length), 3);
  assert.equal(await p.$$eval('.ring-target', e => e.length), 3);
  assert.match(await p.textContent('#ring-value'), /^\$150/);
  assert.deepEqual(await filterBy('#alloc-legend .chip:has-text("Metales")'), ['Oro']);

  await choose('Lista');
  assert.deepEqual(await shown(), ['alloc-rows']);
  assert.deepEqual(await p.$$eval('.ar-name', e => e.map(x => x.textContent)), ['Crypto', 'Metales', 'Efectivo']);
  assert.equal(await p.$eval('.ar-row:has-text("Metales") .ar-amt', e => e.textContent), '$40.000');
  assert.equal(await p.$$eval('.ar-mark:not([hidden])', e => e.length), 3, 'target ticks');
  assert.deepEqual(await filterBy('.ar-row:has-text("Metales")'), ['Oro']);

  await p.reload(); await h.wait(2500);
  assert.deepEqual(await shown(), ['alloc-rows'], 'the choice is kept');
  await choose('Barra');
  assert.deepEqual(await shown(), ['alloc-bar']);
  assert.ok(await p.isVisible('#alloc-legend #btn-targets'), '"Objetivo" back in the legend');
  assert.deepEqual(h.errors, []);
  await h.close();
});
