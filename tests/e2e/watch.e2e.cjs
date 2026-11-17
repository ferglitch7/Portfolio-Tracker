// Watchlist: follow without holding, see the price, buy it, stop following.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

const watchNames = p => p.$$eval('#watch-list .row-name', e => e.map(x => x.textContent));

test('follow, open, buy and stop following', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  assert.equal(await p.isVisible('#watch'), false, 'no section while nothing is followed');

  // follow Ethereum and Solana from the + sheet
  for (const name of ['Ethereum', 'Solana']) {
    await p.tap('#btn-add'); await h.wait(600);
    await p.tap(`.pick:has-text("${name}")`); await h.wait(800);
    await p.tap('#amt-watch'); await h.wait(900);
  }
  assert.deepEqual(await watchNames(p), ['Ethereum', 'Solana']);
  assert.equal(await h.balance(), '$110.000,00', 'followed assets do not count');
  assert.deepEqual(await h.names(), ['Bitcoin', 'Cash']);
  assert.equal(await p.$eval('#watch-list .row:has-text("Ethereum") .row-val', e => e.textContent), '$3.000,00');
  assert.match(await p.$eval('#watch-list .row:has-text("Ethereum") .row-chg', e => e.textContent), /−1,96/);
  await p.reload(); await h.wait(2500);
  assert.deepEqual(await watchNames(p), ['Ethereum', 'Solana'], 'kept after reload');

  // the detail: price, chart; stop following and undo
  await p.tap('#watch-list .row:has-text("Solana") .row-main'); await h.wait(1500);
  assert.equal(await p.textContent('.detail-price .big'), '$150,00');
  assert.ok((await p.$eval('.sheet .chart-line', e => e.getAttribute('d') || '')).length > 50);
  await p.tap('#unwatch'); await h.wait(900);
  assert.deepEqual(await watchNames(p), ['Ethereum']);
  await p.tap('.toast-action'); await h.wait(700);
  assert.deepEqual(await watchNames(p), ['Ethereum', 'Solana']);

  // buying a followed asset moves it to the list
  await p.tap('#watch-list .row:has-text("Ethereum") .row-main'); await h.wait(1200);
  await p.tap('.sheet .btn-secondary:has-text("Comprar")'); await h.wait(900);
  await p.fill('#amt-qty', '2');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(1200);
  assert.deepEqual(await watchNames(p), ['Solana']);
  assert.ok((await h.names()).includes('Ethereum'));
  assert.equal(await h.balance(), '$116.000,00');

  // the copy carries the watchlist; Borrar todo clears it
  const st = await h.stored();
  assert.deepEqual(st.watch.map(a => a.id), ['crypto:solana']);
  assert.deepEqual(h.errors, []);
  await h.close();
});
