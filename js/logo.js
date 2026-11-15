// Every asset gets a logo. Remote logos are tried in order and, if none
// loads, the asset still gets a clean monogram instead of a broken image.

import { h } from './motion.js';

const METAL = {
  XAU: { el: 'Au', stops: ['#FCE7A2', '#E9BC45', '#B8860F'], ink: '#5A3D00' },
  XAG: { el: 'Ag', stops: ['#F7F9FB', '#C9D0D8', '#8B949E'], ink: '#3A424B' },
  XPT: { el: 'Pt', stops: ['#F2F6FA', '#B9C7D6', '#74869B'], ink: '#2E3B4B' },
  XPD: { el: 'Pd', stops: ['#F6F1EA', '#CFC3B4', '#93836F'], ink: '#4A3E30' },
};

function metalBadge(sym) {
  const m = METAL[sym] || METAL.XAG;
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

// Currency coins: a struck coin in a deep tone with a thin metallic rim and the
// currency's symbol. The tone is a darkened colour from that country's flag, so
// coins are told apart at a glance without showing flags.
const COIN = {
  USD: ['$', '#1f5f3f'], EUR: ['€', '#1d3f8f'], GBP: ['£', '#4a2c7a'], JPY: ['¥', '#8c1d24'],
  CNY: ['元', '#8a2a14'], CHF: ['Fr', '#9a1f1f'], CAD: ['C$', '#8f1d2c'], AUD: ['A$', '#1f3a7a'],
  NZD: ['NZ$', '#1c2f66'], MXN: ['MX$', '#0f5a3c'], BRL: ['R$', '#0f6b3a'], ARS: ['AR$', '#2a6aa8'],
  COP: ['COL$', '#8a6a10'], CLP: ['CL$', '#1d3f8f'], PEN: ['S/', '#9a1f2a'], UYU: ['$U', '#2a5aa0'],
  DOP: ['RD$', '#1d3a7a'], CRC: ['₡', '#1f3a8a'], GTQ: ['Q', '#2a7ab0'], HKD: ['HK$', '#9a1f2a'],
  SGD: ['S$', '#a01f2a'], INR: ['₹', '#b0601a'], KRW: ['₩', '#1d3a7a'], SEK: ['kr', '#1f5a8f'],
  NOK: ['kr', '#9a1f2a'], DKK: ['kr', '#a01f2a'], PLN: ['zł', '#a0283a'], TRY: ['₺', '#a01f24'],
  ZAR: ['R', '#14603a'], AED: ['AED', '#3a3a3c'],
};

function coin(code) {
  const [sym, tone] = COIN[code] || [code, '#3a3a3c'];
  const id = 'coin-' + code;
  const size = sym.length >= 4 ? 11 : sym.length === 3 ? 13 : sym.length === 2 ? 16 : 21;
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <radialGradient id="${id}-f" cx="0.35" cy="0.28" r="0.9">
        <stop offset="0" stop-color="${tone}" stop-opacity="0.78"/><stop offset="0.55" stop-color="${tone}"/><stop offset="1" stop-color="#0b0b0d" stop-opacity="0.9"/>
      </radialGradient>
      <linearGradient id="${id}-r" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f4f4f6"/><stop offset="0.45" stop-color="#8e8e93"/><stop offset="0.55" stop-color="#c7c7cc"/><stop offset="1" stop-color="#5a5a5f"/>
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="24" fill="url(#${id}-r)"/>
    <circle cx="24" cy="24" r="22.2" fill="url(#${id}-f)"/>
    <circle cx="24" cy="24" r="18.6" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="0.8"/>
    <text x="24" y="24" dy="0.36em" text-anchor="middle" font-size="${size}" font-weight="700" fill="#fff" fill-opacity="0.96" letter-spacing="-0.3" style="font-family:-apple-system,'SF Pro Display',system-ui,sans-serif">${sym}</text>
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
