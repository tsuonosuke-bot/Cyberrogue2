/* 仮の肖像（SVG）を assets/portraits/ に書き出す。
   使い方: node tools/make-placeholders.js
   本番の絵に差し替えたファイルは上書きしない（--force を付けたときだけ上書きする）。
   目・首・腕などの位置は js/art.js の PORTRAIT_ANCHORS の既定値と揃えてある。 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'portraits');
const FORCE = process.argv.includes('--force');

const ROLE_NAMES = { solo: 'ソロ', net: 'ネットランナー', tech: 'テック', med: 'メドテック', driver: 'ドライバー' };
const GENDER_NAMES = { m: '男性', f: '女性', x: 'その他' };
const SKINS = [
  ['#f1d6d3', '#c99aa0'], ['#e3bca8', '#b08070'], ['#c39079', '#8d5f50'], ['#8f6352', '#5e3d33'], ['#ead2c4', '#b9928a'],
];
const HAIRS = ['#10131c', '#2a3f8f', '#ff4f9a', '#e9ebee', '#6f9dff', '#3a2a35'];
const CLOTH = { solo: '#10131c', net: '#1e3f8a', tech: '#4a556b', med: '#d9dde5', driver: '#0f1320' };

function hairBack(g, v, col) {
  if (g === 'f' && v === 1) return `<path d="M32 36 C30 14 70 14 68 36 L71 72 L60 67 L60 46 L40 46 L40 67 L29 72 Z" fill="${col}"/>`;
  if (g === 'f' && v === 2) return `<path d="M32 38 C30 14 70 14 68 38 L67 55 L58 52 L58 44 L42 44 L42 52 L33 55 Z" fill="${col}"/>`;
  if (g === 'x' && v === 1) return `<path d="M60 22 C70 26 70 40 68 58 L62 56 L64 34 Z" fill="${col}"/>`;
  return '';
}
function hairFront(g, v, col) {
  if (g === 'm' && v === 1) return `<path d="M35 34 C34 17 45 13 52 14 C62 15 67 23 65 34 C62 27 56 24 50 24 C43 24 38 28 35 34 Z" fill="${col}"/>`;
  if (g === 'm' && v === 2) return `<path d="M35 31 C36 16 64 14 66 30 C60 22 52 21 44 22 C40 23 37 26 35 31 Z" fill="${col}"/><path d="M35 33 L35 40 M37 31 L37 38" stroke="${col}" stroke-width="0.8" opacity=".6"/>`;
  if (g === 'f' && v === 1) return `<path d="M35 34 C36 19 64 19 65 34 C58 26 44 26 35 34 Z" fill="${col}"/>`;
  if (g === 'f' && v === 2) return `<path d="M34 33 C35 18 65 18 66 33 L66 31 L34 31 Z" fill="${col}"/><rect x="34" y="27" width="32" height="5" fill="${col}"/>`;
  if (g === 'x' && v === 1) return `<path d="M34 33 C35 17 62 13 67 30 L66 44 C62 35 54 30 44 29 C40 29 36 31 34 33 Z" fill="${col}"/><path d="M38 50 L44 56 M62 50 L57 56" stroke="#8b97ad" stroke-width="0.6"/>`;
  if (g === 'x' && v === 2) return `<path d="M36 30 C38 20 62 20 64 30" fill="none" stroke="#6f9dff" stroke-width="0.7"/><path d="M40 26 L44 22 L48 24 M60 26 L56 22" fill="none" stroke="#6f9dff" stroke-width="0.6"/><path d="M38 50 L44 56 M62 50 L57 56" stroke="#8b97ad" stroke-width="0.6"/>`;
  return '';
}
function roleBack(role) {
  if (role === 'net') return '<path d="M29 46 C26 14 74 14 71 46 L75 72 L62 67 C67 56 67 34 50 28 C33 34 33 56 38 67 L25 72 Z" fill="#1e3f8a"/><path d="M29 46 C26 14 74 14 71 46" fill="none" stroke="#6f9dff" stroke-width="0.8"/>';
  return '';
}
function roleFront(role) {
  if (role === 'solo') return '<path d="M30 72 L42 60 L45 74 Z M70 72 L58 60 L55 74 Z" fill="#05070d"/><path d="M42 60 L45 74 M58 60 L55 74" stroke="#ff4f9a" stroke-width="0.8"/>';
  if (role === 'tech') return '<rect x="35" y="25" width="30" height="4.5" rx="2" fill="#4a556b"/><circle cx="43" cy="27.3" r="3.4" fill="#1e3f8a" stroke="#d2d9e6" stroke-width="0.8"/><circle cx="57" cy="27.3" r="3.4" fill="#1e3f8a" stroke="#d2d9e6" stroke-width="0.8"/><circle cx="42" cy="26.3" r="0.9" fill="#9cc0ff"/><circle cx="56" cy="26.3" r="0.9" fill="#9cc0ff"/>';
  if (role === 'med') return '<path d="M37 68 L50 86 L63 68 L67 72 L50 100 L33 72 Z" fill="#f4f5f8"/><rect x="40" y="55" width="20" height="5.5" rx="2" fill="#e9ebee" opacity=".92"/><path d="M76 80 h4 v-4 h3 v4 h4 v3 h-4 v4 h-3 v-4 h-4 z" fill="#ff4f9a"/>';
  if (role === 'driver') return '<rect x="35" y="37" width="30" height="6" rx="3" fill="#ff4f9a" opacity=".88"/><rect x="37" y="38" width="9" height="1.2" rx=".6" fill="#ffd0e3"/><path d="M8 88 C30 78 70 78 92 88" fill="none" stroke="#6f9dff" stroke-width="2"/>';
  return '';
}

function face({ role, gender, variant, skin, hair, accent, label, extra = '' }) {
  const [sl, sd] = skin;
  const cloth = CLOTH[role];
  const browCol = hair === '#e9ebee' ? sd : hair;
  const lips = gender === 'f' ? '#c2477e' : '#8a3f5c';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#1b0f25"/></linearGradient>
<pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.45" fill="#1f2b4c"/></pattern>
<linearGradient id="skin" x1="0" x2="1"><stop offset="0.35" stop-color="${sl}"/><stop offset="1" stop-color="${sd}"/></linearGradient>
</defs>
<rect width="100" height="100" fill="url(#bg)"/>
<rect width="100" height="100" fill="url(#dots)"/>
<circle cx="72" cy="28" r="28" fill="${accent}" opacity=".13"/>
${roleBack(role)}
${hairBack(gender, variant, hair)}
<path d="M8 100 C10 80 26 70 40 67 L60 67 C74 70 90 80 92 100 Z" fill="${cloth}"/>
<rect x="43" y="52" width="14" height="17" rx="3" fill="${sd}"/>
<ellipse cx="34.5" cy="41" rx="2.6" ry="4" fill="${sd}"/>
<ellipse cx="65.5" cy="41" rx="2.6" ry="4" fill="${sd}"/>
<ellipse cx="50" cy="38" rx="15" ry="19" fill="url(#skin)"/>
<path d="M39 35.5 L46 35" stroke="${browCol}" stroke-width="1.3" stroke-linecap="round"/>
<path d="M54 35 L61 35.5" stroke="${browCol}" stroke-width="1.3" stroke-linecap="round"/>
<ellipse cx="43" cy="40" rx="2.7" ry="1.7" fill="#0a0d14"/>
<ellipse cx="57" cy="40" rx="2.7" ry="1.7" fill="#0a0d14"/>
<circle cx="42.2" cy="39.4" r="0.6" fill="#e9ebee"/>
<circle cx="56.2" cy="39.4" r="0.6" fill="#e9ebee"/>
<path d="M50 42 L48.6 47 L50.8 47.4" fill="none" stroke="${sd}" stroke-width="0.9" stroke-linecap="round"/>
<path d="M45.5 51 Q50 53 54.5 51" fill="none" stroke="${lips}" stroke-width="1.2" stroke-linecap="round"/>
${hairFront(gender, variant, hair)}
${roleFront(role)}
${extra}
<path d="M62 24 C67 30 67 46 61 54" fill="none" stroke="${accent}" stroke-width="0.9" opacity=".75"/>
<rect x="2" y="92.5" width="${label.length * 3.1 + 4}" height="5.5" fill="#05070d" opacity=".75"/>
<text x="4" y="96.7" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="3.2" fill="#9aa2b1">${label}</text>
</svg>
`;
}

const STORY = {
  kagerou: { role: 'net', gender: 'x', variant: 1, skin: SKINS[4], hair: '#e9ebee', accent: '#6f9dff', name: 'カゲロウ',
    extra: '<path d="M40 44 L46 44 M54 44 L60 44" stroke="#6f9dff" stroke-width="0.5" opacity=".7"/>' },
  yoru: { role: 'solo', gender: 'm', variant: 1, skin: SKINS[2], hair: '#10131c', accent: '#ff4f9a', name: 'ヨル',
    extra: '<path d="M58 44 L62 50 L59 52" fill="none" stroke="#5e2a3c" stroke-width="0.9"/>' },
  haruka: { role: 'med', gender: 'f', variant: 2, skin: SKINS[1], hair: '#3a2a35', accent: '#ff4f9a', name: 'ハルカ',
    extra: '<circle cx="50" cy="15" r="6" fill="#3a2a35"/><rect x="38" y="37.5" width="9" height="5" rx="1.5" fill="none" stroke="#d2d9e6" stroke-width="0.7"/><rect x="53" y="37.5" width="9" height="5" rx="1.5" fill="none" stroke="#d2d9e6" stroke-width="0.7"/>' },
  shigure: { role: 'driver', gender: 'f', variant: 1, skin: SKINS[0], hair: '#ff4f9a', accent: '#ff4f9a', name: 'シグレ',
    extra: '<path d="M60 46 L66 44" stroke="#ff4f9a" stroke-width="0.6" opacity=".8"/><circle cx="64" cy="60" r="1.6" fill="none" stroke="#d2d9e6" stroke-width="0.6"/>' },
  mikoto: { role: 'tech', gender: 'x', variant: 2, skin: SKINS[4], hair: '#e9ebee', accent: '#6f9dff', name: 'ミコト',
    extra: '<path d="M50 20 V58" stroke="#6f9dff" stroke-width="0.4" stroke-dasharray="1.2 1" opacity=".7"/>' },
};

function write(name, svg) {
  const file = path.join(OUT, `${name}.svg`);
  if (fs.existsSync(file) && !FORCE) {
    const old = fs.readFileSync(file, 'utf8');
    if (!old.includes('<!-- placeholder -->')) { console.log(`skip ${name}.svg (差し替え済み)`); return; }
  }
  fs.writeFileSync(file, svg.replace('<defs>', '<!-- placeholder -->\n<defs>'));
}

fs.mkdirSync(OUT, { recursive: true });
let i = 0;
for (const role of Object.keys(ROLE_NAMES)) {
  for (const gender of Object.keys(GENDER_NAMES)) {
    for (const variant of [1, 2]) {
      const skin = SKINS[(i * 3 + variant) % SKINS.length];
      const hair = HAIRS[(i + variant * 2) % HAIRS.length];
      const accent = (i + variant) % 2 ? '#ff4f9a' : '#6f9dff';
      const label = `仮 ・ ${ROLE_NAMES[role]} ・ ${GENDER_NAMES[gender]} ・ ${variant}`;
      write(`${role}-${gender}-${variant}`, face({ role, gender, variant, skin, hair, accent, label }));
    }
    i++;
  }
}
for (const [key, s] of Object.entries(STORY)) {
  write(key, face({ ...s, label: `仮 ・ ${s.name}（物語つき）` }));
}
console.log(`wrote placeholders to ${OUT}`);
