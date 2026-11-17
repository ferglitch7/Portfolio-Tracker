// A curtain over the app whenever it leaves the screen, so the iPhone's app
// switcher keeps a blurred snapshot instead of the balance.
//
// Only for the installed app (and touch devices): on a desktop browser, moving
// to another window would blur the page for nothing.

const touchy = () => {
  try {
    return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(pointer: coarse)').matches;
  } catch { return false; }
};

let curtain = null;

function el() {
  if (curtain) return curtain;
  curtain = document.createElement('div');
  curtain.id = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  // The app's own mark, as on the home screen.
  curtain.innerHTML = '<svg class="curtain-mark" viewBox="0 0 512 512"><defs><linearGradient id="cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d20"/><stop offset="1" stop-color="#060607"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#cm)"/><g fill="none" stroke-width="46" stroke-linecap="round" transform="rotate(-90 256 256)"><circle cx="256" cy="256" r="118" stroke="#34d27b" stroke-dasharray="313.5 9999" stroke-dashoffset="-36"/><circle cx="256" cy="256" r="118" stroke="#f5f5f7" stroke-dasharray="150.4 9999" stroke-dashoffset="-421.5"/><circle cx="256" cy="256" r="118" stroke="#77777d" stroke-dasharray="61.5 9999" stroke-dashoffset="-644"/></g></svg>';
  document.body.append(curtain);
  return curtain;
}

export function cover() { el().classList.add('on'); document.documentElement.classList.add('away'); }
export function uncover() { if (curtain) curtain.classList.remove('on'); document.documentElement.classList.remove('away'); }

export function startPrivacy() {
  if (!touchy()) return;
  document.addEventListener('visibilitychange', () => { if (document.hidden) cover(); else uncover(); });
  addEventListener('pagehide', cover);
  addEventListener('pageshow', () => { if (!document.hidden) uncover(); });
  // iOS starts the app switcher gesture before the page is hidden.
  addEventListener('blur', cover);
  addEventListener('focus', uncover);
}
