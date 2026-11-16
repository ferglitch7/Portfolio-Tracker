// Trade history: buys and sells from the detail sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

const ops = p => p.$$eval('.ops .op', els => els.map(e => e.querySelector('.op-kind').textContent + ' ' + e.querySelector('.op-qty').textContent + ' ' + e.querySelector('.op-at').textContent));
const field = (p, label) => p.$eval(`.sheet .field:has(.field-label:text-is("${label}")) .field-value`, e => e.textContent);

test('sell, buy, edit and delete trades; position follows', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await p.tap('.row:has-text("Bitcoin") .row-main'); await h.wait(1500);
  assert.ok(await p.isVisible('.sheet .btn-secondary:has-text("Editar")'), 'plain position can still be edited');

  // sell 0,4 at 90.000: realized (90.000 − 50.000) × 0,4 = 16.000
  await p.tap('.op-add:has-text("Registrar venta")'); await h.wait(900);
  await p.fill('#tr-qty', '0,4'); await p.fill('#tr-price', '90.000'); await h.wait(200);
  assert.match(await p.textContent('.sheet-view:last-child p.hint'), /\+\$16\.000,00/);
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '0,6 BTC');
  assert.equal(await field(p, 'Ganancia realizada'), '+$16.000,00');
  assert.equal(await field(p, 'Costo promedio'), '$50.000,00');
  assert.equal(await p.isVisible('.sheet .btn-secondary:has-text("Editar")'), false, 'quantity now comes from the trades');
  assert.deepEqual(await ops(p), ['Venta −0,4 BTC $90.000,00', 'Posición inicial +1 BTC $50.000,00']);

  // buy 0,4 at 80.000: average (0,6×50.000 + 0,4×80.000) / 1 = 62.000
  await p.tap('.op-add:has-text("Registrar compra")'); await h.wait(900);
  await p.fill('#tr-qty', '0,4'); await p.fill('#tr-price', '80.000');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '1 BTC');
  assert.equal(await field(p, 'Costo promedio'), '$62.000,00');

  // overselling is refused
  await p.tap('.op-add:has-text("Registrar venta")'); await h.wait(900);
  await p.fill('#tr-qty', '5'); await h.wait(200);
  assert.ok(await p.isDisabled('.sheet-foot .btn-primary'));
  assert.match(await p.textContent('.sheet-view:last-child p.hint'), /tenías 1 BTC/);
  await p.tap('.sheet-view:last-child .back'); await h.wait(800);

  // the opening entry cannot be deleted while a sale depends on it... (sale of 0,4 needs it)
  await p.tap('.ops .op:has-text("Posición inicial")'); await h.wait(900);
  await p.tap('.sheet-view:last-child .btn-text.danger'); await h.wait(500);
  assert.match(await p.textContent('.toast'), /venta/);
  await p.tap('.sheet-view:last-child .back'); await h.wait(800);

  // delete the sale, then undo
  await p.tap('.ops .op:has-text("Venta")'); await h.wait(900);
  await p.tap('.sheet-view:last-child .btn-text.danger'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '1,4 BTC');
  assert.equal(await p.isVisible('.sheet .field:has-text("Ganancia realizada")'), false);
  await p.tap('.toast-action'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '1 BTC');

  // edit the buy: 0,4 → 0,9
  await p.tap('.ops .op:has-text("Compra")'); await h.wait(900);
  assert.equal(await p.inputValue('#tr-qty'), '0,4');
  await p.fill('#tr-qty', '0,9');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '1,5 BTC');
  await p.keyboard.press('Escape'); await h.wait(900);
  assert.equal(await h.balance(), '$160.000,00');
  const st = (await h.stored()).holdings.find(x => x.id === BTC.id);
  assert.equal(st.tx.length, 3);
  assert.equal(st.qty, 1.5);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('buying again from the + sheet records a trade; gold trades in grams', async () => {
  const h = await phone(env, { seed: { holdings: [{ ...GOLD, unit: 'g' }], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await h.add('Bitcoin', '1', { cost: '50000' });
  await h.add('Bitcoin', '1', { cost: '70000' });
  let btc = (await h.stored()).holdings.find(x => x.id === BTC.id);
  assert.equal(btc.qty, 2); assert.equal(btc.cost, 60000);
  assert.equal(btc.tx.length, 2, 'opening + second buy');

  await p.tap('.row:has-text("Oro") .row-main'); await h.wait(1500);
  await p.tap('.op-add:has-text("Registrar venta")'); await h.wait(900);
  assert.equal(await p.textContent('.sheet-view:last-child .amt-unit'), 'g');
  await p.fill('#tr-qty', '31,1034768'); await p.fill('#tr-price', '150');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  const gold = (await h.stored()).holdings.find(x => x.id === GOLD.id);
  assert.ok(Math.abs(gold.qty - 9) < 1e-6, `9 oz left, got ${gold.qty}`);
  assert.ok(Math.abs(gold.tx[1].price - 150 * 31.1034768) < 1e-3, 'price per gram stored per ounce');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('income: a dividend, a staking reward and interest on cash', async () => {
  const AAPL = { id: 'stock:AAPL', kind: 'stock', sym: 'AAPL', name: 'Apple', qty: 10, cost: 150 };
  const ETH = { id: 'crypto:ethereum', kind: 'crypto', sym: 'ETH', name: 'Ethereum', cg: 'ethereum', cb: 'ETH-USD', qty: 10, cost: 2000 };
  const h = await phone(env, { seed: { holdings: [AAPL, ETH, CASH], settings: { finnhubKey: 'test' } } });
  const { p } = h;
  await h.wait(3000);

  // dividend: an amount, the shares do not change
  await p.tap('.row:has-text("Apple") .row-main'); await h.wait(1500);
  await p.tap('.op-add:has-text("Registrar dividendo")'); await h.wait(900);
  assert.equal(await p.textContent('.sheet-view:last-child .amt-unit'), 'USD');
  assert.equal(await p.isVisible('#tr-price'), false);
  await p.fill('#tr-qty', '25');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '10 AAPL');
  assert.equal(await field(p, 'Dividendos'), '+$25,00');
  await p.keyboard.press('Escape'); await h.wait(900);

  // reward: 1 ETH at 3.000 joins the position: cost (10×2.000 + 3.000) / 11
  await p.tap('.row:has-text("Ethereum") .row-main'); await h.wait(1500);
  await p.tap('.op-add:has-text("Registrar recompensa")'); await h.wait(900);
  await p.fill('#tr-qty', '1');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  assert.equal(await field(p, 'Cantidad'), '11 ETH');
  assert.equal(await field(p, 'Recompensas'), '+$3.000,00');
  assert.equal(await field(p, 'Costo promedio'), '$2.090,91');
  await p.keyboard.press('Escape'); await h.wait(900);

  // cash: no manual interest entry; the balance edit is recorded once there is history
  await p.tap('.row:has-text("Cash") .row-main'); await h.wait(1200);
  assert.equal(await p.$$eval('.sheet .op-add', e => e.length), 0);
  assert.doesNotMatch(await p.textContent('.sheet'), /null/);
  assert.equal(await p.isVisible('.sheet .field:has-text("Peso")'), false, 'no weight row');
  await p.keyboard.press('Escape'); await h.wait(900);

  // summary under Rendimiento: 25 + 3.000 + 40
  await p.$eval('#perf', e => e.scrollIntoView()); await h.wait(300);
  assert.match(await p.textContent('#perf-income'), /\+\$3\.025/);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('savings interest: set a rate, credited monthly, shown as income', async () => {
  const DAY = 86400e3;
  const from = Date.now() - 65 * DAY; // two full months ago
  const h = await phone(env, { seed: { holdings: [{ ...CASH, apy: 4.5, apyFrom: from }], settings: {} } });
  const { p } = h;
  await h.wait(3500);
  let cash = (await h.stored()).holdings[0];
  const credits = cash.tx.filter(x => x.side === 'income');
  assert.equal(credits.length, 2, 'two monthly credits');
  assert.ok(cash.qty > 10073 && cash.qty < 10074, `balance ${cash.qty}`);
  await p.tap('.row:has-text("Cash") .row-main'); await h.wait(1200);
  assert.equal(await field(p, 'Interés anual'), '4,5 %');
  assert.match(await p.textContent('.sheet'), /Próximo abono/);
  assert.deepEqual(await p.$$eval('.ops .op .op-kind', e => e.map(x => x.textContent)), ['Interés', 'Interés', 'Saldo inicial']);
  assert.match(await field(p, 'Intereses'), /^\+\$73,/);

  // change the rate, then remove it
  await p.tap('#apy-field'); await h.wait(900);
  await p.fill('#apy-input', '5');
  assert.match(await p.textContent('.sheet-view:last-child .amt-value'), /al mes/);
  await p.tap('.sheet-foot .btn-primary'); await h.wait(900);
  cash = (await h.stored()).holdings[0];
  assert.equal(cash.apy, 5);
  await p.tap('#apy-field'); await h.wait(900);
  await p.tap('.sheet-view:last-child .btn-text.danger'); await h.wait(900);
  assert.equal(await field(p, 'Interés anual'), 'Añadir');
  assert.equal((await h.stored()).holdings[0].apy, undefined);
  assert.deepEqual(h.errors, []);
  await h.close();
});
