/* FIXER'S CUT — 状態、d10判定、夜の進行 */

/* キャンペーン版（fixers-cut-save-v1）とは別の保存先。ラン中の保存は夜が明けるたびに上書きする */
const SAVE_KEY = 'fixers-cut-run-v2'; // 1幕10夜の地図にしたときに上げた。前の版の遊びかけのランは読まない
/* ラザロの加入料（1人1回。上のプランに替えるときは差額だけ払う） */
const LAZARUS_FEE = 600;
/* ラザロの上位プラン（武装回収）。第2幕から。加入料、出動費、回収班の射撃の腕前（＋d10で敵のDVと比べる） */
const LAZARUS_ARMED = { fee: 2000, callout: 1500, aim: 15, act: 2 };
const ROSTER_MAX = 4;
/* 隊の人数。臨時雇いは数えない */
const crewSize = () => G.runners.filter((r) => !r.temp).length;
const LANE = { field: '現場', support: '支援', net: 'ネット' };
const LANE_MAX = { field: 3, support: 2, net: 1 };
/* 通常兵の基準値。ランク2の依頼は交戦ごとに enemyDV を持つ（data.js）。
   ランでは、その幕のなかで夜が進むほど敵のDV・攻撃が上がる（Run.threat、幕の頭は+0、大仕事の夜は+2） */
const RANK_ENEMY = {
  1: { dv: 17, atk: 16, dice: 3, plus: 2 },
  2: { dv: 18, atk: 16, dice: 3, plus: 3 },
  3: { dv: 19, atk: 18, dice: 4, plus: 3 },
};
const ROLE_CYBER = {
  solo: ['arm', 'arm2', 'optics', 'optics2', 'synapse', 'reflex', 'reflex3', 'plating', 'milplate', 'plating3', 'painblock', 'heart', 'heart2'],
  net: ['jack', 'jack2', 'coproc', 'coproc2', 'ears', 'ears2', 'painblock', 'firewall', 'tacai', 'tacai2'],
  tech: ['toolfinger', 'toolfinger2', 'coproc', 'coproc2', 'plating', 'milplate', 'ears', 'ears2', 'tacai', 'tacai2', 'chameleon'],
  med: ['medkit', 'coproc', 'coproc2', 'plating', 'milplate', 'voice', 'voice2', 'heart', 'heart2', 'emochip'],
  driver: ['steering', 'steering2', 'synapse', 'reflex', 'plating', 'milplate', 'optics', 'optics2'],
};

const rnd = Math.random;
const d = (n) => 1 + Math.floor(rnd() * n);
const roll = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += d(s); return t; };
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let G = null;

/* ───────── ランナー ───────── */

function cyberMods(r) {
  const m = {};
  for (const id of r.cyber) for (const k in CYBER[id].mods) m[k] = (m[k] || 0) + CYBER[id].mods[k];
  return m;
}
function gearMods(r) {
  const m = {};
  for (const id of Object.values(r.gear || {})) if (GEAR[id]) for (const k in GEAR[id].mods) m[k] = (m[k] || 0) + GEAR[id].mods[k];
  return m;
}
const allMods = (r) => { const m = cyberMods(r), g = gearMods(r); for (const k in g) m[k] = (m[k] || 0) + g[k]; return m; };
const stat = (r, k) => r.base[k] + (allMods(r)[k] || 0);
const skill = (r, k) => Math.max(0, (r.skills[k] || 0) + (allMods(r)[k] || 0));
const maxHp = (r) => 11 + stat(r, 'BODY') * 4;
const traitOf = (r) => TRAITS[r.trait] || {};
const maxHum = (r) => traitOf(r).humCap || r.base.EMP * 10 + (traitOf(r).humBonus || 0);
/* 義体の人間性コスト。資質で軽くなる */
/* ラン中に持っているコネ（data.js の CONNECTIONS） */
const cone = (k) => !!(G && G.run && (G.run.cones || []).includes(k));
const hlCost = (r, c) => Math.max(1, Math.round(CYBER[c].hl * (traitOf(r).hlMult || 1)) - (G && G.run && G.run.bg === 'ripper' ? 1 : 0) - (cone('brokenConscience') ? 1 : 0)); // 闇医者のツテ・壊れた良心は−1
/* 型。ランナーが持つ品の型を全部並べる（2つ持つ品は両方） */
const typesOf = (r) => [...r.cyber.flatMap((c) => CYBER[c].types || []), ...Object.values(r.gear || {}).flatMap((id) => (GEAR[id] && GEAR[id].types) || []), ...((TRAITS[r.trait] && TRAITS[r.trait].types) || [])];
function countTypes(list) {
  const c = {};
  for (const t of list) c[t] = (c[t] || 0) + 1;
  return c;
}
/* その依頼に送り出した人の型が n 以上あるか。大仕事のボスが耐性を持つ型は効かない */
function typeOn(ctx, t, n) {
  const B = ctx.job.runBoss && typeof ctx.job.boss === 'string' && RUN_BOSSES[ctx.job.boss];
  if (B && B.resist === t) return false;
  // 危険度1から：大仕事のボスは、送り出した人にいちばん多い型にも耐性を持つ
  if (B && G && G.run && G.run.danger >= 1) { const c = ctx.types || {}, top = Object.keys(c).sort((x, y) => c[y] - c[x])[0]; if (top === t) return false; }
  return ((ctx.types || {})[t] || 0) >= n;
}
const cyberLine = (c) => CYBER[c].line || c;
/* 義体の枠（ラン中だけ）。部位ごとに2つ、体表だけ1つ。同じ系統の上位モデルは入れ替わるので枠を使わない */
const CYBER_SLOTS = { nervous: 2, brain: 2, senses: 2, arms: 2, skin: 1, organs: 2 };
const slotUse = (r, cat) => r.cyber.filter((x) => CYBER[x].cat === cat).length;
const slotFull = (r, c) => !!(G && G.run) && !r.cyber.some((x) => cyberLine(x) === cyberLine(c)) && slotUse(r, CYBER[c].cat) >= CYBER_SLOTS[CYBER[c].cat];
/* 枠がいっぱいのとき、外せば入れられる義体（同じ部位に入っているもの） */
const swapChoices = (r, c) => (slotFull(r, c) ? r.cyber.filter((x) => CYBER[x].cat === CYBER[c].cat) : []);
/* そのロールに合う系統か（ROLE_CYBER に同じ系統のモデルがあるか） */
const cyberFits = (r, c) => ROLE_CYBER[r.role].some((x) => cyberLine(x) === cyberLine(c)) || (CYBER[c].roles || []).includes(r.role);
/* 同じ系統の上位モデルは下位モデルと入れ替わる。入れられないときは理由を返す。drop は代わりに外す義体 */
function cyberBlocker(r, c, drop) {
  if (r.cyber.includes(c)) return 'もう入っています';
  const same = r.cyber.find((x) => cyberLine(x) === cyberLine(c));
  if (same && CYBER[same].tier >= CYBER[c].tier) return '同じ系統の上位モデルが入っています';
  if (slotFull(r, c) && !swapChoices(r, c).includes(drop)) return `${CYBER_CATS[CYBER[c].cat]}の枠がいっぱいです（${CYBER_SLOTS[CYBER[c].cat]}つまで）`;
  return null;
}
/* 入れたときに減る人間性（換装なら差の分） */
function cyberHumanityDelta(r, c) {
  const same = r.cyber.find((x) => cyberLine(x) === cyberLine(c));
  return hlCost(r, c) - (same ? hlCost(r, same) : 0);
}
const armorMax = (r) => r.armorBase + (allMods(r).armor || 0);

/* 使った技能は少しずつ伸びる。12夜で伸びが見えるよう、素の技能 n→n+1 に n+1 回（最低2回）の判定が要る（上限10） */
const SKILL_CAP = 10;
const xpNeed = (raw, r) => Math.max(2, raw + 1 - ((r && traitOf(r).xpBonus) || 0));
function gainXp(r, sk, n) {
  r.xp ||= {};
  const ups = [];
  r.xp[sk] = (r.xp[sk] || 0) + n;
  while ((r.skills[sk] || 0) < SKILL_CAP && r.xp[sk] >= xpNeed(r.skills[sk] || 0, r)) {
    r.xp[sk] -= xpNeed(r.skills[sk] || 0, r);
    r.skills[sk] = (r.skills[sk] || 0) + 1;
    ups.push(r.skills[sk]);
  }
  if ((r.skills[sk] || 0) >= SKILL_CAP) r.xp[sk] = 0;
  return ups;
}
/* 本業の技能：ロールの技能表でいちばん高い上限を持つもの */
const mainSkill = (role) => Object.entries(ROLES[role].skills).sort((a, b) => b[1][1] - a[1][1])[0][0];
const getR = (id) => G.runners.find((r) => r.id === id);
const available = (r) => r.status === 'idle' && r.hp > 0;

function power(r) {
  let best = 0;
  for (const k of SKILLS) best = Math.max(best, stat(r, SKILL_STAT[k]) + skill(r, k));
  return best;
}
function humZone(h) {
  if (h <= 0) return { key: 'gone', name: '喪失' };
  if (h <= 15) return { key: 'sign', name: '兆候' };
  if (h <= 30) return { key: 'unstable', name: '不安定' };
  return { key: 'stable', name: '安定' };
}

function usedNames() {
  const s = new Set();
  if (!G) return s;
  for (const r of G.runners) s.add(r.name);
  for (const r of G.scouts) s.add(r.name);
  for (const r of G.memorial) s.add(r.name);
  return s;
}
function freshName() {
  const used = usedNames();
  const free = NAMES.filter((n) => !used.has(n));
  return free.length ? pick(free) : pick(NAMES) + rint(2, 9);
}

function pickGender() {
  const x = rnd();
  return x < 0.42 ? 'm' : x < 0.84 ? 'f' : 'x';
}

const genBio = (origin) => pick(BIOS[origin].past) + pick(BIOS[origin].quirk);
/* mult は出やすさの倍率（報酬のランナーは幕が進むほど上がる） */
function rollTrait(mult = 1) {
  let x = rnd();
  for (const [k, p] of TRAIT_ODDS) { if (x < p * mult) return k; x -= p * mult; }
  return null;
}

function makeRunner(role, opt = {}) {
  const R = ROLES[role];
  const origin = opt.origin || pick(Object.keys(ORIGINS));
  const O = ORIGINS[origin];
  const base = {};
  for (const k of STATS) base[k] = opt.base ? opt.base[k] : clamp(rint(...R.base[k]) + (O.mods[k] || 0), 2, 10);
  const skills = {};
  for (const k of SKILLS) skills[k] = 0;
  if (opt.skills) Object.assign(skills, opt.skills);
  else {
    for (const k in R.skills) skills[k] = rint(...R.skills[k]);
    for (const k in O.skills) skills[k] = Math.min(10, skills[k] + O.skills[k]);
  }
  const contact = opt.contact || (origin === 'corp' ? pick(CORPS) : origin === 'street' ? 'gang' : 'resident');
  const r = {
    id: G.nextId++, name: opt.name || freshName(), gender: opt.gender || pickGender(), role, origin, contact, base, skills,
    cyber: (opt.cyber || []).slice(), gear: {}, xp: {}, armorBase: R.armor, story: opt.story || null, bio: opt.bio || genBio(origin),
    trait: opt.trait !== undefined ? opt.trait : opt.story ? null : rollTrait(opt.traitMult),
    lazarus: false,
    status: 'idle', therapy: 0, elite: 0, perk: false, jobs: 0, kills: 0, joined: G.night,
  };
  r.hp = maxHp(r);
  r.armor = armorMax(r);
  r.humanity = maxHum(r) - r.cyber.reduce((s, c) => s + hlCost(r, c), 0);
  return r;
}

function makeStory(key) {
  const s = STORY_RUNNERS[key];
  return makeRunner(s.role, { ...s, story: key });
}

/* ───────── 新規ゲーム・保存 ───────── */

/* bg は前歴（run.js の BACKGROUNDS）。opt.corp は企業の元社員の社、opt.roles は寄せ集めの3人のロール */
function newGame(bg = 'solo', opt = {}) {
  G = {
    v: 2, night: 1, money: 3000, negStreak: 0, cred: 0, rank: 1,
    heat: { mitsukane: 5, verde: 5, hakurou: 5 },
    chapter: 'handover', chapterLog: ['handover'], chapterSince: 1, awaitChoice: null, successes: 0, flags: {}, runners: [], scouts: [], board: [], missions: [], memorial: [],
    repeats: {}, vouchers: { cyber: 0, intel: 0 }, pending: [], archive: [], nextId: 1,
    storyQueue: ['intro'], awaitEnding: false, ended: null, lastReport: null,
  };
  Run.crew(bg, opt);
  World.init(G);
  World.nextNight();
  Run.start(G, bg, opt);
  return G;
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* 保存できない環境では無視 */ }
}
/* 古いセーブの章を今の章のキーに読み替える。
   番号で持っていた頃（1〜5）と、分岐を入れる前のキー（cargo・coordinator）は、
   元の筋書きと同じ依頼が並ぶハクロウの分岐として続ける */
const CHAPTER_BY_NO = { 1: 'handover', 2: 'cipher', 3: 'cargo_hakurou', 4: 'coordinator_hakurou', 5: 'dawn' };
const CHAPTER_RENAMED = { cargo: 'cargo_hakurou', coordinator: 'coordinator_hakurou' };
function migrateChapters(g) {
  const key = (k) => CHAPTER_RENAMED[k] || k;
  if (typeof g.chapter === 'number') {
    g.chapterLog = Object.keys(CHAPTER_BY_NO).filter((n) => +n <= g.chapter).map((n) => CHAPTER_BY_NO[n]);
    g.chapter = CHAPTER_BY_NO[g.chapter] || 'handover';
  }
  g.chapter = key(g.chapter);
  g.chapterLog = (g.chapterLog || [g.chapter]).map(key);
  g.chapterSince ??= g.night;
  g.awaitChoice ??= null;
  for (const n of [2, 3, 4, 5]) if (g.flags['camp' + n]) { g.flags['done_' + CHAPTER_BY_NO[n]] = true; delete g.flags['camp' + n]; }
  for (const [from, to] of Object.entries(CHAPTER_RENAMED)) if (g.flags['done_' + from]) { g.flags['done_' + to] = true; delete g.flags['done_' + from]; }
  for (const j of [...g.board, ...g.missions.map((m) => m.job)]) {
    if (typeof j.campaign === 'number') j.campaign = CHAPTER_BY_NO[j.campaign];
    if (j.campaign) j.campaign = key(j.campaign);
  }
  if (!g.flags.ally && g.chapterLog.some((k) => CHAPTERS[k] && CHAPTERS[k].ally)) g.flags.ally = 'hakurou';
}

/* 古いセーブに足りない項目を補う */
function migrate(g) {
  migrateChapters(g);
  const story = { kagerou: 'x', yoru: 'm', haruka: 'f' };
  for (const r of [...g.runners, ...g.scouts]) {
    r.gear ||= {};
    r.xp ||= {};
    r.trait ??= null;
    if (r.lazarus === true) r.lazarus = 'basic'; // ラザロのプランを入れる前の保存データ
    // 系統を入れる前に同じ系統を重ねて入れていたら、いちばん上のモデルだけ残す（人間性はそのまま）
    r.cyber = r.cyber.filter((c) => !r.cyber.some((x) => x !== c && cyberLine(x) === cyberLine(c) && CYBER[x].tier > CYBER[c].tier));
    if (r.gender) continue;
    let h = 0;
    for (const ch of r.name + r.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    r.gender = story[r.story] || ['m', 'f', 'x'][h % 3];
  }
  return g;
}

/* 読み込みに失敗した保存データは消さずに残し、loadError に理由を置く（タイトルで知らせる） */
let loadError = null;
const rawSave = () => { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } };
function loadSave() {
  loadError = null;
  const s = rawSave();
  if (!s) return null;
  try {
    const g = JSON.parse(s);
    if (g && g.v === 2 && g.run && !g.ended) { World.init(g); return migrate(g); }
  } catch (e) { loadError = e.message || String(e); }
  return null;
}
/* 消す前に、直前の保存データを予備として残す */
const BACKUP_KEY = SAVE_KEY + '-backup';
function clearSave() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) localStorage.setItem(BACKUP_KEY, s); } catch (e) { /* noop */ }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
}

/* ───────── スカウトと依頼盤 ───────── */

function refreshScouts(opt = {}) {
  G.scouts = [];
  const hiredOrGone = (k) => G.runners.some((r) => r.story === k) || G.memorial.some((r) => r.story === k) || G.flags['story_' + k];
  if (reached('cipher') && !hiredOrGone('kagerou')) G.scouts.push(makeStory('kagerou'));
  else if (G.night >= 3 && rnd() < 0.35) {
    const k = pick(['yoru', 'haruka', 'shigure', 'mikoto'].filter((x) => !hiredOrGone(x)));
    if (k) G.scouts.push(makeStory(k));
  }
  // 隊にいないロールを先に出す（pop は末尾から取る）
  const have = new Set(G.runners.map((r) => r.role));
  const roles = [...shuffle(Object.keys(ROLES).filter((k) => have.has(k))), ...shuffle(Object.keys(ROLES).filter((k) => !have.has(k)))];
  while (G.scouts.length < 3) G.scouts.push(makeRunner(roles.pop(), { ...World.scoutOptions(), ...opt }));
}

const hasJob = (tplId) => G.board.some((j) => j.tpl === tplId) || G.missions.some((m) => m.job.tpl === tplId);

function addJob(tpl, special) {
  const j = clone(tpl);
  j.uid = G.nextId++;
  j.tpl = tpl.id;
  World.prepareJob(j);
  j.special = !!special;
  j.expires = special ? 9999 : G.night + rint(2, 3);
  j.intel = false;
  const cnt = G.repeats[tpl.id] || 0;
  j.repeat = cnt;
  if (!special && cnt >= 2) j.payout = Math.round((tpl.payout * Math.pow(0.8, cnt - 1)) / 50) * 50;
  G.board.push(j);
  return j;
}

/* ───────── 章 ───────── */

/* 章の条件の種類。label は隠れ家の進み具合に出す文 */
const REQS = {
  successes: { met: (n) => G.successes >= n, label: (n) => `依頼の成功 ${Math.min(n, G.successes)}/${n}` },
  rank: { met: (n) => G.rank >= n, label: (n) => `評判ランク${n}（今は${G.rank}、評判 ${G.cred}/${RANK_CRED[n - 1]} で顔役の紹介依頼が出る）` },
  netInterface: { met: (n) => G.runners.some((r) => r.role === 'net' && skill(r, 'インターフェース') >= n), label: (n) => `インターフェース${n}以上のネットランナー` },
  chapterNights: { met: (n) => G.night - G.chapterSince >= n, label: (n) => `手がかりを洗う ${clamp(G.night - G.chapterSince, 0, n)}/${n}夜` },
};
const reqList = (reqs) => Object.entries(reqs || {}).map(([k, n]) => ({ ok: REQS[k].met(n), text: REQS[k].label(n) }));
const reqsMet = (reqs) => reqList(reqs).every((x) => x.ok);
const chapter = () => CHAPTERS[G.chapter];
const reached = (key) => G.chapterLog.includes(key);

/* next が { ally: {...} } なら、手を組んだ社で次の章が決まる */
function nextChapter(ch) {
  return typeof ch.next === 'string' ? ch.next : ch.next.ally[G.flags.ally] || Object.values(ch.next.ally)[0];
}

function enterChapter(key, out) {
  G.chapter = key;
  G.chapterSince = G.night;
  if (!reached(key)) G.chapterLog.push(key);
  out.story.push(key);
}

/* 分岐の選択。手を組んだ社のヒートは下がり、残りの二社は上がる */
const ALLY_HEAT = { ally: -30, others: 10 };
function chooseBranch(i) {
  const ch = CHAPTERS[G.awaitChoice];
  const o = ch && ch.choice.options[i];
  if (!o) return '選択肢が見つかりません';
  if (G.run && G.run.corp && o.ally !== G.run.corp) return `${CLIENTS[G.run.corp].short}と組むことは、始めから決まっています`;
  G.awaitChoice = null;
  G.flags.ally = o.ally;
  for (const c of CORPS) G.heat[c] = clamp(G.heat[c] + (c === o.ally ? ALLY_HEAT.ally : ALLY_HEAT.others), 0, 100);
  const out = { story: [] };
  enterChapter(o.next, out);
  G.storyQueue.push(...out.story);
  return null;
}

/* ───────── 編成 ───────── */

const teamIds = (t) => [...t.field, ...t.support, ...t.net];

function validateTeam(job, team) {
  if (!team || !['field', 'support', 'net'].every((k) => Array.isArray(team[k]))) return ['編成が正しくありません'];
  const errs = [], ids = teamIds(team);
  if (new Set(ids).size !== ids.length) errs.push('同じランナーを複数の枠には入れられません');
  if (ids.some((id) => !getR(id))) errs.push('離脱済みのランナーが含まれています');
  for (const lane of ['field', 'support', 'net']) if (team[lane].length > LANE_MAX[lane]) errs.push(`${LANE[lane]}の枠が上限を超えています`);
  if (team.net.some((id) => getR(id) && getR(id).role !== 'net')) errs.push('ネット枠にはネットランナーが必要です');
  if(job.runnerId && !teamIds(team).includes(job.runnerId)) errs.push('個人依頼には本人の参加が必要です');
  if (!team.field.length) errs.push('現場に1人以上必要です');
  const all = teamIds(team).map(getR).filter(Boolean);
  if (all.some((r) => !available(r))) errs.push('出せないランナーが含まれています');
  for (const role of job.req) {
    if (role === 'net') { if (!team.net.length) errs.push('ネット枠にネットランナーが必要です'); }
    else if (!all.some((r) => r.role === role)) errs.push(`${ROLES[role].name}が必要です`);
  }
  return errs;
}

function snap(r) {
  const st = {}, sk = {};
  for (const k of STATS) st[k] = stat(r, k);
  for (const k of SKILLS) sk[k] = skill(r, k);
  const gm = gearMods(r), gearOf = {};
  for (const id of Object.values(r.gear || {})) if (GEAR[id]) for (const k in GEAR[id].mods) if (GEAR[id].mods[k] > 0) gearOf[k] = GEAR[id].name;
  return {
    id: r.id, name: r.name, role: r.role, st, sk, hp: r.hp, maxHp: maxHp(r), armor: r.armor, armorMax: armorMax(r),
    cy: cyberMods(r), gm, gearOf, ap: Object.values(r.gear || {}).some((id) => GEAR[id] && GEAR[id].ap),
    pain: r.cyber.includes('painblock'), medkit: r.cyber.includes('medkit'),
    heart: r.cyber.includes('heart2') ? 3 : r.cyber.includes('heart') ? 2 : 0, firewall: r.cyber.includes('firewall'),
    iceguard: Object.values(r.gear || {}).some((id) => GEAR[id] && GEAR[id].iceguard),
    nonlethal: Object.values(r.gear || {}).some((id) => GEAR[id] && GEAR[id].nonlethal),
    perk: r.perk ? ROLES[r.role].perk.id : null, lazarus: r.lazarus, humanity: r.humanity, types: typesOf(r),
    down: r.hp <= 0, dead: false, kills: 0, rescued: false,
  };
}
const snapTeam = (team) => ({ field: team.field.map((id) => snap(getR(id))), support: team.support.map((id) => snap(getR(id))), net: team.net.map((id) => snap(getR(id))) });

function estimate(job, routeIdx, team, n = 240) {
  const base = snapTeam(team);
  const cp = (a) => a.map((m) => ({ ...m }));
  let ok = 0, death = 0;
  const checks = {}, fails = {};
  for (let i = 0; i < n; i++) {
    const t = { field: cp(base.field), support: cp(base.support), net: cp(base.net) };
    const res = resolveMission(job, routeIdx, t, true);
    if (res.success) ok++;
    else fails[res.reason] = (fails[res.reason] || 0) + 1;
    if (teamIds(t).some((m) => m.dead)) death++;
    for (const k in res.checks) {
      const c = checks[k] || (checks[k] = { ok: 0, n: 0, who: {} });
      c.ok += res.checks[k].ok; c.n += res.checks[k].n;
      for (const w in res.checks[k].who) c.who[w] = (c.who[w] || 0) + res.checks[k].who[w];
    }
  }
  const skills = Object.entries(checks).map(([sk, c]) => ({
    sk, p: c.ok / c.n, per: c.n / n,
    who: Object.entries(c.who).sort((a, b) => b[1] - a[1])[0][0],
  })).sort((a, b) => a.p - b.p);
  const causes = Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([reason, c]) => ({ reason, p: c / n }));
  return { p: ok / n, death: death / n, skills, causes };
}

/* 成功したときの手取り。報酬は全額フィクサーに入り、送り出す臨時雇いの後払いを引く */
function payPreview(job, team) {
  const ids = teamIds(team);
  const payout = Math.round((job.basePayout ?? job.payout) * World.payoutMultiplier(job));
  const temps = (job.temps || []).filter((t) => ids.includes(t.id)).reduce((a, t) => a + t.fee, 0);
  return { payout, temps, total: payout - temps };
}

function intelCost(job) {
  if (G.vouchers.intel > 0) return 0;
  const half = G.runners.some((r) => r.contact === job.client);
  return Math.round(INTEL_COST[job.rank] * (half ? 0.5 : 1) * (cone('informant') || (G.run && (G.run.rooms || {}).terminal >= 3) ? 0.5 : 1) * World.intelMultiplier(job) / 10) * 10;
}
function buyIntel(uid) {
  const job = G.board.find((j) => j.uid === uid);
  if (!job || job.intel) return '情報はもう買ってあります';
  const cost = intelCost(job);
  if (cost > G.money) return '所持金が足りません';
  if (cost === 0 && G.vouchers.intel > 0) G.vouchers.intel--;
  G.money -= cost;
  job.intel = true;
  return null;
}

function dispatch(uid, routeIdx, team) {
  if(G.nightInProgress) return ['判断待ちの通信を完了してください'];
  const job = G.board.find((j) => j.uid === uid);
  if (!job) return ['依頼が見つかりません'];
  const errs = validateTeam(job, team);
  if (errs.length) return errs;
  job.basePayout ??= job.payout;
  job.payout = Math.round(job.basePayout * World.payoutMultiplier(job));
  G.board = G.board.filter((j) => j !== job);
  for (const id of teamIds(team)) getR(id).status = 'mission';
  G.missions.push({ uid, job, routeIdx, team: clone(team), start: G.night, result: null });
  G.lastTeam = clone(team);
  if (G.run && Object.values(countTypes(teamIds(team).map(getR).flatMap(typesOf))).some((n) => n >= 6)) G.run.type6 = true;
  return null;
}
function recall(uid) {
  const ms = G.missions.find((m) => m.uid === uid);
  if (!ms || ms.result) return;
  G.missions = G.missions.filter((m) => m !== ms);
  for (const id of teamIds(ms.team)) { const r = getR(id); if (r) r.status = 'idle'; }
  G.board.unshift(ms.job);
}

/* ───────── 判定（d10） ───────── */

const alive = (m) => !m.down && !m.dead;
function best(list, sk) {
  const c = list.filter(alive);
  if (!c.length) return null;
  return c.reduce((a, b) => (b.st[SKILL_STAT[sk]] + b.sk[sk] > a.st[SKILL_STAT[sk]] + a.sk[sk] ? b : a));
}
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/* 通信の1行。直前の判定（check）がこの人のものなら、技能・ロール・会心／大失敗を行に付ける。
   通信はそれを使って、ダイスの代わりに描写とセリフを出す（ui.js の logLines、flavor.js） */
function L(ctx, who, text, kind = '', calc = '', lane = ctx.lane) {
  if (ctx.sim) return;
  ctx.clock += rint(1, 4);
  // 暴走している人の行は、通信で別の色にする
  const mad = !!(who && ctx.combatState && (ctx.combatState.madNames || []).includes(who));
  const c = ctx.lastCheck; ctx.lastCheck = null;
  const tag = calc && c && c.name === who ? { sk: c.sk, role: c.role, ...(c.crit ? { crit: true } : {}), ...(c.fumble ? { fumble: true } : {}), ...(c.low ? { low: true } : {}) } : {};
  ctx.log.push({ night: ctx.night, ph: ctx.ph, t: hhmm(ctx.clock), who, text, kind, calc, lane, ...tag, ...(mad ? { mad } : {}) });
}
/* brief は、ダイスを隠しているときに text の代わりに出す短い文（数字の内訳を省く） */
function sub(ctx, text, kind = '', brief = '') {
  if (ctx.sim) return;
  ctx.log.push({ night: ctx.night, ph: ctx.ph, lane: ctx.lane, t: '', who: '', text, kind, calc: '', sub: true, ...(brief ? { brief } : {}) });
}
function addHeat(ctx, corp, v) {
  if (!corp || !CLIENTS[corp] || CLIENTS[corp].kind !== 'corp') return;
  ctx.heat[corp] = (ctx.heat[corp] || 0) + v;
}
function abort(ctx, reason) {
  ctx.aborted = true;
  ctx.reason = reason;
  L(ctx, '', reason, 'ng');
}

/* 判定に効いたもの（技能・装備・義体・設備）を、成功に変えた回数として数える */
function credit(ctx, m, label) {
  if (ctx.sim) return;
  const c = ctx.credit || (ctx.credit = {});
  const k = m.id + '|' + label;
  c[k] = (c[k] || 0) + 1;
}

function check(ctx, m, sk, dv) {
  const stK = SKILL_STAT[sk];
  const sv = m.st[stK], kv = m.sk[sk] || 0;
  const parts = World.checkParts(ctx, m, sk);
  if (G && G.run) parts.push(...Run.checkParts(ctx, m, sk));
  if (m.perk === 'backdoor' && sk === 'インターフェース') parts.push({ label: ROLES.net.perk.name, v: 2, perk: true });
  if (m.perk === 'getaway' && sk === '運転') parts.push({ label: ROLES.driver.perk.name, v: 3, perk: true });
  const bonus = parts.reduce((a, p) => a + p.v, 0);
  const wound = !m.pain && !typeOn(ctx, 'endure', 2) && m.hp < m.maxHp / 2 ? 2 : 0;
  const r = d(10);
  let ex = 0, rs = `d10(${r})`;
  if (r === 10) { ex = d(10); rs = `d10(10, +${ex})`; }
  else if (r === 1) { ex = -d(10); rs = `d10(1, −${-ex})`; }
  const total = sv + kv + bonus - wound + r + ex;
  const ok = total >= dv;
  const gear = (m.gm && m.gm[sk]) || 0, cyber = ((m.cy && m.cy[sk]) || 0) + ((m.cy && m.cy[stK]) || 0);
  if (ctx.sim) {
    const c = ctx.checks[sk] || (ctx.checks[sk] = { ok: 0, n: 0, who: {} });
    c.n++; if (ok) c.ok++;
    c.who[m.name] = (c.who[m.name] || 0) + 1;
    return { ok, total, calc: '' };
  }
  ctx.lastCheck = { name: m.name, role: m.role, sk, crit: r === 10, fumble: r === 1, low: m.humanity <= 30 };
  const xp = ctx.xp || (ctx.xp = {});
  (xp[m.id] ||= {})[sk] = (xp[m.id][sk] || 0) + 1;
  if (ok) {
    for (const p of parts) if (p.v > 0 && total - p.v < dv) credit(ctx, m, p.label);
    if (gear > 0 && total - gear < dv) credit(ctx, m, m.gearOf[sk] || '装備');
    if (cyber > 0 && total - cyber < dv) credit(ctx, m, '義体');
  }
  const inner = [gear ? `装備${gear > 0 ? '+' : '−'}${Math.abs(gear)}` : '', cyber ? `義体+${cyber}` : ''].filter(Boolean).join(' ');
  const extra = parts.map((p) => `${p.v >= 0 ? '＋' : '－'}${p.label} ${Math.abs(p.v)}`).join('');
  const calc = `${stK} ${sv}＋${sk} ${kv}${inner ? `〈${inner}〉` : ''}${extra}${wound ? '－重傷 2' : ''}＋${rs}＝${total} ${ok ? '≧' : '＜'} DV${dv}`;
  return { ok, total, calc };
}

function hit(ctx, m, dmg, pierce) {
  const a = m.armor;
  const pen = pierce ? dmg : Math.max(0, dmg - a);
  let note = '';
  if (!pierce && dmg > a && a > 0) { m.armor = a - 1; note = `   防具 ${a}→${a - 1}`; }
  m.hp = Math.max(0, m.hp - pen);
  if (m.hp <= 0 && isMad(ctx, m) && typeOn(ctx, 'chrome', 6)) { m.hp = 1; sub(ctx, `${m.name}は倒れない（義体狂い）`, 'mad'); }
  sub(ctx, pierce
    ? `${m.name} 被弾 ${dmg}（防具無視）   HP ${m.hp}/${m.maxHp}`
    : `被弾 ${dmg} − 防具 ${a} ＝ ${pen}   HP ${m.hp}/${m.maxHp}${note}`, pen > 0 ? 'ng' : '',
    pen > 0 ? `${m.name}が撃たれた。HP ${m.hp}/${m.maxHp}` : `${m.name}に当たったが、防具が止めた`);
  if (m.hp <= 0 && !m.down) deathSave(ctx, m);
}

/* 黒ICEの逆流・敵ネットランナーの攻撃。防壁は無効化、ICE遮断フードは半減 */
function iceHit(ctx, m, dmg) {
  if (m.firewall) { sub(ctx, `${m.name}のニューラル防壁が逆流を遮断した`, 'ok'); credit(ctx, m, CYBER.firewall.name); return; }
  if (typeOn(ctx, 'net', 6)) { sub(ctx, '逆流を受け流した（電脳）', 'ok'); return; }
  if (m.iceguard) { dmg = Math.ceil(dmg / 2); credit(ctx, m, GEAR.icehood.name); }
  hit(ctx, m, dmg, true);
}

function deathSave(ctx, m) {
  m.down = true;
  let bonus = ctx.all.some((x) => x !== m && alive(x) && x.role === 'med') ? 1 : 0;
  if (ctx.all.some((x) => x !== m && alive(x) && x.perk === 'surgeon')) bonus += 2;
  if (m.heart) bonus += m.heart;
  if (typeOn(ctx, 'endure', 4)) bonus += 2;
  const r = d(10), need = m.st.BODY + bonus;
  if (r < need) {
    if (m.heart && r >= need - m.heart) credit(ctx, m, CYBER[m.heart === 3 ? 'heart2' : 'heart'].name);
    const surgeon = ctx.all.find((x) => x !== m && alive(x) && x.perk === 'surgeon');
    if (surgeon && r >= need - 2) credit(ctx, surgeon, ROLES.med.perk.name);
    L(ctx, m.name, '死亡セーブ　生きているが動けない', 'warn', `d10(${r}) ＜ BODY ${m.st.BODY}${bonus ? `＋${bonus}` : ''}`);
    if (!isMad(ctx, m)) armedRescue(ctx, m);
    return;
  }
  // 暴走中のランナーはラザロの契約の対象外
  if (m.lazarus && !isMad(ctx, m)) {
    if (armedRescue(ctx, m)) return;
    m.rescued = true; m.hp = 1; ctx.lazarus.push(m.id);
    L(ctx, m.name, '死亡セーブ失敗。ラザロ救急隊が回収（回収費は報酬額の30%）', 'warn', `d10(${r}) ≧ ${need}`);
    return;
  }
  // 診療室2段：各幕に1回、死ぬはずの人が重傷で済む（見積もりでは使った扱いにしない）
  if (G && G.run && (G.run.rooms || {}).clinic >= 2 && G.run.clinicUsed !== G.run.act) {
    if (!ctx.sim) G.run.clinicUsed = G.run.act;
    m.hp = 0;
    L(ctx, m.name, '死亡セーブ失敗。隠れ家の診療室が手配した担架で、命だけはつないだ', 'warn', `d10(${r}) ≧ ${need}`);
    return;
  }
  if (typeOn(ctx, 'endure', 6) && !ctx.endured) {
    ctx.endured = true; m.hp = 0;
    L(ctx, m.name, '死亡セーブ失敗。それでも息がある。動けないだけで済んだ（持久）', 'warn', `d10(${r}) ≧ ${need}`);
    return;
  }
  m.dead = true;
  L(ctx, m.name, `死亡セーブ失敗　応答なし${m.lazarus ? '（暴走中はラザロの対象外）' : ''}`, 'dead', `d10(${r}) ≧ ${need}`);
}

const isMad = (ctx, m) => !!(ctx.combatState && (ctx.combatState.mad || []).includes(m.id));
/* ラザロの武装回収。死亡セーブに失敗したか、生き延びて動けなくなったときに、1つの依頼で1回だけ出動する。
   交戦中なら回収班が1ラウンドだけ敵を撃つ。本人はHP半分で運び出され、その依頼から抜ける */
function armedRescue(ctx, m) {
  if (m.lazarus !== 'armed' || ctx.armedUsed) return false;
  ctx.armedUsed = true;
  (ctx.armed ||= []).push(m.id);
  m.rescued = true; m.hp = Math.ceil(m.maxHp / 2);
  L(ctx, m.name, `ラザロの武装回収班が突入。運び出す（出動費${fmt(LAZARUS_ARMED.callout)}cr＋報酬額の30%）`, 'warn');
  const s = ctx.combatState;
  if (s) for (let k = 0; k < 2; k++) {
    const foe = s.foes.find((f) => f.hits > 0 && !f.hidden);
    if (!foe) break;
    const r = d(10), total = LAZARUS_ARMED.aim + r;
    L(ctx, 'ラザロ回収班', `${foe.name}を撃つ`, total >= foe.dv ? 'ok' : 'ng', `腕前 ${LAZARUS_ARMED.aim}＋d10(${r})＝${total} ${total >= foe.dv ? '≧' : '＜'} DV${foe.dv}`);
    if (total >= foe.dv) { foe.hits -= foe.armored ? 2 : 1; if (foe.boss) bossHit(ctx, foe); }
  }
  return true;
}

/* 交戦の始めの動揺と発作。不安定（16〜30）はd10で2以下なら動揺し、その交戦は射撃・回避−2。交戦が終わると人間性−1。
   兆候（1〜15）は d10 が ceil((16−人間性)÷4) 以下なら暴走する */
function psychosis(ctx, s, list) {
  s.mad = []; s.madNames = []; s.shaken = []; s.strained = [];
  if (!(G && G.run)) return;
  for (const m of list.filter(alive)) {
    const z = humZone(m.humanity).key;
    if (z === 'unstable') {
      s.strained.push(m.id);
      const r = d(10);
      if (r > 2 || cone('ironDiscipline')) continue;
      s.shaken.push(m.id);
      L(ctx, m.name, '動揺している。この交戦は射撃・回避−2', 'warn', `d10(${r}) ≦ 2`);
    } else if (z === 'sign') {
      const r = d(10), need = Math.ceil((16 - m.humanity) / 4);
      if (r > need) continue;
      s.mad.push(m.id); s.madNames.push(m.name);
      L(ctx, m.name, '発作。暴走した。射撃+2で2回撃つが、もう指示は届かない', 'mad', `d10(${r}) ≦ ${need}`);
    }
  }
}
/* 暴走した人が敵を倒すと、標的の企業のヒート+4。同じ依頼で3体倒すと、市警の鎮圧班が向かってくる */
function madKill(ctx, m) {
  addHeat(ctx, ctx.job.target, 4);
  sub(ctx, `${m.name}が過剰な暴力をふるった`, 'ng');
  ctx.madKills ||= {};
  ctx.madKills[m.id] = (ctx.madKills[m.id] || 0) + 1;
  if (ctx.madKills[m.id] >= 3 && !ctx.maxtac) {
    ctx.maxtac = { id: m.id, name: m.name, choice: null, done: false };
    sub(ctx, '通報が入った。市警の鎮圧班が向かっている', 'ng');
  }
}
/* 交戦が終わったら、暴走した人は我に返る。人間性−2。不安定な人は張りつめて人間性−1 */
function madEnd(ctx, s) {
  for (const id of s.strained || []) {
    const m = ctx.all.find((x) => x.id === id);
    if (!m || m.dead || m.humanity <= 0) continue;
    m.humanity -= 1;
    ctx.humLoss ||= {};
    ctx.humLoss[id] = (ctx.humLoss[id] || 0) + 1;
    L(ctx, m.name, `張りつめた交戦で人間性−1（${m.humanity}）`, 'warn');
  }
  for (const id of s.mad || []) {
    const m = ctx.all.find((x) => x.id === id);
    if (!m || m.dead) continue;
    m.humanity -= 2;
    ctx.humLoss ||= {};
    ctx.humLoss[id] = (ctx.humLoss[id] || 0) + 2;
    L(ctx, m.name, `我に返った。人間性−2（${m.humanity}）`, 'mad');
  }
}
/* 鎮圧班に引き渡す。その人は依頼から抜け、ランからも抜ける（死亡ではなく拘束）。ラザロは呼ばない */
function handOver(ctx, id, text) {
  const m = ctx.all.find((x) => x.id === id);
  if (!m || m.dead || m.custody) return;
  m.custody = true; m.down = true; m.rescued = true;
  (ctx.custody ||= []).push(id);
  L(ctx, m.name, text, 'mad');
}
/* 市警の鎮圧班。隊員2人（第3幕は3人）、耐久2、DV・攻撃はその幕の基準値+4、ダメージ4d6+4 */
function squadFoes(ctx) {
  const a = G.run ? G.run.act : ctx.rank, E = RANK_ENEMY[a];
  return Array.from({ length: a >= 3 ? 3 : 2 }, () => ({ name: '鎮圧班', hits: 2, dv: E.dv + 4, atk: E.atk + 4, dice: 4, plus: 4 }));
}

/* 交戦の敵。群れは2体多く、DV・攻撃−1でダメージ2d6。装甲兵・狙撃手・敵ネットランナーはDV・攻撃+2。装甲兵は2発で倒れる */
function makeFoes(ctx, type, n, name, dv) {
  const E = RANK_ENEMY[ctx.rank];
  const count = type === 'swarm' ? n + 2 : n;
  return Array.from({ length: count }, () => ({
    name, hits: type === 'armored' ? 2 : 1, armored: type === 'armored', sniper: type === 'sniper',
    dv: (dv ?? E.dv + (type === 'swarm' ? -1 : type === 'standard' ? 0 : 2)) + (ctx.threat || 0),
    atk: E.atk + (type === 'swarm' ? -1 : type === 'standard' ? 0 : 2) + (ctx.threat || 0),
    dice: type === 'swarm' ? 2 : E.dice, plus: E.plus,
  }));
}
/* ボスの耐久（ネットのボスは黒ICEの層）。端末室3段で−1、危険度5で+1 */
function bossHits(B) {
  const run = G && G.run;
  return Math.max(1, B.hits - (run && (run.rooms || {}).terminal >= 3 ? 1 : 0) + (run && run.danger >= 5 ? 1 : 0));
}
/* 幕のボス（RUN_BOSSES）と護衛。ボスが先頭、指揮官は最後に並ぶ（見抜けば先頭へ） */
function bossFoes(ctx, B) {
  const E = RANK_ENEMY[ctx.rank];
  const T = ctx.threat || 0;
  const boss = { name: B.name, boss: true, hits: bossHits(B), dv: E.dv + 2 + T, atk: E.atk + 2 + T + (B.drug || 0), dice: E.dice, plus: E.plus + 2,
    attacks: B.attacks || 1, armored: !!B.armored, hidden: !!B.hidden, noShoot: !!B.noShoot };
  const foes = [boss, ...(B.escort || []).flatMap((e) => makeFoes(ctx, e.type, e.n, e.name))];
  if (B.commander) foes.push({ name: `${B.commander.name}（指揮官）`, commander: true, hits: 2, dv: E.dv, atk: E.atk, dice: E.dice, plus: E.plus });
  ctx.bossLeft = boss.hits;
  return foes;
}
function bossHit(ctx, foe) {
  ctx.bossLeft = Math.max(0, foe.hits);
  if (foe.hits <= 0) ctx.bossDown = true;
}
/* ボスとの交戦の始め：取引・説得・隠れ場所・指揮官。交戦が終われば true、続くなら undefined */
function bossOpening(ctx, s, B) {
  const boss = s.foes.find((f) => f.boss);
  const talkers = ctx.team.field.concat(ctx.team.support);
  const calm = (text) => { for (const f of s.foes) f.hits = 0; ctx.bossLeft = 0; ctx.combatState = null; L(ctx, '', text, 'ok'); return true; };
  if (B.deal && G.gangRelation >= B.deal.rel) {
    const m = best(talkers, '説得'), c = m && check(ctx, m, '説得', B.deal.dv);
    if (c) {
      L(ctx, m.name, `${B.name}に取引を持ちかける`, c.ok ? 'ok' : 'ng', c.calc);
      if (c.ok) { ctx.costs.push([`${B.name}との取引`, -B.deal.cost]); return calm(`${fmt(B.deal.cost)}crで話がついた。交戦はなし`); }
      sub(ctx, '取引は断られた', 'ng');
    }
  }
  if (B.talk) {
    const m = best(talkers, '説得'), c = m && check(ctx, m, '説得', B.talk);
    if (c) {
      L(ctx, m.name, `${B.name}に呼びかける`, c.ok ? 'ok' : 'ng', c.calc);
      if (c.ok) { ctx.spared = true; return calm(`${B.name}が正気に戻った。撃たずに終わった`); }
      sub(ctx, '声は届かなかった', 'ng');
    }
  }
  if (B.hidden && boss && boss.hits > 0) {
    const m = best(ctx.team.field, '知覚'), c = m && check(ctx, m, '知覚', B.hidden);
    if (c) L(ctx, m.name, `${B.name}の隠れ場所を探す`, c.ok ? 'ok' : 'ng', c.calc);
    if (c && c.ok) boss.hidden = false;
    else sub(ctx, `${B.name}が見つからない。現場からは撃てない`, 'ng');
  }
  if (B.commander) {
    const cmd = s.foes.find((f) => f.commander), m = best(ctx.team.field, '知覚'), c = m && check(ctx, m, '知覚', B.commander.spot);
    if (c) L(ctx, m.name, `指揮しているのは誰か見抜く`, c.ok ? 'ok' : 'ng', c.calc);
    if (c && c.ok) { s.foes.splice(s.foes.indexOf(cmd), 1); s.foes.unshift(cmd); sub(ctx, `${cmd.name}を見抜いた。先に狙う`, 'ok'); }
    else sub(ctx, `${cmd.name}が後ろで指揮している。ほかの敵の攻撃+1`, 'ng');
  }
  return undefined;
}

/* o.rb は幕のボス（RUN_BOSSES のキー）、o.boss は元部下などの単独のボス */
function combat(ctx, n, label, o = {}) {
  const type = o.enemyType || 'standard', B = o.rb ? RUN_BOSSES[o.rb] : null;
  const fighters = () => (o.chase ? ctx.team.field.concat(ctx.team.support) : ctx.team.field).filter(alive);
  let s = ctx.combatState;
  if (!s) {
    const foes = o.maxtac ? squadFoes(ctx) : B ? bossFoes(ctx, B) : o.boss ? [{ ...o.boss, boss: true }] : makeFoes(ctx, type, n, World.enemies[type] || label, o.dv);
    if (ctx.mods.atkDown) { for (const f of foes) { f.atk -= ctx.mods.atkDown; f.dv -= ctx.mods.atkDown; } ctx.mods.atkDown = 0; L(ctx,'','ネットで敵の連絡を断った。この交戦の敵のDVと攻撃−1（電脳）','ok'); }
    s = ctx.combatState = {n,label,o,foes,round:0,stage:'start',enemy:0,player:0,shot:0,eshot:0,hacked:false};
    L(ctx,'',o.maxtac ? `鎮圧班と交戦：隊員${foes.length}人（耐久2、DV${foes[0].dv}・攻撃${foes[0].atk}・4d6+4）` : B ? `${label}：${B.name}（耐久${foes[0].hits}）${foes.length > 1 ? `と護衛${foes.length - 1}体` : ''}` : label+'と交戦：'+(World.enemies[type]||label)+' '+foes.length+'体','info');
  }
  s.eshot ??= 0;
  const bossOf = () => s.foes.find(f=>f.boss);
  const end = (ok, reason) => {
    madEnd(ctx, s);
    if (typeOn(ctx, 'endure', 2)) { for (const m of ctx.all.filter(alive)) m.hp = Math.min(m.maxHp, m.hp + 5); sub(ctx, '交戦のあと、全員HP+5（持久）', 'ok'); }
    if (o.maxtac) { if (ok) { ctx.wanted = true; L(ctx, '', '鎮圧班を退けた。この幕のあいだ、市警の手配で全依頼の敵+1', 'warn'); } else handOver(ctx, o.maxtac, '鎮圧班に連れていかれた'); }
    ctx.combatState=null; if(reason)abort(ctx,reason); else if(!o.maxtac)L(ctx,'',B ? `${B.name}を倒した` : label+'を制圧','ok'); return ok;
  };
  const shooters = o.chase ? ctx.team.field.concat(ctx.team.support) : ctx.team.field;
  const mad = (m) => (s.mad || []).includes(m.id);
  // 幕のボスが倒れたら、護衛は散る
  const won = () => !s.foes.some(f=>f.hits>0) || (B && bossOf().hits<=0);
  while (true) {
    if (s.stage==='start') {
      const first = o.ambush && typeOn(ctx, 'fire', 6);
      if (first) L(ctx,'','待ち伏せを読んで先に撃つ（火力）','ok');
      s.stage=o.ambush&&!first?'enemy':'player';
      s.ambush=!!o.ambush;
      if (B && !s.opened) { s.opened = true; if (bossOpening(ctx, s, B)) return true; }
      if (!s.rolled) { s.rolled = true; psychosis(ctx, s, shooters); }
      if(s.foes.some(f=>f.sniper&&f.hits>0)) {
        const scout=best(ctx.all,'知覚'),c=scout&&check(ctx,scout,'知覚',18);
        if(c&&c.ok)L(ctx,scout.name,'狙撃手を先に発見。先制射撃を防いだ','ok',c.calc);
        else if(fighters().length){const t=pick(fighters());L(ctx,t.name,'狙撃手の先制射撃','ng');hit(ctx,t,roll(3,6)+5,false);}
        if(ctx.alert)return null;
      }
    }
    if(s.stage==='player') {
      const list=o.chase?ctx.team.field.concat(ctx.team.support):ctx.team.field;
      shots: while(s.player<list.length) {
        const m=list[s.player];
        if(!alive(m)){s.player++;s.shot=0;continue;}
        while(s.shot<(m.perk==='double'||mad(m)?2:1)) { // 暴走は二連射と重ならない
          s.shot++;
          const foe=s.foes.find(f=>f.hits>0&&!f.hidden);
          if(!foe){ if(won()) return end(true); s.player=list.length; break shots; } // 隠れたボスしか残っていない
          const c=check(ctx,m,'射撃',foe.dv);L(ctx,m.name,foe.name+'を攻撃',c.ok?'ok':'ng',c.calc);
          if(c.ok){const tech=ctx.all.some(x=>alive(x)&&x.role==='tech'),weak=foe.armored&&(tech||m.ap);
            if(weak&&m.ap&&!tech)credit(ctx,m,'徹甲ライフル');
            foe.hits-=weak?2:1;
            if(foe.boss)bossHit(ctx,foe);
            if(foe.hits<=0){m.kills++;if(s.shot===2&&!mad(m))credit(ctx,m,ROLES.solo.perk.name);
              if(typeOn(ctx,'fire',4)&&!s.again){s.again=true;s.shot--;sub(ctx,`${m.name}は次を狙う（火力）`,'ok');}
              if(mad(m))madKill(ctx,m); // 暴走中は確実に過剰な暴力。テーザーでも防げない
              else if(m.humanity<=15&&!m.nonlethal&&rnd()<.35){addHeat(ctx,ctx.job.target,4);sub(ctx,m.name+'が過剰な暴力をふるった','ng');}
              if(won())return end(true);}
            else if(foe.boss)sub(ctx,`${foe.name}の耐久 残り${foe.hits}${foe.armored&&!weak?'（テックか徹甲ライフルがあれば2削れる）':''}`,'warn');
            else if(foe.armored)sub(ctx,'装甲兵はまだ動く。テックか徹甲ライフルがあれば弱点を突ける','warn');}
        }
        s.player++;s.shot=0;s.again=false;
      }
      // ネット担当がボスの回線を焼く（電気屋）
      if (B && B.hack && !s.netDone) {
        s.netDone = true;
        const boss=bossOf(), nr=ctx.team.net.find(alive);
        if (boss.hits>0 && nr) {
          const c=check(ctx,nr,'インターフェース',boss.dv);
          L(ctx,nr.name,`${boss.name}の回線を焼く`,c.ok?'ok':'ng',c.calc,'net');
          if (c.ok) { boss.hits--; bossHit(ctx,boss); if (boss.hits>0) sub(ctx,`${boss.name}の耐久 残り${boss.hits}`,'warn'); }
        }
      }
      if(won())return end(true);
      s.stage='enemy';s.enemy=0;s.eshot=0;s.hacked=false;
    }
    if(s.stage==='enemy') {
      if(type==='hacker'&&!s.hacked&&s.foes.some(f=>f.hits>0)) {
        s.hacked=true;const nr=ctx.team.net.find(alive);
        if(nr){const c=check(ctx,nr,'インターフェース',18);L(ctx,nr.name,'敵ネットランナーのICE攻撃',c.ok?'ok':'ng',c.calc,'net');if(!c.ok)iceHit(ctx,nr,roll(2,6));}
        else {ctx.mods.extraEnemy=Math.max(1,ctx.mods.extraEnemy);L(ctx,'','敵ネットランナーが増援を呼んだ','ng');}
        if(ctx.alert)return null;
      }
      if(B&&B.ice&&!s.hacked&&bossOf().hits>0) {
        s.hacked=true;const boss=bossOf(),nr=ctx.team.net.find(alive);
        if(nr){const c=check(ctx,nr,'インターフェース',boss.atk);L(ctx,nr.name,`${boss.name}のICE攻撃`,c.ok?'ok':'ng',c.calc,'net');if(!c.ok)iceHit(ctx,nr,roll(2,6));}
        else if(fighters().length){const t=pick(fighters());L(ctx,t.name,`${boss.name}のICEが義体を焼く`,'ng');hit(ctx,t,roll(2,6),true);}
        if(ctx.alert)return null;
      }
      // 指揮官が生きているあいだ、ほかの敵の攻撃+1
      const cmd=s.foes.some(f=>f.commander&&f.hits>0);
      while(s.enemy<s.foes.length) {
        const foe=s.foes[s.enemy];
        if(foe.hits<=0||foe.noShoot){s.enemy++;s.eshot=0;continue;}
        // 最後の1発を撃つ前にカーソルを進める（被弾で中断しても、同じ攻撃は繰り返さない）
        if(++s.eshot>=(foe.attacks||1)){s.enemy++;s.eshot=0;}
        const targets=fighters();if(!targets.length)break;
        // 鎮圧班は暴走した人を先に狙う
        const hunted=o.maxtac&&targets.find(x=>x.id===o.maxtac);
        const t=hunted||pick(targets),c=check(ctx,t,'回避',foe.atk+(cmd&&!foe.commander?1:0));
        if(!c.ok){L(ctx,t.name,foe.name+'の攻撃をかわせない','ng',c.calc);hit(ctx,t,roll(foe.dice,6)+foe.plus,false);}
        if(ctx.alert)return null;
      }
      if(won())return end(true); // ラザロの回収班が最後の敵を倒したとき
      if(!fighters().length)return end(false,label+'との交戦で、全員が倒れた');
      if(!s.ambush)s.round++;s.ambush=false;
      // 回収屋の癖：決められたラウンドで倒しきれないと、目標を1つ持ち去る
      if (B && B.seize && s.round>=B.seize) {
        madEnd(ctx, s);
        ctx.combatState=null;
        if (ctx.goals>0) { ctx.goals--; ctx.seized=true; ctx.mods.chase=true; L(ctx,'',`${B.name}が目標を1つ持ち去った。逃走は追撃戦になる。振り切れば取り返せる`,'ng'); }
        else L(ctx,'',`${B.name}は引き上げた`,'warn');
        return true;
      }
      // ラン中の元部下は、3ラウンドで倒しきれないと鎮圧班が割り込んで片付ける（依頼は失敗、ヒートは上がらない）
      if(s.round>=3&&o.boss&&ctx.job.deserter&&G.run){ctx.suppressed=true;return end(false,`鎮圧班が割り込んで、${o.boss.name}を片付けた`);}
      // 交戦はどちらかが倒れるまで続く。持久4：ラウンドが終わるたび、いちばん傷の深い人のHP+3
      if(typeOn(ctx,'endure',4)){const w=fighters().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(w&&w.hp<w.maxHp){w.hp=Math.min(w.maxHp,w.hp+3);sub(ctx,`${w.name}が息を整えた。HP+3（持久）`,'ok');}}
      // 念のための上限（隠れたボスに手が届かないまま、誰も倒れないとき）
      if(s.round>=COMBAT_ROUND_CAP)return end(false,label+'との決着がつかないまま、夜が明けかけた');
      s.stage='player';s.player=0;s.shot=0;s.netDone=false;
    }
  }
}

const COMBAT_ROUND_CAP = 12;
/* ネットのボス（保守主任）。黒ICEを1層ずつ破り、抜けなければ現場から回線を物理的に切る */
function netBoss(ctx, p, B) {
  let left = bossHits(B);
  const nr = ctx.team.net.find(alive);
  L(ctx, '', `${p.l}：${B.name}の黒ICE（残り${left}層）`, 'info', '', 'net');
  if (!nr) L(ctx, '', 'ネットの担当がいない。回線を物理的に切るしかない', 'warn', '', 'net');
  while (nr && alive(nr) && left > 0) {
    const k = B.hits - left, c = check(ctx, nr, 'インターフェース', B.layers[k]);
    L(ctx, nr.name, `黒ICE 第${k + 1}層`, c.ok ? 'ok' : 'ng', c.calc, 'net');
    if (!c.ok) { sub(ctx, '黒ICEの逆流', 'ng'); iceHit(ctx, nr, roll(2, 6)); break; }
    left--;
  }
  for (let k = 0; left > 0 && k < 3; k++) {
    const m = best(ctx.team.field.concat(ctx.team.support), '電子'); if (!m) break;
    const c = check(ctx, m, '電子', B.cut);
    L(ctx, m.name, k ? '回線を切る（やり直し）' : `${B.name}の回線を物理的に切る`, c.ok ? 'ok' : 'ng', c.calc);
    if (c.ok) left = 0;
  }
  ctx.bossLeft = left;
  if (left > 0) return abort(ctx, `${B.name}を止められなかった`);
  ctx.bossDown = true;
  L(ctx, '', `${B.name}の回線が落ちた`, 'ok');
}

function rest(ctx, p) {
  const medics = ctx.all.filter((x) => alive(x) && x.role === 'med');
  const medic = best(medics, '医療');
  const parts = [];
  for (const m of ctx.all.filter(alive)) {
    const before = m.hp;
    const h = d(6) + 2 + (medic ? Math.floor(medic.sk.医療 / 2) : 0) + (m.medkit ? 5 : 0);
    m.hp = Math.min(m.maxHp, m.hp + h);
    if (m.hp > before) parts.push(`${m.name} ${before}→${m.hp}`);
  }
  const patcher = ctx.all.find((x) => alive(x) && x.perk === 'patch');
  if (patcher) {
    let fixed = 0;
    for (const m of ctx.all) { const a = m.armor; m.armor = Math.min(m.armorMax, m.armor + 2); fixed += m.armor - a; }
    if (fixed) credit(ctx, patcher, ROLES.tech.perk.name);
  }
  L(ctx, medic ? medic.name : '', `${p.l}　HP回復${medic ? '（手当て）' : ''}`, 'ok', parts.join('　'));
}

function fieldPhase(ctx, p) {
  const F = ctx.team.field, SUP = ctx.team.support, tgt = ctx.job.target;
  const tName = tgt ? CLIENTS[tgt].short : '';
  switch (p.t) {
    case 'sneak': {
      const m = best(F, '隠密'); if (!m) return;
      const c = check(ctx, m, '隠密', p.dv);
      L(ctx, m.name, p.l, c.ok ? 'ok' : 'ng', c.calc);
      if (!c.ok) { ctx.mods.extraEnemy++; addHeat(ctx, tgt, 4); sub(ctx, `見つかった。次の交戦で敵+1${tgt ? `　${tName}のヒート +4` : ''}`, 'ng'); }
      else if (typeOn(ctx, 'stealth', 4)) { ctx.mods.extraEnemy--; sub(ctx, '気づかれずに回り込んだ。次の交戦で敵−1（隠密）', 'ok'); }
      break;
    }
    case 'trap': {
      const m = best(F, '知覚'); if (!m) return;
      const c = check(ctx, m, '知覚', p.dv);
      L(ctx, m.name, p.l, c.ok ? 'ok' : 'ng', c.calc);
      if (!c.ok) {
        addHeat(ctx, tgt, 8); ctx.mods.extraEnemy++;
        sub(ctx, `警報${tgt ? `　${CLIENTS[tgt].name}のヒート +8` : ''}　次の交戦で敵+1`, 'ng');
        hit(ctx, m, roll(2, 6), false);
      }
      break;
    }
    case 'combat': {
      const n = p.n + ctx.mods.extraEnemy;
      ctx.mods.extraEnemy = 0;
      if (typeOn(ctx, 'stealth', 6) && !ctx.ghosted) { ctx.ghosted = true; L(ctx, '', `${p.l}：影から影へ抜けて、交戦を避けた（隠密）`, 'ok'); break; }
      if (n <= 0) { L(ctx, '', `${p.l}：見張りはいなかった（隠密）`, 'ok'); break; }
      combat(ctx, n, p.l, { ambush: p.hidden && !ctx.job.intel, enemyType: p.enemyType, dv:p.enemyDV });
      break;
    }
    case 'rest': rest(ctx, p); break;
    case 'gate': {
      const dv = p.dv + ctx.mods.gateUp;
      ctx.mods.gateUp = 0;
      for (let k = 0; k < 3; k++) {
        const m = best(F.concat(SUP), '電子'); if (!m) break;
        const c = check(ctx, m, '電子', dv);
        L(ctx, m.name, k ? `${p.l}（やり直し）` : p.l, c.ok ? 'ok' : 'ng', c.calc);
        if (c.ok) return;
      }
      // 開かなければ力ずくで破る。警報が鳴り、次の交戦で敵+2
      ctx.mods.extraEnemy += 2; addHeat(ctx, tgt, 8);
      sub(ctx, `開かない。力ずくで破った。警報が鳴った　次の交戦で敵+2${tgt ? `　${tName}のヒート +8` : ''}`, 'ng');
      break;
    }
    case 'goal': ctx.goals++; L(ctx, '', `${p.l}　確保`, 'goal'); break;
    case 'escape': {
      if (ctx.mods.chase) {
        ctx.mods.chase = false;
        ctx.afterCombat = 'escapeDrive';
        L(ctx, '', ctx.seized ? '持ち去った回収班を追う。追撃戦' : '警報で追手がかかった。追撃戦', 'ng');
        if (!combat(ctx, 2, '追手', { chase: true })) return;
        ctx.afterCombat = null;
      }
      const m = best(SUP.concat(F), '運転'); if (!m) return;
      const c = check(ctx, m, '運転', p.dv);
      L(ctx, m.name, p.l, c.ok ? 'ok' : 'ng', c.calc);
      if (!c.ok) { ctx.afterCombat = null; sub(ctx, '振り切れない', 'ng'); combat(ctx, 2, '追いすがる追手', { chase: true }); }
      else if (ctx.seized) { ctx.seized = false; ctx.goals++; sub(ctx, '追いついて、持ち去られた目標を取り返した', 'ok'); }
      break;
    }
    case 'drive': {
      const m = best(SUP.concat(F), '運転'); if (!m) return;
      const c = check(ctx, m, '運転', p.dv);
      L(ctx, m.name, p.l, c.ok ? 'ok' : 'ng', c.calc);
      if (!c.ok) { ctx.rewardMult -= 0.2; ctx.mods.extraEnemy++; sub(ctx, '足止めを食った。報酬−20%　次の交戦で敵+1', 'ng'); }
      break;
    }
    case 'talk': {
      const m = best(F.concat(SUP), '説得'); if (!m) return;
      const c = check(ctx, m, '説得', p.dv);
      L(ctx, m.name, p.l, c.ok ? 'ok' : 'ng', c.calc);
      if (!c.ok) { sub(ctx, '話がこじれた', 'ng'); combat(ctx, 2, '交渉決裂'); }
      break;
    }
    case 'med': {
      for (let k = 0; k < 2; k++) {
        const m = best(F.concat(SUP), '医療'); if (!m) break;
        const c = check(ctx, m, '医療', p.dv);
        L(ctx, m.name, k ? `${p.l}（やり直し）` : p.l, c.ok ? 'ok' : 'ng', c.calc);
        if (c.ok) return;
      }
      ctx.rewardMult -= 0.4;
      sub(ctx, 'うまくいかなかった。報酬−40%', 'ng');
      break;
    }
    case 'boss': {
      const B = p.boss && RUN_BOSSES[p.boss];
      if (B && B.layers) netBoss(ctx, p, B);
      else combat(ctx, 1, p.l, B ? { rb: p.boss } : { boss: ctx.job.boss });
      break;
    }
  }
}

function netPhase(ctx, p) {
  const nr = ctx.team.net.find(alive);
  if (!nr) { L(ctx, '', `${p.l}　ネットの担当がいない`, 'ng', '', 'net'); netFail(ctx, p); return; }
  const tries = p.fx === 'data' ? 2 : 1;
  for (let k = 0; k < tries; k++) {
    const c = check(ctx, nr, 'インターフェース', p.dv);
    L(ctx, nr.name, `${p.l}${k ? '（再侵入）' : ''}`, c.ok ? 'ok' : 'ng', c.calc, 'net');
    if (c.ok) {
      if (p.fx === 'data') ctx.goals++;
      if (typeOn(ctx, 'net', 4) && !ctx.mods.atkDown) ctx.mods.atkDown = 1;
      return;
    }
    if (p.dv >= 17) { sub(ctx, '黒ICEの逆流', 'ng'); iceHit(ctx, nr, roll(2, 6)); }
    if (!alive(nr)) break;
  }
  netFail(ctx, p);
}

function netFail(ctx, p) {
  const tgt = ctx.job.target;
  switch (p.fx) {
    case 'cam': ctx.mods.extraEnemy++; sub(ctx, 'カメラに捕捉された。次の交戦で敵+1', 'ng'); break;
    case 'door': ctx.mods.gateUp += 4; sub(ctx, '扉の制御を奪えない。次の扉のDV+4', 'ng'); break;
    case 'alarm': ctx.mods.chase = true; sub(ctx, '警報が作動。逃走は追撃戦になる', 'ng'); break;
    case 'trace': addHeat(ctx, tgt, 6); sub(ctx, `逆探知された${tgt ? `　${CLIENTS[tgt].short}のヒート +6` : ''}`, 'ng'); break;
    case 'data': abort(ctx, `${p.l}を抜けなかった。目標を取り逃した`); break;
  }
}

function missionContext(job, routeIdx, team, sim, interactive = false) {
  World.prepareJob(job);
  const route = job.routes[routeIdx];
  const ctx = { job, routeIdx, rank: job.rank, threat: G.run ? Run.threat() : 0, team, sim, interactive,
    log: [], heat: {}, lazarus: [], mods: {extraEnemy:0, gateUp:0, chase:false, atkDown:0},
    rewardMult:1, aborted:false, reason:'', goals:0, need:0, night:1, clock:1320, checks:{}, xp:{}, credit:{}, costs:[], bossLeft:null,
    humLoss:{}, madKills:{}, custody:[], armed:[], maxtac:null,
    ph:0, lane:'net', stage:0, decisions:0, alert:null, waiting:false };
  ctx.all = teamIds(team);
  ctx.types = countTypes(ctx.all.flatMap((m) => m.types || []));
  World.context(ctx);
  ctx.environmentNight = G.night;
  for (const p of [...route.field,...route.net])
    if (p && (p.t === 'goal' || p.fx === 'data') && !(sim && !job.intel && p.hidden)) ctx.need++;
  return ctx;
}
function runMission(ctx, nightLimit = Infinity) {
  // Rebind aliases after JSON load so HP and armour remain shared with the team.
  ctx.all = teamIds(ctx.team);
  const route = ctx.job.routes[ctx.routeIdx];
  if (ctx.waiting) return ctx;
  while (ctx.ph < route.field.length && !ctx.aborted) {
    ctx.night = Math.floor(ctx.ph / 5) + 1;
    if (ctx.night > nightLimit) return ctx;
    if (ctx.stage === 0) ctx.clock = 1320 + (ctx.ph % 5) * 78 + rint(2,20);
    ctx.lane = ctx.stage === 0 ? 'net' : 'field';
    let p = (ctx.stage === 0 ? route.net : route.field)[ctx.ph];
    if (ctx.sim && !ctx.job.intel && p && p.hidden) p = null;
    if (ctx.combatState) {
      const s=ctx.combatState;
      const ok=combat(ctx,s.n,s.label,s.o);
      if(ok && ctx.afterCombat === 'escapeDrive') { ctx.afterCombat=null; fieldPhase(ctx,p); }
      else if(ok && ctx.afterCombat === 'phase') { ctx.afterCombat=null; fieldPhase(ctx,p); } // 鎮圧班を退けたあとの交戦
    } else if (p && ctx.stage === 1 && squadArrives(ctx, p)) {
      if (ctx.waiting) return ctx;
    } else if (p) { if (ctx.stage === 0) netPhase(ctx,p); else fieldPhase(ctx,p); }
    // Combat keeps its own cursor if interrupted immediately after a hit.
    if (!ctx.combatState) {
      if (ctx.stage === 0) ctx.stage = 1;
      else { ctx.stage = 0; ctx.ph++; }
    }
    if (ctx.alert && !ctx.aborted) { ctx.waiting = true; ctx.decisions++; return ctx; }
    if (!ctx.aborted && ctx.team.field.length && ctx.team.field.every(m=>!alive(m))) abort(ctx,'現場の全員が倒れた');
  }
  ctx.success = !ctx.aborted && ctx.goals >= ctx.need;
  if (!ctx.aborted && !ctx.success) ctx.reason = '目標に届かなかった';
  ctx.endNight = ctx.aborted ? ctx.night : Math.ceil(route.field.length / 5);
  ctx.finished = true;
  return ctx;
}
/* 暴走した人が3体倒した依頼では、次の交戦の前に鎮圧班が到着する。依頼はそこで止まって、
   引き渡す・かばうを選ぶ（見積もりでは引き渡す）。この夜のフェーズを処理したら true */
const FIGHTS = (p) => p.t === 'combat' || (p.t === 'boss' && !(p.boss && RUN_BOSSES[p.boss].layers));
function squadArrives(ctx, p) {
  const mt = ctx.maxtac;
  if (!mt || mt.done || !FIGHTS(p)) return false;
  const m = ctx.all.find((x) => x.id === mt.id);
  if (!m || m.dead || m.custody) { mt.done = true; return false; }
  if (!mt.choice) {
    if (ctx.interactive && !ctx.sim) {
      ctx.alert = `${mt.name}を追って、市警の鎮圧班が到着した`;
      ctx.decision = 'maxtac'; ctx.waiting = true;
      L(ctx, '', ctx.alert, 'mad');
      return true;
    }
    mt.choice = 'handover';
  }
  mt.done = true;
  if (mt.choice === 'handover') { handOver(ctx, mt.id, '鎮圧班に引き渡した。連れていかれた'); return false; }
  // かばう：鎮圧班と交戦し、勝てば予定の交戦に進む
  ctx.afterCombat = 'phase';
  const ok = combat(ctx, 0, '鎮圧班', { maxtac: mt.id, chase: true });
  if (ok === true) { ctx.afterCombat = null; fieldPhase(ctx, p); }
  return true;
}
function resolveMission(job, routeIdx, team, sim) {
  return runMission(missionContext(job,routeIdx,team,sim));
}
/* 依頼が止まるのは鎮圧班が来たときだけ。choice は 'handover'・'protect'。
   それ以外で止まっている保存データ（続行／撤退があった版）は、続行として進める */
const SQUAD_CHOICE = { handover: '引き渡す', protect: 'かばう' };
function missionDecision(uid, choice) {
  const ms = G.missions.find(m=>m.uid===uid);
  if (!ms || !ms.progress || !ms.progress.waiting) return;
  const ctx = ms.progress;
  ctx.all=teamIds(ctx.team);
  ms.shownLog = ctx.log.length;
  ctx.waiting = false; ctx.alert = null;
  if (ctx.decision === 'maxtac') {
    ctx.decision = null;
    ctx.maxtac.choice = SQUAD_CHOICE[choice] ? choice : 'handover';
    L(ctx, '', `フィクサーの指示：${SQUAD_CHOICE[ctx.maxtac.choice]}`, 'warn');
  }
  save();
}

/* ───────── 精算 ───────── */

function killRunner(r, cause) {
  G.runners = G.runners.filter((x) => x !== r);
  if (G.run && !r.temp) G.run.refill = true; // 次の報酬に補充の候補を必ず出す
  if (cone('insurance') && !r.temp) G.money += 1500;
  G.memorial.push({ name: r.name, role: r.role, story: r.story, night: G.night, cause, jobs: r.jobs });
}
function leaveRunner(r) {
  G.runners = G.runners.filter((x) => x !== r);
  if (G.run && !r.temp) G.run.refill = true;
  if (r.story) G.flags['story_' + r.story] = true;
}

function campaignDone(key, out) {
  G.flags['done_' + key] = true;
  if (CHAPTERS[key].ending) { G.awaitEnding = true; return; }
  if (CHAPTERS[key].choice) { G.awaitChoice = key; return; }
  enterChapter(nextChapter(CHAPTERS[key]), out);
}

function settle(ms, out) {
  const job = ms.job, res = ms.result;
  const s = { runBoss: !!job.runBoss, hard: !!job.hard, bossLeft: res.bossLeft, bossDown: !!res.bossDown, title: job.title, route: job.routes[ms.routeIdx].name, success: res.success, reason: res.reason, lines: [], net: 0, deaths: [], deadRunners: [], notes: [], cred: 0, growth: [], credits: [] };
  const members = res.members;
  const n = members.length || 1;
  for (const m of members) {
    const r = getR(m.id);
    if (!r) continue;
    if (m.dead) { s.deadRunners.push(clone(r)); killRunner(r, job.title); s.deaths.push(r.name); continue; }
    if ((res.custody || []).includes(m.id)) {
      leaveRunner(r);
      if (G.run) (G.run.custody ||= []).push({ name: r.name, role: r.role, night: G.night });
      s.notes.push(`${r.name}は鎮圧班に拘束された。ランから抜ける`);
      continue;
    }
    r.hp = m.hp; r.armor = m.armor; r.status = 'idle'; r.jobs++; r.kills += m.kills;
    r.humanity -= (res.humLoss || {})[m.id] || 0;
    for (const [sk, n] of Object.entries((res.xp || {})[m.id] || {})) {
      const ups = gainXp(r, sk, n);
      if (ups.length) s.growth.push(`${r.name}の${sk}が ${ups[0] - 1}→${ups[ups.length - 1]} に上がった`);
    }
    if (m.down && !m.rescued) s.notes.push(`${r.name}は重体で戻った（HP 0）`);
    if (m.rescued) s.notes.push((res.armed || []).includes(m.id) ? `${r.name}はラザロの武装回収班に運び出された（HP ${m.hp}）` : `${r.name}はラザロに回収された（HP 1）`);
    if (job.rank >= 2 && res.success) {
      r.elite++;
      if (!r.perk && r.elite >= 3) { r.perk = true; s.notes.push(`${r.name}が「${ROLES[r.role].perk.name}」を覚えた：${ROLES[r.role].perk.desc}`); }
    }
  }
  for (const [k, n] of Object.entries(res.credit || {})) {
    const [id, label] = k.split('|');
    const m = members.find((x) => String(x.id) === id);
    if (!m) continue;
    s.credits.push({ name: m.name, label, n });
    const r = getR(m.id);
    if (r && label === ROLES[r.role].perk.name) r.perkUses = (r.perkUses || 0) + n;
  }
  s.credits.sort((a, b) => b.n - a.n);
  for (const [label, v] of res.costs || []) { G.money += v; s.net += v; s.lines.push([label, v]); }
  if (res.spared) G.flags.spared = true;
  const recover = Math.round(Math.max(job.payout, 2000) * 0.3);
  if (res.lazarus.length) {
    const fee = recover * res.lazarus.length;
    G.money -= fee; s.net -= fee;
    s.lines.push([`ラザロ回収費 ×${res.lazarus.length}`, -fee]);
  }
  if ((res.armed || []).length) {
    const fee = (LAZARUS_ARMED.callout + recover) * res.armed.length;
    G.money -= fee; s.net -= fee;
    s.lines.push(['ラザロ武装回収（出動費＋回収費）', -fee]);
  }
  if (res.wanted && cone('scanner')) s.notes.push('警察無線の盗聴：市警の手配はつかなかった');
  else if (res.wanted) { G.run.wanted = G.run.act; s.notes.push('市警の手配：この幕のあいだ、全依頼の交戦で敵+1'); }
  if (cone('bloodOath')) for (const m of members) { const r = getR(m.id); if (r && !r.temp) { r.humanity -= 1; } }
  if (cone('bloodOath')) s.notes.push('血の誓い：送り出した人の人間性−1');
  if (cone('backer') && job.target && CLIENTS[job.target].kind === 'corp') { G.heat[job.target] = clamp(G.heat[job.target] + 5, 0, 100); s.notes.push(`企業の後ろ盾：${CLIENTS[job.target].short}のヒート+5`); }
  Run.tempDone(job, res, s);
  if (job.deserter) Run.deserterDone(job, res, s);
  if (res.success && job.hard) G.run.hardDone = true;
  if (res.bossDown && typeof job.boss === 'string') (G.run.bossesDown ||= []).push(job.boss);
  if (res.success) {
    const amount = Math.round(job.payout * Math.max(0.2, res.rewardMult) * (cone('backer') ? 1.2 : 1));
    if (amount > 0) s.lines.push(['依頼の報酬', amount]);
    if (cone('scavenger')) { s.lines.push(['拾い屋', 300]); G.money += 300; s.net += 300; }
    G.money += amount; s.net += amount;
    const cnt = G.repeats[job.tpl] || 0;
    s.cred = job.special ? job.cred : cnt === 0 ? job.cred : cnt === 1 ? Math.ceil(job.cred / 2) : 0;
    if (!job.special && cnt >= 1) s.notes.push(cnt === 1 ? '同じ仕事は2回目。評判の伸びは半分' : '同じ仕事の繰り返し。評判は上がらない');
    G.cred += s.cred;
    if (!job.special) G.repeats[job.tpl] = cnt + 1;
    G.successes++;
    if (job.intro) { G.rank++; s.notes.push(`評判ランク ${G.rank}「${RANK_NAME[G.rank]}」に上がった。上の依頼が回ってくる`); }
    if (job.campaign) campaignDone(job.campaign, out);
    if (!(job.campaign && CHAPTERS[job.campaign].ending)) { G.pending.push(Run.makeReward(job, res)); s.bonus = true; }
  } else {
    G.cred = Math.max(0, G.cred - 2); s.cred = -2;
    (G.run.losses ||= []).push({ night: G.night, act: G.run.act, title: job.title, reason: res.reason, boss: !!job.runBoss });
  }
  const heat = res.suppressed ? {} : { ...res.heat }; // 鎮圧班が片付けた元部下の依頼では、ヒートは上がらない
  if (!res.suppressed && job.target && CLIENTS[job.target].kind === 'corp') heat[job.target] = (heat[job.target] || 0) + Math.round(job.heat * (res.success ? 1 : 0.5));
  if (CLIENTS[job.client].kind === 'corp') for (const c of CORPS) if (c !== job.client && c !== job.target) heat[c] = (heat[c] || 0) + job.rank * 4;
  for (const c in heat) {
    G.heat[c] = clamp(G.heat[c] + heat[c], 0, 100);
    if (heat[c] > 0) out.touched[c] = true;
  }
  s.heat = heat;
  World.settle(ms, s, out);
  return s;
}

/* ───────── 幕間 ───────── */

const INTERLUDE_WHEN = {
  firstCyber: () => G.flags.anyCyber,
  firstDeath: () => G.memorial.length > 0,
  edge: () => G.runners.some((r) => r.humanity > 0 && r.humanity <= 15),
  harbor: () => G.rank >= 2,
  watched: () => CORPS.some((c) => G.heat[c] >= 80),
  rain: () => G.night >= 12,
  ghost: () => G.flags.done_cipher,
};
/* 一夜に一つまで。条件を満たした最初の未読の幕間を流す */
function interlude(out) {
  const key = Object.keys(INTERLUDES).find((k) => !G.flags['interlude_' + k] && INTERLUDE_WHEN[k] && INTERLUDE_WHEN[k]());
  if (!key) return;
  G.flags['interlude_' + key] = true;
  out.story.push(key);
}

/* ───────── 夜の終わり ───────── */

function desert(r, out) {
  out.deserted.push(clone(r));
  leaveRunner(r);
  const boss = {
    name: r.name, hits: 3,
    dv: clamp(stat(r, 'REF') + skill(r, '回避') + 3, 13, 21),
    atk: clamp(stat(r, 'REF') + skill(r, '射撃') + 3, 13, 21), dice: 4, plus: 2,
  };
  const rank = G.run.act;
  const tpl = {
    id: 'deserter_' + r.id, rank, title: `元部下の${r.name}を止める`, client: 'resident', target: null, deserter: true,
    nights: 1, payout: 3000 * rank, cred: 8, heat: 0, req: ['solo'], boss,
    desc: `ヒューマニティが尽きた${r.name}が、屋台街で暴れている。義体を入れたのは、あなただ。`,
    routes: [
      { name: '屋台街', note: '人混みの中で', field: [S(15, '足取りを追う'), H(C(2, '巻き込まれた用心棒')), _, B(r.name), O('決着')], net: N5() },
      { name: '寝床', note: '帰ってくるのを待つ', field: [_, H(T(15, '仕掛けられた罠')), R('向かいの部屋'), B(r.name), O('決着')], net: N5() },
    ],
  };
  Run.addDeserter(r, tpl, out);
}

function raid(corp, out) {
  const defenders = G.runners.filter(available).sort((a, b) => power(b) - power(a)).slice(0, 3);
  const job = { title: `${CLIENTS[corp].name}の襲撃`, rank: G.run.act, district: 'street', tags: ['defense'], target: null, routes: [{ field: [C(2 + G.run.act, `${CLIENTS[corp].short}の襲撃部隊`)], net: [_] }] };
  let ok = false, log = [{ t: '', who: '', text: '隠れ家には動けるランナーがいなかった', kind: 'ng' }];
  if (defenders.length) {
    const team = { field: defenders.map(snap), support: [], net: [] };
    const res = resolveMission(job, 0, team, false);
    ok = !res.aborted;
    log = res.log;
    for (const m of team.field) {
      const r = getR(m.id);
      if (m.dead) { killRunner(r, '隠れ家の防衛'); continue; }
      r.hp = m.hp; r.armor = m.armor;
    }
    if (res.lazarus.length) G.money -= 600 * res.lazarus.length;
  }
  out.comms.push({ title: job.title, route: '隠れ家の防衛', k: 1, of: 1, lines: log, ends: true, success: ok, raid: true, corp });
  if (ok) { G.heat[corp] = 60; out.events.push({ kind: 'ok', text: `${CLIENTS[corp].short}の襲撃を退けた。ヒートは60まで下がった` }); }
  else {
    const loss = Math.max(1000, Math.round(Math.max(0, G.money) * 0.3));
    G.money -= loss; G.heat[corp] = 50;
    out.events.push({ kind: 'ng', text: `${CLIENTS[corp].short}に隠れ家を荒らされ、${fmt(loss)}cr を奪われた` });
  }
}

function endNight() {
  if (G.awaitChoice) return null; // 分岐を選ぶまで夜は明けない
  G.nightInProgress = true;
  const out = { night: G.night, comms: [], settle: [], events: [], story: [], touched: {}, heat: [], deserted: [] };
  for (const ms of G.missions) {
    if (ms.result) continue;
    const ctx = ms.progress || (ms.progress = missionContext(ms.job, ms.routeIdx, snapTeam(ms.team), false, true));
    if (ctx.environmentNight !== G.night) {
      World.context(ctx); ctx.environmentNight=G.night;
    }
    runMission(ctx, G.night - ms.start + 1);
    if (ctx.waiting) {
      const rt = ms.job.routes[ms.routeIdx];
      out.pending = true;
      out.comms.push({uid:ms.uid, title:ms.job.title, route:rt.name, k:ctx.night, of:ms.job.nights,
        phases:rt, intel:ms.job.intel, pending:true, reason:ctx.alert, kind:ctx.decision || null, who:ctx.maxtac && ctx.maxtac.name,
        lines:ctx.log.slice(ms.shownLog || 0), ends:false});
      save(); return out;
    }
    if (ctx.finished) ms.result = {success:ctx.success,reason:ctx.reason,log:ctx.log,heat:ctx.heat,
      lazarus:ctx.lazarus,rewardMult:ctx.rewardMult,endNight:ctx.endNight,members:teamIds(ctx.team),xp:ctx.xp,credit:ctx.credit,
      costs:ctx.costs,bossLeft:ctx.bossLeft,bossDown:!!ctx.bossDown,spared:!!ctx.spared,
      humLoss:ctx.humLoss||{},custody:ctx.custody||[],armed:ctx.armed||[],wanted:!!ctx.wanted,suppressed:!!ctx.suppressed};
  }
  World.beforeNight(out);
  const heatBefore = { ...G.heat };
  const tonight = new Set(G.missions.flatMap((m) => teamIds(m.team)));

  // 1. 派遣
  const done = [];
  for (const ms of G.missions) {
    const partial = ms.progress;
    const result = ms.result || {log:partial.log,endNight:Infinity};
    const k = G.night - ms.start + 1;
    const ends = k >= result.endNight;
    const rt = ms.job.routes[ms.routeIdx];
    out.comms.push({
      title: ms.job.title, route: rt.name, k, of: ms.job.nights,
      phases: { field: rt.field, net: rt.net }, intel: ms.job.intel, client: ms.job.client,
      lines: result.log.filter((l) => l.night === k), visibleLines: result.log.slice(ms.shownLog || 0).filter(l=>l.night===k), ends, success: ends ? result.success : null,
    });
    if (ends) { out.settle.push(settle(ms, out)); done.push(ms); }
  }
  G.missions = G.missions.filter((m) => !done.includes(m));

  // 2. ランナーの夜
  for (const r of G.runners.slice()) {
    if (r.status === 'therapy') {
      r.therapy--;
      if (r.therapy <= 0) {
        r.status = 'idle';
        r.humanity = Math.min(maxHum(r), r.humanity + 15);
        out.events.push({ kind: 'ok', text: `${r.name}のセラピーが終わった。ヒューマニティ +15` });
      }
    }
    const busy = tonight.has(r.id);
    if (r.status !== 'mission' && !busy) r.hp = Math.min(maxHp(r), r.hp + 3);
    if (r.humanity <= 0) { desert(r, out); continue; }
    if (r.humanity > 15 && r.humanity <= 18) out.events.push({ kind: 'warn', text: `${r.name}の様子がおかしい（人間性${r.humanity}）。15を切ると、交戦のたびに暴走しかねない` });
  }
  // 3. ヒートと襲撃
  // 手を出した企業は冷めない。heatPerNight のある章では全社が毎夜上がる
  const surge = chapter().heatPerNight || 0;
  for (const c of CORPS) {
    if (surge) G.heat[c] = clamp(G.heat[c] + surge, 0, 100);
    else if (!out.touched[c]) G.heat[c] = clamp(G.heat[c] - 1, 0, 100);
  }
  for (const c of CORPS) if (G.heat[c] >= 100) raid(c, out);
  out.heat = CORPS.map((c) => [c, G.heat[c], G.heat[c] - heatBefore[c]]);
  interlude(out);

  // 4. 赤字判定
  if (G.money < 0) {
    G.negStreak++;
    out.events.push({ kind: 'ng', text: `所持金がマイナス。${G.negStreak}夜目（3夜続くと廃業）` });
  } else G.negStreak = 0;
  if (G.negStreak >= 3) G.ended = { type: 'bankrupt' };

  // 5. 翌夜の準備
  G.nightInProgress = false;
  G.night++;
  World.nextNight();
  Run.nextNight(out);
  G.archive.unshift({ night: out.night, comms: out.comms });
  G.archive = G.archive.slice(0, 15);
  G.lastReport = { night: out.night };
  save();
  return out;
}

/* ───────── 契約・闇医者 ───────── */

/* drop を渡すと、その人を隊から外して入れ替える（隊がいっぱいのとき） */
function makeRoom(drop) {
  if (crewSize() < ROSTER_MAX) return null;
  const x = drop && getR(drop);
  if (!x) return `抱えられるのは${ROSTER_MAX}人までです。入れ替える人を選んでください`;
  return fire(x);
}
function hire(i, drop) {
  const r = G.scouts[i];
  if (!r) return '候補が見つかりません';
  const full = makeRoom(drop);
  if (full) return full;
  r.joined = G.night;
  G.runners.push(r); G.scouts.splice(i, 1);
  return null;
}
function fire(r) {
  if (r.status === 'mission') return '仕事中のランナーは切れません';
  const refill = G.run.refill;
  leaveRunner(r);
  G.run.refill = refill; // 自分で外したときは補充の候補を約束しない
  return null;
}

const cyberPrice = (c) => Math.round((CYBER[c].loan[0] * CYBER[c].loan[1] * 0.8 * World.priceMultiplier() * (cone('blackmarket') ? 0.8 : 1)) / 50) * 50;
/* drop を渡すと、その義体を外してから入れる。外した義体は戻らず、人間性も戻らない */
function installCyber(r, c, drop) {
  if (G) G.flags.anyCyber = true;
  const hpRatio = r.hp / maxHp(r), armorLost = armorMax(r) - r.armor;
  r.humanity -= cyberHumanityDelta(r, c);
  r.cyber = r.cyber.filter((x) => cyberLine(x) !== cyberLine(c) && x !== drop);
  r.cyber.push(c);
  r.hp = Math.round(maxHp(r) * hpRatio);
  r.armor = Math.max(0, armorMax(r) - armorLost);
}
/* 義体を外す。枠は空くが、人間性は戻らない */
function removeCyber(r, c) {
  if (r.status === 'mission') return '仕事中です';
  if (!r.cyber.includes(c)) return '入っていません';
  const hpRatio = r.hp / maxHp(r), armorLost = armorMax(r) - r.armor;
  r.cyber = r.cyber.filter((x) => x !== c);
  r.hp = Math.max(r.hp > 0 ? 1 : 0, Math.round(maxHp(r) * hpRatio));
  r.armor = clamp(armorMax(r) - armorLost, 0, armorMax(r));
  return null;
}
function buyCyber(r, c) {
  if (r.status === 'mission') return '仕事中です';
  const blocked = cyberBlocker(r, c);
  if (blocked) return blocked;
  const half = G.vouchers.cyber > 0 ? 0.5 : 1;
  const p = Math.round(cyberPrice(c) * half);
  if (p > G.money) return '所持金が足りません';
  G.money -= p;
  if (half < 1) G.vouchers.cyber--;
  installCyber(r, c);
  return null;
}
const gearPrice = (id) => Math.round((GEAR[id].price * (cone('blackmarket') ? 0.8 : 1)) / 50) * 50;
const gearRefund = (id) => Math.round(GEAR[id].price / 2 / 50) * 50;
/* 同じ部位の装備は入れ替え。前の装備は半額で下取りし、払った側に戻す */
function equipGear(r, id) {
  const g = GEAR[id], old = r.gear[g.slot];
  const hpRatio = r.hp / maxHp(r), armorLost = armorMax(r) - r.armor;
  r.gear[g.slot] = id;
  r.hp = Math.round(maxHp(r) * hpRatio);
  r.armor = Math.max(0, armorMax(r) - armorLost);
  return old ? gearRefund(old) : 0;
}
function buyGear(r, id) {
  const g = GEAR[id];
  if (!g) return '装備が見つかりません';
  if (r.status === 'mission') return '仕事中です';
  if (r.gear[g.slot] === id) return 'もう持っています';
  const p = gearPrice(id);
  if (p > G.money) return '所持金が足りません';
  G.money -= p;
  G.money += equipGear(r, id);
  return null;
}
const treatCost = (r) => (maxHp(r) - r.hp) * 20;
const repairCost = (r) => (armorMax(r) - r.armor) * 40;
const THERAPY_COST = 600;
const THERAPY_NIGHTS = 1;
function treat(r) {
  const c = treatCost(r);
  if (r.status !== 'idle') return '今は治療できません';
  if (c > G.money) return '所持金が足りません';
  G.money -= c; r.hp = maxHp(r);
  return null;
}
function repair(r) {
  const c = repairCost(r);
  if (r.status === 'mission') return '仕事中です';
  if (c > G.money) return '所持金が足りません';
  G.money -= c; r.armor = armorMax(r);
  return null;
}
function therapy(r) {
  if (r.status !== 'idle') return '今は受けられません';
  if (r.humanity >= maxHum(r)) return 'ヒューマニティは減っていません';
  if (THERAPY_COST > G.money) return '所持金が足りません';
  G.money -= THERAPY_COST; r.status = 'therapy'; r.therapy = THERAPY_NIGHTS;
  return null;
}

function chooseEnding(key) {
  G.awaitEnding = false;
  if (key === 'publish') { G.cred += 50; for (const c of CORPS) G.heat[c] = 100; }
  if (key === 'sell') G.money += 40000;
  G.ended = { type: key };
  Run.finish();
  clearSave();
}
