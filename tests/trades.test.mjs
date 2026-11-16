// The trade history: average cost, realized gain, closing and reopening.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, openingOf, heldAt, consistent, sorted, incomeSince } from '../js/trades.js';

const b = (t, qty, price) => ({ id: 'b' + t, t, side: 'buy', qty, price });
const s = (t, qty, price) => ({ id: 's' + t, t, side: 'sell', qty, price });

test('buys re-weight the average cost', () => {
  assert.deepEqual(replay([b(1, 0.5, 52000), b(2, 0.5, 60000)]), { qty: 1, cost: 56000, realized: 0, realizedKnown: false, income: 0 });
});

test('a sale realizes gain at the average cost and keeps the average', () => {
  const r = replay([b(1, 2, 100), b(2, 2, 200), s(3, 1, 300)]);
  assert.equal(r.qty, 3);
  assert.equal(r.cost, 150);
  assert.equal(r.realized, 150);
  assert.equal(r.realizedKnown, true);
});

test('order is by date, not by entry', () => {
  assert.deepEqual(replay([s(3, 1, 300), b(1, 2, 100)]), replay([b(1, 2, 100), s(3, 1, 300)]));
});

test('selling everything closes; the next buy starts a fresh average', () => {
  const r = replay([b(1, 1, 100), s(2, 1, 50), b(3, 1, 400)]);
  assert.equal(r.qty, 1);
  assert.equal(r.cost, 400);
  assert.equal(r.realized, -50);
});

test('an opening without cost leaves the average unknown until closed', () => {
  const open = { id: 'o', t: 0, side: 'buy', qty: 1, price: null, opening: true };
  assert.equal(replay([open, b(1, 1, 100)]).cost, null);
  const r = replay([open, s(1, 1, 100)]);
  assert.equal(r.realizedKnown, false, 'no gain can be computed without a cost');
  assert.equal(replay([open, s(1, 1, 100), b(2, 1, 80)]).cost, 80);
});

test('opening entry comes from the position as it was', () => {
  const t = openingOf({ qty: 2, cost: 10, added: 5 });
  assert.equal(t.length, 1);
  assert.equal(t[0].opening, true);
  assert.equal(t[0].qty, 2);
  assert.equal(t[0].price, 10);
  assert.deepEqual(openingOf({ qty: 0, cost: null }), []);
  const tx = [b(1, 1, 1)];
  assert.equal(openingOf({ qty: 1, tx }), tx);
  // the opening stays first even with an older date on a later trade
  assert.equal(sorted([b(-5, 1, 1), { ...t[0] }])[0].opening, true);
});

test('cannot sell more than held at that date', () => {
  const tx = [b(1, 1, 100), b(5, 1, 100)];
  assert.equal(heldAt(tx, 3), 1);
  assert.equal(heldAt(tx, 6), 2);
  assert.equal(consistent([...tx, s(3, 1.5, 100)]), false);
  assert.equal(consistent([...tx, s(6, 1.5, 100)]), true);
});

test('many small buys do not drift', () => {
  const tx = Array.from({ length: 1000 }, (_, i) => b(i, 0.001, 100 + (i % 2)));
  const r = replay(tx);
  assert.equal(r.qty, 1);
  assert.equal(r.cost, 100.5);
});

test('a dividend is income and leaves the position alone', () => {
  const r = replay([b(1, 10, 100), { id: 'd', t: 2, side: 'income', qty: 0, amount: 25 }]);
  assert.equal(r.qty, 10); assert.equal(r.cost, 100); assert.equal(r.income, 25);
});

test('a staking reward adds units at their value that day and counts as income', () => {
  const r = replay([b(1, 10, 100), { id: 'r', t: 2, side: 'income', qty: 1, price: 210 }]);
  assert.equal(r.qty, 11);
  assert.equal(r.cost, 110, '(10×100 + 1×210) / 11');
  assert.equal(r.income, 210);
});

test('cash: deposits, withdrawals and interest', () => {
  const open = { id: 'o', t: 0, side: 'buy', qty: 1000, price: null, opening: true };
  const r = replay([open, { id: 'w', t: 1, side: 'sell', qty: 300, price: null }, { id: 'i', t: 2, side: 'income', qty: 5, price: 1 }]);
  assert.equal(r.qty, 705); assert.equal(r.income, 5); assert.equal(r.realizedKnown, false);
});

test('income over the last twelve months', () => {
  const tx = [{ id: 'a', t: 10, side: 'income', qty: 0, amount: 5 }, { id: 'b', t: 100, side: 'income', qty: 2, price: 3 }, b(200, 1, 1)];
  assert.equal(incomeSince(tx, 50), 6);
  assert.equal(incomeSince(tx, 0), 11);
});
