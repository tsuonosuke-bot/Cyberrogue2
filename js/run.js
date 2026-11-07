/* FIXER'S CUT ローグライク版 — 1ランの進行。3幕×10夜の地区マップ、夜ごとの行き先、ランの終わり方 */
const Run = (() => {
  const ACTS = {
    1: { name: '第1幕', place: '屋台街', district: 'street' },
    2: { name: '第2幕', place: '港湾倉庫', district: 'harbor' },
    3: { name: '第3幕', place: '企業区画上層', district: 'upper' },
  };
  // tab は行き先を選んだ夜だけ開く画面。hideout はその場で効くので画面を持たない
  const DEST = {
    job: { name: '依頼', mark: '依', tab: 'board', desc: '依頼を1件受けて派遣する。成功でcr' },
    hard: { name: '危ない依頼', mark: '危', tab: 'board', desc: '敵やDVが一段重い。報酬も大きい' },
    doc: { name: '闇医者', mark: '医', tab: 'doc', desc: '義体を入れる・治療・セラピー' },
    shop: { name: '古物屋', mark: '物', tab: 'shop', desc: '装備の売買と防具の修理' },
    alley: { name: '路地裏', mark: '路', tab: 'scout', desc: '候補3人から雇う。隊にいないロールが出やすい' },
    hideout: { name: '隠れ家', mark: '隠', tab: null, desc: '全員のHPを戻し、人間性+5' },
    event: { name: '事件', mark: '事', tab: 'event', desc: '街で何かが起きる。選択肢つき' },
    boss: { name: '大仕事', mark: '大', tab: 'board', desc: '幕の最後の仕事。2度失敗するとランが終わる' },
    cont: { name: '依頼の続き', mark: '続', tab: null, desc: '2夜依頼の2夜目。行き先は選べない' },
    contact: { name: '協力者', mark: '協', tab: null, desc: '積み上げで関係を結んだ協力者。寄るとその人の手助けを受けられる' },
    deserter: { name: '元部下', mark: '元', tab: 'board', desc: '人間性が尽きて消えた元部下を止める。5夜のうちに行かなければ、市警の鎮圧班が片付ける' },
  };
  // 行き先の重み（第1〜3幕）。1つずつ引き、同じ夜に同じ行き先は出さない
  const WEIGHTS = {
    job: [40, 35, 30], hard: [0, 10, 15], doc: [15, 15, 15], shop: [10, 10, 10],
    alley: [15, 10, 5], hideout: [10, 10, 15], event: [10, 10, 10],
  };
  // 1幕は10夜。1〜9夜目は行き先が2〜4つで、線でつながった先にしか進めない。10夜目は大仕事
  const NIGHTS = 10, LAST = NIGHTS - 1, BOSS_SLOT = NIGHTS;
  const nodeCount = (slot) => (slot === 1 ? 3 : slot === LAST ? 2 : pick([2, 3, 3, 4]));
  const HARD_DV = 2; // 第3幕の危ない依頼は、上のランクがないのでDVを上げる
  // 幕の大仕事（RUN_JOBS）。第1幕は全ラン共通、第2幕と第3幕は組んだ社で変わる
  const BOSS = {
    1: () => 'run_denki',
    2: () => 'run_cargo_' + (G.flags.ally || 'hakurou'),
    3: () => 'run_box_' + (G.flags.ally || 'hakurou'),
  };
  /* 前歴。ラン中ずっと効く利点と弱み。最初の隊はランダム（寄せ集めだけロールを選ぶ）。later は信用で解放する前歴（段階Dで鍵をかける） */
  const BACKGROUNDS = {
    solo: { name: '元ソロ', seed: 'fire', gear: 'pistol', gear2: 'silenced', perk: '交戦の1ラウンド目、ソロの射撃+1', weak: 'ICE判定−2' },
    net: { name: '元ネットランナー', seed: 'net', gear: 'deck', gear2: 'icehood', perk: '各幕のはじめに情報券+1（情報が1回無料）', weak: '説得の判定−1' },
    ripper: { name: '闇医者のツテ', seed: 'endure', gear: 'jacket', gear2: 'medbag', perk: '義体の人間性コスト−1（最低1）', weak: '運転と逃走の判定−1' },
    corp: { name: '企業の元社員', seed: 'stealth', gear: 'fakeid', gear2: 'poncho', perk: '組む社を始めに決めておける。その社のヒート−15', weak: '残りの2社はヒート+10で始まる', later: true },
    gang: { name: '白蛇会の身内', seed: 'chrome', perk: '白蛇会との関係+30で始まる（屋台街の情報が半額・路上育ちの候補が増える）', weak: '最初の隊・路地裏と顔見せの候補は義体を入れていて、人間性が低いことが多い', later: true },
    patchwork: { name: '寄せ集め', perk: '最初の3人のロールを自分で選べる', weak: '初期資金1,500cr。報酬が3択でなく2択', later: true, money: 1500 },
  };
  const PATCHWORK_DEFAULT = ['solo', 'net', 'driver'];
  const FIGHTERS = ['solo', 'driver']; // 射撃に強いロール
  /* 最初の隊の3人のロール。ネットランナー（第1幕の大仕事に要る）と、戦える人を1人ずつ必ず入れる */
  function crewOf(bg, opt = {}) {
    if (bg === 'patchwork') return [0, 1, 2].map((i) => (ROLES[(opt.roles || [])[i]] ? opt.roles[i] : PATCHWORK_DEFAULT[i]));
    return shuffle(['net', pick(FIGHTERS), pick(Object.keys(ROLES))]);
  }
  const HIDEOUT_HUM = 5;
  // 顔見せ：夜を使わずに隊の画面から雇える候補。契約金がかかる。路地裏はただで、資質持ちが出やすい
  const WALKINS = 2;
  const WALKIN_FEE = { 1: 1500, 2: 3000, 3: 5000 }; // 夜の顔役で3割引き、候補+1
  const ALLEY_TRAIT = 2;
  // ランの始まりの語り。キャンペーン版の第1章（借金40夜）の代わりに出す
  const INTRO = {
    kicker: '第1幕', title: '三十夜',
    body: [
      '前任のフィクサー、ハシバが消えて三週間になる。',
      '湾岸の隠れ家と、開け方のわからない黒い箱が、新人のあなたに回ってきた。箱を欲しがる連中は、三十夜も待ってはくれない。',
      'あなたは撃たない。毎夜、街のどこへ行くかを決め、ランナーを送り出す。そして、人間のまま帰ってくるのを待つ。',
    ],
    goal: '第1幕の10夜目に、箱の鍵を買い取った白蛇会の「電気屋」から鍵を取り返す。ネットランナーがいないと挑めない。',
  };

  const R = () => G.run;
  const act = () => ACTS[R().act];

  function weighted(types, a) {
    const ws = types.map((t) => WEIGHTS[t][a - 1]);
    let x = rnd() * ws.reduce((s, w) => s + w, 0);
    for (let i = 0; i < types.length; i++) if ((x -= ws[i]) < 0) return types[i];
    return types[types.length - 1];
  }

  /* ───────── 顔見せ ───────── */

  /* 今夜の顔見せ。隊にいないロールを先に出す。前の夜の候補は残らない */
  function walkins() {
    const run = R();
    if (run.walkins) return run.walkins;
    const have = new Set(G.runners.map((r) => r.role));
    const roles = [...shuffle(Object.keys(ROLES).filter((k) => !have.has(k))), ...shuffle(Object.keys(ROLES).filter((k) => have.has(k)))];
    run.walkins = roles.slice(0, WALKINS + (cone('nightBroker') ? 1 : 0) + ((run.rooms || {}).bunks >= 1 ? 1 : 0)).map((role) => makeRunner(role, World.scoutOptions()));
    if (run.bg === 'gang' && !run.noWeak) for (const r of run.walkins) if (rnd() < 0.6) streetChrome(r);
    return run.walkins;
  }
  const walkinFee = () => Math.round((WALKIN_FEE[R().act] * (cone('nightBroker') ? 0.7 : 1) * ((R().rooms || {}).bunks >= 3 ? 0.7 : 1)) / 50) * 50;
  function hireWalkin(i, drop) {
    const list = walkins(), r = list[i];
    if (!r) return '候補が見つかりません';
    if (G.money < walkinFee()) return '契約金が足りません';
    const full = makeRoom(drop);
    if (full) return full;
    G.money -= walkinFee();
    r.joined = G.night;
    G.runners.push(r);
    list.splice(i, 1);
    return null;
  }

  /* 敵のDV・攻撃の上乗せ。幕のなかで夜が進むほど上がる（幕の頭+0、終わりごろ+2）。幕ごとの差は ACT_THREAT でならす。
     大仕事の夜は+2に、BOSS_THREAT を足す。大仕事は一発勝負なので第1幕のボスは軽くし、第2幕・第3幕はふつうの依頼から重くする。
     交戦は全滅するまで続く（3ラウンドで引かない）ぶん勝ちやすいので、幕ごとの上乗せを全体に+1している */
  const ACT_THREAT = { 1: 1, 2: 1, 3: 4 };
  const BOSS_THREAT = { 1: 0, 2: 4, 3: 4 };
  const threat = () => ACT_THREAT[R().act] + Math.min(2, Math.floor((3 * (R().slot - 1)) / LAST)) + (R().slot === BOSS_SLOT ? BOSS_THREAT[R().act] - ((R().rooms || {}).terminal >= 3 ? 2 : 0) : 0);

  /* ───────── 臨時雇い ───────── */

  /* 必須ロールが足りない依頼に、その依頼1回だけ人を借りる。費用は後払いで、精算のときに引く。
     大仕事では各幕1回まで無料。隊の人数には数えず、精算が終わると（生きていれば）抜ける */
  const tempFee = (job) => {
    if (job.runBoss && !(R().freeTemp || []).includes(R().act)) return 0;
    if (cone('gangDebt') && !(R().gangTemp || []).includes(R().act)) return 0;
    return walkinFee() / 2;
  };
  function tempHire(uid, role) {
    const job = G.board.find((j) => j.uid === uid);
    if (!job) return '依頼が見つかりません';
    if (!job.req.includes(role)) return 'その依頼に必須のロールではありません';
    if (G.runners.some((r) => r.role === role && available(r) && (!r.temp || r.temp.uid === uid))) return `${ROLES[role].name}はもう隊にいます`;
    const fee = tempFee(job);
    if (!fee) {
      if (job.runBoss && !(R().freeTemp || []).includes(R().act)) (R().freeTemp ||= []).push(R().act);
      else (R().gangTemp ||= []).push(R().act);
    }
    const r = makeRunner(role, { trait: null });
    r.temp = { uid };
    G.runners.push(r);
    (job.temps ||= []).push({ id: r.id, name: r.name, fee });
    return r;
  }
  /* 精算で呼ぶ（engine.js の settle）。送り出した臨時雇いの費用は、死んでいても払う */
  function tempDone(job, res, s) {
    for (const t of job.temps || []) {
      if (t.fee && (res.members || []).some((m) => m.id === t.id)) { G.money -= t.fee; s.net -= t.fee; s.lines.push([`臨時雇いの${t.name}（後払い）`, -t.fee]); }
      G.runners = G.runners.filter((x) => x.id !== t.id);
    }
  }
  /* 送り出さなかった臨時雇いは、夜が明けると帰る */
  const dropIdleTemps = () => { G.runners = G.runners.filter((r) => !r.temp || r.status === 'mission'); };

  /* ───────── 地区マップ ───────── */

  /* 夜ごとの縛り。どれも「この中から1つ以上」。毎夜、依頼が1つはある。4夜目・8夜目・9夜目は休める行き先を混ぜる。
     9夜目は大仕事の前の準備の夜で、8夜目のどこからでも、9夜目のどの行き先にも行ける */
  function needs(a, slot) {
    const g = [['job', 'hard']];
    if (slot === 1 && a === 1) g.push(['alley']);
    if (slot === 4 || slot === 8 || slot === LAST) g.push(['hideout', 'doc']);
    return g;
  }

  /* 依頼の型紙。8夜目・9夜目は、準備の夜（9夜目）と大仕事に食い込まないよう1夜の依頼だけ */
  function jobTemplate(type, a, slot) {
    const rank = type === 'hard' ? Math.min(a + 1, 3) : a;
    const fits = JOBS.filter((t) => t.rank === rank && (slot < LAST - 1 || t.nights === 1));
    if (!fits.length) return null;
    const fresh = fits.filter((t) => !R().used.includes(t.id));
    const t = pick(fresh.length ? fresh : fits);
    R().used.push(t.id);
    return { tpl: t.id, tough: type === 'hard' && rank === a };
  }

  function genSlot(a, slot) {
    const pool = Object.keys(WEIGHTS).filter((t) => WEIGHTS[t][a - 1] > 0);
    const count = nodeCount(slot), types = [];
    for (const group of needs(a, slot)) {
      const open = group.filter((t) => pool.includes(t) && !types.includes(t));
      if (open.length && !types.some((t) => group.includes(t))) types.push(weighted(open, a));
    }
    // 同じ夜に同じ行き先は2つまで（依頼だけは並んでよい）
    while (types.length < count) {
      const open = pool.filter((t) => types.filter((x) => x === t).length < (t === 'job' ? 2 : 1));
      types.push(weighted(open, a));
    }
    const nodes = [];
    for (const type of shuffle(types)) {
      if (type !== 'job' && type !== 'hard') { nodes.push({ type }); continue; }
      const j = jobTemplate(type, a, slot);
      if (j) { nodes.push({ type, ...j }); continue; }
      // 合う依頼がないときは、依頼以外の行き先に差し替える
      const alt = pool.filter((t) => t !== 'job' && t !== 'hard' && !nodes.some((n) => n.type === t));
      if (alt.length) nodes.push({ type: weighted(alt, a) });
    }
    return nodes;
  }

  /* 夜と夜のあいだの線。左右の位置が近い行き先どうしをつなぎ、どの行き先にも入る線と出る線がある */
  function link(from, to) {
    const x = (i, n) => (i + 0.5) / n;
    const near = (xi) => to.map((_, j) => j).sort((p, q) => Math.abs(x(p, to.length) - xi) - Math.abs(x(q, to.length) - xi));
    from.forEach((n, i) => {
      const order = near(x(i, from.length));
      n.to = [order[0]];
      if (order[1] !== undefined && rnd() < 0.5 && Math.abs(order[1] - order[0]) === 1) n.to.push(order[1]);
    });
    to.forEach((_, j) => {
      if (from.some((n) => n.to.includes(j))) return;
      const i = from.map((_, k) => k).sort((p, q) => Math.abs(x(p, from.length) - x(j, to.length)) - Math.abs(x(q, from.length) - x(j, to.length)))[0];
      from[i].to.push(j);
    });
    for (const n of from) n.to.sort((p, q) => p - q);
  }

  function genMap(a) {
    const map = { nights: NIGHTS };
    for (let s = 1; s <= LAST; s++) map[s] = genSlot(a, s);
    map[BOSS_SLOT] = [{ type: 'boss' }];
    // 協力者の地点：5夜目の、依頼でない行き先のひとつと入れ替える（なければ足す）
    const cs = R().contacts || [];
    if (cs.length) {
      const row = map[5], i = row.findIndex((n) => n.type !== 'job' && n.type !== 'hard');
      const node = { type: 'contact', who: pick(cs) };
      if (i >= 0) row[i] = node; else if (row.length < 4) row.push(node); else row[row.length - 1] = node;
    }
    for (let s = 1; s < BOSS_SLOT; s++) link(map[s], map[s + 1]);
    for (const n of map[LAST - 1]) n.to = map[LAST].map((_, i) => i);
    return map;
  }

  /* slot の夜に行ける行き先の番号。最後に選んだ行き先から線をたどる（2夜依頼で飛んだ夜もたどる）。幕の頭は全部 */
  function reachable(slot) {
    const run = R(), pos = run.pos;
    const all = (run.map[slot] || []).map((_, i) => i);
    if (!pos || pos.slot >= slot) return all;
    let front = [pos.i];
    for (let s = pos.slot; s < slot; s++) front = [...new Set(front.flatMap((i) => (run.map[s][i] || {}).to || []))];
    return front.length ? front.sort((p, q) => p - q) : all;
  }

  /* ───────── 開始と保存 ───────── */

  /* 最初の隊。newGame が World.init より前に呼ぶ。資質は付かない。
     初めてのランだけは決まった隊（ジロウとサエと、ネットランナー1人）。それ以降はランダム */
  const FIRST_RUN_REROLLS = 1;
  function crew(bg = 'solo', opt = {}) {
    if (!BACKGROUNDS[bg]) bg = 'solo';
    if (opt.first) {
      G.runners.push(makeRunner('solo', { name: 'ジロウ', gender: 'm', origin: 'street', trait: null }), makeRunner('driver', { name: 'サエ', gender: 'f', origin: 'drifter', trait: null }), makeRunner('net', { trait: null }));
      return;
    }
    for (const role of crewOf(bg, opt)) G.runners.push(makeRunner(role, { trait: null, ...(bg === 'gang' ? { origin: 'street' } : {}) }));
    if (bg === 'gang') for (const r of G.runners) if (rnd() < 0.6) streetChrome(r);
    seedGear(bg);
  }
  /* 型の種：前歴の型の装備を1つ持って始まる。持てる人に持たせる（白蛇会の身内は義体で始まる） */
  function seedGear(bg) {
    const id = BACKGROUNDS[bg].gear;
    if (!id) return;
    const r = G.runners.find((x) => GEAR[id].roles.includes(x.role)) || G.runners[0];
    equipGear(r, id);
  }
  /* 出発前に最初の隊を引き直す。何か選ぶ前の最初の夜だけ */
  function rerollCrew() {
    const run = R();
    if (!canReroll()) return '今は引き直せません';
    run.rerolls--;
    G.runners = [];
    crew(run.bg);
    return null;
  }
  const canReroll = () => R().rerolls > 0 && G.night === 1 && !R().tonight && R().bg !== 'patchwork' && !G.missions.length;

  function start(g, bg = 'solo', opt = {}) {
    if (!BACKGROUNDS[bg]) bg = 'solo';
    g.run = { bg, corp: null, rerolls: opt.first ? 0 : FIRST_RUN_REROLLS, wanted: 0, deserters: [], custody: [], act: 1, slot: 1, map: null, picked: {}, pos: null, tonight: null, used: [], taken: [], event: null, history: [], recorded: false };
    g.rank = 1;
    G = g;
    const B = BACKGROUNDS[bg];
    if (B.money) G.money = B.money;
    if (bg === 'net') G.vouchers.intel += 1;
    if (bg === 'corp') {
      const corp = CORPS.includes(opt.corp) ? opt.corp : CORPS[0];
      g.run.corp = corp;
      for (const c of CORPS) G.heat[c] = clamp(G.heat[c] + (c === corp ? -15 : 10), 0, 100);
    }
    if (bg === 'gang') G.gangRelation = 30;
    Meta.startRun(g, opt);
    g.run.map = genMap(1);
    G.board = []; G.scouts = [];
  }

  /* 判定の補正（engine.js の check から呼ぶ）。前歴の利点と弱み（BACKGROUNDS の perk・weak）。
     動揺した人はその交戦の射撃・回避−2、暴走した人は射撃+2 */
  function checkParts(ctx, m, sk) {
    const s = ctx.combatState, parts = [];
    const bg = R().bg, weak = !R().noWeak;
    if (bg === 'solo' && sk === '射撃' && s && s.round === 0 && m.role === 'solo') parts.push({ label: '元ソロの勘', v: 1 });
    if (weak && bg === 'solo' && sk === 'インターフェース') parts.push({ label: '元ソロの不慣れ', v: -2 });
    if (weak && bg === 'net' && sk === '説得') parts.push({ label: '元ネットランナーの口下手', v: -1 });
    if (weak && bg === 'ripper' && sk === '運転') parts.push({ label: '闇医者のツテの不慣れ', v: -1 });
    // 型（送り出した人の型の数）
    if (sk === '隠密' && typeOn(ctx, 'stealth', 2)) parts.push({ label: '隠密の型', v: 1 });
    if (sk === '射撃' && s && s.round === 0 && typeOn(ctx, 'fire', 2)) parts.push({ label: '火力の型', v: 1 });
    if (sk === 'インターフェース' && typeOn(ctx, 'net', 2)) parts.push({ label: '電脳の型', v: 2 });
    if (sk === '射撃' && m.humanity <= 30 && typeOn(ctx, 'chrome', 2)) parts.push({ label: '義体狂いの型', v: 1 });
    if (sk === '回避' && m.humanity <= 30 && typeOn(ctx, 'chrome', 4)) parts.push({ label: '義体狂いの型', v: 1 });
    // コネ
    if (sk === '運転' && cone('courier')) parts.push({ label: CONNECTIONS.courier.name, v: 2 });
    if (sk === '知覚' && cone('veteran')) parts.push({ label: CONNECTIONS.veteran.name, v: 2 });
    if (sk === '射撃' && cone('bloodOath')) parts.push({ label: CONNECTIONS.bloodOath.name, v: 1 });
    if (s && (s.shaken || []).includes(m.id) && (sk === '射撃' || sk === '回避')) parts.push({ label: '動揺', v: -2 });
    if (s && (s.mad || []).includes(m.id) && sk === '射撃') parts.push({ label: '暴走', v: 2 });
    return parts;
  }

  /* ───────── 元部下 ───────── */

  const DESERTER_NIGHTS = 5;
  /* 人間性0で隊を抜けた元部下（engine.js の desert から呼ぶ）。5夜のあいだ、地区マップの行き先に加わる */
  function addDeserter(r, tpl, out) {
    (R().deserters ||= []).push({ id: r.id, name: r.name, role: r.role, until: G.night + DESERTER_NIGHTS, tpl });
    out.events.push({ kind: 'ng', text: `${r.name}の人間性が0になった。隠れ家から姿を消した。${DESERTER_NIGHTS}夜のうちに地区マップの「元部下」へ行かなければ、市警の鎮圧班が片付ける` });
  }
  /* 元部下の依頼の決着（engine.js の settle から呼ぶ）。止めるか、鎮圧班が片付けたら、慰霊碑に刻む */
  function deserterDone(job, res, s) {
    const id = +job.id.replace('deserter_', ''), d = (R().deserters || []).find((x) => x.id === id);
    if (!d || (!res.success && !res.suppressed)) return;
    R().deserters = R().deserters.filter((x) => x !== d);
    G.memorial.push({ name: d.name, role: d.role, night: G.night, cause: res.success ? '元部下として止められた' : '鎮圧班が片付けた（元部下）', jobs: 0 });
    s.notes.push(res.success ? `${d.name}を止めた` : `${d.name}は鎮圧班に片付けられた。義体は取り戻せない`);
  }
  /* 今夜選べる行き先。線でつながった地図の行き先に、まだ期限の来ていない元部下が加わる（大仕事の夜は除く）。
     idx は地図の中の番号 */
  function options(slot = R().slot) {
    const run = R(), base = run.map[slot] || [];
    const nodes = (slot === run.slot ? reachable(slot) : base.map((_, i) => i)).map((i) => ({ ...base[i], idx: i }));
    if (slot !== run.slot || slot === BOSS_SLOT) return nodes;
    return [...nodes, ...(run.deserters || []).map((d) => ({ type: 'deserter', dz: d.id }))];
  }
  /* 地図の表示用。行き先ごとに、通った（picked）・今夜選べる（now）・この先行ける（reach）・行けない（off）を付ける */
  function mapView() {
    const run = R(), rows = [];
    let front = run.tonight && run.pos && run.pos.slot === run.slot ? [run.pos.i] : reachable(run.slot);
    for (let s = 1; s <= BOSS_SLOT; s++) {
      if (s > run.slot) front = [...new Set(front.flatMap((i) => (run.map[s - 1][i] || {}).to || []))];
      const nodes = run.map[s].map((n, i) => {
        let state = 'off';
        if (s < run.slot) state = run.picked[s] === i ? 'picked' : 'off';
        else if (s === run.slot) state = run.picked[s] === i || (s === BOSS_SLOT && run.tonight) ? 'picked' : !run.tonight && front.includes(i) ? 'now' : 'off';
        else if (front.includes(i)) state = 'reach';
        // 危険度2から：2夜先より向こうは見えない（大仕事を除く）
        const hidden = run.danger >= 2 && s > run.slot + 2 && s !== BOSS_SLOT;
        return { ...n, idx: i, state, hidden };
      });
      rows.push({ slot: s, nodes });
    }
    return rows;
  }

  /* ───────── ラザロ ───────── */

  /* 闇医者で入るラザロのプラン。plan は null（なし）・'basic'（基本）・'armed'（武装回収、第2幕から）。
     加入料はその場で1回だけ。上のプランに替えるときは差額、下げる・やめるときは戻らない */
  const lazarusPrice = (plan) => (plan === 'armed' ? LAZARUS_ARMED.fee : plan === 'basic' ? LAZARUS_FEE : 0);
  function lazarusFee(r, plan) { return Math.max(0, lazarusPrice(plan) - lazarusPrice(r.lazarus)); }
  function setLazarus(r, plan) {
    if (plan === 'armed' && R().act < LAZARUS_ARMED.act) return `武装回収は第${LAZARUS_ARMED.act}幕から入れます`;
    if (plan && !['basic', 'armed'].includes(plan)) return 'プランが見つかりません';
    const fee = lazarusFee(r, plan);
    if (fee > G.money) return '所持金が足りません';
    G.money -= fee;
    r.lazarus = plan || false;
    return null;
  }

  /* ───────── 行き先を選ぶ ───────── */

  /* 幕の大仕事 */
  function bossJob() {
    const t = clone(RUN_JOBS[BOSS[R().act]()]);
    t.rank = R().act;
    t.runBoss = true;
    return t;
  }

  /* 白蛇会の身内：路地裏の候補は義体を入れていて、前の現場で人間性も削れていることが多い */
  function streetChrome(r) {
    for (const c of shuffle(ROLE_CYBER[r.role].filter((x) => CYBER[x].tier === 1)).slice(0, rint(1, 2))) {
      if (cyberBlocker(r, c)) continue;
      r.humanity -= cyberHumanityDelta(r, c);
      r.cyber.push(c);
    }
    r.humanity = Math.max(16, r.humanity - rint(5, 15));
    r.hp = maxHp(r); r.armor = armorMax(r);
  }

  function nodeJob(n) {
    const t = clone(JOBS.find((x) => x.id === n.tpl));
    if (n.tough) {
      for (const rt of t.routes) for (const p of [...rt.field, ...rt.net]) if (p && p.dv) p.dv += HARD_DV;
      t.payout = Math.round(t.payout * 1.3 / 50) * 50;
    }
    t.hard = n.type === 'hard';
    t.payout = jobPay(t.payout);
    t.routes = t.routes.map((rt) => varyRoute(rt, t.rank));
    if (rnd() < ROUTE_EXTRA) addVariant(t);
    return t;
  }

  /* 協力者の手助け（meta.js の CONTACTS）。その夜のうちに効き、夜が明ける */
  function contactHelp(who) {
    if (who === 'broker') {
      const a = R().act, top = topType() || pick(Object.keys(TYPES)), used = [];
      const opts = ['cyber', 'gear'].map((k) => rewardOf(k, a, false, used, (t) => t.includes(top)) || rewardOf(k, a, false, used)).filter(Boolean).map((o, i) => ({ ...o, slot: i + 1 }));
      if (opts.length) G.pending.push({ run: true, title: Meta.CONTACTS.broker.name, rare: false, top, opts });
      return `${Meta.CONTACTS.broker.name}が、${TYPES[top].name}の品を用意していた。夜明けに1つ選べる`;
    }
    if (who === 'courier') {
      for (const r of G.runners) if (r.status !== 'mission') r.hp = maxHp(r);
      G.money += 1500;
      return `${Meta.CONTACTS.courier.name}の車で、全員のHPが戻った。1,500crを受け取った`;
    }
    for (const c of CORPS) G.heat[c] = clamp(G.heat[c] - 20, 0, 100);
    R().wanted = 0;
    return `${Meta.CONTACTS.cop.name}が、市警と三社の追及を逸らした。全社のヒート−20`;
  }

  /* ───────── 依頼のルート ───────── */

  // 依頼が出るたびに、型紙のルートの判定のDVと、敵の数・種類を少し変える。ICEの位置・目標の数・必須ロールは変えない。
  // 3分の1ほどの依頼には、型紙のルートを作り替えた3本目が加わる（強行：隠密と説得を交戦に／裏道：交戦を隠密に）
  const ROUTE_EXTRA = 0.35;
  const PAY_SCALE = 0.6; // 依頼の報酬は型紙の6割（お金で強くなりすぎないように。固定費をなくした分も締める）
  const jobPay = (p) => Math.round((p * PAY_SCALE) / 50) * 50;
  const ENEMY_KINDS = { 1: ['standard', 'swarm', 'sniper'], 2: ['standard', 'swarm', 'sniper', 'armored', 'hacker'], 3: ['standard', 'swarm', 'sniper', 'armored', 'hacker'] };
  function varyPhase(p, rank) {
    if (!p || p.t === 'boss') return p;
    if (p.t === 'combat') {
      p.n = Math.max(1, p.n + pick([-1, 0, 0, 1]));
      if (rnd() < 0.3) p.enemyType = pick(ENEMY_KINDS[rank]);
    } else if (p.dv) p.dv += pick([-2, 0, 0, 0, 2]);
    return p;
  }
  const varyRoute = (rt, rank) => ({ ...rt, field: rt.field.map((p) => varyPhase(p, rank)), net: rt.net.map((p) => varyPhase(p, rank)) });
  const copyPhase = (p) => (p ? clone(p) : p);
  /* 強行：隠密と説得の段取りを交戦に置き換える */
  function assault(rt) {
    return { name: `${rt.name}（強行）`, note: '見つかる前提で、正面から押し通る', gen: 'assault',
      field: rt.field.map((p) => (p && (p.t === 'sneak' || p.t === 'talk') ? C(2, `${p.l}を強行突破`) : copyPhase(p))), net: rt.net.map(copyPhase) };
  }
  /* 裏道：交戦を隠密の判定に置き換える。最後の交戦だけは、敵を1体減らして残す */
  function backway(rt, rank) {
    const fights = rt.field.map((p, i) => (p && p.t === 'combat' ? i : -1)).filter((i) => i >= 0), keep = fights[fights.length - 1];
    return { name: `${rt.name}（裏道）`, note: '見張りの死角を縫って、なるべく戦わない', gen: 'backway',
      field: rt.field.map((p, i) => (!p || p.t !== 'combat' ? copyPhase(p) : i === keep ? { ...clone(p), n: Math.max(1, p.n - 1) } : S(15 + 2 * rank, `${p.l}をやり過ごす`))), net: rt.net.map(copyPhase) };
  }
  function addVariant(t) {
    const base = pick(t.routes);
    const canAssault = base.field.some((p) => p && (p.t === 'sneak' || p.t === 'talk'));
    const canBack = base.field.filter((p) => p && p.t === 'combat').length >= 1;
    // 今あるルートにない性格を足す
    const stealthy = t.routes.some((rt) => routeBars(rt).stealth >= 2);
    const kind = canBack && (!stealthy || !canAssault) ? 'backway' : canAssault ? 'assault' : null;
    if (kind) t.routes.push(kind === 'backway' ? backway(base, t.rank) : assault(base));
  }
  /* ルートの性格（0〜3）。隠密＝隠密・説得・罠、交戦＝敵の数、ネット＝ICEと扉。intel がないときは、まだ見えない段取りを数えない */
  function routeBars(rt, intel = true) {
    const seen = (p) => p && (intel || !p.hidden);
    const f = rt.field.filter(seen), n = rt.net.filter(seen);
    const stealth = f.filter((p) => ['sneak', 'talk', 'trap'].includes(p.t)).length;
    const combat = f.filter((p) => p.t === 'combat').reduce((a, p) => a + p.n, 0) + f.filter((p) => p.t === 'boss').length * 2;
    const net = n.filter((p) => p.t === 'ice').length + f.filter((p) => p.t === 'gate').length;
    return { stealth: Math.min(3, stealth), combat: Math.min(3, Math.ceil(combat / 2)), net: Math.min(3, Math.ceil(net / 2)) };
  }
  /* 隊（送り出す人がいればその人たち）にいちばん多い型に合うルート。合うものがなければ -1 */
  const TYPE_BAR = { stealth: 'stealth', fire: 'combat', chrome: 'combat', net: 'net' };
  function recommendRoute(job, ids) {
    const people = (ids && ids.length ? ids.map(getR) : G.runners).filter(Boolean);
    const c = countTypes(people.flatMap(typesOf)), top = Object.keys(TYPE_BAR).filter((t) => c[t]).sort((x, y) => c[y] - c[x])[0];
    if (!top) return -1;
    const bars = job.routes.map((rt) => routeBars(rt, job.intel)[TYPE_BAR[top]]);
    const best = Math.max(...bars);
    return best > 0 && bars.filter((b) => b === best).length < bars.length ? bars.indexOf(best) : -1;
  }

  /* 夜の行き先を決める。決めたら取り消せない */
  function choose(i) {
    const run = R();
    if (run.tonight) return '今夜の行き先はもう決まっています';
    if (G.nightInProgress) return '判断待ちの通信を完了してください';
    const n = options(run.slot)[i];
    if (!n) return '行き先が見つかりません';
    if (n.idx !== undefined) { run.picked[run.slot] = n.idx; run.pos = { slot: run.slot, i: n.idx }; }
    run.tonight = { ...n };
    arrive(run.tonight);
    return null;
  }

  function arrive(n) {
    const run = R();
    run.history.push({ act: run.act, slot: run.slot, night: G.night, type: n.type });
    if (n.type === 'job' || n.type === 'hard') { const j = addJob(nodeJob(n), true); n.uid = j.uid; }
    if (n.type === 'boss') { const j = addJob(bossJob(), true); n.uid = j.uid; }
    if (n.type === 'deserter') { const d = run.deserters.find((x) => x.id === n.dz); const j = addJob(clone(d.tpl), true); n.uid = j.uid; }
    if (n.type === 'alley') {
      refreshScouts({ traitMult: ALLEY_TRAIT });
      if (run.bg === 'gang' && !run.noWeak) for (const r of G.scouts) if (!r.story && rnd() < 0.6) streetChrome(r);
      // 伝説のランナーが、まれに路地裏に現れる
      const legends = Meta.load().legends.filter((L) => !G.runners.some((r) => r.name === L.name));
      if (legends.length && rnd() < 0.2) G.scouts[G.scouts.length - 1] = Meta.legendRunner(pick(legends));
      if (cone('ironDiscipline')) G.scouts = G.scouts.slice(0, 2);
    }
    if (n.type === 'hideout') {
      // 危険度3から：回復できるのは、いちばん傷の深い2人まで
      const home = G.runners.filter((r) => r.status !== 'mission').sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b));
      for (const r of run.danger >= 3 ? home.slice(0, 2) : home) {
        r.hp = maxHp(r);
        if (!cone('brokenConscience')) r.humanity = Math.min(maxHum(r), r.humanity + HIDEOUT_HUM + ((run.rooms || {}).clinic >= 3 ? 5 : 0));
      }
      n.note = cone('brokenConscience') ? '全員のHPが戻った（壊れた良心で、人間性は戻らない）' : `全員のHPが戻り、人間性が+${HIDEOUT_HUM}された`;
      const low = G.runners.filter((r) => r.status !== 'mission').sort((a, b) => a.humanity - b.humanity)[0];
      if (cone('dawnDoc') && low) { low.humanity = Math.min(maxHum(low), low.humanity + 10); n.note += `。夜明けの闇医者が${low.name}を診た（人間性+10）`; }
    }
    if (n.type === 'event') run.event = { key: pickEvent(), done: null };
    if (n.type === 'contact') n.note = contactHelp(n.who);
  }

  /* ───────── 事件 ───────── */

  const EVENTS = {
    gang: {
      title: '白蛇会の訪問',
      body: '白蛇会の若い衆が隠れ家の戸を叩いた。「この辺で商売するなら、挨拶があってもいいんじゃないか」',
      opts: [
        { label: '上納金を渡す', cost: 500, text: '白蛇会との関係 +15', run: () => { G.gangRelation = clamp(G.gangRelation + 15, -100, 100); } },
        { label: '追い返す', text: '白蛇会との関係 −15', run: () => { G.gangRelation = clamp(G.gangRelation - 15, -100, 100); } },
      ],
    },
    informant: {
      title: '情報屋の売り込み',
      body: '顔なじみの情報屋が、湿った名刺を差し出した。「次の仕事の下調べ、まとめて請け負うよ」',
      opts: [
        { label: '前払いする', cost: 400, text: '情報券 +2（情報購入が2回無料）', run: () => { G.vouchers.intel += 2; } },
        { label: '断る', text: '何も起きない', run: () => {} },
      ],
    },
    stray: {
      title: '路地で倒れていたランナー',
      body: '雨の路地に、撃たれたランナーがうずくまっている。手当てをすれば、恩を返すと言う。',
      opts: [
        { label: '手当てして迎え入れる', cost: 300, text: 'ランナーが1人加わる（HPは半分）', run: () => {
          if (crewSize() >= ROSTER_MAX) return `抱えられるのは${ROSTER_MAX}人までです`;
          const have = new Set(G.runners.map((r) => r.role));
          const roles = Object.keys(ROLES).filter((k) => !have.has(k));
          const r = makeRunner(pick(roles.length ? roles : Object.keys(ROLES)), {});
          r.hp = Math.ceil(maxHp(r) / 2); r.joined = G.night;
          G.runners.push(r);
          return `${r.name}（${ROLES[r.role].name}）が隊に加わった`;
        } },
        { label: '見なかったことにする', text: '何も起きない', run: () => {} },
      ],
    },
    reporter: {
      title: '記者からの電話',
      body: '知り合いの記者が、企業の警備部に回っている名簿の噂を持ってきた。金を出せば、記事で目をそらせるという。',
      opts: [
        { label: '記事を頼む', cost: 600, text: 'いちばん高いヒート −20', run: () => {
          const c = CORPS.reduce((a, b) => (G.heat[b] > G.heat[a] ? b : a));
          G.heat[c] = Math.max(0, G.heat[c] - 20);
          return `${CLIENTS[c].short}のヒートが ${G.heat[c]} まで下がった`;
        } },
        { label: '断る', text: '何も起きない', run: () => {} },
      ],
    },
  };
  function pickEvent() {
    const seen = new Set(R().history.filter((h) => h.event).map((h) => h.event));
    const fresh = Object.keys(EVENTS).filter((k) => !seen.has(k));
    const k = pick(fresh.length ? fresh : Object.keys(EVENTS));
    R().history[R().history.length - 1].event = k;
    return k;
  }
  function resolveEvent(i) {
    const ev = R().event;
    if (!ev || ev.done) return 'もう決めました';
    const o = EVENTS[ev.key].opts[i];
    if (!o) return '選択肢が見つかりません';
    if (o.cost && o.cost > G.money) return '所持金が足りません';
    const msg = o.run();
    if (typeof msg === 'string' && msg.endsWith('までです')) return msg;
    if (o.cost) G.money -= o.cost;
    ev.done = msg || o.text;
    return null;
  }

  /* ───────── 報酬3択 ───────── */

  // 依頼に成功すると、crとは別に3つの候補から1つを取る。どれも要らなければ SKIP_CR を受け取る
  const CONE_ODDS = 0.3; // 普通の依頼で、3つ目の枠がコネになる割合（危ない依頼と大仕事は必ずコネ）
  const REWARD_CR = { 1: 800, 2: 2000, 3: 4000 };
  const SKIP_CR = 500;
  const CYBER_TIER = { 1: 1, 2: 2, 3: 3 }; // 幕ごとに出る義体の上限（基本 → Mk.II → Mk.III）
  const GEAR_MAX = { 1: 2000, 2: 5000, 3: Infinity }; // 幕ごとに出る装備の値段の上限
  const TRAIT_MULT = { 1: 1, 2: 1.5, 3: 2 }; // ランナーの資質の出やすさ
  const BIAS = 3; // 入っている系統の上位モデルと、隊にいないロールは3倍出やすい

  /* 入れられる人がいる義体か。枠がいっぱいでも、同じ部位のどれかを外せば入れられる */
  const cyberTakers = (c) => G.runners.filter((r) => cyberFits(r, c) && (!cyberBlocker(r, c) || swapChoices(r, c).some((d) => !cyberBlocker(r, c, d))));
  const gearTakers = (id) => G.runners.filter((r) => r.gear[GEAR[id].slot] !== id);
  const topGear = (a) => Object.keys(GEAR).filter((id) => !GEAR[id].drop && !Meta.itemLocked(id) && GEAR[id].price <= GEAR_MAX[a]).sort((x, y) => GEAR[y].price - GEAR[x].price)[0];

  function pickW(items, w) {
    let x = rnd() * items.reduce((t, it) => t + w(it), 0);
    for (const it of items) if ((x -= w(it)) < 0) return it;
    return items[items.length - 1];
  }

  /* 種類ごとの候補を1つ作る。rare なら希少なものだけから選ぶ。fit を渡すと、型がそれに合う品だけ。作れなければ null */
  function rewardOf(kind, a, rare, used, fit = () => true) {
    const taken = R().taken;
    if (kind === 'cyber') {
      const ids = Object.keys(CYBER).filter((c) => !CYBER[c].drop && !Meta.itemLocked(c) && CYBER[c].tier <= CYBER_TIER[a] && (!rare || CYBER[c].tier > 1) && fit(CYBER[c].types || []) && !taken.includes(c) && !used.includes(c) && cyberTakers(c).length);
      if (!ids.length) return null;
      const upgrade = (c) => G.runners.some((r) => r.cyber.some((x) => cyberLine(x) === cyberLine(c) && CYBER[x].tier < CYBER[c].tier));
      const id = pickW(ids, (c) => (upgrade(c) ? BIAS : 1));
      return { kind, id, rare: CYBER[id].tier > 1 };
    }
    if (kind === 'gear') {
      const top = topGear(a);
      const ids = Object.keys(GEAR).filter((id) => !GEAR[id].drop && !Meta.itemLocked(id) && GEAR[id].price <= GEAR_MAX[a] && (a > 1 || GEAR[id].price >= 700) && (!rare || id === top || GEAR[id].price >= GEAR_MAX[a] * 0.5) && fit(GEAR[id].types || []) && !taken.includes(id) && !used.includes(id) && gearTakers(id).length && G.runners.some((r) => GEAR[id].roles.includes(r.role)));
      if (!ids.length) return null;
      const id = pick(ids);
      return { kind, id, rare: !!rare || id === top };
    }
    if (kind === 'runner') {
      if (crewSize() >= ROSTER_MAX || used.includes('runner')) return null;
      const have = new Set(G.runners.map((r) => r.role));
      const role = pickW(Object.keys(ROLES), (k) => (have.has(k) ? 1 : BIAS));
      const opt = { traitMult: TRAIT_MULT[a] };
      if (rare) opt.trait = pickW(TRAIT_ODDS, ([, p]) => p)[0];
      const r = makeRunner(role, opt);
      return { kind, runner: r, rare: !!r.trait };
    }
    if (kind === 'cone') {
      const have = R().cones || [];
      const ids = Object.keys(CONNECTIONS).filter((k) => !have.includes(k) && !used.includes(k) && !!CONNECTIONS[k].boss === !!rare);
      return ids.length ? { kind, id: pick(ids), rare: !!rare } : null;
    }
    if (used.includes(kind) || rare) return null;
    return kind === 'cr' ? { kind, amount: REWARD_CR[a] } : null;
  }
  /* 隊の型の数（持っている品をすべて数える）。報酬の1つ目の枠は、いちばん多い型に寄せる */
  const crewTypes = () => countTypes(G.runners.filter((r) => !r.temp).flatMap(typesOf));
  function topType() {
    const c = crewTypes(), keys = Object.keys(TYPES).filter((t) => c[t]);
    return keys.length ? keys.sort((x, y) => c[y] - c[x])[0] : null;
  }

  /* 依頼の精算で呼ぶ（engine.js の settle）。危ない依頼・2夜依頼・大仕事の後は、1つを必ず希少にする */
  /* ボスを倒したときに混ざる品。入れられる人・持たせられる人がいて、まだ取っていないものだけ */
  function bossDrop(job, res) {
    const B = typeof job.boss === 'string' && RUN_BOSSES[job.boss]; // 元部下の依頼の boss は、その人の能力を持つ別の形
    const d = res && res.bossDown && B && B.drop;
    if (!d) return null;
    const id = d.cyber || d.gear;
    if (R().taken.includes(id)) return null;
    if (d.cyber) return cyberTakers(id).length ? { kind: 'cyber', id, rare: true, drop: job.boss } : null;
    return gearTakers(id).length ? { kind: 'gear', id, rare: true, drop: job.boss } : null;
  }

  /* 依頼の精算で呼ぶ（engine.js の settle）。報酬は3つの枠に決まった中身が入る。
     1つ目：隊にいちばん多い型の品。2つ目：別の型の品（ボスを倒した大仕事では、ボスの品）。3つ目：コネか、型のないもの（ランナーかcr）。
     危ない依頼・2夜依頼・大仕事の後は、品のどちらかが希少。危ない依頼と大仕事の3つ目は必ずコネ（大仕事は弱みつきのコネ）。
     欠員の後は3つ目にランナーを必ず出す。寄せ集めは1つ目と3つ目の2択 */
  function makeReward(job, res) {
    const a = R().act, used = [], rare = !!(job.hard || job.runBoss || job.nights >= 2);
    const top = topType() || pick(Object.keys(TYPES));
    const item = (fit, wantRare) => {
      for (const kind of shuffle(['cyber', 'gear'])) {
        const o = (wantRare && rewardOf(kind, a, true, used, fit)) || rewardOf(kind, a, false, used, fit);
        if (o) { used.push(o.id); return o; }
      }
      return null;
    };
    const rareFirst = rare && rnd() < 0.5;
    const one = item((t) => t.includes(top), rare && rareFirst) || item(() => true, rare && rareFirst);
    let two = bossDrop(job, res) || item((t) => t.length && !t.includes(top), rare && !rareFirst) || item(() => true, false);
    if (two && two.drop) used.push(two.id);
    // 希少が出せなかったときは、型を問わず2つ目を希少にする
    if (rare && !(one && one.rare) && !(two && two.rare)) two = item(() => true, true) || two;
    let three = null;
    if (R().refill) { three = rewardOf('runner', a, false, used); if (three) R().refill = false; }
    if (!three && (job.runBoss || job.hard || rnd() < CONE_ODDS)) three = rewardOf('cone', a, !!job.runBoss, used) || rewardOf('cone', a, false, used);
    if (!three) three = (crewSize() < ROSTER_MAX && rnd() < 0.5 && rewardOf('runner', a, false, used)) || rewardOf('cr', a, false, used);
    let slots = (R().bg === 'patchwork' && !R().noWeak ? [[one, 1], [three, 3]] : [[one, 1], [two, 2], [three, 3]]).filter(([o]) => o);
    // 危険度4から：3割ほどの報酬で、1枠が空く
    if (R().danger >= 4 && slots.length === 3 && rnd() < 0.3) { const drop = Math.floor(rnd() * 3); slots = slots.filter((_, i) => i !== drop); }
    const opts = slots.map(([o, slot]) => ({ ...o, slot }));
    return { run: true, title: job.title, rare, top, opts };
  }

  /* 報酬を取る。i が -1 なら何も取らずに SKIP_CR。rid は受け取る人、drop は代わりに外す義体 */
  function takeReward(i, rid, drop) {
    const b = G.pending[0];
    if (!b || !b.run) return '選べる報酬がありません';
    if (i === -1) { G.money += SKIP_CR; G.pending.shift(); return null; }
    const o = b.opts[i];
    if (!o) return '報酬が見つかりません';
    const r = getR(rid);
    if (o.kind === 'cyber') {
      if (!r) return '入れる人を選んでください';
      if (!cyberFits(r, o.id)) return `${ROLES[r.role].name}には合いません`;
      const blocked = cyberBlocker(r, o.id, drop);
      if (blocked) return blocked;
      installCyber(r, o.id, drop);
      R().taken.push(o.id);
    } else if (o.kind === 'gear') {
      if (!r) return '持たせる人を選んでください';
      if (r.gear[GEAR[o.id].slot] === o.id) return 'もう持っています';
      G.money += equipGear(r, o.id); // 前の装備は下取り
      R().taken.push(o.id);
    } else if (o.kind === 'runner') {
      if (crewSize() >= ROSTER_MAX) return `抱えられるのは${ROSTER_MAX}人までです`;
      o.runner.joined = G.night;
      G.runners.push(o.runner);
    } else if (o.kind === 'cone') (R().cones ||= []).push(o.id);
    else if (o.kind === 'cr') G.money += o.amount;
    G.pending.shift();
    return null;
  }

  /* ───────── 夜明け ───────── */

  /* endNight の最後に呼ぶ。夜を進め、幕の切り替えとランの終わりを決める */
  function nextNight(out) {
    const run = R();
    dropIdleTemps();
    const ongoing = G.missions[0]; // 精算の済んだ派遣は外れている。残っていれば2夜目に続く
    const boss = out.settle.find((s) => s.runBoss);
    G.board = []; G.scouts = [];
    if (run.event && run.event.done) out.events.push({ kind: 'ok', text: `${EVENTS[run.event.key].title}：${run.event.done}` });
    run.event = null;
    run.tonight = null;
    run.walkins = null; // 顔見せは毎晩入れ替わる
    // 期限までに止めに行かなかった元部下は、鎮圧班が片付ける
    for (const d of (run.deserters || []).filter((x) => x.until < G.night)) {
      G.memorial.push({ name: d.name, role: d.role, night: G.night, cause: '鎮圧班が片付けた（元部下）', jobs: 0 });
      out.events.push({ kind: 'ng', text: `元部下の${d.name}は、市警の鎮圧班に片付けられた。義体は取り戻せない` });
    }
    run.deserters = (run.deserters || []).filter((x) => x.until >= G.night);
    if (G.ended) return finish();
    if (!G.runners.length) { G.ended = { type: 'wipe' }; return finish(); }
    if (run.slot === BOSS_SLOT) {
      if (boss && boss.success) {
        (run.actsCleared ||= []).push(run.act);
        if (run.act === 3) { run.cleared = true; return; } // 結末の選択は awaitEnding で出る
        return nextAct(out);
      }
      // 大仕事は一発勝負。失敗しても、送り出さなくても、ランは終わる
      G.ended = { type: 'boss' };
      return finish();
    }
    run.slot++;
    if (ongoing) return force('cont'); // 2夜依頼がこの夜を使う
    if (run.slot === BOSS_SLOT) {
      // 第3幕の大仕事の夜に、最後の章（夜明け）が始まる
      if (run.act === 3 && G.chapter !== 'dawn') { G.chapter = 'dawn'; G.chapterSince = G.night; if (!reached('dawn')) G.chapterLog.push('dawn'); out.story.push('dawn'); }
      return force('boss');
    }
  }

  /* 選べない夜は、行き先を自動で決める */
  function force(type) {
    R().tonight = { type };
    if (type === 'boss') arrive(R().tonight);
    else R().history.push({ act: R().act, slot: R().slot, night: G.night, type });
  }

  function nextAct(out) {
    const run = R();
    run.act++; run.slot = 1; run.picked = {}; run.pos = null;
    if (run.bg === 'net') G.vouchers.intel += 1;
    if ((run.rooms || {}).terminal >= 2) G.vouchers.intel += 1;
    run.map = genMap(run.act);
    G.rank = run.act;
    out.events.push({ kind: 'ok', text: `${ACTS[run.act - 1].name}を越えた。${act().name}・${act().place}へ` });
    if (run.act === 3) {
      const key = 'coordinator_' + (G.flags.ally || 'hakurou');
      G.chapter = key; G.chapterSince = G.night;
      if (!reached(key)) G.chapterLog.push(key);
      out.story.push(key);
    }
  }

  /* ───────── ランの終わりとメタの記録 ───────── */

  const loadMeta = () => Meta.load();
  /* 何夜目まで進めたか（幕×10＋夜）で、いちばん遠くまで行ったランを残す */
  const depth = (a, s) => (a - 1) * NIGHTS + s;
  function finish() {
    const run = R();
    if (run.recorded) return;
    run.recorded = true;
    const clear = !['bankrupt', 'wipe', 'boss'].includes(G.ended.type);
    const got = Meta.finishRun(run, clear), m = got.m;
    const d = clear ? 3 * NIGHTS + 1 : depth(run.act, run.slot);
    if (!m.best || d > m.best.depth) { m.best = { depth: d, act: run.act, slot: run.slot, clear }; Meta.save(m); }
    run.meta = m;
    run.credit = { lines: got.lines, total: got.total };
  }

  /* ───────── 表示用 ───────── */

  function nodeInfo(n) {
    const d = DEST[n.type];
    const info = { name: d.name, mark: d.mark, desc: d.desc, type: n.type };
    if (n.tpl) {
      const t = JOBS.find((x) => x.id === n.tpl);
      Object.assign(info, { title: t.title, client: t.client, target: t.target, nights: t.nights, payout: jobPay(n.tough ? Math.round(t.payout * 1.3 / 50) * 50 : t.payout), req: t.req, rank: t.rank });
    }
    if (n.type === 'contact') Object.assign(info, { title: Meta.CONTACTS[n.who].name, desc: Meta.CONTACTS[n.who].desc });
    if (n.type === 'deserter') {
      const d = (R().deserters || []).find((x) => x.id === n.dz), t = d && d.tpl;
      if (t) Object.assign(info, { title: t.title, client: t.client, target: t.target, nights: t.nights, payout: t.payout, req: t.req, until: d.until });
    }
    if (n.type === 'boss') {
      const id = R().act > 1 && !G.flags.ally ? null : BOSS[R().act]();
      const t = id && RUN_JOBS[id];
      if (t) Object.assign(info, { title: t.title, client: t.client, target: t.target, nights: t.nights, payout: t.payout, req: t.req, boss: t.boss });
      else info.title = '組んだ社で決まる';
    }
    return info;
  }
  const tonightTab = () => (G.run && G.run.tonight ? DEST[G.run.tonight.type].tab : null);
  /* 夜を明かせるか。行き先を決めるまでは明かせない */
  const canEndNight = () => !G.run || !!G.run.tonight;

  /* ラン中に流す章の「目標」。キャンペーン版の評判ランクの条件は使わない（null は目標を出さない） */
  const GOALS = {
    cargo: '第2幕の10夜目に、組んだ社の手引きで名簿を奪う大仕事がある。回収屋の頭「カナメ」が同じ名簿を狙っている。地区マップで必須ロールを確かめ、そろえておく。',
    drowned: null,
    coordinator: '第3幕の10夜目に、箱を開ける大仕事がある。最後に立ちはだかるのは、手を組んだ社だ。（毎夜、全企業のヒート+3）',
    dawn: '箱を開ける。手を組んだ社のボスを越えれば、箱の行き先は自分で決められる。',
  };
  const storyGoal = (key, fallback) => {
    const k = Object.keys(GOALS).find((g) => key === g || key.startsWith(g + '_'));
    return k ? GOALS[k] : fallback;
  };

  return { BACKGROUNDS, BOSS, crew, crewOf, checkParts, addDeserter, deserterDone, options, setLazarus, lazarusFee, bossJob, REWARD_CR, SKIP_CR, makeReward, takeReward, cyberTakers, ACTS, DEST, EVENTS, INTRO, storyGoal, NIGHTS, BOSS_SLOT, start, genMap, mapView, reachable, crewTypes, routeBars, recommendRoute, choose, threat, rerollCrew, canReroll, tempHire, tempFee, tempDone, walkins, hireWalkin, walkinFee, resolveEvent, nextNight, nodeInfo, tonightTab, canEndNight, loadMeta, finish, depth, act };
})();
