// "Novedades": a small card shown once after an update that brings something
// worth telling. Releases without notes (fixes) update silently.
//
// To announce a release: add an entry at the top of NOTES with the version that
// ships it (the same as version.json) and at most three short items.

import { h, haptic, reduceMotion } from './motion.js';
import { APP_VERSION } from './update.js';

const SEEN_KEY = 'portfolio.seenVersion';

const ICON = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.1" fill="currentColor"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.1" fill="currentColor"/></svg>',
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14.2h8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 16.5l5-5 3.5 3.5 8-8"/><path d="M15 7h5v5"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
};

/** Newest first. `tone` is a CSS colour variable for the icon. */
export const NOTES = [
  {
    version: '2026.11.17-1',
    items: [
      { icon: 'list', tone: '--tint', title: 'Compras y ventas', text: 'Registra cada operación con su fecha. El costo promedio y la ganancia realizada se calculan solos.' },
      { icon: 'percent', tone: '--k-cash', title: 'Dividendos e intereses', text: 'Anota dividendos y recompensas, y ponle a tu Cash la tasa de tu cuenta de ahorro: el interés se abona cada mes.' },
      { icon: 'keyboard', tone: '--k-stock', title: 'Escribir cifras, más cómodo', text: 'Con el teclado abierto todo cabe en pantalla.' },
    ],
  },
];

// 2026.11.17-1 → [2026, 11, 17, 1], so -10 sorts after -9.
const parts = v => String(v).split(/[.-]/).map(Number);
export function newer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * What to announce on this launch, or null. `seen` is the last version the
 * person opened; `returning` says whether they already used the app before
 * (a first launch has nothing to compare against and shows nothing).
 */
export function notesFor(seen, current, returning, notes = NOTES) {
  const shipped = notes.filter(n => !newer(n.version, current));
  const fresh = seen ? shipped.filter(n => newer(n.version, seen)) : returning ? shipped.slice(0, 1) : [];
  if (!fresh.length) return null;
  return { version: fresh[0].version, items: fresh.flatMap(n => n.items).slice(0, 3) };
}

function read() { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } }
function write(v) { try { localStorage.setItem(SEEN_KEY, v); } catch { /* not kept */ } }

/** Call once the home screen is up. */
export function showWhatsNew({ returning }) {
  const seen = read();
  const notes = seen === APP_VERSION ? null : notesFor(seen, APP_VERSION, returning);
  write(APP_VERSION);
  if (!notes) return;
  open(notes);
}

function open(notes) {
  const btn = h('button.btn-primary', { type: 'button', text: 'Continuar' });
  const card = h('div.wn-card', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wn-title' },
    h('div.wn-title', { id: 'wn-title', text: 'Novedades' }),
    h('div.wn-list', null, notes.items.map(it => h('div.wn-item', null,
      h('span.wn-icon', { html: ICON[it.icon] || ICON.sparkle, style: { color: `var(${it.tone || '--tint'})` } }),
      h('div.wn-text', null, h('b', { text: it.title }), h('span', { text: it.text })),
    ))),
    btn);
  const back = h('div.wn-backdrop');
  const layer = h('div.wn-layer', null, back, card);
  document.body.append(layer);
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('in')));
  const close = () => {
    haptic(6);
    layer.classList.remove('in');
    setTimeout(() => layer.remove(), reduceMotion() ? 0 : 320);
  };
  btn.addEventListener('click', close);
  back.addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } });
}
