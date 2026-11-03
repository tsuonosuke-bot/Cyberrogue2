// バランス計測用のボット。ランを最後まで自動で遊び、幕ごとの数字をまとめる。
//   --danger 1〜5 で、その危険度で遊ぶ
//   --meta full で、積み上げ（部屋・協力者・準備・解放・熟練）を全部そろえた状態を測る
//   node tools/bot.cjs [--bg solo|net|ripper|corp|gang|patchwork|all] [--runs 500] [--policy careful|chrome|shopper|all] [--ally mitsukane|verde|hakurou] [--seed 1] [--json]
// 方針
//   careful : 依頼優先。義体は人間性40以上の人だけ。報酬は希少・義体・装備の順
//   chrome  : 義体を積む。人間性16以上なら誰にでも入れる。闇医者にも寄る
//   shopper : careful に加えて、所持金に余裕があれば古物屋と闇医者に寄って買う
//   random  : careful と同じ遊び方で、行き先だけをランダムに選ぶ（道の選び方がどれだけ効くかを比べる）
//   stealth / fire / net / chrome / endure : careful に加えて、その型の品を優先して集める（型ごとの強さを比べる）
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const BGS = ['solo', 'net', 'ripper', 'corp', 'gang', 'patchwork'];
const TYPE_POLICIES = ['stealth', 'fire', 'net', 'chrome', 'endure'];
const POLICIES = ['careful', 'chrome', 'shopper', 'random', ...TYPE_POLICIES];
const bgs = !args.bg || args.bg === 'all' ? BGS : String(args.bg).split(',');
const policies = !args.policy || args.policy === 'all' ? ['careful'] : String(args.policy).split(',');
const RUNS = +args.runs || 500, SEED = +args.seed || 1;
const src = ['data', 'engine', 'world', 'run', 'meta'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'));

// ボット本体。ゲームと同じ vm の中で動かす（ゲームの関数をそのまま呼ぶ）
const BOT = `
(function play(policy, bg, stat, ally, meta, danger) {
  // --meta full：積み上げを全部そろえた状態で遊ぶ（出発前の準備はランダムに1つ）
  if (meta === 'full') Meta.save(Meta.full());
  else if (danger) Meta.save({ ...Meta.load(), dangerMax: danger });
  const prep = meta === 'full' ? pick(Object.keys(Meta.PREPS)) : null;
  newGame(bg, { corp: ally || 'verde', roles: ['solo', 'net', 'driver'], prep, danger });
  G.storyQueue = [];
  const careful = policy !== 'chrome', HUM_FLOOR = careful ? 40 : 16;
  const want = ${JSON.stringify(TYPE_POLICIES)}.includes(policy) ? policy : null;
  const typesOfItem = (o) => (o.kind === 'cyber' ? CYBER[o.id].types : o.kind === 'gear' ? GEAR[o.id].types : []) || [];
  let lastAct = 1;
  const actEnd = (a) => { stat.money[a].push(G.money); stat.roster[a].push(crewSize()); };
  const rec = (arr, a, ok) => { arr[a][1]++; if (ok) arr[a][0]++; };
  for (let guard = 0; guard < 200 && !G.ended; guard++) {
    const run = G.run;
    if (run.act !== lastAct) { actEnd(lastAct); lastAct = run.act; }
    if (G.awaitChoice) {
      const opts = CHAPTERS[G.awaitChoice].choice.options;
      // 組む社は --ally があればそれ、なければランダム（企業の元社員は始めから決まっている）
      const want = ally ? opts.findIndex((o) => o.ally === ally) : Math.floor(Math.random() * opts.length);
      if (want >= 0) chooseBranch(want);
      for (let k = 0; k < 3 && G.awaitChoice; k++) chooseBranch(k);
    }
    if (G.awaitEnding) { chooseEnding('publish'); break; }
    G.storyQueue = [];
    // 顔見せ：足りないロールがいて、契約金を払っても1,000cr残るなら雇う
    const need = () => ['net', 'solo', 'driver', 'tech', 'med'].filter((r) => !G.runners.some((x) => x.role === r));
    for (let k = 0; k < 2; k++) {
      const w = Run.walkins(), i = w.findIndex((r) => need().includes(r.role));
      if (i >= 0 && crewSize() < ROSTER_MAX && G.money >= Run.walkinFee() + 1000) { Run.hireWalkin(i); stat.walkins++; }
    }
    if (!run.tonight) {
      const opts = Run.options(run.slot), find = (t) => opts.findIndex((n) => n.type === t);
      const hurt = G.runners.some((r) => r.humanity <= 20 || r.hp < maxHp(r) / 2);
      const rich = G.money > 6000;
      let i = find('deserter');
      if (i < 0) i = find('contact');
      if (i < 0 && crewSize() < 3) i = find('alley');
      if (i < 0 && hurt) i = find('hideout');
      if (i < 0 && policy === 'shopper' && rich) { i = find('shop'); if (i < 0) i = find('doc'); }
      if (i < 0 && policy === 'chrome' && rich) i = find('doc');
      if (i < 0 && crewSize() >= 3) i = find('hard');
      if (i < 0) i = find('job');
      if (i < 0) i = find('boss');
      if (i < 0) i = find('alley');
      if (i < 0) i = find('doc');
      if (i < 0) i = 0;
      if (policy === 'random') i = Math.floor(Math.random() * opts.length);
      const e = Run.choose(i);
      if (e) throw new Error(e);
    }
    const t = run.tonight, a = run.act;
    stat.visits[t.type] = (stat.visits[t.type] || 0) + 1;
    if (t.type === 'alley') while (G.scouts.length && crewSize() < ROSTER_MAX) { hire(0); stat.hires++; }
    if (t.type === 'event') { if (Run.resolveEvent(0)) Run.resolveEvent(1); }
    if (t.type === 'doc' || t.type === 'shop') {
      for (const r of G.runners.filter((r) => r.humanity >= HUM_FLOOR)) {
        const cs = ROLE_CYBER[r.role].filter((c) => !CYBER[c].drop && !cyberBlocker(r, c) && cyberPrice(c) <= G.money - 1500).sort((x, y) => (want ? (CYBER[x].types.includes(want) ? 1 : 0) - (CYBER[y].types.includes(want) ? 1 : 0) : 0));
        if (t.type === 'doc' && cs.length) { buyCyber(r, cs[cs.length - 1]); stat.bought++; break; }
      }
      if (t.type === 'shop') for (const r of G.runners) {
        const w = Object.keys(GEAR).filter((id) => !GEAR[id].drop && GEAR[id].roles.includes(r.role) && r.gear[GEAR[id].slot] !== id && (!r.gear[GEAR[id].slot] || GEAR[r.gear[GEAR[id].slot]].price < GEAR[id].price) && gearPrice(id) <= G.money - 1500);
        if (w.length) { buyGear(r, w[w.length - 1]); stat.bought++; }
      }
    }
    if (t.uid && G.board.length) {
      const job = G.board[0];
      // 必須ロールが足りなければ臨時雇い
      for (const role of job.req) if (!G.runners.some((r) => r.role === role && available(r))) { Run.tempHire(job.uid, role); stat.temps++; }
      const team = { field: [], support: [], net: [] };
      for (const r of G.runners.filter(available).sort((x, y) => power(y) - power(x))) {
        if (r.role === 'net' && !team.net.length) team.net.push(r.id);
        else if ((r.role === 'driver' || r.role === 'med') && team.support.length < 2) team.support.push(r.id);
        else if (team.field.length < 3) team.field.push(r.id);
        else if (team.support.length < 2) team.support.push(r.id);
      }
      if (!team.field.length && team.support.length) team.field.push(team.support.pop()); // 現場を空けない
      if (!job.intel && intelCost(job) <= G.money - 1000) buyIntel(job.uid);
      let best = 0, bp = -1;
      for (let ri = 0; ri < job.routes.length; ri++) { const p = estimate(job, ri, team, 60).p; if (p > bp) { bp = p; best = ri; } }
      const errs = dispatch(job.uid, best, team);
      if (errs) { stat.notSent++; const k = errs[0]; stat.unsent[k] = (stat.unsent[k] || 0) + 1; }
    }
    const before = G.memorial.length;
    let out = endNight();
    while (out && out.pending) {
      const ms = G.missions.find((m) => m.progress && m.progress.waiting);
      missionDecision(ms.uid, ms.progress.decision === 'squad' ? 'shield' : true);
      out = endNight();
    }
    if (out) {
      for (const s of out.settle) {
        rec(s.runBoss ? stat.boss : s.hard ? stat.hard : stat.jobs, a, s.success);
        if (!s.success) { const k = a + (s.runBoss ? ' boss ' : s.hard ? ' hard ' : ' job ') + String(s.reason).replace(/[0-9０-９]+/g, '#').slice(0, 40); stat.fails[k] = (stat.fails[k] || 0) + 1; }
      }
      for (const c of out.comms) if ((c.lines || []).some((l) => l.kind === 'mad')) stat.mad++;
      stat.deserted += out.deserted.length;
      stat.deaths[a] += G.memorial.length - before;
    }
    while (G.pending.length) {
      const b = G.pending[0];
      const score = (o) => (o.kind === 'runner' && crewSize() < 3 ? 5 : want && typesOfItem(o).includes(want) ? 6 : o.rare ? 4 : o.kind === 'cone' ? 3.5 : o.kind === 'cyber' ? 3 : o.kind === 'gear' ? 2 : o.kind === 'cr' ? 1 : 0);
      const order = [...b.opts.keys()].sort((x, y) => score(b.opts[y]) - score(b.opts[x]));
      let ok = false;
      for (const i of order) {
        if (ok) break;
        for (const r of [null, ...G.runners.filter((r) => r.humanity >= HUM_FLOOR)]) if (!ok && Run.takeReward(i, r && r.id) === null) {
          ok = true; const o = b.opts[i];
          stat.picks[o.kind] = (stat.picks[o.kind] || 0) + 1;
          stat.slots[o.slot || 0] = (stat.slots[o.slot || 0] || 0) + 1;
          for (const t of typesOfItem(o)) stat.pickedTypes[t] = (stat.pickedTypes[t] || 0) + 1;
        }
      }
      if (!ok) Run.takeReward(-1);
    }
  }
  actEnd(lastAct);
  stat.runs++;
  const end = G.ended ? G.ended.type : G.awaitEnding || G.run.cleared ? 'clear' : 'stuck';
  stat.end[end] = (stat.end[end] || 0) + 1;
  stat.nights.push(G.night);
  stat.reached[G.run.act]++;
  stat.custody += (G.run.custody || []).length;
  for (const r of G.runners) stat.hum.push(r.humanity);
  for (const [t, n] of Object.entries(Run.crewTypes())) stat.endTypes[t] = (stat.endTypes[t] || 0) + n;
  stat.cones += (G.run.cones || []).length;
})
`;

const newStat = () => ({ runs: 0, end: {}, reached: [0, 0, 0, 0], nights: [], jobs: [[0, 0], [0, 0], [0, 0], [0, 0]], hard: [[0, 0], [0, 0], [0, 0], [0, 0]], boss: [[0, 0], [0, 0], [0, 0], [0, 0]],
  deaths: [0, 0, 0, 0], money: [[], [], [], []], roster: [[], [], [], []], hum: [], visits: {}, picks: {}, fails: {}, unsent: {}, slots: {}, pickedTypes: {}, endTypes: {}, cones: 0, walkins: 0, hires: 0, temps: 0, bought: 0, notSent: 0, mad: 0, deserted: 0, custody: 0 });

function measure(bg, policy) {
  const stat = newStat();
  for (let s = 0; s < RUNS; s++) {
    let seed = (SEED * 1000003 + s * 7919) >>> 0;
    const math = Object.create(Math);
    math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const store = new Map();
    const c = vm.createContext({ console, Math: math, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } });
    for (const f of src) vm.runInContext(f, c);
    vm.runInContext(BOT, c)(policy, bg, stat, args.ally && args.ally !== true ? String(args.ally) : null, args.meta || null, +args.danger || 0);
  }
  return stat;
}

const pct = ([w, n]) => (n ? `${Math.round((w / n) * 100)}%` : '-');
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '-');
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : '-');
function summary(bg, policy, st) {
  const clear = (st.end.clear || 0) + (st.end.publish || 0) + (st.end.bury || 0) + (st.end.sell || 0);
  // 幕を越えた割合（挑み直しを含む）。目標は第1幕85%・第2幕65%・第3幕35%
  const atLeast = (a) => st.reached.slice(a).reduce((x, y) => x + y, 0);
  const pass = [atLeast(2) / st.runs, atLeast(3) / (atLeast(2) || 1), clear / (atLeast(3) || 1)].map((x) => `${Math.round(x * 100)}%`).join(' / ');
  return {
    bg, policy, runs: st.runs,
    clear: `${Math.round((clear / st.runs) * 100)}%`,
    end: st.end, medianNight: median(st.nights), pass,
    jobs: st.jobs.slice(1).map(pct).join(' / '), hard: st.hard.slice(1).map(pct).join(' / '), boss: st.boss.slice(1).map(pct).join(' / '),
    deathsPerRun: +(st.deaths.reduce((a, b) => a + b, 0) / st.runs).toFixed(2), deathsByAct: st.deaths.slice(1).join(' / '),
    money: st.money.slice(1).map(avg).join(' / '), roster: st.roster.slice(1).map((a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-')).join(' / '),
    notSentPerRun: +(st.notSent / st.runs).toFixed(2), tempsPerRun: +(st.temps / st.runs).toFixed(2), madPerRun: +(st.mad / st.runs).toFixed(2), deserted: st.deserted, custody: st.custody,
    lowHum: st.hum.filter((h) => h <= 15).length, picks: st.picks, visits: st.visits,
    unsent: st.unsent, slots: st.slots, pickedTypes: st.pickedTypes, conesPerRun: +(st.cones / st.runs).toFixed(2),
    endTypes: Object.fromEntries(Object.entries(st.endTypes).map(([t, n]) => [t, +(n / st.runs).toFixed(1)])),
    fails: Object.fromEntries(Object.entries(st.fails).sort((x, y) => y[1] - x[1]).slice(0, 12)),
  };
}

// 前歴と方針の組み合わせごとに子プロセスで測る（vm を何千も作るとメモリが足りなくなるため。並べて走らせるので速い）
async function main() {
  for (const policy of policies) if (!POLICIES.includes(policy)) throw new Error('unknown policy ' + policy);
  const combos = policies.flatMap((policy) => bgs.map((bg) => ({ policy, bg })));
  if (args.child || combos.length === 1) return combos.map(({ policy, bg }) => summary(bg, policy, measure(bg, policy)));
  const { spawn } = require('node:child_process');
  const width = Math.max(1, Math.min(combos.length, require('node:os').cpus().length - 1));
  const out = new Array(combos.length);
  let next = 0;
  const one = (k) => new Promise((resolve, reject) => {
    const { policy, bg } = combos[k];
    const p = spawn(process.execPath, [__filename, '--bg', bg, '--policy', policy, '--runs', String(RUNS), '--seed', String(SEED), '--child', '--json', ...(args.ally && args.ally !== true ? ['--ally', String(args.ally)] : []), ...(args.meta ? ['--meta', String(args.meta)] : []), ...(args.danger ? ['--danger', String(args.danger)] : [])]);
    let buf = '', err = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code ? reject(new Error(`${bg}/${policy}: ${err.slice(0, 800)}`)) : resolve(JSON.parse(buf)[0])));
  });
  await Promise.all(Array.from({ length: width }, async () => { while (next < combos.length) { const k = next++; out[k] = await one(k); } }));
  return out;
}

main().then((rows) => {
if (args.json) console.log(JSON.stringify(rows, null, 1));
else {
  console.table(rows.map((r) => ({ bg: r.bg, policy: r.policy, runs: r.runs, clear: r.clear, night: r.medianNight, 'pass 1/2/3': r.pass, 'jobs 1/2/3': r.jobs, 'boss 1/2/3': r.boss, 'hard 1/2/3': r.hard, deaths: r.deathsPerRun, 'deaths by act': r.deathsByAct, notSent: r.notSentPerRun, mad: r.madPerRun })));
  console.log('±の目安：500回で50%付近なら±4ポイント、150回なら±8ポイント');
}
}).catch((e) => { console.error(e.message); process.exit(1); });
