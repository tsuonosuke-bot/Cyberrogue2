/* World rules: district conditions last several nights; news lasts exactly one. */
const World = (() => {
  const districts = { street: '屋台街', harbor: '港湾倉庫', upper: '企業区画上層' };
  const enemies = { standard: '通常兵', armored: '装甲兵', hacker: '敵ネットランナー', sniper: '狙撃手', swarm: '群れ' };

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
  // Static jobs declare district in data.js; generated ones (deserter, personal, raid) fall back here.
  function prepareJob(j) {
    j.district ||= j.deserter ? 'street' : j.rank === 3 ? 'upper' : 'street';
    j.tags ||= /delivery|cargo|escort|convoy/.test(j.id || j.tpl) ? ['transport'] : ['operation'];
    return j;
  }
  function init(g) {
    g.gangRelation ??= 0;
    g.conditions ||= {};
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
    // 鎮圧班をかばった幕のあいだは、市警の手配で敵が増える
    if (G.run.wanted && G.run.wanted === G.run.act) {
      ctx.mods.extraEnemy++;
      L(ctx, '', '市警の手配が回っている。次の交戦で敵+1', 'ng');
    }
    // ラン中は、ヒート80を超えた社の依頼で敵が増える
    if (ctx.job.target && CLIENTS[ctx.job.target].kind === 'corp' && G.heat[ctx.job.target] >= 80) {
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
    if (env.news && applies(env.news, ctx.job) && env.news.skill === sk) parts.push({ label: 'ニュース', v: env.news.bonus });
    if (env.condition && env.condition.skill === sk) parts.push({ label: '地区', v: env.condition.bonus });
    return parts;
  }
  const checkBonus = (ctx, m, sk) => checkParts(ctx, m, sk).reduce((a, p) => a + p.v, 0);
  function payoutMultiplier(j) {
    const n = currentNews();
    return n.payout && applies(n, j) && j.tags.includes(n.tag) ? n.payout : 1;
  }
  function settle(ms, s, out) {
    const j = ms.job, res = ms.result;
    if (j.client === 'gang' && res.success) G.gangRelation = clamp(G.gangRelation + 12, -100, 100);
    if (j.district === 'street' && j.client !== 'gang') {
      const trouble = res.log.filter(l => /警報|見つかった|過剰な暴力/.test(l.text)).length;
      G.gangRelation = clamp(G.gangRelation - trouble * 4, -100, 100);
    }
    if (j.target === 'gang') G.gangRelation = clamp(G.gangRelation - (res.success ? 15 : 8), -100, 100);
  }
  function beforeNight(out) {
    init(G);
    if (G.gangRelation <= -30 && G.night % 3 === 0) {
      G.money -= 250; out.events.push({ kind: 'ng', text: '白蛇会の嫌がらせ。修繕費250cr' });
    }
  }
  function nextNight() {
    G.news = Math.floor(Math.random() * news.length);
    G.rumor = rumor();
    for (const key of Object.keys(districts)) {
      if (G.conditions[key] && G.conditions[key].until < G.night) delete G.conditions[key];
      if (!G.conditions[key] && rnd() < .3) G.conditions[key] = { ...clone(pick(conditionPool)), until: G.night + 2 };
    }
  }
  function homeHtml() {
    init(G);
    const cond = Object.entries(districts).filter(([k]) => G.conditions[k]).map(([k, name]) => `<li>${name}：${esc(G.conditions[k].text)}<span class="dim">（夜${G.conditions[k].until}まで／${G.conditions[k].skill}${G.conditions[k].bonus >= 0 ? '+' : ''}${G.conditions[k].bonus}）</span></li>`).join('');
    const gang = G.gangRelation >= 30 ? '<span class="chip b">友好</span>' : G.gangRelation <= -30 ? '<span class="chip p">敵対</span>' : '';
    return `<section class="panel world"><h3>今夜の街</h3>
      <ul class="wlist"><li><span class="label">NEWS</span> ${esc(currentNews().text)}</li>
      <li class="rumor"><span class="label">噂</span> ${esc(G.rumor ||= rumor())}</li>${cond || '<li class="dim">地区はどこも平常</li>'}
      <li>白蛇会との関係 <b class="num">${G.gangRelation}</b> ${gang}<span class="hint dim">　+30以上で屋台街の情報が半額・路上育ちの候補が増える。−30以下で屋台街の交戦に敵+1、3夜ごとに嫌がらせ</span></li></ul></section>`;
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
    return `<span class="chip b">${districts[j.district]}</span>${G.conditions[j.district] ? `<span class="chip o">${esc(G.conditions[j.district].text)}</span>` : ''}${news}`;
  }
  return { districts, enemies, news, init, prepareJob, context, checkParts, checkBonus, payoutMultiplier, settle, beforeNight, nextNight, homeHtml, jobBadge, newsEffects,
    priceMultiplier: () => currentNews().cyber || 1,
    intelMultiplier: j => j.district === 'street' && G.gangRelation >= 30 ? .5 : 1,
    scoutOptions: () => G.gangRelation >= 30 && rnd() < .6 ? { origin: 'street' } : {},
  };
})();

// Static templates carry their district; tags are derived the same way as for dynamic jobs.
for (const j of [...JOBS, ...Object.values(RUN_JOBS)]) World.prepareJob(j);
