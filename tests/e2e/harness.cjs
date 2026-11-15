// Shared set-up for the browser tests: a local server, a phone-sized page and
// a fake market. No request leaves the machine, so results never depend on the
// network, rate limits or what the market did today.
//
//   node --test tests/e2e/         (needs Playwright with Chromium)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(ROOT, path.normalize(rel));
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ---------- the fake market ----------------------------------------------------

/** Prices "now" and 24 h ago. History is a smooth line ending at `now`. */
const MARKET = {
  'BTC-USD': { now: 100000, open: 98000 },
  'ETH-USD': { now: 3000, open: 3060 },
  'SOL-USD': { now: 150, open: 145 },
  'PAXG-USD': { now: 4010, open: 3990 },
  XAU: { now: 4000 }, XAG: { now: 50 }, XPT: { now: 1500 }, XPD: { now: 1200 },
  AAPL: { now: 200, open: 198 }, VOO: { now: 610, open: 605 }, SLV: { now: 46, open: 45 },
};
const DAY = 86400e3;
// Value of a symbol `ago` ms in the past: one year ago it was 60 % of today.
const past = (sym, ago) => (MARKET[sym] || { now: 100 }).now * (1 - 0.4 * Math.min(1, ago / (365 * DAY)));

const json = body => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

function answer(url) {
  const u = new URL(url);
  const h = u.hostname;
  if (h === 'api.exchange.coinbase.com') {
    const m = u.pathname.match(/^\/products\/([^/]+)\/(stats|candles)$/);
    const sym = m && m[1];
    if (!m || !MARKET[sym]) return { status: 404, body: '{}' };
    if (m[2] === 'stats') return json({ last: String(MARKET[sym].now), open: String(MARKET[sym].open) });
    const g = Number(u.searchParams.get('granularity')) * 1000;
    const s = Date.parse(u.searchParams.get('start')), e = Date.parse(u.searchParams.get('end'));
    const out = [];
    for (let t = e; t >= s; t -= g) { const p = past(sym, Date.now() - t); out.push([Math.floor(t / 1000), p, p, p, p, 1]); }
    return json(out);
  }
  if (h === 'api.coingecko.com') {
    if (u.pathname.endsWith('/simple/price')) {
      const out = {};
      for (const id of (u.searchParams.get('ids') || '').split(',')) out[id] = { usd: 1, usd_24h_change: 0 };
      return json(out);
    }
    if (u.pathname.endsWith('/search')) return json({ coins: [] });
    return json({ prices: [] });
  }
  if (h === 'api.gold-api.com') {
    const sym = u.pathname.split('/').pop();
    return json({ price: (MARKET[sym] || { now: 1 }).now });
  }
  if (h === 'finnhub.io') {
    if (u.pathname.endsWith('/quote')) {
      const m = MARKET[u.searchParams.get('symbol')] || { now: 100, open: 99 };
      return json({ c: m.now, pc: m.open, h: 0, l: 0 });
    }
    return json({ result: [] });
  }
  if (h === 'api.twelvedata.com') {
    const sym = u.searchParams.get('symbol');
    const n = Number(u.searchParams.get('outputsize')) || 30;
    const step = u.searchParams.get('interval') === '1day' ? DAY : 3600e3;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = Date.now() - i * step;
      values.push({ datetime: new Date(t).toISOString().slice(0, step === DAY ? 10 : 19).replace('T', ' '), close: String(past(sym, i * step)) });
    }
    return json({ status: 'ok', values });
  }
  if (h === 'open.er-api.com') return json({ result: 'success', rates: { USD: 1, EUR: 0.9, MXN: 18, CLP: 950, GBP: 0.78, JPY: 150 } });
  return { status: 404, body: '' }; // logos and anything else: no network
}

// ---------- browser -------------------------------------------------------------

async function start() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  return {
    base,
    browser,
    async close() { await browser.close(); server.close(); },
  };
}

/**
 * A phone page. `seed` (optional) is written as the saved portfolio before the
 * app starts. Returns helpers bound to that page.
 */
async function phone(env, { seed, extra, hash = '', sw = false, scheme = 'dark' } = {}) {
  const ctx = await env.browser.newContext({
    viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, colorScheme: scheme,
    hasTouch: true, isMobile: true, locale: 'es-MX', serviceWorkers: sw ? 'allow' : 'block', acceptDownloads: true,
  });
  await ctx.route(url => !url.href.startsWith(env.base), route => route.fulfill(answer(route.request().url())));
  await ctx.routeWebSocket(/.*/, ws => ws.close());
  if (seed) await ctx.addInitScript(s => { if (!localStorage.getItem('portfolio.v1')) localStorage.setItem('portfolio.v1', JSON.stringify(s)); }, seed);
  if (extra) await ctx.addInitScript(extra);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|vibrate/.test(m.text())) errors.push(m.text()); });
  await p.goto(env.base + hash);
  const cdp = await ctx.newCDPSession(p);

  const h = {
    p, ctx, cdp, errors,
    wait: ms => p.waitForTimeout(ms),
    names: () => p.$$eval('#list .row-name', e => e.map(x => x.textContent)),
    stored: () => p.evaluate(() => JSON.parse(localStorage.getItem('portfolio.v1') || '{}')),
    balance: () => p.$eval('#roller', e => [...e.querySelectorAll('.slot > span:not(.out)')].map(x => x.textContent).join('')),
    sheets: () => p.$$eval('.sheet', s => s.length),
    async touch(pts, pause = 16) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
      for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(pause); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    line: (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]),
    /** Add an asset from the + sheet. */
    async add(name, qty, { tab, cost } = {}) {
      await p.tap('#btn-add'); await p.waitForTimeout(600);
      if (tab) { await p.tap(`.seg button:has-text("${tab}")`); await p.waitForTimeout(250); }
      await p.tap(`.pick:has-text("${name}")`); await p.waitForTimeout(800);
      await p.fill('#amt-qty', qty);
      if (cost != null) await p.fill('#amt-cost', cost);
      await p.tap('.sheet-foot .btn-primary'); await p.waitForTimeout(1000);
    },
    async close() { await ctx.close(); },
  };
  return h;
}

const BTC = { id: 'crypto:bitcoin', kind: 'crypto', sym: 'BTC', name: 'Bitcoin', cg: 'bitcoin', cb: 'BTC-USD', qty: 1, cost: 50000 };
const ETH = { id: 'crypto:ethereum', kind: 'crypto', sym: 'ETH', name: 'Ethereum', cg: 'ethereum', cb: 'ETH-USD', qty: 2, cost: 2500 };
const GOLD = { id: 'metal:XAU', kind: 'metal', sym: 'XAU', name: 'Oro', el: 'Au', qty: 10, cost: 3000, unit: 'oz' };
const CASH = { id: 'cash:USD', kind: 'cash', sym: 'USD', name: 'Cash', qty: 10000, cost: null };

module.exports = { start, phone, MARKET, BTC, ETH, GOLD, CASH };
