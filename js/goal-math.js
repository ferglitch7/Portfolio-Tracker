// Goal maths. Pure functions, no browser needed (tested in tests/goal.test.mjs).
//
// Growth is compounded monthly: an annual rate r becomes (1 + r)^(1/12) − 1
// per month, and the monthly contribution is added at the end of each month.
// Every projection rests on the return the user assumes; nothing here is a
// forecast.

const MAX_MONTHS = 100 * 12;

export function monthlyRate(annual) {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Value after n months, starting at pv and adding c each month. */
export function futureValue(pv, c, annual, n) {
  const i = monthlyRate(annual);
  if (Math.abs(i) < 1e-12) return pv + c * n;
  const g = Math.pow(1 + i, n);
  return pv * g + c * (g - 1) / i;
}

/**
 * Months until the goal is reached, or null if it never is within 100 years.
 * 0 when it already is.
 */
export function monthsToGoal(pv, goal, c, annual) {
  if (pv >= goal) return 0;
  const i = monthlyRate(annual);
  if (Math.abs(i) < 1e-12) return c > 0 ? Math.ceil((goal - pv) / c) : null;
  let v = pv;
  for (let n = 1; n <= MAX_MONTHS; n++) {
    v = v * (1 + i) + c;
    if (v >= goal) return n;
    if (v <= 0 && c <= 0) return null;
  }
  return null;
}

/** Monthly contribution needed to reach the goal in n months (0 if not needed). */
export function monthlyNeeded(pv, goal, annual, n) {
  if (n <= 0) return pv >= goal ? 0 : Infinity;
  const i = monthlyRate(annual);
  const g = Math.abs(i) < 1e-12 ? 1 : Math.pow(1 + i, n);
  const fromSavings = pv * g;
  if (fromSavings >= goal) return 0;
  return Math.abs(i) < 1e-12 ? (goal - pv) / n : (goal - fromSavings) * i / (g - 1);
}

/** The month (as a Date) n months after `from`. */
export function addMonths(from, n) {
  const d = new Date(from);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Round-number milestones on the way to a goal, in the goal's currency:
 * 1k, 5k, 10k, 25k, 50k, 100k, 250k, 500k, 1M, 2.5M, 5M, 10M… below the goal,
 * plus the goal itself. At most seven, the closest ones to the goal kept.
 */
export function milestones(goal) {
  const steps = [];
  for (let p = 3; p <= 12; p++) for (const m of [1, 2.5, 5]) steps.push(m * 10 ** p);
  const below = steps.filter(v => v < goal * 0.999).filter(v => v !== 2.5e3);
  return [...below.slice(-6), goal];
}

/**
 * Yearly points for a projection chart: what you put in versus what the
 * portfolio would be worth. [{ month, contributed, value }]
 */
export function projection(pv, goal, c, annual, months) {
  const out = [];
  const n = Math.max(12, Math.min(months ?? 360, MAX_MONTHS));
  const step = Math.max(1, Math.round(n / 40));
  for (let m = 0; m <= n; m += step) out.push({ month: m, contributed: pv + c * m, value: futureValue(pv, c, annual, m) });
  if (out[out.length - 1].month !== n) out.push({ month: n, contributed: pv + c * n, value: futureValue(pv, c, annual, n) });
  return out;
}

/** "3 años y 4 meses", "8 meses", "menos de un mes". */
export function durationLabel(months) {
  if (months == null) return null;
  if (months <= 0) return 'ya';
  const y = Math.floor(months / 12), m = months % 12;
  const ys = y ? `${y} ${y === 1 ? 'año' : 'años'}` : '';
  const ms = m ? `${m} ${m === 1 ? 'mes' : 'meses'}` : '';
  return ys && ms ? `${ys} y ${ms}` : ys || ms;
}
