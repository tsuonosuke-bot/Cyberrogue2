const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// 乱数は種から決まる。種を変えて地区マップの縛りを何度も確かめる
function game(seed=1) {
  const storage=new Map();
  const math=Object.create(Math);
  math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  // 歩合は毎夜まれに引き抜かれるので、隊は専属にしておく
  run('newGame(undefined,{first:true});G.storyQueue=[];G.news=2;G.conditions={};');
  return {run,storage};
}
// 依頼を判定なしで決着させる（endNight の精算をそのまま通す）
// nights は依頼の何夜目に決着するか（2夜依頼の1夜目なら 2 を渡すと、その夜は続きになる）
const settleAs=(ok,nights=1)=>`for(const ms of G.missions){ms.result={success:${ok},reason:${ok}?'':'試験で失敗',members:teamIds(ms.team),heat:{},lazarus:[],rewardMult:1,log:[],endNight:${nights},xp:{},credit:{}};}`;
const send=`(()=>{const j=G.board[0];const t={field:[G.runners[0].id],support:[],net:[]};for(const r of G.runners.slice(1))(r.role==='net'?t.net:t.support).length<(r.role==='net'?1:2)&&(r.role==='net'?t.net:t.support).push(r.id);j.req=[];G.missions.push({uid:j.uid,job:j,routeIdx:0,team:t,start:G.night,result:null});G.board=[];for(const id of teamIds(t))getR(id).status='mission';})()`;

test('a new run starts at act 1 night 1 with no debt and a ten-night map that ends in the big job',()=>{
  const {run}=game();
  assert.equal(run('G.run.act===1 && G.run.slot===1 && G.run.tonight===null && G.money===3000'),true);
  assert.equal(run('Run.NIGHTS===10 && Run.BOSS_SLOT===10 && G.run.map[10].length===1 && G.run.map[10][0].type==="boss"'),true);
  assert.equal(run('G.run.map[1].length===3 && G.run.map[9].length===2 && [2,3,4,5,6,7,8].every(s=>G.run.map[s].length>=2&&G.run.map[s].length<=4)'),true);
  assert.equal(run('typeof upkeepItems'),'undefined'); // 借金も毎晩の固定費もない
});

test('every generated act honours the per-night rules and every location is connected',()=>{
  for (let seed=1; seed<=150; seed++) {
    const {run}=game(seed);
    for (const a of [1,2,3]) {
      const m=JSON.parse(run(`JSON.stringify(Run.genMap(${a}))`));
      const has=(s,ts)=>m[s].some(n=>ts.includes(n.type));
      for (let s=1; s<=9; s++) {
        assert.ok(has(s,['job','hard']),`seed ${seed} act ${a} night ${s}: a job every night`);
        for (const t of ['doc','shop','alley','hideout','event','hard']) assert.ok(m[s].filter(n=>n.type===t).length<=1,`seed ${seed} act ${a} night ${s}: two ${t}`);
        // どの行き先にも出る線があり、次の夜のどの行き先にも入る線がある
        assert.ok(m[s].every(n=>n.to&&n.to.length&&n.to.every(j=>m[s+1][j])),`seed ${seed} act ${a} night ${s}: dead end`);
        assert.ok(m[s+1].every((_,j)=>m[s].some(n=>n.to.includes(j))),`seed ${seed} act ${a} night ${s+1}: unreachable`);
      }
      if (a===1) assert.equal([1,2,3,4,5,6,7,8,9].some(s=>has(s,['hard'])),false,`seed ${seed}: no dangerous jobs in act 1`);
      if (a===1) assert.equal(has(1,['alley']),true,`seed ${seed}: act 1 offers the alley on night 1`);
      assert.ok(has(4,['hideout','doc']) && has(8,['hideout','doc']) && has(9,['hideout','doc']),`seed ${seed} act ${a}: nights 4, 8 and 9 let you recover`);
      // 9夜目は準備の夜。8夜目のどこからでも、9夜目のどの行き先にも行ける
      assert.ok(m[8].every(n=>n.to.length===m[9].length),`seed ${seed} act ${a}: night 9 is open from every night-8 stop`);
      // 8夜目と9夜目の依頼は1夜で終わる（準備の夜と大仕事に食い込まない）
      assert.equal(run(`${JSON.stringify([...m[8],...m[9]])}.filter(n=>n.tpl).every(n=>JOBS.find(t=>t.id===n.tpl).nights===1)`),true);
      const all=[1,2,3,4,5,6,7,8,9].flatMap(s=>m[s]);
      assert.equal(run(`${JSON.stringify(all)}.filter(n=>n.tpl).every(n=>JOBS.find(t=>t.id===n.tpl).rank===(n.type==='hard'?Math.min(${a}+1,3):${a}))`),true);
    }
  }
});

test('only locations connected to last night’s choice can be chosen; a two-night job follows the lines two steps',()=>{
  const {run}=game(7);
  run(`G.run.map[1]=[{type:'hideout',to:[0]},{type:'alley',to:[1]}]; G.run.map[2]=[{type:'event',to:[1]},{type:'doc',to:[0]}]; G.run.map[3]=[{type:'shop',to:[0]},{type:'event',to:[0]}];`);
  assert.equal(run('Run.options().length'),2);
  run('Run.choose(1); endNight();'); // 路地裏から
  assert.equal(run('Run.options().map(n=>n.type).join()'),'doc');
  assert.equal(run('Run.reachable(3).join()'),'0'); // 闇医者の先は古物屋だけ
  run('Run.choose(0); endNight();');
  assert.equal(run('Run.options().map(n=>n.type).join()'),'shop');
  // 2夜依頼で1夜飛ぶと、2つ先の夜まで線をたどる
  run(`G.run.pos={slot:1,i:0};`);
  assert.equal(run('Run.reachable(3).join()'),'1');
});

test('choosing a destination is final and the night cannot end before one is chosen',()=>{
  const {run}=game();
  assert.equal(run('Run.canEndNight()'),false);
  assert.equal(run('Run.choose(9)'),'行き先が見つかりません');
  run('var i=G.run.map[1].findIndex(n=>n.type==="job"); Run.choose(i);');
  assert.equal(run('Run.canEndNight() && G.board.length===1 && G.board[0].tpl===G.run.map[1][i].tpl && G.board[0].special'),true);
  assert.equal(run('Run.choose(0)'),'今夜の行き先はもう決まっています');
  assert.equal(run('Run.tonightTab()'),'board');
});

test('an untaken job disappears at dawn and the run moves to the next night',()=>{
  const {run}=game();
  run('Run.choose(G.run.map[1].findIndex(n=>n.type==="job")); endNight();');
  assert.equal(run('G.run.slot===2 && G.board.length===0 && G.run.tonight===null && G.night===2'),true);
});

test('the hideout restores HP and +5 humanity; the alley lists missing roles first',()=>{
  const {run}=game();
  run('G.run.map[1]=[{type:"hideout"},{type:"alley"}]; const r=G.runners[0]; r.hp=3; r.humanity=20; Run.choose(0);');
  assert.equal(run('r.hp===maxHp(r) && r.humanity===25'),true);
  run('G.run.tonight=null; G.run.history.pop(); Run.choose(1);');
  assert.equal(run('G.scouts.length===3 && G.scouts.slice(0,2).every(s=>["tech","med"].includes(s.role))'),true); // 隊はソロ・ドライバー・ネットランナー
});

test('events charge only when chosen and refuse when money is short',()=>{
  const {run}=game();
  run('G.run.map[1]=[{type:"event"}]; Run.choose(0); G.run.event.key="informant";');
  run('G.money=100;');
  assert.equal(run('Run.resolveEvent(0)'),'所持金が足りません');
  run('G.money=1000;');
  assert.equal(run('Run.resolveEvent(0)'),null);
  assert.equal(run('G.money===600 && G.vouchers.intel===2 && G.run.event.done.length>0'),true);
  assert.equal(run('Run.resolveEvent(1)'),'もう決めました');
});

test('a two-night job uses up the next night, which cannot be chosen',()=>{
  const {run}=game();
  run(`G.run.map[1]=[{type:'job',tpl:'r2_sample'}]; Run.choose(0); ${send}; ${settleAs(true,2)}; endNight();`);
  assert.equal(run('G.run.slot===2 && G.run.tonight.type==="cont" && Run.canEndNight()'),true);
  run(`${settleAs(true)}; endNight();`);
  assert.equal(run('G.run.slot===3 && G.run.tonight===null && G.missions.length===0'),true);
});

test('night 10 is the big job; it is one shot — not sending anyone ends the run',()=>{
  const {run,storage}=game();
  run('G.run.slot=Run.BOSS_SLOT-1; Run.choose(0); endNight();');
  assert.equal(run('G.run.slot===Run.BOSS_SLOT && G.run.tonight.type==="boss" && G.board[0].runBoss && G.board[0].rank===1'),true);
  run('endNight();'); // 送り出さずに夜を明かすと失敗
  assert.equal(run('G.ended.type'),'boss');
  assert.equal(JSON.parse(storage.get('fixers-cut-meta-v1')).runs,1);
  assert.equal(run('loadSave()'),null); // 終わったランは続きから始められない
});

test('winning the act-1 big job asks for an ally, then act 2 brings that ally’s big job',()=>{
  const {run}=game();
  run(`G.run.slot=Run.BOSS_SLOT; G.run.tonight={type:'boss'}; G.board=[]; G.board.push(addJob(Object.assign(clone(RUN_JOBS.run_denki),{rank:1,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true)}; var out=endNight();`);
  assert.equal(run('G.awaitChoice==="cipher" && G.run.act===2 && G.run.slot===1 && G.rank===2'),true);
  assert.equal(run('out.events.some(e=>e.text.includes("第2幕"))'),true);
  run('chooseBranch(1);');
  assert.equal(run('G.flags.ally==="verde" && Run.nodeInfo(G.run.map[Run.BOSS_SLOT][0]).title===RUN_JOBS.run_cargo_verde.title && Run.nodeInfo(G.run.map[Run.BOSS_SLOT][0]).boss==="kaname"'),true);
});

test('act 3 opens on the ally’s coordinator chapter; clearing it ends the run as a clear',()=>{
  const {run,storage}=game();
  run(`G.flags.ally='hakurou'; G.run.act=2; G.rank=2; G.run.slot=Run.BOSS_SLOT; G.run.tonight={type:'boss'}; G.board.push(addJob(Object.assign(clone(RUN_JOBS.run_cargo_hakurou),{rank:2,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true)}; var out=endNight();`);
  assert.equal(run('G.run.act===3 && G.chapter==="coordinator_hakurou" && out.story.includes("coordinator_hakurou")'),true);
  run(`G.run.slot=Run.BOSS_SLOT; G.run.tonight={type:'boss'}; G.board.push(addJob(Object.assign(clone(RUN_JOBS.run_box_hakurou),{rank:3,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true)}; endNight();`);
  assert.equal(run('G.awaitEnding===true && G.run.cleared'),true);
  run(`chooseEnding('publish');`);
  const meta=JSON.parse(storage.get('fixers-cut-meta-v1'));
  assert.equal(meta.clears,1);
  assert.equal(meta.best.clear,true);
});

test('losing every runner ends the run as a wipe',()=>{
  const {run}=game();
  run('Run.choose(0); G.runners=[]; endNight();');
  assert.equal(run('G.ended.type'),'wipe');
});

test('run rules: one-night therapy, faster skill growth, heat 80 adds an enemy',()=>{
  const {run}=game();
  run('const r=G.runners[0];');
  assert.equal(run('THERAPY_NIGHTS'),1);
  assert.equal(run('xpNeed(3)'),4);
  run(`G.heat.verde=85; const j=addJob(clone(JOBS.find(t=>t.target==='verde'&&t.rank===1)),true); const ctx=missionContext(j,0,snapTeam({field:[r.id],support:[],net:[]}),true);`);
  assert.equal(run('ctx.mods.extraEnemy'),1);
});

test('job routes vary each time but keep the ICE layout, the goals and the required roles; some jobs get a third route',()=>{
  let third=0, assault=0, backway=0;
  for (let seed=1; seed<=120; seed++) {
    const {run}=game(seed);
    for (const tpl of ['r1_watch','r2_sample','r3_relay']) {
      const out=JSON.parse(run(`(()=>{const t=JOBS.find(x=>x.id==='${tpl}'); G.run.map[1]=[{type:'job',tpl:'${tpl}'}]; G.run.tonight=null; G.run.pos=null; G.board=[]; Run.choose(0); const j=G.board[0];
        const goals=(rt)=>rt.field.filter(p=>p&&p.t==='goal').length+rt.net.filter(p=>p&&p.fx==='data').length;
        const ice=(rt)=>rt.net.map(p=>p?p.fx:'-').join();
        return JSON.stringify({n:j.routes.length, same:j.routes.slice(0,t.routes.length).every((rt,i)=>ice(rt)===ice(t.routes[i])&&goals(rt)===goals(t.routes[i])&&rt.field.length===t.routes[i].field.length),
          req:j.req.join()===t.req.join(), extra:j.routes[t.routes.length]?j.routes[t.routes.length].gen:null, extraGoals:j.routes[t.routes.length]?goals(j.routes[t.routes.length]):null, baseGoals:goals(t.routes[0])});})()`));
      assert.ok(out.same && out.req, `seed ${seed} ${tpl}`);
      if (out.extra) { third++; if (out.extra==='assault') assault++; else backway++; assert.equal(out.extraGoals,out.baseGoals); }
    }
  }
  assert.ok(third>60 && third<200,`third routes ${third}/360`);
  assert.ok(assault>0 && backway>0);
});

test('route character counts stealth, fights and net; the route that fits the crew’s main type is recommended',()=>{
  const {run}=game();
  assert.equal(run(`JSON.stringify(Run.routeBars({field:[S(15,'a'),C(4,'b'),GT(15,'c'),O('d'),E(15,'e')],net:[I(15,'x','cam'),_,I(15,'y','door'),_,_]}))`),JSON.stringify({stealth:1,combat:2,net:2}));
  assert.equal(run(`Run.routeBars({field:[H(S(15,'a')),_],net:[_,_]},false).stealth`),0); // 見えない段取りは数えない
  run(`var j={intel:true,routes:[{field:[S(15,'a'),S(15,'b'),O('c')],net:[_,_,_]},{field:[C(3,'a'),C(3,'b'),O('c')],net:[_,_,_]}]}; var r=G.runners[0]; r.gear={weapon:'smg'}; r.cyber=['optics'];`);
  assert.equal(run('Run.recommendRoute(j,[r.id])'),1); // 火力は交戦の多い道
  run(`r.gear={body:'poncho'}; r.cyber=['chameleon','ears'];`);
  assert.equal(run('Run.recommendRoute(j,[r.id])'),0); // 隠密は隠密の多い道
});
