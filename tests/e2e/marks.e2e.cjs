// Buys and sells dotted on the asset chart.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

const DAY = 86400e3;

test('trades show as dots in their range; scrubbing over one names it', async () => {
  const now = Date.now();
  const BTC = {
    id: 'crypto:bitcoin', kind: 'crypto', sym: 'BTC', name: 'Bitcoin', cg: 'bitcoin', cb: 'BTC-USD', qty: 1.5, cost: 70000,
    tx: [
      { id: 'o', t: now - 400 * DAY, side: 'buy', qty: 1, price: 60000, opening: true },
      { id: 'b', t: now - 3 * DAY, side: 'buy', qty: 1, price: 90000 },
      { id: 's', t: now - 20 * DAY, side: 'sell', qty: 0.5, price: 80000 },
    ],
  };
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await p.tap('.row:has-text("Bitcoin") .row-main'); await h.wait(1800);
  const dots = () => p.$$eval('.sheet .chart-mark', e => e.map(x => x.getAttribute('class').replace('chart-mark ', '')));
  assert.deepEqual(await dots(), [], '1D: nothing in the last 24 h');
  await p.tap('.sheet .seg button:has-text("1S")'); await h.wait(1500);
  assert.deepEqual(await dots(), ['buy'], '1S: the buy of 3 days ago');
  await p.tap('.sheet .seg button:has-text("1M")'); await h.wait(1500);
  assert.deepEqual((await dots()).sort(), ['buy', 'sell']);

  // scrub onto the sale
  const dot = await p.locator('.sheet .chart-mark.sell').boundingBox();
  const box = await p.locator('.sheet .chart').boundingBox();
  await p.mouse.move(dot.x + dot.width / 2, box.y + box.height / 2);
  await p.mouse.down(); await p.mouse.move(dot.x + dot.width / 2 + 1, box.y + box.height / 2); await h.wait(200);
  assert.match(await p.textContent('.detail-meta'), /Venta 0,5 BTC · \d\d\/\d\d\/\d{4}/);
  await p.mouse.up();
  assert.deepEqual(h.errors, []);
  await h.close();
});
