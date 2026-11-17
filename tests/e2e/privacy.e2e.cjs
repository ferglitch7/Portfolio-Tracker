// The curtain that hides amounts in the app switcher.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('leaving the app covers it; coming back uncovers it', async () => {
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} } });
  const { p } = h;
  await h.wait(2000);
  const on = () => p.evaluate(() => !!document.querySelector('#curtain.on'));
  assert.equal(await on(), false);
  await p.evaluate(() => dispatchEvent(new Event('blur')));
  assert.equal(await on(), true, 'covered as the app switcher opens');
  const opaque = await p.$eval('#curtain', e => getComputedStyle(e).opacity);
  assert.equal(opaque, '1', 'fully opaque at once, before the snapshot');
  await p.evaluate(() => dispatchEvent(new Event('focus')));
  await h.wait(400);
  assert.equal(await on(), false);
  assert.deepEqual(h.errors, []);
  await h.close();
});
