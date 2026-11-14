// Goal maths: the dates and amounts the goal screen shows must be right.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRate, futureValue, monthsToGoal, monthlyNeeded, milestones, durationLabel, addMonths, projection } from '../js/goal-math.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('monthly rate compounds back to the annual rate', () => {
  close(Math.pow(1 + monthlyRate(0.07), 12), 1.07);
  close(monthlyRate(0), 0);
});

test('future value: no growth, growth only, contributions only', () => {
  close(futureValue(1000, 100, 0, 12), 2200);
  close(futureValue(1000, 0, 0.07, 12), 1070);
  // 12 months of 100 at 0 %: plain sum
  close(futureValue(0, 100, 0, 12), 1200);
  // known annuity: 100/month for 10 years at 7 %/yr, monthly compounding of the effective rate
  const i = monthlyRate(0.07);
  close(futureValue(0, 100, 0.07, 120), 100 * (Math.pow(1 + i, 120) - 1) / i);
});

test('months to goal agrees with future value', () => {
  const n = monthsToGoal(116000, 1e6, 1000, 0.07);
  assert.ok(futureValue(116000, 1000, 0.07, n) >= 1e6);
  assert.ok(futureValue(116000, 1000, 0.07, n - 1) < 1e6);
  assert.equal(monthsToGoal(2e6, 1e6, 0, 0), 0);
  assert.equal(monthsToGoal(1000, 2000, 100, 0), 10);
  assert.equal(monthsToGoal(1000, 2000, 0, 0), null);          // never, without saving or growth
  assert.equal(monthsToGoal(1000, 1e12, 0, 0.01), null);        // beyond 100 years
});

test('monthly needed reaches the goal exactly in n months', () => {
  for (const [pv, goal, r, n] of [[116000, 1e6, 0.07, 120], [0, 1e6, 0.05, 240], [5000, 20000, 0, 30]]) {
    const c = monthlyNeeded(pv, goal, r, n);
    close(futureValue(pv, c, r, n), goal, 1e-9);
  }
  assert.equal(monthlyNeeded(900000, 1e6, 0.07, 120), 0);       // growth alone gets there
});

test('milestones are round, increasing and end at the goal', () => {
  const m = milestones(1e6);
  assert.deepEqual(m, [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6]);
  for (let i = 1; i < m.length; i++) assert.ok(m[i] > m[i - 1]);
  assert.ok(m.length <= 7);
  assert.deepEqual(milestones(1e6).slice(-4), [100e3, 250e3, 500e3, 1e6]);
  assert.deepEqual(milestones(30000), [1e3, 5e3, 10e3, 25e3, 30000]);
});

test('labels and dates', () => {
  assert.equal(durationLabel(0), 'ya');
  assert.equal(durationLabel(8), '8 meses');
  assert.equal(durationLabel(12), '1 año');
  assert.equal(durationLabel(41), '3 años y 5 meses');
  assert.equal(durationLabel(null), null);
  const d = addMonths(new Date(2026, 10, 30), 3);               // 30 Nov + 3 months
  assert.equal(d.getFullYear(), 2027); assert.equal(d.getMonth(), 1);
});

test('projection starts today and ends on the horizon', () => {
  const p = projection(1000, 1e6, 100, 0.07, 120);
  assert.equal(p[0].month, 0); close(p[0].value, 1000);
  assert.equal(p[p.length - 1].month, 120);
  for (const x of p) assert.ok(x.value >= x.contributed - 1e-6);
});
