// Touch gestures, the way a phone sends them (CDP touch events).
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, ETH, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());
const seed = { holdings: [BTC, ETH, GOLD, CASH], settings: {} };

test('home chart: sideways scrubs, vertical scrolls the page', async () => {
  const h = await phone(env, { seed });
  const { p, cdp } = h;
  await h.wait(3000);
  const hc = await p.locator('#pchart').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hc.x + 80, y: hc.y + 80 }] });
  for (const [x, y] of h.line(hc.x + 80, hc.y + 80, hc.x + 200, hc.y + 90, 8)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await h.wait(16); }
  await h.wait(200);
  assert.ok(await p.$eval('#pchart', e => e.classList.contains('scrubbing')));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await h.wait(500);
  assert.equal(await p.$eval('#pchart', e => e.classList.contains('scrubbing')), false);
  await h.touch(h.line(hc.x + 150, hc.y + 120, hc.x + 152, hc.y - 60, 10), 12); await h.wait(500);
  assert.ok(await p.$eval('#scroll', e => e.scrollTop) > 50, 'page scrolled');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('row swipe reveals actions, Edit pushes the editor, edge swipe goes back, drag down dismisses', async () => {
  const h = await phone(env, { seed });
  const { p } = h;
  await h.wait(3000);
  await p.$eval('.row:has-text("Ethereum")', e => e.scrollIntoView({ block: 'center' })); await h.wait(400);
  let rb = await p.locator('.row:has-text("Ethereum") .row-main').boundingBox();
  let y = rb.y + rb.height / 2;
  await h.touch(h.line(rb.x + rb.width - 40, y, rb.x + rb.width - 170, y)); await h.wait(700);
  assert.match(await p.$eval('.row:has-text("Ethereum") .row-main', e => e.style.transform), /translate.*-\d/);

  // a vertical scroll closes the open row and is not captured by it
  const before = await p.$eval('#scroll', e => e.scrollTop);
  await h.touch(h.line(200, 350, 200, 650, 12)); await h.wait(600);
  assert.ok(await p.$eval('#scroll', e => e.scrollTop) < before, 'page scrolled');
  assert.equal(await p.$eval('.row:has-text("Ethereum") .row-main', e => e.style.transform || 'none').then(t => /-\d/.test(t)), false, 'open row closed');

  await p.$eval('.row:has-text("Ethereum")', e => e.scrollIntoView({ block: 'center' })); await h.wait(400);
  rb = await p.locator('.row:has-text("Ethereum") .row-main').boundingBox(); y = rb.y + rb.height / 2;
  await h.touch(h.line(rb.x + rb.width - 40, y, rb.x + rb.width - 170, y)); await h.wait(600);
  await p.tap('.row:has-text("Ethereum") .act.edit'); await h.wait(1300);
  assert.equal(await p.$$eval('.sheet-view', v => v.length), 2);
  assert.equal(await p.inputValue('#amt-qty'), '2');
  const sb = await p.locator('.sheet').boundingBox();
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await h.touch(h.line(sb.x + 6, sb.y + 300, sb.x + 300, sb.y + 300, 12)); await h.wait(1200);
  assert.equal(await p.$$eval('.sheet-view', v => v.length), 1, 'edge swipe returns to the detail');
  await h.touch(h.line(sb.x + 200, sb.y + 420, sb.x + 200, sb.y + 760, 12)); await h.wait(1200);
  assert.equal(await h.sheets(), 0, 'drag down dismisses the sheet');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('detail chart scrub by touch does not move the sheet', async () => {
  const h = await phone(env, { seed });
  const { p, cdp } = h;
  await h.wait(2500);
  await p.tap('.row:has-text("Bitcoin") .row-main'); await h.wait(2000);
  const cb = await p.locator('.sheet .chart').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cb.x + 100, y: cb.y + 90 }] });
  for (const [x, y] of h.line(cb.x + 100, cb.y + 90, cb.x + 220, cb.y + 150, 8)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  await h.wait(200);
  assert.ok(await p.$eval('.sheet .chart', e => e.classList.contains('scrubbing')));
  assert.doesNotMatch(await p.$eval('.sheet', e => e.style.transform), /translateY\([1-9]/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await h.close();
});

test('hold and drag reorders; order persists; "sort by value" restores it', async () => {
  const h = await phone(env, { seed });
  const { p, cdp } = h;
  await h.wait(3000);
  assert.deepEqual(await h.names(), ['Bitcoin', 'Oro', 'Cash', 'Ethereum']);
  await p.$eval('#list', e => e.scrollIntoView({ block: 'center' })); await h.wait(500);
  const rows = await p.$$eval('#list .row', els => els.map(e => { const r = e.getBoundingClientRect(); return { y: r.top + r.height / 2, h: r.height }; }));
  const eth = rows[3], x = 120;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: eth.y }] });
  await h.wait(600);
  assert.ok(await p.$eval('.row:has-text("Ethereum")', e => e.classList.contains('lifted')));
  const ty = rows[0].y - eth.h * 0.3;
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: eth.y + (ty - eth.y) * i / 12 }] }); await h.wait(25); }
  await h.wait(200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await h.wait(900);
  assert.deepEqual(await h.names(), ['Ethereum', 'Bitcoin', 'Oro', 'Cash']);
  assert.equal(await h.sheets(), 0, 'dropping does not open the asset');
  await p.reload(); await h.wait(2500);
  assert.deepEqual(await h.names(), ['Ethereum', 'Bitcoin', 'Oro', 'Cash']);

  await p.tap('#btn-settings'); await h.wait(800);
  assert.equal(await p.$eval('.field:has-text("Ordenar por valor") .switch', e => e.getAttribute('aria-checked')), 'false');
  await p.tap('.field:has-text("Ordenar por valor") .switch'); await h.wait(300);
  await p.keyboard.press('Escape'); await h.wait(1000);
  assert.deepEqual(await h.names(), ['Bitcoin', 'Oro', 'Cash', 'Ethereum']);
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('trend lines line up in one column whatever the amount width', async () => {
  const XRP = { id: 'crypto:ripple', kind: 'crypto', sym: 'XRP', name: 'XRP', cg: 'ripple', cb: 'XRP-USD', qty: 34.63, cost: null };
  const h = await phone(env, { seed: { holdings: [BTC, XRP, GOLD, CASH], settings: {} } });
  await h.wait(3500);
  const xs = await h.p.$$eval('#list .spark.on', s => s.map(e => Math.round(e.getBoundingClientRect().left)));
  assert.ok(xs.length >= 3, `sparklines drawn: ${xs.length}`);
  assert.equal(new Set(xs).size, 1, `same x for all: ${xs}`);
  await h.close();
});
