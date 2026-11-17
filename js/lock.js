// "Bloqueo con Face ID": the app asks for the owner's face (or the iPhone code)
// on launch and after a minute away.
//
// It uses a passkey (WebAuthn) on this device. There is no server, so this is a
// privacy screen against someone holding the unlocked phone, not encryption:
// the data itself is stored as before.
//
// No way to be locked out: if the passkey stops working (deleted from
// Passwords, a new phone), "Configurar de nuevo" makes a new one, and making
// one also needs the owner's face or iPhone code.

import { h, haptic } from './motion.js';

const KEY = 'portfolio.lock';     // { id } base64url of this device's passkey
const AWAY_MS = 60e3;             // locks again after this long in the background

let overlay = null, hiddenAt = 0, busy = false, fails = 0;
const listeners = new Set();

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const random = n => crypto.getRandomValues(new Uint8Array(n));

function stored() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* not kept */ } listeners.forEach(fn => fn()); }

export const lockEnabled = () => !!(stored() && stored().id);
export const isLocked = () => !!overlay;
export function onLockChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** True when this device can check its owner's face or code (Face ID, Touch ID, code). */
export async function lockSupported() {
  try {
    return !!(window.PublicKeyCredential && window.isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

// The authenticator data says whether the person was actually verified (UV bit).
function verified(cred) {
  try { return (new Uint8Array(cred.response.authenticatorData)[32] & 0x04) !== 0; } catch { return false; }
}

/** Make this device's passkey. Asks for Face ID / code. Resolves true on success. */
async function enroll() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Portfolio' },
      user: { id: random(16), name: 'Portfolio', displayName: 'Bloqueo de Portfolio' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  });
  if (!cred) return false;
  save({ id: b64(cred.rawId) });
  return true;
}

/** Ask for Face ID / code with the stored passkey. Resolves true when it is the owner. */
async function check(signal) {
  const s = stored();
  if (!s) return true;
  const cred = await navigator.credentials.get({
    signal,
    publicKey: { challenge: random(32), allowCredentials: [{ type: 'public-key', id: unb64(s.id) }], userVerification: 'required', timeout: 60000 },
  });
  return !!cred && verified(cred);
}

/** Turn the lock on (from Ajustes). */
export async function enableLock() {
  try { return await enroll(); } catch { return false; }
}

/** Turn it off: only the owner can. */
export async function disableLock() {
  try {
    if (!(await check())) return false;
  } catch { return false; }
  save(null);
  return true;
}

// ---- the lock screen ------------------------------------------------------------

export function lockNow() {
  if (!lockEnabled() || overlay) return;
  fails = 0;
  const btn = h('button.btn-primary', { type: 'button', id: 'unlock', text: 'Desbloquear' });
  const msg = h('p.lock-msg');
  const again = h('button.btn-text', { type: 'button', id: 'lock-reset', hidden: true, text: 'Configurar Face ID de nuevo' });
  overlay = h('div', { id: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Portfolio bloqueado' },
    h('div.lock-body', null,
      h('span.lock-icon', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>' }),
      h('div.lock-title', { text: 'Portfolio bloqueado' }),
      msg),
    h('div.lock-foot', null, btn, again));
  document.body.append(overlay);
  document.documentElement.classList.add('locked');

  // A tap always wins over a request still waiting (the automatic one on
  // launch may hang until iOS gets a tap): the older one is cancelled.
  let pending = null;
  const attempt = async (auto) => {
    if (pending) pending.abort();
    const ctrl = new AbortController();
    pending = ctrl;
    msg.textContent = '';
    try {
      if (await check(ctrl.signal)) { unlock(); return; }
      throw new Error('not verified');
    } catch {
      if (auto || ctrl.signal.aborted) return; // nothing the person did failed
      fails++;
      msg.textContent = 'No se pudo comprobar. Inténtalo de nuevo.';
      again.hidden = fails < 2;
    } finally { if (pending === ctrl) pending = null; }
  };
  btn.addEventListener('click', () => attempt(false));
  again.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    if (pending) pending.abort();
    try {
      if (await enroll()) { unlock(); return; }
    } catch { msg.textContent = 'No se pudo configurar. Inténtalo de nuevo.'; } finally { busy = false; }
  });
  // Ask right away; if iOS needs a tap, the button is there.
  setTimeout(() => attempt(true), 350);
}

function unlock() {
  haptic(8);
  const el = overlay;
  overlay = null;
  document.documentElement.classList.remove('locked');
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 300);
}

export function startLock() {
  if (lockEnabled()) lockNow();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) lockNow();
    hiddenAt = 0;
  });
}
