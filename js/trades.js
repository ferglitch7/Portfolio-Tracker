// Buys and sells of one position, and what follows from them.
//
// A trade is { id, t, side: 'buy' | 'sell' | 'income', qty, price, opening? }:
//   t      when it happened (ms)
//   qty    units, in the stored unit (troy ounces for metals)
//   price  USD per stored unit, or null when not known (an opening entry, or a
//          deposit/withdrawal of cash)
//   opening  the position as it was before the first recorded trade
//
// Income is money the position paid without selling anything:
//   dividend   { side: 'income', qty: 0, amount }      stocks; amount in USD
//   in kind    { side: 'income', qty, price }          staking rewards, interest
//              on cash: units received, valued at their price that day. They
//              join the position at that value, like a buy, and count as income.
//
// The position is the replay of its trades, with the average-cost method:
//   buy   the average cost is re-weighted with the price paid
//   sell  quantity goes down at the current average cost; the difference with
//         the sale price is realized gain. The average cost does not change.
// Selling everything closes the position: the next buy starts a fresh average.

export const TRADE_KINDS = new Set(['crypto', 'stock', 'metal']);

export const canTrade = a => !!a && TRADE_KINDS.has(a.kind);

/** Positions that can record income, and what it is called. */
export const INCOME = { stock: 'Dividendo', crypto: 'Recompensa', cash: 'Interés' };
export const canIncome = a => !!a && a.kind in INCOME;
export const hasHistory = a => canTrade(a) || canIncome(a);

/** USD value of an income entry. */
export const incomeOf = tr => (tr.qty > 0 ? tr.qty * (tr.price || 0) : Number(tr.amount) || 0);

const EPS = 1e-12;

/** { qty, cost, realized, realizedKnown, income } from a list of trades. */
export function replay(trades) {
  let qty = 0, cost = null, realized = 0, realizedKnown = false, income = 0;
  for (const tr of sorted(trades)) {
    if (tr.side === 'income') income += incomeOf(tr);
    const q = Number(tr.qty);
    if (!(q > 0)) continue;
    const p = Number.isFinite(tr.price) ? tr.price : null;
    if (tr.side === 'sell') {
      const sold = Math.min(q, qty);
      if (p != null && cost != null && sold > 0) { realized += (p - cost) * sold; realizedKnown = true; }
      qty -= sold;
      if (qty <= EPS) { qty = 0; cost = null; }
    } else {
      // Units of unknown cost make the average unknown until the position closes.
      if (qty <= EPS) cost = p;
      else if (cost != null) cost = p == null ? null : (cost * qty + p * q) / (qty + q);
      qty += q;
    }
  }
  return { qty: clean(qty), cost: cost == null ? null : clean(cost), realized: clean(realized), realizedKnown, income: clean(income) };
}

/** Trades in time order; the opening entry always first. */
export function sorted(trades) {
  return [...(trades || [])].sort((a, b) => (b.opening ? 1 : 0) - (a.opening ? 1 : 0) || (a.t || 0) - (b.t || 0));
}

/** The trades a position needs before its first recorded one. */
export function openingOf(holding) {
  if (Array.isArray(holding.tx)) return holding.tx;
  return holding.qty > 0 ? [{ id: newId(), t: holding.added || null, side: 'buy', qty: holding.qty, price: holding.cost ?? null, opening: true }] : [];
}

/** Units that can be sold at time t (trades after t are ignored). */
export function heldAt(trades, t, skipId) {
  return replay((trades || []).filter(x => x.id !== skipId && (x.opening || !t || (x.t || 0) <= t))).qty;
}

/** True when a list of trades never sells more than it holds at that moment. */
export function consistent(trades) {
  let qty = 0;
  for (const tr of sorted(trades)) {
    if (tr.side === 'sell') { if (tr.qty > qty + 1e-9) return false; qty -= tr.qty; }
    else qty += tr.qty || 0;
  }
  return true;
}

/** Income received since `from` (ms), in USD. */
export function incomeSince(trades, from) {
  let sum = 0;
  for (const tr of trades || []) if (tr.side === 'income' && (tr.t || 0) >= from) sum += incomeOf(tr);
  return sum;
}

export function newId() { return Math.random().toString(36).slice(2, 10); }

// Floating point noise from many re-weightings: keep ~12 significant digits.
function clean(v) { return Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(12)); }
