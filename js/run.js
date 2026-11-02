/* FIXER'S CUT ローグライク版 — 1ランの進行。3幕×4夜の地区マップ、夜ごとの行き先、ランの終わり方 */
const Run = (() => {
  const META_KEY = 'fixers-cut-meta-v1';
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
  };
  // 行き先の重み（第1〜3幕）。1つずつ引き、同じ夜に同じ行き先は出さない
  const WEIGHTS = {
    job: [40, 35, 30], hard: [0, 10, 15], doc: [15, 15, 15], shop: [10, 10, 10],
    alley: [15, 10, 5], hideout: [10, 10, 15], event: [10, 10, 10],
  };
  const SLOTS = [3, 3, 2]; // 1〜3夜目の行き先の数。4夜目は大仕事
  const HARD_DV = 2; // 第3幕の危ない依頼は、上のランクがないのでDVを上げる
  const BOSS = {
    1: () => 'camp2',
    2: () => CHAPTERS['cargo_' + (G.flags.ally || 'hakurou')].job,
    3: () => 'camp5',
  };
  const HIDEOUT_HUM = 5;
  // ランの始まりの語り。キャンペーン版の第1章（借金40夜）の代わりに出す
  const INTRO = {
    kicker: '第1幕', title: '十二夜',
    body: [
      '前任のフィクサー、ハシバが消えて三週間になる。',
      '湾岸の隠れ家と、開け方のわからない黒い箱が、新人のあなたに回ってきた。箱を欲しがる連中は、十二夜も待ってはくれない。',
      'あなたは撃たない。毎夜、街のどこへ行くかを決め、ランナーを送り出す。そして、人間のまま帰ってくるのを待つ。',
    ],
    goal: '第1幕の4夜目までにネットランナーを抱え、箱の暗号を破る大仕事に挑む。',
  };

  const R = () => G.run;
  const act = () => ACTS[R().act];

  function weighted(types, a) {
    const ws = types.map((t) => WEIGHTS[t][a - 1]);
    let x = rnd() * ws.reduce((s, w) => s + w, 0);
    for (let i = 0; i < types.length; i++) if ((x -= ws[i]) < 0) return types[i];
    return types[types.length - 1];
  }

  /* ───────── 地区マップ ───────── */

  /* 夜ごとの縛り。どれも「この中から1つ以上」 */
  function needs(a, slot) {
    if (slot === 1) return a === 1 ? [['job'], ['alley']] : [['job']];
    if (slot === 2) return [['job'], ['doc', 'shop']];
    return [['hideout', 'doc']];
  }

  /* 依頼の型紙。3夜目は大仕事に食い込むので1夜の依頼だけ */
  function jobTemplate(type, a, slot) {
    const rank = type === 'hard' ? Math.min(a + 1, 3) : a;
    const fits = JOBS.filter((t) => t.rank === rank && (slot < 3 || t.nights === 1));
    if (!fits.length) return null;
    const fresh = fits.filter((t) => !R().used.includes(t.id));
    const t = pick(fresh.length ? fresh : fits);
    R().used.push(t.id);
    return { tpl: t.id, tough: type === 'hard' && rank === a };
  }

  function genSlot(a, slot) {
    const pool = Object.keys(WEIGHTS).filter((t) => WEIGHTS[t][a - 1] > 0);
    const types = [];
    for (const group of needs(a, slot)) {
      const open = group.filter((t) => pool.includes(t) && !types.includes(t));
      if (open.length && !types.some((t) => group.includes(t))) types.push(weighted(open, a));
    }
    while (types.length < SLOTS[slot - 1]) types.push(weighted(pool.filter((t) => !types.includes(t)), a));
    const nodes = [];
    for (const type of shuffle(types)) {
      if (type !== 'job' && type !== 'hard') { nodes.push({ type }); continue; }
      const j = jobTemplate(type, a, slot);
      if (j) { nodes.push({ type, ...j }); continue; }
      // 合う依頼がないときは、依頼以外の行き先に差し替える
      const alt = pool.filter((t) => t !== 'job' && t !== 'hard' && !types.includes(t) && !nodes.some((n) => n.type === t));
      if (alt.length) nodes.push({ type: weighted(alt, a) });
    }
    return nodes;
  }

  function genMap(a) {
    return { 1: genSlot(a, 1), 2: genSlot(a, 2), 3: genSlot(a, 3), 4: [{ type: 'boss' }] };
  }

  /* ───────── 開始と保存 ───────── */

  function start(g) {
    g.run = { act: 1, slot: 1, map: null, picked: {}, tonight: null, retried: false, used: [], taken: [], event: null, history: [], recorded: false };
    g.rank = 1;
    g.loans = [];
    G = g;
    g.run.map = genMap(1);
    G.board = []; G.scouts = [];
  }

  /* ───────── 行き先を選ぶ ───────── */

  function bossJob() {
    const id = BOSS[R().act]();
    const t = clone(CAMPAIGN_JOBS[id]);
    t.rank = R().act;
    t.runBoss = true;
    return t;
  }

  function nodeJob(n) {
    const t = clone(JOBS.find((x) => x.id === n.tpl));
    if (n.tough) {
      for (const rt of t.routes) for (const p of [...rt.field, ...rt.net]) if (p && p.dv) p.dv += HARD_DV;
      t.payout = Math.round(t.payout * 1.3 / 50) * 50;
    }
    t.hard = n.type === 'hard';
    return t;
  }

  /* 夜の行き先を決める。決めたら取り消せない */
  function choose(i) {
    const run = R();
    if (run.tonight) return '今夜の行き先はもう決まっています';
    if (G.nightInProgress) return '判断待ちの通信を完了してください';
    const n = run.map[run.slot][i];
    if (!n) return '行き先が見つかりません';
    run.picked[run.slot] = i;
    run.tonight = { ...n };
    arrive(run.tonight);
    return null;
  }

  function arrive(n) {
    const run = R();
    run.history.push({ act: run.act, slot: run.slot, night: G.night, type: n.type });
    if (n.type === 'job' || n.type === 'hard') { const j = addJob(nodeJob(n), true); n.uid = j.uid; }
    if (n.type === 'boss') { const j = addJob(bossJob(), true); n.uid = j.uid; }
    if (n.type === 'alley') refreshScouts();
    if (n.type === 'hideout') {
      for (const r of G.runners) {
        if (r.status === 'mission') continue;
        r.hp = maxHp(r);
        r.humanity = Math.min(maxHum(r), r.humanity + HIDEOUT_HUM);
      }
      n.note = `全員のHPが戻り、人間性が+${HIDEOUT_HUM}された`;
    }
    if (n.type === 'event') run.event = { key: pickEvent(), done: null };
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
        { label: '手当てして迎え入れる', cost: 300, text: '歩合のランナーが1人加わる（HPは半分）', run: () => {
          if (G.runners.length >= ROSTER_MAX) return `抱えられるのは${ROSTER_MAX}人までです`;
          const have = new Set(G.runners.map((r) => r.role));
          const roles = Object.keys(ROLES).filter((k) => !have.has(k));
          const r = makeRunner(pick(roles.length ? roles : Object.keys(ROLES)), { pref: 'any' });
          r.hp = Math.ceil(maxHp(r) / 2); r.joined = G.night;
          G.runners.push(r);
          return `${r.name}（${ROLES[r.role].name}）が歩合で加わった`;
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
  const REWARD_W = { cyber: 25, gear: 25, runner: 15, intel: 15, cr: 20 };
  const REWARD_CR = { 1: 800, 2: 2000, 3: 4000 };
  const SKIP_CR = 500;
  const CYBER_TIER = { 1: 1, 2: 2, 3: 3 }; // 幕ごとに出る義体の上限（基本 → Mk.II → Mk.III）
  const GEAR_MAX = { 1: 2000, 2: 5000, 3: Infinity }; // 幕ごとに出る装備の値段の上限
  const TRAIT_MULT = { 1: 1, 2: 1.5, 3: 2 }; // ランナーの資質の出やすさ
  const BIAS = 3; // 入っている系統の上位モデルと、隊にいないロールは3倍出やすい

  /* 入れられる人がいる義体か。枠がいっぱいでも、同じ部位のどれかを外せば入れられる */
  const cyberTakers = (c) => G.runners.filter((r) => cyberFits(r, c) && (!cyberBlocker(r, c) || swapChoices(r, c).some((d) => !cyberBlocker(r, c, d))));
  const gearTakers = (id) => G.runners.filter((r) => r.gear[GEAR[id].slot] !== id);
  const topGear = (a) => Object.keys(GEAR).filter((id) => GEAR[id].price <= GEAR_MAX[a]).sort((x, y) => GEAR[y].price - GEAR[x].price)[0];

  function pickW(items, w) {
    let x = rnd() * items.reduce((t, it) => t + w(it), 0);
    for (const it of items) if ((x -= w(it)) < 0) return it;
    return items[items.length - 1];
  }

  /* 種類ごとの候補を1つ作る。rare なら希少なものだけから選ぶ。作れなければ null */
  function rewardOf(kind, a, rare, used) {
    const taken = R().taken;
    if (kind === 'cyber') {
      const ids = Object.keys(CYBER).filter((c) => CYBER[c].tier <= CYBER_TIER[a] && (!rare || CYBER[c].tier > 1) && !taken.includes(c) && !used.includes(c) && cyberTakers(c).length);
      if (!ids.length) return null;
      const upgrade = (c) => G.runners.some((r) => r.cyber.some((x) => cyberLine(x) === cyberLine(c) && CYBER[x].tier < CYBER[c].tier));
      const id = pickW(ids, (c) => (upgrade(c) ? BIAS : 1));
      return { kind, id, rare: CYBER[id].tier > 1 };
    }
    if (kind === 'gear') {
      const top = topGear(a);
      const ids = Object.keys(GEAR).filter((id) => GEAR[id].price <= GEAR_MAX[a] && (a > 1 || GEAR[id].price >= 700) && (!rare || id === top) && !taken.includes(id) && !used.includes(id) && gearTakers(id).length && G.runners.some((r) => GEAR[id].roles.includes(r.role)));
      if (!ids.length) return null;
      const id = pick(ids);
      return { kind, id, rare: id === top };
    }
    if (kind === 'runner') {
      if (G.runners.length >= ROSTER_MAX || used.includes('runner')) return null;
      const have = new Set(G.runners.map((r) => r.role));
      const role = pickW(Object.keys(ROLES), (k) => (have.has(k) ? 1 : BIAS));
      const opt = { pref: 'any', traitMult: TRAIT_MULT[a] };
      if (rare) opt.trait = pickW(TRAIT_ODDS, ([, p]) => p)[0];
      const r = makeRunner(role, opt);
      return { kind, runner: r, rare: !!r.trait };
    }
    if (used.includes(kind) || rare) return null;
    return kind === 'cr' ? { kind, amount: REWARD_CR[a] } : { kind };
  }

  /* 依頼の精算で呼ぶ（engine.js の settle）。危ない依頼・2夜依頼・大仕事の後は、1つを必ず希少にする */
  function makeReward(job) {
    const a = R().act, opts = [], used = [];
    const keep = (o) => { if (!o) return false; opts.push(o); used.push(o.id || o.kind); return true; };
    const rare = !!(job.hard || job.runBoss || job.nights >= 2);
    if (rare) for (const kind of shuffle(['cyber', 'gear', 'runner'])) if (keep(rewardOf(kind, a, true, used))) break;
    for (let guard = 0; opts.length < 3 && guard < 40; guard++) keep(rewardOf(pickW(Object.keys(REWARD_W), (k) => REWARD_W[k]), a, false, used));
    return { run: true, title: job.title, rare, opts: shuffle(opts) };
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
      if (G.runners.length >= ROSTER_MAX) return `抱えられるのは${ROSTER_MAX}人までです`;
      o.runner.joined = G.night;
      G.runners.push(o.runner);
    } else if (o.kind === 'intel') G.vouchers.intel += 2;
    else if (o.kind === 'cr') G.money += o.amount;
    G.pending.shift();
    return null;
  }

  /* ───────── 夜明け ───────── */

  /* endNight の最後に呼ぶ。夜を進め、幕の切り替えとランの終わりを決める */
  function nextNight(out) {
    const run = R();
    const ongoing = G.missions[0]; // 精算の済んだ派遣は外れている。残っていれば2夜目に続く
    const boss = out.settle.find((s) => s.runBoss);
    const skippedBoss = run.tonight && run.tonight.type === 'boss' && G.board.some((j) => j.uid === run.tonight.uid);
    G.board = []; G.scouts = [];
    run.event = null;
    run.tonight = null;
    if (G.ended) return finish();
    if (!G.runners.length) { G.ended = { type: 'wipe' }; return finish(); }
    if (run.slot === 4) {
      if (ongoing && ongoing.job.runBoss) return force('cont'); // 大仕事の2夜目は幕の夜数に数えない
      if (boss && boss.success) {
        if (run.act === 3) { run.cleared = true; return; } // 結末の選択は awaitEnding で出る
        return nextAct(out);
      }
      if (boss || skippedBoss) {
        if (run.retried) { G.ended = { type: 'boss' }; return finish(); }
        run.retried = true;
        out.events.push({ kind: 'ng', text: `${act().name}の大仕事に失敗した。次の夜に一度だけ挑み直せる（この夜は幕の夜数に数えない）` });
        return force('boss');
      }
      return force('boss');
    }
    run.slot++;
    if (ongoing) return force('cont'); // 2夜依頼がこの夜を使う
    if (run.slot === 4) return force('boss');
  }

  /* 選べない夜は、行き先を自動で決める */
  function force(type) {
    R().tonight = { type };
    if (type === 'boss') arrive(R().tonight);
    else R().history.push({ act: R().act, slot: R().slot, night: G.night, type });
  }

  function nextAct(out) {
    const run = R();
    run.act++; run.slot = 1; run.retried = false; run.picked = {};
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

  function loadMeta() {
    try { return { runs: 0, clears: 0, best: null, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch (e) { return { runs: 0, clears: 0, best: null }; }
  }
  /* 何夜目まで進めたか（幕×4＋夜）で、いちばん遠くまで行ったランを残す */
  const depth = (a, s) => (a - 1) * 4 + s;
  function finish() {
    const run = R();
    if (run.recorded) return;
    run.recorded = true;
    const m = loadMeta();
    m.runs++;
    const clear = !['bankrupt', 'wipe', 'boss'].includes(G.ended.type);
    if (clear) m.clears++;
    const d = clear ? 13 : depth(run.act, run.slot);
    if (!m.best || d > m.best.depth) m.best = { depth: d, act: run.act, slot: run.slot, clear };
    run.meta = m;
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 保存できない環境では無視 */ }
  }

  /* ───────── 表示用 ───────── */

  function nodeInfo(n) {
    const d = DEST[n.type];
    const info = { name: d.name, mark: d.mark, desc: d.desc, type: n.type };
    if (n.tpl) {
      const t = JOBS.find((x) => x.id === n.tpl);
      Object.assign(info, { title: t.title, client: t.client, target: t.target, nights: t.nights, payout: n.tough ? Math.round(t.payout * 1.3 / 50) * 50 : t.payout, req: t.req, rank: t.rank });
    }
    if (n.type === 'boss') {
      const id = R().act === 2 && !G.flags.ally ? null : BOSS[R().act]();
      const t = id && CAMPAIGN_JOBS[id];
      if (t) Object.assign(info, { title: t.title, client: t.client, target: t.target, nights: t.nights, payout: t.payout, req: t.req });
      else info.title = '組んだ社で決まる';
    }
    return info;
  }
  const tonightTab = () => (G.run && G.run.tonight ? DEST[G.run.tonight.type].tab : null);
  /* 夜を明かせるか。行き先を決めるまでは明かせない */
  const canEndNight = () => !G.run || !!G.run.tonight;

  /* ラン中に流す章の「目標」。キャンペーン版の評判ランクの条件は使わない（null は目標を出さない） */
  const GOALS = {
    cargo: '第2幕の4夜目に、組んだ社の手引きで名簿を追う大仕事がある。地区マップで必須ロールを確かめ、そろえておく。',
    drowned: null,
    coordinator: '第3幕の4夜目に、箱を持って朝を迎える大仕事がある。（毎夜、全企業のヒート+3）',
  };
  const storyGoal = (key, fallback) => {
    const k = Object.keys(GOALS).find((g) => key === g || key.startsWith(g + '_'));
    return k ? GOALS[k] : fallback;
  };

  return { REWARD_CR, SKIP_CR, makeReward, takeReward, cyberTakers, ACTS, DEST, EVENTS, INTRO, storyGoal, SLOTS, start, genMap, choose, resolveEvent, nextNight, nodeInfo, tonightTab, canEndNight, loadMeta, finish, depth, act };
})();
