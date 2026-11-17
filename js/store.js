// Holdings and settings, kept only in this browser (localStorage).
//
// A holding is one position per asset: quantity plus an optional average cost
// per unit (USD). Crypto, stocks and metals can also keep their buys and sells
// (holding.tx, see trades.js); then quantity and cost are the replay of those
// trades and are never edited directly.

import { replay, openingOf, canTrade, hasHistory, newId, accrue } from './trades.js';

const KEY = 'portfolio.v1';

const defaults = () => ({
  holdings: [],
  watch: [],       // assets followed without holding them: { id, kind, sym, name, … }
  settings: {
    ccy: 'USD', finnhubKey: '', historyKey: '', hidden: false,
    unit: 'ccy',     // balance shown in the currency, 'btc' or 'xau'
    range: '1D',     // chart range on the home screen
    targets: null,   // { crypto: 60, cash: 20, … } percentages adding up to 100
    numbers: 'dot',  // 'dot' → 1.234,50   'comma' → 1,234.50
    order: null,     // asset ids in the order the user arranged them, or null to sort by value
    goal: null,      // { name, amount, ccy, monthly, rate, seen } or null
  },
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    const d = defaults();
    return {
      holdings: Array.isArray(data.holdings) ? data.holdings.filter(validHolding).map(normalize) : [],
      watch: cleanWatch(data.watch),
      settings: { ...d.settings, ...(data.settings || {}) },
    };
  } catch {
    return defaults();
  }
}

// The dollar cash position is called "Cash" now.
function renameCash(h) {
  return h.id === 'cash:USD' && h.name === 'Dólar' ? { ...h, name: 'Cash' } : h;
}

// Old names and anything malformed in an imported file: a bad trade list is
// dropped (the position keeps its quantity), a good one is replayed.
function normalize(h) {
  h = renameCash(h);
  if (!('tx' in h)) return h;
  const ok = Array.isArray(h.tx) && hasHistory(h) && h.tx.every(validTrade);
  const { tx, ...rest } = h;
  if (!ok) return rest;
  const r = replay(tx);
  return { ...rest, tx, qty: r.qty, cost: r.cost };
}

const WATCHABLE = new Set(['crypto', 'stock', 'metal']);
function cleanWatch(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter(a => a && typeof a.id === 'string' && WATCHABLE.has(a.kind) && !seen.has(a.id) && seen.add(a.id))
    .map(({ id, kind, sym, name, cg, cb, img, el }) => ({ id, kind, sym, name, cg, cb, img, el }));
}

function validTrade(t) {
  if (!t || (t.price != null && !Number.isFinite(t.price))) return false;
  if (t.side === 'income') return Number.isFinite(t.qty) && t.qty >= 0 && (t.qty > 0 || (Number.isFinite(t.amount) && t.amount > 0));
  return (t.side === 'buy' || t.side === 'sell') && Number.isFinite(t.qty) && t.qty > 0;
}

function validHolding(h) {
  return h && typeof h.id === 'string' && typeof h.kind === 'string' && Number.isFinite(h.qty);
}

const listeners = new Set();
export const state = read();

// Example mode shows sample positions without touching what is saved.
let demo = false, savedHoldings = null;
export const isDemo = () => demo;

export function enterDemo(list) {
  if (!demo) savedHoldings = state.holdings;
  demo = true;
  state.holdings = list;
  commit('holdings');
}

export function exitDemo() {
  if (!demo) return;
  demo = false;
  state.holdings = savedHoldings || [];
  savedHoldings = null;
  commit('holdings');
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function commit(what) {
  const out = { holdings: demo ? savedHoldings : state.holdings, watch: state.watch, settings: state.settings };
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* storage full or blocked */ }
  listeners.forEach(fn => fn(what));
}

export function getHolding(id) { return state.holdings.find(h => h.id === id); }

/**
 * Add a position. If the asset is already held, the quantities are summed and
 * the average cost is re-weighted — that is what "average cost" means.
 */
export function addHolding(asset, qty, cost) {
  const cur = getHolding(asset.id);
  if (cur && (canTrade(cur) || cur.tx)) {
    // A second buy of something already held is recorded as a trade.
    if (asset.unit) cur.unit = asset.unit;
    setTrades(cur.id, [...openingOf(cur), { id: newId(), t: Date.now(), side: 'buy', qty, price: cost ?? null }]);
    return;
  }
  if (cur) {
    const total = cur.qty + qty;
    let avg = null;
    if (cur.cost != null && cost != null) avg = (cur.cost * cur.qty + cost * qty) / total;
    else if (cur.cost != null && cost == null) avg = cur.cost;
    else if (cur.cost == null && cost != null && cur.qty === 0) avg = cost;
    cur.qty = total;
    cur.cost = avg;
    if (asset.unit) cur.unit = asset.unit;
  } else {
    state.holdings.push({ ...asset, qty, cost: cost ?? null, added: Date.now() });
  }
  commit('holdings');
}

/** Replace the trades of a position; quantity and cost follow from them. */
export function setTrades(id, trades) {
  const h = getHolding(id);
  if (!h) return;
  const r = replay(trades);
  h.tx = trades;
  h.qty = r.qty;
  h.cost = r.cost;
  commit('holdings');
}

/**
 * Credit the interest savings balances have earned. `priceOf(holding)` is the
 * USD value of one unit of its currency, or null while it is unknown.
 */
export function accrueInterest(priceOf, now = Date.now()) {
  if (demo) return false;
  let changed = false;
  for (const h of state.holdings) {
    if (!(h.apy > 0)) continue;
    const r = accrue(h, now, priceOf(h));
    if (!r) continue;
    const res = replay(r.tx);
    Object.assign(h, { tx: r.tx, apyFrom: r.apyFrom, qty: res.qty, cost: res.cost });
    changed = true;
  }
  if (changed) commit('holdings');
  return changed;
}

/** Set the annual yield of a cash balance (0 to stop). Interest owed so far is credited first. */
export function setApy(id, apy, priceOf) {
  accrueInterest(priceOf);
  const h = getHolding(id);
  if (!h) return;
  if (apy > 0) { h.apy = apy; h.apyFrom = Date.now(); } else { delete h.apy; delete h.apyFrom; }
  commit('holdings');
}

export function updateHolding(id, patch) {
  const h = getHolding(id);
  if (!h) return;
  Object.assign(h, patch);
  commit('holdings');
}

export function removeHolding(id) {
  const i = state.holdings.findIndex(h => h.id === id);
  if (i < 0) return null;
  const [h] = state.holdings.splice(i, 1);
  commit('holdings');
  return { holding: h, index: i };
}

export function restoreHolding({ holding, index }) {
  state.holdings.splice(Math.min(index, state.holdings.length), 0, holding);
  commit('holdings');
}

// ---- watchlist ----

export const canWatch = a => !!a && WATCHABLE.has(a.kind);
export const isWatched = id => state.watch.some(a => a.id === id);

export function watchAsset(asset) {
  if (!canWatch(asset) || isWatched(asset.id)) return;
  state.watch.push(cleanWatch([asset])[0]);
  commit('watch');
}

export function unwatchAsset(id) {
  const i = state.watch.findIndex(a => a.id === id);
  if (i < 0) return null;
  const [a] = state.watch.splice(i, 1);
  commit('watch');
  return { asset: a, index: i };
}

export function rewatch({ asset, index }) {
  if (isWatched(asset.id)) return;
  state.watch.splice(Math.min(index, state.watch.length), 0, asset);
  commit('watch');
}

export function setSetting(key, value) {
  state.settings[key] = value;
  commit('settings');
}

export function replaceAll(data) {
  demo = false; savedHoldings = null;
  const d = defaults();
  state.holdings = Array.isArray(data.holdings) ? data.holdings.filter(validHolding).map(normalize) : [];
  if ('watch' in data) state.watch = cleanWatch(data.watch);
  state.settings = { ...d.settings, ...state.settings, ...(data.settings || {}) };
  commit('holdings');
}

/** What a copy contains: positions and preferences, never API keys. */
export function exportObject(extra = {}) {
  const holdings = demo ? savedHoldings : state.holdings;
  const { ccy, unit, targets, numbers, order, goal } = state.settings;
  return { app: 'portfolio', version: 1, exported: new Date().toISOString(), holdings, watch: state.watch, settings: { ccy, unit, targets, numbers, order, goal }, ...extra };
}

export function exportData(extra) {
  return JSON.stringify(exportObject(extra), null, 2);
}
