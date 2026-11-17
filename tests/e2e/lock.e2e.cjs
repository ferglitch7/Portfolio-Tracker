// Face ID lock, with Chromium's virtual authenticator standing in for Face ID.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('turn on, locked on launch, unlock; failures; set up again; turn off', async () => {
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} }, host: 'localhost' });
  const { p, cdp } = h;
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const face = ok => cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: ok });
  const locked = () => p.evaluate(() => !!document.querySelector('#lock:not(.out)'));
  await p.reload(); await h.wait(2000);
  assert.equal(await locked(), false, 'off by default');

  // turn it on in Ajustes
  await p.tap('#btn-settings'); await h.wait(800);
  assert.ok(await p.isVisible('#lock-row'), 'offered where the device can check its owner');
  await p.tap('#lock-row .switch'); await h.wait(1200);
  assert.equal(await p.$eval('#lock-row .switch', e => e.getAttribute('aria-checked')), 'true');
  assert.ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('portfolio.lock')).id));
  assert.doesNotMatch(await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('portfolio.v1')))), /portfolio\.lock/);

  // launch: locked, then Face ID unlocks by itself
  await p.reload(); await h.wait(300);
  assert.equal(await locked(), true, 'locked on launch');
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('app')).visibility), 'hidden', 'nothing visible behind');
  await h.wait(1500);
  assert.equal(await locked(), false, 'unlocked with Face ID');

  // a face that does not match: stays locked; after two tries, offer to set it up again
  await face(false);
  await p.reload(); await h.wait(1500);
  assert.equal(await locked(), true);
  await p.tap('#unlock'); await h.wait(800);
  assert.match(await p.textContent('.lock-msg'), /No se pudo/);
  assert.equal(await p.isVisible('#lock-reset'), false);
  await p.tap('#unlock'); await h.wait(800);
  assert.ok(await p.isVisible('#lock-reset'));
  assert.equal(await locked(), true);
  // setting it up again also needs the owner
  await p.tap('#lock-reset'); await h.wait(800);
  assert.equal(await locked(), true, 'a new passkey needs the owner too');
  await face(true);
  await p.tap('#lock-reset'); await h.wait(1000);
  assert.equal(await locked(), false);

  // turning it off needs Face ID
  await p.tap('#btn-settings'); await h.wait(800);
  await face(false);
  await p.tap('#lock-row .switch'); await h.wait(1000);
  assert.equal(await p.$eval('#lock-row .switch', e => e.getAttribute('aria-checked')), 'true', 'still on');
  await face(true);
  await p.tap('#lock-row .switch'); await h.wait(1000);
  assert.equal(await p.$eval('#lock-row .switch', e => e.getAttribute('aria-checked')), 'false');
  assert.equal(await p.evaluate(() => localStorage.getItem('portfolio.lock')), null);
  assert.deepEqual(h.errors.filter(e => !/NotAllowed/.test(e)), []);
  await h.close();
});

test('not offered where the device cannot check its owner', async () => {
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} }, host: 'localhost' });
  await h.wait(1500);
  await h.p.tap('#btn-settings'); await h.wait(800);
  assert.equal(await h.p.isVisible('#lock-row'), false);
  await h.close();
});
