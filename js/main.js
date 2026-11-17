// Screens and wiring: home (balance, chart, allocation, list), add, detail, settings.

import {
  state, subscribe, addHolding, updateHolding, removeHolding, restoreHolding,
  setSetting, replaceAll, exportData, exportObject, getHolding, enterDemo, exitDemo, isDemo, setTrades,
  accrueInterest, setApy, canWatch, isWatched, watchAsset, unwatchAsset, rewatch,
} from './store.js';
import { replay, sorted, openingOf, canTrade, canIncome, hasHistory, heldAt, consistent, newId, INCOME, incomeOf, incomeSince, addMonth, monthlyRate } from './trades.js';
import * as P from './prices.js';
import * as H from './history.js';
import * as F from './format.js';
import { KINDS, UNITS, METALS, CRYPTO, STOCKS, CASH, CASH_ITEM, searchLocal, searchRemote, newCustomAsset, newRetireAccount, TRACKS, ACCOUNT_TYPES } from './catalog.js';
import { h, spring, pan, rubber, haptic, ICONS, reduceMotion } from './motion.js';
import { logo } from './logo.js';
import { createChart } from './chart.js';
import { openSheet, makeView, toast } from './sheet.js';
import { Roller, segmented, setPill, toggle, sparkEl, drawSpark } from './ui.js';
import { marketSeries, realSeries, rangeForSpan, priceAt } from './series.js';
import { snapshots, recordSnapshot, replaceSnapshots } from './snapshots.js';
import { targets, plan, openTargets } from './targets.js';
import { loadStats } from './stats.js';
import { startUpdates, APP_VERSION } from './update.js';
import { showWhatsNew, showLatest } from './whatsnew.js';
import { startPrivacy } from './privacy.js';
import * as V from './vault.js';
import { renderGoalCard, openGoal } from './goal.js';

const $ = id => document.getElementById(id);
const ccy = () => state.settings.ccy;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const RANGE_LABEL = { '1D': '24 h', '1S': '7 días', '1M': '30 días', '1A': '1 año' };
const meter = document.createElement('canvas').getContext('2d');

// A big amount input is exactly as wide as its text, so its unit sits right after it.
function fitInput(input) {
  const text = input.value || '0';
  input.style.fontSize = text.length > 12 ? '28px' : text.length > 8 ? '38px' : '';
  const cs = getComputedStyle(input);
  if (!cs.fontSize) { input.style.width = `${text.length + 0.3}ch`; return; }
  meter.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  input.style.width = Math.ceil(meter.measureText(text).width + parseFloat(cs.fontSize) * 0.1) + 'px';
}

// The balance can also be counted in bitcoin or in ounces of gold; both are
// followed all the time so switching is instant.
const BTC = CRYPTO.find(a => a.cg === 'bitcoin');
const XAU = METALS[0];
const UNIT_CYCLE = ['ccy', 'btc', 'xau'];

// ============================================================================
// Valuation
// ============================================================================

function valuation() {
  const r = P.rate(ccy());
  let total = 0, day = 0, hasDay = false, cost = 0, costValue = 0, loading = false;
  const rows = state.holdings.map(a => {
    const q = P.quoteOf(a);
    const value = q ? q.p * a.qty * r : null;
    const dayAbs = q && q.prev ? (q.p - q.prev) * a.qty * r : null;
    const dayPct = q && q.prev ? q.p / q.prev - 1 : null;
    const gainAbs = q && a.cost != null ? (q.p - a.cost) * a.qty * r : null;
    const gainPct = q && a.cost ? q.p / a.cost - 1 : null;
    if (value != null) total += value;
    else if (a.kind !== 'stock' || P.stockState() === 'ok') loading = true; // a price is still on its way
    if (dayAbs != null) { day += dayAbs; hasDay = true; }
    if (gainAbs != null) { cost += a.cost * a.qty * r; costValue += value; }
    return { a, q, value, dayAbs, dayPct, gainAbs, gainPct };
  });
  rows.sort((x, y) => (y.value ?? -1) - (x.value ?? -1));
  const kinds = new Map();
  for (const row of rows) if (row.value) kinds.set(row.a.kind, (kinds.get(row.a.kind) || 0) + row.value);
  return {
    rows, total, totalUsd: total / r, rate: r, loading,
    day: hasDay && total - day > 0 ? { abs: day, pct: day / (total - day) } : null,
    gain: cost > 0 ? { abs: costValue - cost, pct: costValue / cost - 1 } : null,
    kinds: [...kinds].sort((x, y) => y[1] - x[1]),
  };
}

/** The asset the balance is counted in, or null for the display currency. */
function unitNow() {
  const id = state.settings.unit;
  const asset = id === 'btc' ? BTC : id === 'xau' ? XAU : null;
  const q = asset && P.quoteOf(asset);
  return q ? { id, asset, usd: q.p, prev: q.prev } : null;
}

function qtyLabel(a) {
  if (a.tx && !(a.qty > 0)) return 'Posición cerrada';
  if (a.kind === 'metal') {
    const u = UNITS[a.unit] ? a.unit : 'oz';
    return `${F.qty(a.qty * UNITS[u].perOz)} ${UNITS[u].label}`;
  }
  if (a.kind === 'cash') return `${F.qty(a.qty)} ${a.sym}`;
  if (a.kind === 'custom') return 'Manual';
  if (a.kind === 'retire') return `${a.accType || 'Retiro'} · ${a.track ? trackName(a.track) : 'saldo fijo'}`;
  return `${F.qty(a.qty)} ${a.sym}`;
}

function trackName(sym) { return (TRACKS.find(t => t[0] === sym) || [null, sym])[1]; }

// ============================================================================
// Home
// ============================================================================

const roller = new Roller($('roller'));
const rowMap = new Map();    // holding id -> row refs
const segMap = new Map();    // kind -> allocation segment
const tsegMap = new Map();   // kind -> target segment
const chipMap = new Map();   // kind -> legend chip
let filter = null;           // show only one class when set
let pillMode = 'range';      // 'range' (follows the chart) | 'total' (vs cost)
let lastShown = null, lastShownMode = '';
let openRow = null;
let firstPaint = true;
let ctx = null;              // what the last render computed: { v, u, info }
let homeScrub = null;        // { t, v, first } while a finger is on the chart
let chartSig = '', chartInfo = null;
const ACT = 148;             // width of the two swipe actions

const homeChart = createChart($('pchart'), { deferred: true, onScrub: s => { homeScrub = s; if (ctx) paintHero(ctx); } });
const rangeSeg = segmented([['1D', '1D'], ['1S', '1S'], ['1M', '1M'], ['1A', '1A'], ['real', 'Real']], state.settings.range, r => setSetting('range', r));
$('prange').append(rangeSeg.el);

/** The chart's series, rebuilt only when something it depends on changed. */
function chartSeries(v, u) {
  const range = state.settings.range;
  const sig = [
    range, u ? u.id : 'ccy', ccy(), H.historyVersion(), snapshots().length,
    state.holdings.map(a => `${a.id}:${a.qty}:${P.quoteOf(a) ? 1 : 0}`).join(','),
  ].join('|');
  if (sig === chartSig) return { info: chartInfo, fresh: false };
  chartSig = sig;
  const now = Date.now();
  const unit = u ? { asset: u.asset, usd: u.usd } : null;
  chartInfo = range === 'real'
    ? realSeries({ snaps: snapshots(), now, liveUsd: v.totalUsd, rate: v.rate, unit, peek: H.peek })
    : marketSeries({ range, span: H.RANGES[range].span, now, holdings: state.holdings, quoteOf: P.quoteOf, peek: H.peek, rate: v.rate, unit });
  return { info: chartInfo, fresh: true };
}

/** What the pill under the balance says, or null to hide it. */
function pillData({ v, u, info }) {
  const range = state.settings.range;
  if (homeScrub && info) {
    const span = info.pts[info.pts.length - 1][0] - info.pts[0][0];
    return { ratio: homeScrub.v / homeScrub.first - 1, abs: null, label: F.timeLabel(homeScrub.t, range === 'real' ? rangeForSpan(span) : range) };
  }
  if (pillMode === 'total' && v.gain) return { ratio: v.gain.pct, abs: v.gain.abs, label: 'total' };
  if (range !== '1D' && info && info.moved) {
    const first = info.pts[0][1], last = info.pts[info.pts.length - 1][1];
    if (first > 0) {
      return { ratio: last / first - 1, abs: info.inUnit ? null : last - first, label: range === 'real' ? `desde ${F.dateLabel(info.pts[0][0])}` : RANGE_LABEL[range] };
    }
  }
  if (!v.day) return null;
  if (u && u.prev) {
    // Today's change measured in the unit: the unit's own move is taken out.
    const prevUsd = v.totalUsd - v.day.abs / v.rate;
    if (prevUsd > 0) return { ratio: (v.totalUsd / u.usd) / (prevUsd / u.prev) - 1, abs: null, label: 'hoy' };
  }
  return { ratio: v.day.pct, abs: v.day.abs, label: 'hoy' };
}

/** Balance, pill and glow. Cheap enough to run on every scrub move. */
function paintHero(c) {
  const { v, u, info } = c;
  const has = state.holdings.length > 0, hidden = state.settings.hidden;
  const scrubbing = !!(homeScrub && info);
  const asUnit = scrubbing ? info.inUnit : !!u;
  const value = !has ? 0 : scrubbing ? homeScrub.v : asUnit ? v.totalUsd / u.usd : v.total;

  const parts = hidden ? [{ type: 'integer', value: '•••••' }] : asUnit ? F.unitParts(value, u.id) : F.moneyParts(value, ccy());
  const len = parts.reduce((n, p) => n + p.value.length, 0);
  $('balance').dataset.size = len <= 9 ? 'l' : len <= 11 ? 'm' : len <= 13 ? 's' : 'xs';
  const mode = hidden ? 'hidden' : asUnit ? u.id : ccy();
  const dir = scrubbing || lastShown == null || mode !== lastShownMode ? 0 : Math.sign(value - lastShown);
  roller.set(parts, dir);
  lastShown = value; lastShownMode = mode;
  if (!scrubbing) $('nav-title').textContent = hidden ? 'Portfolio' : asUnit ? F.unitText(value, u.id) : F.money(value, ccy());

  const pill = $('change');
  if (pillMode === 'total' && !v.gain) pillMode = 'range';
  const m = has ? pillData(c) : null;
  pill.hidden = !m;
  if (m) setPill(pill, m.ratio, hidden ? null : m.abs, m.label);
  pill.dataset.toggle = v.gain ? '1' : '';
  $('page').dataset.trend = !m || hidden ? '' : m.ratio > 0.00005 ? 'up' : m.ratio < -0.00005 ? 'down' : '';
}

function renderChart(c) {
  const has = state.holdings.length > 0;
  $('home-chart').hidden = !has;
  if (!has) { c.info = null; return; }
  const { info, fresh } = chartSeries(c.v, c.u);
  c.info = info;
  $('pchart').classList.toggle('empty', !info);
  $('chart-empty').hidden = !!info;
  if (info) {
    if (fresh) homeChart.setData(info.pts);
    else if (!homeScrub) homeChart.tick(info.inUnit ? c.v.totalUsd / c.u.usd : c.v.total);
  }
  const note = $('chart-note');
  const missing = info ? info.missing : [];
  note.hidden = missing.length === 0;
  if (missing.length) {
    const names = missing.length > 3 ? `${missing.slice(0, 2).join(', ')} y ${missing.length - 2} más` : missing.join(', ');
    const needsKey = state.holdings.some(a => H.availability(a) === 'needs-key');
    note.textContent = `Sin histórico: ${names}`;
    note.dataset.action = needsKey ? '1' : '';
  }
}

function anchorPlans() {
  for (const a of state.holdings) {
    if (a.kind !== 'retire' || !a.track || a.ref) continue;
    const p = P.livePrice({ id: 'stock:' + a.track });
    if (p) updateHolding(a.id, { ref: p });
  }
}

function renderHome() {
  if (!isDemo()) anchorPlans();
  const v = valuation();
  const u = unitNow();
  const has = state.holdings.length > 0;
  const hidden = state.settings.hidden;
  ctx = { v, u, info: null };

  $('hero').hidden = !has;
  renderChart(ctx);
  paintHero(ctx);
  renderAlloc(v);
  renderGoalCard($('goal'), v);
  renderNotice();
  renderList(v);
  renderWatch(v);
  renderPerf(v);
  if (!isDemo()) V.markSince(has);

  $('empty').hidden = has;
  $('demo-bar').hidden = !isDemo();
  $('list').classList.toggle('masked', hidden);
  const st = P.status();
  $('live').classList.toggle('on', st === 'live');
  $('live').title = { live: 'En vivo', stale: 'Reconectando', loading: 'Conectando', offline: 'Sin conexión' }[st];

  // The real history: one record of the balance every half hour the app is open.
  if (has && !isDemo() && !v.loading && recordSnapshot(v.totalUsd)) mirrorNow();

  if (firstPaint) {
    hideSplash();
    // After an update: what's new, once the launch animation is out of the way.
    if (!isDemo()) setTimeout(() => showWhatsNew({ returning: state.holdings.length > 0 }), 1500);
  }
  firstPaint = false;
}

function renderAlloc(v) {
  const bar = $('alloc-bar'), tbar = $('alloc-target'), legend = $('alloc-legend');
  const t = targets();
  const rows = plan(v.kinds, v.total, t).filter(x => x.value > 0 || (x.target || 0) > 0);
  rows.sort((x, y) => y.value - x.value || (y.target || 0) - (x.target || 0));
  $('alloc').hidden = v.kinds.length === 0;
  if (filter && !v.kinds.some(k => k[0] === filter)) filter = null;

  const live = new Set();
  rows.forEach((x, i) => {
    const kind = x.kind;
    live.add(kind);

    let seg = segMap.get(kind);
    if (x.value > 0) {
      if (!seg) { seg = h('div.alloc-seg', { style: { background: KINDS[kind].color } }); bar.append(seg); segMap.set(kind, seg); }
      seg.style.order = i;
      seg.style.flex = `${Math.max(x.share, 0.004)} 1 0px`;
      seg.classList.toggle('on', filter === kind);
    } else if (seg) { seg.remove(); segMap.delete(kind); }

    let tseg = tsegMap.get(kind);
    if (t && x.target > 0) {
      if (!tseg) { tseg = h('div.alloc-seg', { style: { background: KINDS[kind].color } }); tbar.append(tseg); tsegMap.set(kind, tseg); }
      tseg.style.order = i;
      tseg.style.flex = `${x.target} 1 0px`;
    } else if (tseg) { tseg.remove(); tsegMap.delete(kind); }

    let chip = chipMap.get(kind);
    if (!chip) {
      chip = h('button.chip', { type: 'button', onclick: () => { filter = filter === kind ? null : kind; haptic(5); renderHome(); } },
        h('i', { style: { background: KINDS[kind].color } }), h('span', { text: KINDS[kind].label }), h('b'), h('em'));
      legend.append(chip);
      chipMap.set(kind, chip);
    }
    chip.style.order = i;
    chip.children[2].textContent = F.share(x.share);
    // How far this class is from its target, in percentage points.
    const pts = x.drift == null ? 0 : Math.round(x.drift * 100);
    chip.children[3].textContent = pts ? (pts > 0 ? `+${pts}` : `−${-pts}`) : '';
    chip.classList.toggle('on', filter === kind);
    chip.setAttribute('aria-pressed', String(filter === kind));
  });
  for (const [kind, chip] of chipMap) {
    if (live.has(kind)) continue;
    chip.remove(); chipMap.delete(kind);
    const seg = segMap.get(kind); if (seg) { seg.remove(); segMap.delete(kind); }
    const tseg = tsegMap.get(kind); if (tseg) { tseg.remove(); tsegMap.delete(kind); }
  }
  tbar.hidden = !t;
  bar.classList.toggle('filtered', !!filter);
  legend.classList.toggle('filtering', !!filter);
  $('btn-targets').classList.toggle('set', !!t);
}

function renderNotice() {
  const box = $('notice');
  const stocks = state.holdings.some(a => a.kind === 'stock');
  const st = P.stockState();
  let msg = null, label = null, action = null;
  if (stocks && st !== 'ok' && !isDemo()) {
    msg = st === 'invalid' ? 'La llave de Finnhub no es válida' : 'Acciones sin precio en vivo';
    label = st === 'invalid' ? 'Revisar' : 'Conectar';
    action = () => openSettings();
  } else if (state.holdings.length && !isDemo()) {
    const days = V.backupDue(Date.now(), copySig());
    if (days != null) {
      msg = V.lastExport() ? `Sin copia fuera del iPhone desde hace ${days} días` : 'Aún no tienes una copia fuera del iPhone';
      label = 'Guardar';
      action = () => saveCopy();
    }
  }
  box.hidden = !msg;
  if (!msg || box.dataset.msg === msg) return;
  box.dataset.msg = msg;
  box.replaceChildren(h('span', { text: msg }), h('button', { type: 'button', text: label, onclick: action }));
}

// ---- performance over 7 days, 30 days and a year ----------------------------

const PERF = [['hoy', 'Hoy'], ['1S', '7 días'], ['1M', '30 días'], ['1A', '1 año']];
let perfSel = 'hoy';
const perfTiles = new Map();

/**
 * What today's positions gained or lost over each period, plus the best and
 * worst asset of the selected one. Quiet by design: three figures and a line.
 */
function renderPerf(v) {
  const box = $('perf'), tilesEl = $('perf-tiles'), line = $('perf-line');
  const now = Date.now(), r = v.rate;
  const results = PERF.map(([range, label]) => {
    if (range === 'hoy') return { range, label, ok: !!v.day, pct: v.day ? v.day.pct : 0, abs: v.day ? v.day.abs : 0 };
    const s = marketSeries({ range, span: H.RANGES[range].span, now, holdings: state.holdings, quoteOf: P.quoteOf, peek: H.peek, rate: r, unit: null });
    const first = s.pts[0][1], last = s.pts[s.pts.length - 1][1];
    return { range, label, ok: s.moved && first > 0, pct: first > 0 ? last / first - 1 : 0, abs: last - first };
  });
  box.hidden = !results.some(x => x.ok);
  if (box.hidden) return;
  box.classList.toggle('masked', state.settings.hidden);
  // The chosen period, or the first one with data while the others still load.
  const sel = results.find(x => x.range === perfSel && x.ok) ? perfSel : results.find(x => x.ok).range;

  for (const x of results) {
    let t = perfTiles.get(x.range);
    if (!t) {
      t = h('button.perf-tile', { type: 'button', onclick: () => { perfSel = x.range; haptic(5); scheduleRender(true); } },
        h('span.perf-label', { text: x.label }), h('span.perf-pct'), h('span.perf-abs'));
      tilesEl.append(t);
      perfTiles.set(x.range, t);
    }
    const tone = !x.ok ? '' : x.pct > 0.00005 ? 'up' : x.pct < -0.00005 ? 'down' : '';
    t.className = 'perf-tile ' + tone + (x.range === sel ? ' on' : '');
    t.disabled = !x.ok;
    t.setAttribute('aria-pressed', String(x.range === sel));
    t.children[1].textContent = x.ok ? F.pct(x.pct) : '—';
    t.children[2].textContent = x.ok ? (x.abs < 0 ? '−' : x.abs > 0 ? '+' : '') + F.wholeMoney(Math.abs(x.abs), ccy()) : '';
  }

  // The best and worst asset of the selected period, by their own price change.
  const moves = [];
  if (sel === 'hoy') {
    for (const r of v.rows) if (r.dayPct != null && r.a.kind !== 'cash' && r.value > 0) moves.push({ a: r.a, pct: r.dayPct });
  } else {
  const span = H.RANGES[sel].span;
  for (const a of state.holdings) {
    const q = P.quoteOf(a), hist = H.peek(a, sel);
    if (!q || !(a.qty > 0) || !hist || hist.pts.length < 2) continue;
    const then = priceAt(hist.pts, now - span);
    if (then > 0) moves.push({ a, pct: q.p / then - 1 });
  }
  }
  moves.sort((x, y) => y.pct - x.pct);
  const part = (label, m) => h('span.perf-item', null, h('span.perf-k', { text: label }), h('span', { text: m.a.name }), h('b.' + (m.pct >= 0 ? 'up' : 'down'), { text: F.pct(m.pct) }));
  if (!moves.length) line.replaceChildren();
  else if (moves.length === 1) line.replaceChildren(part('', moves[0]));
  else line.replaceChildren(part('Mejor', moves[0]), part('Peor', moves[moves.length - 1]));
  line.hidden = !moves.length;

  // Dividends, rewards and interest of the last twelve months.
  const yearAgo = now - 365 * 86400e3;
  const income = state.holdings.reduce((sum, a) => sum + incomeSince(a.tx, yearAgo), 0) * r;
  const inc = $('perf-income');
  inc.hidden = !(income > 0);
  if (income > 0) inc.replaceChildren(h('span.perf-item', null, h('span.perf-k', { text: 'Dividendos e intereses · 12 meses' }), h('b.up', { text: '+' + F.wholeMoney(income, ccy()) })));
}

function slideRow(row, to, velocity = 0) {
  if (row.anim) row.anim.stop();
  row.anim = spring({ from: row.x, to, velocity, stiffness: 420, damping: 38, onUpdate: x => setRowX(row, x) });
}
function setRowX(row, x) {
  row.x = x;
  row.main.style.transform = x ? `translate3d(${x}px,0,0)` : '';
  row.el.classList.toggle('swiped', x < -0.5);
}
function closeOpenRow(except) {
  if (openRow && openRow !== except) { slideRow(openRow, 0); openRow = null; }
}

// ---- drag to reorder ---------------------------------------------------------
// Hold a row for a moment, then move it up or down; the others make room.

const HOLD_MS = 420;
let drag = null, press = null, dragClickBlock = 0;

function cancelPress() {
  if (press) { clearTimeout(press.timer); press = null; }
}

function beginDrag(row, y) {
  press = null;
  if (filter || drag) return;
  const list = $('list');
  const els = [...list.children];
  const index = els.indexOf(row.el);
  if (index < 0 || els.length < 2) return;
  closeOpenRow();
  const scroller = $('scroll');
  drag = {
    row, list, scroller, index, target: index, startY: y, lastY: y, startScroll: scroller.scrollTop,
    h: row.el.offsetHeight,
    items: els.map(el => { const r = el.getBoundingClientRect(); return { el, top: r.top + scroller.scrollTop, h: r.height }; }),
    raf: 0,
  };
  haptic(15);
  list.classList.add('reordering');
  row.el.classList.add('lifted');
  dragClickBlock = Infinity;
  autoScroll();
}

function moveDrag(y) {
  if (!drag) return;
  drag.lastY = y;
  layoutDrag();
}

function layoutDrag() {
  const d = drag;
  const dy = d.lastY - d.startY + (d.scroller.scrollTop - d.startScroll);
  d.row.el.style.transform = `translate3d(0,${dy}px,0) scale(1.02)`;
  const self = d.items[d.index];
  const centre = self.top + self.h / 2 + dy;
  let t = 0;
  d.items.forEach((it, j) => { if (j !== d.index && centre > it.top + it.h / 2) t++; });
  if (t !== d.target) { d.target = t; haptic(5); }
  d.items.forEach((it, j) => {
    if (j === d.index) return;
    let shift = 0;
    if (d.index < t && j > d.index && j <= t) shift = -d.h;
    else if (t < d.index && j >= t && j < d.index) shift = d.h;
    it.el.style.transform = shift ? `translate3d(0,${shift}px,0)` : '';
  });
}

// Near the top or bottom edge the page scrolls along with the finger.
function autoScroll() {
  if (!drag) return;
  const { scroller, lastY } = drag;
  const edge = 90, vh = scroller.clientHeight;
  const speed = lastY < edge ? -(edge - lastY) / 6 : lastY > vh - edge ? (lastY - (vh - edge)) / 6 : 0;
  if (speed) { scroller.scrollTop += speed; layoutDrag(); }
  drag.raf = requestAnimationFrame(autoScroll);
}

function endDrag() {
  const d = drag;
  if (!d) return;
  drag = null;
  cancelAnimationFrame(d.raf);
  const ids = d.items.map(it => [...rowMap].find(([, r]) => r.el === it.el)[0]);
  const [moved] = ids.splice(d.index, 1);
  ids.splice(d.target, 0, moved);

  // Put the DOM in the new order right away, then glide the row into its slot.
  const from = d.row.el.getBoundingClientRect().top;
  d.items.forEach(it => { it.el.style.transform = ''; });
  d.list.classList.remove('reordering');
  d.row.el.classList.remove('lifted');
  ids.forEach(id => d.list.append(rowMap.get(id).el));
  const to = d.row.el.getBoundingClientRect().top;
  if (!reduceMotion() && Math.abs(from - to) > 1) {
    d.row.el.animate([{ transform: `translateY(${from - to}px) scale(1.02)` }, { transform: 'none' }], { duration: 260, easing: EASE });
  }
  dragClickBlock = performance.now() + 350;
  haptic(10);
  if (d.target !== d.index) {
    // Hidden rows (a class filter is never active while dragging) keep their place.
    setSetting('order', ids);
  }
}

function reorderable(row) {
  const main = row.main;
  const start = (x, y) => {
    if (filter || drag) return;
    cancelPress();
    press = { x, y, timer: setTimeout(() => beginDrag(row, y), HOLD_MS) };
  };
  const move = (x, y, ev) => {
    if (drag && drag.row === row) { if (ev.cancelable) ev.preventDefault(); moveDrag(y); return; }
    if (press && (Math.abs(x - press.x) > 8 || Math.abs(y - press.y) > 8)) cancelPress();
  };
  const end = () => { cancelPress(); if (drag && drag.row === row) endDrag(); };

  main.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  main.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
  main.addEventListener('touchend', end);
  main.addEventListener('touchcancel', end);
  main.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    start(e.clientX, e.clientY);
    const mm = ev => move(ev.clientX, ev.clientY, ev);
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); end(); };
    addEventListener('mousemove', mm);
    addEventListener('mouseup', mu);
  });
  main.addEventListener('contextmenu', e => e.preventDefault());
  // A long press or a drag must not also open the asset.
  main.addEventListener('click', e => { if (performance.now() < dragClickBlock) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

function createRow(a) {
  const name = h('div.row-name'), sub = h('div.row-sub'), val = h('div.row-val'), chg = h('div.row-chg');
  const spark = sparkEl();
  if (H.availability(a) === 'none') spark.style.display = 'none';
  const main = h('div.row-main', { role: 'button', tabIndex: 0 },
    logo(a), h('div.row-mid', null, name, sub), spark, h('div.row-end', null, val, chg));
  const edit = h('button.act.edit', { type: 'button', tabIndex: -1, 'aria-label': 'Editar', html: ICONS.pencil });
  const del = h('button.act.del', { type: 'button', tabIndex: -1, 'aria-label': 'Eliminar', html: ICONS.trash });
  const el = h('div.row', null, h('div.row-actions', null, edit, del), main);
  const row = { id: a.id, el, main, name, sub, val, chg, spark, sparkSrc: null, x: 0, base: 0, w: 0, full: false, anim: null };

  const open = () => {
    if (row.x < -4) { slideRow(row, 0); openRow = null; return; }
    closeOpenRow();
    openDetail(a.id);
  };
  main.addEventListener('click', open);
  main.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  edit.addEventListener('click', () => { slideRow(row, 0); openRow = null; openDetail(a.id, { edit: true }); });
  del.addEventListener('click', () => deleteHolding(a.id));

  reorderable(row);

  pan(main, {
    axis: 'x',
    shouldBegin: () => !drag,
    onStart: () => { closeOpenRow(row); if (row.anim) row.anim.stop(); row.base = row.x; row.w = el.offsetWidth; },
    onMove: d => {
      let x = row.base + d;
      if (x > 0) x = rubber(x, row.w) * 0.35;
      setRowX(row, x);
      const full = x < -row.w * 0.6;
      if (full !== row.full) { row.full = full; el.classList.toggle('full', full); haptic(12); }
    },
    onEnd: v => {
      if (row.full) { deleteHolding(a.id); return; }
      if (row.x < -ACT / 2 || v < -0.4) { slideRow(row, -ACT, v); openRow = row; }
      else { slideRow(row, 0, v); if (openRow === row) openRow = null; }
    },
  });
  return row;
}

/** Rows in the user's order when they arranged one (new assets go last), else by value. */
function arranged(rows) {
  const order = state.settings.order;
  if (!Array.isArray(order) || !order.length) return rows;
  const pos = new Map(order.map((id, i) => [id, i]));
  return rows.map((r, i) => [r, pos.has(r.a.id) ? pos.get(r.a.id) : order.length + i]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
}

function renderList(v) {
  const list = $('list');
  const rows = arranged(filter ? v.rows.filter(r => r.a.kind === filter) : v.rows);

  // FLIP: remember where each row is, reorder, then animate from the old place.
  const before = new Map();
  if (!firstPaint) rowMap.forEach((row, id) => before.set(id, row.el.getBoundingClientRect().top));

  const wanted = new Set(rows.map(r => r.a.id));
  for (const [id, row] of rowMap) {
    if (wanted.has(id)) continue;
    if (openRow === row) openRow = null;
    row.el.remove();
    rowMap.delete(id);
  }

  const order = [];
  let longest = 0;
  for (const r of rows) {
    const a = r.a;
    let row = rowMap.get(a.id);
    const isNew = !row;
    if (isNew) { row = createRow(a); rowMap.set(a.id, row); }
    row.name.textContent = a.name;
    row.sub.textContent = qtyLabel(a);
    row.val.textContent = r.value != null ? F.money(r.value, ccy()) : '—';
    longest = Math.max(longest, row.val.textContent.length);

    // Second line on the right: change (today or vs cost), else the unit price.
    const ratio = pillMode === 'total' ? r.gainPct : r.dayPct;
    if (ratio != null) {
      row.chg.textContent = F.pct(ratio);
      row.chg.className = 'row-chg ' + (ratio > 0.00005 ? 'up' : ratio < -0.00005 ? 'down' : '');
    } else {
      row.chg.className = 'row-chg';
      if (a.kind === 'custom' || a.kind === 'retire' || (a.kind === 'cash' && a.sym === ccy())) row.chg.textContent = '';
      else row.chg.textContent = r.q ? F.price(r.q.p * v.rate, ccy()) : a.kind === 'stock' ? 'Sin precio' : 'Cargando';
    }

    // The last 24 hours, the same period as the % beside it, and in its colour.
    // Redrawn only when its data or that direction changes.
    const day = H.peek(a, '1D');
    const src = day ? H.windowed(a, day.pts, '1D') : null;
    const dir = r.dayPct == null ? null : r.dayPct > 0.00005 ? 1 : r.dayPct < -0.00005 ? -1 : 0;
    if (src !== row.sparkSrc && !(src && row.sparkSrc && src.length === row.sparkSrc.length && src[src.length - 1] === row.sparkSrc[row.sparkSrc.length - 1]) || dir !== row.sparkDir) {
      row.sparkSrc = src; row.sparkDir = dir;
      if (src) drawSpark(row.spark, src, 86400e3, r.dayPct); else row.spark.classList.remove('on');
    }
    order.push({ row, isNew });
  }
  // Long amounts leave no room for the trend line on a phone.
  list.classList.toggle('no-spark', longest > 11 && list.clientWidth < 440);
  // Every amount column as wide as the widest, so the trend lines line up.
  let endW = 0;
  for (const { row } of order) endW = Math.max(endW, row.val.scrollWidth, row.chg.scrollWidth);
  const endPx = endW ? Math.ceil(endW) + 'px' : '';
  if (list.style.getPropertyValue('--end-w') !== endPx) list.style.setProperty('--end-w', endPx);

  const current = [...list.children];
  const same = current.length === order.length && order.every((o, i) => current[i] === o.row.el);
  if (!same) order.forEach(o => list.append(o.row.el));

  if (firstPaint || reduceMotion()) return;
  for (const { row, isNew } of order) {
    if (isNew) {
      const hgt = row.el.offsetHeight;
      row.el.animate([{ height: '0px', opacity: 0 }, { height: hgt + 'px', opacity: 1 }], { duration: 420, easing: EASE });
      continue;
    }
    const dy = before.get(row.id) - row.el.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) row.el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 520, easing: EASE });
  }
}

function deleteHolding(id) {
  const a = getHolding(id);
  if (!a) return;
  const row = rowMap.get(id);
  const finish = () => {
    const undo = removeHolding(id);
    if (undo) toast(`${a.name} eliminado`, { action: { label: 'Deshacer', run: () => restoreHolding(undo) } });
  };
  haptic(14);
  if (row && !reduceMotion()) {
    if (openRow === row) openRow = null;
    const hgt = row.el.offsetHeight;
    row.el.animate([{ height: hgt + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 300, easing: EASE, fill: 'forwards' }).onfinish = finish;
  } else finish();
}

// ---- watchlist: assets followed without holding them ---------------------------

const watchRows = new Map();

function renderWatch(v) {
  const box = $('watch'), list = $('watch-list');
  const items = isDemo() ? [] : state.watch;
  box.hidden = !items.length;
  if (!items.length) { list.replaceChildren(); watchRows.clear(); return; }
  const r = v.rate;
  const order = [];
  for (const a of items) {
    let row = watchRows.get(a.id);
    if (!row) {
      const name = h('div.row-name'), sub = h('div.row-sub'), val = h('div.row-val'), chg = h('div.row-chg');
      const spark = sparkEl();
      const el = h('div.row', null, h('div.row-main', { role: 'button', tabIndex: 0, onclick: () => openWatch(a.id) },
        logo(a), h('div.row-mid', null, name, sub), spark, h('div.row-end', null, val, chg)));
      row = { el, name, sub, val, chg, spark, src: null, dir: null };
      watchRows.set(a.id, row);
    }
    const q = P.quoteOf(a);
    const pct = q && q.prev ? q.p / q.prev - 1 : null;
    row.name.textContent = a.name;
    row.sub.textContent = a.kind === 'metal' ? `${a.sym} · oz` : a.sym;
    row.val.textContent = q ? F.price(q.p * r, ccy()) : '—';
    row.chg.textContent = pct != null ? F.pct(pct) : q ? '' : a.kind === 'stock' && P.stockState() !== 'ok' ? 'Sin precio' : 'Cargando';
    row.chg.className = 'row-chg ' + (pct > 0.00005 ? 'up' : pct < -0.00005 ? 'down' : '');
    const day = H.peek(a, '1D');
    const src = day ? H.windowed(a, day.pts, '1D') : null;
    const dir = pct == null ? null : Math.sign(Math.round(pct * 1e5));
    const last = src && src[src.length - 1];
    if (last !== row.src || dir !== row.dir) {
      row.src = last; row.dir = dir;
      if (src) drawSpark(row.spark, src, 86400e3, pct); else row.spark.classList.remove('on');
    }
    order.push(row.el);
  }
  for (const [id, row] of watchRows) if (!items.some(a => a.id === id)) { row.el.remove(); watchRows.delete(id); }
  const cur = [...list.children];
  if (cur.length !== order.length || order.some((el, i) => cur[i] !== el)) list.replaceChildren(...order);
  // same column for the trend lines as in the main list
  let endW = 0;
  for (const row of watchRows.values()) endW = Math.max(endW, row.val.scrollWidth, row.chg.scrollWidth);
  list.style.setProperty('--end-w', endW ? Math.ceil(endW) + 'px' : '');
}

/** A followed asset: price, chart, figures; buy it or stop following. */
function openWatch(id) {
  const a = state.watch.find(x => x.id === id);
  if (!a) return;
  let range = '1D', chart = null, scrub = null, seq = 0, sheet = null;
  const big = h('div.big'), pill = h('span.pill'), meta = h('span');
  const host = H.availability(a) === 'yes' ? h('div', { 'data-nodrag': '' }) : null;
  const seg = segmented(Object.keys(H.RANGES).map(k => [k, k]), range, k => { range = k; load(); });
  const statsGroup = h('div.group', { hidden: true });
  const approx = h('p.hint', { hidden: true });

  function paint() {
    const q = P.quoteOf(a), r = P.rate(ccy());
    if (scrub) {
      big.textContent = F.price(scrub.v * r, ccy());
      setPill(pill, scrub.v / scrub.first - 1, null, null); pill.hidden = false;
      meta.textContent = F.timeLabel(scrub.t, range);
      return;
    }
    big.textContent = q ? F.price(q.p * r, ccy()) : '—';
    const first = chart && chart.first;
    const ratio = q && first ? q.p / first - 1 : q && q.prev ? q.p / q.prev - 1 : null;
    pill.hidden = ratio == null;
    if (ratio != null) setPill(pill, ratio, null, null);
    meta.textContent = ratio == null ? (q ? '' : 'Sin precio en vivo') : first ? RANGE_LABEL[range] : 'hoy';
    if (chart && range === '1D' && q) chart.tick(q.p);
  }
  async function load() {
    if (!chart) return;
    const my = ++seq;
    chart.setData(null);
    const got = await H.load(a, range);
    if (my !== seq || !chart) return;
    if (!got) { if (range === '1D') { chart.destroy(); chart = null; host.hidden = true; seg.el.hidden = true; } paint(); return; }
    chart.setData(H.windowed(a, got.pts, range));
    approx.hidden = !got.approx;
    if (got.approx) approx.textContent = `Histórico aproximado a partir ${H.proxyOf(a)}.`;
    paint();
  }
  async function stats() {
    const q = P.quoteOf(a);
    const rows = await loadStats(a, { price: q && q.p, rate: P.rate(ccy()), ccy: ccy(), finnhubKey: state.settings.finnhubKey, historyKey: state.settings.historyKey });
    if (!rows.length) return;
    statsGroup.replaceChildren(...rows.map(x => h('div.field', null, h('span.field-label', { text: x.label }), h('span.field-value', { text: x.value }))));
    statsGroup.hidden = false;
  }

  const buy = () => { const v = amountView(sheet, a); sheet.push(v); v.focus(); };
  const stop = () => {
    const undo = unwatchAsset(id);
    sheet.close();
    if (undo) toast(`Dejaste de seguir ${a.name}`, { action: { label: 'Deshacer', run: () => rewatch(undo) } });
  };
  const view = makeView({
    body: [
      h('div.detail-top', null, logo(a), h('div', null, h('div.detail-name', { text: a.name }), h('div.detail-sym', { text: `${a.sym} · Seguimiento` }))),
      h('div.detail-price', null, big, h('div.detail-meta', null, pill, meta)),
      host, host && seg.el, approx,
      statsGroup,
      h('div.detail-actions', null,
        h('button.btn-secondary', { type: 'button', text: 'Comprar', onclick: buy }),
        h('button.btn-text.danger', { type: 'button', id: 'unwatch', text: 'Dejar de seguir', onclick: stop })),
    ],
  });
  if (host) chart = createChart(host, { onScrub: x => { scrub = x; paint(); } });
  const off = P.onPrices(paint);
  view.onRemove = () => { off(); if (chart) { chart.destroy(); chart = null; } };
  view.onShow = paint;
  sheet = openSheet(view);
  paint(); load(); stats();
}

// Price ticks arrive several times a second; the home repaints about once a second.
let renderTimer = 0, lastRender = 0;
function scheduleRender(now) {
  if (now) { clearTimeout(renderTimer); renderTimer = 0; lastRender = performance.now(); renderHome(); return; }
  if (renderTimer) return;
  const wait = Math.max(0, 900 - (performance.now() - lastRender));
  renderTimer = setTimeout(() => { renderTimer = 0; lastRender = performance.now(); renderHome(); }, wait);
}

// The launch mark plays a short 3D build; let it finish (under a second)
// before fading out, without holding the app back any longer than that.
function hideSplash() {
  const s = $('splash');
  if (!s) return;
  const wait = Math.max(0, 900 - performance.now());
  setTimeout(() => { s.classList.add('gone'); setTimeout(() => s.remove(), 500); }, wait);
}

// ============================================================================
// Add
// ============================================================================

function pickRow(a, onPick, { all }) {
  const held = getHolding(a.id);
  const sub = a.kind === 'retire' ? (a.template ? '401(k), IRA, Roth, pensión' : qtyLabel(a)) : a.kind === 'cash' ? 'Efectivo' : all ? `${a.sym} · ${KINDS[a.kind].label}` : a.sym;
  return h('button.pick', { type: 'button', onclick: onPick },
    logo(a),
    h('div.pick-mid', null, h('div.pick-name', { text: a.name }), h('div.pick-sub', { text: sub })),
    h('div.pick-end', null, held && h('span', { text: qtyLabel(held) }), h('span', { html: ICONS.chevron })));
}

function openAdd() {
  let kind = 'all', seq = 0, timer = 0, ctrl = null, sheet = null;
  const input = h('input.search-input', {
    id: 'add-search', type: 'search', placeholder: 'Buscar', autocomplete: 'off', autocorrect: 'off',
    autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Buscar activo',
  });
  const seg = segmented([['all', 'Todo'], ['crypto', 'Crypto'], ['stock', 'Acciones'], ['metal', 'Metales'], ['cash', 'Efectivo'], ['retire', 'Retiro']], kind, k => { kind = k; update(); });
  const list = h('div.pick-list');
  const busy = h('div.searching', { hidden: true }, h('span.spinner.spin'));
  const hint = h('p.hint', { hidden: true }, 'Para buscar cualquier acción o ETF de EE. UU., conecta Finnhub en ',
    h('button', { type: 'button', text: 'Ajustes', onclick: () => openSettings() }), '.');
  const other = h('div.pick-list', null, h('button.pick', { type: 'button', onclick: () => sheet.push(amountView(sheet, newCustomAsset(''))) },
    h('span.logo.pick-plus', { html: ICONS.plus }),
    h('div.pick-mid', null, h('div.pick-name', { text: 'Otro activo' }), h('div.pick-sub', { text: 'Inmueble, fondo, negocio…' })),
    h('div.pick-end', null, h('span', { html: ICONS.chevron }))));

  const paint = items => {
    list.replaceChildren(...items.map(a => pickRow(a, () => {
      const v = amountView(sheet, a.kind === 'retire' && a.template ? newRetireAccount(a) : a);
      sheet.push(v);
      v.focus();
    }, { all: kind === 'all' })));
  };

  function update() {
    const q = input.value;
    const local = searchLocal(q, kind);
    paint(local);
    clearTimeout(timer);
    if (ctrl) ctrl.abort();
    const my = ++seq;
    const remote = q.trim().length >= 2 && (kind === 'all' || kind === 'crypto' || kind === 'stock');
    busy.hidden = !remote;
    hint.hidden = !((kind === 'stock' || (kind === 'all' && q.trim())) && !state.settings.finnhubKey);
    other.hidden = !(kind === 'all');
    if (!remote) return;
    timer = setTimeout(async () => {
      ctrl = new AbortController();
      const found = await searchRemote(q, kind, { finnhubKey: state.settings.finnhubKey, signal: ctrl.signal });
      if (my !== seq) return;
      busy.hidden = true;
      const ids = new Set(local.map(a => a.id));
      paint([...local, ...found.filter(a => !ids.has(a.id) && ids.add(a.id))]);
    }, 320);
  }
  input.addEventListener('input', update);

  const view = makeView({
    title: 'Añadir',
    body: [h('div.search-wrap', null, h('label.search-bar', null, h('span', { html: ICONS.search }), input), seg.el), list, busy, other, hint],
  });
  view.onRemove = () => { clearTimeout(timer); if (ctrl) ctrl.abort(); };
  sheet = openSheet(view);
  update();
}

/** Quantity (and optional average cost) for a new or existing position. */
function amountView(sheet, asset, { edit = false } = {}) {
  if (asset.kind === 'retire') return retireView(sheet, asset, { edit });
  const held = getHolding(asset.id);
  const isMetal = asset.kind === 'metal', isCash = asset.kind === 'cash', isCustom = asset.kind === 'custom';
  let unit = isMetal ? (held && UNITS[held.unit] ? held.unit : 'oz') : null;
  const per = () => (isMetal ? UNITS[unit].perOz : 1);            // display units per stored unit
  const unitLabel = () => (isMetal ? UNITS[unit].label : isCustom ? ccy() : asset.sym);

  const priceEl = h('div.amt-price');
  const valueEl = h('div.amt-value');
  const unitEl = h('span.amt-unit', { text: unitLabel() });
  const qtyInput = h('input.amt-input', { id: 'amt-qty', type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off', 'aria-label': isCustom ? 'Valor' : 'Cantidad' });
  const costInput = h('input.field-input', { id: 'amt-cost', type: 'text', inputmode: 'decimal', placeholder: 'Opcional', autocomplete: 'off' });
  const costSuffix = h('span.field-suffix');
  const nameInput = isCustom && h('input.field-input', { id: 'amt-name', type: 'text', placeholder: 'Departamento, fondo…', autocomplete: 'off', value: asset.name || '' });
  const btn = h('button.btn-primary', { type: 'button', text: edit ? 'Guardar' : 'Añadir', disabled: true });
  const nameEl = h('div.amt-name', { text: isCustom ? (asset.name || 'Otro activo') : asset.name });

  const r = () => P.rate(ccy());
  // The big number is exactly as wide as its text so the unit sits right after it.
  const fit = () => {
    const text = qtyInput.value || '0';
    qtyInput.style.fontSize = text.length > 12 ? '28px' : text.length > 8 ? '38px' : '';
    const cs = getComputedStyle(qtyInput);
    if (!cs.fontSize) { qtyInput.style.width = `${text.length + 0.3}ch`; return; }
    meter.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    qtyInput.style.width = Math.ceil(meter.measureText(text).width + parseFloat(cs.fontSize) * 0.1) + 'px';
  };

  function refresh() {
    const q = P.quoteOf(asset);
    const n = F.parseNumber(qtyInput.value);
    costSuffix.textContent = isCustom ? ccy() : `${ccy()} / ${unitLabel()}`;
    if (isCustom) {
      priceEl.textContent = 'Valor que tú defines';
      valueEl.textContent = '';
    } else if (isCash) {
      priceEl.textContent = asset.sym === ccy() ? '' : q ? `1 ${asset.sym} = ${F.price(q.p * r(), ccy())}` : '';
      valueEl.textContent = asset.sym !== ccy() && q && n > 0 ? '≈ ' + F.money(n * q.p * r(), ccy()) : '';
    } else {
      const unitPrice = q ? (q.p * r()) / per() : null;
      priceEl.textContent = unitPrice != null ? `${F.price(unitPrice, ccy())} / ${unitLabel()}` : asset.kind === 'stock' ? 'Sin precio en vivo' : 'Cargando precio…';
      valueEl.textContent = unitPrice != null && n > 0 ? '≈ ' + F.money(n * unitPrice, ccy()) : '';
    }
    const nameOk = !isCustom || nameInput.value.trim().length > 0;
    const costRaw = costInput.value.trim();
    const costOk = !costRaw || F.parseNumber(costRaw) >= 0;
    btn.disabled = !(n > 0 && nameOk && costOk);
  }

  // Prefill when editing.
  if (edit && held) {
    qtyInput.value = F.editable(isCustom ? held.price * r() : held.qty * per());
    if (held.cost != null) costInput.value = F.editable(isCustom ? held.cost * r() : (held.cost * r()) / per());
  }
  fit();

  const unitSeg = isMetal && segmented(Object.entries(UNITS).map(([k, u]) => [k, u.label]), unit, u => { unit = u; unitEl.textContent = unitLabel(); refresh(); });
  qtyInput.addEventListener('input', () => { fit(); refresh(); });
  costInput.addEventListener('input', refresh);
  if (nameInput) nameInput.addEventListener('input', () => { nameEl.textContent = nameInput.value.trim() || 'Otro activo'; refresh(); });

  function save() {
    const n = F.parseNumber(qtyInput.value);
    if (!(n > 0)) return;
    const c = F.parseNumber(costInput.value);
    const hasCost = costInput.value.trim() !== '' && Number.isFinite(c);
    haptic(10);
    if (isCustom) {
      const patch = { name: nameInput.value.trim(), price: n / r(), cost: hasCost ? c / r() : null };
      if (edit) updateHolding(asset.id, patch);
      else addHolding({ ...asset, ...patch }, 1, patch.cost);
    } else {
      const qty = n / per();
      const cost = hasCost && !isCash ? (c / r()) * per() : null;
      if (edit && held && held.tx && isCash) {
        // Cash with a history: the new balance is recorded as a deposit or withdrawal.
        const diff = qty - held.qty;
        if (Math.abs(diff) > 1e-9) setTrades(asset.id, [...held.tx, { id: newId(), t: Date.now(), side: diff > 0 ? 'buy' : 'sell', qty: Math.abs(diff), price: null }]);
      } else if (edit) updateHolding(asset.id, { qty, cost, ...(isMetal ? { unit } : {}) });
      else addHolding(isMetal ? { ...asset, unit } : asset, qty, cost);
    }
    // Bought something that was only being followed: it now lives in the list.
    if (!edit && isWatched(asset.id)) unwatchAsset(asset.id);
    if (edit && sheet.depth > 1) sheet.pop(); else sheet.close();
  }
  btn.addEventListener('click', save);
  for (const el of [qtyInput, costInput, nameInput]) {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) save(); });
  }

  const fields = [];
  if (nameInput) fields.push(h('label.field', null, h('span.field-label', { text: 'Nombre' }), nameInput));
  if (!isCash) fields.push(h('label.field', null, h('span.field-label', { text: isCustom ? 'Costo' : 'Costo promedio' }), costInput, costSuffix));

  // Not held yet: it can also just be followed, without a quantity.
  const follow = !edit && !held && canWatch(asset) && !isWatched(asset.id) && h('button.btn-text', {
    type: 'button', id: 'amt-watch', text: 'Solo seguir, sin comprar',
    onclick: () => { haptic(8); watchAsset(asset); sheet.close(); toast(`Siguiendo ${asset.name}`); },
  });

  const view = makeView({
    title: edit ? 'Editar' : '',
    body: [
      h('div.amt-top', null, logo(isCustom && !asset.name ? { ...asset, name: '+' } : asset), nameEl, priceEl),
      h('div.amt-entry', null, h('div.amt-line', null, qtyInput, unitEl), valueEl, unitSeg && unitSeg.el),
      fields.length ? h('div.group', null, fields) : null,
      held && !edit && !isCustom ? h('p.hint', { text: `Se suma a tu posición actual (${qtyLabel(held)}).`, style: { textAlign: 'center' } }) : null,
    ],
    foot: follow ? h('div.foot-stack', null, btn, follow) : btn,
  });

  P.watch(isCustom ? null : asset);
  const off = P.onPrices(refresh);
  view.onRemove = () => { off(); P.watch(null); };
  view.onShow = fit;
  view.focus = () => { fit(); try { (nameInput && !edit ? nameInput : qtyInput).focus({ preventScroll: true }); } catch { /* not focusable yet */ } };
  refresh();
  return view;
}

// ---- one buy, sell or income entry --------------------------------------------

const dayInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// A date picked without a time is kept at noon, so no time zone moves it a day.
const fromDayInput = (v, fallback) => { const t = Date.parse(v + 'T12:00:00'); return Number.isFinite(t) ? Math.min(t, Date.now()) : fallback; };

/** What an entry is called in the list and on its screen. */
function tradeLabel(a, tr) {
  if (tr.opening) return a.kind === 'cash' ? 'Saldo inicial' : 'Posición inicial';
  if (tr.side === 'income') return INCOME[a.kind] || 'Ingreso';
  if (a.kind === 'cash') return tr.side === 'sell' ? 'Retiro' : 'Depósito';
  return tr.side === 'sell' ? 'Venta' : 'Compra';
}

/**
 * Record or change an entry. `trade` is null for a new one. Quantity and price
 * are entered in the unit the position is shown in (grams, for gold in grams)
 * and the display currency; they are stored per stored unit, in USD.
 * A dividend is entered as an amount; cash entries have no price.
 */
function tradeView(sheet, id, trade, { side: side0 = 'buy' } = {}) {
  const a = getHolding(id);
  const isMetal = a.kind === 'metal', isCash = a.kind === 'cash';
  const unit = isMetal && UNITS[a.unit] ? a.unit : 'oz';
  const per = isMetal ? UNITS[unit].perOz : 1;
  const r = () => P.rate(ccy());
  const opening = !!(trade && trade.opening);
  let side = trade ? trade.side : side0;
  const dividend = () => side === 'income' && a.kind === 'stock';
  const unitLabel = () => (dividend() ? ccy() : isMetal ? UNITS[unit].label : a.sym);
  const showPrice = () => !isCash && !dividend();

  const qtyInput = h('input.amt-input', { id: 'tr-qty', type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off', 'aria-label': 'Cantidad' });
  const priceInput = h('input.field-input', { id: 'tr-price', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: opening ? 'Opcional' : '0' });
  const dateInput = h('input.field-input', { id: 'tr-date', type: 'date', max: dayInput(Date.now()), value: dayInput(trade && trade.t ? trade.t : Date.now()) });
  // The picker is the system one; what shows is always MM/DD/YYYY.
  const dateShown = h('span.field-value.date-shown');
  const paintDate = () => { const t = fromDayInput(dateInput.value, null); dateShown.textContent = t ? F.date(t) : ''; };
  dateInput.addEventListener('change', paintDate);
  dateInput.addEventListener('input', paintDate);
  paintDate();
  const unitEl = h('span.amt-unit');
  const valueEl = h('div.amt-value');
  const hint = h('p.hint', { style: { textAlign: 'center' } });
  const btn = h('button.btn-primary', { type: 'button', text: trade ? 'Guardar' : 'Registrar', disabled: true });
  const priceEl = h('div.amt-price');
  const priceSuffix = h('span.field-suffix');
  const priceRow = h('label.field', null, h('span.field-label', { text: 'Precio' }), priceInput, priceSuffix);
  const titleFor = () => (trade ? (opening ? tradeLabel(a, trade) : 'Operación') : side === 'income' ? INCOME[a.kind] : 'Nueva operación');

  const livePrice = () => { const q = P.quoteOf(a); return q ? q.p : null; };
  if (trade) {
    qtyInput.value = F.editable(trade.side === 'income' && !(trade.qty > 0) ? trade.amount * r() : trade.qty * per);
    if (trade.price != null) priceInput.value = F.editable((trade.price * r()) / per);
  } else if (livePrice() != null) {
    priceInput.value = F.editable(Number(((livePrice() * r()) / per).toPrecision(8)));
  }

  const fit = () => {
    const text = qtyInput.value || '0';
    qtyInput.style.fontSize = text.length > 12 ? '28px' : text.length > 8 ? '38px' : '';
    const cs = getComputedStyle(qtyInput);
    if (!cs.fontSize) { qtyInput.style.width = `${text.length + 0.3}ch`; return; }
    meter.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    qtyInput.style.width = Math.ceil(meter.measureText(text).width + parseFloat(cs.fontSize) * 0.1) + 'px';
  };

  // The entries as they would be after saving.
  function draft() {
    const n = F.parseNumber(qtyInput.value), pv = F.parseNumber(priceInput.value);
    if (!(n > 0)) return null;
    const t = opening ? (trade.t || null) : fromDayInput(dateInput.value, trade ? trade.t : Date.now());
    const base = { id: trade ? trade.id : newId(), t, side: opening ? 'buy' : side, ...(opening ? { opening: true } : {}) };
    let next;
    if (dividend()) next = { ...base, qty: 0, amount: n / r() };
    else if (isCash) {
      // Cash is worth its exchange rate; interest is valued at today's.
      const p = side === 'income' ? (trade && trade.price) || livePrice() || 1 : null;
      next = { ...base, qty: n, price: p };
    } else {
      const hasPrice = priceInput.value.trim() !== '' && pv >= 0;
      if (!hasPrice && !opening) return null;
      next = { ...base, qty: n / per, price: hasPrice ? (pv / r()) * per : null };
    }
    const list = openingOf(getHolding(id)).filter(x => x.id !== next.id);
    return { next, list: [...list, next] };
  }

  function refresh() {
    const p = livePrice();
    unitEl.textContent = unitLabel();
    priceSuffix.textContent = `${ccy()} / ${unitLabel()}`;
    priceRow.hidden = !showPrice();
    priceEl.textContent = p && !dividend() && !(isCash && a.sym === ccy()) ? `Hoy ${F.price((p * r()) / per, ccy())} / ${unitLabel()}` : '';
    view.titleEl.textContent = titleFor();
    const n = F.parseNumber(qtyInput.value), pv = F.parseNumber(priceInput.value);
    valueEl.textContent = !(n > 0) ? ''
      : side === 'income' ? (dividend() ? '' : p || pv ? 'Vale ' + F.money(isCash ? n * p * r() : n * pv, ccy()) : '')
      : !showPrice() ? '' : pv > 0 ? (side === 'sell' ? 'Recibes ' : 'Pagas ') + F.money(n * pv, ccy()) : '';
    const d = draft();
    let ok = !!d, msg = '';
    if (d && !consistent(d.list)) {
      ok = false;
      const can = heldAt(openingOf(getHolding(id)), d.next.t, d.next.id) * per;
      msg = side === 'sell' ? `En esa fecha tenías ${F.qty(can)} ${unitLabel()}.` : 'Con este cambio una venta quedaría sin unidades.';
    } else if (d && side === 'sell' && !opening && !isCash) {
      const before = replay(openingOf(getHolding(id)).filter(x => x.id !== d.next.id && (x.opening || (x.t || 0) <= d.next.t)));
      if (before.cost != null && d.next.price != null) {
        const g = (d.next.price - before.cost) * d.next.qty * r();
        msg = `Ganancia de esta venta: ${F.signedMoney(g, ccy())}`;
      }
    } else if (d && side === 'income') {
      msg = a.kind === 'crypto' ? 'Las unidades se suman a tu posición con su valor de ese día.'
        : isCash ? 'Se suma a tu saldo.' : 'No cambia tu cantidad de acciones.';
    }
    hint.textContent = msg;
    hint.hidden = !msg;
    btn.disabled = !ok;
  }

  function save() {
    const d = draft();
    if (!d || !consistent(d.list)) return;
    haptic(10);
    setTrades(id, d.list);
    sheet.pop();
  }

  const sides = isCash || opening || (trade && trade.side === 'income') ? null
    : [['buy', 'Compra'], ['sell', 'Venta'], ...(canIncome(a) ? [['income', INCOME[a.kind]]] : [])];
  const sideSeg = sides && segmented(sides, side, v => { side = v; refresh(); fit(); });
  qtyInput.addEventListener('input', () => { fit(); refresh(); });
  priceInput.addEventListener('input', refresh);
  dateInput.addEventListener('change', refresh);
  btn.addEventListener('click', save);
  for (const el of [qtyInput, priceInput]) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) save(); });

  const remove = trade && h('button.btn-text.danger', {
    type: 'button', text: 'Eliminar',
    onclick: () => {
      const list = openingOf(getHolding(id)).filter(x => x.id !== trade.id);
      if (!consistent(list)) { toast(isCash ? 'Antes borra el retiro que depende de esto' : 'Antes borra la venta que depende de esta compra'); return; }
      haptic(10);
      setTrades(id, list);
      sheet.pop();
      toast(`${tradeLabel(a, trade)} eliminado`, { action: { label: 'Deshacer', run: () => setTrades(id, [...list, trade]) } });
    },
  });

  const view = makeView({
    title: titleFor(),
    body: [
      sideSeg && sideSeg.el,
      h('div.amt-top', null, logo(a), h('div.amt-name', { text: a.name }), priceEl),
      h('div.amt-entry', null, h('div.amt-line', null, qtyInput, unitEl), valueEl),
      h('div.group', null, priceRow,
        opening ? null : h('label.field.date-field', null, h('span.field-label', { text: 'Fecha' }), dateShown, dateInput)),
      hint,
      opening ? h('p.hint', { text: 'Lo que ya tenías antes de registrar movimientos.', style: { textAlign: 'center' } }) : null,
      remove ? h('div.detail-actions', null, remove) : null,
    ],
    foot: btn,
  });
  const off = P.onPrices(refresh);
  view.onRemove = off;
  view.onShow = fit;
  view.focus = () => { fit(); try { qtyInput.focus({ preventScroll: true }); } catch { /* not focusable yet */ } };
  refresh();
  fit();
  return view;
}

/** The annual yield a cash balance earns (a savings account). */
function apyView(sheet, id) {
  const a = getHolding(id);
  const r = () => P.rate(ccy());
  const input = h('input.amt-input', { id: 'apy-input', type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off', 'aria-label': 'Interés anual' });
  if (a.apy > 0) input.value = F.editable(a.apy);
  const est = h('div.amt-value');
  const btn = h('button.btn-primary', { type: 'button', text: 'Guardar', disabled: true });
  const priceOf = x => { const q = P.quoteOf(x); return q ? q.p : null; };
  const refresh = () => {
    fitInput(input);
    const n = F.parseNumber(input.value), q = P.quoteOf(a);
    btn.disabled = !(n >= 0 && n < 100);
    est.textContent = n > 0 && q ? `≈ ${F.money(a.qty * monthlyRate(n) * q.p * r(), ccy())} al mes · ${F.money(a.qty * (n / 100) * q.p * r(), ccy())} al año` : '';
  };
  const save = () => {
    const n = F.parseNumber(input.value);
    if (!(n >= 0 && n < 100)) return;
    haptic(10);
    setApy(id, n, priceOf);
    sheet.pop();
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) save(); });
  btn.addEventListener('click', save);
  const view = makeView({
    title: 'Interés anual',
    body: [
      h('div.amt-top', null, logo(a), h('div.amt-name', { text: a.name })),
      h('div.amt-entry', null, h('div.amt-line', null, input, h('span.amt-unit', { text: '%' })), est),
      h('p.hint', { style: { textAlign: 'center' }, text: 'La tasa anual (APY) de tu cuenta de ahorro. Cada mes, en la fecha de hoy, la app suma al saldo el interés de ese mes. Si el banco cambia la tasa, cámbiala aquí.' }),
      a.apy > 0 ? h('div.detail-actions', null, h('button.btn-text.danger', { type: 'button', text: 'Quitar interés', onclick: () => { haptic(10); setApy(id, 0, priceOf); sheet.pop(); } })) : null,
    ],
    foot: btn,
  });
  view.onShow = () => fitInput(input);
  view.focus = () => { fitInput(input); try { input.focus({ preventScroll: true }); } catch { /* not focusable yet */ } };
  refresh();
  return view;
}

/**
 * A retirement plan: the balance as of today, the kind of account and, if
 * chosen, an index the balance follows until the next update.
 */
function retireView(sheet, asset, { edit = false } = {}) {
  const held = edit ? getHolding(asset.id) : null;
  const base = held || asset;
  const r = () => P.rate(ccy());
  let accType = base.accType || '401(k)', track = base.track === undefined ? 'VOO' : base.track;

  const nameEl = h('div.amt-name', { text: base.name || 'Plan de retiro' });
  const qtyInput = h('input.amt-input', { id: 'amt-qty', type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off', 'aria-label': 'Saldo actual' });
  const unitEl = h('span.amt-unit', { text: ccy() });
  const nameInput = h('input.field-input', { id: 'amt-name', type: 'text', placeholder: 'Fidelity 401(k)…', autocomplete: 'off', value: base.name || '' });
  const costInput = h('input.field-input', { id: 'amt-cost', type: 'text', inputmode: 'decimal', placeholder: 'Opcional', autocomplete: 'off' });
  const note = h('p.hint', { style: { textAlign: 'center' } });
  const btn = h('button.btn-primary', { type: 'button', text: edit ? 'Guardar' : 'Añadir', disabled: true });

  if (held) {
    const q = P.quoteOf(held);
    qtyInput.value = F.editable((q ? q.p : held.balance) * r());
    if (held.cost != null) costInput.value = F.editable(held.cost * r());
  }

  const typeSeg = segmented(ACCOUNT_TYPES.map(t => [t, t]), accType, t => {
    const auto = !nameInput.value.trim() || nameInput.value.trim() === `${base.provider} ${accType}`;
    accType = t;
    if (auto && base.provider) { nameInput.value = `${base.provider} ${t}`; nameEl.textContent = nameInput.value; }
    refresh();
  });
  const trackSeg = segmented(TRACKS.map(([k, label]) => [k, label]), track, t => { track = t; refresh(); });

  function refresh() {
    const n = F.parseNumber(qtyInput.value);
    const raw = costInput.value.trim();
    btn.disabled = !(n > 0 && nameInput.value.trim() && (!raw || F.parseNumber(raw) >= 0));
    if (!track) note.textContent = 'El saldo queda fijo hasta que lo actualices.';
    else if (!state.settings.finnhubKey) note.textContent = `Para que se mueva con el ${trackName(track)} necesitas la llave de Finnhub (Ajustes). Mientras tanto queda fijo.`;
    else note.textContent = `Entre actualizaciones, el saldo se moverá como el ${trackName(track)} (${track}). Actualízalo de vez en cuando con el de tu estado de cuenta.`;
  }

  function save() {
    const n = F.parseNumber(qtyInput.value);
    if (!(n > 0)) return;
    const c = F.parseNumber(costInput.value);
    const hasCost = costInput.value.trim() !== '' && Number.isFinite(c);
    const ref = track ? P.livePrice({ id: 'stock:' + track }) : null;
    const patch = { name: nameInput.value.trim(), accType, track, balance: n / r(), ref, at: Date.now(), cost: hasCost ? c / r() : null };
    haptic(10);
    if (edit) updateHolding(asset.id, patch);
    else addHolding({ ...asset, ...patch, template: undefined }, 1, patch.cost);
    if (edit && sheet.depth > 1) sheet.pop(); else sheet.close();
  }

  const fit = () => {
    const text = qtyInput.value || '0';
    qtyInput.style.fontSize = text.length > 12 ? '28px' : text.length > 8 ? '38px' : '';
    const cs = getComputedStyle(qtyInput);
    meter.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    qtyInput.style.width = Math.ceil(meter.measureText(text).width + parseFloat(cs.fontSize) * 0.1) + 'px';
  };
  qtyInput.addEventListener('input', () => { fit(); refresh(); });
  costInput.addEventListener('input', refresh);
  nameInput.addEventListener('input', () => { nameEl.textContent = nameInput.value.trim() || 'Plan de retiro'; refresh(); });
  btn.addEventListener('click', save);
  for (const el of [qtyInput, costInput, nameInput]) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) save(); });

  const field = (label, input, suffix) => h('label.field', null, h('span.field-label', { text: label }), input, suffix && h('span.field-suffix', { text: suffix }));
  const view = makeView({
    title: edit ? 'Editar' : '',
    body: [
      h('div.amt-top', null, logo(base), nameEl, h('div.amt-price', { text: 'Saldo actual de tu estado de cuenta' })),
      h('div.amt-entry', null, h('div.amt-line', null, qtyInput, unitEl)),
      h('div.group-title', { text: 'Tipo de cuenta' }), typeSeg.el,
      h('div.group-title', { text: 'Se mueve con' }), trackSeg.el, note,
      h('div.group', null, field('Nombre', nameInput), field('Total aportado', costInput, ccy())),
    ],
    foot: btn,
  });
  view.onShow = fit;
  view.focus = () => { fit(); try { qtyInput.focus({ preventScroll: true }); } catch { /* not focusable yet */ } };
  refresh();
  return view;
}

// ============================================================================
// Detail
// ============================================================================

function openDetail(id, { edit = false } = {}) {
  const a0 = getHolding(id);
  if (!a0) return;
  let range = '1D', chart = null, scrub = null, loadSeq = 0, sheet = null;
  const avail = H.availability(a0);

  const big = h('div.big');
  const pill = h('span.pill');
  const meta = h('span');
  const fv = () => h('span.field-value');
  const vQty = fv(), vVal = fv(), vCost = fv(), vGain = fv();
  vVal.classList.add('strong');
  const nameEl = h('div.detail-name'), symEl = h('div.detail-sym');
  const chartHost = avail === 'yes' ? h('div', { 'data-nodrag': '' }) : null;
  const seg = segmented(Object.keys(H.RANGES).map(k => [k, k]), range, k => { range = k; load(); });
  const approx = h('p.hint', { hidden: true });
  const needKey = avail === 'needs-key' && h('div.notice', null,
    h('span', { text: 'El gráfico necesita tu llave de Twelve Data' }),
    h('button', { type: 'button', text: 'Añadir', onclick: () => openSettings() }));
  const statsGroup = h('div.group', { hidden: true });
  const planNote = h('p.hint');
  const trades = hasHistory(a0);
  const vReal = fv(), vIncome = fv();
  vIncome.classList.add('up');
  const realRow = h('div.field', { hidden: true }, h('span.field-label', { text: 'Ganancia realizada' }), vReal);
  const incomeRow = h('div.field', { hidden: true }, h('span.field-label', { text: a0.kind === 'cash' ? 'Intereses' : a0.kind === 'crypto' ? 'Recompensas' : 'Dividendos' }), vIncome);
  const opsGroup = trades && h('div.group.ops');
  const opsTitle = trades && h('div.group-title', { text: a0.kind === 'cash' ? 'Movimientos' : 'Operaciones' });
  let opsSig = '';
  const vApy = fv(), apyNote = h('p.hint');
  const apyGroup = a0.kind === 'cash' && h('div.group', null,
    h('button.field', { type: 'button', id: 'apy-field', onclick: () => { const v = apyView(sheet, id); sheet.push(v); v.focus(); } },
      h('span.field-label', { text: 'Interés anual' }), vApy, h('span.chev', { html: ICONS.chevron })));
  const editBtn = h('button.btn-secondary', { type: 'button', text: 'Editar', onclick: () => pushEdit() });
  const fieldRow = (label, value) => h('div.field', null, h('span.field-label', { text: label }), value);

  function paint() {
    const a = getHolding(id);
    if (!a) return;
    const q = P.quoteOf(a), r = P.rate(ccy());
    const v = valuation();
    const row = v.rows.find(x => x.a.id === id);
    nameEl.textContent = a.name;
    symEl.textContent = a.kind === 'metal' ? `${a.sym} · por oz troy` : a.kind === 'custom' ? 'Valor manual' : a.kind === 'cash' ? a.sym
      : a.kind === 'retire' ? qtyLabel(a) : `${a.sym} · ${KINDS[a.kind].label}`;
    if (a.kind === 'retire') {
      const since = a.at ? F.dateLabel(a.at) : null;
      const q = P.quoteOf(a);
      const moved = q && a.balance ? q.p / a.balance - 1 : 0;
      planNote.textContent = !since ? '' : a.track && a.ref
        ? `Saldo actualizado el ${since}. Desde entonces el ${trackName(a.track)} ${moved >= 0 ? 'subió' : 'bajó'} ${F.pct(Math.abs(moved), { sign: false })}.`
        : `Saldo actualizado el ${since}.`;
    }

    if (scrub) {
      big.textContent = F.price(scrub.v * r, ccy());
      setPill(pill, scrub.v / scrub.first - 1, null, null);
      pill.hidden = false;
      meta.textContent = F.timeLabel(scrub.t, range);
    } else {
      // Cash has no price worth showing: its balance is the number.
      big.textContent = !q ? '—' : a.kind === 'cash' ? F.money(q.p * a.qty * r, ccy()) : F.price(q.p * r, ccy());
      const first = chart && chart.first;
      const ratio = q && first ? q.p / first - 1 : row && row.dayPct;
      pill.hidden = ratio == null;
      if (ratio != null) setPill(pill, ratio, null, null);
      meta.textContent = ratio == null ? (q ? '' : 'Sin precio en vivo') : first ? RANGE_LABEL[range] : 'hoy';
    }

    vQty.textContent = a.kind === 'custom' ? '—' : qtyLabel(a);
    vVal.textContent = row && row.value != null ? F.money(row.value, ccy()) : '—';
    const perUnit = a.kind === 'metal' && UNITS[a.unit] ? UNITS[a.unit].perOz : 1;
    vCost.textContent = a.cost != null ? F.price((a.cost * r) / (a.kind === 'custom' ? 1 : perUnit), ccy()) : '—';
    if (row && row.gainAbs != null) {
      vGain.textContent = `${F.signedMoney(row.gainAbs, ccy())}  ${F.pct(row.gainPct)}`;
      vGain.className = 'field-value ' + (row.gainAbs > 0 ? 'up' : row.gainAbs < 0 ? 'down' : '');
    } else { vGain.textContent = '—'; vGain.className = 'field-value'; }
    if (trades) paintOps(a, r);
    if (apyGroup) {
      vApy.textContent = a.apy > 0 ? F.num(a.apy, 2) + ' %' : 'Añadir';
      const q = P.quoteOf(a);
      apyNote.hidden = !(a.apy > 0 && q);
      if (!apyNote.hidden) {
        const next = addMonth(a.apyFrom), est = a.qty * monthlyRate(a.apy) * q.p * r;
        apyNote.textContent = `Próximo abono el ${F.dateLabel(next)}: unos ${F.money(est, ccy())}. Se suma solo al saldo cada mes.`;
      }
    }
    editBtn.hidden = !!a.tx && a.kind !== 'cash'; // cash keeps "Editar" for its balance
    if (chart && range === '1D' && q && !scrub) chart.tick(q.p);
  }

  // Buys and sells, newest first. Rebuilt only when they or the currency change.
  function paintOps(a, r) {
    const res = replay(a.tx || []);
    realRow.hidden = !res.realizedKnown;
    if (res.realizedKnown) {
      vReal.textContent = F.signedMoney(res.realized * r, ccy());
      vReal.className = 'field-value ' + (res.realized > 0 ? 'up' : res.realized < 0 ? 'down' : '');
    }
    incomeRow.hidden = !(res.income > 0);
    if (res.income > 0) vIncome.textContent = '+' + F.money(res.income * r, ccy());
    const sig = JSON.stringify([a.tx || null, a.unit, ccy(), r, state.settings.numbers]);
    if (sig === opsSig) return;
    opsSig = sig;
    const isCash = a.kind === 'cash';
    const per = a.kind === 'metal' && UNITS[a.unit] ? UNITS[a.unit].perOz : 1;
    const unitLabel = a.kind === 'metal' ? (UNITS[a.unit] || UNITS.oz).label : a.sym;
    const list = sorted(a.tx || []).reverse();
    const rows = list.map(tr => {
      const income = tr.side === 'income';
      const when = tr.t ? F.dateLabel(tr.t) : '';
      const amount = income && !(tr.qty > 0) ? '+' + F.money(tr.amount * r, ccy())
        : `${tr.side === 'sell' ? '−' : '+'}${F.qty(tr.qty * per)} ${unitLabel}`;
      const at = income ? (tr.qty > 0 && !isCash ? F.price((tr.price * r) / per, ccy()) : '')
        : isCash ? '' : tr.price != null ? F.price((tr.price * r) / per, ccy()) : 'sin costo';
      return h('button.field.op', { type: 'button', onclick: () => pushTrade(tr) },
        h('span.op-main', null, h('span.op-kind' + (tr.side === 'sell' ? '.sell' : income ? '.income' : ''), { text: tradeLabel(a, tr) }), h('span.op-when', { text: when })),
        h('span.op-side', null, h('span.op-qty', { text: amount }), at ? h('span.op-at', { text: at }) : null),
        h('span.chev', { html: ICONS.chevron }));
    });
    const add = (label, side) => h('button.field.op-add', { type: 'button', onclick: () => pushTrade(null, side) }, h('span.field-label', { text: label }));
    // Cash earns through its annual rate (see apyView), not entry by entry.
    opsGroup.replaceChildren(...[...rows,
      canTrade(a) ? add('Registrar compra', 'buy') : null,
      canTrade(a) && a.qty > 0 ? add('Registrar venta', 'sell') : null,
      canIncome(a) && !isCash ? add(`Registrar ${INCOME[a.kind].toLowerCase()}`, 'income') : null].filter(Boolean));
    opsGroup.hidden = !opsGroup.children.length;
    opsTitle.hidden = opsGroup.hidden;
  }

  function pushTrade(tr, side) {
    const v = tradeView(sheet, id, tr, { side });
    sheet.push(v);
    if (!tr) v.focus();
  }

  async function load() {
    if (!chart) return;
    const my = ++loadSeq;
    const a = getHolding(id) || a0;
    chart.setData(null);
    const got = await H.load(a, range);
    if (my !== loadSeq || !chart) return;
    if (!got) {
      // No history for this asset after all: drop the chart rather than show an empty box.
      if (range === '1D') { chart.destroy(); chart = null; chartHost.hidden = true; seg.el.hidden = true; }
      paint();
      return;
    }
    chart.setData(H.windowed(a, got.pts, range));
    approx.hidden = !got.approx;
    if (got.approx) approx.textContent = `Histórico aproximado a partir ${H.proxyOf(a)}.`;
    paint();
  }

  async function stats() {
    const a = getHolding(id) || a0;
    if (a.kind === 'cash' || a.kind === 'custom' || a.kind === 'retire') return;
    const q = P.quoteOf(a);
    const rows = await loadStats(a, { price: q && q.p, rate: P.rate(ccy()), ccy: ccy(), finnhubKey: state.settings.finnhubKey, historyKey: state.settings.historyKey });
    if (!rows.length) return;
    statsGroup.replaceChildren(...rows.map(x => fieldRow(x.label, h('span.field-value', { text: x.value }))));
    statsGroup.hidden = false;
  }

  const view = makeView({
    body: [
      h('div.detail-top', null, logo(a0), h('div', null, nameEl, symEl)),
      h('div.detail-price', null, big, h('div.detail-meta', null, pill, meta)),
      chartHost, chartHost && seg.el, approx, needKey,
      h('div.group', null,
        a0.kind !== 'custom' && a0.kind !== 'retire' && fieldRow('Cantidad', vQty), fieldRow('Valor', vVal),
        a0.kind !== 'cash' && fieldRow(a0.kind === 'custom' ? 'Costo' : a0.kind === 'retire' ? 'Total aportado' : 'Costo promedio', vCost),
        a0.kind !== 'cash' && fieldRow('Ganancia', vGain), trades && realRow, trades && incomeRow),
      apyGroup, apyGroup && apyNote,
      opsTitle, opsGroup,
      statsGroup,
      a0.kind === 'retire' && planNote,
      h('div.detail-actions', null,
        editBtn,
        h('button.btn-text.danger', { type: 'button', text: 'Eliminar', onclick: () => { sheet.close(); setTimeout(() => deleteHolding(id), 280); } })),
    ],
  });

  function pushEdit() {
    const a = getHolding(id);
    if (!a) return;
    if (a.tx && a.kind !== 'cash') return; // quantity comes from the trades, edited one by one below
    const v = amountView(sheet, a, { edit: true });
    sheet.push(v);
    v.focus();
  }

  if (chartHost) chart = createChart(chartHost, { onScrub: s => { scrub = s; paint(); } });
  const offP = P.onPrices(paint), offS = subscribe(paint);
  view.onRemove = () => { offP(); offS(); if (chart) { chart.destroy(); chart = null; } };
  view.onShow = paint;
  sheet = openSheet(view);
  paint();
  load();
  stats();
  if (edit) pushEdit();
}

// ============================================================================
// Settings
// ============================================================================

function fieldButton(label, { value, onclick, danger, chevron } = {}) {
  return h('button.field' + (danger ? '.danger' : ''), { type: 'button', onclick },
    h('span.field-label', { text: label }),
    h('span.field-value', null, value || ''),
    chevron && h('span.chev', { html: ICONS.chevron }));
}

/** A text field for an API key that is checked before it is saved. */
function keyField({ id, placeholder, value, initial, test, save }) {
  let timer = 0, seq = 0;
  const input = h('input.field-input.left', { id, type: 'text', placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value, 'aria-label': placeholder });
  const mark = h('span.field-suffix');
  const show = s => {
    mark.className = s === 'ok' ? 'check' : 'field-suffix';
    mark.innerHTML = s === 'ok' ? ICONS.check : s === 'busy' ? '<span class="spinner spin" style="display:block;width:18px;height:18px"></span>' : '';
    if (s === 'invalid') mark.textContent = 'No válida';
    if (s === 'network') mark.textContent = 'Sin conexión';
    mark.style.color = s === 'invalid' ? 'var(--down)' : '';
  };
  if (value) show(initial || 'ok');
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const key = input.value.trim();
    const my = ++seq;
    if (!key) { show(''); save(''); return; }
    show('busy');
    timer = setTimeout(async () => {
      const res = await test(key);
      if (my !== seq) return;
      show(res);
      if (res === 'ok') { haptic(10); save(key); }
    }, 600);
  });
  return h('label.field', null, input, mark);
}

function currencyView(sheet) {
  const items = CASH.map(c => h('button.field', {
    type: 'button',
    onclick: () => { haptic(6); setSetting('ccy', c.sym); sheet.pop(); },
  }, logo(c), h('span.field-label', { text: c.name }), h('span.field-value', { text: c.sym }),
  c.sym === ccy() && h('span.check', { html: ICONS.check })));
  return makeView({ title: 'Moneda', body: [h('div.group', null, items)] });
}

/** The data as saved right now (with keys), for the copy inside the browser. */
function vaultDoc() {
  let store = null;
  try { store = JSON.parse(localStorage.getItem('portfolio.v1')); } catch { /* none */ }
  return { store, snaps: snapshots() };
}

function mirrorNow() {
  if (!isDemo()) V.mirror(vaultDoc());
}

// What a copy protects: positions, trades and plans; not prices or the date.
function copySig() {
  const { holdings, settings } = exportObject();
  return V.signature(JSON.stringify([holdings, settings]));
}

async function saveCopy() {
  const ok = await V.saveFile(exportData({ snapshots: snapshots() }), copySig());
  if (ok) { haptic(10); toast('Copia guardada'); scheduleRender(true); }
}

function versionsView(sheet) {
  const group = h('div.group');
  const note = h('p.hint', { text: 'Una versión por día (como empezó ese día) y una antes de cada borrado, importación o restauración. Se guardan las 20 más recientes en este iPhone.' });
  const view = makeView({ title: 'Versiones guardadas', body: [group, note] });
  V.versions().then(list => {
    if (!list.length) { group.replaceWith(h('p.hint', { text: 'Todavía no hay versiones. Se crea una cada día que abres la app.' })); return; }
    group.replaceChildren(...list.map(ver => {
      const value = h('span', { text: `${ver.count} ${ver.count === 1 ? 'activo' : 'activos'}` });
      const when = F.dateTime(ver.t);
      let armed = 0;
      return h('button.field', {
        type: 'button',
        onclick: async () => {
          if (Date.now() - armed > 3500) {
            armed = Date.now();
            const old = value.textContent;
            value.textContent = 'Toca otra vez para restaurar';
            setTimeout(() => { if (Date.now() - armed >= 3400) value.textContent = old; }, 3500);
            return;
          }
          await V.checkpoint(vaultDoc(), 'Antes de restaurar');
          replaceAll(ver.store);
          replaceSnapshots(ver.snaps || []);
          haptic(10);
          sheet.close();
          toast('Versión restaurada');
        },
      }, h('span.field-label', { text: ver.label ? `${when} · ${ver.label}` : when }), h('span.field-value', null, value));
    }));
  });
  return view;
}

async function applyCopy(data) {
  await V.checkpoint(vaultDoc(), 'Antes de importar');
  replaceAll(data);
  replaceSnapshots(data.snapshots || []);
}

function openSettings() {
  let sheet = null, wipeArmed = 0;
  const ccyValue = h('span', { text: ccy() });
  const hide = toggle(state.settings.hidden, on => setSetting('hidden', on), 'Ocultar importes');
  const byValue = toggle(!state.settings.order, on => { if (on) setSetting('order', null); else byValue.set(true); }, 'Ordenar activos por valor');
  const numbers = segmented([['dot', '1.234,50'], ['comma', '1,234.50']], state.settings.numbers || 'dot', s => setSetting('numbers', s));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'set-import' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.holdings)) throw new Error('shape');
      await applyCopy(data);
      sheet.close();
      toast('Portfolio importado');
    } catch { toast('Ese archivo no es una copia de Portfolio'); }
    fileInput.value = '';
  });

  const lastValue = h('span');
  const paintLast = () => { const t = V.lastExport(); lastValue.textContent = t ? F.ago(t) : 'Nunca'; };
  paintLast();

  const wipe = h('button.field.danger', { type: 'button' }, h('span.field-label', { text: 'Borrar todo' }));
  wipe.addEventListener('click', () => {
    if (Date.now() - wipeArmed < 3500) {
      V.checkpoint(vaultDoc(), 'Antes de borrar').then(() => {
        replaceAll({ holdings: [], watch: [] }); replaceSnapshots([]); sheet.close();
        toast('Portfolio borrado', { action: { label: 'Ver versiones', run: () => { const s = openSheet(versionsView({ close: () => s.close() })); } } });
      });
      return;
    }
    wipeArmed = Date.now();
    wipe.firstChild.textContent = 'Toca otra vez para borrar';
    setTimeout(() => { wipe.firstChild.textContent = 'Borrar todo'; }, 3500);
  });

  const view = makeView({
    title: 'Ajustes',
    body: [
      h('div.group', null,
        fieldButton('Moneda', { value: ccyValue, chevron: true, onclick: () => sheet.push(currencyView(sheet)) }),
        h('div.field', null, h('span.field-label', { text: 'Ocultar importes' }), h('span.field-value'), hide.el),
        h('div.field', null, h('span.field-label', { text: 'Ordenar por valor' }), h('span.field-value'), byValue.el),
        h('div.field.numbers', null, h('span.field-label', { text: 'Números' }), h('span.field-value'), numbers.el)),
      h('p.hint', { text: 'Para mover un activo, mantenlo pulsado y arrástralo. Al hacerlo, el orden por valor se desactiva.' }),
      h('div.group-title', { text: 'Acciones en vivo' }),
      h('div.group', null, keyField({
        id: 'set-key', placeholder: 'Llave de Finnhub', value: state.settings.finnhubKey,
        initial: P.stockState() === 'invalid' ? 'invalid' : 'ok',
        test: P.testFinnhubKey, save: key => setSetting('finnhubKey', key),
      })),
      h('p.hint', { html: 'Llave gratuita en <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io</a>. Da precio en tiempo real de acciones y ETFs de EE. UU.' }),
      h('div.group-title', { text: 'Gráficos de acciones' }),
      h('div.group', null, keyField({
        id: 'set-history-key', placeholder: 'Llave de Twelve Data', value: state.settings.historyKey,
        test: H.testHistoryKey, save: key => setSetting('historyKey', key),
      })),
      h('p.hint', { html: 'Llave gratuita en <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener">twelvedata.com</a>. Da el histórico de acciones y ETFs, y el aproximado de plata, platino y paladio. Crypto y oro no la necesitan.' }),
      h('div.group-title', { text: 'Datos' }),
      h('div.group', null,
        fieldButton('Guardar en Archivos', { onclick: async () => { await saveCopy(); paintLast(); } }),
        h('div.field', null, h('span.field-label', { text: 'Última copia fuera' }), h('span.field-value', null, lastValue)),
        fieldButton('Versiones guardadas', { chevron: true, onclick: () => sheet.push(versionsView(sheet)) }),
        fieldButton('Importar copia', { onclick: () => fileInput.click() }),
        wipe),
      fileInput,
      h('p.hint', { text: 'Todo se guarda solo y al instante en este iPhone, con una segunda copia interna y versiones diarias. Si borras la app de la pantalla de inicio se pierde todo: guarda una copia en Archivos (iCloud Drive). Si hay cambios sin copiar, la app te lo recuerda cada semana.' }),
      h('p.hint', { text: 'Precios de Coinbase, CoinGecko, gold-api.com, Finnhub, Twelve Data y open.er-api.com.' }),
      h('p.hint.version', null, `Versión ${APP_VERSION} · `,
        h('button', { type: 'button', id: 'set-whatsnew', text: 'Novedades', onclick: () => showLatest() })),
    ],
  });
  view.onShow = () => { ccyValue.textContent = ccy(); hide.set(state.settings.hidden); byValue.set(!state.settings.order); };
  sheet = openSheet(view);
}

// ============================================================================
// Example data
// ============================================================================

function demoHoldings() {
  const c = id => CRYPTO.find(a => a.cg === id);
  const s = sym => STOCKS.find(a => a.sym === sym);
  return [
    { ...c('bitcoin'), qty: 0.42, cost: 52000 },
    { ...c('ethereum'), qty: 3.5, cost: 2900 },
    { ...c('solana'), qty: 40, cost: 95 },
    { ...METALS[0], qty: 2, cost: 2650, unit: 'oz' },
    { ...METALS[1], qty: 60, cost: 31, unit: 'oz' },
    { ...s('AAPL'), qty: 25, cost: 182 },
    { ...s('NVDA'), qty: 30, cost: 96 },
    { ...s('VOO'), qty: 12, cost: 455 },
    { ...CASH_ITEM, qty: 5900, cost: null },
  // Without a Finnhub key stocks have no price: leave them out rather than
  // show an example that looks broken.
  ].filter(x => x.id && (x.kind !== 'stock' || state.settings.finnhubKey));
}

// ============================================================================
// Boot
// ============================================================================

function sync() {
  F.setNumberStyle(state.settings.numbers);
  P.setFinnhubKey(state.settings.finnhubKey);
  H.setHistoryKey(state.settings.historyKey);
  const held = new Set(state.holdings.map(a => a.id));
  // Plans that follow an index need that index's price.
  const followed = [...new Set(state.holdings.filter(a => a.kind === 'retire' && a.track).map(a => a.track))]
    .map(sym => STOCKS.find(s => s.sym === sym) || { id: 'stock:' + sym, kind: 'stock', sym, name: sym })
    .filter(a => !held.has(a.id));
  const watched = state.watch.filter(a => !held.has(a.id));
  P.track([...state.holdings, ...[BTC, XAU].filter(a => !held.has(a.id) && !watched.some(w => w.id === a.id)), ...followed, ...watched]);
  rangeSeg.set(state.settings.range);
}

$('btn-settings').innerHTML = ICONS.gear;
$('btn-add').innerHTML = ICONS.plus;
$('btn-settings').addEventListener('click', () => openSettings());
$('btn-add').addEventListener('click', () => openAdd());
$('empty-add').addEventListener('click', () => openAdd());
$('empty-demo').addEventListener('click', () => { haptic(8); enterDemo(demoHoldings()); });
$('demo-exit').addEventListener('click', () => exitDemo());
$('btn-targets').addEventListener('click', () => openTargets(valuation));
$('goal').addEventListener('click', () => { haptic(6); openGoal(valuation); });
$('chart-note').addEventListener('click', () => { if ($('chart-note').dataset.action) openSettings(); });
$('change').addEventListener('click', () => {
  if (!$('change').dataset.toggle) return;
  pillMode = pillMode === 'total' ? 'range' : 'total';
  haptic(5);
  scheduleRender(true);
});
$('empty-logos').append(logo(CRYPTO[0]), logo(METALS[0]), logo(STOCKS[0]), logo(CASH_ITEM));

// Balance: a tap changes the unit (currency → bitcoin → gold), a long press hides it.
{
  const bal = $('balance');
  let hold = 0, held = false;
  bal.addEventListener('pointerdown', () => {
    held = false;
    clearTimeout(hold);
    hold = setTimeout(() => { held = true; haptic(14); setSetting('hidden', !state.settings.hidden); }, 480);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) bal.addEventListener(ev, () => clearTimeout(hold));
  bal.addEventListener('contextmenu', e => e.preventDefault());
  bal.addEventListener('click', () => {
    if (held) { held = false; return; }
    haptic(6);
    if (state.settings.hidden) { setSetting('hidden', false); return; }
    const i = UNIT_CYCLE.indexOf(state.settings.unit);
    setSetting('unit', UNIT_CYCLE[(i + 1) % UNIT_CYCLE.length]);
  });
}

// Compact bar + pull to refresh (iOS reports a negative scrollTop while bouncing).
const scroller = $('scroll'), nav = $('nav'), ptr = $('ptr');
let refreshing = false;
scroller.addEventListener('scroll', () => {
  const y = scroller.scrollTop;
  const p = clamp((y - 92) / 34, 0, 1);
  nav.style.opacity = p;
  $('nav-title').style.transform = `translateY(${(1 - p) * 6}px)`;
  closeOpenRow();
  if (!refreshing) {
    ptr.style.opacity = y < 0 ? clamp(-y / 64, 0, 1) : 0;
    ptr.firstElementChild.style.transform = y < 0 ? `rotate(${-y * 4}deg)` : '';
  }
}, { passive: true });
scroller.addEventListener('touchend', async () => {
  if (refreshing || scroller.scrollTop > -64) return;
  refreshing = true;
  haptic(10);
  ptr.classList.add('spin');
  ptr.style.opacity = 1;
  await Promise.all([P.refresh(), new Promise(res => setTimeout(res, 700))]);
  ptr.classList.remove('spin');
  ptr.style.opacity = 0;
  refreshing = false;
}, { passive: true });

// iOS only applies :active styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

P.setPrevProvider(a => H.ref24(a));
subscribe(() => { sync(); scheduleRender(true); mirrorNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) V.flush(); });
V.persist();
// The working copy is gone but the internal mirror is not: bring it back.
let hadStore = false;
try { hadStore = localStorage.getItem('portfolio.v1') != null; } catch { /* no storage */ }
if (!hadStore) {
  V.recoverable().then(cur => {
    if (!cur || state.holdings.length) return;
    replaceAll(cur.store);
    replaceSnapshots(cur.snaps || []);
    toast('Datos recuperados de la copia interna');
  });
} else mirrorNow();
P.onPrices(() => scheduleRender(false));
H.onHistory(() => scheduleRender(false));

// Savings interest: credited when a month has passed, checked on launch, on
// coming back to the app and every few minutes while it is open.
const unitUsd = a => { const q = P.quoteOf(a); return q ? q.p : null; };
const accrueNow = () => accrueInterest(unitUsd);
setTimeout(accrueNow, 1500);
setInterval(accrueNow, 5 * 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(accrueNow, 1500); });

if (location.hash === '#demo' && !state.holdings.length) enterDemo(demoHoldings());
sync();
P.start();
renderHome();

startUpdates();
startPrivacy();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* the app works without it */ });
}
