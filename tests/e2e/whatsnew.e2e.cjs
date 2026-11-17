// The "Novedades" card after an update.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

test('after an update with notes, "Novedades" shows once', async () => {
  // Pretend the last version opened was an old one (only on the first load).
  const old = () => { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('portfolio.seenVersion', '2026.01.01-1'); } };
  const h = await phone(env, { seed: { holdings: [BTC], settings: {} }, extra: old });
  const { p } = h;
  await h.wait(2600);
  assert.ok(await p.isVisible('.wn-card'));
  assert.equal(await p.textContent('.wn-title'), 'Novedades');
  assert.ok((await p.$$('.wn-item')).length >= 1);
  await p.tap('.wn-card .btn-primary'); await h.wait(600);
  assert.equal(await p.$('.wn-layer'), null);
  await p.reload(); await h.wait(2600);
  assert.equal(await p.$('.wn-layer'), null, 'not again');

  // the version it brought, and the same card again from Ajustes
  const version = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'version.json'), 'utf8')).version;
  await p.tap('#btn-settings'); await h.wait(800);
  await p.$eval('.sheet-scroll', e => e.scrollTo(0, 99999)); await h.wait(300);
  await p.tap('#set-whatsnew'); await h.wait(700);
  assert.ok(await p.isVisible('.wn-card'));
  assert.equal(await p.textContent('.wn-version'), `Versión ${version}`);
  await p.tap('.wn-card .btn-primary'); await h.wait(600);
  assert.equal(await p.$('.wn-layer'), null);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('a first launch has nothing to announce', async () => {
  const h = await phone(env, { extra: () => { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.removeItem('portfolio.seenVersion'); } } });
  await h.wait(2600);
  assert.equal(await h.p.$('.wn-layer'), null);
  await h.close();
});
