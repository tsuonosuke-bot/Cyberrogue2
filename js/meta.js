/* FIXER'S CUT ローグライク版 — ランをまたいで残るもの（積み上げ）。
   ランのたびに「信用」がたまり、隠れ家の部屋・協力者・出発前の準備・解放に使う。前歴の熟練は遊んだ回数で上がる。
   記念碑・伝説・物語の断片もここに残る。保存は fixers-cut-meta-v1（ラン数・クリア数・最高到達と同じ場所） */
const Meta = (() => {
  const KEY = 'fixers-cut-meta-v1';
  const blank = () => ({ runs: 0, clears: 0, best: null, dangerMax: 0, credit: 0, earned: 0, rooms: {}, unlocked: [], mastery: {}, memorial: [], legends: [], fragments: [], firsts: [] });
  function load() {
    try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return blank(); }
  }
  function save(m) {
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* 保存できない環境では無視 */ }
  }

  /* 隠れ家の部屋。5つを3段ずつ育てる。毎ランずっと効く */
  const ROOMS = {
    clinic: { name: '診療室', cost: [30, 60, 100], lv: ['出発時に全員の人間性+10', '各幕に1回、死ぬはずの人が重傷で済む', '隠れ家の夜の人間性の回復+5'] },
    armory: { name: '武器庫', cost: [30, 60, 100], lv: ['出発時に装備を1つ持ち込む（2,000crまで）', '持ち込む装備が3,500crまでになる', '装備をもう1つ持ち込む'] },
    terminal: { name: '端末室', cost: [30, 60, 100], lv: ['情報券1枚で始める', '各幕のはじめに情報券+1', '情報の値段が半分。大仕事の夜は敵の強さ−2、ボスの耐久（ネットのボスは黒ICEの層）−1'] },
    bunks: { name: '宿舎', cost: [30, 60, 100], lv: ['顔見せの候補+1', '最初の隊の引き直し+1', '顔見せの契約金−30%'] },
    vault: { name: '金庫', cost: [30, 60, 100], lv: ['初期資金+700cr', '初期資金+700cr（計+1,400cr）', '初期資金+700cr（計+2,100cr）'] },
  };
  /* 協力者。関係を結ぶと、各幕の地図の5夜目あたりにその人の地点が出る */
  const CONTACTS = {
    broker: { name: '闇市の顔役', cost: 50, desc: '隊にいちばん多い型の品を、2つから1つもらえる' },
    courier: { name: '運び屋', cost: 50, desc: '全員のHPが戻り、1,500crを受け取る' },
    cop: { name: '元警官', cost: 50, desc: '全社のヒート−20。市警の手配も消える' },
  };
  /* 出発前の準備。解放したものから、ランごとに1つ選んで持ち込む */
  const PREPS = {
    money: { name: '当座の資金', cost: 30, desc: '初期資金+1,000cr' },
    implant: { name: '闇医者のツケ', cost: 30, desc: '最初の隊の1人に、合う基本の義体を1つ入れる（人間性は削れる）' },
    cone: { name: '昔のよしみ', cost: 30, desc: '弱みのないコネを1つ持って始める' },
    trait: { name: '見込みのある新人', cost: 30, desc: '最初の隊の1人に、希少な資質を1つ' },
  };
  /* 解放。後の3つの前歴と、型ごとの強い品。解放するまで報酬・古物屋・闇医者に出ない */
  const UNLOCKS = {
    bg_corp: { name: '前歴：企業の元社員', cost: 40 },
    bg_gang: { name: '前歴：白蛇会の身内', cost: 40 },
    bg_patchwork: { name: '前歴：寄せ集め', cost: 40 },
    items_fire: { name: '火力の品（試作レールガン・反射増幅器「瞬・極」）', cost: 40, items: ['railgun', 'reflex3'] },
    items_stealth: { name: '隠密の品（擬態皮膚・音響センサー・軍用）', cost: 40, items: ['chameleon', 'ears2'] },
    items_net: { name: '電脳の品（軍用ニューラルジャック・軍用デッキ）', cost: 40, items: ['jack2', 'milDeck'] },
    items_chrome: { name: '義体狂いの品（戦術AI「カゲボウシ改」・鉄骨アームMk.II）', cost: 40, items: ['tacai2', 'arm2'] },
    items_endure: { name: '持久の品（人工心臓「ツヅミ・弐」・軍用皮下装甲）', cost: 40, items: ['heart2', 'milplate'] },
  };
  const LOCKED_ITEMS = Object.values(UNLOCKS).flatMap((u) => u.items || []);
  /* 前歴の熟練。その前歴で遊んだ回数で上がる。2段：型の種の品をもう1つ、3段：前歴の弱みがなくなる */
  const MASTERY = [0, 3, 8];
  const masteryOf = (m, bg) => MASTERY.filter((n) => (m.mastery[bg] || 0) >= n).length;
  /* 初めてのことは1回きりの追加 */
  const FIRSTS = { act2: ['初めて第2幕に入った', 10], act3: ['初めて第3幕に入った', 15], hard: ['初めて危ない依頼を成功させた', 5], type6: ['初めて型を6つそろえて送り出した', 10], clear: ['初めてクリアした', 30] };
  /* 物語の断片。大仕事のボスを初めて倒すたびに1つ開く。5つそろうと、クリアしたときの結末に一節が加わる */
  const FRAGMENTS = {
    denki: '電気屋の帳簿の最後の頁に、ハシバの字で「鍵は二つある」とだけ書いてあった。',
    kaname: 'カナメは名簿を一度も開かなかった。名前を読むと、回収できなくなるからだと言った。',
    hound: 'ナカガワの警備艇の航海日誌には、毎晩同じ座標が記されていた。湾の底、何もないはずの場所。',
    subject: '被検体の腕には、治験番号の下に、消しきれなかった子どもの名前が残っていた。',
    keeper: '保守主任の回線の奥に、ハシバの声が録音されていた。「箱を開けるのは、俺じゃなくていい」',
  };
  const HIDDEN_END = '五つの断片を並べると、ハシバがなぜ消えたのかが見えてくる。箱は、ハシバが自分を消すために作った最後の仕事だった。あなたが開けたのは、彼が残した遺書だったのかもしれない。';

  /* 危険度。クリアするたびに次の段が開く。各段は前の段の縛りを全部引き継ぐ。稼ぐ信用は1段ごとに+10% */
  const DANGER = [
    null,
    '大仕事のボスが、送り出した人にいちばん多い型にも耐性を持つ',
    '地区マップは、2夜先までしか見えない',
    '隠れ家で回復できるのは、いちばん傷の深い2人まで',
    '報酬の3択の1枠が、ときどき空く',
    '大仕事のボスの耐久+1',
  ];
  const has = (m, key) => m.unlocked.includes(key);
  const room = (m, k) => m.rooms[k] || 0;
  /* ボットで「全部そろえた」状態を測るときに使う（localStorage にこの形で書く） */
  function full() {
    const m = blank();
    for (const k of Object.keys(ROOMS)) m.rooms[k] = 3;
    m.dangerMax = DANGER.length - 1;
    m.unlocked = [...Object.keys(CONTACTS).map((k) => 'contact_' + k), ...Object.keys(PREPS).map((k) => 'prep_' + k), ...Object.keys(UNLOCKS)];
    for (const bg of Object.keys(Run.BACKGROUNDS)) m.mastery[bg] = 99;
    m.runs = 99;
    return m;
  }

  /* 信用を使う。kind は room・contact・prep・unlock */
  function buy(kind, key) {
    const m = load();
    let cost;
    if (kind === 'room') {
      const R = ROOMS[key];
      if (!R) return '部屋が見つかりません';
      if (room(m, key) >= 3) return 'もう最後まで育てました';
      cost = R.cost[room(m, key)];
    } else {
      const T = { contact: CONTACTS, prep: PREPS, unlock: UNLOCKS }[kind];
      if (!T || !T[key]) return '見つかりません';
      const id = kind === 'unlock' ? key : `${kind}_${key}`;
      if (has(m, id)) return 'もう解放しています';
      cost = T[key].cost;
    }
    if (m.credit < cost) return '信用が足りません';
    m.credit -= cost;
    if (kind === 'room') m.rooms[key] = room(m, key) + 1;
    else m.unlocked.push(kind === 'unlock' ? key : `${kind}_${key}`);
    save(m);
    return null;
  }

  const bgOpen = (bg, m = load()) => !Run.BACKGROUNDS[bg].later || has(m, 'bg_' + bg);
  const itemLocked = (id) => LOCKED_ITEMS.includes(id) && !Object.entries(UNLOCKS).some(([k, u]) => (u.items || []).includes(id) && has(load(), k));
  const prepsOpen = (m = load()) => Object.keys(PREPS).filter((k) => has(m, 'prep_' + k));
  const contactsOpen = (m = load()) => Object.keys(CONTACTS).filter((k) => has(m, 'contact_' + k));

  /* ランの始めに効かせる（Run.start から呼ぶ）。prep は出発前の準備 */
  function startRun(g, opt) {
    const m = load(), run = g.run;
    run.danger = Math.max(0, Math.min(+opt.danger || 0, m.dangerMax));
    run.rooms = { ...m.rooms };
    run.mastery = masteryOf(m, run.bg);
    run.contacts = contactsOpen(m);
    if (run.mastery >= 3) {
      run.noWeak = true;
      if (run.bg === 'corp') for (const c of CORPS) if (c !== run.corp) G.heat[c] = clamp(G.heat[c] - 10, 0, 100); // 企業の元社員の弱みを戻す
    }
    G.money += 700 * room(m, 'vault');
    if (room(m, 'terminal') >= 1) G.vouchers.intel += 1;
    if (room(m, 'bunks') >= 2 && !opt.first && run.bg !== 'patchwork') run.rerolls += 1;
    if (room(m, 'clinic') >= 1) for (const r of G.runners) r.humanity = Math.min(maxHum(r), r.humanity + 10);
    // 武器庫：持ち込む装備。持てる人がいて、まだ持っていない部位の品から
    const bring = room(m, 'armory') >= 3 ? 2 : room(m, 'armory') >= 1 ? 1 : 0;
    const cap = room(m, 'armory') >= 2 ? 3500 : 2000;
    for (let k = 0; k < bring; k++) {
      const ids = shuffle(Object.keys(GEAR).filter((id) => !GEAR[id].drop && !itemLocked(id) && GEAR[id].price <= cap && GEAR[id].price >= 700));
      for (const id of ids) {
        const r = G.runners.find((x) => GEAR[id].roles.includes(x.role) && !x.gear[GEAR[id].slot]);
        if (r) { equipGear(r, id); break; }
      }
    }
    // 熟練2段：型の種の品をもう1つ
    const g2 = Run.BACKGROUNDS[run.bg].gear2;
    if (run.mastery >= 2 && g2) { const r = G.runners.find((x) => GEAR[g2].roles.includes(x.role) && !x.gear[GEAR[g2].slot]) || G.runners[0]; equipGear(r, g2); }
    // 出発前の準備
    const prep = opt.prep && has(m, 'prep_' + opt.prep) ? opt.prep : null;
    run.prep = prep;
    if (prep === 'money') G.money += 1000;
    if (prep === 'implant') {
      for (const r of shuffle(G.runners.slice())) {
        const cs = ROLE_CYBER[r.role].filter((c) => CYBER[c].tier === 1 && !CYBER[c].drop && !cyberBlocker(r, c));
        if (cs.length) { installCyber(r, pick(cs)); break; }
      }
    }
    if (prep === 'cone') (run.cones ||= []).push(pick(Object.keys(CONNECTIONS).filter((k) => !CONNECTIONS[k].boss)));
    if (prep === 'trait') {
      const r = pick(G.runners);
      r.trait = pickTrait();
      r.humanity = maxHum(r) - r.cyber.reduce((s, c) => s + hlCost(r, c), 0);
    }
  }
  const pickTrait = () => { const odds = TRAIT_ODDS.filter(([k]) => k !== 'anomaly'); let x = rnd() * odds.reduce((a, [, p]) => a + p, 0); for (const [k, p] of odds) if ((x -= p) < 0) return k; return odds[0][0]; };

  /* ランの終わりに信用を数え、記念碑・伝説・断片・熟練を残す（Run.finish から呼ぶ）。内訳を返す */
  function finishRun(run, clear) {
    const m = load(), lines = [];
    const nights = Math.max(0, G.night - 1);
    lines.push([`生き延びた夜 ×${nights}`, nights]);
    const beaten = run.bossesDown || [];
    const actPts = { 1: 10, 2: 20, 3: 30 };
    for (const a of run.actsCleared || []) lines.push([`第${a}幕の大仕事`, actPts[a]]);
    if (clear) lines.push(['クリア', 50]);
    const fresh = (k) => !m.firsts.includes(k) && (m.firsts.push(k), lines.push([FIRSTS[k][0], FIRSTS[k][1]]), true);
    if (run.act >= 2) fresh('act2');
    if (run.act >= 3) fresh('act3');
    if (run.hardDone) fresh('hard');
    if (run.type6) fresh('type6');
    if (clear) fresh('clear');
    const danger = run.danger || 0;
    if (danger) lines.push([`危険度${danger}（+${danger * 10}%）`, Math.round((lines.reduce((a, [, v]) => a + v, 0) * danger) / 10)]);
    const total = lines.reduce((a, [, v]) => a + v, 0);
    if (clear && danger === m.dangerMax && danger < DANGER.length - 1) m.dangerMax++;
    m.credit += total; m.earned += total;
    m.runs++;
    if (clear) m.clears++;
    m.mastery[run.bg] = (m.mastery[run.bg] || 0) + 1;
    for (const b of beaten) if (FRAGMENTS[b] && !m.fragments.includes(b)) m.fragments.push(b);
    // 記念碑：このランで帰ってこなかった者（新しい順に40人まで）
    m.memorial = [...G.memorial.filter((x) => x.night).map((x) => ({ name: x.name, role: x.role, cause: x.cause, run: m.runs })), ...m.memorial].slice(0, 40);
    // 伝説：クリアしたランで、いちばん倒した生き残り
    if (clear) {
      const top = G.runners.filter((r) => !r.temp).sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
      if (top) m.legends = [{ name: top.name, gender: top.gender, role: top.role, origin: top.origin, base: top.base, skills: top.skills, trait: top.trait, bio: top.bio, run: m.runs }, ...m.legends].slice(0, 10);
    }
    save(m);
    return { lines, total, m };
  }

  /* 伝説のランナーを雇える形に戻す */
  const legendRunner = (L) => Object.assign(makeRunner(L.role, { name: L.name, gender: L.gender, origin: L.origin, base: L.base, skills: L.skills, trait: L.trait ?? null, bio: L.bio }), { legend: true });

  return { KEY, DANGER, load, save, full, buy, ROOMS, CONTACTS, PREPS, UNLOCKS, FIRSTS, FRAGMENTS, HIDDEN_END, MASTERY, masteryOf, room, has, bgOpen, itemLocked, prepsOpen, contactsOpen, startRun, finishRun, legendRunner };
})();
