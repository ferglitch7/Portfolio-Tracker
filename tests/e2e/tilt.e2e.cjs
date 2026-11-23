// Cards lean towards the finger when pressed; the list spells out quantity × price.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('asset rows read "quantity × price", so the amount on the right is your value', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, { ...GOLD, unit: 'g' }, CASH], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  const sub = name => p.$eval(`.row:has-text("${name}") .row-sub`, e => e.textContent);
  assert.equal(await sub('Bitcoin'), '1 BTC × $100.000');
  assert.match(await sub('Oro'), /^311,03\d* g × \$128,6\d$/, 'gold in grams shows the price per gram');
  assert.equal(await sub('Cash'), '10.000 USD', 'cash has no price to multiply');
  assert.equal(await p.$eval('.row:has-text("Bitcoin") .row-val', e => e.textContent), '$100.000,00');
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
