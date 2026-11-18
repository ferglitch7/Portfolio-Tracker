// Light or dark: follow the iPhone (auto) or force one from Ajustes.
// index.html applies the saved choice before the first paint; this keeps it in
// step when it changes, including the colour of the status bar.

const BAR = { light: '#f2f2f7', dark: '#000000' };

export function applyTheme(theme) {
  const root = document.documentElement;
  const forced = theme === 'light' || theme === 'dark';
  if (forced) root.dataset.theme = theme; else delete root.dataset.theme;
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    const own = /dark/.test(m.media) ? BAR.dark : BAR.light;
    m.content = forced ? BAR[theme] : own;
  }
}
