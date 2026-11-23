// Captures the screens and the boxes of the layers for the promo video (blue theme, 3x).
const fs = require('fs');
const { start, phone, BTC, ETH, GOLD, CASH } = require('/home/user/portfolio-tracker/tests/e2e/harness.cjs');
const O = '/tmp/claude-0/-home-user/352853a3-bd6a-51cd-8369-a65832162cd5/scratchpad/promo';
fs.mkdirSync(O, { recursive: true });
(async () => {
  const env = await start();
  const SOL = { id: 'crypto:solana', kind: 'crypto', sym: 'SOL', name: 'Solana', cg: 'solana', cb: 'SOL-USD', qty: 40, cost: 95 };
  const seed = { holdings: [{ ...BTC, qty: 0.42, cost: 52000 }, { ...ETH, qty: 3.5, cost: 2900 }, { ...GOLD, qty: 2, cost: 2650 }, SOL, { ...CASH, qty: 5900 }], settings: { theme: 'blue', goal: { name: 'Road to 1M', amount: 1000000, ccy: 'USD', monthly: 1500, rate: 0.07, seen: 1000000 } } };
  const h = await phone(env, { seed, dpr: 3, scheme: 'dark' });
  const p = h.p;
  await h.wait(3800);
  const box = sel => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.screenshot({ path: `${O}/home.png` });
  const boxes = {
    hero: await box('#hero'),
    chart: await box('#home-chart'),
    alloc: await box('#alloc'),
    row: await box('#list .row:nth-child(1)'),
    row2: await box('#list .row:nth-child(2)'),
  };
  await p.$eval('#perf', e => e.scrollIntoView({ block: 'center' })); await h.wait(600);
  await p.screenshot({ path: `${O}/home2.png` });
  boxes.perf = await box('#perf .perf-card');
  boxes.goal = await box('#goal');
  await p.$eval('#scroll', e => e.scrollTo(0, 0)); await h.wait(400);
  await p.tap('.row:has-text("Bitcoin") .row-main'); await h.wait(2400);
  await p.tap('.sheet .seg button:has-text("1A")'); await h.wait(1800);
  await p.screenshot({ path: `${O}/detail.png` });
  fs.writeFileSync(`${O}/boxes.json`, JSON.stringify(boxes, null, 1));
  console.log(boxes, h.errors);
  await env.close();
})();
