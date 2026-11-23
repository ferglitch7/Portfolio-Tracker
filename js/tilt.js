// A subtle 3D tilt when a card is pressed: it leans a few degrees towards the
// finger and springs back on release, like icons on Apple TV. Only while the
// finger is down; a move that turns into a scroll lets go at once. Off when the
// iPhone asks for reduced motion.

import { reduceMotion } from './motion.js';

const MAX = 4;          // degrees at the card's edge
const SCROLL = 8;       // px of movement that means "this is a scroll"

export function tilt(el) {
  if (!el || el.dataset.tilt) return;
  el.dataset.tilt = '1';
  el.classList.add('tilt');
  let start = null;

  const lean = e => {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) - 0.5;
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) - 0.5;
    // Wide cards tilt less around the vertical axis, so the far edge doesn't swing too far.
    const k = Math.min(1, 220 / r.width);
    el.style.transform = `perspective(900px) rotateX(${(-y * 2 * MAX).toFixed(2)}deg) rotateY(${(x * 2 * MAX * k).toFixed(2)}deg) scale(0.985)`;
  };
  const release = () => {
    if (!start) return;
    start = null;
    el.classList.remove('pressing');
    el.style.transform = '';
  };

  el.addEventListener('pointerdown', e => {
    if (reduceMotion() || e.button > 0) return;
    start = { x: e.clientX, y: e.clientY };
    el.classList.add('pressing');
    lean(e);
  });
  el.addEventListener('pointermove', e => {
    if (!start) return;
    if (Math.abs(e.clientY - start.y) > SCROLL || Math.abs(e.clientX - start.x) > SCROLL * 3) { release(); return; }
    lean(e);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, release);
}
