// In English, no Spanish left on any screen. Walks the app and lists every
// visible text (and label) that still looks Spanish.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, phone, BTC, GOLD, CASH } = require('./harness.cjs');

let env;
test.before(async () => { env = await start(); });
test.after(() => env.close());

const SPANISH = /[áéíóúñ¿¡]|\b(de|del|la|las|el|los|tu|tus|con|para|sin|una|que|se|al|y|o|en|es|hoy|año|años|mes|meses|activos?|añadir|guardar|ajustes|eliminar|editar|comprar|venta|precio|fecha|cantidad|valor|ganancia|costo|objetivo|meta|buscar|todo|metales|efectivo|retiro|acciones|nada|moneda|números|tema|claro|oscuro|barra|anillo|lista|nunca|saldo|interés|cargando|novedades|continuar|versión|importar|borrar|copia|ocultar|ordenar|registrar|seguir|rendimiento|distribución|ejemplo|salir|conectar|deshacer|nombre|oro|plata)\b/i;

async function collect(p) {
  return p.evaluate(() => {
    const out = new Set();
    const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && !el.closest('[data-no-i18n]'); };
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) {
      const v = n.data.trim();
      if (v && n.parentElement && visible(n.parentElement) && !n.parentElement.closest('script,style')) out.add(v);
    }
    for (const el of document.querySelectorAll('[aria-label],[placeholder],[title]')) {
      if (!visible(el) && el.tagName !== 'BUTTON') continue;
      for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v) out.add(v); }
    }
    return [...out];
  });
}

test('every screen reads in English', async () => {
  const XRP = { id: 'crypto:ripple', kind: 'crypto', sym: 'XRP', name: 'XRP', cg: 'ripple', cb: 'XRP-USD', qty: 30, cost: null };
  const seed = {
    holdings: [{ ...BTC, tx: [{ id: 'o', t: Date.now() - 400 * 864e5, side: 'buy', qty: 1, price: 50000, opening: true }, { id: 's', t: Date.now() - 20 * 864e5, side: 'sell', qty: 0.2, price: 90000 }], qty: 0.8 }, XRP, GOLD, { ...CASH, apy: 4.5, apyFrom: Date.now() - 40 * 864e5 }],
    watch: [{ id: 'crypto:solana', kind: 'crypto', sym: 'SOL', name: 'Solana', cg: 'solana', cb: 'SOL-USD' }],
    settings: { lang: 'en', targets: { crypto: 50, metal: 30, cash: 20 } },
  };
  const h = await phone(env, { seed });
  const { p } = h;
  const found = new Map();
  const scan = async where => { for (const v of await collect(p)) if (SPANISH.test(v) && !/^(Portfolio|Road to 1M|Vanguard|Fidelity|Solana|XRP|Bitcoin|Cash|Ethereum|META$|Meta$|Costa Rican colón)/.test(v)) found.set(v, where); };
  await h.wait(3000);
  await scan('home');
  await p.$eval('#scroll', e => e.scrollTo(0, 99999)); await h.wait(400); await scan('home bottom');
  await p.$eval('#scroll', e => e.scrollTo(0, 0));

  for (const style of ['ring', 'rows']) {
    await p.evaluate(s => { const d = JSON.parse(localStorage.getItem('portfolio.v1')); d.settings.alloc = s; localStorage.setItem('portfolio.v1', JSON.stringify(d)); }, style);
    await p.reload(); await h.wait(2500); await scan('alloc ' + style);
  }

  const sheet = async (where, open) => { await open(); await h.wait(1200); await scan(where); await p.$eval('.sheet-scroll', e => e.scrollTo(0, 99999)).catch(() => {}); await h.wait(300); await scan(where + ' bottom'); };
  const close = async () => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.tap('.sheet-view:last-child .close'); await h.wait(1000); };

  await sheet('settings', () => p.tap('#btn-settings'));
  await p.tap('button.field:has-text("Currency")'); await h.wait(900); await scan('currency');
  await p.tap('.sheet-view:last-child .back'); await h.wait(700);
  await p.tap('button.field:has-text("Saved versions")'); await h.wait(900); await scan('versions');
  await close();

  await sheet('add', () => p.tap('#btn-add'));
  for (const tab of ['Crypto', 'Stocks', 'Metals', 'Cash', 'Retirement']) { await p.tap(`.seg button:has-text("${tab}")`); await h.wait(300); await scan('add ' + tab); }
  await p.tap('.pick:has-text("Vanguard")'); await h.wait(900); await scan('retire form');
  await p.tap('.sheet-view:last-child .back'); await h.wait(700);
  await p.tap('.seg button:has-text("All")'); await h.wait(300);
  await p.tap('.pick:has-text("Ethereum")'); await h.wait(900); await scan('amount');
  await close();

  await sheet('detail btc', () => p.tap('.row:has-text("Bitcoin") .row-main'));
  await p.tap('.op-add:has-text("Record a sale")'); await h.wait(900); await scan('trade sell');
  await p.tap('.sheet-view:last-child .seg button:has-text("Reward")'); await h.wait(300); await scan('trade reward');
  await p.tap('.sheet-view:last-child .back'); await h.wait(700);
  await p.tap('.ops .op:has-text("Sale")'); await h.wait(900); await scan('trade edit');
  await close();
  await sheet('detail cash', () => p.tap('.row:has-text("Cash") .row-main'));
  await p.tap('#apy-field'); await h.wait(900); await scan('apy');
  await close();
  await sheet('detail gold', () => p.tap('.row:has-text("Gold") .row-main'));
  await close();
  await sheet('goal', () => p.tap('#goal'));
  await p.fill('#goal-monthly', '500'); await h.wait(400); await scan('goal filled');
  await close();
  await sheet('targets', () => p.tap('#btn-targets'));
  await close();
  await p.$eval('#watch', e => e.scrollIntoView()); await h.wait(300);
  await sheet('watch detail', () => p.tap('#watch-list .row-main'));
  await close();

  // a stock is still called Meta (the company), not "Goal"
  await p.tap('#btn-add'); await h.wait(600);
  await p.tap('.seg button:has-text("Stocks")'); await h.wait(300);
  assert.ok((await p.$$eval('.pick-name', e => e.map(x => x.textContent))).includes('Meta'));
  await close();

  const list = [...found].map(([v, w]) => `${w}: ${v}`);
  assert.deepEqual(list, [], 'Spanish left:\n' + list.join('\n'));
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('switching the language in Ajustes reloads the app in it; Novedades in English too', async () => {
  const h = await phone(env, { seed: { holdings: [BTC, GOLD], settings: {} } });
  const { p } = h;
  await h.wait(2500);
  assert.equal(await p.textContent('#btn-targets'), 'Objetivo', 'Spanish for someone who already used the app');
  await p.tap('#btn-settings'); await h.wait(800);
  await p.tap('.lang-pick .seg button:has-text("English")');
  await p.waitForLoadState('load'); await h.wait(2500);
  assert.equal(await p.textContent('#btn-targets'), 'Target');
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'en');
  assert.ok((await h.names()).includes('Gold'), 'metal names translated');
  // the What's new card, in English
  await p.tap('#btn-settings'); await h.wait(800);
  await p.$eval('.sheet-scroll', e => e.scrollTo(0, 99999)); await h.wait(300);
  await p.tap('#set-whatsnew'); await h.wait(700);
  assert.equal(await p.textContent('.wn-title'), 'What’s new');
  assert.match(await p.textContent('.wn-version'), /^Version /);
  await p.tap('.wn-card .btn-primary'); await h.wait(600);
  await p.tap('.lang-pick .seg button:has-text("Español")');
  await p.waitForLoadState('load'); await h.wait(2500);
  assert.equal(await p.textContent('#btn-targets'), 'Objetivo');
  assert.deepEqual(h.errors, []);
  await h.close();
});

test('a new iPhone in English starts in English', async () => {
  const ctxLocale = 'en-US';
  const h = await phone(env, { locale: ctxLocale });
  await h.wait(1500);
  assert.equal(await h.p.textContent('#empty-add'), 'Add asset');
  await h.close();
});
