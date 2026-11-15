// Core flows: add, merge, edit, detail, delete/undo, filter, settings, persistence.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, ETH, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

const rowsText = p => p.$$eval('#list .row', els => els.map(r => [r.querySelector('.row-name').textContent, r.querySelector('.row-val').textContent].join(' ')));

test('seeded portfolio is valued at market prices, sorted by value', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, ETH, GOLD, CASH], settings: {} } });
  await h.wait(2500);
  assert.equal(await h.balance(), '$156.000,00');
  assert.deepEqual(await rowsText(h.p), ['Bitcoin $100.000,00', 'Oro $40.000,00', 'Cash $10.000,00', 'Ethereum $6.000,00']);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('add, merge a second buy, edit, delete and undo', async () => {
  const h = await phone(env);
  const { p } = h;
  await h.wait(1000);
  assert.ok(await p.isVisible('#empty'));
  await p.tap('#empty-add'); await h.wait(600);
  await p.tap('.pick:has-text("Bitcoin")'); await h.wait(800);
  await p.fill('#amt-qty', '0,5'); await p.fill('#amt-cost', '52000');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(1000);
  await h.add('Bitcoin', '0.5', { cost: '60000' });
  let st = await h.stored();
  assert.equal(st.holdings.length, 1, 'second buy merges into the position');
  assert.equal(st.holdings[0].qty, 1);
  assert.equal(st.holdings[0].cost, 56000, 'average cost is weighted');

  // gold entered in grams is stored in ounces
  await p.tap('#btn-add'); await h.wait(600);
  await p.tap('.seg button:has-text("Metales")'); await h.wait(250);
  await p.tap('.pick:has-text("Oro")'); await h.wait(800);
  await p.tap('.amt-entry .seg button:has-text("g")');
  await p.fill('#amt-qty', '31.1034768');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(1200);
  st = await h.stored();
  const gold = st.holdings.find(x => x.id === 'metal:XAU');
  assert.ok(Math.abs(gold.qty - 1) < 1e-6, `1 oz expected, got ${gold.qty}`);
  assert.equal(await h.balance(), '$104.000,00');

  // detail, then edit from it
  await p.tap('.row:has-text("Bitcoin") .row-main'); await h.wait(2000);
  assert.equal(await p.textContent('.detail-price .big'), '$100.000,00');
  assert.ok((await p.$eval('.sheet .chart-line', e => e.getAttribute('d') || '')).length > 50, 'chart drawn');
  for (const r of ['1S', '1A']) { await p.tap(`.sheet .seg button:has-text("${r}")`); await h.wait(900); }
  await p.keyboard.press('Escape'); await h.wait(900);
  // a position without trades is edited directly (gold, shown in grams)
  await p.tap('.row:has-text("Oro") .row-main'); await h.wait(1200);
  await p.tap('.sheet .btn-secondary:has-text("Editar")'); await h.wait(900);
  assert.equal(await p.inputValue('#amt-qty'), '31,1034768');
  await p.fill('#amt-qty', '62,2069536');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  await p.keyboard.press('Escape'); await h.wait(900);
  assert.ok(Math.abs((await h.stored()).holdings.find(x => x.id === 'metal:XAU').qty - 2) < 1e-6);
  assert.equal(await h.balance(), '$108.000,00');

  // full swipe deletes, undo restores
  const rb = await p.locator('.row:has-text("Oro") .row-main').boundingBox();
  const y = rb.y + rb.height / 2;
  await p.mouse.move(rb.x + rb.width - 30, y); await p.mouse.down(); await p.mouse.move(rb.x + 10, y, { steps: 12 }); await p.mouse.up(); await h.wait(900);
  assert.deepEqual(await h.names(), ['Bitcoin']);
  await p.tap('.toast-action'); await h.wait(900);
  assert.deepEqual(await h.names(), ['Bitcoin', 'Oro']);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('settings: currency, number style, sort, privacy; all persist', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await p.tap('.chip:has-text("Metales")'); await h.wait(600);
  assert.deepEqual(await h.names(), ['Oro'], 'allocation chip filters the list');
  await p.tap('.chip:has-text("Metales")'); await h.wait(500);

  await p.tap('#btn-settings'); await h.wait(800);
  await p.tap('button.field:has-text("Moneda")'); await h.wait(900);
  await p.tap('button.field:has-text("Peso mexicano")'); await h.wait(900);
  await p.tap('.field.numbers .seg button:has-text("1,234.50")'); await h.wait(300);
  await p.tap('.field:has-text("Ocultar importes") .switch'); await h.wait(300);
  await p.keyboard.press('Escape'); await h.wait(1200);
  assert.ok(await p.$eval('#list', e => e.classList.contains('masked')), 'list amounts masked');
  assert.match(await h.balance(), /•/, 'balance hidden');
  await p.tap('#balance'); await h.wait(500);
  assert.match(await h.balance(), /^(MX)?\$2,700,000\.00$/, 'a tap shows amounts again');
  await p.tap('#btn-settings'); await h.wait(800);
  await p.tap('.field:has-text("Ocultar importes") .switch'); await h.wait(300);
  await p.keyboard.press('Escape'); await h.wait(900);
  await p.reload(); await h.wait(2500);
  const s = (await h.stored()).settings;
  assert.equal(s.ccy, 'MXN');
  assert.equal(s.numbers, 'comma');
  assert.equal(s.hidden, true);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('tapping the change pill switches today / total return', async () => {
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} } });
  await h.wait(2500);
  const today = await h.p.textContent('#change');
  await h.p.tap('#change'); await h.wait(500);
  const total = await h.p.textContent('#change');
  assert.notEqual(today, total);
  assert.match(total, /50\.000|100,00/, `total return should be +$50.000 / +100 %: ${total}`);
  await h.close();
});
