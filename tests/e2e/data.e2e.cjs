// Saving: the IndexedDB mirror, versions, the backup reminder, the exported
// file, and the offline shell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { start, phone, BTC, ETH, GOLD } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());
const seed = { holdings: [BTC, ETH, GOLD], settings: { finnhubKey: 'secret-key' } };

test('lost working copy is recovered from the mirror', async () => {
  const h = await phone(env);
  const { p } = h;
  await h.wait(800);
  await h.add('Bitcoin', '1');
  await h.wait(2500); // the mirror is written shortly after a change
  await p.evaluate(() => localStorage.removeItem('portfolio.v1'));
  await p.reload(); await h.wait(2500);
  assert.deepEqual(await h.names(), ['Bitcoin']);
  assert.match(await p.textContent('.toast'), /recuper/i);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('Borrar todo keeps a version that restores everything', async () => {
  const h = await phone(env, { seed });
  const { p } = h;
  await h.wait(3000);
  await p.tap('#btn-settings'); await h.wait(800);
  await p.$eval('.sheet-scroll', e => e.scrollTo(0, 9999)); await h.wait(300);
  await p.tap('button.field.danger'); await h.wait(300); await p.tap('button.field.danger'); await h.wait(1500);
  assert.deepEqual(await h.names(), []);
  await p.tap('.toast-action'); await h.wait(1200);
  const target = p.locator('.sheet button.field:has-text("Antes de borrar")').first();
  await target.tap(); await h.wait(300); await target.tap(); await h.wait(1500);
  assert.deepEqual((await h.names()).sort(), ['Bitcoin', 'Ethereum', 'Oro']);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('backup reminder appears, saving a copy clears it; the file has no keys', async () => {
  const h = await phone(env, { seed, extra: () => { if (!localStorage.getItem('portfolio.since')) localStorage.setItem('portfolio.since', String(Date.now() - 4 * 86400e3)); } });
  const { p } = h;
  await h.wait(2500);
  assert.ok(await p.isVisible('#notice'));
  assert.match(await p.textContent('#notice'), /copia/);
  const dl = p.waitForEvent('download', { timeout: 5000 });
  await p.tap('#notice button');
  const file = await dl; await h.wait(1000);
  assert.equal(await p.isVisible('#notice'), false);
  const txt = fs.readFileSync(await file.path(), 'utf8');
  const j = JSON.parse(txt);
  assert.equal(j.holdings.length, 3);
  assert.doesNotMatch(txt, /secret-key|finnhubKey|historyKey/);
  await h.close();
});

test('imports a saved copy', async () => {
  const h = await phone(env);
  const { p } = h;
  await h.wait(1000);
  const file = { name: 'portfolio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'portfolio', version: 1, holdings: [BTC, GOLD], settings: { ccy: 'USD' } })) };
  await p.tap('#btn-settings'); await h.wait(800);
  await p.$eval('.sheet-scroll', e => e.scrollTo(0, 9999)); await h.wait(300);
  const chooser = p.waitForEvent('filechooser', { timeout: 5000 });
  await p.tap('button.field:has-text("Importar")');
  await (await chooser).setFiles(file); await h.wait(1800);
  assert.deepEqual(await h.names(), ['Bitcoin', 'Oro']);
  await h.close();
});

test('works offline once loaded (service worker)', async () => {
  const h = await phone(env, { seed, sw: true });
  const { p } = h;
  await h.wait(2500);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await h.wait(2000); // now controlled
  await h.ctx.setOffline(true);
  await p.reload(); await h.wait(2000);
  assert.deepEqual((await h.names()).sort(), ['Bitcoin', 'Ethereum', 'Oro']);
  assert.equal(await h.balance(), '$146.000,00', 'last prices are kept offline');
  await h.ctx.setOffline(false);
  await h.close();
});
