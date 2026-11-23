// Cards lean towards the finger when pressed; the list spells out quantity × price.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('asset rows: the asset on the left (price, change), yours on the right (value, quantity)', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, { ...GOLD, unit: 'g' }, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  const cell = (name, sel) => p.$eval(`.row:has-text("${name}") ${sel}`, e => e.textContent);
  assert.equal(await cell('Bitcoin', '.row-sub'), '$100.000+2,04%', 'price and today on the left');
  assert.equal(await cell('Bitcoin', '.row-pct'), '+2,04%');
  assert.equal(await cell('Bitcoin', '.row-val'), '$100.000,00', 'your value on the right');
  assert.equal(await cell('Bitcoin', '.row-chg'), '1 BTC', 'your quantity under it');
  assert.match(await cell('Oro', '.row-sub'), /^\$128,6\d/, 'gold in grams shows the price per gram');
  assert.match(await cell('Oro', '.row-chg'), /^311,03\d* g$/);
  assert.equal(await cell('Cash', '.row-sub'), '10.000 USD', 'cash keeps its balance on the left');
  assert.doesNotMatch(await p.textContent('#list'), /×/);
  await h.close();
});

test('a pressed card leans towards the finger and springs back', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  await p.$eval('#goal', e => e.scrollIntoView({ block: 'center' })); await h.wait(300);
  const b = await p.locator('#goal').boundingBox();
  await p.mouse.move(b.x + b.width - 10, b.y + 10);
  await p.mouse.down(); await h.wait(250);
  const t = await p.$eval('#goal', e => e.style.transform);
  assert.match(t, /rotateX\(([\d.]+)deg\) rotateY\(([\d.]+)deg\)/, `pressed: ${t}`);
  const [, rx, ry] = t.match(/rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/).map(Number);
  assert.ok(rx > 0 && rx <= 4 && ry > 0 && ry <= 4, `leans towards the top-right corner, gently: ${rx}, ${ry}`);
  await p.mouse.up(); await h.wait(100);
  assert.equal(await p.$eval('#goal', e => e.style.transform), '', 'released');
  assert.equal(await h.sheets(), 1, 'a tap still opens the goal');
  await h.close();
});
