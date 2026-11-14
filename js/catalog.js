// What can be added: built-in lists per asset class plus remote search.
//
// An asset is { id, kind, sym, name, ... } where id is unique across classes
// ("crypto:bitcoin", "stock:AAPL", "metal:XAU", "cash:EUR", "custom:…").

import { CRYPTO_TOP } from './catalog-data.js';
import { CURRENCIES } from './format.js';

export const KINDS = {
  crypto: { label: 'Crypto', color: 'var(--k-crypto)' },
  stock: { label: 'Acciones', color: 'var(--k-stock)' },
  metal: { label: 'Metales', color: 'var(--k-metal)' },
  cash: { label: 'Efectivo', color: 'var(--k-cash)' },
  retire: { label: 'Retiro', color: 'var(--k-retire)' },
  custom: { label: 'Otros', color: 'var(--k-custom)' },
};

// Retirement plan providers. There is no way to read these accounts without
// a paid aggregator, so a plan is a balance the user enters, optionally moving
// with an index between updates.
const R = (key, name, mono, color) => ({ id: `retire:${key}`, kind: 'retire', sym: '', name, provider: name, mono, color, template: true });
export const RETIRE = [
  R('vanguard', 'Vanguard', 'V', '#96151d'), R('fidelity', 'Fidelity', 'F', '#368727'),
  R('schwab', 'Charles Schwab', 'CS', '#00a0df'), R('empower', 'Empower', 'E', '#1d3a8a'),
  R('principal', 'Principal', 'P', '#0061a0'), R('troweprice', 'T. Rowe Price', 'TR', '#1b365d'),
  R('merrill', 'Merrill', 'M', '#0a3d91'), R('johnhancock', 'John Hancock', 'JH', '#00843d'),
  R('tiaa', 'TIAA', 'T', '#004b8d'), R('voya', 'Voya', 'V', '#ff6a13'),
  R('other', 'Otro plan', '+', '#5e5ce6'),
];

/** Indices a retirement balance can follow between updates (as their ETFs). */
export const TRACKS = [
  [null, 'Nada'], ['VOO', 'S&P 500'], ['VTI', 'Total EE. UU.'], ['VT', 'Mundial'],
];
export const ACCOUNT_TYPES = ['401(k)', 'IRA', 'Roth IRA', 'Pensión'];

/** A new account from a provider template (several per provider are fine). */
export function newRetireAccount(t) {
  const id = 'retire:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return { id, kind: 'retire', sym: '', provider: t.provider === 'Otro plan' ? '' : t.provider, mono: t.mono, color: t.color, name: t.provider === 'Otro plan' ? '' : `${t.provider} 401(k)`, accType: '401(k)', track: 'VOO' };
}

const CG_IMG = 'https://coin-images.coingecko.com/coins/images/';

export const CRYPTO = CRYPTO_TOP.map(([cg, sym, name, img, onCb]) => ({
  id: `crypto:${cg}`, kind: 'crypto', sym, name, cg,
  img: CG_IMG + img,
  cb: onCb ? `${sym}-USD` : null,
}));
const cryptoById = new Map(CRYPTO.map(a => [a.id, a]));

export const METALS = [
  { id: 'metal:XAU', kind: 'metal', sym: 'XAU', name: 'Oro', el: 'Au' },
  { id: 'metal:XAG', kind: 'metal', sym: 'XAG', name: 'Plata', el: 'Ag' },
  { id: 'metal:XPT', kind: 'metal', sym: 'XPT', name: 'Platino', el: 'Pt' },
  { id: 'metal:XPD', kind: 'metal', sym: 'XPD', name: 'Paladio', el: 'Pd' },
];

// Metal quantities are stored in troy ounces, the unit spot prices are quoted in.
export const UNITS = { oz: { label: 'oz', perOz: 1 }, g: { label: 'g', perOz: 31.1034768 }, kg: { label: 'kg', perOz: 0.0311034768 } };

const S = (sym, name) => ({ id: `stock:${sym}`, kind: 'stock', sym, name });
export const STOCKS = [
  S('AAPL', 'Apple'), S('MSFT', 'Microsoft'), S('NVDA', 'NVIDIA'), S('GOOGL', 'Alphabet'), S('AMZN', 'Amazon'),
  S('META', 'Meta'), S('TSLA', 'Tesla'), S('BRK-B', 'Berkshire Hathaway'), S('AVGO', 'Broadcom'), S('JPM', 'JPMorgan Chase'),
  S('V', 'Visa'), S('MA', 'Mastercard'), S('LLY', 'Eli Lilly'), S('WMT', 'Walmart'), S('XOM', 'Exxon Mobil'),
  S('UNH', 'UnitedHealth'), S('COST', 'Costco'), S('NFLX', 'Netflix'), S('ORCL', 'Oracle'), S('AMD', 'AMD'),
  S('PLTR', 'Palantir'), S('KO', 'Coca-Cola'), S('PEP', 'PepsiCo'), S('DIS', 'Disney'), S('NKE', 'Nike'),
  S('MCD', "McDonald's"), S('BAC', 'Bank of America'), S('JNJ', 'Johnson & Johnson'), S('PG', 'Procter & Gamble'), S('HD', 'Home Depot'),
  S('CRM', 'Salesforce'), S('ADBE', 'Adobe'), S('INTC', 'Intel'), S('UBER', 'Uber'), S('ABNB', 'Airbnb'),
  S('COIN', 'Coinbase'), S('MSTR', 'Strategy'), S('SHOP', 'Shopify'), S('PYPL', 'PayPal'), S('SBUX', 'Starbucks'),
  S('BA', 'Boeing'), S('T', 'AT&T'), S('PFE', 'Pfizer'), S('MELI', 'MercadoLibre'), S('NU', 'Nu Holdings'),
  S('TSM', 'TSMC'), S('ASML', 'ASML'), S('BABA', 'Alibaba'), S('SONY', 'Sony'), S('TM', 'Toyota'),
  S('SPY', 'SPDR S&P 500'), S('VOO', 'Vanguard S&P 500'), S('IVV', 'iShares Core S&P 500'), S('QQQ', 'Invesco QQQ'), S('VTI', 'Vanguard Total Market'),
  S('VT', 'Vanguard Total World'), S('VXUS', 'Vanguard Total International'), S('SCHD', 'Schwab US Dividend'), S('IWM', 'iShares Russell 2000'), S('DIA', 'SPDR Dow Jones'),
  S('GLD', 'SPDR Gold Shares'), S('SLV', 'iShares Silver'), S('IBIT', 'iShares Bitcoin Trust'), S('TLT', 'iShares 20+ Year Treasury'), S('BND', 'Vanguard Total Bond'),
  S('ARKK', 'ARK Innovation'), S('EWW', 'iShares MSCI Mexico'), S('EEM', 'iShares Emerging Markets'), S('VNQ', 'Vanguard Real Estate'), S('SMH', 'VanEck Semiconductor'),
];

export const CASH = Object.entries(CURRENCIES).map(([code, c]) => ({
  id: `cash:${code}`, kind: 'cash', sym: code, name: c.name, flag: c.flag,
}));

export function newCustomAsset(name) {
  const id = 'custom:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return { id, kind: 'custom', sym: '', name };
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function rank(asset, q) {
  const sym = norm(asset.sym), name = norm(asset.name);
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (name.includes(q) || sym.includes(q)) return 3;
  return -1;
}

/** Instant results from the built-in lists. kind is 'all' or a class. */
export function searchLocal(query, kind = 'all') {
  const q = norm(query.trim());
  const pools = kind === 'all'
    ? [CRYPTO, STOCKS, METALS, CASH, RETIRE]
    : [{ crypto: CRYPTO, stock: STOCKS, metal: METALS, cash: CASH, retire: RETIRE }[kind] || []];
  if (!q) {
    if (kind !== 'all') return pools[0].slice(0, 60);
    // A mixed starting list: the names people reach for first in each class.
    return [...CRYPTO.slice(0, 2), METALS[0], ...STOCKS.slice(0, 3), METALS[1], ...CRYPTO.slice(5, 7), STOCKS[50], STOCKS[53], CASH[0], CASH[1]];
  }
  const hits = [];
  pools.forEach((pool, pi) => pool.forEach((a, i) => {
    const r = rank(a, q);
    if (r >= 0) hits.push([r, pi, i, a]);
  }));
  hits.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  return hits.slice(0, 40).map(h => h[3]);
}

/** Remote search for what the built-in lists do not cover. Never throws. */
export async function searchRemote(query, kind, { finnhubKey, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const jobs = [];
  if (kind === 'all' || kind === 'crypto') jobs.push(searchCoinGecko(q, signal));
  if ((kind === 'all' || kind === 'stock') && finnhubKey) jobs.push(searchFinnhub(q, finnhubKey, signal));
  const res = await Promise.allSettled(jobs);
  return res.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
}

async function searchCoinGecko(q, signal) {
  const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.coins || []).slice(0, 15).map(c => {
    const id = `crypto:${c.id}`;
    // Coins in the built-in list keep their verified Coinbase mapping; anything
    // else is priced by CoinGecko id, so a look-alike ticker can't borrow a price.
    return cryptoById.get(id) || { id, kind: 'crypto', sym: String(c.symbol || '').toUpperCase(), name: c.name, cg: c.id, img: c.large || c.thumb || null, cb: null };
  });
}

const STOCK_TYPES = new Set(['Common Stock', 'ETP', 'ADR', 'REIT', 'Closed-End Fund', 'Unit', 'MLP']);

async function searchFinnhub(q, key, signal) {
  const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&exchange=US&token=${encodeURIComponent(key)}`, { signal });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.result || [])
    .filter(x => STOCK_TYPES.has(x.type) && x.symbol && !x.symbol.includes(':'))
    .slice(0, 15)
    .map(x => ({ id: `stock:${x.symbol.replace('.', '-')}`, kind: 'stock', sym: x.symbol.replace('.', '-'), name: titleCase(x.description || x.symbol) }));
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s\-&.])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Inc|Corp|Ltd|Plc|Co|Sa|Nv|Ag)\b\.?$/i, '').trim();
}
