/* FIXER'S CUT — 画面と操作 */

const UI = {
  tab: 'home', job: null, route: 0, team: {}, doc: null, shop: null, cyCat: 'all', ask: null, help: false,
  toast: '', toastT: 0, flow: null, modalKey: '', timer: 0, play: null, est: { key: '', val: null },
};
const app = document.getElementById('app');
const modal = document.getElementById('modal');
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 表示の好み（ゲームのセーブとは別に、ブラウザに残す） */
const PREF_KEY = 'fixers-cut-prefs-v1';
const LOG_SPEED = { slow: ['ゆっくり', 320], normal: ['ふつう', 170], fast: ['速く', 60], instant: ['一瞬', 0] };
const prefs = loadPrefs();
function loadPrefs() {
  const p = { speed: 'normal', hints: true };
  try { Object.assign(p, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* 読めない環境では既定値 */ }
  if (!LOG_SPEED[p.speed]) p.speed = 'normal';
  return p;
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* 保存できない環境では無視 */ }
}
const instantLog = () => reduced || prefs.speed === 'instant';
/* 初めての人向けの説明（.hint）は、隠れ家上部のボタンでまとめて隠せる */
const applyHints = () => document.body.classList.toggle('no-hints', !prefs.hints);
const hintButton = () => `<button data-act="hints" aria-pressed="${prefs.hints}" title="初めての人向けの説明を表示する">説明 ${prefs.hints ? 'オン' : 'オフ'}</button>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cr = (n) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}cr`;
const sgn = (n) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;

function toast(msg) {
  UI.toast = msg;
  clearTimeout(UI.toastT);
  UI.toastT = setTimeout(() => { UI.toast = ''; renderToast(); }, 3200);
  renderToast();
}
function renderToast() {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = UI.toast;
  t.hidden = !UI.toast;
}

/* ───────── 共通部品 ───────── */

function statusText(r) {
  if (r.status === 'mission') return '派遣中';
  if (r.status === 'therapy') return `セラピー中（あと${r.therapy}夜）`;
  if (r.hp <= 0) return '重体（出せない）';
  return '待機中';
}
const contactText = (r) => `${CLIENTS[r.contact].short}に顔が利く`;

function bars(r) {
  const mh = maxHp(r), am = armorMax(r), hm = maxHum(r);
  const z = humZone(r.humanity);
  const pct = (a, b) => clamp((a / b) * 100, 0, 100);
  return `<div class="bars">
    <div class="bar"><span>HP</span><div class="track"><i class="${r.hp < mh / 2 ? 'low' : ''}" style="width:${pct(r.hp, mh)}%"></i></div><b class="num">${r.hp}/${mh}</b></div>
    <div class="bar"><span>防具</span><div class="track ar"><i style="width:${pct(r.armor, am)}%"></i></div><b class="num">${r.armor}/${am}</b></div>
    <div class="bar"><span>人間性</span><div class="track hum" style="--z1:${pct(15, hm)}%;--z2:${pct(30, hm)}%"><i style="width:${pct(Math.max(0, r.humanity), hm)}%"></i></div><b class="num">${r.humanity}/${hm}</b></div>
    <div class="zone z-${z.key}">${z.name}</div>
  </div>`;
}

function perkLine(r) {
  const p = ROLES[r.role].perk;
  if (r.perk) return `<div class="perk on"><span class="label">技能</span> ${p.name}：${p.desc}${r.perkUses ? ` <span class="num">（これまでに${r.perkUses}回効いた）</span>` : ''}</div>`;
  return `<div class="perk"><span class="label">技能</span> 格上（R2以上）の成功 <span class="num">${Math.min(r.elite, 3)}/3</span> で「${p.name}」</div>`;
}

function runnerCard(r, mode, idx) {
  const R = ROLES[r.role];
  const xpOf = (k) => (r.skills[k] || 0) >= SKILL_CAP ? 1 : ((r.xp || {})[k] || 0) / xpNeed(r.skills[k] || 0, r);
  const skills = SKILLS.filter((k) => skill(r, k) > 0).map((k) => `<span title="次の上昇まで ${Math.round(xpOf(k) * 100)}%">${k}<b class="num">${skill(r, k)}</b>${mode === 'scout' ? '' : `<i class="xp"><i style="width:${Math.round(xpOf(k) * 100)}%"></i></i>`}</span>`).join('');
  const gear = Object.values(r.gear || {}).filter((id) => GEAR[id]);
  let contract = '', actions = '';
  if (mode === 'roster') {
    contract = r.contract === 'exclusive'
      ? `<div class="contract"><span class="chip b">専属</span> 手当 <b class="num">${r.stipend}cr</b>/夜 ・ 忠誠 <b class="num">${r.loyalty}</b>${r.loyalty < 25 ? ' <span class="pink">離れそう</span>' : ''}</div>`
      : `<div class="contract"><span class="chip o">歩合</span> 分け前の希望 <b class="num">${fmt(demand(r))}cr</b>以上 ・ 手持ち <b class="num">${fmt(r.wallet)}cr</b>${r.discontent ? ` ・ <span class="pink">不満 ${r.discontent}</span>` : ''}</div>`;
    const busy = r.status === 'mission';
    const toggle = r.contract === 'exclusive'
      ? `<button data-act="contract" data-r="${r.id}" data-v="commission" ${busy ? 'disabled' : ''}>歩合に戻す</button>`
      : `<button data-act="contract" data-r="${r.id}" data-v="exclusive" ${busy ? 'disabled' : ''}>専属にする（${stipendFor(r)}cr/夜）</button>`;
    const fire = UI.ask === 'fire' + r.id
      ? `<button class="danger" data-act="fire" data-r="${r.id}">本当に契約を切る</button>`
      : `<button data-act="askfire" data-r="${r.id}" ${busy ? 'disabled' : ''}>契約を切る</button>`;
    actions = `<div class="actions">${toggle}${fire}</div>`;
  } else if (mode === 'scout') {
    const st = stipendFor(r);
    const prefNote = { any: 'どちらの契約でもいい', commission: '歩合でしか組まない', exclusive: '専属でなければ組まない' }[r.pref];
    contract = `<div class="contract">${prefNote} ・ 専属なら手当 <b class="num">${st}cr</b>/夜 ・ 歩合なら分け前 <b class="num">${fmt(demand(r))}cr</b>以上を希望</div>`;
    actions = `<div class="actions">
      <button data-act="hire" data-v="${idx}" data-c="commission" ${r.pref === 'exclusive' ? 'disabled' : ''}>歩合で雇う</button>
      <button class="primary" data-act="hire" data-v="${idx}" data-c="exclusive" ${r.pref === 'commission' ? 'disabled' : ''}>専属で雇う</button>
    </div>`;
  }
  return `<article class="runner ${mode} ${r.status === 'mission' ? 'away' : ''} ${r.trait ? 'r-' + TRAITS[r.trait].rarity : ''}">
    <header>
      ${portraitImg(r, 'lg')}
      <div class="nmrow"><b class="nm">${esc(r.name)}</b>${r.story ? '<span class="chip p">物語つき</span>' : ''}${r.trait ? `<span class="chip trait ${TRAITS[r.trait].rarity}">${TRAITS[r.trait].rarity === 'legend' ? '超希少' : '希少'}・${TRAITS[r.trait].name}</span>` : ''}${r.lazarus ? '<span class="chip b">ラザロ</span>' : ''}</div>
      <span class="role">${R.tag}<small>${R.name}</small></span>
    </header>
    <div class="meta">${ORIGINS[r.origin].name} ・ ${contactText(r)}${mode === 'roster' ? ` ・ <span class="st st-${r.status}${r.hp <= 0 ? ' st-down' : ''}">${statusText(r)}</span>` : ''}</div>
    ${mode !== 'doc' ? `<p class="bio">${esc(r.bio || R.desc)}</p>` : ''}
    ${r.trait ? `<div class="traitline">${TRAITS[r.trait].desc}</div>` : ''}
    ${bars(r)}
    <div class="stats">${STATS.map((k) => `<span><i>${k}</i><b class="num">${stat(r, k)}</b></span>`).join('')}</div>
    <div class="skills">${skills}</div>
    ${r.cyber.length ? `<div class="cy"><span class="label">義体</span> ${r.cyber.map((c) => CYBER[c].name).join('、')}</div>` : ''}
    ${gear.length ? `<div class="cy"><span class="label">装備</span> ${gear.map((id) => GEAR[id].name).join('、')}</div>` : ''}
    ${mode === 'roster' ? perkLine(r) + World.perkHtml(r) : ''}
    ${contract}
    ${actions}
  </article>`;
}

/* ───────── 上部・下部 ───────── */

/* 行き先の画面。その夜に選んだ行き先の画面だけ開く */
const DEST_TABS = { board: '依頼', doc: '闇医者', shop: '古物屋', scout: '路地裏', event: '事件' };
function tabList() {
  const t = Run.tonightTab();
  return [['home', '地区マップ'], ['crew', '隊'], ...(t ? [[t, DEST_TABS[t]]] : []), ['log', '記録']];
}
function hud() {
  const tabs = tabList();
  const badge = { scout: G.scouts.length, board: G.board.length };
  const run = G.run, A = Run.act();
  return `<header class="hud"><div class="hud-in">
    <div class="brand"><span class="logo">FIXER'S CUT</span><span class="label">${A.name} ・ ${A.place}</span></div>
    ${Comfort.soundButton()}${hintButton()}${helpButton()}<dl class="hud-stats">
      <div><dt class="label">夜</dt><dd class="num">${run.slot}/4 <span class="dim">通算${G.night}</span></dd></div>
      <div class="${G.money < 0 ? 'neg' : ''}"><dt class="label">所持金</dt><dd class="num">${cr(G.money)}${G.negStreak ? ` <span class="chip p">赤字 ${G.negStreak}/3</span>` : ''}</dd></div>
      <div><dt class="label">隊</dt><dd class="num">${G.runners.length}人</dd></div>
    </dl>
    <div class="heat" aria-label="企業ごとのヒート">${CORPS.map((c) => `<div class="hb ${G.heat[c] >= 80 ? 'hot' : ''}"><span>${logo(c)}${CLIENTS[c].short}</span><div class="ht"><i style="width:${G.heat[c]}%"></i></div><b class="num">${G.heat[c]}</b></div>`).join('')}</div>
  </div>
  <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-v="${k}">${l}${badge[k] ? `<span class="bd num">${badge[k]}</span>` : ''}</button>`).join('')}</nav>
  </header>`;
}

function dock() {
  const up = upkeepItems().reduce((a, b) => a + b[1], 0);
  const after = G.money - up;
  return `<div class="dock"><div class="dock-in">
    <div class="proj">
      <span class="label">夜明けの見込み</span>
      <span class="num">${cr(G.money)} − ${fmt(up)} ＝ <b class="${after < 0 ? 'pink' : ''}">${cr(after)}</b></span>
      <small>${!Run.canEndNight() ? '先に地区マップで今夜の行き先を決める' : G.missions.length ? `派遣中${G.missions.length}件の報酬は含みません` : '今夜は誰も出ていません'}</small>
    </div>
    <button class="primary big" data-act="night" ${Run.canEndNight() ? '' : 'disabled title="地区マップで今夜の行き先を決めてください"'}>夜を明かす</button>
  </div></div>`;
}

/* ───────── 隠れ家 ───────── */

/* 行き先の中身：依頼なら依頼主・標的・夜数・報酬・必須ロール */
function nodeMeta(info) {
  if (!info.client) return '';
  return `<span class="nm2">${logo(info.client)}${CLIENTS[info.client].short}${info.target ? ` → ${logo(info.target)}${CLIENTS[info.target].short}` : ''}</span>
    <span class="num">${info.nights}夜 ・ ${fmt(info.payout)}cr</span>
    ${info.req && info.req.length ? `<span class="req">${info.req.map((r) => `<span>${ROLES[r].name}</span>`).join('')}</span>` : ''}`;
}

function mapNode(n, i, slot) {
  const run = G.run, info = Run.nodeInfo(n);
  const now = slot === run.slot && !run.tonight;
  const picked = run.picked[slot] === i || (slot === run.slot && run.tonight && run.tonight.type === n.type && n.type === 'boss');
  const past = slot < run.slot && !picked;
  const sel = now && UI.mapSel === i;
  const tags = [n.type === 'hard' ? '<span class="chip p">危険</span>' : '', n.type === 'boss' && run.retried && slot === run.slot ? '<span class="chip p">再挑戦</span>' : ''].join('');
  return `<button class="node n-${n.type}${picked ? ' picked' : ''}${past ? ' past' : ''}${sel ? ' sel' : ''}" data-act="mapsel" data-v="${i}" ${now ? '' : 'disabled'}>
    <span class="mk" aria-hidden="true">${info.mark}</span>
    <span class="nb"><b>${info.name}</b>${tags}${info.title ? `<span class="nt">${esc(info.title)}</span>` : ''}${nodeMeta(info)}</span>
  </button>`;
}

function tonightPanel() {
  const run = G.run, t = run.tonight;
  if (!t) {
    const n = UI.mapSel != null && run.map[run.slot][UI.mapSel];
    if (!n) return `<section class="panel tonight"><h3>今夜の行き先を選ぶ</h3><p class="dim">${run.slot}夜目の行き先から1つを選びます。決めたら取り消せません。</p></section>`;
    const info = Run.nodeInfo(n);
    return `<section class="panel tonight"><h3>${info.name}${info.title ? `：${esc(info.title)}` : ''}</h3><p>${info.desc}</p>
      <div class="actions"><button class="primary big" data-act="go" data-v="${UI.mapSel}">今夜はここへ行く</button></div></section>`;
  }
  const d = Run.DEST[t.type], tab = d.tab;
  const ms = t.type === 'cont' && G.missions[0];
  const body = t.type === 'cont' ? `${ms ? `「${esc(ms.job.title)}」の2夜目。` : ''}今夜は派遣の続きを待つだけです。`
    : t.note ? esc(t.note)
    : tab === 'board' && !G.board.length ? '送り出しました。夜を明かすと通信が届きます。'
    : d.desc;
  return `<section class="panel tonight on"><h3><span class="label">今夜</span> ${d.name}</h3><p>${body}</p>
    ${tab && !(tab === 'board' && !G.board.length) ? `<div class="actions"><button class="primary" data-act="tab" data-v="${tab}">${DEST_TABS[tab]}を開く</button></div>` : ''}</section>`;
}

function viewHome() {
  const run = G.run;
  const acts = [1, 2, 3].map((a) => `<li class="${a < run.act ? 'done' : a === run.act ? 'cur' : ''}"><span class="label">${Run.ACTS[a].name}</span><b>${Run.ACTS[a].place}</b></li>`).join('');
  const cols = [1, 2, 3, 4].map((slot) => `<div class="mcol ${slot < run.slot ? 'past' : slot === run.slot ? 'now' : ''}">
      <div class="mh"><span class="label">${slot === 4 ? '大仕事' : `${slot}夜目`}</span>${slot === run.slot ? '<span class="chip p">今夜</span>' : ''}</div>
      ${run.map[slot].map((n, i) => mapNode(n, i, slot)).join('')}
    </div>`).join('');
  const up = upkeepItems();
  const missions = G.missions.length
    ? G.missions.map((m) => {
      const k = G.night - m.start + 1;
      const names = teamIds(m.team).map((id) => (getR(id) || {}).name).filter(Boolean).join('、');
      return `<li><b>${esc(m.job.title)}</b><span>${m.job.routes[m.routeIdx].name} ・ ${names}</span><span class="num dim">${k}/${m.job.nights}夜目${m.result ? '' : '（今夜出発）'}</span>${m.result || m.progress ? '' : `<button class="sm" data-act="recall" data-v="${m.uid}">取り消す</button>`}</li>`;
    }).join('')
    : '<li class="dim">今夜はまだ誰も出ていません。</li>';
  const tut = run.act === 1 && G.night <= 2 ? `<section class="panel tut hint"><h3>ランの進め方</h3><ol>
      <li>1ランは<b>3幕・12夜</b>。毎夜、地区マップから<b>行き先を1つ</b>選ぶ。先の夜まで見えるので、道を考えて選ぶ</li>
      <li><b>依頼</b>で派遣して稼ぐ。<b>路地裏</b>で雇い、<b>闇医者</b>と<b>古物屋</b>で強くし、<b>隠れ家</b>で立て直す</li>
      <li>各幕の4夜目は<b>大仕事</b>。失敗しても次の夜に一度だけ挑み直せる。2度目も失敗するとランは終わる</li>
      <li>第1幕の大仕事には<b>ネットランナー</b>が要る。路地裏で探しておくこと</li>
      <li>所持金が3夜続けてマイナス、または隊が全滅しても終わり</li>
    </ol></section>` : '';
  return `
  <section class="chapter">
    <div class="label">RUN ・ ${Run.act().name} ・ ${Run.act().place}${G.flags.ally ? ` ・ <span class="blue">${logo(G.flags.ally)}${CLIENTS[G.flags.ally].short}と協力中</span>` : ''}</div>
    <ol class="acts">${acts}</ol>
  </section>
  ${tut}
  <section class="map" aria-label="地区マップ"><div class="mcols">${cols}</div></section>
  ${tonightPanel()}
  ${World.homeHtml()}
  <div class="cols">
    <section class="panel"><h3>派遣中</h3><ul class="mlist">${missions}</ul></section>
    <section class="panel"><h3 class="pink">毎晩、確実に出ていく</h3>
      <dl class="ledger">${up.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd class="num">${fmt(v)}</dd></div>`).join('')}
      <div class="tot"><dt>合計</dt><dd class="num">${fmt(up.reduce((a, b) => a + b[1], 0))}cr</dd></div></dl>
      ${G.vouchers.intel ? `<p class="dim">手持ちの券：情報無料 ×${G.vouchers.intel}</p>` : ''}
    </section>
    <section class="panel hint"><h3>ヒート</h3>
      <div class="heatlist">${CORPS.map((c) => `<div class="hrow ${G.heat[c] >= 80 ? 'hot' : ''}"><span>${CLIENTS[c].name}</span><div class="ht"><i style="width:${G.heat[c]}%"></i></div><b class="num">${G.heat[c]}</b></div>`).join('')}</div>
      <p class="dim">企業の依頼を受けると、ほかの企業のヒートが上がります。80を超えた社の依頼は敵+1、100で隠れ家が襲撃されます。${chapter().heatPerNight ? `<span class="pink">この幕のあいだは、全企業が毎夜+${chapter().heatPerNight}。</span>` : '手を出さなかった企業は、毎夜1ずつ冷めます。'}</p>
    </section>
  </div>`;
}

/* ───────── 隊 ───────── */

function viewCrew() {
  return `<section class="roster">
    <h2 class="sec">隊 <span class="label num">${G.runners.length}/${ROSTER_MAX}</span></h2>
    <div class="runners">${G.runners.map((r) => runnerCard(r, 'roster')).join('') || '<p class="dim">誰もいません。路地裏で雇ってください。</p>'}</div>
  </section>
  ${G.memorial.length ? `<section class="panel memorial"><h3>帰ってこなかった者</h3><ul>${G.memorial.map((m) => `<li><b>${esc(m.name)}</b>（${ROLES[m.role].name}） 夜${m.night}・${esc(m.cause)}</li>`).join('')}</ul></section>` : ''}`;
}

/* ───────── 事件 ───────── */

function viewEvent() {
  const ev = G.run.event;
  if (!ev) return '<section><h2 class="sec">事件</h2><p class="dim">今夜は何も起きていません。</p></section>';
  const E = Run.EVENTS[ev.key];
  return `<section class="event panel">
    <div class="label">INCIDENT ・ ヨミハマ</div>
    <h2>${E.title}</h2>
    <p class="story">${E.body}</p>
    ${ev.done ? `<p class="verdict ok">${esc(ev.done)}</p><p class="dim">夜を明かすと、次の夜へ進みます。</p>`
      : `<div class="bonus">${E.opts.map((o, i) => `<button data-act="eventopt" data-v="${i}" ${o.cost && o.cost > G.money ? 'disabled' : ''}><span class="label">${o.label}${o.cost ? `（${fmt(o.cost)}cr）` : ''}</span>${o.text}</button>`).join('')}</div>`}
  </section>`;
}

/* ───────── スカウト ───────── */

function viewScout() {
  return `<section>
    <h2 class="sec">路地裏 <span class="label">今夜の候補</span></h2>
    <p class="lead hint">候補は今夜かぎりです。隊にいないロールが先に並びます。<b>歩合</b>は毎晩の支払いがなく、分け前は本人のもの。忠誠は上がらず、不満がたまると引き抜かれます。<b>専属</b>は待機中も手当がかかるかわりに、分け前がフィクサーに入り、義体や装備もフィクサーの所持金で買えます。</p>
    <p class="dim">抱えているランナー ${G.runners.length}/${ROSTER_MAX}人</p>
    <div class="runners">${G.scouts.map((r, i) => runnerCard(r, 'scout', i)).join('') || '<p class="dim">今夜の候補はもういません。</p>'}</div>
  </section>`;
}

/* ───────── ルール（能力値と派遣中の判定） ───────── */

const STAT_HELP = {
  BODY: `最大HP（11＋BODY×4）。HPが0になったときの死亡セーブもBODYで決まる`,
  REF: '反射神経',
  INT: '頭の回転と注意力',
  TECH: '機械と医療の腕',
  COOL: '度胸と落ち着き',
  EMP: '人間性の上限（EMP×10。資質で変わる）。判定には使わない',
};
const helpButton = () => '<button data-act="help" title="能力値と派遣中の判定ルール">ルール</button>';

function stepHelp() {
  const used = (k) => SKILLS.filter((s) => SKILL_STAT[s] === k);
  const stats = STATS.map((k) => `<div><dt><b>${k}</b></dt><dd>${used(k).length ? `${used(k).join('・')}の判定に使う。` : ''}${STAT_HELP[k]}</dd></div>`).join('');
  const phases = Object.values(PH_FX).map((v) => `<li>${v}</li>`).join('');
  const ice = Object.entries(ICE_FX).map(([k, v]) => `<li class="blue">${{ cam: 'カメラ網', door: '扉の制御', alarm: '警報系', trace: '逆探知', data: 'データ' }[k]}：${v}</li>`).join('');
  const ranks = Object.entries(RANK_ENEMY).map(([k, e]) => `<div><dt>ランク${k}</dt><dd class="num">DV${e.dv}・攻撃${e.atk}・${e.dice}d6+${e.plus}</dd></div>`).join('');
  return `<div class="label">RULES</div><h2>能力値と派遣中の判定</h2>
  <div class="help">
    <h3>能力値</h3>
    <dl class="ledger hstat">${stats}</dl>
    <p class="dim">技能は能力値に足して使う。義体と装備は能力値か技能に加わる。</p>

    <h3>判定</h3>
    <p class="calc"><b>能力＋技能＋補正＋d10 ≧ DV</b> で成功</p>
    <ul>
      <li>d10で10が出たら、もう1回d10を足す。1が出たら、d10を1回引く</li>
      <li>HPが最大の半分未満だと−2（${CYBER.painblock.name}で無視できる）</li>
      <li>補正：${ROLES.net.perk.name}（ICE＋2）、${ROLES.driver.perk.name}（運転＋3）、ネット設備・車庫、専用技能、今夜のニュースと地区の状況</li>
      <li>判定は、その技能の「能力＋技能」がいちばん高い人が受け持つ。通信の計算式で中身を確かめられる</li>
      <li>判定に使った技能には経験がたまる</li>
    </ul>

    <h3>派遣の流れ</h3>
    <ul>
      <li>左の列から1つずつ、<b class="blue">ネット</b>→<b>現場</b>の順に進む。5列で1夜</li>
      <li>隠密・罠は現場の人だけ。扉・説得・医療は現場と支援、運転・逃走は支援と現場から選ばれる</li>
      <li>ネットはネット枠の1人が受け持つ。いなければ自動で失敗。DV17以上のICEに失敗すると黒ICEの逆流（2d6、防具無視）。データは2回まで挑める</li>
      <li>現場の「目標」とネットの「データ」をすべて確保して、最後まで撤退しなければ成功</li>
    </ul>
    <ul class="legend">${phases}${ice}</ul>

    <h3>交戦</h3>
    <ul>
      <li>現場の全員が順に<b>射撃</b>（敵のDV）。当たれば1体倒す。${ROLES.solo.perk.name}のソロは2回撃つ</li>
      <li>残った敵が1体ずつ、現場の誰かを攻撃。<b>回避</b>（敵の攻撃値）に失敗すると被弾</li>
      <li>3ラウンドで倒しきれないか、現場の全員が倒れると撤退。追撃戦は支援も戦う</li>
      <li>情報を買わずに「???」の交戦に当たると待ち伏せ。敵が先に撃つ</li>
      <li>人間性15以下のランナーが敵を倒すと、ときどき過剰な暴力でヒート＋4（テーザーは別）</li>
    </ul>
    <p class="dim">通常兵の基準値。依頼によっては交戦ごとに敵のDVが違い、情報を買うと見える。</p>
    <dl class="ledger">${ranks}</dl>
    <ul class="legend">
      <li>${World.enemies.armored}：DV・攻撃＋2。2発で倒れる。テックか徹甲ライフルがあれば1発</li>
      <li>${World.enemies.sniper}：DV・攻撃＋2。知覚DV18で見つけないと、先に3d6+5を撃ってくる</li>
      <li>${World.enemies.hacker}：DV・攻撃＋2。ネット担当にICE攻撃（インターフェースDV18、失敗で2d6）。ネット担当がいないと増援</li>
      <li>${World.enemies.swarm}：2体多い。DV・攻撃−1、ダメージは2d6</li>
    </ul>

    <h3>負傷と死亡セーブ</h3>
    <ul>
      <li>被弾のダメージから防具を引いた分だけHPが減る。防具を上回る傷を受けると防具が1減る</li>
      <li>HPが0になると死亡セーブ。d10が<b>BODY＋補正</b>未満なら生き延びるが、その依頼ではもう動けない</li>
      <li>死亡セーブの補正：メドテックの同行＋1、${ROLES.med.perk.name}＋2、人工心臓＋2（弐は＋3）</li>
      <li>失敗すると死亡。救急サブスク「ラザロ」の加入者は回収される（回収費は報酬額の30%）</li>
      <li>休息：全員がd6+2回復。メドテックがいれば医療の半分を足す。${CYBER.medkit.name}を入れた本人は＋5</li>
    </ul>

    <h3>続行と撤退</h3>
    <ul>
      <li>現場の誰かが重傷（HP半分未満）になったとき、死亡セーブを生き延びたとき、警報が鳴ったときに、続行か撤退かを選べる。1件の派遣で2回まで</li>
      <li>撤退は報酬なしの失敗扱い。続行すると、済んだ判定は振り直さない</li>
    </ul>
  </div>
  <div class="mact"><button class="primary" data-act="closehelp">閉じる</button></div>`;
}

/* ───────── 依頼盤 ───────── */

const PH_DV = {
  sneak: (p) => `隠密 DV${p.dv}`, trap: (p) => `知覚 DV${p.dv}`, combat: (p) => `敵${p.n}・${World.enemies[p.enemyType || 'standard']}`, rest: () => 'HP回復',
  gate: (p) => `電子 DV${p.dv}`, goal: () => '目標', escape: (p) => `運転 DV${p.dv}`, drive: (p) => `運転 DV${p.dv}`,
  talk: (p) => `説得 DV${p.dv}`, med: (p) => `医療 DV${p.dv}`, boss: () => '耐久3', ice: (p) => `ICE DV${p.dv}`,
};
const PH_FX = {
  sneak: '隠密：失敗で次の交戦に敵+1、ヒート+4',
  trap: '罠：失敗で警報（ヒート+8・次の交戦に敵+1）と被害',
  combat: '交戦：3ラウンドで倒しきれなければ撤退。情報を買わずに「???」の交戦に当たると待ち伏せされる',
  gate: '扉：3回まで挑戦。開かなければ撤退',
  escape: '逃走：失敗で追手と交戦',
  drive: '運転：失敗で報酬−20%、次の交戦に敵+1',
  talk: '説得：失敗で交戦',
  med: '医療：失敗で報酬−40%',
  rest: '休息：全員のHPが回復。メドテックがいると多め',
  boss: '元部下：耐久3。腕は本物',
};

function phaseCell(p, i, job) {
  if (!p) return `<div class="ph empty"><i>${i + 1}</i>—</div>`;
  if (p.hidden && !job.intel) return `<div class="ph fog"><i>${i + 1}</i><span class="q">???</span></div>`;
  const cls = { combat: 'enemy', boss: 'enemy', goal: 'goal', ice: 'ice', trap: 'trap' }[p.t] || '';
  return `<div class="ph ${cls}${p.fx === 'data' ? ' netgoal' : ''}${p.hidden ? ' bought' : ''}"><i>${i + 1}</i>${esc(p.l)}<span class="dv">${p.t === 'combat' && !job.intel ? `敵${p.n}・???` : PH_DV[p.t](p)}</span></div>`;
}

function phaseTable(job, ri) {
  const r = job.routes[ri];
  const len = r.field.length;
  const types = new Set(), fx = new Set();
  for (const p of r.field) if (p && !(p.hidden && !job.intel)) types.add(p.t);
  for (const p of r.net) if (p && !(p.hidden && !job.intel)) fx.add(p.fx);
  const hasNet = r.net.some(Boolean);
  const legend = [...types].filter((t) => PH_FX[t]).map((t) => `<li>${PH_FX[t]}</li>`).join('')
    + [...fx].map((f) => `<li class="blue">ネット：${{ cam: 'カメラ網', door: '扉の制御', alarm: '警報系', trace: '逆探知', data: 'データ' }[f]}　${ICE_FX[f]}</li>`).join('');
  return `<div class="strip-wrap"><div class="strip" style="--cols:${len}">
    <div class="lane">現場</div>${r.field.map((p, i) => phaseCell(p, i, job)).join('')}
    ${hasNet ? `<div class="lane">ネット</div>${r.net.map((p, i) => phaseCell(p, i, job)).join('')}` : ''}
    ${len > 5 ? '<div></div><div class="nightlbl">1夜目</div><div class="nightlbl">2夜目</div>' : ''}
  </div></div>
  <ul class="legend hint">${legend}${hasNet ? '' : '<li class="dim">この依頼にネットのフェーズはありません</li>'}</ul>`;
}

function getTeam(uid) {
  const t = UI.team[uid] || (UI.team[uid] = { field: [], support: [], net: [] });
  for (const k of ['field', 'support', 'net']) t[k] = t[k].filter((id) => { const r = getR(id); return r && available(r); });
  return t;
}
function laneOf(team, id) {
  for (const k of ['field', 'support', 'net']) if (team[k].includes(id)) return k;
  return null;
}

function formation(job, team) {
  const lane = (k) => `<div class="slot"><span class="label">${LANE[k]} ${team[k].length}/${LANE_MAX[k]}</span>
    <div class="who">${team[k].map((id) => `<span>${esc(getR(id).name)}</span>`).join('') || '<span class="dim">—</span>'}</div>
    <small class="hint">${{ field: '交戦・隠密・罠・扉', support: '運転・逃走・手当て。交戦には出ない', net: 'ICE。ネットランナーだけ' }[k]}</small></div>`;
  const all = teamIds(team).map(getR);
  const req = job.req.map((role) => {
    const ok = role === 'net' ? team.net.length > 0 : all.some((r) => r.role === role);
    return `<span class="chip ${ok ? 'b' : 'p'}">${ok ? '済' : '要'} ${ROLES[role].name}</span>`;
  }).join('');
  const rows = G.runners.map((r) => {
    const ln = laneOf(team, r.id);
    const can = available(r);
    const seg = can
      ? `<div class="seg" role="group" aria-label="${esc(r.name)}の枠">${['field', 'support', 'net'].map((s) => `<button data-act="assign" data-r="${r.id}" data-v="${s}" aria-pressed="${ln === s}" ${s === 'net' && r.role !== 'net' ? 'disabled' : ''}>${LANE[s]}</button>`).join('')}<button data-act="assign" data-r="${r.id}" data-v="none" aria-pressed="${!ln}">外す</button></div>`
      : `<small class="dim">${statusText(r)}</small>`;
    const hurt = r.hp < maxHp(r) / 2 ? ' <span class="pink">重傷 −2</span>' : '';
    return `<div class="pick ${ln ? 'in' : ''} ${can ? '' : 'off'}">
      <div class="pn">${portraitImg(r, 'sm')}<b>${esc(r.name)}</b><span class="role sm">${ROLES[r.role].tag}</span><span class="num dim">HP ${r.hp}/${maxHp(r)}${hurt}</span><span class="dim">${r.contract === 'exclusive' ? '専属' : '歩合'}</span></div>
      ${seg}</div>`;
  }).join('');
  return `<div class="actions"><button data-act="usualTeam" data-v="${job.uid}" ${G.lastTeam ? '' : 'disabled'}>いつもの面子</button></div>
    <div class="slots">${lane('field')}${lane('support')}${lane('net')}</div>
    ${job.req.length ? `<div class="reqs"><span class="label">必須ロール</span>${req}</div>` : ''}
    <div class="picks">${rows || '<p class="dim">ランナーがいません。</p>'}</div>`;
}

function estBox(job, team) {
  if (!team.field.length) return '<div class="est empty"><span class="dim">現場に1人以上入れると、成功の見込みが出ます。</span></div>';
  const key = `${job.uid}|${UI.route}|${job.intel}|${JSON.stringify(team)}|${teamIds(team).map((id) => { const r = getR(id); return r.hp + '.' + r.armor + '.' + r.cyber.length; }).join(',')}`;
  if (UI.est.key !== key) UI.est = { key, val: estimate(job, UI.route, team) };
  const { p, death, skills, causes } = UI.est.val;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const band = (x) => (x >= 0.85 ? 'hi' : x >= 0.6 ? 'mid' : 'lo');
  const rows = skills.map((x) => `<li class="${band(x.p)}"><span>${x.sk === '回避' ? '回避<small class="dim">被弾</small>' : x.sk}<small class="dim">${esc(x.who)}</small></span><i class="meter"><i style="width:${pct(x.p)}"></i></i><b class="num">${pct(x.p)}</b><small class="dim num">${x.per >= 1 ? `×${Math.round(x.per)}` : ''}</small></li>`).join('');
  const why = causes.filter((c) => c.p >= 0.03).map((c) => `<li>${esc(c.reason)} <b class="num">${pct(c.p)}</b></li>`).join('');
  return `<div class="est">
    <div><span class="label">成功の見込み</span><b class="num">${pct(p)}</b></div>
    <div><span class="label">誰かが死ぬ確率</span><b class="num ${death > 0.05 ? 'pink' : ''}">${pct(death)}</b></div>
    <small>${job.intel ? '情報込みの見積もりです。' : 'まだ見えていない「???」は入っていない、甘めの見積もりです。'}</small>
    ${rows ? `<div class="odds"><span class="label">判定ごとの成功率 ・ 担当</span><ul>${rows}</ul><small class="hint dim">低い判定ほど全体の足を引っぱります。技能が伸びる・装備を買う・担当を替えると上がります。</small></div>` : ''}
    ${why ? `<div class="odds"><span class="label">失敗するとき</span><ul class="why">${why}</ul></div>` : ''}
  </div>`;
}

function payBox(job, team) {
  if (!teamIds(team).length) return '';
  const pp = payPreview(job, team);
  const rows = pp.rows.map((x) => `<div><dt>${esc(x.r.name)}の分け前 <span class="dim">${x.excl ? '専属：フィクサーへ' : `歩合：本人へ（希望 ${fmt(demand(x.r))}）`}</span>${x.short ? ' <span class="pink">不満</span>' : ''}</dt><dd class="num">${fmt(x.per)}</dd></div>`).join('');
  const heat = [];
  if (job.target && CLIENTS[job.target].kind === 'corp') heat.push(`${CLIENTS[job.target].short} +${job.heat}`);
  if (CLIENTS[job.client].kind === 'corp') for (const c of CORPS) if (c !== job.client && c !== job.target) heat.push(`${CLIENTS[c].short} +${job.rank * 3}`);
  const cnt = G.repeats[job.tpl] || 0;
  const cred = job.special ? job.cred : cnt === 0 ? job.cred : cnt === 1 ? Math.ceil(job.cred / 2) : 0;
  return `<dl class="ledger pay">
    <div><dt>仲介料（依頼額の20%）</dt><dd class="num">${fmt(pp.fee)}</dd></div>
    ${rows}
    <div class="tot"><dt>成功したときの手取り</dt><dd class="num">${fmt(pp.total)}cr</dd></div>
    <div><dt>評判</dt><dd class="num">+${cred}${cnt >= 1 && !job.special ? '（繰り返し）' : ''}</dd></div>
    ${heat.length ? `<div><dt>ヒート</dt><dd class="num pink">${heat.join('　')}</dd></div>` : ''}
  </dl>`;
}

function jobCard(j) {
  const tags = [
    j.intro ? '<span class="chip p">紹介</span>' : '',
    j.runBoss ? '<span class="chip p">大仕事</span>' : j.campaign ? '<span class="chip p">メイン</span>' : '',
    j.hard ? '<span class="chip p">危険</span>' : '',
    j.deserter ? '<span class="chip p">元部下</span>' : '',
    j.intel ? '<span class="chip b">情報済</span>' : '',
  ].join('');
  return `<button class="job ${UI.job === j.uid ? 'sel' : ''}" data-act="job" data-v="${j.uid}">
    <div class="jtop"><span class="rk">R${j.rank}</span>${tags}<span class="exp dim">${j.special ? '' : `あと${j.expires - G.night + 1}夜`}</span></div>
    <b class="jt">${esc(j.title)}</b>${World.jobBadge(j)}
    <div class="jm">${logo(j.client)}${CLIENTS[j.client].short}${j.target ? ` → ${logo(j.target)}${CLIENTS[j.target].short}` : ''} ・ ${j.nights}夜 ・ <span class="num">${fmt(Math.round((j.basePayout ?? j.payout) * World.payoutMultiplier(j)))}cr</span>${j.repeat >= 2 && !j.special ? ' <span class="pink">値下がり</span>' : ''}</div>
    ${j.req.length ? `<div class="req">${j.req.map((r) => `<span>${ROLES[r].name}</span>`).join('')}</div>` : ''}
  </button>`;
}

function jobDetail(job) {
  if (!job.routes[UI.route]) UI.route = 0;
  const team = getTeam(job.uid);
  const errs = validateTeam(job, team);
  const cost = intelCost(job);
  return `<article class="jd" id="jd">
    <div class="label jdlabel">${logo(job.client)}${CLIENTS[job.client].name}${job.target ? ` → 標的 ${logo(job.target)}${CLIENTS[job.target].name}` : ''}</div>
    <h2>${esc(job.title)}</h2>${World.jobBadge(job, UI.route)}
    <p>${esc(job.desc)}</p>
    <dl class="facts">
      <div><dt>評判ランク</dt><dd>R${job.rank}</dd></div>
      <div><dt>夜数</dt><dd class="num">${job.nights}</dd></div>
      <div><dt>依頼額</dt><dd class="num">${fmt(Math.round((job.basePayout ?? job.payout) * World.payoutMultiplier(job)))}cr</dd></div>
    </dl>
    <h3>ルート</h3>
    <div class="toggle" role="group" aria-label="ルート">${job.routes.map((r, i) => `<button data-act="route" data-v="${i}" aria-pressed="${i === UI.route}">${esc(r.name)}</button>`).join('')}</div>
    <p class="dim">${esc(job.routes[UI.route].note)}</p>
    ${phaseTable(job, UI.route)}
    <div class="intel">${job.intel
      ? '<span class="chip b">情報済</span> 情報屋から聞いた中身が表に出ています。'
      : `<button data-act="intel" data-v="${job.uid}">情報を買う（${cost ? cr(cost) : '無料'}）</button><small class="dim hint">全ルートの「???」が開き、見積もりにも入ります${G.runners.some((r) => r.contact === job.client) ? '。依頼主に顔が利くので半額' : ''}</small>`}</div>
    <h3>編成</h3>
    ${formation(job, team)}
    ${estBox(job, team)}
    ${payBox(job, team)}
    ${errs.length && teamIds(team).length ? `<ul class="errs">${errs.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    <button class="primary big" data-act="dispatch" data-v="${job.uid}" ${errs.length ? 'disabled' : ''}>送り出す</button>
  </article>`;
}

function viewBoard() {
  if (!G.board.length) return '<section><h2 class="sec">依頼</h2><p class="dim">送り出しました。夜を明かすと通信が届きます。</p></section>';
  let job = G.board.find((j) => j.uid === UI.job);
  if (!job) { job = G.board[0]; UI.job = job.uid; UI.route = 0; }
  return `<div class="board">
    <section class="jobs"><h2 class="sec">今夜の依頼</h2>${G.board.map(jobCard).join('')}</section>
    <section class="detail">${jobDetail(job)}</section>
  </div>`;
}

/* ───────── 装備・設備 ───────── */

function viewShop() {
  let r = getR(UI.shop) || G.runners[0];
  const gear = r ? (() => {
    UI.shop = r.id;
    const pays = r.contract === 'exclusive' ? 'fixer' : 'wallet';
    const purse = pays === 'fixer' ? G.money : r.wallet;
    const slots = Object.entries(GEAR_SLOTS).map(([slot, name]) => {
      const cur = r.gear[slot];
      const items = Object.keys(GEAR).filter((id) => GEAR[id].slot === slot).map((id) => {
        const g = GEAR[id], owned = cur === id, rec = g.roles.includes(r.role);
        const price = gearPrice(id), refund = cur && !owned ? gearRefund(cur) : 0;
        return `<div class="cw gear ${rec ? 'rec' : ''} ${owned ? 'owned' : ''}">
          <div class="cwh"><b>${g.name}</b>${rec ? '<span class="chip b">相性</span>' : ''}</div>
          <p>${g.desc}</p>
          <div class="actions"><span class="num">${fmt(price)}cr</span>${owned ? '<small class="dim">装備中</small>'
            : `<button data-act="gear" data-r="${r.id}" data-v="${id}" ${r.status === 'mission' || price > purse ? 'disabled' : ''}>${cur ? '入れ替える' : '買う'}</button>${refund ? `<small class="dim">下取り +${fmt(refund)}</small>` : ''}`}</div>
        </div>`;
      }).join('');
      return `<h4 class="slot-h">${name} <span class="dim">${cur ? `装備中：${GEAR[cur].name}` : 'なし'}</span></h4><div class="cws">${items}</div>`;
    }).join('');
    return `<div class="chips" role="group" aria-label="装備を買うランナー">${G.runners.map((x) => `<button data-act="shop" data-v="${x.id}" aria-pressed="${x.id === r.id}">${esc(x.name)}<small class="dim"> ${ROLES[x.role].tag}</small></button>`).join('')}</div>
      <div class="docwrap"><div class="docside">${runnerCard(r, 'doc')}</div>
      <div class="catalog"><h3>装備 <span class="label">人間性を削らずに伸ばす</span></h3>
        <p class="dim">${pays === 'fixer' ? `専属なので、フィクサーの所持金（${cr(G.money)}）で買います。` : `歩合なので、${esc(r.name)}の手持ち（${cr(r.wallet)}）で買います。歩合のランナーは、手持ちがあれば自分でも買います。`}${World.level('armory') ? ' <span class="chip b">武器庫：2割引</span>' : ''}</p>
        ${slots}</div></div>`;
  })() : '<p class="dim">装備を持たせるランナーがいません。</p>';
  const fix = r ? (() => { const rc = repairCost(r); return `<div class="panel care"><h3>防具の修理</h3><div class="carerow"><span>${esc(r.name)}の防具 ${r.armor}/${armorMax(r)}</span><button data-act="repair" data-r="${r.id}" ${!rc || r.status === 'mission' || rc > G.money ? 'disabled' : ''}>${rc ? cr(rc) : '不要'}</button></div></div>`; })() : '';
  return `<section><h2 class="sec">古物屋 <span class="label">ARMS DEALER</span></h2>${fix}${gear}</section>`;
}

/* ───────── 闇医者 ───────── */

function viewDoc() {
  if (!G.runners.length) return '<section><h2 class="sec">闇医者</h2><p class="dim">診るランナーがいません。</p></section>';
  let r = getR(UI.doc);
  if (!r) { r = G.runners[0]; UI.doc = r.id; }
  const busy = r.status === 'mission';
  const half = G.vouchers.cyber > 0;
  const tc = treatCost(r);
  // 部位のカテゴリごとに、系統と段階の順で並べる
  const card = (c) => {
    const cw = CYBER[c];
    const owned = r.cyber.includes(c), blocked = cyberBlocker(r, c);
    const replaces = r.cyber.find((x) => x !== c && cyberLine(x) === cyberLine(c));
    const rec = ROLE_CYBER[r.role].includes(c);
    const price = Math.round(cyberPrice(c) * (half ? 0.5 : 1));
    const loss = cyberHumanityDelta(r, c), after = r.humanity - loss;
    const za = humZone(after);
    const preview = [...r.cyber.filter((x) => cyberLine(x) !== cyberLine(c)), c];
    const verb = replaces && !blocked ? '換装：' : '';
    let btns;
    if (owned) btns = busy ? '<small class="dim">導入済み</small>'
      : UI.ask === 'rm' + r.id + c ? `<button class="danger" data-act="rmcyber" data-r="${r.id}" data-c="${c}">本当に外す（人間性は戻らない）</button>`
      : `<small class="dim">導入済み</small><button class="sm" data-act="askrm" data-r="${r.id}" data-c="${c}">外す</button>`;
    else if (blocked) btns = `<small class="dim">${blocked}</small>`;
    else if (busy) btns = '<small class="dim">仕事中</small>';
    else if (r.contract === 'exclusive') btns = `<button data-act="cyber" data-r="${r.id}" data-c="${c}" data-v="cash" ${price > G.money ? 'disabled' : ''}>${verb}現金で払う</button>`;
    else btns = `<button data-act="cyber" data-r="${r.id}" data-c="${c}" data-v="wallet" ${price > r.wallet ? 'disabled' : ''}>${verb}本人の手持ちで払う</button>`;
    return `<div class="cw ${rec ? 'rec' : ''} ${owned || blocked ? 'owned' : ''} tier${cw.tier}">
      <div class="cwh"><b>${cw.name}</b><span class="label">${cw.part}</span>${cw.tier > 1 ? `<span class="chip o">上位 Mk.${'I'.repeat(cw.tier)}</span>` : ''}${rec ? '<span class="chip b">相性</span>' : ''}</div>
      <div class="cwp">${owned || blocked ? '' : `${portraitImg(r, 'md')}<span class="dim">→</span>${portraitImg(r, 'md', { cyber: preview, humanity: after })}<small class="dim">入れた後</small>`}</div>
      <p>${cw.desc}</p>
      ${replaces && !blocked ? `<p class="dim">「${CYBER[replaces].name}」と入れ替える。人間性は差の分だけ減る</p>` : ''}
      <dl class="cwn">
        <div><dt>現金</dt><dd class="num">${fmt(price)}cr</dd></div>
        <div class="pink"><dt>人間性</dt><dd class="num">${owned || blocked ? `−${hlCost(r, c)}` : `−${loss} → ${after}（${za.name}）`}</dd></div>
      </dl>
      <div class="actions">${btns}</div>
    </div>`;
  };
  const cats = Object.keys(CYBER_CATS).filter((k) => UI.cyCat === 'all' || UI.cyCat === k);
  const order = (a, b) => (cyberLine(a) === cyberLine(b) ? CYBER[a].tier - CYBER[b].tier : Object.keys(CYBER).indexOf(cyberLine(a)) - Object.keys(CYBER).indexOf(cyberLine(b)));
  const cat = cats.map((k) => {
    const ids = Object.keys(CYBER).filter((c) => CYBER[c].cat === k).sort(order);
    const mine = r.cyber.filter((c) => CYBER[c].cat === k).map((c) => CYBER[c].name).join('、');
    return `<h4 class="slot-h">${CYBER_CATS[k]} <span class="label num">枠 ${slotUse(r, k)}/${CYBER_SLOTS[k]}</span> <span class="dim">${mine ? `導入済み：${mine}` : 'なし'}</span></h4><div class="cws">${ids.map(card).join('')}</div>`;
  }).join('');
  const catChips = `<div class="chips" role="group" aria-label="義体の部位">${[['all', 'すべて'], ...Object.entries(CYBER_CATS)].map(([k, l]) => `<button data-act="cycat" data-v="${k}" aria-pressed="${UI.cyCat === k}">${l}<small class="dim num"> ${k === 'all' ? `${r.cyber.length}/${Object.values(CYBER_SLOTS).reduce((a, b) => a + b, 0)}` : `${slotUse(r, k)}/${CYBER_SLOTS[k]}`}</small></button>`).join('')}</div>`;
  return `<section>
    <h2 class="sec">闇医者 <span class="label">屋台街の裏</span></h2>
    <div class="chips" role="group" aria-label="診るランナー">${G.runners.map((x) => `<button data-act="doc" data-v="${x.id}" aria-pressed="${x.id === r.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="docwrap">
      <div class="docside">
        ${runnerCard(r, 'doc')}
        <div class="panel care">
          <h3>処置</h3>
          <div class="carerow"><span>治療（HPを全快）</span><button data-act="treat" data-r="${r.id}" ${!tc || r.status !== 'idle' ? 'disabled' : ''}>${tc ? cr(tc) : '不要'}</button></div>
          <div class="carerow"><span>セラピー（人間性+15、次の${World.therapyNights()}夜は出せない）</span><button data-act="therapy" data-r="${r.id}" ${r.status !== 'idle' || r.humanity >= maxHum(r) ? 'disabled' : ''}>${cr(THERAPY_COST)}</button></div>
          <div class="carerow"><span>救急サブスク「ラザロ」<small class="dim">死亡セーブに失敗しても1回回収。回収費は報酬額の30%</small></span><button data-act="lazarus" data-r="${r.id}" aria-pressed="${r.lazarus}">${r.lazarus ? '加入中（100cr/夜）' : '加入する（100cr/夜）'}</button></div>
        </div>
      </div>
      <div class="catalog">
        <h3>義体 <span class="label">能力は経験より義体で伸びる</span></h3>
        <p class="dim hint">部位ごとに枠は2つ（体表は1つ）。同じ系統の上位モデルは入れ替わるので枠を使わない。枠がいっぱいのときは、どれかを外してから入れる。外した義体は戻らず、人間性も戻らない。</p>
        <p class="dim hint">${r.contract === 'exclusive' ? '専属なので、フィクサーの所持金で払います。' : '歩合のランナーには立て替えられません。本人の手持ちで払います。'}${half ? ' <span class="chip b">割引券あり：半額</span>' : ''}</p>
        ${catChips}
        ${cat}
      </div>
    </div>
  </section>`;
}

/* ───────── 記録 ───────── */

function logLines(lines, animate) {
  return lines.map((l) => {
    const at = ` data-ph="${l.ph ?? ''}" data-lane="${l.lane || ''}"`;
    if (l.sub) return `<div class="ln sub ${l.kind}${animate ? '' : ' on'}"${at}><span class="what">${esc(l.text)}</span></div>`;
    const res = l.calc ? `<span class="res">${l.kind === 'ok' ? '成功' : '失敗'}</span>` : '';
    return `<div class="ln ${l.kind} ${l.lane === 'net' ? 'net' : ''}${animate ? '' : ' on'}"${at}>
      <span class="t">${l.t ? `[${l.t}]` : ''}</span>${l.lane === 'net' ? '<span class="lanetag">NET</span>' : ''}<span class="who">${esc(l.who || '')}</span><span class="what">${esc(l.text)}</span>${l.calc ? `<span class="calc">${esc(l.calc)}</span>` : ''}${res}</div>`;
  }).join('');
}

function viewLog() {
  if (!G.archive.length) return '<section><h2 class="sec">記録</h2><p class="dim">まだ夜を明かしていません。派遣中に届いた通信がここに残ります。</p></section>';
  return `<section><h2 class="sec">記録 <span class="label">COMM LOG</span></h2>
    ${G.archive.map((a, i) => `<details class="arch" ${i === 0 ? 'open' : ''}><summary>夜${a.night}　${a.comms.length ? a.comms.map((c) => esc(c.title)).join('／') : '派遣なし'}</summary>
      ${a.comms.map((c) => `<h4>${esc(c.title)} <span class="dim">${esc(c.route)}・${c.k}/${c.of}夜目</span></h4><div class="log">${logLines(c.lines, false)}</div>`).join('')}
    </details>`).join('')}
  </section>`;
}

/* ───────── 夜明けの流れ（モーダル） ───────── */

function buildSteps(out) {
  const st = [];
  out.comms.forEach((c, i) => st.push({ k: 'comm', i }));
  out.settle.forEach((s, i) => st.push({ k: 'settle', i }));
  out.story.forEach((n) => st.push({ k: 'story', n }));
  if (!out.pending) st.push({ k: 'report' });
  return st;
}

function stepComm(c) {
  const head = c.raid ? '<span class="chip p">襲撃</span>' : `<span class="label">${c.k}/${c.of}夜目</span>`;
  if(c.pending) return pendingComm(c);
  const tail = c.ends
    ? `<p class="verdict ${c.success ? 'ok' : 'ng'}">${c.success ? (c.raid ? '襲撃を退けた' : '依頼成功') : (c.raid ? '防衛失敗' : '依頼失敗')}</p>`
    : '<p class="verdict dim">夜明け。続きは次の夜に届く</p>';
  return `${Comfort.soundButton()}<div class="label">通信 ・ COMM LOG</div>
    <h2>${esc(c.title)}</h2>
    <p class="dim">${c.raid ? logo(c.corp) : logo(c.client)} ${head} ${esc(c.route)}</p>
    ${commStrip(c)}
    <div class="log play">${logLines(c.visibleLines || c.lines, !instantLog()) || '<div class="ln on">（通信なし）</div>'}</div>
    <div class="tail" ${instantLog() ? '' : 'hidden'}>${tail}</div>
    <div class="mact">${reduced ? '' : speedControl()}<button data-act="skiplog">すべて表示</button><button class="primary" data-act="next">次へ</button></div>`;
}

function pendingComm(c) {
  return '<div class="label">通信・判断待ち（最大2回）</div><h2>'+esc(c.title)+'</h2>'+commStrip(c)+
    '<div class="log play">'+logLines(c.lines,!instantLog())+'</div>'+
    '<div class="tail" '+(instantLog()?'':'hidden')+'><p class="pink">'+esc(c.reason)+'</p><p>続行は残りを判定。撤退は報酬なし、標的ヒートは失敗時と同じ。家賃・手当は通常どおりです。</p><div class="mact"><button class="primary" data-act="decision" data-v="yes" data-uid="'+c.uid+'">続行</button><button data-act="decision" data-v="no" data-uid="'+c.uid+'">撤退</button></div></div>'+speedControl()+'<button data-act="skiplog">すべて表示</button>';
}

function speedControl() {
  return `<div class="speed"><span class="label">表示速度</span><div class="seg" role="group" aria-label="通信の表示速度">${Object.entries(LOG_SPEED).map(([k, [l]]) => `<button data-act="speed" data-v="${k}" aria-pressed="${prefs.speed === k}">${l}</button>`).join('')}</div></div>`;
}

function stepSettle(s) {
  const b = s.bonus ? G.pending[0] : null;
  const heat = Object.entries(s.heat || {}).filter(([, v]) => v).map(([c, v]) => `${CLIENTS[c].short} +${v}`).join('　');
  return `<div class="label">精算 ・ SETTLEMENT</div>
    <h2>${esc(s.title)}</h2>
    <p class="verdict ${s.success ? 'ok' : 'ng'}">${s.success ? '成功' : `失敗：${esc(s.reason)}`}</p>
    <dl class="ledger">
      ${s.lines.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd class="num ${v < 0 ? 'pink' : ''}">${sgn(v)}</dd></div>`).join('')}
      <div class="tot"><dt>フィクサーの収支</dt><dd class="num ${s.net < 0 ? 'pink' : ''}">${sgn(s.net)}cr</dd></div>
      <div><dt>評判</dt><dd class="num">${s.cred >= 0 ? '+' : ''}${s.cred}</dd></div>
      ${heat ? `<div><dt>ヒート</dt><dd class="num pink">${heat}</dd></div>` : ''}
    </dl>
    ${s.deaths.length ? `<p class="dead">帰ってこなかった：${s.deaths.map(esc).join('、')}</p>` : ''}
    ${s.credits && s.credits.length ? `<h3>効いたもの <span class="label">失敗を成功に変えた回数</span></h3><ul class="credits">${s.credits.map((c) => `<li><b>${esc(c.name)}</b>　${esc(c.label)} <span class="num">×${c.n}</span></li>`).join('')}</ul>` : ''}
    ${s.growth && s.growth.length ? `<h3>成長</h3><ul class="growth">${s.growth.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
    ${s.notes.length ? `<ul class="notes">${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${b && b.run ? rewardPicker(b)
      : b ? `<h3>追加報酬を1つ選ぶ</h3><div class="bonus">${b.opts.map((o, i) => `<button data-act="bonus" data-v="${i}"><span class="label">${o.title}</span>${o.text}</button>`).join('')}</div>`
      : '<div class="mact"><button class="primary" data-act="next">次へ</button></div>'}`;
}

/* ───────── 報酬3択 ───────── */

const REWARD_KIND = { cyber: '義体', gear: '装備', runner: 'ランナー', intel: '情報券', cr: 'cr' };
/* 候補ごとに、受け取る人のボタンを並べる。義体はロールに合う人だけ、枠がいっぱいなら外すものを選ぶ */
function rewardTargets(o, i) {
  const btn = (r, label, drop) => `<button class="sm" data-act="reward" data-v="${i}" data-r="${r ? r.id : ''}"${drop ? ` data-x="${drop}"` : ''}>${label}</button>`;
  if (o.kind === 'cyber') {
    return G.runners.filter((r) => cyberFits(r, o.id)).map((r) => {
      const loss = cyberHumanityDelta(r, o.id), after = r.humanity - loss;
      const hum = `<span class="pink num">人間性 −${loss} → ${after}（${humZone(after).name}）</span>`;
      if (!cyberBlocker(r, o.id)) return `<div class="rt">${btn(r, `${esc(r.name)}に入れる`)}${hum}</div>`;
      const swaps = swapChoices(r, o.id).filter((d) => !cyberBlocker(r, o.id, d));
      if (!swaps.length) return `<div class="rt dim">${esc(r.name)}：${esc(cyberBlocker(r, o.id))}</div>`;
      return `<div class="rt">${swaps.map((d) => btn(r, `${esc(r.name)}：「${CYBER[d].name}」を外して入れる`, d)).join('')}${hum}</div>`;
    }).join('') || '<div class="rt dim">入れられる人がいない</div>';
  }
  if (o.kind === 'gear') {
    const g = GEAR[o.id];
    return G.runners.filter((r) => r.gear[g.slot] !== o.id).map((r) => {
      const cur = r.gear[g.slot];
      return `<div class="rt">${btn(r, `${esc(r.name)}に持たせる`)}${g.roles.includes(r.role) ? '<span class="chip b">相性</span>' : ''}${cur ? `<small class="dim">「${GEAR[cur].name}」は下取り +${fmt(gearRefund(cur))}cr</small>` : ''}</div>`;
    }).join('');
  }
  if (o.kind === 'runner') return `<div class="rt">${btn(null, G.runners.length >= ROSTER_MAX ? '隊がいっぱい' : '歩合で隊に入れる')}</div>`;
  return `<div class="rt">${btn(null, '受け取る')}</div>`;
}
function rewardBody(o) {
  if (o.kind === 'cyber') {
    const c = CYBER[o.id];
    return `<b>${c.name}</b>${c.tier > 1 ? `<span class="chip o">上位 Mk.${'I'.repeat(c.tier)}</span>` : ''}<p>${c.desc}</p><small class="dim">${CYBER_CATS[c.cat]} ・ 施術費なし（人間性は削れる）</small>`;
  }
  if (o.kind === 'gear') { const g = GEAR[o.id]; return `<b>${g.name}</b><p>${g.desc}</p><small class="dim">${GEAR_SLOTS[g.slot]} ・ 古物屋なら${fmt(g.price)}cr</small>`; }
  if (o.kind === 'runner') {
    const r = o.runner, R = ROLES[r.role];
    const top = SKILLS.filter((k) => skill(r, k) > 0).sort((a, b) => skill(r, b) - skill(r, a)).slice(0, 3).map((k) => `${k}${skill(r, k)}`).join('・');
    return `<div class="rwr">${portraitImg(r, 'sm')}<b>${esc(r.name)}</b><span class="role sm">${R.tag}</span></div>${r.trait ? `<span class="chip trait ${TRAITS[r.trait].rarity}">${TRAITS[r.trait].name}</span><p class="dim">${TRAITS[r.trait].desc}</p>` : ''}<p>${R.name} ・ ${top}</p><small class="dim">歩合で加わる。専属に切り替えると手当 ${stipendFor(r)}cr/夜</small>`;
  }
  if (o.kind === 'intel') return '<b>情報券 ×2</b><p>情報購入が2回無料になる</p>';
  return `<b>${fmt(o.amount)}cr</b><p>そのまま所持金に入る</p>`;
}
function rewardPicker(b) {
  return `<h3>報酬を1つ選ぶ ${b.rare ? '<span class="chip p">希少1つ確定</span>' : ''}</h3>
    <div class="rewards">${b.opts.map((o, i) => `<div class="rw ${o.rare ? 'rare' : ''}"><span class="label">${REWARD_KIND[o.kind]}${o.rare ? ' ・ 希少' : ''}</span>${rewardBody(o)}<div class="rts">${rewardTargets(o, i)}</div></div>`).join('')}</div>
    <div class="mact"><button data-act="reward" data-v="-1">どれも取らない（+${fmt(Run.SKIP_CR)}cr）</button></div>`;
}
/* 精算の流れの外で残った報酬（読み込み直しなど）は、単独で選ばせる */
function stepReward(b) {
  return `<div class="label">報酬 ・ REWARD</div><h2>${esc(b.title)}</h2>${rewardPicker(b)}`;
}

function stepStory(n, act = 'next') {
  const st = CHAPTERS[n] || INTERLUDES[n];
  const extra = st.allyBody && st.allyBody[G.flags.ally];
  // ラン中は章の番号を出さない（幕と章の番号がずれるため）
  return `<div class="label">${CHAPTERS[n] ? 'MAIN ・ ブラックボックス' : 'INTERLUDE ・ ヨミハマ'}</div>
    <h2>${CHAPTERS[n] ? st.title.split('　').pop() : st.title}</h2>
    ${st.body.map((p) => `<p class="story">${p}</p>`).join('')}
    ${extra ? `<p class="story">${extra}</p>` : ''}
    ${(() => { const goal = CHAPTERS[n] ? Run.storyGoal(n, st.goal) : st.goal; return goal ? `<p class="storygoal"><span class="label">目標</span> ${goal}</p>` : ''; })()}
    <div class="mact"><button class="primary" data-act="${act}">次へ</button></div>`;
}

/* 章の分岐。選ぶまで夜は明けない */
function stepChoice() {
  const ch = CHAPTERS[G.awaitChoice], c = ch.choice;
  const heat = (o) => CORPS.map((k) => `${CLIENTS[k].short} ${k === o.ally ? ALLY_HEAT.ally : '+' + ALLY_HEAT.others}`).join('　');
  return `<div class="label">${ch.title.split('　')[0]} ・ 分岐</div>
    <h2>${c.title}</h2>
    ${c.body.map((p) => `<p class="story">${p}</p>`).join('')}
    <div class="bonus branch">${c.options.map((o, i) => `<button data-act="branch" data-v="${i}"><span class="label">${logo(o.ally)}${CLIENTS[o.ally].name}と組む</span>${o.text}<small class="num pink">ヒート ${heat(o)}</small></button>`).join('')}</div>`;
}

function stepReport(out) {
  return `<div class="label">夜明け ・ 夜${out.night}</div>
    <h2>毎晩、確実に出ていく</h2>
    <dl class="ledger">${out.upkeep.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd class="num pink">−${fmt(v)}</dd></div>`).join('')}
      <div class="tot"><dt>合計</dt><dd class="num pink">−${fmt(out.upkeepTotal)}cr</dd></div>
      <div class="tot"><dt>所持金</dt><dd class="num ${G.money < 0 ? 'pink' : ''}">${cr(G.money)}</dd></div></dl>
    <h3>ヒート</h3>
    <div class="heatlist">${out.heat.map(([c, v, dv]) => `<div class="hrow ${v >= 80 ? 'hot' : ''}"><span>${CLIENTS[c].name}</span><div class="ht"><i style="width:${v}%"></i></div><b class="num">${v}</b><span class="num delta ${dv > 0 ? 'pink' : 'dim'}">${dv > 0 ? '+' : dv < 0 ? '−' : '±'}${Math.abs(dv)}</span></div>`).join('')}</div>
    ${out.events.length ? `<h3>この夜のできごと</h3><ul class="events">${out.events.map((e) => `<li class="${e.kind}">${esc(e.text)}</li>`).join('')}</ul>` : ''}
    <div class="mact"><button class="primary" data-act="next">${G.ended ? '結末へ' : `夜${G.night}へ`}</button></div>`;
}

function stepEndingChoice() {
  return `<div class="label">${chapter().title.split('　')[0]} ・ 決着</div>
    <h2>箱の行き先を決める</h2>
    <p class="story">夜が明けた。箱はまだ手の中にある。</p>
    <div class="bonus end">${Object.entries(ENDINGS).map(([k, e]) => `<button data-act="ending" data-v="${k}"><span class="label">${e.title}</span>${e.pick}</button>`).join('')}</div>`;
}

function stepIntro() {
  const st = Run.INTRO;
  const [no, name] = [st.kicker, st.title];
  return `<div class="label">${no}</div><h2>${name}</h2>
    ${st.body.map((p) => `<p class="story">${p}</p>`).join('')}
    <p class="storygoal"><span class="label">目標</span> ${st.goal}</p>
    <div class="mact"><button class="primary" data-act="closeintro">隠れ家に入る</button></div>`;
}

function renderModal() {
  let key = '', html = '';
  if (UI.flow) {
    const s = UI.flow.steps[UI.flow.step];
    key = `flow${UI.flow.id}-${UI.flow.step}-${G.pending.length}`;
    if (s.k === 'comm') html = stepComm(UI.flow.out.comms[s.i]);
    if (s.k === 'settle') html = stepSettle(UI.flow.out.settle[s.i]);
    if (s.k === 'story') html = stepStory(s.n);
    if (s.k === 'report') html = stepReport(UI.flow.out);
  } else if (G && G.run && G.pending.length && G.pending[0].run && !G.ended) {
    key = 'reward-' + G.pending.length + '-' + G.pending[0].title; html = stepReward(G.pending[0]);
  } else if (G && G.personalNotices && G.personalNotices.length) {
    key='personal-'+G.personalNotices[0]; html=World.storyHtml(G.personalNotices[0]);
  } else if (G && G.awaitChoice) { key = 'choice-' + G.awaitChoice; html = stepChoice(); }
  else if (G && G.awaitEnding && !G.ended) { key = 'ending'; html = stepEndingChoice(); }
  else if (G && G.storyQueue && G.storyQueue.length) {
    const q = G.storyQueue[0];
    key = q === 'intro' ? 'intro' : 'queued-' + q;
    html = q === 'intro' ? stepIntro() : stepStory(q, 'closestory');
  } else if (G && UI.help) { key = 'help'; html = stepHelp(); }
  if (key === UI.modalKey) return;
  UI.modalKey = key;
  stopLog();
  if (!key) { modal.hidden = true; modal.innerHTML = ''; document.body.classList.remove('locked'); return; }
  modal.innerHTML = `<div class="msheet" role="dialog" aria-modal="true">${html}</div>`;
  modal.hidden = false;
  document.body.classList.add('locked');
  modal.scrollTop = 0;
  const box = modal.querySelector('.log.play');
  if (box && !instantLog()) playLog(box);
  if (box && instantLog()) finishStrip();
  stepCutin(key);
}

function stepCutin(key) {
  if (key === 'intro' || key === 'ending') {
    const [no, name] = key === 'intro' ? [Run.INTRO.kicker, Run.INTRO.title] : chapter().title.split('　');
    return cutin({ kicker: key === 'intro' ? `ヨミハマ ・ ${no}` : no, title: name, tone: 'blue' });
  }
  if (key.startsWith('choice-')) return cutin({ kicker: CHAPTERS[key.slice(7)].title.split('　')[0], title: '分岐', tone: 'blue' });
  if (key.startsWith('queued-')) {
    const [kick, title] = CHAPTERS[key.slice(7)].title.split('　');
    return cutin({ kicker: `MAIN ・ ${G.run ? 'ブラックボックス' : kick}`, title, tone: 'pink' });
  }
  if (!UI.flow) return;
  const s = UI.flow.steps[UI.flow.step];
  const out = UI.flow.out;
  if (s.k === 'story') {
    const [kick, title] = (CHAPTERS[s.n] || INTERLUDES[s.n]).title.split('　');
    return cutin({ kicker: CHAPTERS[s.n] ? `MAIN ・ ${G.run ? 'ブラックボックス' : kick}` : kick, title, tone: CHAPTERS[s.n] ? 'pink' : 'blue' });
  }
  if (s.k === 'comm' && out.comms[s.i].raid) return cutin({ kicker: '警報', title: '襲撃', sub: esc(out.comms[s.i].title), tone: 'red' });
  if (s.k === 'settle') {
    const dead = out.settle[s.i].deadRunners || [];
    if (dead.length) return cutin({ kicker: '通信途絶', title: '応答なし', sub: dead.map((r) => esc(r.name)).join('、'), tone: 'red', por: portraitImg(dead[0], 'ci', { glitch: 2 }) });
  }
  if (s.k === 'report' && out.deserted && out.deserted.length) {
    const d = out.deserted[0];
    return cutin({ kicker: '人間性 0', title: '脱走', sub: esc(d.name), tone: 'pink', por: portraitImg(d, 'ci', { glitch: 2 }) });
  }
}

function commStrip(c) {
  if (!c.phases) return '';
  const len = c.phases.field.length;
  const start = (c.k - 1) * 5;
  const cell = (p, i, lane) => {
    const past = i < start ? ' past done' : '';
    if (!p) return `<div class="ph empty${past}" data-ph="${i}" data-lane="${lane}"><i>${i + 1}</i>—</div>`;
    const cls = { combat: 'enemy', boss: 'enemy', goal: 'goal', ice: 'ice', trap: 'trap' }[p.t] || '';
    const fog = p.hidden && !c.intel && !past ? ' fog' : '';
    return `<div class="ph ${cls}${p.fx === 'data' ? ' netgoal' : ''}${past}${fog}" data-ph="${i}" data-lane="${lane}"><i>${i + 1}</i><span class="real">${esc(p.l)}<span class="dv">${PH_DV[p.t](p)}</span></span><span class="q">???</span></div>`;
  };
  const hasNet = c.phases.net.some(Boolean);
  return `<div class="strip-wrap"><div class="strip cstrip" style="--cols:${len}">
    <div class="lane">現場</div>${c.phases.field.map((p, i) => cell(p, i, 'field')).join('')}
    ${hasNet ? `<div class="lane">ネット</div>${c.phases.net.map((p, i) => cell(p, i, 'net')).join('')}` : ''}
  </div></div>`;
}

/* 通信の1行を、フェーズ表のマスに反映する */
function markStrip(ln, final) {
  // 通常再生で一行ずつ鳴らす。全表示時の final=true は無音
  if (ln && !final) Comfort.tone(ln);
  const strip = modal.querySelector('.cstrip');
  if (!strip) return;
  strip.querySelectorAll('.cur').forEach((e) => e.classList.remove('cur'));
  if (!ln || ln.dataset.ph === undefined || ln.dataset.ph === '') return;
  const ph = +ln.dataset.ph, lane = ln.dataset.lane || 'field';
  strip.querySelectorAll('.ph').forEach((e) => { if (+e.dataset.ph < ph) e.classList.add('done'); });
  const cell = strip.querySelector(`.ph[data-ph="${ph}"][data-lane="${lane}"]`);
  if (!cell) return;
  cell.classList.remove('fog');
  if (!final) cell.classList.add('cur');
  const k = ln.classList;
  if (k.contains('sub')) { if (k.contains('ng')) cell.classList.add('hurt'); return; }
  if (k.contains('ok') || k.contains('goal')) { cell.classList.remove('bad'); cell.classList.add('good'); if (lane === 'net') cell.classList.add('broken'); }
  else if (k.contains('ng') || k.contains('dead')) { cell.classList.remove('good'); cell.classList.add('bad'); }
  else if (k.contains('warn')) cell.classList.add('hurt');
}
function finishStrip() {
  modal.querySelectorAll('.log.play .ln').forEach((l) => markStrip(l, true));
  markStrip(null);
}

/* 1行ごとに次の行を予約する。待ち時間は毎回読むので、速度を変えるとすぐ効く */
function playLog(box) {
  const lines = [...box.querySelectorAll('.ln')];
  let i = 0;
  UI.play = () => {
    if (i >= lines.length) { UI.play = null; markStrip(null); showTail(); return; }
    const ln = lines[i++];
    ln.classList.add('on');
    markStrip(ln);
    box.scrollTop = box.scrollHeight;
    UI.timer = setTimeout(UI.play, LOG_SPEED[prefs.speed][1]);
  };
  UI.timer = setTimeout(UI.play, LOG_SPEED[prefs.speed][1]);
}
function stopLog() {
  clearTimeout(UI.timer);
  UI.play = null;
}
function showTail() {
  const t = modal.querySelector('.tail');
  if (t) t.hidden = false;
}

/* ───────── タイトル・結末 ───────── */

/* 更新直後は、ブラウザが古いファイルと新しいファイルを混ぜて読み込むことがある。
   同じ場所のファイルをキャッシュを使わずに取り直してから、読み込み直す */
async function reloadFresh() {
  const urls = [location.href, ...[...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((e) => e.src || e.href)]
    .filter((u) => u.startsWith(location.origin));
  try { await Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }))); } catch (e) { /* 取れなくても読み込み直す */ }
  location.reload();
}
/* 保存データをそのままファイルに書き出す（読み込めないときの控え） */
function exportSave() {
  const raw = rawSave() || (() => { try { return localStorage.getItem(BACKUP_KEY); } catch (e) { return null; } })();
  if (!raw) return toast('書き出せる保存データがありません');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  a.download = `fixers-cut-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const recoveryButtons = () => `<button class="primary big" data-act="reloadfresh">最新のファイルで読み込み直す</button><button class="big" data-act="exportsave">保存データを書き出す</button>`;

/* 描画が止まったときの画面。保存データには触らない */
function renderCrash(e) {
  stopLog();
  modal.hidden = true; modal.innerHTML = ''; UI.modalKey = ''; UI.flow = null;
  document.body.classList.remove('locked');
  app.innerHTML = `<div class="title-screen"><div class="ts-in">
    <div class="label">ERROR</div>
    <h1 class="logo-big">画面を開けませんでした</h1>
    <p>ゲームの更新直後に、ブラウザが古いファイルと新しいファイルを混ぜて読み込むと起きることがあります。<b>保存データは消えていません。</b></p>
    <p>下のボタンで最新のファイルを取り直してください。直らないときは、保存データを書き出して控えておいてください。</p>
    <div class="ts-actions">${recoveryButtons()}<button class="big" data-act="totitle">タイトルへ</button></div>
    <p class="dim num">${esc(e && e.message ? e.message : String(e))}</p>
  </div></div>`;
}

function renderTitle() {
  City.setMode('full');
  const sv = loadSave();
  const exists = sv || loadError;
  app.innerHTML = `<div class="title-screen"><div class="ts-in">
    <div class="label">ROGUELIKE ・ 12夜のラン</div>
    <h1 class="logo-big">FIXER'S CUT<span>フィクサーズ・カット</span></h1>
    <p class="thesis">自分は撃たない。<em>12夜のうちに</em>街の上層まで仕事を通す。毎夜の選択で隊が育ち、ひとつの判定で隊が崩れる。</p>
    <p class="dim">舞台は湾岸の沈みかけた都市ヨミハマ。1ランは3幕・12夜。毎夜、地区マップから行き先を1つ選び、各幕の最後に大仕事がある。ランナーは死ねば戻らず、隊の組み合わせはランごとに違う。決めるのは次の4つだけです。</p>
    <ul class="decide"><li>今夜、街のどこへ行くか</li><li>どの仕事に、誰を出すか</li><li>出す前に、情報にいくら払うか</li><li>どこまで体を機械にさせるか</li></ul>
    ${(() => { const m = Run.loadMeta(); return m.runs ? `<p class="dim num">これまでのラン ${m.runs}回 ・ クリア ${m.clears}回${m.best ? ` ・ 最高到達 ${m.best.clear ? 'クリア' : `${Run.ACTS[m.best.act].name} ${m.best.slot}夜目`}` : ''}</p>` : ''; })()}
    ${loadError ? `<div class="panel loaderr"><h3 class="pink">保存データを読み込めませんでした</h3><p>データは消さずに残してあります。更新直後なら、最新のファイルで読み込み直すと開けることがあります。</p><div class="actions">${recoveryButtons()}</div><p class="dim num">${esc(loadError)}</p></div>` : ''}
    <div class="ts-actions">
      ${exists && UI.ask === 'newgame' ? '<button class="danger big" data-act="new">今のランを捨てて始める（控えを1つ残します）</button>' : `<button class="${loadError ? '' : 'primary '}big" data-act="${exists ? 'asknew' : 'new'}">新しいランを始める</button>`}
      ${sv ? `<button class="big" data-act="continue">続きから（${Run.ACTS[sv.run.act].name}・${sv.run.slot}夜目）</button>` : ''}
    </div>
    <details class="howto"><summary>判定のしくみ</summary>
      <ul>
        <li>判定は 能力値＋技能＋d10。難易度（DV）以上なら成功。10が出たらd10を足し、1が出たらd10を引く</li>
        <li>ダメージから防具の値を引いた分だけHPが減り、防具は1ずつすり減る</li>
        <li>HPが半分を切ると重傷になり、全判定に−2</li>
        <li>判定に使った技能は経験がたまり、少しずつ上がる。装備は人間性を削らずに技能を足せる</li>
        <li>HP0で死亡セーブ。d10がBODY未満なら生存。ラザロ加入者は1回だけ回収される</li>
        <li>現場とネットの2レーンが並んで進む。ネットで負けると、現場の難易度が上がる</li>
      </ul>
    </details>
  </div></div>`;
  modal.hidden = true;
  UI.modalKey = '';
}

/* 生き残ったランナーのその後。個人依頼を終えた物語つきは専用の一行 */
function epilogue(r) {
  if (r.story && EPILOGUES.story[r.story] && G.flags['personal_' + r.story] === 'complete') return EPILOGUES.story[r.story];
  const z = humZone(r.humanity).key;
  const lines = EPILOGUES[z === 'gone' ? 'sign' : z];
  return lines[r.id % lines.length].replace('{name}', r.name);
}

/* ランの終わり方。大仕事を越えた結末は ENDINGS（data.js） */
const RUN_ENDS = {
  bankrupt: { title: '廃業', body: ['3夜続けて、所持金がマイナスのままだった。', '貸元の取り立て屋が隠れ家の鍵を付け替えていった。残ったランナーたちは、別のフィクサーの番号を探し始めている。'] },
  wipe: { title: '全滅', body: ['隠れ家に戻ってくる者が、もう誰もいない。', '通信機は朝まで鳴らなかった。あなたは撃たないフィクサーのまま、ひとりで夜明けを迎えた。'] },
  boss: { title: '大仕事に失敗', body: ['二度目の大仕事も、届かなかった。', '箱は手の中にあるのに、もう開ける手立てがない。湾岸の噂は、新人フィクサーの名前をすぐに忘れた。'] },
};

/* 地区マップでたどった行き先を、幕ごとに並べる */
function runRoute() {
  return [1, 2, 3].map((a) => {
    const hs = G.run.history.filter((h) => h.act === a);
    if (!hs.length) return '';
    return `<li><span class="label">${Run.ACTS[a].name}</span>${hs.map((h) => `<span class="mk n-${h.type}" title="${Run.DEST[h.type].name}">${Run.DEST[h.type].mark}</span>`).join('')}</li>`;
  }).join('');
}

function renderEnding() {
  const t = G.ended.type;
  const e = RUN_ENDS[t] || ENDINGS[t];
  const run = G.run, m = run.meta || Run.loadMeta();
  const clear = !RUN_ENDS[t];
  app.innerHTML = `<div class="title-screen ending"><div class="ts-in">
    <div class="label">${clear ? 'RUN CLEAR' : 'RUN OVER'} ・ ${clear ? '12夜を越えた' : `${Run.ACTS[run.act].name} ${run.slot}夜目`}</div>
    <h1 class="logo-big">${e.title}</h1>
    ${e.body.map((p) => `<p class="story">${p}</p>`).join('')}
    ${G.runners.length ? `<ul class="epilogue">${G.runners.map((r) => `<li>${esc(epilogue(r))}</li>`).join('')}</ul>` : ''}
    <h3>たどった道</h3>
    <ul class="route">${runRoute()}</ul>
    <dl class="ledger endstats">
      <div><dt>到達</dt><dd>${clear ? 'クリア' : `${Run.ACTS[run.act].name}・${Run.ACTS[run.act].place} ${run.slot}夜目`}</dd></div>
      <div><dt>過ごした夜</dt><dd class="num">${G.night}</dd></div>
      <div><dt>所持金</dt><dd class="num">${cr(G.money)}</dd></div>
      <div><dt>これまでのラン</dt><dd class="num">${m.runs}回 ・ クリア${m.clears}回</dd></div>
      <div><dt>最後まで残ったランナー</dt><dd>${G.runners.map((r) => esc(r.name)).join('、') || 'なし'}</dd></div>
      <div><dt>帰ってこなかった者</dt><dd>${G.memorial.map((m) => esc(m.name)).join('、') || 'なし'}</dd></div>
    </dl>
    <div class="ts-actions"><button class="primary big" data-act="restart">次のランへ</button></div>
  </div></div>`;
  modal.hidden = true;
  UI.modalKey = '';
  document.body.classList.remove('locked');
  City.setMode('full');
  cutin({ kicker: clear ? 'RUN CLEAR' : 'RUN OVER', title: e.title, tone: clear ? 'blue' : 'red' });
}

/* ───────── 描画と操作 ───────── */

function render() {
  try {
    if (!G) return renderTitle();
    if (G.ended && !UI.flow) return renderEnding();
    City.setMode(UI.tab === 'home' ? 'full' : 'dim');
    if (!tabList().some(([k]) => k === UI.tab)) UI.tab = 'home';
    const views = { home: viewHome, crew: viewCrew, scout: viewScout, board: viewBoard, shop: viewShop, doc: viewDoc, event: viewEvent, log: viewLog };
    app.innerHTML = hud() + `<main class="view view-${UI.tab}">${views[UI.tab]()}</main>` + dock();
    renderModal();
  } catch (e) {
    renderCrash(e);
  }
}

function act(fn) {
  const err = fn();
  if (typeof err === 'string') toast(err);
  else if (Array.isArray(err)) toast(err[0]);
  save();
  render();
}

const H_ = {
  asknew() { UI.ask = 'newgame'; render(); },
  reloadfresh() { reloadFresh(); },
  exportsave() { exportSave(); },
  totitle() { G = null; UI.flow = null; UI.ask = null; render(); },
  new() { clearSave(); UI.ask = null; newGame(); UI.tab = 'home'; save(); render(); },
  continue() { G = loadSave(); UI.tab = 'home'; if(G && G.nightInProgress) H_.night(); else render(); },
  restart() { G = null; clearSave(); UI.ask = null; UI.flow = null; render(); },
  closeintro() { G.storyQueue = G.storyQueue.filter((x) => x !== 'intro'); save(); render(); },
  closestory() { G.storyQueue.shift(); save(); render(); },
  branch(b) { act(() => chooseBranch(+b.dataset.v)); },
  mapsel(b) { UI.mapSel = +b.dataset.v; render(); },
  go(b) {
    const err = Run.choose(+b.dataset.v);
    if (err) { toast(err); return; }
    UI.mapSel = null;
    const t = G.run.tonight, tab = Run.DEST[t.type].tab;
    if (tab) UI.tab = tab;
    toast(t.note || `今夜の行き先：${Run.DEST[t.type].name}`);
    save(); render(); window.scrollTo(0, 0);
  },
  eventopt(b) { act(() => Run.resolveEvent(+b.dataset.v)); },
  tab(b) { UI.tab = b.dataset.v; UI.ask = null; render(); window.scrollTo(0, 0); },
  job(b) {
    UI.job = +b.dataset.v; UI.route = 0; render();
    if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('jd')?.scrollIntoView({ block: 'start' });
  },
  route(b) { UI.route = +b.dataset.v; render(); },
  intel(b) { act(() => buyIntel(+b.dataset.v)); },
  assign(b) {
    const job = G.board.find((j) => j.uid === UI.job);
    if (!job) return;
    const team = getTeam(job.uid);
    const id = +b.dataset.r, to = b.dataset.v;
    for (const k of ['field', 'support', 'net']) team[k] = team[k].filter((x) => x !== id);
    if (to !== 'none') {
      if (team[to].length >= LANE_MAX[to]) { toast(`${LANE[to]}の枠はいっぱいです`); render(); return; }
      team[to].push(id);
    }
    render();
  },
  dispatch(b) {
    const uid = +b.dataset.v;
    const job = G.board.find((j) => j.uid === uid);
    const errs = dispatch(uid, UI.route, getTeam(uid));
    if (errs) { toast(errs[0]); return; }
    delete UI.team[uid];
    UI.job = null;
    toast(`「${job.title}」に送り出した`);
    save(); render();
  },
  recall(b) { act(() => recall(+b.dataset.v)); },
  hire(b) {
    const r = G.scouts[+b.dataset.v];
    act(() => hire(+b.dataset.v, b.dataset.c) || (toast(`${r.name}と${b.dataset.c === 'exclusive' ? '専属' : '歩合'}で組んだ`), null));
  },
  contract(b) { act(() => setContract(getR(+b.dataset.r), b.dataset.v)); },
  askfire(b) { UI.ask = 'fire' + b.dataset.r; render(); },
  fire(b) { UI.ask = null; act(() => fire(getR(+b.dataset.r))); },
  doc(b) { UI.doc = +b.dataset.v; render(); },
  cycat(b) { UI.cyCat = b.dataset.v; render(); },
  shop(b) { UI.shop = +b.dataset.v; render(); },
  gear(b) {
    const r = getR(+b.dataset.r), id = b.dataset.v;
    act(() => buyGear(r, id) || (toast(`${r.name}に「${GEAR[id].name}」を持たせた（${GEAR[id].desc}）`), null));
  },
  usualTeam(b) {
    const job = G.board.find((j) => j.uid === +b.dataset.v);
    if (!job) return;
    toast(Comfort.restoreTeam(job)); render();
  },
  sound() {
    Comfort.toggleSound();
    // 通信の再描画を避け、表示済みの行と現在の判断を保つ
    const holder = document.createElement('div'); holder.innerHTML = Comfort.soundButton();
    const fresh = holder.firstElementChild;
    document.querySelectorAll('[data-act="sound"]').forEach((x) => { x.textContent = fresh.textContent; x.setAttribute('aria-pressed', fresh.getAttribute('aria-pressed')); });
  },
  hints() { prefs.hints = !prefs.hints; savePrefs(); applyHints(); render(); },
  help() { UI.help = true; render(); },
  closehelp() { UI.help = false; render(); },
  treat(b) { act(() => treat(getR(+b.dataset.r))); },
  repair(b) { act(() => repair(getR(+b.dataset.r))); },
  therapy(b) { act(() => therapy(getR(+b.dataset.r))); },
  lazarus(b) { act(() => { const r = getR(+b.dataset.r); r.lazarus = !r.lazarus; }); },
  cyber(b) {
    const r = getR(+b.dataset.r), c = b.dataset.c;
    act(() => buyCyber(r, c, b.dataset.v) || (toast(`${r.name}に「${CYBER[c].name}」を入れた。人間性 ${r.humanity}${r.humanity <= 0 ? '。もう戻れない' : ''}`), null));
  },
  upgrade(b) { act(()=>World.buyUpgrade(b.dataset.v)); },
  personalnotice() { G.personalNotices.shift(); UI.tab='board'; save(); render(); },
  decision(b) {
    const ctx=G.missions.find(m=>m.uid===+b.dataset.uid)?.progress;
    if(!ctx?.waiting)return;
    stopLog(); missionDecision(+b.dataset.uid,b.dataset.v==='yes'); H_.night();
  },
  night() {
    if (!Run.canEndNight()) { toast('地区マップで今夜の行き先を決めてください'); UI.tab = 'home'; render(); return; }
    stopLog();
    const out = endNight();
    if (!out) { render(); return; }
    UI.flow = { id: Date.now(), out, step: 0, steps: buildSteps(out) };
    UI.team = {}; UI.est = { key: '', val: null }; UI.ask = null; UI.mapSel = null; UI.tab = 'home';
    render();
  },
  skiplog() {
    stopLog();
    modal.querySelectorAll('.log.play .ln').forEach((l) => l.classList.add('on'));
    finishStrip();
    const box = modal.querySelector('.log.play');
    if (box) box.scrollTop = box.scrollHeight;
    showTail();
  },
  speed(b) {
    prefs.speed = b.dataset.v;
    savePrefs();
    modal.querySelectorAll('[data-act="speed"]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (prefs.speed === 'instant') return H_.skiplog();
    if (UI.play) { clearTimeout(UI.timer); UI.timer = setTimeout(UI.play, LOG_SPEED[prefs.speed][1]); }
  },
  next() {
    // 再生途中なら、まず残りの行を表示する
    const box = modal.querySelector('.log.play');
    if (box && [...box.querySelectorAll('.ln')].some((l) => !l.classList.contains('on'))) return H_.skiplog();
    if (!UI.flow || UI.flow.out.pending) return;
    UI.flow.step++;
    if (UI.flow.step >= UI.flow.steps.length) { UI.flow = null; UI.tab = UI.tab === 'log' ? 'log' : UI.tab; }
    render();
  },
  reward(b) {
    const err = Run.takeReward(+b.dataset.v, +b.dataset.r, b.dataset.x);
    if (err) { toast(err); return; }
    save();
    if (UI.flow) { UI.flow.step++; if (UI.flow.step >= UI.flow.steps.length) UI.flow = null; }
    render();
  },
  rmcyber(b) {
    const r = getR(+b.dataset.r), c = b.dataset.c;
    UI.ask = null;
    act(() => removeCyber(r, c) || (toast(`${r.name}から「${CYBER[c].name}」を外した。人間性は戻らない`), null));
  },
  askrm(b) { UI.ask = 'rm' + b.dataset.r + b.dataset.c; render(); },
  bonus(b) {
    applyBonus(+b.dataset.v);
    UI.flow.step++;
    if (UI.flow.step >= UI.flow.steps.length) UI.flow = null;
    render();
  },
  ending(b) { chooseEnding(b.dataset.v); render(); },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const f = H_[b.dataset.act];
  if (!f) return;
  e.preventDefault();
  try { f(b); } catch (err) { renderCrash(err); }
});

function boot(data) {
  City.init();
  applyHints();
  if (data && data.G) {
    G = World.init(data.G);
    Object.assign(UI, data.UI || {});
  }
  render();
}
if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') {
  window.claude.hot.snapshot(() => ({ G, UI: { tab: UI.tab, job: UI.job, route: UI.route, team: UI.team, doc: UI.doc } }));
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
