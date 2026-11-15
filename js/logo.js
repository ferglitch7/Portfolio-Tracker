// Every asset gets a logo. Remote logos are tried in order and, if none
// loads, the asset still gets a clean monogram instead of a broken image.

import { h } from './motion.js';

const METAL = {
  XAU: { el: 'Au', stops: ['#FCE7A2', '#E9BC45', '#B8860F'], ink: '#5A3D00' },
  XAG: { el: 'Ag', stops: ['#F7F9FB', '#C9D0D8', '#8B949E'], ink: '#3A424B' },
  XPT: { el: 'Pt', stops: ['#F2F6FA', '#B9C7D6', '#74869B'], ink: '#2E3B4B' },
  XPD: { el: 'Pd', stops: ['#F6F1EA', '#CFC3B4', '#93836F'], ink: '#4A3E30' },
};

// Symbols can come from an imported file: only letters reach the SVG markup.
const safe = s => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 5);

function metalBadge(sym) {
  sym = METAL[sym] ? sym : 'XAG';
  const m = METAL[sym];
  const id = `metal-${sym}`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${m.stops[0]}"/><stop offset="0.5" stop-color="${m.stops[1]}"/><stop offset="1" stop-color="${m.stops[2]}"/>
    </linearGradient></defs>
    <circle cx="24" cy="24" r="24" fill="url(#${id})"/>
    <circle cx="24" cy="24" r="19.500" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>
    <text x="24" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${m.ink}" style="font-family:ui-rounded,-apple-system,system-ui,sans-serif">${m.el}</text>
  </svg>`;
}

// Currency badges, iOS style: a soft tint of the currency's colour with its
// symbol in that colour. Each colour has a deeper variant for the light theme
// so the symbol keeps its contrast on a pale background.
const TONE = {
  green: ['#30d158', '#1f7a37'], blue: ['#0a84ff', '#0060c7'], purple: ['#bf5af2', '#8944ab'],
  red: ['#ff453a', '#c9150c'], orange: ['#ff9f0a', '#b85000'], cyan: ['#40c8e0', '#00708a'],
  pink: ['#ff375f', '#c4153d'], gray: ['#98989d', '#5c5c61'],
};
const COIN = {
  USD: ['$', 'green'], EUR: ['€', 'blue'], GBP: ['£', 'purple'], JPY: ['¥', 'red'],
  CNY: ['元', 'red'], CHF: ['Fr', 'red'], CAD: ['C$', 'red'], AUD: ['A$', 'blue'],
  NZD: ['NZ$', 'blue'], MXN: ['MX$', 'green'], BRL: ['R$', 'green'], ARS: ['AR$', 'cyan'],
  COP: ['COL$', 'orange'], CLP: ['CL$', 'blue'], PEN: ['S/', 'red'], UYU: ['$U', 'blue'],
  DOP: ['RD$', 'blue'], CRC: ['₡', 'blue'], GTQ: ['Q', 'cyan'], HKD: ['HK$', 'red'],
  SGD: ['S$', 'red'], INR: ['₹', 'orange'], KRW: ['₩', 'blue'], SEK: ['kr', 'blue'],
  NOK: ['kr', 'red'], DKK: ['kr', 'red'], PLN: ['zł', 'pink'], TRY: ['₺', 'red'],
  ZAR: ['R', 'green'], AED: ['AED', 'gray'],
};

function coin(code) {
  const [sym, tone] = COIN[code] || [safe(code), 'gray'];
  const [dark, light] = TONE[tone];
  const size = sym.length >= 4 ? 11 : sym.length === 3 ? 13 : sym.length === 2 ? 16 : 21;
  return `<svg class="coin" viewBox="0 0 48 48" aria-hidden="true" style="--coin-d:${dark};--coin-l:${light}">
    <circle cx="24" cy="24" r="24" class="coin-bg"/>
    <text x="24" y="24" dy="0.36em" text-anchor="middle" font-size="${size}" font-weight="700" class="coin-sym" letter-spacing="-0.3" style="font-family:-apple-system,'SF Pro Display',system-ui,sans-serif">${sym}</text>
  </svg>`;
}

function hue(str) {
  let x = 0;
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
  return x % 360;
}

function monogram(asset) {
  const label = asset.kind === 'custom'
    ? (asset.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (asset.sym || asset.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const hu = hue(asset.name || asset.sym || 'x');
  return h('span.logo-mono', {
    text: label,
    style: { background: `linear-gradient(145deg, hsl(${hu} 62% 58%), hsl(${(hu + 28) % 360} 60% 42%))`, fontSize: label.length > 2 ? '0.3em' : '0.38em' },
  });
}

function sources(a) {
  if (a.kind === 'crypto') return a.img ? [{ src: a.img }] : [];
  if (a.kind === 'stock') {
    return [
      { src: `https://assets.parqet.com/logos/symbol/${encodeURIComponent(a.sym)}?format=png` },
      { src: `https://financialmodelingprep.com/image-stock/${encodeURIComponent(a.sym)}.png`, chip: true },
    ];
  }
  return [];
}

/** A round logo sized by the --logo custom property (or the size argument). */
export function logo(asset, size) {
  const el = h('span.logo', { 'aria-hidden': 'true' });
  if (size) el.style.setProperty('--logo', size + 'px');
  if (asset.kind === 'metal') { el.innerHTML = metalBadge(asset.sym); return el; }
  if (asset.kind === 'cash') { el.innerHTML = coin(asset.sym); return el; }
  if (asset.kind === 'retire') {
    const label = asset.mono || (asset.name || '?').slice(0, 1).toUpperCase();
    el.append(h('span.logo-mono', { text: label, style: { background: asset.color || '#5e5ce6', fontSize: label.length > 1 ? '0.32em' : '0.42em' } }));
    return el;
  }

  const list = sources(asset);
  const fallback = monogram(asset);
  if (!list.length) { el.append(fallback); return el; }

  // The monogram sits underneath until an image actually loads.
  el.append(fallback);
  const tryNext = i => {
    if (i >= list.length) return;
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.onload = () => {
      if (img.naturalWidth < 8) { tryNext(i + 1); return; }
      el.classList.toggle('logo-chip', !!list[i].chip);
      fallback.remove();
      el.append(img);
    };
    img.onerror = () => tryNext(i + 1);
    img.src = list[i].src;
  };
  tryNext(0);
  return el;
}
