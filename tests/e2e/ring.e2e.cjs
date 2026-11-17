// The allocation ring.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('one arc per class, total in the middle, tap to look at one class', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  assert.equal(await p.$$eval('.ring-arc', e => e.length), 3);
  assert.equal(await p.textContent('#ring-label'), '3 clases');
  assert.match(await p.textContent('#ring-value'), /^\$150/);
  // arcs are proportional: crypto (100k of 150k) is twice metals (40k)… roughly, minus the gaps
  const len = await p.$$eval('.ring-arc', e => e.map(x => parseFloat(x.style.strokeDasharray)));
  assert.ok(len[0] > len[1] * 2 && len[1] > len[2] * 3, `arc lengths ${len}`);

  await p.tap('.chip:has-text("Metales")'); await h.wait(700);
  assert.equal(await p.textContent('#ring-label'), 'Metales');
  assert.match(await p.textContent('#ring-value'), /^\$40/);
  assert.deepEqual(await h.names(), ['Oro']);
  assert.ok(await p.$eval('#alloc-ring', e => e.classList.contains('filtered')));
  await p.tap('.chip:has-text("Metales")'); await h.wait(500);
  assert.equal(await p.textContent('#ring-label'), '3 clases');

  // with a target, a thin outer ring
  assert.equal(await p.$$eval('.ring-target', e => e.length), 0);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('portfolio.v1')); s.settings.targets = { crypto: 50, metal: 30, cash: 20 }; localStorage.setItem('portfolio.v1', JSON.stringify(s)); });
  await p.reload(); await h.wait(2500);
  assert.equal(await p.$$eval('.ring-target', e => e.length), 3);
  assert.deepEqual(h.errors, []);
  await h.close();
});
