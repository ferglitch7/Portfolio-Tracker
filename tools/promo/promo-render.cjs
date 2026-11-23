// Renders the isometric promo of Portfolio frame by frame (deterministic, smooth),
// then encodes an MP4 for the iPhone. 1080x1920, 30 fps.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const D = '/tmp/claude-0/-home-user/352853a3-bd6a-51cd-8369-a65832162cd5/scratchpad/promo';
const FR = path.join(D, 'frames');
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });
const B = JSON.parse(fs.readFileSync(path.join(D, 'boxes.json'), 'utf8'));
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(D, f)).toString('base64');
const HOME = img('home.png'), HOME2 = img('home2.png'), DETAIL = img('detail.png');

// Floating layers: what part of which screen, how high it rises.
const LAYERS = [
  { src: 'HOME', box: B.hero, z: 170, d: 0.0 },
  { src: 'HOME', box: B.row, z: 120, d: 0.12 },
  { src: 'HOME', box: B.row2, z: 90, d: 0.2 },
  { src: 'HOME2', box: B.perf, z: 140, d: 0.28, at: { x: B.perf.x, y: 612 } },
  { src: 'HOME2', box: B.goal, z: 200, d: 0.36, at: { x: B.goal.x, y: 742 } },
];

const html = `<!DOCTYPE html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; background: #040820; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif; }
  #bg { position: absolute; inset: 0;
    background:
      radial-gradient(70% 45% at 50% 42%, rgba(60, 100, 255, 0.55), transparent 70%),
      radial-gradient(60% 40% at 85% 90%, rgba(130, 70, 255, 0.35), transparent 70%),
      radial-gradient(50% 35% at 10% 15%, rgba(40, 140, 255, 0.25), transparent 70%),
      #040820; }
  #grid { position: absolute; inset: -20%; opacity: 0.18;
    background-image: linear-gradient(rgba(140,170,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(140,170,255,.25) 1px, transparent 1px);
    background-size: 64px 64px; transform: perspective(1400px) rotateX(62deg) translateY(380px); transform-origin: 50% 100%;
    -webkit-mask-image: radial-gradient(60% 50% at 50% 60%, #000, transparent); }
  #stage { position: absolute; left: 50%; top: 50%; width: 0; height: 0; perspective: 2600px; }
  #phone { position: absolute; width: 402px; height: 874px; left: -201px; top: -437px; transform-style: preserve-3d; }
  .screen { position: absolute; inset: 0; border-radius: 54px; background: url(${HOME}) 0 0 / 402px 874px; overflow: hidden;
    box-shadow: 0 0 0 9px #0c1236, 0 0 0 10.5px rgba(150,175,255,.35), 0 40px 120px rgba(20, 40, 200, 0.55); }
  .shade { position: absolute; inset: 0; border-radius: 54px; background: linear-gradient(160deg, rgba(255,255,255,.10), transparent 40%); pointer-events: none; }
  .layer { position: absolute; border-radius: 22px; overflow: hidden; background-size: 402px 874px;
    box-shadow: 0 0 0 1px rgba(170,190,255,.28), 0 20px 50px rgba(5, 10, 60, .55); }
  .layer::after { content: ""; position: absolute; inset: 0; background: linear-gradient(150deg, rgba(255,255,255,.14), transparent 45%); }
  #title { position: absolute; left: 0; right: 0; top: 190px; text-align: center; color: #fff; }
  #title h1 { font-size: 92px; font-weight: 800; letter-spacing: -3px; }
  #title p { margin-top: 18px; font-size: 40px; color: rgba(214,222,255,.78); letter-spacing: -0.5px; }
  #mark { width: 118px; height: 118px; margin: 0 auto 34px; border-radius: 30px; box-shadow: 0 18px 60px rgba(40,80,255,.6); }
  #foot { position: absolute; left: 0; right: 0; bottom: 150px; text-align: center; color: rgba(214,222,255,.7); font-size: 34px; letter-spacing: 0.5px; }
  #foot b { color: #fff; font-weight: 700; }
</style></head><body>
<div id="bg"></div><div id="grid"></div>
<div id="title"><svg id="mark" viewBox="0 0 512 512"><defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d20"/><stop offset="1" stop-color="#060607"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#m)"/><g fill="none" stroke-width="46" stroke-linecap="round" transform="rotate(-90 256 256)"><circle cx="256" cy="256" r="118" stroke="#34d27b" stroke-dasharray="313.5 9999" stroke-dashoffset="-36"/><circle cx="256" cy="256" r="118" stroke="#f5f5f7" stroke-dasharray="150.4 9999" stroke-dashoffset="-421.5"/><circle cx="256" cy="256" r="118" stroke="#77777d" stroke-dasharray="61.5 9999" stroke-dashoffset="-644"/></g></svg><h1>Portfolio</h1><p>Todo tu patrimonio, en vivo</p></div>
<div id="stage"><div id="phone"><div class="screen" id="screen"></div><div class="shade"></div></div></div>
<div id="foot"><b>Crypto · Acciones · Metales · Cash</b><br>en un solo balance</div>
<script>
  const SRC = { HOME: ${JSON.stringify(HOME)}, HOME2: ${JSON.stringify(HOME2)}, DETAIL: ${JSON.stringify(DETAIL)} };
  const L = ${JSON.stringify(LAYERS)};
  const phone = document.getElementById('phone');
  const els = L.map(l => {
    const e = document.createElement('div');
    e.className = 'layer';
    const at = l.at || l.box;
    Object.assign(e.style, { left: at.x + 'px', top: at.y + 'px', width: l.box.w + 'px', height: l.box.h + 'px',
      backgroundImage: 'url(' + SRC[l.src] + ')', backgroundPosition: (-l.box.x) + 'px ' + (-l.box.y) + 'px' });
    phone.append(e);
    return e;
  });
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const span = (t, a, b) => ease(clamp((t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  window.setT = t => {
    const iso = span(t, 0.9, 3.0);                 // flat → isometric
    const lift = span(t, 2.6, 4.8);                // layers rise
    const drift = Math.sin(Math.max(0, t - 4.2) * 0.9) * span(t, 4.2, 5.4);
    const out = span(t, 7.6, 8.6);                 // back towards flat at the end
    const k = iso * (1 - out * 0.85);
    const rx = lerp(8, 56, k), rz = lerp(0, -40, k) + drift * 4, sc = lerp(1.22, 1.1, k) * lerp(0.92, 1, span(t, 0, 0.9));
    const ty = lerp(330, 250, k);
    phone.style.transform = 'translate3d(0,' + ty + 'px,0) scale(' + sc + ') rotateX(' + rx + 'deg) rotateZ(' + rz + 'deg)';
    phone.style.opacity = span(t, 0, 0.7);
    els.forEach((e, i) => {
      const l = L[i];
      const u = clamp((lift - l.d) / (1 - l.d)) * (1 - out);
      const bob = Math.sin(t * 1.7 + i) * 6 * span(t, 4.4, 5.4) * (1 - out);
      e.style.transform = 'translateZ(' + (l.z * u + bob) + 'px)';
      e.style.boxShadow = '0 0 0 1px rgba(170,190,255,' + (0.18 + 0.2 * u) + '), 0 ' + (10 + 40 * u) + 'px ' + (30 + 70 * u) + 'px rgba(5,10,60,' + (0.3 + 0.35 * u) + ')';
      e.style.opacity = u > 0.02 ? 1 : 0;
    });
    const tt = span(t, 0.2, 1.3) * (1 - span(t, 8.2, 8.9) * 0);
    const title = document.getElementById('title');
    title.style.opacity = tt; title.style.transform = 'translateY(' + lerp(30, 0, tt) + 'px)';
    const ft = span(t, 4.6, 5.6);
    const foot = document.getElementById('foot');
    foot.style.opacity = ft; foot.style.transform = 'translateY(' + lerp(24, 0, ft) + 'px)';
  };
  window.setT(0);
</script></body></html>`;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForTimeout(500);
  const FPS = 30, DUR = 9.2;
  const N = Math.round(FPS * DUR);
  for (let i = 0; i < N; i++) {
    await page.evaluate(t => window.setT(t), i / FPS);
    await page.screenshot({ path: path.join(FR, String(i).padStart(4, '0') + '.png') });
  }
  await page.evaluate(() => window.setT(5.6));
  await page.screenshot({ path: path.join(D, 'poster.png') });
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FR, '%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(D, 'portfolio-3d.mp4')]);
  console.log('frames', N, fs.statSync(path.join(D, 'portfolio-3d.mp4')).size);
})().catch(e => { console.error(e); process.exit(1); });
