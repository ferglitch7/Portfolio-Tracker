// Second copy of everything, inside this browser, in IndexedDB.
//
// localStorage is the working copy. The vault mirrors it and also keeps dated
// versions, so that:
//   - if the working copy is ever emptied or corrupted, the app restores it
//     from the mirror on its own;
//   - a mistake (a wrong edit, "Borrar todo") can be undone from a version.
//
// Both live in the same browser storage, so neither survives deleting the app
// from the home screen: for that there is "Guardar en Archivos".

const DB_NAME = 'portfolio-vault';
const KEEP = 20;          // versions kept, newest first
const DAY = 86400e3;

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('versions')) d.createObjectStore('versions', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(e => { dbp = null; throw e; });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Ask the browser not to evict this app's storage under pressure. */
export async function persist() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

function localDay(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function prune(s) {
  const all = await req(s.getAll());
  all.sort((a, b) => b.t - a.t);
  for (const v of all.slice(KEEP)) s.delete(v.id);
}

let timer = 0, pendingDoc = null;

/**
 * Mirror the current data. doc = { store, snaps }. The first save of each day
 * also becomes that day's version, so a version holds the day as it started.
 */
export function mirror(doc) {
  pendingDoc = doc;
  clearTimeout(timer);
  timer = setTimeout(flush, 1200);
}

export async function flush() {
  clearTimeout(timer);
  const doc = pendingDoc;
  pendingDoc = null;
  if (!doc) return;
  const now = Date.now();
  try {
    await tx('kv', 'readwrite', s => { s.put({ t: now, ...doc }, 'current'); });
    if (!doc.store || !doc.store.holdings || !doc.store.holdings.length) return;
    await tx('versions', 'readwrite', async s => {
      const id = 'd-' + localDay(now);
      if (!(await req(s.get(id)))) {
        s.put({ id, t: now, label: '', count: doc.store.holdings.length, ...doc });
        await prune(s);
      }
    });
  } catch { /* IndexedDB unavailable: the working copy still exists */ }
}

/** Keep the data as it is right now, before something replaces it. */
export async function checkpoint(doc, label) {
  if (!doc.store || !doc.store.holdings || !doc.store.holdings.length) return;
  const t = Date.now();
  try {
    await tx('versions', 'readwrite', async s => {
      s.put({ id: 'c-' + t, t, label, count: doc.store.holdings.length, ...doc });
      await prune(s);
    });
  } catch { /* nothing to keep it in */ }
}

/** The mirrored data, or null. */
export async function recoverable() {
  try {
    const cur = await tx('kv', 'readonly', s => req(s.get('current')));
    return cur && cur.store && Array.isArray(cur.store.holdings) && cur.store.holdings.length ? cur : null;
  } catch { return null; }
}

/** Saved versions, newest first: [{ id, t, label, count, store, snaps }]. */
export async function versions() {
  try {
    const all = await tx('versions', 'readonly', s => req(s.getAll()));
    return (all || []).sort((a, b) => b.t - a.t);
  } catch { return []; }
}

// ---------- copies outside the device ------------------------------------------

const EXPORTED_KEY = 'portfolio.exported';
const SINCE_KEY = 'portfolio.since';
const SIG_KEY = 'portfolio.exportedSig';

const num = k => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const setNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* not kept */ } };

export function lastExport() { return num(EXPORTED_KEY); }

/** Note when this device first held positions (for the backup reminder). */
export function markSince(hasHoldings) {
  if (hasHoldings && !num(SINCE_KEY)) setNum(SINCE_KEY, Date.now());
}

/** A short fingerprint of what a copy holds, to tell whether anything changed. */
export function signature(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + text.length;
}

/**
 * Days without a copy outside the device, once that is worth a reminder:
 * three days after first use if never saved, otherwise a week after the last
 * copy, but only if the portfolio changed since (`sig`, see signature()).
 * Null when no reminder is due.
 */
export function backupDue(now = Date.now(), sig = null) {
  const since = num(SINCE_KEY), last = num(EXPORTED_KEY);
  if (!since) return null;
  if (!last) return now - since > 3 * DAY ? Math.floor((now - since) / DAY) : null;
  if (sig && sig === readSig()) return null;
  return now - last > 7 * DAY ? Math.floor((now - last) / DAY) : null;
}

function readSig() { try { return localStorage.getItem(SIG_KEY); } catch { return null; } }
function exported(sig) {
  setNum(EXPORTED_KEY, Date.now());
  try { if (sig) localStorage.setItem(SIG_KEY, sig); } catch { /* not kept */ }
}

/**
 * Save a copy outside the app. On iPhone this opens the share sheet, where
 * "Guardar en Archivos" puts it in iCloud Drive; elsewhere it downloads the
 * file. Must run from a tap. Resolves to true once the copy was handed over.
 */
export async function saveFile(text, sig = null) {
  const name = `portfolio-${localDay(Date.now())}.json`;
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de Portfolio' });
      exported(sig);
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false; // closed the share sheet
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  exported(sig);
  return true;
}
