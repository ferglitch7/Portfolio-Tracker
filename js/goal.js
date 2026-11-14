// A savings goal ("Road to 1M"): progress, milestones that get celebrated once,
// and a projection of when the goal is reached at a chosen monthly
// contribution and an assumed yearly return.

import { state, setSetting, isDemo } from './store.js';
import * as P from './prices.js';
import * as F from './format.js';
import { h, haptic, ICONS, reduceMotion } from './motion.js';
import { openSheet, makeView, toast } from './sheet.js';
import { segmented } from './ui.js';
import { monthsToGoal, monthlyNeeded, futureValue, addMonths, milestones, projection, durationLabel } from './goal-math.js';

const DEFAULT = { name: 'Road to 1M', amount: 1_000_000, monthly: 0, rate: 0.07 };

/** The saved goal, normalised, or null. Amounts are in the goal's own currency. */
export function goal() {
  const g = state.settings.goal;
  if (!g || !(g.amount > 0)) return null;
  return { ...DEFAULT, ...g, ccy: g.ccy || 'USD' };
}

/** Where the portfolio stands against a goal, everything in the goal's currency. */
function standing(g, totalUsd) {
  const k = P.rate(g.ccy);
  const now = totalUsd * k;
  const marks = milestones(g.amount);
  const months = monthsToGoal(now, g.amount, g.monthly, g.rate);
  return { now, k, marks, months, pct: Math.min(1, now / g.amount), reachedIdx: marks.reduce((idx, m, i) => (now >= m ? i : idx), -1) };
}

function monthYear(d) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function compact(v, ccy) {
  return F.compactMoney(v, ccy).replace(/\.00(?=\D*$)/, '');
}

// ---------- home card ------------------------------------------------------------

/** Fill the home card. v is the app's valuation (needs totalUsd and loading). */
export function renderGoalCard(box, v) {
  const g = goal();
  const has = state.holdings.length > 0;
  box.hidden = !has;
  if (!has) return;
  box.classList.toggle('masked', state.settings.hidden);
  if (!g) {
    box.className = 'goal-card empty';
    box.replaceChildren(
      h('span.goal-empty-icon', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V5M4 5h11l-2 3.5L15 12H4"/></svg>' }),
      h('span.goal-empty-text', null, h('b', { text: 'Ponte una meta' }), h('span', { text: 'Road to 1M, una casa, tu retiro…' })),
      h('span.chev', { html: ICONS.chevron }));
    return;
  }
  box.className = 'goal-card' + (state.settings.hidden ? ' masked' : '');
  const s = standing(g, v.totalUsd);
  celebrate(g, s, v);
  const when = s.months === 0 ? '¡Meta alcanzada!' : s.months == null ? 'Añade un aporte para ver cuándo llegas' : `Llegas en ${monthYear(addMonths(new Date(), s.months))}`;
  const ticks = s.marks.slice(0, -1).map(m => h('i.goal-tick' + (s.now >= m ? '.on' : ''), { style: { left: (m / g.amount * 100) + '%' } }));
  box.replaceChildren(
    h('div.goal-head', null, h('span.goal-name', { text: g.name }), h('span.goal-pct', { text: F.share(s.pct) }), h('span.chev', { html: ICONS.chevron })),
    h('div.goal-bar', null, h('span.goal-fill', { style: { width: (s.pct * 100) + '%' } }), ...ticks),
    h('div.goal-foot', null, h('span.goal-amt', { text: `${F.money(s.now, g.ccy)} de ${compact(g.amount, g.ccy)}` }), h('span', { text: when })));
}

// ---------- milestones, celebrated once each ---------------------------------------

function celebrate(g, s, v) {
  if (isDemo() || v.loading || s.reachedIdx < 0) return;
  const seen = Number.isInteger(g.seen) ? g.seen : null;
  if (seen == null) { setSetting('goal', { ...state.settings.goal, seen: s.reachedIdx }); return; } // first look: nothing to celebrate yet
  if (s.reachedIdx <= seen) return;
  setSetting('goal', { ...state.settings.goal, seen: s.reachedIdx });
  const m = s.marks[s.reachedIdx];
  const final = s.reachedIdx === s.marks.length - 1;
  confetti();
  toast(final ? `¡Lo lograste! ${g.name}: ${compact(m, g.ccy)}` : `Nuevo hito: ${compact(m, g.ccy)}`, { duration: 6000 });
}

function confetti() {
  if (reduceMotion()) return;
  const c = h('canvas.confetti');
  document.getElementById('app').append(c);
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const colors = ['#34d27b', '#f5f5f7', '#ffd60a', '#ff9f0a', '#64d2ff', '#bf5af2'];
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.32,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 13 - 4,
    w: 5 + Math.random() * 5, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  const frame = now => {
    const t = now - t0;
    x.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r);
      x.globalAlpha = Math.max(0, 1 - t / 2600);
      x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      x.restore();
    }
    if (t < 2600) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// ---------- goal sheet --------------------------------------------------------------

const RING = 2 * Math.PI * 70;

function ring() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 160 160');
  svg.setAttribute('class', 'goal-ring');
  svg.innerHTML = `<circle cx="80" cy="80" r="70" class="track"/><circle cx="80" cy="80" r="70" class="fill" stroke-dasharray="0 ${RING}" transform="rotate(-90 80 80)"/>`;
  return svg;
}

function projectionChart(points, goalAmount, ccy) {
  const W = 340, H = 150, pad = 6;
  const maxV = Math.max(goalAmount, ...points.map(p => p.value)) * 1.04;
  const n = points[points.length - 1].month || 1;
  const X = m => pad + (m / n) * (W - 2 * pad);
  const Y = v => H - pad - (v / maxV) * (H - 2 * pad);
  const line = key => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.month).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join('');
  const area = key => `${line(key)}L${X(n)} ${H - pad}L${X(0)} ${H - pad}Z`;
  const gy = Y(goalAmount);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'goal-proj');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `
    <path d="${area('value')}" class="grow"/>
    <path d="${area('contributed')}" class="paid"/>
    <path d="${line('value')}" class="grow-line"/>
    <line x1="${pad}" x2="${W - pad}" y1="${gy}" y2="${gy}" class="goal-line"/>`;
  return h('div.goal-proj-wrap', null, svg,
    h('span.goal-proj-label', { text: compact(goalAmount, ccy), style: { top: `calc(${(gy / H) * 100}% - 18px)` } }));
}

export function openGoal(getValuation) {
  const existing = goal();
  const draft = existing ? { ...existing } : { ...DEFAULT, ccy: state.settings.ccy };
  let sheet = null, saveTimer = 0, horizon = 10, removed = false;

  const save = () => {
    if (!existing) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setSetting('goal', { ...state.settings.goal, ...draft }), 400);
  };

  const ringEl = ring();
  const pctEl = h('div.goal-ring-pct');
  const ofEl = h('div.goal-ring-of');
  const whenEl = h('div.goal-when');
  const whenSub = h('div.goal-when-sub');
  const nudge = h('p.goal-nudge');
  const projHost = h('div');
  const legend = h('div.goal-legend', null, h('span.k.paid', { text: 'Tus aportes' }), h('span.k.grow', { text: 'Crecimiento' }));
  const needEl = h('div.goal-need');
  const marksEl = h('div.goal-marks');

  const nameInput = h('input.field-input', { id: 'goal-name', type: 'text', value: draft.name, autocomplete: 'off', 'aria-label': 'Nombre de la meta' });
  const amountInput = h('input.field-input', { id: 'goal-amount', type: 'text', inputmode: 'decimal', value: F.editable(draft.amount), autocomplete: 'off', 'aria-label': 'Meta' });
  const monthlyInput = h('input.field-input', { id: 'goal-monthly', type: 'text', inputmode: 'decimal', value: draft.monthly ? F.editable(draft.monthly) : '', placeholder: '0', autocomplete: 'off', 'aria-label': 'Aporte mensual' });
  const rateLabel = h('span.field-value');
  const rateInput = h('input.goal-slider', { id: 'goal-rate', type: 'range', min: '0', max: '12', step: '0.5', value: String(draft.rate * 100), 'aria-label': 'Rentabilidad anual supuesta' });

  const horizonSeg = segmented([[5, '5 años'], [10, '10'], [15, '15'], [20, '20']], horizon, y => { horizon = y; paint(); });

  function paint() {
    const v = getValuation();
    const k = P.rate(draft.ccy);
    const now = v.totalUsd * k;
    const pct = Math.min(1, now / draft.amount);
    const months = monthsToGoal(now, draft.amount, draft.monthly, draft.rate);

    ringEl.querySelector('.fill').setAttribute('stroke-dasharray', `${(pct * RING).toFixed(1)} ${RING}`);
    pctEl.textContent = F.share(pct);
    ofEl.textContent = `${F.money(now, draft.ccy)} de ${compact(draft.amount, draft.ccy)}`;

    if (months === 0) { whenEl.textContent = '¡Meta alcanzada!'; whenSub.textContent = 'Es momento de ponerte una más grande.'; }
    else if (months == null) { whenEl.textContent = 'Sin fecha todavía'; whenSub.textContent = 'Con aporte 0 y sin crecimiento no llegas. Prueba con un aporte mensual.'; }
    else { whenEl.textContent = `Llegas en ${monthYear(addMonths(new Date(), months))}`; whenSub.textContent = `en ${durationLabel(months)}`; }

    // What a little more each month would change.
    const step = draft.monthly >= 1000 ? Math.round(draft.monthly * 0.2 / 50) * 50 || 100 : 100;
    const faster = monthsToGoal(now, draft.amount, draft.monthly + step, draft.rate);
    if (months && faster != null && (months == null || faster < months)) {
      nudge.hidden = false;
      nudge.replaceChildren('Con ', h('b', { text: `${F.wholeMoney(step, draft.ccy)} más al mes` }), months == null ? ` llegas en ${durationLabel(faster)}.` : ` llegas ${durationLabel(months - faster)} antes.`);
    } else nudge.hidden = true;

    const horizonMonths = months != null && months > 0 ? Math.min(months, 100 * 12) : horizon * 12;
    projHost.replaceChildren(projectionChart(projection(now, draft.amount, draft.monthly, draft.rate, horizonMonths), draft.amount, draft.ccy));

    const need = monthlyNeeded(now, draft.amount, draft.rate, horizon * 12);
    needEl.replaceChildren(
      h('span', { text: `Para llegar en ${horizon} años` }),
      h('b', { text: need === 0 ? 'Ya llegas sin aportar' : `${F.wholeMoney(Math.ceil(need), draft.ccy)} al mes` }));

    const marks = milestones(draft.amount);
    marksEl.replaceChildren(...marks.map(m => h('span.goal-mark' + (now >= m ? '.on' : ''), null,
      now >= m ? h('span.goal-mark-check', { html: ICONS.check }) : null, compact(m, draft.ccy))));
    rateLabel.textContent = `${(draft.rate * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })} % al año`;
  }

  nameInput.addEventListener('input', () => { draft.name = nameInput.value.trim() || DEFAULT.name; view.titleEl.textContent = draft.name; save(); });
  amountInput.addEventListener('input', () => { const n = F.parseNumber(amountInput.value); if (n > 0) { draft.amount = n; draft.seen = undefined; paint(); save(); } });
  monthlyInput.addEventListener('input', () => { const n = F.parseNumber(monthlyInput.value); draft.monthly = n > 0 ? n : 0; paint(); save(); });
  rateInput.addEventListener('input', () => { draft.rate = Number(rateInput.value) / 100; paint(); save(); });

  const field = (label, input, suffix) => h('label.field', null, h('span.field-label', { text: label }), input, suffix && h('span.field-suffix', { text: suffix }));
  const create = !existing && h('button.btn-primary', { type: 'button', text: 'Crear meta', onclick: () => {
    haptic(12);
    setSetting('goal', { ...draft });
    sheet.close();
    toast(`Meta creada: ${draft.name}`);
  } });
  const remove = existing && h('button.btn-text.danger', { type: 'button', text: 'Quitar meta', onclick: () => { removed = true; clearTimeout(saveTimer); setSetting('goal', null); sheet.close(); } });

  const view = makeView({
    title: draft.name,
    body: [
      h('div.goal-hero', null, h('div.goal-ring-wrap', null, ringEl, h('div.goal-ring-text', null, pctEl, ofEl)), whenEl, whenSub),
      nudge,
      h('div.goal-proj-card', null, projHost, legend),
      h('div.group', null,
        field('Aporte mensual', monthlyInput, draft.ccy),
        h('div.field.goal-rate', null, h('span.field-label', { text: 'Rentabilidad supuesta' }), rateLabel),
        h('div.goal-slider-row', null, rateInput)),
      h('p.hint', { text: 'La proyección usa la rentabilidad que elijas; no es una predicción. Como referencia, una cartera diversificada de acciones ha rendido históricamente alrededor de 7\u00a0% al año descontando inflación, con años muy negativos de por medio.' }),
      h('div.group-title', { text: 'Cuánto aportar' }),
      horizonSeg.el,
      h('div.goal-need-wrap', null, needEl),
      h('div.group-title', { text: 'Hitos' }),
      marksEl,
      h('div.group-title', { text: 'Meta' }),
      h('div.group', null, field('Nombre', nameInput), field('Cantidad', amountInput, draft.ccy)),
    ],
    foot: create ? [create] : [remove],
  });
  paint();
  sheet = openSheet(view, { onClose: () => { clearTimeout(saveTimer); if (existing && !removed) setSetting('goal', { ...state.settings.goal, ...draft }); } });
}
