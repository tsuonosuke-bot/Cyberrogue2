/* FIXER'S CUT — 絵：義体で変わる肖像、企業ロゴ、夜のヨミハマ、カットイン */

const ART_REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ───────── 肖像（一枚絵＋義体の重ね描き） ─────────
   絵は assets/portraits/ に置く。ロール×性別×2枚の30枚と、物語つき5人の専用の絵。
   本番の絵に差し替えるときは、同じ名前で置いて PORTRAIT_EXT を変えるか、PORTRAIT_FILES で名前を指定する。
   詳しくは assets/portraits/README.md を参照。 */

const PAL = {
  pink: '#ff4f9a', pinkL: '#ffb3d1', blue: '#3f7cff', blueL: '#9cc0ff',
  chrome: '#d2d9e6', chromeM: '#8b97ad', chromeD: '#4a556b', ink: '#06080d', paper: '#e9ebee',
};

const PORTRAIT_DIR = 'assets/portraits/';
const PORTRAIT_VARIANTS = 2;
const PORTRAIT_EXT = 'svg';
const PORTRAIT_FILES = {}; // 例: { 'solo-m-1': 'solo-m-1.png', yoru: 'yoru.webp' }

/* 絵の中の位置（左上0・右下100）。仮の絵はこの位置で描いてある。
   本番の絵で位置がずれる場合は、PORTRAIT_ANCHOR_OVERRIDES に絵ごとの値を書く（tools/portraits.html で調べられる） */
const PORTRAIT_ANCHORS = {
  head: [50, 38, 15, 19], // 顔の楕円 [中心x, 中心y, 横半径, 縦半径]
  eyeL: [43, 40], eyeR: [57, 40], // 画面の左の目、右の目
  forehead: [50, 25], templeR: [63, 31], earL: [34.5, 41], cheekL: [40, 47],
  neck: [50, 60], neckSide: [45, 57], throat: [50, 63], chest: [64, 86],
  armL: [8, 74, 24, 26], handR: [70, 84, 20, 16], // [x, y, 幅, 高さ]
};
const PORTRAIT_ANCHOR_OVERRIDES = {}; // 例: { 'solo-m-1': { eyeL: [41, 38], eyeR: [58, 38] } }

function portraitKey(r) {
  if (r.story && STORY_RUNNERS[r.story]) return r.story;
  const v = 1 + (hashStr(`${r.name}:${r.id}`) % PORTRAIT_VARIANTS);
  return `${r.role}-${r.gender || 'x'}-${v}`;
}
const portraitSrc = (key) => PORTRAIT_DIR + (PORTRAIT_FILES[key] || `${key}.${PORTRAIT_EXT}`);

let overlaySeq = 0;
function implantOverlay(cyber, m, A) {
  const id = `ov${overlaySeq++}`;
  // 上位モデルは look に書いた義体の描き方を借りる
  const has = (k) => cyber.some((c) => ((CYBER[c] && CYBER[c].look) || c) === k);
  const defs = [], out = [];
  const glowP = 'class="gp"', glowB = 'class="gb"';

  // 人間性が減るほど、左あごから顔が機械に置き換わる
  if (m > 0.12) {
    const [hx, hy, rx, ry] = A.head;
    const reach = (rx + ry) * 2 * Math.min(1.5, m * 1.7) * 0.6;
    const x0 = hx - rx - 2, y0 = hy + ry + 2;
    defs.push(`<clipPath id="${id}c"><ellipse cx="${hx}" cy="${hy}" rx="${rx}" ry="${ry}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PAL.chrome}"/><stop offset=".5" stop-color="${PAL.chromeM}"/><stop offset="1" stop-color="${PAL.chromeD}"/></linearGradient>
      <pattern id="${id}h" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="0.5" fill="${PAL.chromeD}"/></pattern>`);
    const d = `M${x0} ${y0} L${x0 + reach} ${y0} L${x0} ${y0 - reach} Z`;
    out.push(`<g clip-path="url(#${id}c)"><path d="${d}" fill="url(#${id}g)" opacity=".92"/><path d="${d}" fill="url(#${id}h)" opacity=".5"/><path d="M${x0 + reach} ${y0} L${x0} ${y0 - reach}" stroke="${PAL.ink}" stroke-width="0.9"/></g>`);
    const [lx, ly] = A.eyeL;
    if ((lx - x0) + (y0 - ly) < reach * 0.95) out.push(`<circle cx="${lx}" cy="${ly}" r="2.2" fill="${PAL.pink}" ${glowP}/><circle cx="${lx - 0.6}" cy="${ly - 0.5}" r="0.7" fill="${PAL.pinkL}"/>`);
  }
  if (has('optics')) {
    const [x, y] = A.eyeR;
    out.push(`<circle cx="${x}" cy="${y}" r="4.3" fill="${PAL.chromeM}" stroke="${PAL.chrome}" stroke-width="0.8"/><circle cx="${x}" cy="${y}" r="2.4" fill="${PAL.pink}" ${glowP}/><circle cx="${x - 0.7}" cy="${y - 0.7}" r="0.8" fill="${PAL.pinkL}"/>`);
  }
  if (has('arm')) {
    const [x, y, w, h] = A.armL;
    defs.push(`<linearGradient id="${id}a" x1="0" x2="1"><stop offset="0" stop-color="${PAL.chromeD}"/><stop offset=".45" stop-color="${PAL.chrome}"/><stop offset="1" stop-color="${PAL.chromeM}"/></linearGradient>`);
    const p = (fx, fy) => `${x + w * fx} ${y + h * fy}`;
    let seg = '';
    for (const fy of [0.55, 0.72, 0.88]) seg += `<path d="M${p(0.14 + (1 - fy) * 0.1, fy)} L${p(0.92 - (fy - 0.5) * 0.15, fy)}" stroke="${PAL.chromeD}" stroke-width="0.9"/>`;
    out.push(`<path d="M${p(0.55, 0.08)} C${p(0.92, 0.04)} ${p(1.06, 0.36)} ${p(0.95, 0.56)} L${p(0.8, 1)} L${p(0.04, 1)} L${p(0.18, 0.4)} C${p(0.24, 0.18)} ${p(0.4, 0.1)} ${p(0.55, 0.08)} Z" fill="url(#${id}a)" stroke="${PAL.chromeD}" stroke-width="0.6"/>`
      + `<ellipse cx="${x + w * 0.62}" cy="${y + h * 0.26}" rx="${w * 0.3}" ry="${h * 0.17}" fill="${PAL.chromeM}" stroke="${PAL.chrome}" stroke-width="0.6"/>${seg}`
      + `<circle cx="${x + w * 0.62}" cy="${y + h * 0.26}" r="1" fill="${PAL.blue}" ${glowB}/><circle cx="${x + w * 0.45}" cy="${y + h * 0.8}" r="0.9" fill="${PAL.blue}" ${glowB}/>`);
  }
  if (has('plating')) {
    const [x, y] = A.cheekL;
    out.push(`<path d="M${x} ${y - 7} V${y + 6} M${x - 1.5} ${y - 3} H${x + 1.5} M${x - 1.5} ${y + 2} H${x + 1.5}" stroke="${PAL.chromeD}" stroke-width="0.8" fill="none"/><circle cx="${x + 2}" cy="${y - 5}" r="0.7" fill="${PAL.chrome}"/><circle cx="${x + 2}" cy="${y + 4}" r="0.7" fill="${PAL.chrome}"/>`);
  }
  if (has('synapse')) {
    const [x, y] = A.templeR;
    out.push(`<g fill="${PAL.blueL}" ${glowB}><circle cx="${x}" cy="${y}" r="0.9"/><circle cx="${x + 1.6}" cy="${y + 2.4}" r="0.9"/><circle cx="${x}" cy="${y + 4.8}" r="0.9"/></g><path d="M${x} ${y} L${x + 1.6} ${y + 2.4} L${x} ${y + 4.8}" stroke="${PAL.blueL}" stroke-width="0.4" fill="none"/>`);
  }
  if (has('coproc')) {
    const [x, y] = A.forehead;
    out.push(`<rect x="${x - 3}" y="${y - 1.5}" width="6" height="3" rx="0.6" fill="${PAL.chromeD}" stroke="${PAL.chrome}" stroke-width="0.4"/><circle cx="${x + 1.5}" cy="${y}" r="0.7" fill="${PAL.blueL}" ${glowB}/>`);
  }
  if (has('jack')) {
    const [x, y] = A.neck;
    const [cx, cy] = A.chest;
    out.push(`<rect x="${x + 4}" y="${y - 2}" width="2.6" height="4" rx="0.6" fill="${PAL.chrome}"/><path d="M${x + 5.3} ${y + 2} C${x + 8} ${y + 10} ${cx - 6} ${cy - 12} ${cx - 2} ${cy - 2}" stroke="${PAL.blue}" stroke-width="1.1" fill="none" ${glowB}/>`);
  }
  if (has('toolfinger')) {
    const [x, y, w, h] = A.handR;
    const fw = w / 5;
    let fingers = '';
    for (let i = 0; i < 4; i++) fingers += `<rect x="${x + 1 + i * (fw + 0.8)}" y="${y - 5}" width="${fw * 0.8}" height="7" rx="0.8" fill="${PAL.chrome}"/><circle cx="${x + 1 + i * (fw + 0.8) + fw * 0.4}" cy="${y - 5}" r="0.7" fill="${PAL.blueL}" ${glowB}/>`;
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${PAL.chromeM}"/>${fingers}`);
  }
  if (has('ears')) {
    const [x, y] = A.earL;
    out.push(`<ellipse cx="${x}" cy="${y}" rx="3" ry="4.4" fill="${PAL.chromeM}" stroke="${PAL.chrome}" stroke-width="0.5"/><circle cx="${x}" cy="${y}" r="0.9" fill="${PAL.blueL}" ${glowB}/>`);
  }
  if (has('medkit')) {
    const [x, y] = A.chest;
    out.push(`<circle cx="${x}" cy="${y}" r="3.4" fill="${PAL.ink}" stroke="${PAL.chromeD}" stroke-width="0.9"/><path d="M${x - 1.8} ${y} H${x + 1.8} M${x} ${y - 1.8} V${y + 1.8}" stroke="${PAL.pink}" stroke-width="1.1" ${glowP}/>`);
  }
  if (has('steering')) {
    const [x, y] = A.neckSide;
    out.push(`<path d="M${x} ${y - 4} V${y + 10}" stroke="${PAL.blueL}" stroke-width="0.9" stroke-dasharray="1.4 1.2" ${glowB}/>`);
  }
  if (has('painblock')) {
    const [x, y] = A.neckSide;
    let bars = '';
    for (let i = 0; i < 6; i++) bars += `<rect x="${x - 6 + i * 1.1}" y="${y - 1}" width="${i % 3 ? 0.5 : 0.8}" height="3" fill="${PAL.ink}"/>`;
    out.push(`<rect x="${x - 6.5}" y="${y - 1.5}" width="7.3" height="4" fill="${PAL.paper}" opacity=".85"/>${bars}`);
  }
  if (has('voice')) {
    const [x, y] = A.throat;
    out.push(`<rect x="${x - 3}" y="${y - 1.6}" width="6" height="3.6" rx="0.8" fill="${PAL.chromeD}"/><path d="M${x - 2} ${y - 0.6} H${x + 2} M${x - 2} ${y + 0.4} H${x + 2} M${x - 2} ${y + 1.4} H${x + 2}" stroke="${PAL.chrome}" stroke-width="0.35"/>`);
  }
  if (has('reflex')) {
    // 首筋から背骨へ続く、ピンクに光る増幅器の列
    const [x, y] = A.neckSide;
    let nodes = '';
    for (let i = 0; i < 4; i++) nodes += `<rect x="${x + 8.6}" y="${y - 6 + i * 3.4}" width="2.4" height="2.2" rx="0.5" fill="${PAL.chromeD}" stroke="${PAL.pink}" stroke-width="0.4" ${glowP}/>`;
    out.push(nodes);
  }
  if (has('milplate')) {
    const [x, y] = A.chest;
    let hex = '';
    for (const [dx, dy] of [[-14, -6], [-9, -9], [-9, -3], [-4, -6]]) {
      const cx = x + dx, cy = y + dy;
      hex += `<path d="M${cx - 2.4} ${cy} L${cx - 1.2} ${cy - 2.1} L${cx + 1.2} ${cy - 2.1} L${cx + 2.4} ${cy} L${cx + 1.2} ${cy + 2.1} L${cx - 1.2} ${cy + 2.1} Z" fill="${PAL.chromeD}" stroke="${PAL.chrome}" stroke-width="0.4"/>`;
    }
    out.push(hex);
  }
  if (has('tacai')) {
    // 左目の前に浮かぶ照準の線
    const [x, y] = A.eyeL;
    out.push(`<path d="M${x - 6} ${y - 3.5} H${x + 3} M${x - 6} ${y + 3.5} H${x + 1}" stroke="${PAL.blueL}" stroke-width="0.4" ${glowB}/><circle cx="${x}" cy="${y}" r="3.4" fill="none" stroke="${PAL.blueL}" stroke-width="0.35" stroke-dasharray="1 0.8"/>`);
  }
  if (has('firewall')) {
    const [x, y] = A.neck;
    out.push(`<path d="M${x - 6} ${y + 1} Q${x} ${y + 4} ${x + 6} ${y + 1}" stroke="${PAL.blue}" stroke-width="1" fill="none" ${glowB}/><rect x="${x - 1.2}" y="${y + 1.6}" width="2.4" height="1.6" fill="${PAL.chrome}"/>`);
  }
  if (has('heart')) {
    const [x, y] = A.chest;
    out.push(`<circle cx="${x - 10}" cy="${y + 2}" r="3" fill="${PAL.ink}" stroke="${PAL.chromeM}" stroke-width="0.7"/><path d="M${x - 12.4} ${y + 2} H${x - 11.2} L${x - 10.5} ${y + 0.6} L${x - 9.6} ${y + 3.4} L${x - 8.9} ${y + 2} H${x - 7.6}" stroke="${PAL.pink}" stroke-width="0.5" fill="none" ${glowP}/>`);
  }
  if (has('chameleon')) {
    // 右頬に、周りの色を拾う鱗模様
    const [hx, hy, rx] = A.head;
    let scales = '';
    for (let i = 0; i < 9; i++) scales += `<circle cx="${hx + rx * 0.35 + (i % 3) * 2.2 + (Math.floor(i / 3) % 2) * 1.1}" cy="${hy + 5 + Math.floor(i / 3) * 2}" r="0.9" fill="${PAL.blueL}" opacity="${0.25 + (i % 3) * 0.15}"/>`;
    out.push(scales);
  }
  if (has('emochip')) {
    const [x, y] = A.forehead;
    out.push(`<rect x="${x - 9}" y="${y + 1}" width="3.4" height="1.6" rx="0.4" fill="${PAL.chromeD}"/><rect x="${x - 8.4}" y="${y + 1.4}" width="1" height="0.8" fill="${PAL.pink}" ${glowP}/>`);
  }
  return `<defs>${defs.join('')}</defs>${out.join('')}`;
}

/* 肖像のHTML。opt.cyber / opt.humanity で「入れた後」を描ける。opt.glitch で強いグリッチ（0, 1, 2） */
function portraitImg(r, cls = '', opt = {}) {
  const cyber = opt.cyber || r.cyber || [];
  const hm = typeof maxHum === 'function' && r.base ? maxHum(r) : (r.base ? r.base.EMP : 5) * 10;
  const hum = opt.humanity !== undefined ? opt.humanity : r.humanity;
  const m = Math.max(0, Math.min(1, 1 - hum / hm));
  const glitch = opt.glitch !== undefined ? opt.glitch : hum <= 0 ? 2 : hum <= 15 ? 1 : 0;
  const key = opt.key || portraitKey(r);
  const A = { ...PORTRAIT_ANCHORS, ...(PORTRAIT_ANCHOR_OVERRIDES[key] || {}) };
  return `<span class="pf ${cls}${glitch === 1 ? ' glitchy' : ''}${glitch === 2 ? ' broken' : ''}" style="--m:${m.toFixed(2)}"><img src="${portraitSrc(key)}" alt="" decoding="async"><svg class="ov" viewBox="0 0 100 100" aria-hidden="true">${implantOverlay(cyber, m, A)}</svg></span>`;
}

/* ───────── 企業・勢力のロゴ（currentColor の SVG） ───────── */

const LOGO_PATHS = {
  mitsukane: '<path d="M12 2l4 4-4 4-4-4zM6 11l4 4-4 4-4-4zM18 11l4 4-4 4-4-4z"/>',
  verde: '<path d="M6.3 17.7a4.5 4.5 0 0 1 0-6.4l5-5a4.5 4.5 0 0 1 6.4 6.4l-5 5a4.5 4.5 0 0 1-6.4 0z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9 9l6 6" stroke="currentColor" stroke-width="2.2"/>',
  hakurou: '<circle cx="12" cy="17" r="2.6"/><path d="M12 14V4M7 9a7 7 0 0 1 10 0M4.5 6a10.5 10.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  gang: '<path d="M17 4c-5 0-9 2-9 5s9 2 9 6-4 5-9 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="18" cy="4" r="1.6"/>',
  resident: '<rect x="7" y="5" width="10" height="14" rx="5"/><path d="M12 2v3M10 21h4" stroke="currentColor" stroke-width="2"/>',
  broker: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/>',
  self: '<path d="M12 2l9 5v10l-9 5-9-5V7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke="currentColor" stroke-width="2"/>',
};
function logo(key, cls = '') {
  const p = LOGO_PATHS[key];
  if (!p) return '';
  return `<svg class="logo-mark ${cls} lg-${key}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${p}</svg>`;
}

/* ───────── 夜のヨミハマ（背景の Canvas） ───────── */

const SIGN_WORDS = ['義体', '質', 'ラザロ', '白蛇', '診療', 'ミツカネ', 'ヴェルデ', 'ハクロウ', '酒', '夜市', '電脳', '両替'];

const City = {
  cv: null, c: null, w: 0, h: 0, far: [], near: [], signs: [], drops: [], pat: null,
  mode: 'full', raf: 0, last: 0, t: 0,

  init() {
    this.cv = document.getElementById('city');
    if (!this.cv) return;
    this.c = this.cv.getContext('2d');
    this.resize();
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.resize(), 150); });
    document.addEventListener('visibilitychange', () => this.loop());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.draw());
    this.loop();
  },

  setMode(mode) {
    if (!this.cv || this.mode === mode) return;
    this.mode = mode;
    this.cv.dataset.mode = mode;
    this.loop();
  },

  resize() {
    const w = innerWidth, h = innerHeight;
    this.cv.width = w; this.cv.height = h;
    this.w = w; this.h = h;
    this.build();
    this.draw();
  },

  build() {
    const rnd = mulberry32(20261102);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const w = this.w, h = this.h;
    const hz = Math.round(h * 0.74);
    this.hz = hz;
    this.far = [];
    for (let x = -10; x < w + 10;) {
      const bw = ri(26, 64), bh = ri(Math.round(h * 0.16), Math.round(h * 0.46));
      const wins = [];
      for (let wy = hz - bh + 6; wy < hz - 4; wy += 6) for (let wx = x + 4; wx < x + bw - 4; wx += 5) if (rnd() < 0.22) wins.push([wx, wy, rnd() < 0.7 ? 0 : 1, rnd() * 6.28, 0.3 + rnd()]);
      this.far.push({ x, y: hz - bh, w: bw, h: bh, wins });
      x += bw + ri(0, 4);
    }
    this.near = []; this.signs = [];
    for (let x = -20; x < w + 20;) {
      const bw = ri(40, 96), bh = ri(Math.round(h * 0.1), Math.round(h * 0.3));
      const b = { x, y: hz - bh, w: bw, h: bh, ant: rnd() < 0.3 };
      this.near.push(b);
      if (rnd() < 0.55) {
        const word = SIGN_WORDS[Math.floor(rnd() * SIGN_WORDS.length)];
        const size = ri(12, 17);
        const sh = word.length * (size + 3) + 10;
        this.signs.push({
          x: x + ri(6, Math.max(7, bw - 26)), y: Math.max(20, b.y - ri(0, 18) - (rnd() < 0.5 ? sh * 0.4 : 0)),
          word, size, sw: size + 10, sh, col: rnd() < 0.55 ? PAL.pink : PAL.blue, seed: rnd() * 100, rate: 0.4 + rnd(),
        });
      }
      x += bw + ri(-6, 10);
    }
    const n = Math.round((w * h) / 9000);
    this.drops = Array.from({ length: n }, () => ({ x: rnd() * w, y: rnd() * h, l: 8 + rnd() * 14, v: 0.5 + rnd() * 0.6 }));
    const p = document.createElement('canvas');
    p.width = p.height = 4;
    const pc = p.getContext('2d');
    pc.fillStyle = '#ffffff'; pc.fillRect(1, 1, 1, 1);
    this.pat = this.c.createPattern(p, 'repeat');
  },

  signOn(s, t) {
    const v = Math.sin(t * 0.0013 * s.rate + s.seed) + Math.sin(t * 0.0071 * s.rate + s.seed * 3);
    return v > -1.55;
  },

  draw(t = this.t) {
    const c = this.c, w = this.w, h = this.h, hz = this.hz;
    if (!c) return;
    const sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#04060b'); sky.addColorStop(0.6, '#0c1328'); sky.addColorStop(1, '#2a1230');
    c.fillStyle = sky; c.fillRect(0, 0, w, hz);
    const haze = c.createRadialGradient(w * 0.6, hz, 10, w * 0.6, hz, w * 0.7);
    haze.addColorStop(0, 'rgba(255,79,154,0.22)'); haze.addColorStop(1, 'rgba(255,79,154,0)');
    c.fillStyle = haze; c.fillRect(0, 0, w, hz);

    // 遠景のビルと窓
    c.fillStyle = '#0b1120';
    for (const b of this.far) c.fillRect(b.x, b.y, b.w, b.h);
    for (const b of this.far) for (const [x, y, col, ph, sp] of b.wins) {
      if (Math.sin(t * 0.0004 * sp + ph) < -0.6) continue;
      c.fillStyle = col ? 'rgba(255,79,154,0.5)' : 'rgba(120,165,255,0.45)';
      c.fillRect(x, y, 2, 2);
    }
    // 近景のビル
    for (const b of this.near) {
      c.fillStyle = '#05070d'; c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = 'rgba(63,124,255,0.25)'; c.fillRect(b.x, b.y, b.w, 1);
      if (b.ant) { c.fillStyle = '#05070d'; c.fillRect(b.x + b.w / 2, b.y - 18, 2, 18); if (Math.sin(t * 0.004) > 0) { c.fillStyle = PAL.pink; c.fillRect(b.x + b.w / 2, b.y - 20, 2, 2); } }
    }
    // ネオン看板
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const s of this.signs) {
      const on = this.signOn(s, t);
      c.fillStyle = '#05070d'; c.fillRect(s.x, s.y, s.sw, s.sh);
      c.strokeStyle = on ? s.col : 'rgba(80,90,110,0.5)'; c.lineWidth = 1.5;
      c.shadowColor = s.col; c.shadowBlur = on ? 14 : 0;
      c.strokeRect(s.x + 0.5, s.y + 0.5, s.sw - 1, s.sh - 1);
      c.fillStyle = on ? s.col : 'rgba(80,90,110,0.6)';
      c.font = `${s.size}px "Dela Gothic One", "Hiragino Sans", sans-serif`;
      [...s.word].forEach((ch, i) => c.fillText(ch, s.x + s.sw / 2, s.y + 5 + i * (s.size + 3)));
      c.shadowBlur = 0;
    }
    // 湾と映り込み
    const sea = c.createLinearGradient(0, hz, 0, h);
    sea.addColorStop(0, '#0a0d1a'); sea.addColorStop(1, '#030409');
    c.fillStyle = sea; c.fillRect(0, hz, w, h - hz);
    for (const s of this.signs) {
      if (!this.signOn(s, t)) continue;
      c.fillStyle = s.col;
      for (let y = hz + 2; y < h; y += 2) {
        const a = 0.3 * (1 - (y - hz) / (h - hz));
        if (a <= 0.02) break;
        c.globalAlpha = a;
        const off = Math.sin(y * 0.07 + t * 0.002 + s.seed) * 2.5;
        c.fillRect(s.x + off + s.sw * 0.25, y, s.sw * 0.5, 1.4);
      }
    }
    c.globalAlpha = 1;
    // 雨
    c.strokeStyle = 'rgba(156,192,255,0.22)'; c.lineWidth = 1;
    c.beginPath();
    for (const d of this.drops) { c.moveTo(d.x, d.y); c.lineTo(d.x - d.l * 0.25, d.y + d.l); }
    c.stroke();
    // 網点と周辺減光
    if (this.pat) { c.globalAlpha = 0.05; c.fillStyle = this.pat; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  },

  step(now) {
    this.raf = requestAnimationFrame((n) => this.step(n));
    const fps = this.mode === 'full' ? 30 : 10;
    if (now - this.last < 1000 / fps) return;
    const dt = Math.min(100, now - (this.last || now));
    this.last = now; this.t = now;
    for (const d of this.drops) {
      d.y += d.v * dt * 0.9; d.x -= d.v * dt * 0.2;
      if (d.y > this.h) { d.y = -d.l; d.x = Math.random() * (this.w + 60); }
    }
    this.draw(now);
  },

  loop() {
    cancelAnimationFrame(this.raf);
    if (!this.cv || ART_REDUCED || document.hidden) { this.draw(); return; }
    this.raf = requestAnimationFrame((n) => this.step(n));
  },
};

/* ───────── カットイン ───────── */

let cutinTimer = 0;
function cutin({ kicker = '', title = '', sub = '', tone = 'pink', por = '' }) {
  const fx = document.getElementById('fx');
  if (!fx || ART_REDUCED) return;
  clearTimeout(cutinTimer);
  fx.innerHTML = `<div class="cutin tone-${tone}">
    <div class="ci-band">${por || ''}<div class="ci-text"><span class="ci-kick">${kicker}</span><b data-t="${title}">${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>
  </div>`;
  fx.hidden = false;
  cutinTimer = setTimeout(() => { fx.hidden = true; fx.innerHTML = ''; }, 2300);
}
