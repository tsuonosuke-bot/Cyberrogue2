/* World rules: district conditions last several nights; news lasts exactly one. */
const World = (() => {
  const districts = { street: '屋台街', harbor: '港湾倉庫', upper: '企業区画上層' };
  const enemies = { standard: '通常兵', armored: '装甲兵', hacker: '敵ネットランナー', sniper: '狙撃手', swarm: '群れ' };
  // 段階つきの設備。G.upgrades[key] は購入済みの段階（0〜levels.length）
  const upgrades = {
    training: { name: '訓練室', levels: [
      { cost: 3000, upkeep: 30, desc: '待機中のランナーは毎夜、本業の技能に経験+1' },
      { cost: 7000, upkeep: 60, desc: '本業の技能に経験+2、ほかの技能1つにも経験+1' }] },
    armory: { name: '武器庫', levels: [
      { cost: 2500, upkeep: 20, desc: '装備が2割引。防具の修理費が半額' }] },
    medical: { name: '医療室', levels: [
      { cost: 4000, upkeep: 40, desc: '待機中のHP回復+4' },
      { cost: 8000, upkeep: 80, desc: '待機中のHP回復+8。待機メドテックがいればさらに+3' }] },
    network: { name: 'ネット設備', levels: [
      { cost: 4500, upkeep: 40, desc: 'インターフェース判定+1' },
      { cost: 9000, upkeep: 80, desc: 'インターフェース判定+2' }] },
    garage: { name: '車庫', levels: [
      { cost: 3500, upkeep: 30, desc: '運転判定+1' },
      { cost: 7000, upkeep: 60, desc: '運転判定+2' }] },
    informant: { name: '情報屋の端末', levels: [
      { cost: 3000, upkeep: 30, desc: '情報の購入費−30%' }] },
    security: { name: '防犯システム', levels: [
      { cost: 3000, upkeep: 30, desc: '白蛇会の嫌がらせを防ぐ' },
      { cost: 6000, upkeep: 60, desc: '襲撃の敵を1体減らす' }] },
    bunks: { name: '仮眠室', levels: [
      { cost: 2500, upkeep: 0, desc: 'セラピーを3夜から2夜に短縮（新規利用から）' }] },
  };
  const lv = (key) => +(G.upgrades[key] || 0);
  const perks = {
    kagerou: { name: '消せない裏口', skill: 'インターフェース', bonus: 2, desc: 'インターフェース+2' },
    yoru: { name: '自分の身体', skill: '射撃', bonus: 2, desc: '射撃+2' },
    haruka: { name: '消えない灯', skill: '医療', bonus: 3, desc: '医療+3' },
    shigure: { name: '湾岸の帝王', skill: '運転', bonus: 3, desc: '運転+3' },
    mikoto: { name: '二つ目の記憶', skill: '電子', bonus: 2, desc: '電子+2' },
  };
  const rivals = {
    kurogane: { name: 'クロガネ', bio: '湾岸の運び屋を束ねる古参。契約より現金を信じる。' },
    neon: { name: 'ネオン', bio: '企業の裏口に通じた若いフィクサー。腕のいい人間を集めている。' },
  };
  const news = [
    { text: 'ヴェルデ新薬発表。研究施設の警備を強化', target: 'verde', skill: '隠密', bonus: -2 },
    { text: '湾岸道路で事故。運転DV+2、運搬報酬+20%', skill: '運転', bonus: -2, tag: 'transport', payout: 1.2 },
    { text: '闇医者の在庫処分。今夜の義体は2割引', cyber: 0.8 },
    { text: '屋台街の祭り。人波に紛れて隠密+2', district: 'street', skill: '隠密', bonus: 2 },
    { text: '港湾労組が検問に協力。港の隠密DV+2', district: 'harbor', skill: '隠密', bonus: -2 },
    { text: 'ハクロウ回線保守。対ハクロウのICE判定+2', target: 'hakurou', skill: 'インターフェース', bonus: 2 },
    { text: 'ミツカネの人員交代。対ミツカネの説得+2', target: 'mitsukane', skill: '説得', bonus: 2 },
    { text: '海霧が港を覆う。港の隠密+2', district: 'harbor', skill: '隠密', bonus: 2 },
    { text: '上層の回線増強。上層のICE判定DV+2', district: 'upper', skill: 'インターフェース', bonus: -2 },
    { text: '屋台街で無料診療。屋台街の医療+2', district: 'street', skill: '医療', bonus: 2 },
    { text: '設備業者のスト。上層の電子判定DV+2', district: 'upper', skill: '電子', bonus: -2 },
    { text: '住民の相互扶助。屋台街の説得+2', district: 'street', skill: '説得', bonus: 2 },
    { text: 'ミツカネ警備部が新型の巡回ドローンを配備。対ミツカネの隠密DV+2', target: 'mitsukane', skill: '隠密', bonus: -2 },
    { text: 'ハクロウ回線で大規模障害。街じゅうのICE判定+1', skill: 'インターフェース', bonus: 1 },
    { text: '港で密輸船が沈没し、湾岸に検問。港の運転DV+2', district: 'harbor', skill: '運転', bonus: -2 },
    { text: 'ヴェルデ、義体の定期メンテ料を値上げ。闇医者が混み、今夜の義体は1割高', cyber: 1.1 },
    { text: '上層で人格転写の違法オークションが摘発。上層の説得DV+2', district: 'upper', skill: '説得', bonus: -2 },
  ];
  // 街の噂。毎夜一つ。状況に応じた噂が混ざる
  const rumors = [
    '水没区の地下に、義体を外した者だけが集まる教会があるらしい。',
    'ヴェルデの新しい治験は、参加者に「二人分」の報酬を払うという。',
    '屋台街の麺屋の親父は、昔ミツカネの暗殺部隊にいたと言い張っている。',
    '上層で、雨を止める装置の実験がまた失敗したらしい。',
    '港に、乗員が一人もいない貨物船が三日も停泊している。',
    'ハクロウ回線のノイズの中に、死んだ人の声が混じるという。',
    '白蛇会の会長は、もう十年、誰にも顔を見せていない。',
    '闇医者のあいだで、人間性を「測り直す」新しい機械が出回っているらしい。',
    '軌道エレベーターの最上階には、三社の誰も知らない部屋があるという。',
    '夜市の合成鰻が本当は何の肉なのか、誰も知らない。',
    '記憶テープの闇市で、他人の初恋が一本300crで売られている。',
    '企業区画の清掃ロボットが、夜中に同じ歌を口ずさんでいるらしい。',
  ];
  function rumor() {
    const extra = [];
    if (G.gangRelation <= -30) extra.push('白蛇会の若い衆が、あんたの隠れ家の場所を嗅ぎ回っているらしい。');
    if (G.gangRelation >= 30) extra.push('白蛇会の古株が、あんたを「話のわかる新人」と呼んでいたそうだ。');
    const dead = G.memorial[G.memorial.length - 1];
    if (dead) extra.push(`屋台街の提灯に、${dead.name}の名前が加わった。誰かが花を置いていった。`);
    const hot = CORPS.find(c => G.heat[c] >= 60);
    if (hot) extra.push(`${CLIENTS[hot].short}の警備部が、新人フィクサーの名簿を作っているらしい。`);
    for (const [k, rv] of Object.entries(G.rivals)) if (rv.stolen.length) extra.push(`${rivals[k].name}のところに移った${rv.stolen[rv.stolen.length - 1].name}は、あまり眠れていないらしい。`);
    if (G.rank >= 2) extra.push('港のゴンドウが、あんたの名前を船乗りたちに回したそうだ。');
    if (G.flags.ally) extra.push('港湾局の記録係が、急に長い休暇を取ったらしい。');
    if (G.flags.ally) extra.push(`${CLIENTS[G.flags.ally].short}の人間が、あんたの隠れ家の前で煙草を吸っていたそうだ。見張りか、護衛か。`);
    return extra.length && rnd() < .5 ? pick(extra) : pick(rumors);
  }
  const conditionPool = [
    { text: '警察の一斉取り締まり', skill: '隠密', bonus: -2 },
    { text: '停電と監視の死角', skill: '隠密', bonus: 1 },
    { text: '道路工事', skill: '運転', bonus: -2 },
  ];
  const personal = {
    kagerou: { title: 'カゲロウ：見てはいけないログ', target: 'hakurou', district: 'upper', req: ['net'], intro: '社内の追手が回線を絞っている。カゲロウは、自分の足跡を消す最後の機会だと言った。', field: [S(15, '追手の事務所へ'), C(2, '回線警備', 'hacker'), GT(15, '記録室'), O('追跡記録を破棄'), E(15, '脱出')], net: [I(15, '追跡線', 'trace'), _, I(17, '個人記録', 'data'), _, _] },
    yoru: { title: 'ヨル：腕も目も自分のもの', target: 'mitsukane', district: 'harbor', req: ['solo'], intro: '義体回収班の督促状が届いた。ヨルは封を裂き、回収拠点の住所だけを机に残した。', field: [S(15, '回収班の倉庫'), C(2, '回収班', 'armored'), R('廃車の影'), O('所有権記録を焼く'), E(15, '脱出')], net: N5() },
    shigure: { title: 'シグレ：担保の車', district: 'harbor', req: ['driver'], rival: 'kurogane', intro: 'クロガネが、担保に取ったシグレの車を今夜の地下レースの賞品に出すらしい。シグレは黙って、使い古したキーを握りしめた。', field: [D(15, '地下レースに飛び入り'), C(2, 'クロガネの用心棒', 'armored'), D(17, '最終コーナー'), O('愛車を取り戻す'), E(15, '湾岸から離脱')], net: N5() },
    mikoto: { title: 'ミコト：原本', target: 'verde', district: 'upper', req: ['tech', 'net'], intro: 'ヴェルデの低温保管施設に、治験の「原本」の記録が残っている。ミコトは、どちらが本物なのかを確かめたいと言った。答えがどちらでも、ここに戻ってくるとも。', field: [S(15, '保管施設の搬入口'), GT(17, '低温保管室'), C(2, '施設警備', 'hacker'), O('治験記録'), E(15, '脱出')], net: [I(15, '入館系', 'trace'), _, I(17, '治験記録の暗号', 'data'), _, _] },
    haruka: { title: 'ハルカ：診療所の灯', target: 'gang', district: 'street', req: ['med'], intro: '診療所を焼いた白蛇会の男が戻った。ハルカは次の患者が来る前に、今度こそ話をつけたいと言う。', field: [K(15, '白蛇会に事情を聞く'), C(3, '放火の実行犯', 'swarm'), M(15, '巻き込まれた住民の治療'), O('清算の証拠'), E(13, '診療所へ帰る')], net: N5() },
  };
  // Static jobs declare district in data.js; generated ones (deserter, personal, raid) fall back here.
  function prepareJob(j) {
    j.district ||= j.deserter ? 'street' : j.rank === 3 ? 'upper' : 'street';
    j.tags ||= /delivery|cargo|escort|convoy/.test(j.id || j.tpl) ? ['transport'] : ['operation'];
    return j;
  }
  function init(g) {
    g.upgrades ||= {};
    for (const k in g.upgrades) if (g.upgrades[k] === true) g.upgrades[k] = 1;
    g.gangRelation ??= 0;
    g.rivals ||= Object.fromEntries(Object.keys(rivals).map(k => [k, { relation: 0, stolen: [], taken: 0 }]));
    g.conditions ||= {};
    g.personalNotices ||= [];
    g.news ??= Math.floor(Math.random() * news.length);
    for (const j of [...g.board, ...g.missions.map(m => m.job)]) prepareJob(j);
    return g;
  }
  function applies(effect, j) { return (!effect.target || effect.target === j.target) && (!effect.district || effect.district === j.district); }
  function currentNews() { return news[G.news] || news[0]; }
  function context(ctx) {
    init(G);
    ctx.environmentNight = G.night;
    ctx.worldConditions = { news: clone(currentNews()), condition: clone(G.conditions[ctx.job.district] || null) };
    // ラン中は、ヒート80を超えた社の依頼で敵が増える
    if (G.run && ctx.job.target && CLIENTS[ctx.job.target].kind === 'corp' && G.heat[ctx.job.target] >= 80) {
      ctx.mods.extraEnemy++;
      L(ctx, '', `${CLIENTS[ctx.job.target].short}が警戒している。次の交戦で敵+1`, 'ng');
    }
    if (ctx.job.district === 'street' && G.gangRelation <= -30) {
      ctx.mods.extraEnemy++;
      L(ctx, '', '白蛇会の妨害。次の交戦で敵+1', 'ng');
    }
  }
  // 判定の補正を出どころごとに返す。通信の計算式と「効いたもの」の集計に使う
  function checkParts(ctx, m, sk) {
    const env = ctx.worldConditions || { news: currentNews(), condition: G.conditions[ctx.job.district] };
    const parts = [];
    if (sk === 'インターフェース' && lv('network')) parts.push({ label: upgrades.network.name, v: lv('network') });
    if (sk === '運転' && lv('garage')) parts.push({ label: upgrades.garage.name, v: lv('garage') });
    const p = perks[(getR(m.id) || {}).storyPerk];
    if (p && p.skill === sk) parts.push({ label: p.name, v: p.bonus, perk: true });
    if (env.news && applies(env.news, ctx.job) && env.news.skill === sk) parts.push({ label: 'ニュース', v: env.news.bonus });
    if (env.condition && env.condition.skill === sk) parts.push({ label: '地区', v: env.condition.bonus });
    return parts;
  }
  const checkBonus = (ctx, m, sk) => checkParts(ctx, m, sk).reduce((a, p) => a + p.v, 0);
  function payoutMultiplier(j) {
    const n = currentNews();
    return n.payout && applies(n, j) && j.tags.includes(n.tag) ? n.payout : 1;
  }
  function refreshBoard() {
    init(G);
    for (const [key, p] of Object.entries(personal)) {
      const r = G.runners.find(r => r.story === key);
      if (!r || r.contract !== 'exclusive' || r.loyalty < 70 || G.flags['personal_' + key] || hasJob('personal_' + key)) continue;
      const j = addJob({ id: 'personal_' + key, rank: 2, target: null, ...p, nights: 1, payout: 7000, cred: 8, heat: 8, client: 'resident', personal: key, runnerId: r.id, desc: p.intro,
        routes: [{ name: '決着をつける', note: '本人と向き合う', field: clone(p.field), net: clone(p.net) }, { name: '裏から近づく', note: '隠密を優先する', field: [S(17, '裏から侵入'), ...clone(p.field).slice(1)], net: clone(p.net) }] }, true);
      j.expires = G.night + 5;
      G.flags['personal_' + key] = 'offered';
      G.personalNotices.push(key);
    }
    if (G.rank >= 2 && G.night % 4 === 0 && !hasJob('rival_sabotage')) {
      const key = Object.keys(rivals)[Math.floor(G.night / 4) % 2], rv = G.rivals[key];
      const stolen = rv.stolen[rv.stolen.length - 1];
      const j = addJob({ id: 'rival_sabotage', rank: 2, title: `${rivals[key].name}の仕事を妨害する`, client: 'broker', target: null, district: 'harbor', rival: key, nights: 1, payout: 6500, cred: 6, heat: 0, req: [], desc: '競合の密輸便から契約書を取り返す。相手との関係は悪くなる。', routes: [{ name: '密輸倉庫', note: '相手の用心棒を突破する', field: [S(15, '倉庫へ'), C(2, stolen ? `${stolen.name}とライバルの用心棒` : 'ライバルの用心棒', 'armored'), GT(15, '契約書の保管庫'), O('契約書'), E(15, '離脱')], net: N5() }] }, true);
      j.expires = G.night + 3;
    }
  }
  function settle(ms, s, out) {
    const j = ms.job, res = ms.result;
    if (j.client === 'gang' && res.success) G.gangRelation = clamp(G.gangRelation + 12, -100, 100);
    if (j.district === 'street' && j.client !== 'gang') {
      const trouble = res.log.filter(l => /警報|見つかった|過剰な暴力/.test(l.text)).length;
      G.gangRelation = clamp(G.gangRelation - trouble * 4, -100, 100);
    }
    if (j.target === 'gang') G.gangRelation = clamp(G.gangRelation - (res.success ? 15 : 8), -100, 100);
    if (j.personal) {
      const r = getR(j.runnerId);
      G.flags['personal_' + j.personal] = res.success ? 'complete' : 'failed';
      if (r) {
        if (res.success) { r.storyPerk = j.personal; s.notes.push(`${r.name}が専用技能「${perks[j.personal].name}」を覚えた（${perks[j.personal].desc}）`); }
        else { r.loyalty = Math.max(0, r.loyalty - 30); s.notes.push(`${r.name}の個人依頼に失敗。忠誠−30`); }
      }
    }
    if (j.rival) { G.rivals[j.rival].relation = clamp(G.rivals[j.rival].relation - (res.success ? 15 : 5), -100, 100); s.notes.push(`${rivals[j.rival].name}との関係 ${G.rivals[j.rival].relation}`); }
  }
  function beforeNight(out) {
    init(G);
    for (const j of G.board.filter(j => j.personal && j.expires < G.night)) {
      const r = getR(j.runnerId);
      if (r && r.status !== 'mission') { leaveRunner(r); out.events.push({ kind: 'ng', text: `${r.name}は個人依頼の期限切れで隠れ家を去った` }); }
      G.flags['personal_' + j.personal] = 'declined';
    }
    G.board = G.board.filter(j => !j.personal || j.expires >= G.night);
    if (G.night % 3 === 0) {
      const j = G.board.find(j => !j.special && j.expires > G.night);
      if (j) { const k = Object.keys(rivals)[Math.floor(G.night / 3) % 2]; G.board = G.board.filter(x => x !== j); G.rivals[k].taken++; out.events.push({ kind: 'warn', text: `${rivals[k].name}が「${j.title}」を先に引き受けた` }); }
    }
    if (G.gangRelation <= -30 && G.night % 3 === 0) {
      if (lv('security')) out.events.push({ kind: 'ok', text: '防犯システムが白蛇会の嫌がらせを防いだ' });
      else { G.money -= 250; out.events.push({ kind: 'ng', text: '白蛇会の嫌がらせ。修繕費250cr' }); }
    }
  }
  function afterNight(out, tonight) {
    const b = recoveryBonus();
    if (b) for (const r of G.runners) if (r.status === 'idle' && !tonight.has(r.id)) r.hp = Math.min(maxHp(r), r.hp + b);
    const t = lv('training');
    if (t) for (const r of G.runners) {
      if (r.status !== 'idle' || tonight.has(r.id) || r.hp <= 0) continue;
      const main = mainSkill(r.role);
      const ups = [[main, gainXp(r, main, t)]];
      if (t >= 2) {
        const other = pick(Object.keys(ROLES[r.role].skills).filter(k => k !== main));
        ups.push([other, gainXp(r, other, 1)]);
      }
      for (const [sk, u] of ups) if (u.length) out.events.push({ kind: 'ok', text: `${r.name}の${sk}が訓練で ${u[u.length - 1]} に上がった` });
    }
    // The last playable night has ended; refreshBoard would otherwise silently remove these jobs.
    for (const j of G.board.filter(j => j.personal && j.expires <= G.night)) {
      const r = getR(j.runnerId);
      if (r && r.status !== 'mission') { leaveRunner(r); out.events.push({ kind: 'ng', text: `${r.name}は個人依頼の期限切れで隠れ家を去った` }); }
      G.flags['personal_' + j.personal] = 'declined';
    }
    G.board = G.board.filter(j => !j.personal || j.expires > G.night);
  }
  function nextNight() {
    G.news = Math.floor(Math.random() * news.length);
    G.rumor = rumor();
    for (const key of Object.keys(districts)) {
      if (G.conditions[key] && G.conditions[key].until < G.night) delete G.conditions[key];
      if (!G.conditions[key] && rnd() < .3) G.conditions[key] = { ...clone(pick(conditionPool)), until: G.night + 2 };
    }
  }
  function poached(r) {
    const key = pick(Object.keys(rivals));
    G.rivals[key].stolen.push({ name: r.name, role: r.role });
    return rivals[key].name;
  }
  const nextLevel = (key) => upgrades[key].levels[lv(key)] || null;
  function buyUpgrade(key) {
    const u = upgrades[key];
    if (!u) return '強化が見つかりません';
    const next = nextLevel(key);
    if (!next) return '購入済みです';
    if (G.money < next.cost) return '所持金が足りません';
    G.money -= next.cost; G.upgrades[key] = lv(key) + 1; return null;
  }
  function recoveryBonus() {
    const m = lv('medical');
    return m ? 4 * m + (m >= 2 && G.runners.some(r => r.role === 'med' && available(r)) ? 3 : 0) : 0;
  }
  function homeHtml() {
    init(G);
    const cond = Object.entries(districts).filter(([k]) => G.conditions[k]).map(([k, name]) => `<li>${name}：${esc(G.conditions[k].text)}<span class="dim">（夜${G.conditions[k].until}まで／${G.conditions[k].skill}${G.conditions[k].bonus >= 0 ? '+' : ''}${G.conditions[k].bonus}）</span></li>`).join('');
    const gang = G.gangRelation >= 30 ? '<span class="chip b">友好</span>' : G.gangRelation <= -30 ? '<span class="chip p">敵対</span>' : '';
    return `<section class="panel world"><h3>今夜の街</h3>
      <ul class="wlist"><li><span class="label">NEWS</span> ${esc(currentNews().text)}</li>
      <li class="rumor"><span class="label">噂</span> ${esc(G.rumor ||= rumor())}</li>${cond || '<li class="dim">地区はどこも平常</li>'}
      <li>白蛇会との関係 <b class="num">${G.gangRelation}</b> ${gang}<span class="hint dim">　+30以上で屋台街の情報が半額・路上育ちの候補が増える。−30以下で屋台街の交戦に敵+1、3夜ごとに嫌がらせ</span></li>
      ${Object.entries(rivals).map(([k,r]) => `<li>${r.name}：関係 <span class="num">${G.rivals[k].relation}</span>／横取り ${G.rivals[k].taken}件／引き抜き ${G.rivals[k].stolen.map(x => esc(x.name)).join('、') || 'なし'}<span class="hint dim">　${r.bio}</span></li>`).join('')}</ul></section>`;
  }
  function upgradesHtml() {
    init(G);
    return `<section class="panel"><h3>隠れ家の設備</h3><p class="hint dim">段階を上げるほど効果が強くなります。維持費は夜明けの固定費に加わります。</p><div class="cws">${Object.entries(upgrades).map(([k,u]) => {
      const cur = lv(k), next = nextLevel(k);
      const steps = u.levels.map((l, i) => `<li class="${i < cur ? 'done' : ''}">${i < cur ? '済' : `Lv${i + 1}`}　${l.desc}</li>`).join('');
      return `<article class="cw ${cur ? 'owned' : ''}"><div class="cwh"><b>${u.name}</b>${u.levels.length > 1 ? `<span class="label num">Lv${cur}/${u.levels.length}</span>` : ''}</div><ul class="checks">${steps}</ul>
        ${next ? `<p class="num">${fmt(next.cost)}cr ・ 維持費 ${next.upkeep}cr/夜</p>` : ''}
        <button data-act="upgrade" data-v="${k}" ${!next || G.money < next.cost ? 'disabled' : ''}>${!next ? '最大' : cur ? `Lv${cur + 1}に上げる` : '導入する'}</button></article>`;
    }).join('')}</div></section>`;
  }
  // フェーズで振る技能。まだ見えていない「???」のフェーズは数えない
  const PHASE_SKILLS = { sneak: ['隠密'], trap: ['知覚'], combat: ['射撃', '回避'], boss: ['射撃', '回避'], gate: ['電子'], escape: ['運転'], drive: ['運転'], talk: ['説得'], med: ['医療'], ice: ['インターフェース'] };
  const ENEMY_SKILLS = { sniper: ['知覚'], hacker: ['インターフェース'] };
  function routeSkills(j, ri) {
    const set = new Set(), r = j.routes[ri];
    for (const p of [...r.field, ...r.net]) {
      if (!p || (p.hidden && !j.intel)) continue;
      for (const k of [...(PHASE_SKILLS[p.t] || []), ...(ENEMY_SKILLS[p.enemyType] || [])]) set.add(k);
    }
    return set;
  }
  // 今夜のニュースがこの依頼に効く効果の一覧。routeIdx を渡すとそのルートだけ、省くとどれかのルートで振る判定を見る
  function newsEffects(j, routeIdx) {
    const n = currentNews(), fx = [];
    if (!applies(n, j)) return fx;
    if (n.payout && n.tag && j.tags.includes(n.tag)) fx.push({ text: `報酬+${Math.round((n.payout - 1) * 100)}%`, good: true });
    const routes = routeIdx === undefined ? j.routes.map((_, i) => i) : [routeIdx];
    if (n.skill && routes.some(i => routeSkills(j, i).has(n.skill))) fx.push({ text: `${n.skill}${n.bonus >= 0 ? '+' : '−'}${Math.abs(n.bonus)}`, good: n.bonus >= 0 });
    return fx;
  }
  function jobBadge(j, routeIdx) {
    prepareJob(j);
    const news = newsEffects(j, routeIdx).map(fx => `<span class="chip ${fx.good ? 'b' : 'p'}" title="${esc(currentNews().text)}">ニュース：${fx.text}</span>`).join('');
    return `<span class="chip b">${districts[j.district]}</span>${G.conditions[j.district] ? `<span class="chip o">${esc(G.conditions[j.district].text)}</span>` : ''}${news}${j.personal ? `<span class="chip p">個人依頼・夜${j.expires}まで／本人必須</span>` : ''}`;
  }
  function storyHtml(key) {
    const p = personal[key];
    if (!p) return '';
    return `<div class="label">PERSONAL</div><h2>${esc(p.title)}</h2><p class="story">${esc(p.intro)}</p><p>5夜以内に本人を編成して依頼を受けてください。期限切れで本人は隠れ家を去ります。</p><button class="primary" data-act="personalnotice">依頼盤で確認する</button>`;
  }
  return { districts, enemies, upgrades, perks, rivals, news, init, prepareJob, context, checkParts, checkBonus, payoutMultiplier, refreshBoard, settle, beforeNight, afterNight, nextNight, poached, buyUpgrade, recoveryBonus, homeHtml, upgradesHtml, jobBadge, newsEffects, storyHtml, level: lv,
    upkeep: () => Object.entries(upgrades).filter(([k]) => lv(k) && upgrades[k].levels[lv(k) - 1].upkeep).map(([k,u]) => [`${u.name}の維持費`, u.levels[lv(k) - 1].upkeep]),
    securityReduction: () => lv('security') >= 2 ? 1 : 0,
    therapyNights: () => G.run ? 1 : lv('bunks') ? 2 : 3,
    priceMultiplier: () => currentNews().cyber || 1,
    gearMultiplier: () => lv('armory') ? .8 : 1,
    repairMultiplier: () => lv('armory') ? .5 : 1,
    intelMultiplier: j => (j.district === 'street' && G.gangRelation >= 30 ? .5 : 1) * (lv('informant') ? .7 : 1),
    scoutOptions: () => G.gangRelation >= 30 && rnd() < .6 ? { origin: 'street' } : {},
    perkHtml: r => r.storyPerk ? `<div class="perk on">専用技能「${perks[r.storyPerk].name}」：${perks[r.storyPerk].desc}</div>` : '',
  };
})();

// Static templates carry their district; tags are derived the same way as for dynamic jobs.
for (const j of [...JOBS, ...Object.values(INTRO_JOBS), ...Object.values(CAMPAIGN_JOBS)]) World.prepareJob(j);
