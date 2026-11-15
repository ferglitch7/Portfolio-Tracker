// Goal, retirement plans, Cash, performance card, demo mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, ETH, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('goal: create, projection reacts, saved, removed', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await p.tap('#goal'); await h.wait(1000);
  const before = await p.textContent('.goal-when-sub');
  await p.fill('#goal-monthly', '1000'); await h.wait(400);
  assert.notEqual(await p.textContent('.goal-when-sub'), before, 'saving monthly changes the projection');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(1200);
  const g = (await h.stored()).settings.goal;
  assert.equal(g.amount, 1000000);
  assert.equal(g.monthly, 1000);
  assert.match(await p.textContent('#goal'), /15%|15 %/, '150k of 1M');
  await p.tap('#goal'); await h.wait(900);
  await p.tap('.sheet-foot .btn-text.danger'); await h.wait(1000);
  assert.equal((await h.stored()).settings.goal, null);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('retirement plan follows its index; a fixed plan stays put', async () => {
  const h = await phone(env, { seed: { holdings: [CASH], settings: { finnhubKey: 'test' } } });
  const { p } = h;
  await h.wait(2000);
  await p.tap('#btn-add'); await h.wait(600);
  await p.tap('.seg button:has-text("Retiro")'); await h.wait(300);
  const providers = await p.$$eval('.pick-list .pick-name', e => e.map(x => x.textContent));
  assert.ok(providers.includes('Vanguard') && providers.includes('Fidelity'));
  await p.tap('.pick:has-text("Vanguard")'); await h.wait(800);
  await p.fill('#amt-qty', '85.000'); await p.fill('#amt-cost', '60.000');
  await p.tap('.sheet-foot .btn-primary'); await h.wait(2500);
  const plan = (await h.stored()).holdings.find(x => x.kind === 'retire');
  assert.equal(plan.balance, 85000);
  assert.equal(plan.track, 'VOO');
  assert.equal(plan.ref, 610, 'anchored to the index price when saved');

  await p.tap('#btn-add'); await h.wait(600);
  await p.tap('.seg button:has-text("Retiro")'); await h.wait(300);
  await p.tap('.pick:has-text("Fidelity")'); await h.wait(800);
  await p.tap('.sheet .seg button:has-text("Roth IRA")'); await h.wait(200);
  await p.tap('.sheet .seg button:has-text("Nada")'); await h.wait(200);
  await p.fill('#amt-qty', '12.500');
  assert.match(await p.inputValue('#amt-name'), /Roth IRA/);
  await p.tap('.sheet-foot .btn-primary'); await h.wait(1500);
  assert.equal(await h.balance(), '$107.500,00');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('one Cash item, found by its aliases; old "Dólar" is renamed', async () => {
  const h = await phone(env, { seed: { holdings: [{ ...CASH, name: 'Dólar', flag: 'us' }], settings: {} } });
  const { p } = h;
  await h.wait(2000);
  assert.deepEqual(await h.names(), ['Cash']);
  await p.tap('#btn-add'); await h.wait(600);
  await p.tap('.seg button:has-text("Efectivo")'); await h.wait(300);
  assert.deepEqual(await p.$$eval('.pick-list .pick-name', e => e.filter(x => x.offsetParent).map(x => x.textContent)), ['Cash']);
  await p.tap('.seg button:has-text("Todo")'); await h.wait(300);
  for (const q of ['cash', 'efectivo', 'dólar']) {
    await p.fill('#add-search', q); await h.wait(400);
    assert.equal(await p.$eval('.pick-list .pick-name', e => e.textContent), 'Cash', `search "${q}"`);
  }
  await h.close();
});

test('performance card: tabs show best and worst, numbers fit', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, ETH, GOLD, CASH], settings: {} } });
  const { p } = h;
  await h.wait(4000);
  const tiles = await p.$$eval('.perf-tile', t => t.map(x => x.textContent));
  assert.equal(tiles.length, 4);
  assert.match(tiles[0], /Hoy/);
  // Hoy: BTC +2,04 % is best, ETH −1,96 % worst; cash never counts
  const hoy = await p.textContent('#perf-line');
  assert.match(hoy, /Bitcoin/); assert.match(hoy, /Ethereum/); assert.doesNotMatch(hoy, /Cash/);
  await p.tap('.perf-tile:has-text("1 año")'); await h.wait(800);
  assert.ok((await p.textContent('#perf-line')).length > 0);
  const overflow = await p.$$eval('.perf-tile', t => t.some(x => x.scrollWidth > x.clientWidth + 1));
  assert.equal(overflow, false, 'no tile overflows');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('example mode never saves anything', async () => {
  const h = await phone(env);
  const { p } = h;
  await h.wait(1000);
  await p.tap('#empty-demo'); await h.wait(2500);
  assert.ok((await h.names()).length > 3);
  assert.ok(await p.isVisible('#demo-bar'));
  await p.tap('#demo-exit'); await h.wait(600);
  assert.ok(await p.isVisible('#empty'));
  assert.equal(((await h.stored()).holdings || []).length, 0);
  await h.close();
});
