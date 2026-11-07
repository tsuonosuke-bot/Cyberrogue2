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
  let actions = '';
  if (mode === 'roster') {
    const busy = r.status === 'mission';
    actions = `<div class="actions">${UI.ask === 'fire' + r.id
      ? `<button class="danger" data-act="fire" data-r="${r.id}">本当に隊から外す</button>`
      : `<button data-act="askfire" data-r="${r.id}" ${busy ? 'disabled' : ''}>隊から外す</button>`}</div>`;
  } else if (mode === 'scout' || mode === 'walkin') {
    const act = mode === 'scout' ? 'hire' : 'walkin', fee = mode === 'walkin' ? Run.walkinFee() : 0;
    const poor = fee > G.money, price = fee ? `（契約金 ${fmt(fee)}cr）` : '';
    // 隊がいっぱいなら、誰と入れ替えるかをその場で選ぶ。外した人の義体と装備は戻らない
    actions = crewSize() < ROSTER_MAX
      ? `<div class="actions"><button class="primary" data-act="${act}" data-v="${idx}" ${poor ? 'disabled' : ''}>雇う${price}</button></div>`
      : `<div class="actions swap"><span class="dim">隊は${ROSTER_MAX}人まで。入れ替える人${price}：</span>${G.runners.filter((x) => !x.temp).map((x) => `<button data-act="${act}" data-v="${idx}" data-drop="${x.id}" ${poor || x.status === 'mission' ? 'disabled' : ''}>${esc(x.name)}<small class="dim"> ${ROLES[x.role].tag}</small></button>`).join('')}</div>`;
  }
  return `<article class="runner ${mode} ${r.status === 'mission' ? 'away' : ''} ${r.trait ? 'r-' + TRAITS[r.trait].rarity : ''}">
    <header>
      ${portraitImg(r, 'lg')}
      <div class="nmrow"><b class="nm">${esc(r.name)}</b>${r.story ? '<span class="chip p">物語つき</span>' : ''}${r.trait ? `<span class="chip trait ${TRAITS[r.trait].rarity}">${TRAITS[r.trait].rarity === 'legend' ? '超希少' : '希少'}・${TRAITS[r.trait].name}</span>` : ''}${r.lazarus ? `<span class="chip b">${r.lazarus === 'armed' ? 'ラザロ武装回収' : 'ラザロ'}</span>` : ''}</div>
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
    ${mode === 'roster' ? perkLine(r) : ''}
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
      <div><dt class="label">夜</dt><dd class="num">${run.slot}/${Run.NIGHTS} <span class="dim">通算${G.night}</span></dd></div>
      <div class="${G.money < 0 ? 'neg' : ''}"><dt class="label">所持金</dt><dd class="num">${cr(G.money)}${G.negStreak ? ` <span class="chip p">赤字 ${G.negStreak}/3</span>` : ''}</dd></div>
      <div><dt class="label">隊</dt><dd class="num">${crewSize()}/${ROSTER_MAX}人</dd></div>
    </dl>
    <div class="heat" aria-label="企業ごとのヒート">${CORPS.map((c) => `<div class="hb ${G.heat[c] >= 80 ? 'hot' : ''}"><span>${logo(c)}${CLIENTS[c].short}</span><div class="ht"><i style="width:${G.heat[c]}%"></i></div><b class="num">${G.heat[c]}</b></div>`).join('')}</div>
  </div>
  <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-v="${k}">${l}${badge[k] ? `<span class="bd num">${badge[k]}</span>` : ''}</button>`).join('')}</nav>
  </header>`;
}

function dock() {
  return `<div class="dock"><div class="dock-in">
    <div class="proj">
      <span class="label">所持金</span>
      <span class="num"><b class="${G.money < 0 ? 'pink' : ''}">${cr(G.money)}</b></span>
      <small>${!Run.canEndNight() ? '地区マップで行き先をタップすると出発' : G.missions.length ? `派遣中${G.missions.length}件の報酬は含みません` : '今夜は誰も出ていません'}</small>
    </div>
    ${dockButton()}
  </div></div>`;
}
/* 夜を明かすボタンは、自分で用事を終える行き先（路地裏・闇医者・古物屋）と、依頼を見送るときだけ。
   それ以外は、行き先を選ぶ・送り出す・事件に答えると、そのまま夜が明ける */
function dockButton() {
  const tab = Run.tonightTab();
  if (['scout', 'doc', 'shop'].includes(tab)) return '<button class="primary big" data-act="night">用事を済ませて夜を明かす</button>';
  if (tab === 'board' && G.board.length && !(G.run.tonight && G.run.tonight.type === 'boss')) return '<button class="big" data-act="night">送り出さずに夜を明かす</button>';
  return '';
}

/* ───────── 隠れ家 ───────── */

/* 行き先の中身：依頼なら依頼主・標的・夜数・報酬・必須ロール */
function nodeMeta(info) {
  if (!info.client) return '';
  return `<span class="nm2">${logo(info.client)}${CLIENTS[info.client].short}${info.target ? ` → ${logo(info.target)}${CLIENTS[info.target].short}` : ''}</span>
    <span class="num">${info.nights}夜 ・ ${fmt(info.payout)}cr</span>
    ${info.req && info.req.length ? `<span class="req">${info.req.map((r) => `<span>${ROLES[r].name}</span>`).join('')}</span>` : ''}`;
}

/* 幕のボスの姿。同じロールの肖像を借り、ボスの義体を重ねる */
function bossPortrait(key, cls = '') {
  const B = RUN_BOSSES[key];
  return portraitImg({ name: B.name, id: 0, role: B.role, gender: B.gender, cyber: B.look || [], humanity: 20, base: { EMP: 6 } }, cls);
}
const bossEscorts = (B) => (B.layers ? `黒ICE ${B.layers.length}層` : [...(B.escort || []).map((e) => `${e.name} ${e.type === 'swarm' ? e.n + 2 : e.n}体`), ...(B.commander ? [`${B.commander.name}（指揮官）`] : [])].join('・') || 'なし');
/* 大仕事のボス。名前・耐久・護衛ははじめから見せ、仕掛けと攻略の道は情報で開く */
function bossBox(job) {
  const B = job.boss && RUN_BOSSES[job.boss];
  if (!B) return '';
  const left = bossHits(B);
  const dropName = B.drop ? (B.drop.cyber ? CYBER[B.drop.cyber] : GEAR[B.drop.gear]).name : '';
  return `<section class="bossbox">${bossPortrait(job.boss, 'lg')}<div class="bossin">
    <div class="label">BOSS</div><h3>${B.name}</h3><p>${B.who}</p>
    <dl class="facts"><div><dt>耐久</dt><dd class="num">${left}/${B.hits}</dd></div><div><dt>${B.layers ? 'ネット' : '護衛'}</dt><dd>${bossEscorts(B)}</dd></div>${B.resist ? `<div><dt>耐性</dt><dd class="pink">${TYPES[B.resist].name}の型が効かない</dd></div>` : ''}</dl>
    ${left < B.hits ? '<p class="pink">前の挑戦で削った耐久は戻っていない（護衛は戻っている）</p>' : ''}
    ${job.intel ? `<h4>仕掛け</h4><ul>${B.tricks.map((t) => `<li>${t}</li>`).join('')}</ul><h4>攻略の道</h4><ul class="blue">${B.ways.map((t) => `<li>${t}</li>`).join('')}</ul>`
      : '<p class="dim">情報を買うと、仕掛けと攻略の道が見える。</p>'}
    ${dropName ? `<p class="dim">倒すと、報酬に「${dropName}」が混ざる。</p>` : ''}
  </div></section>`;
}

/* 今夜選べる行き先（詳しい版）。i は Run.options() の中の番号 */
function mapNode(n, i) {
  const run = G.run, info = Run.nodeInfo(n);
  const tags = [n.type === 'hard' ? '<span class="chip p">危険</span>' : '', 
    info.until ? `<span class="chip p">あと${info.until - G.night + 1}夜</span>` : ''].join('');
  return `<button class="node n-${n.type}" data-act="go" data-v="${i}">
    <span class="mk" aria-hidden="true">${info.mark}</span>
    <span class="nb"><b>${info.name}</b>${tags}${info.boss ? `<span class="nboss">${bossPortrait(info.boss, 'sm')}<span><b class="pink">${RUN_BOSSES[info.boss].name}</b><small class="num dim"> 耐久${bossHits(RUN_BOSSES[info.boss])}</small>${RUN_BOSSES[info.boss].resist ? `<small class="pink"> ${TYPES[RUN_BOSSES[info.boss].resist].name}の型が効かない</small>` : ''}</span></span>` : ''}${info.title ? `<span class="nt">${esc(info.title)}</span>` : ''}${nodeMeta(info)}</span>
  </button>`;
}

/* ルートの性格。隠密・交戦・ネットを●○で3段階 */
const routeDots = (b) => `<small class="rdots">${[['隠密', b.stealth], ['交戦', b.combat], ['ネット', b.net]].map(([k, n]) => `${k}${'●'.repeat(n)}${'○'.repeat(3 - n)}`).join(' ')}</small>`;

/* 必須ロールが隊にそろっているか（臨時雇いで補える） */
const reqMet = (req) => (req || []).every((role) => G.runners.some((r) => r.role === role && !r.temp));

/* この幕の地図。1夜1行で、線でつながった先にしか進めない。今夜選べる行き先はタップで出発 */
function actMap() {
  const run = G.run, rows = Run.mapView(), opts = Run.options(), H = 44;
  const lines = [];
  rows.forEach((row, r) => {
    const next = rows[r + 1];
    if (!next) return;
    row.nodes.forEach((a, i) => (a.to || []).forEach((j) => {
      const b = next.nodes[j];
      const on = a.state !== 'off' && b.state !== 'off';
      lines.push(`<line x1="${((i + 0.5) / row.nodes.length) * 100}" y1="${(r + 0.5) * H}" x2="${((j + 0.5) / next.nodes.length) * 100}" y2="${(r + 1.5) * H}" class="${on ? 'on' : ''}"/>`);
    }));
  });
  const mini = (n) => {
    if (n.hidden) return '<button class="mini s-hidden" disabled title="危険度2：まだ見えない" aria-label="まだ見えない"><span>？</span></button>';
    const info = Run.nodeInfo(n), oi = n.state === 'now' ? opts.findIndex((o) => o.idx === n.idx) : -1;
    const req = info.req && info.req.length ? `<i class="rq ${reqMet(info.req) ? 'ok' : 'ng'}" title="必須：${info.req.map((r) => ROLES[r].name).join('・')}"></i>` : '';
    const label = `${info.name}${info.title ? '：' + info.title : ''}${info.payout ? `（${fmt(info.payout)}cr）` : ''}`;
    return `<button class="mini n-${n.type} s-${n.state}" ${oi >= 0 ? `data-act="go" data-v="${oi}"` : 'disabled'} title="${esc(label)}" aria-label="${esc(label)}"><span>${info.mark}</span>${req}</button>`;
  };
  return `<section class="actmap" aria-label="${Run.act().name}の地図">
    <h3>${Run.act().name}の地図 <span class="label">線でつながった先にしか進めない</span></h3>
    <div class="amwrap">
      <div class="amlabels">${rows.map((row) => `<span class="${row.slot === run.slot ? 'cur' : ''}">${row.slot === Run.BOSS_SLOT ? '大仕事' : `${row.slot}夜`}</span>`).join('')}</div>
      <div class="amnodes"><svg viewBox="0 0 100 ${rows.length * H}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
        ${rows.map((row) => `<div class="mrow">${row.nodes.map(mini).join('')}</div>`).join('')}</div>
    </div>
    <p class="hint dim">依頼の右上の点は必須ロール（青：隊にいる／ピンク：いない。臨時雇いで補える）。</p>
  </section>`;
}

function tonightPanel() {
  const run = G.run, t = run.tonight;
  if (!t) return `<section class="panel tonight"><h3>今夜の行き先をタップ <span class="label">${run.slot === Run.BOSS_SLOT ? '大仕事' : `${run.slot}夜目`}</span></h3><p class="dim">昨夜の行き先から線がつながった先だけ選べます。タップするとすぐ出発し、取り消せません。依頼なら編成の画面が開き、送り出すと夜が明けます。隠れ家はそのまま夜が明けます。</p>
    <div class="topts">${Run.options().map((n, i) => mapNode(n, i)).join('')}</div></section>`;
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
  const missions = G.missions.length
    ? G.missions.map((m) => {
      const k = G.night - m.start + 1;
      const names = teamIds(m.team).map((id) => (getR(id) || {}).name).filter(Boolean).join('、');
      return `<li><b>${esc(m.job.title)}</b><span>${m.job.routes[m.routeIdx].name} ・ ${names}</span><span class="num dim">${k}/${m.job.nights}夜目${m.result ? '' : '（今夜出発）'}</span>${m.result || m.progress ? '' : `<button class="sm" data-act="recall" data-v="${m.uid}">取り消す</button>`}</li>`;
    }).join('')
    : '<li class="dim">今夜はまだ誰も出ていません。</li>';
  const tut = run.act === 1 && G.night <= 2 ? `<section class="panel tut hint"><h3>ランの進め方</h3><ol>
      <li>1ランは<b>3幕・30夜</b>。毎夜、<b>行き先を1つタップ</b>する。地図は線でつながった先にしか進めないので、先の夜まで見て道を選ぶ</li>
      <li>依頼は編成して送り出すと夜が明ける。路地裏・闇医者・古物屋は、用事を済ませたら下のボタンで夜を明かす</li>
      <li><b>依頼</b>で派遣して稼ぐ。<b>路地裏</b>か、隊の画面の<b>顔見せ</b>（夜を使わないが契約金がかかる）で雇い、<b>闇医者</b>と<b>古物屋</b>で強くし、<b>隠れ家</b>で立て直す</li>
      <li>各幕の10夜目は<b>大仕事</b>。一発勝負で、失敗するとランは終わる。9夜目は準備の夜で、隠れ家か闇医者に必ず寄れる</li>
      <li>第1幕の大仕事には<b>ネットランナー</b>が要る。最初の隊には必ず1人いる。失ったら路地裏か顔見せで探すこと</li>
      <li>所持金が3夜続けてマイナス、または隊が全滅しても終わり</li>
    </ol></section>` : '';
  return `
  <section class="chapter">
    <div class="label">RUN ・ ${Run.act().name} ・ ${Run.act().place} ・ 前歴：${Run.BACKGROUNDS[G.run.bg].name}${G.run.danger ? ` ・ <span class="pink">危険度${G.run.danger}</span>` : ''}${G.flags.ally ? ` ・ <span class="blue">${logo(G.flags.ally)}${CLIENTS[G.flags.ally].short}と協力中</span>` : ''}</div>
    <ol class="acts">${acts}</ol>
  </section>
  ${tut}
  ${Run.canReroll() ? `<section class="panel reroll"><p>最初の隊：${G.runners.map((r) => `${esc(r.name)}（${ROLES[r.role].name}）`).join('、')}</p><button data-act="reroll">隊を引き直す（あと${G.run.rerolls}回）</button><small class="dim">最初の行き先を選ぶまで</small></section>` : ''}
  ${tonightPanel()}
  ${actMap()}
  ${coneList()}
  ${World.homeHtml()}
  <div class="cols">
    <section class="panel"><h3>派遣中</h3><ul class="mlist">${missions}</ul>
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
    <h2 class="sec">隊 <span class="label num">${crewSize()}/${ROSTER_MAX}</span></h2>
    <div class="runners">${G.runners.map((r) => runnerCard(r, 'roster')).join('') || '<p class="dim">誰もいません。路地裏で雇ってください。</p>'}</div>
  </section>
  <section class="panel"><h3>隊の型 <span class="label">効果は依頼に送り出した人の分だけで数える</span></h3>${typeSummary(Run.crewTypes(), '')}</section>
  ${coneList()}
  ${!G.ended ? viewWalkins() : ''}
  ${G.memorial.length ? `<section class="panel memorial"><h3>帰ってこなかった者</h3><ul>${G.memorial.map((m) => `<li><b>${esc(m.name)}</b>（${ROLES[m.role].name}） 夜${m.night}・${esc(m.cause)}</li>`).join('')}</ul></section>` : ''}`;
}

/* 持っているコネ */
function coneList() {
  const cs = G.run.cones || [];
  if (!cs.length) return '';
  return `<section class="panel cones"><h3>コネ <span class="label">ラン中ずっと効く</span></h3><ul>${cs.map((k) => `<li><b>${CONNECTIONS[k].name}</b>：${CONNECTIONS[k].desc}${CONNECTIONS[k].weak ? `<span class="pink">　弱み：${CONNECTIONS[k].weak}</span>` : ''}</li>`).join('')}</ul></section>`;
}

/* 顔見せ：夜を使わずに雇える今夜の候補（ラン中だけ） */
function viewWalkins() {
  const list = Run.walkins();
  return `<section class="roster walkins">
    <h2 class="sec">顔見せ <span class="label">今夜の候補</span></h2>
    <p class="lead hint">隠れ家に顔を出したランナー。夜を使わずに雇えますが、契約金 <b class="num">${fmt(Run.walkinFee())}cr</b> がかかります（幕が進むと上がる）。候補は毎晩入れ替わります。路地裏ならただで、資質持ちも出やすくなります。</p>
    <div class="runners">${list.map((r, i) => runnerCard(r, 'walkin', i)).join('') || '<p class="dim">今夜の候補はもういません。</p>'}</div>
  </section>`;
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
    <p class="lead hint">候補は今夜かぎりです。隊にいないロールが先に並びます。路地裏の候補は契約金なしで雇え、資質持ちも出やすい。</p>
    <p class="dim">抱えているランナー ${crewSize()}/${ROSTER_MAX}人</p>
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
      <li>現場の「目標」とネットの「データ」をすべて確保して、現場の全員が倒れなければ成功</li>
    </ul>
    <ul class="legend">${phases}${ice}</ul>

    <h3>交戦</h3>
    <ul>
      <li>現場の全員が順に<b>射撃</b>（敵のDV）。当たれば1体倒す。${ROLES.solo.perk.name}のソロは2回撃つ</li>
      <li>残った敵が1体ずつ、現場の誰かを攻撃。<b>回避</b>（敵の攻撃値）に失敗すると被弾</li>
      <li>交戦は、敵か現場の全員のどちらかが倒れるまで続く。全員が倒れると依頼は失敗（死ぬかどうかは一人ずつの死亡セーブ）。追撃戦は支援も戦う</li>
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
      <li>失敗すると死亡。救急サービス「ラザロ」の加入者は回収される（回収費は報酬額の30%）</li>
      <li>上位の武装回収（第${LAZARUS_ARMED.act}幕から、加入料${fmt(LAZARUS_ARMED.fee)}cr）は、死亡セーブに失敗したときか、生き延びて動けなくなったときに出動する。回収班が1ラウンドだけ敵を撃ち、本人をHP半分で運び出す。出動費${fmt(LAZARUS_ARMED.callout)}cr＋報酬額の30%。1つの依頼で1回まで</li>
      <li>休息：全員がd6+2回復。メドテックがいれば医療の半分を足す。${CYBER.medkit.name}を入れた本人は＋5</li>
    </ul>

    <h3>人間性とサイバーサイコシス</h3>
    <ul>
      <li>人間性は義体で削れる。上限はEMP×10（資質で変わる）。31以上は<b>安定</b></li>
      <li><b>不安定（16〜30）</b>：交戦の始めにd10で1が出ると<b>動揺</b>し、その交戦は射撃・回避−2</li>
      <li><b>兆候（1〜15）</b>：交戦の始めに発作の判定。d10が (16−人間性)÷4 の切り上げ以下なら<b>暴走</b>（人間性12〜15で10%、8〜11で20%、4〜7で30%、1〜3で40%）</li>
      <li><b class="pink">暴走</b>：その交戦のあいだ射撃+2で2回撃つ（二連射とは重ならない）。敵を倒すたびに標的の企業のヒート+4（テーザーでも防げない）。交戦が終わると人間性−2。ラザロの対象外。通信では別の色で出る</li>
      <li>暴走した人が同じ依頼で3体倒すと、次の交戦の前に<b>市警の鎮圧班</b>が来る。引き渡す（その人はランから抜ける）・かばう（鎮圧班と交戦。勝てばこの幕のあいだ全依頼の敵+1）から選ぶ</li>
      <li><b>喪失（0）</b>：隠れ家から消える。5夜のうちに地区マップの「元部下」で止めないと、鎮圧班が片付ける。元部下との交戦で3ラウンド以内に倒しきれなくても、鎮圧班が割り込んで片付ける（依頼は失敗、ヒートは上がらない）</li>
      <li>戻し方：隠れ家に寄ると全員+5。闇医者のセラピーは1人+15（${fmt(THERAPY_COST)}cr、次の1夜は出せない）</li>
    </ul>

    <h3>送り出したあと</h3>
    <ul>
      <li>送り出した依頼は、最後まで判定する。途中で引き返させることはできない（交戦を倒しきれない・扉が開かないなど、現場が自分で引くことはある）</li>
      <li>大仕事は一発勝負。失敗するとランは終わる。9夜目は準備の夜で、隠れ家か闇医者に必ず寄れる</li>
    </ul>
  </div>
  <div class="mact"><button class="primary" data-act="closehelp">閉じる</button></div>`;
}

/* ───────── 依頼盤 ───────── */

const PH_DV = {
  sneak: (p) => `隠密 DV${p.dv}`, trap: (p) => `知覚 DV${p.dv}`, combat: (p) => `敵${p.n}・${World.enemies[p.enemyType || 'standard']}`, rest: () => 'HP回復',
  gate: (p) => `電子 DV${p.dv}`, goal: () => '目標', escape: (p) => `運転 DV${p.dv}`, drive: (p) => `運転 DV${p.dv}`,
  talk: (p) => `説得 DV${p.dv}`, med: (p) => `医療 DV${p.dv}`, boss: (p) => (p.boss ? (RUN_BOSSES[p.boss].layers ? `黒ICE ${RUN_BOSSES[p.boss].hits}層` : `ボス 耐久${RUN_BOSSES[p.boss].hits}`) : '耐久3'), ice: (p) => `ICE DV${p.dv}`,
};
const PH_FX = {
  sneak: '隠密：失敗で次の交戦に敵+1、ヒート+4',
  trap: '罠：失敗で警報（ヒート+8・次の交戦に敵+1）と被害',
  combat: '交戦：どちらかが倒れるまで続く。情報を買わずに「???」の交戦に当たると待ち伏せされる',
  gate: '扉：3回まで挑戦。開かなければ力ずくで破り、次の交戦で敵+2',
  escape: '逃走：失敗で追手と交戦',
  drive: '運転：失敗で報酬−20%、次の交戦に敵+1',
  talk: '説得：失敗で交戦',
  med: '医療：失敗で報酬−40%',
  rest: '休息：全員のHPが回復。メドテックがいると多め',
  boss: 'ボス：耐久の数だけ当てると倒れる。腕は本物',
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
    const none = !G.runners.some((r) => r.role === role && available(r));
    const fee = Run.tempFee(job);
    const temp = none ? `<button class="sm" data-act="temp" data-v="${job.uid}" data-role="${role}">臨時雇い（${fee ? `後払い ${fmt(fee)}cr` : '今回は無料'}）</button>` : '';
    return `<span class="chip ${ok ? 'b' : 'p'}">${ok ? '済' : '要'} ${ROLES[role].name}</span>${temp}`;
  }).join('');
  const rows = G.runners.map((r) => {
    const ln = laneOf(team, r.id);
    const can = available(r);
    const seg = can
      ? `<div class="seg" role="group" aria-label="${esc(r.name)}の枠">${['field', 'support', 'net'].map((s) => `<button data-act="assign" data-r="${r.id}" data-v="${s}" aria-pressed="${ln === s}" ${s === 'net' && r.role !== 'net' ? 'disabled' : ''}>${LANE[s]}</button>`).join('')}<button data-act="assign" data-r="${r.id}" data-v="none" aria-pressed="${!ln}">外す</button></div>`
      : `<small class="dim">${statusText(r)}</small>`;
    const hurt = r.hp < maxHp(r) / 2 ? ' <span class="pink">重傷 −2</span>' : '';
    // 交戦ごとの危なさ。不安定は動揺、兆候は暴走の確率
    const z = humZone(r.humanity).key;
    const risk = z === 'unstable' ? '<span class="chip o" title="交戦の始めにd10で2以下なら動揺。交戦ごとに人間性−1">動揺 20%</span>'
      : z === 'sign' ? `<span class="chip p" title="交戦の始めに発作の判定">暴走 ${Math.ceil((16 - r.humanity) / 4) * 10}%</span>` : '';
    return `<div class="pick ${ln ? 'in' : ''} ${can ? '' : 'off'}">
      <div class="pn">${portraitImg(r, 'sm')}<b>${esc(r.name)}</b>${r.temp ? '<span class="chip o">臨時</span>' : ''}<span class="role sm">${ROLES[r.role].tag}</span><span class="num dim">HP ${r.hp}/${maxHp(r)}${hurt}</span>${risk}</div>
      ${seg}</div>`;
  }).join('');
  const B = job.runBoss && typeof job.boss === 'string' && RUN_BOSSES[job.boss];
  const resist = B && B.resist ? `<p class="pink resist">${B.name}は${TYPES[B.resist].name}の型に強い。この大仕事では${TYPES[B.resist].name}の型の効果が出ない</p>` : '';
  return `<div class="actions"><button data-act="usualTeam" data-v="${job.uid}" ${G.lastTeam ? '' : 'disabled'}>いつもの面子</button></div>
    <div class="slots">${lane('field')}${lane('support')}${lane('net')}</div>
    <h4 class="slot-h">送り出す人の型 <span class="label">2つ・4つ・6つで効果</span></h4>${typeSummary(countTypes(teamIds(team).map(getR).filter(Boolean).flatMap(typesOf)), '送り出した人の')}${resist}
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
  const heat = [];
  if (job.target && CLIENTS[job.target].kind === 'corp') heat.push(`${CLIENTS[job.target].short} +${job.heat}`);
  if (CLIENTS[job.client].kind === 'corp') for (const c of CORPS) if (c !== job.client && c !== job.target) heat.push(`${CLIENTS[c].short} +${job.rank * 3}`);
  const cnt = G.repeats[job.tpl] || 0;
  const cred = job.special ? job.cred : cnt === 0 ? job.cred : cnt === 1 ? Math.ceil(job.cred / 2) : 0;
  return `<dl class="ledger pay">
    <div><dt>依頼の報酬</dt><dd class="num">${fmt(pp.payout)}</dd></div>
    ${pp.temps ? `<div><dt>臨時雇いの後払い <span class="dim">失敗しても払う</span></dt><dd class="num pink">−${fmt(pp.temps)}</dd></div>` : ''}
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
    ${bossBox(job)}
    <dl class="facts">
      <div><dt>評判ランク</dt><dd>R${job.rank}</dd></div>
      <div><dt>夜数</dt><dd class="num">${job.nights}</dd></div>
      <div><dt>依頼額</dt><dd class="num">${fmt(Math.round((job.basePayout ?? job.payout) * World.payoutMultiplier(job)))}cr</dd></div>
    </dl>
    <h3>ルート</h3>
    <div class="toggle routes" role="group" aria-label="ルート">${(() => { const rec = Run.recommendRoute(job, teamIds(getTeam(job.uid))); return job.routes.map((r, i) => `<button data-act="route" data-v="${i}" aria-pressed="${i === UI.route}"><span>${esc(r.name)}${i === rec ? ' <span class="chip b">おすすめ</span>' : ''}</span>${routeDots(Run.routeBars(r, job.intel))}</button>`).join(''); })()}</div>
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
    <button class="primary big" data-act="dispatch" data-v="${job.uid}" ${errs.length ? 'disabled' : ''}>送り出す（夜が明ける）</button>
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
    const purse = G.money;
    const slots = Object.entries(GEAR_SLOTS).map(([slot, name]) => {
      const cur = r.gear[slot];
      const items = Object.keys(GEAR).filter((id) => GEAR[id].slot === slot && (!GEAR[id].drop || cur === id)).map((id) => {
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
        <p class="dim">所持金 ${cr(G.money)}</p>
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
    else btns = `<button data-act="cyber" data-r="${r.id}" data-c="${c}" ${price > G.money ? 'disabled' : ''}>${verb}${fmt(price)}crで入れる</button>`;
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
    const ids = Object.keys(CYBER).filter((c) => CYBER[c].cat === k && (!CYBER[c].drop || r.cyber.includes(c))).sort(order);
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
          <div class="carerow"><span>セラピー（人間性+15、次の${THERAPY_NIGHTS}夜は出せない）</span><button data-act="therapy" data-r="${r.id}" ${r.status !== 'idle' || r.humanity >= maxHum(r) ? 'disabled' : ''}>${cr(THERAPY_COST)}</button></div>
          <div class="carerow laz"><span>救急サービス「ラザロ」<small class="dim">加入料はその場で1回だけ（上のプランへは差額。やめても戻らない）。基本：死亡セーブに失敗したらHP1で回収（回収費は報酬額の30%）。武装回収：倒れたら回収班が1ラウンド撃ち、HP半分で運び出す（出動費${fmt(LAZARUS_ARMED.callout)}cr＋30%、1つの依頼で1回）。暴走中は対象外</small></span>
            <div class="seg" role="group" aria-label="ラザロのプラン">
              <button data-act="lazarus" data-r="${r.id}" data-v="" aria-pressed="${!r.lazarus}">なし</button>
              <button data-act="lazarus" data-r="${r.id}" data-v="basic" aria-pressed="${!!r.lazarus && r.lazarus !== 'armed'}" ${Run.lazarusFee(r, 'basic') > G.money ? 'disabled' : ''}>基本 ${r.lazarus && r.lazarus !== 'armed' ? '加入中' : Run.lazarusFee(r, 'basic') ? cr(Run.lazarusFee(r, 'basic')) : ''}</button>
              <button data-act="lazarus" data-r="${r.id}" data-v="armed" aria-pressed="${r.lazarus === 'armed'}" ${G.run.act < LAZARUS_ARMED.act && r.lazarus !== 'armed' ? `disabled title="第${LAZARUS_ARMED.act}幕から"` : Run.lazarusFee(r, 'armed') > G.money ? 'disabled' : ''}>武装回収 ${r.lazarus === 'armed' ? '加入中' : cr(Run.lazarusFee(r, 'armed'))}${G.run.act < LAZARUS_ARMED.act ? `（第${LAZARUS_ARMED.act}幕から）` : ''}</button>
            </div></div>
        </div>
      </div>
      <div class="catalog">
        <h3>義体 <span class="label">能力は経験より義体で伸びる</span></h3>
        <p class="dim hint">部位ごとに枠は2つ（体表は1つ）。同じ系統の上位モデルは入れ替わるので枠を使わない。枠がいっぱいのときは、どれかを外してから入れる。外した義体は戻らず、人間性も戻らない。</p>
        <p class="dim hint">所持金で払います。${half ? ' <span class="chip b">割引券あり：半額</span>' : ''}</p>
        ${catChips}
        ${cat}
      </div>
    </div>
  </section>`;
}

/* ───────── 記録 ───────── */

/* 通信の行。いつもは結果と描写・セリフ（flavor.js）を出し、ダイスの計算（.calc）と数字の内訳は
   「ダイスを見る」を押したときだけ出す（body.show-dice。prefs.dice に残す） */
function logLines(lines, animate) {
  return lines.map((l) => {
    const at = ` data-ph="${l.ph ?? ''}" data-lane="${l.lane || ''}"`;
    if (l.sub) {
      const what = l.brief ? `<span class="what dice-only">${esc(l.text)}</span><span class="what story-only">${esc(l.brief)}</span>` : `<span class="what">${esc(l.text)}</span>`;
      return `<div class="ln sub ${l.kind}${animate ? '' : ' on'}"${at}>${what}</div>`;
    }
    const res = l.calc && ['ok', 'ng'].includes(l.kind)
      ? `<span class="res">${l.kind === 'ok' ? (l.crit ? '会心' : '成功') : (l.fumble ? '大失敗' : '失敗')}</span>` : '';
    const fl = Flavor.of(l);
    return `<div class="ln ${l.kind} ${l.lane === 'net' ? 'net' : ''}${l.mad ? ' mad' : ''}${animate ? '' : ' on'}"${at}>
      <span class="t">${l.t ? `[${l.t}]` : ''}</span>${l.lane === 'net' ? '<span class="lanetag">NET</span>' : ''}<span class="who">${esc(l.who || '')}</span><span class="what">${esc(l.text)}</span>${res}${l.calc ? `<span class="calc">${esc(l.calc)}</span>` : ''}${fl ? `<span class="fl${fl.say ? ' say' : ''}">${esc(fl.text)}</span>` : ''}</div>`;
  }).join('');
}
const diceButton = () => `<button data-act="dice" aria-pressed="${!!prefs.dice}" title="判定のダイスと計算を表示する">ダイスを${prefs.dice ? '隠す' : '見る'}</button>`;
const applyDice = () => {
  document.body.classList.toggle('show-dice', !!prefs.dice);
  document.querySelectorAll('[data-act="dice"]').forEach((b) => { b.setAttribute('aria-pressed', !!prefs.dice); b.textContent = `ダイスを${prefs.dice ? '隠す' : '見る'}`; });
};

function viewLog() {
  if (!G.archive.length) return '<section><h2 class="sec">記録</h2><p class="dim">まだ夜を明かしていません。派遣中に届いた通信がここに残ります。</p></section>';
  return `<section><h2 class="sec">記録 <span class="label">COMM LOG</span> ${diceButton()}</h2>
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
    <div class="mact">${reduced ? '' : speedControl()}${diceButton()}<button data-act="skiplog">すべて表示</button><button class="primary" data-act="next">次へ</button></div>`;
}

/* 鎮圧班が来たときの3択。暴走した人をどうするか */
function squadChoice(c) {
  return `<p class="pink">${esc(c.reason)}</p>
    <p>暴走した${esc(c.who || '仲間')}を、市警の鎮圧班が追ってきた。</p>
    <div class="bonus squad">
      <button data-act="decision" data-v="handover" data-uid="${c.uid}"><span class="label">引き渡す</span>${esc(c.who || '')}は連れていかれ、ランから抜ける（死亡ではなく拘束）。依頼は残りの人数で続く</button>
      <button data-act="decision" data-v="protect" data-uid="${c.uid}"><span class="label">かばう</span>鎮圧班と交戦する（DV・攻撃は基準値+4、4d6+4、${esc(c.who || '')}を先に狙う）。勝てば依頼も続くが、この幕のあいだ全依頼の敵+1</button>
    </div>`;
}
function pendingComm(c) {
  if (c.kind === 'maxtac') return `<div class="label">通信・鎮圧班</div><h2>${esc(c.title)}</h2>${commStrip(c)}<div class="log play">${logLines(c.lines, !instantLog())}</div><div class="tail" ${instantLog() ? '' : 'hidden'}>${squadChoice(c)}</div>${speedControl()}${diceButton()}<button data-act="skiplog">すべて表示</button>`;
  return '<div class="label">通信・判断待ち（最大2回）</div><h2>'+esc(c.title)+'</h2>'+commStrip(c)+
    '<div class="log play">'+logLines(c.lines,!instantLog())+'</div>'+
    '<div class="tail" '+(instantLog()?'':'hidden')+'><div class="mact"><button class="primary" data-act="decision" data-v="go" data-uid="'+c.uid+'">次へ</button></div></div>'+speedControl()+diceButton()+'<button data-act="skiplog">すべて表示</button>';
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
    ${b ? rewardPicker(b)
      : '<div class="mact"><button class="primary" data-act="next">次へ</button></div>'}`;
}

/* ───────── 報酬3択 ───────── */

const REWARD_KIND = { cyber: '義体', gear: '装備', runner: 'ランナー', cone: 'コネ', cr: 'cr' };
const SLOT_NAME = { 1: '多い型', 2: '別の型', 3: 'コネか型のないもの' };
/* 型のチップ。counts を渡すと、取ったあとの数と、次に開く効果を添える */
function typeChips(types, counts) {
  return (types || []).map((t) => {
    if (!counts) return `<span class="chip ty ty-${t}">${TYPES[t].name}</span>`;
    const now = counts[t] || 0, next = TYPE_STEPS.find((n) => n > now);
    return `<span class="chip ty ty-${t}" title="${next ? `${TYPES[t].name}${next}つ：${TYPES[t].fx[next]}` : ''}">${TYPES[t].name} ${now}→${now + 1}${next === now + 1 ? '：効果' : ''}</span>`;
  }).join('');
}
/* 隊の型の数と、効いている効果 */
function typeSummary(counts, note) {
  const keys = Object.keys(TYPES).filter((t) => counts[t]);
  if (!keys.length) return `<p class="dim types">型はまだない。義体・装備・資質を集めると、${note}2つ・4つ・6つで効果が付く。</p>`;
  return `<div class="types">${keys.map((t) => {
    const n = counts[t], on = TYPE_STEPS.filter((k) => n >= k), next = TYPE_STEPS.find((k) => k > n);
    return `<div class="tyrow"><span class="chip ty ty-${t}">${TYPES[t].name} ${n}</span><small>${on.map((k) => `<b>${k}</b> ${TYPES[t].fx[k]}`).join('　') || `<span class="dim">あと${next - n}つで：${TYPES[t].fx[next]}</span>`}${on.length && next ? `<span class="dim">　次は${next}つ</span>` : ''}</small></div>`;
  }).join('')}</div>`;
}
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
  if (o.kind === 'runner') return `<div class="rt">${btn(null, crewSize() >= ROSTER_MAX ? '隊がいっぱい' : '隊に入れる')}</div>`;
  return `<div class="rt">${btn(null, '受け取る')}</div>`;
}
function rewardBody(o) {
  if (o.kind === 'cyber') {
    const c = CYBER[o.id];
    return `<b>${c.name}</b>${c.tier > 1 ? `<span class="chip o">上位 Mk.${'I'.repeat(c.tier)}</span>` : ''}<div class="tys">${typeChips(c.types, Run.crewTypes())}</div><p>${c.desc}</p><small class="dim">${CYBER_CATS[c.cat]} ・ 施術費なし（人間性は削れる）</small>`;
  }
  if (o.kind === 'gear') { const g = GEAR[o.id]; return `<b>${g.name}</b><div class="tys">${typeChips(g.types, Run.crewTypes())}</div><p>${g.desc}</p><small class="dim">${GEAR_SLOTS[g.slot]} ・ ${g.drop ? '古物屋では手に入らない' : `古物屋なら${fmt(g.price)}cr`}</small>`; }
  if (o.kind === 'runner') {
    const r = o.runner, R = ROLES[r.role];
    const top = SKILLS.filter((k) => skill(r, k) > 0).sort((a, b) => skill(r, b) - skill(r, a)).slice(0, 3).map((k) => `${k}${skill(r, k)}`).join('・');
    return `<div class="rwr">${portraitImg(r, 'sm')}<b>${esc(r.name)}</b><span class="role sm">${R.tag}</span></div>${r.trait ? `<span class="chip trait ${TRAITS[r.trait].rarity}">${TRAITS[r.trait].name}</span><p class="dim">${TRAITS[r.trait].desc}</p>` : ''}<p>${R.name} ・ ${top}</p>`;
  }
  if (o.kind === 'cone') { const k = CONNECTIONS[o.id]; return `<b>${k.name}</b><p>${k.desc}</p>${k.weak ? `<p class="pink">弱み：${k.weak}</p>` : ''}<small class="dim">ラン中ずっと効く</small>`; }
  return `<b>${fmt(o.amount)}cr</b><p>そのまま所持金に入る</p>`;
}
function rewardPicker(b) {
  return `<h3>報酬を1つ選ぶ ${b.rare ? '<span class="chip p">希少1つ確定</span>' : ''}</h3>
    ${b.top ? `<p class="dim hint">1つ目は隊にいちばん多い型（${TYPES[b.top].name}）の品、2つ目は別の型、3つ目はコネか型のないもの。</p>` : ''}
    <div class="rewards">${b.opts.map((o, i) => `<div class="rw ${o.rare ? 'rare' : ''}"><span class="label">${o.slot ? `${o.slot}つ目 ・ ` : ''}${REWARD_KIND[o.kind]}${o.rare ? ' ・ 希少' : ''}</span>${o.drop ? `<span class="chip p">${RUN_BOSSES[o.drop].name}の品</span>` : ''}${rewardBody(o)}<div class="rts">${rewardTargets(o, i)}</div></div>`).join('')}</div>
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
  return `<div class="label">ブラックボックス ・ 分岐</div>
    <h2>${c.title}</h2>
    ${c.body.map((p) => `<p class="story">${p}</p>`).join('')}
    ${G.run && G.run.corp ? `<p class="dim">前歴「企業の元社員」：${CLIENTS[G.run.corp].name}と組むことは、始めから決まっている。</p>` : ''}
    <div class="bonus branch">${c.options.map((o, i) => G.run && G.run.corp && o.ally !== G.run.corp ? '' : `<button data-act="branch" data-v="${i}"><span class="label">${logo(o.ally)}${CLIENTS[o.ally].name}と組む</span>${o.text}<small class="num pink">ヒート ${heat(o)}</small></button>`).join('')}</div>`;
}

function stepReport(out) {
  return `<div class="label">夜明け ・ 夜${out.night}</div>
    <h2>夜が明けた</h2>
    <dl class="ledger">
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
  if (key.startsWith('choice-')) return cutin({ kicker: 'ブラックボックス', title: '分岐', tone: 'blue' });
  if (key.startsWith('queued-')) {
    const [kick, title] = CHAPTERS[key.slice(7)].title.split('　');
    return cutin({ kicker: 'MAIN ・ ブラックボックス', title, tone: 'pink' });
  }
  if (!UI.flow) return;
  const s = UI.flow.steps[UI.flow.step];
  const out = UI.flow.out;
  if (s.k === 'story') {
    const [kick, title] = (CHAPTERS[s.n] || INTERLUDES[s.n]).title.split('　');
    return cutin({ kicker: CHAPTERS[s.n] ? 'MAIN ・ ブラックボックス' : kick, title, tone: CHAPTERS[s.n] ? 'pink' : 'blue' });
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
    <div class="label">ROGUELIKE ・ 30夜のラン</div>
    <h1 class="logo-big">FIXER'S CUT<span>フィクサーズ・カット</span></h1>
    <p class="thesis">自分は撃たない。<em>30夜のうちに</em>街の上層まで仕事を通す。毎夜の選択で隊が育ち、ひとつの判定で隊が崩れる。</p>
    <p class="dim">舞台は湾岸の沈みかけた都市ヨミハマ。1ランは3幕・30夜。毎夜、地区マップから行き先を1つ選び、各幕の最後に大仕事がある。ランナーは死ねば戻らず、隊の組み合わせはランごとに違う。決めるのは次の4つだけです。</p>
    <ul class="decide"><li>今夜、街のどこへ行くか</li><li>どの仕事に、誰を出すか</li><li>出す前に、情報にいくら払うか</li><li>どこまで体を機械にさせるか</li></ul>
    ${(() => { const m = Run.loadMeta(); return m.runs ? `<p class="dim num">これまでのラン ${m.runs}回 ・ クリア ${m.clears}回${m.best ? ` ・ 最高到達 ${m.best.clear ? 'クリア' : `${Run.ACTS[m.best.act].name} ${m.best.slot}夜目`}` : ''}</p>` : ''; })()}
    ${loadError ? `<div class="panel loaderr"><h3 class="pink">保存データを読み込めませんでした</h3><p>データは消さずに残してあります。更新直後なら、最新のファイルで読み込み直すと開けることがあります。</p><div class="actions">${recoveryButtons()}</div><p class="dim num">${esc(loadError)}</p></div>` : ''}
    <div class="ts-actions">
      ${exists && UI.ask === 'newgame' ? '<button class="danger big" data-act="new">今のランを捨てて始める（控えを1つ残します）</button>' : `<button class="${loadError ? '' : 'primary '}big" data-act="${exists ? 'asknew' : 'new'}">新しいランを始める</button>`}
      ${sv ? `<button class="big" data-act="continue">続きから（${Run.ACTS[sv.run.act].name}・${sv.run.slot}夜目）</button>` : ''}
      ${Run.loadMeta().runs ? `<button class="big" data-act="hideout">隠れ家の改装（信用 ${Run.loadMeta().credit}）</button>` : ''}
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
  boss: { title: '大仕事に失敗', body: ['大仕事は、届かなかった。やり直しの利く仕事ではなかった。', '箱は手の中にあるのに、もう開ける手立てがない。湾岸の噂は、新人フィクサーの名前をすぐに忘れた。'] },
};

/* 地区マップでたどった行き先を、幕ごとに並べる */
function runRoute() {
  return [1, 2, 3].map((a) => {
    const hs = G.run.history.filter((h) => h.act === a);
    if (!hs.length) return '';
    return `<li><span class="label">${Run.ACTS[a].name}</span>${hs.map((h) => `<span class="mk n-${h.type}" title="${Run.DEST[h.type].name}">${Run.DEST[h.type].mark}</span>`).join('')}</li>`;
  }).join('');
}

/* 負けた理由。終わり方と、最後の失敗と、帰ってこなかった者 */
function lossReasons() {
  const run = G.run, t = G.ended.type, losses = run.losses || [];
  const last = losses[losses.length - 1], bossLoss = losses.filter((l) => l.boss && l.act === run.act);
  const why = {
    bankrupt: '所持金が3夜続けてマイナスになった',
    wipe: '隊が全滅した',
    boss: `${Run.ACTS[run.act].name}の大仕事に失敗した`,
  }[t] || '';
  const items = [why && `<li><b>${why}</b></li>`];
  for (const l of (t === 'boss' ? bossLoss : last ? [last] : [])) items.push(`<li>夜${l.night}「${esc(l.title)}」：${esc(l.reason || '失敗')}</li>`);
  const dead = G.memorial.filter((m) => m.night >= G.night - 3);
  if (dead.length) items.push(`<li>最後の数夜で失った：${dead.map((m) => `${esc(m.name)}（${esc(m.cause)}）`).join('、')}</li>`);
  return `<h3>負けた理由</h3><ul class="why">${items.filter(Boolean).join('')}</ul>`;
}

function renderEnding() {
  const t = G.ended.type;
  const e = RUN_ENDS[t] || ENDINGS[t];
  const run = G.run, m = run.meta || Run.loadMeta();
  const clear = !RUN_ENDS[t];
  app.innerHTML = `<div class="title-screen ending"><div class="ts-in">
    <div class="label">${clear ? 'RUN CLEAR' : 'RUN OVER'} ・ ${clear ? '30夜を越えた' : `${Run.ACTS[run.act].name} ${run.slot}夜目`}</div>
    <h1 class="logo-big">${e.title}</h1>
    ${e.body.map((p) => `<p class="story">${p}</p>`).join('')}
    ${clear && m.fragments && m.fragments.length >= 5 ? `<p class="story blue">${Meta.HIDDEN_END}</p>` : ''}
    ${G.runners.length || G.flags.spared ? `<ul class="epilogue">${G.flags.spared ? '<li>名簿に載っていた被検体は、撃たれずに済んだ。検疫の外で、初めての朝を迎えた。</li>' : ''}${G.runners.map((r) => `<li>${esc(epilogue(r))}</li>`).join('')}</ul>` : ''}
    ${clear ? '' : lossReasons()}
    ${run.credit ? `<h3>信用 <span class="label">隠れ家の改装に使える</span></h3><dl class="ledger">${run.credit.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="num">+${v}</dd></div>`).join('')}<div class="tot"><dt>このランで</dt><dd class="num">+${run.credit.total}</dd></div><div><dt>手持ちの信用</dt><dd class="num">${m.credit}</dd></div></dl>` : ''}
    <h3>たどった道</h3>
    <ul class="route">${runRoute()}</ul>
    <dl class="ledger endstats">
      <div><dt>前歴</dt><dd>${Run.BACKGROUNDS[run.bg || 'solo'].name}</dd></div>
      <div><dt>到達</dt><dd>${clear ? 'クリア' : `${Run.ACTS[run.act].name}・${Run.ACTS[run.act].place} ${run.slot}夜目`}</dd></div>
      <div><dt>過ごした夜</dt><dd class="num">${G.night}</dd></div>
      <div><dt>所持金</dt><dd class="num">${cr(G.money)}</dd></div>
      <div><dt>これまでのラン</dt><dd class="num">${m.runs}回 ・ クリア${m.clears}回</dd></div>
      <div><dt>最後まで残ったランナー</dt><dd>${G.runners.map((r) => esc(r.name)).join('、') || 'なし'}</dd></div>
      <div><dt>帰ってこなかった者</dt><dd>${G.memorial.map((m) => esc(m.name)).join('、') || 'なし'}</dd></div>
    </dl>
    <div class="ts-actions"><button class="primary big" data-act="restart">次のランへ</button><button class="big" data-act="hideout">隠れ家の改装へ</button></div>
  </div></div>`;
  modal.hidden = true;
  UI.modalKey = '';
  document.body.classList.remove('locked');
  City.setMode('full');
  cutin({ kicker: clear ? 'RUN CLEAR' : 'RUN OVER', title: e.title, tone: clear ? 'blue' : 'red' });
}

/* ───────── 描画と操作 ───────── */

/* ───────── 前歴を選ぶ ───────── */

/* 隠れ家の改装。信用で部屋・協力者・出発前の準備・解放を買う。記念碑・伝説・物語の断片もここに出る */
function renderHideout() {
  City.setMode('full');
  const m = Run.loadMeta();
  const btn = (k, v, cost, done) => (done ? '<small class="dim">済み</small>' : `<button class="sm" data-act="buymeta" data-k="${k}" data-v="${v}" ${m.credit < cost ? 'disabled' : ''}>信用${cost}</button>`);
  const rooms = Object.entries(Meta.ROOMS).map(([k, R]) => { const lv = Meta.room(m, k); return `<div class="mrow2"><b>${R.name}</b> <span class="label num">${lv}/3</span>
    <ul class="checks">${R.lv.map((t, i) => `<li class="${i < lv ? 'done' : ''}">${i < lv ? '済' : `${i + 1}段`}　${t}</li>`).join('')}</ul>${btn('room', k, R.cost[lv], lv >= 3)}</div>`; }).join('');
  const list = (T, kind, pre) => Object.entries(T).map(([k, x]) => `<li><b>${x.name}</b>${x.desc ? `：${x.desc}` : ''} ${btn(kind, k, x.cost, Meta.has(m, pre + k))}</li>`).join('');
  const frags = Object.keys(Meta.FRAGMENTS).map((k) => `<li class="${m.fragments.includes(k) ? '' : 'dim'}">${m.fragments.includes(k) ? Meta.FRAGMENTS[k] : `？？？（${RUN_BOSSES[k].name}を初めて倒すと開く）`}</li>`).join('');
  app.innerHTML = `<div class="title-screen hideout"><div class="ts-in">
    <div class="label">HIDEOUT ・ ランをまたいで残るもの</div>
    <h1 class="logo-big">隠れ家の改装</h1>
    <p>信用 <b class="num">${m.credit}</b> <span class="dim">（これまでに${m.earned}・ラン${m.runs}回・クリア${m.clears}回）</span></p>
    <p class="dim">信用は、生き延びた夜・越えた大仕事・クリア・初めてのことで増える。負けても、遠くまで行ったランほど多く残る。</p>
    <h3>部屋 <span class="label">毎ランずっと効く</span></h3><div class="rooms">${rooms}</div>
    <h3>協力者 <span class="label">各幕の地図の5夜目あたりに、その人の地点が出る</span></h3><ul class="metal">${list(Meta.CONTACTS, 'contact', 'contact_')}</ul>
    <h3>出発前の準備 <span class="label">解放すると、ランの始めに1つ選んで持ち込める</span></h3><ul class="metal">${list(Meta.PREPS, 'prep', 'prep_')}</ul>
    <h3>解放 <span class="label">前歴と、型ごとの強い品</span></h3><ul class="metal">${list(Meta.UNLOCKS, 'unlock', '')}</ul>
    <h3>前歴の熟練 <span class="label">その前歴で遊ぶと上がる。2段：型の品をもう1つ／3段：弱みが消える</span></h3>
    <ul class="metal">${Object.entries(Run.BACKGROUNDS).map(([k, b]) => `<li>${b.name}：${Meta.masteryOf(m, k)}段 <span class="dim">（${m.mastery[k] || 0}回）</span></li>`).join('')}</ul>
    <h3>危険度 <span class="label">いま${m.dangerMax}段まで。クリアするたびに次の段が開く</span></h3><ul class="metal">${Meta.DANGER.slice(1).map((t, i) => `<li class="${i < m.dangerMax ? '' : 'dim'}">${i + 1}：${t}</li>`).join('')}</ul>
    <h3>物語の断片 <span class="label">${m.fragments.length}/5</span></h3><ul class="metal">${frags}</ul>
    ${m.legends.length ? `<h3>伝説 <span class="label">路地裏にまれに現れる</span></h3><ul class="metal">${m.legends.map((L) => `<li><b>${esc(L.name)}</b>（${ROLES[L.role].name}）<span class="dim"> ${L.run}回目のランをクリア</span></li>`).join('')}</ul>` : ''}
    ${m.memorial.length ? `<h3>記念碑</h3><ul class="metal memorial">${m.memorial.map((x) => `<li><b>${esc(x.name)}</b>（${ROLES[x.role].name}）<span class="dim"> ${x.run}回目のラン・${esc(x.cause)}</span></li>`).join('')}</ul>` : ''}
    <div class="ts-actions"><button class="primary big" data-act="new">新しいランを始める</button><button class="big" data-act="closehideout">タイトルへ戻る</button></div>
  </div></div>`;
  modal.hidden = true;
  UI.modalKey = '';
}

function renderSetup() {
  City.setMode('full');
  const st = UI.setup, Bs = Run.BACKGROUNDS, meta = Run.loadMeta(), first = meta.runs === 0;
  if (!Meta.bgOpen(st.bg, meta)) st.bg = 'solo';
  const cards = Object.entries(Bs).map(([k, b]) => { const open = Meta.bgOpen(k, meta), lv = Meta.masteryOf(meta, k); return `<button class="bgc" data-act="setbg" data-v="${k}" aria-pressed="${st.bg === k}" ${open ? '' : 'disabled'}>
      <span class="label">${open ? `熟練 ${lv}段${lv < 3 ? `（あと${Meta.MASTERY[lv] - (meta.mastery[k] || 0)}回で${lv + 1}段）` : ''}` : `隠れ家の改装で解放（信用${Meta.UNLOCKS['bg_' + k].cost}）`}</span><b>${b.name}</b>
      <span class="bgcrew">${k === 'patchwork' ? '好きなロールで3人' : first ? 'ジロウ・サエ・ネットランナー（初めてのラン）' : 'ランダムな3人（ネットランナーと、戦える人を含む）'}</span>
      <span class="blue">利点：${b.perk}</span><span class="pink">弱み：${b.weak}${lv >= 3 ? '（熟練3段で消えた）' : ''}</span></button>`; }).join('');
  const danger = meta.dangerMax ? `<h3>危険度 <span class="label">クリアするたびに次の段が開く。稼ぐ信用は1段ごとに+10%</span></h3><div class="seg" role="group" aria-label="危険度">${Array.from({ length: meta.dangerMax + 1 }, (_, d) => `<button data-act="setdanger" data-v="${d}" aria-pressed="${(st.danger || 0) === d}">${d}</button>`).join('')}</div>${st.danger ? `<ul class="metal">${Meta.DANGER.slice(1, st.danger + 1).map((t, i) => `<li>${i + 1}：${t}</li>`).join('')}</ul>` : ''}` : '';
  const preps = Meta.prepsOpen(meta);
  const prep = preps.length ? `<h3>出発前の準備 <span class="label">1つ持ち込む</span></h3><div class="seg" role="group" aria-label="出発前の準備"><button data-act="setprep" data-v="" aria-pressed="${!st.prep}">なし</button>${preps.map((k) => `<button data-act="setprep" data-v="${k}" aria-pressed="${st.prep === k}" title="${Meta.PREPS[k].desc}">${Meta.PREPS[k].name}</button>`).join('')}</div>${st.prep ? `<p class="dim">${Meta.PREPS[st.prep].desc}</p>` : ''}` : '';
  const extra = st.bg === 'corp'
    ? `<h3>組む社</h3><div class="seg" role="group" aria-label="組む社">${CORPS.map((c) => `<button data-act="setcorp" data-v="${c}" aria-pressed="${st.corp === c}">${logo(c)}${CLIENTS[c].short}</button>`).join('')}</div>
      <p class="dim">第1幕の大仕事のあと、${CLIENTS[st.corp].name}と組むことが決まっている。第3幕のボスもこの社で決まる。</p>`
    : st.bg === 'patchwork'
      ? `<h3>最初の3人</h3>${[0, 1, 2].map((i) => `<div class="seg" role="group" aria-label="${i + 1}人目のロール"><span class="label">${i + 1}人目</span>${Object.keys(ROLES).map((r) => `<button data-act="setrole" data-i="${i}" data-v="${r}" aria-pressed="${st.roles[i] === r}">${ROLES[r].name}</button>`).join('')}</div>`).join('')}`
      : '';
  app.innerHTML = `<div class="title-screen"><div class="ts-in setup">
    <div class="label">NEW RUN ・ 前歴を選ぶ</div>
    <h1 class="logo-big">前歴</h1>
    <p class="dim">フィクサーになる前に、何をしていたか。ラン中ずっと効く利点と弱みが決まる。最初の隊はランダムな3人で、最初の行き先を選ぶまで1回だけ引き直せる。初期資金はどれも3,000cr（寄せ集めだけ1,500cr）。</p>
    <div class="bgs">${cards}</div>
    ${extra}
    ${danger}
    ${prep}
    <div class="ts-actions"><button class="primary big" data-act="startrun">「${Bs[st.bg].name}」で始める</button><button class="big" data-act="cancelsetup">タイトルへ戻る</button></div>
  </div></div>`;
  modal.hidden = true;
  UI.modalKey = '';
}

function render() {
  try {
    if (!G) return UI.setup ? renderSetup() : UI.hideout ? renderHideout() : renderTitle();
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
  new() { UI.ask = null; UI.hideout = false; UI.setup = { bg: 'solo', corp: CORPS[0], roles: ['solo', 'net', 'driver'] }; render(); window.scrollTo(0, 0); },
  setbg(b) { UI.setup.bg = b.dataset.v; render(); },
  setcorp(b) { UI.setup.corp = b.dataset.v; render(); },
  setrole(b) { UI.setup.roles[+b.dataset.i] = b.dataset.v; render(); },
  cancelsetup() { UI.setup = null; render(); },
  hideout() { if (G && G.ended) clearSave(); G = null; UI.hideout = true; UI.flow = null; render(); window.scrollTo(0, 0); },
  closehideout() { UI.hideout = false; render(); },
  buymeta(b) { const e = Meta.buy(b.dataset.k, b.dataset.v); if (e) toast(e); render(); },
  setprep(b) { UI.setup.prep = b.dataset.v || null; render(); },
  setdanger(b) { UI.setup.danger = +b.dataset.v; render(); },
  startrun() {
    const st = UI.setup;
    clearSave(); UI.setup = null;
    newGame(st.bg, { corp: st.corp, roles: st.roles, prep: st.prep, danger: st.danger || 0, first: Run.loadMeta().runs === 0 });
    UI.tab = 'home'; save(); render(); window.scrollTo(0, 0);
  },
  continue() { G = loadSave(); UI.tab = 'home'; if(G && G.nightInProgress) H_.night(); else render(); },
  restart() { G = null; clearSave(); UI.ask = null; UI.flow = null; render(); },
  closeintro() { G.storyQueue = G.storyQueue.filter((x) => x !== 'intro'); save(); render(); },
  closestory() { G.storyQueue.shift(); save(); autoNight() || render(); },
  branch(b) { act(() => chooseBranch(+b.dataset.v)); autoNight(); },
  go(b) {
    const err = Run.choose(+b.dataset.v);
    if (err) { toast(err); return; }
    const t = G.run.tonight, tab = Run.DEST[t.type].tab;
    save();
    if (!tab) { toast(t.note || Run.DEST[t.type].name); return H_.night(); } // 隠れ家はそのまま夜が明ける
    UI.tab = tab;
    render(); window.scrollTo(0, 0);
  },
  eventopt(b) {
    const err = Run.resolveEvent(+b.dataset.v);
    if (err) { toast(err); return; }
    save(); H_.night(); // 事件に答えたら夜が明ける（結果は夜明けの報告に出る）
  },
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
    save(); H_.night(); // 送り出したら夜が明ける
  },
  recall(b) { act(() => recall(+b.dataset.v)); },
  walkin(b) {
    const r = Run.walkins()[+b.dataset.v];
    act(() => Run.hireWalkin(+b.dataset.v, +b.dataset.drop || null) || (toast(`${r.name}が隊に加わった`), null));
  },
  temp(b) {
    const uid = +b.dataset.v, role = b.dataset.role;
    const r = Run.tempHire(uid, role);
    if (typeof r === 'string') { toast(r); return; }
    const team = getTeam(uid), lane = role === 'net' ? 'net' : ['driver', 'med'].includes(role) && team.support.length < LANE_MAX.support ? 'support' : 'field';
    if (team[lane].length < LANE_MAX[lane]) team[lane].push(r.id);
    toast(`臨時雇いの${r.name}（${ROLES[role].name}）が今夜だけ加わった`);
    save(); render();
  },
  reroll() { act(() => Run.rerollCrew() || (toast('最初の隊を引き直した'), null)); },
  hire(b) {
    const r = G.scouts[+b.dataset.v];
    act(() => hire(+b.dataset.v, +b.dataset.drop || null) || (toast(`${r.name}が隊に加わった`), null));
  },
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
  dice() { prefs.dice = !prefs.dice; savePrefs(); applyDice(); },
  help() { UI.help = true; render(); },
  closehelp() { UI.help = false; render(); },
  treat(b) { act(() => treat(getR(+b.dataset.r))); },
  repair(b) { act(() => repair(getR(+b.dataset.r))); },
  therapy(b) { act(() => therapy(getR(+b.dataset.r))); },
  lazarus(b) { act(() => Run.setLazarus(getR(+b.dataset.r), b.dataset.v || null)); },
  cyber(b) {
    const r = getR(+b.dataset.r), c = b.dataset.c;
    act(() => buyCyber(r, c) || (toast(`${r.name}に「${CYBER[c].name}」を入れた。人間性 ${r.humanity}${r.humanity <= 0 ? '。もう戻れない' : ''}`), null));
  },
  decision(b) {
    const ctx=G.missions.find(m=>m.uid===+b.dataset.uid)?.progress;
    if(!ctx?.waiting)return;
    const v=b.dataset.v;
    stopLog(); missionDecision(+b.dataset.uid,v); H_.night();
  },
  night() {
    if (!Run.canEndNight()) { toast('地区マップで今夜の行き先を決めてください'); UI.tab = 'home'; render(); return; }
    stopLog();
    const out = endNight();
    if (!out) { render(); return; }
    UI.flow = { id: Date.now(), out, step: 0, steps: buildSteps(out) };
    UI.team = {}; UI.est = { key: '', val: null }; UI.ask = null; UI.tab = 'home';
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
    if (UI.flow.step >= UI.flow.steps.length) return flowDone();
    render();
  },
  reward(b) {
    const err = Run.takeReward(+b.dataset.v, +b.dataset.r, b.dataset.x);
    if (err) { toast(err); return; }
    save();
    if (UI.flow) { UI.flow.step++; if (UI.flow.step >= UI.flow.steps.length) return flowDone(); }
    render();
  },
  rmcyber(b) {
    const r = getR(+b.dataset.r), c = b.dataset.c;
    UI.ask = null;
    act(() => removeCyber(r, c) || (toast(`${r.name}から「${CYBER[c].name}」を外した。人間性は戻らない`), null));
  },
  askrm(b) { UI.ask = 'rm' + b.dataset.r + b.dataset.c; render(); },
  ending(b) { chooseEnding(b.dataset.v); render(); },
};

/* 夜明けの流れが終わったら、次の夜の画面へ。選べない夜（2夜依頼の続き）はそのまま明かし、大仕事の夜は依頼を開く */
function flowDone() {
  UI.flow = null;
  if (autoNight()) return;
  const tab = G && G.run && !G.ended ? Run.tonightTab() : null;
  UI.tab = tab || 'home';
  render(); window.scrollTo(0, 0);
}
/* 物語や分岐が残っているあいだは待つ */
function autoNight() {
  if (!G || !G.run || G.ended || UI.flow || G.awaitChoice || G.awaitEnding || G.storyQueue.length ) return false;
  if (!G.run.tonight || G.run.tonight.type !== 'cont') return false;
  H_.night();
  return true;
}

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
  applyDice();
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
