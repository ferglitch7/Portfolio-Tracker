// "Novedades": a small card shown once after an update that brings something
// worth telling. Releases without notes (fixes) update silently.
//
// To announce a release: add an entry at the top of NOTES with the version that
// ships it (the same as version.json: 1.1, 1.2 … 1.9, 2.0) and at most three
// short items.

import { h, haptic, reduceMotion } from './motion.js';
import { APP_VERSION } from './update.js';

const SEEN_KEY = 'portfolio.seenVersion';

const ICON = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.1" fill="currentColor"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.1" fill="currentColor"/></svg>',
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14.2h8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 16.5l5-5 3.5 3.5 8-8"/><path d="M15 7h5v5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3.5a8.5 8.5 0 0 1 8.4 7.2"/><path d="M20.2 14.6A8.5 8.5 0 0 1 6 18.6"/><path d="M4.2 15.4A8.5 8.5 0 0 1 9 4"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
};

/** Newest first. `tone` is a CSS colour variable for the icon. */
export const NOTES = [
  {
    version: '1.5',
    items: [
      { icon: 'ring', tone: '--k-crypto', title: 'Elige cómo ver tu distribución', text: 'En Ajustes → Distribución: Barra, Anillo o Lista. Toca una clase para ver solo sus activos.' },
    ],
  },
  {
    version: '1.1',
    items: [
      { icon: 'lock', tone: '--tint', title: 'Bloqueo con Face ID', text: 'Actívalo en Ajustes: la app pide tu cara al abrirla, y tu balance se difumina al salir de la app.' },
      { icon: 'eye', tone: '--k-stock', title: 'Seguimiento', text: 'Sigue activos que aún no tienes: al añadir uno, toca «Solo seguir, sin comprar».' },
      { icon: 'chart', tone: '--k-cash', title: 'Tus operaciones en el gráfico', text: 'Tus compras y ventas aparecen como puntos; desliza el dedo encima para verlas.' },
    ],
  },
  {
    version: '1.0',
    items: [
      { icon: 'sparkle', tone: '--tint', title: 'Versión 1.0', text: 'Las versiones ahora van por número: 1.1, 1.2… y después de 1.9 llega la 2.0.' },
      { icon: 'calendar', tone: '--k-stock', title: 'Fechas MM/DD/YYYY', text: 'Todas las fechas se muestran como mes/día/año.' },
    ],
  },
  {
    version: '2026.11.17-1',
    items: [
      { icon: 'list', tone: '--tint', title: 'Compras y ventas', text: 'Registra cada operación con su fecha. El costo promedio y la ganancia realizada se calculan solos.' },
      { icon: 'percent', tone: '--k-cash', title: 'Dividendos e intereses', text: 'Anota dividendos y recompensas, y ponle a tu Cash la tasa de tu cuenta de ahorro: el interés se abona cada mes.' },
      { icon: 'keyboard', tone: '--k-stock', title: 'Escribir cifras, más cómodo', text: 'Con el teclado abierto todo cabe en pantalla.' },
    ],
  },
];

// Versions are numbers: 1.0, 1.1 … 1.9, then 2.0. Compared as numbers, so
// 1.10 would still sort after 1.9. Before 1.0 the app used dates
// (2026.11.17-2): those are all older than any numbered version.
const legacy = v => /^\d{4}\./.test(String(v));
const parts = v => String(v).split(/[.-]/).map(Number);
export function newer(a, b) {
  if (legacy(a) !== legacy(b)) return legacy(b);
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

/** The latest notes again, from Ajustes. False when there are none. */
export function showLatest() {
  const n = NOTES.find(x => !newer(x.version, APP_VERSION));
  if (!n) return false;
  open({ version: n.version, items: n.items.slice(0, 3) });
  return true;
}

function open(notes) {
  const btn = h('button.btn-primary', { type: 'button', text: 'Continuar' });
  const card = h('div.wn-card', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wn-title' },
    h('div.wn-head', null,
      h('div.wn-title', { id: 'wn-title', text: 'Novedades' }),
      h('div.wn-version', { text: `Versión ${APP_VERSION}` })),
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
