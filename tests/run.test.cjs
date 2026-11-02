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
  for(const f of ['data','engine','world','run'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  // 歩合は毎夜まれに引き抜かれるので、隊は専属にしておく
  run('newGame();G.storyQueue=[];G.news=2;G.conditions={};for(const r of G.runners){r.contract="exclusive";r.stipend=100;}');
  return {run,storage};
}
// 依頼を判定なしで決着させる（endNight の精算をそのまま通す）
// nights は依頼の何夜目に決着するか（2夜依頼の1夜目なら 2 を渡すと、その夜は続きになる）
const settleAs=(ok,nights=1)=>`for(const ms of G.missions){ms.result={success:${ok},reason:${ok}?'':'試験で失敗',members:teamIds(ms.team),heat:{},lazarus:[],rewardMult:1,log:[],endNight:${nights},xp:{},credit:{}};}`;
const send=`(()=>{const j=G.board[0];const t={field:[G.runners[0].id],support:[],net:[]};for(const r of G.runners.slice(1))(r.role==='net'?t.net:t.support).length<(r.role==='net'?1:2)&&(r.role==='net'?t.net:t.support).push(r.id);j.req=[];G.missions.push({uid:j.uid,job:j,routeIdx:0,team:t,start:G.night,result:null});G.board=[];for(const id of teamIds(t))getR(id).status='mission';})()`;

test('a new run starts at act 1 night 1 with no debt and a map of 3·3·2 destinations then the big job',()=>{
  const {run}=game();
  assert.equal(run('G.run.act===1 && G.run.slot===1 && G.run.tonight===null && G.loans.length===0 && G.money===3000'),true);
  assert.equal(run('[1,2,3,4].map(s=>G.run.map[s].length).join()'),'3,3,2,1');
  assert.equal(run('G.run.map[4][0].type'),'boss');
  assert.equal(run('upkeepItems().filter(x=>!x[0].endsWith("の手当")).map(x=>x[0]).join()'),'隠れ家代'); // 借金も設備の維持費もない
});

test('every generated act honours the per-night rules',()=>{
  for (let seed=1; seed<=150; seed++) {
    const {run}=game(seed);
    for (const a of [1,2,3]) {
      const m=JSON.parse(run(`JSON.stringify(Run.genMap(${a}))`));
      const has=(s,ts)=>m[s].some(n=>ts.includes(n.type));
      for (const s of [1,2,3]) assert.equal(new Set(m[s].map(n=>n.type)).size,m[s].length,`seed ${seed} act ${a} night ${s}: duplicate destination`);
      if (a===1) assert.equal(has(1,['hard'])||has(2,['hard'])||has(3,['hard']),false,`seed ${seed}: no dangerous jobs in act 1`);
      if (a===1) assert.equal(has(1,['alley']),true,`seed ${seed}: act 1 offers the alley on night 1`);
      assert.equal(has(1,['job']),true,`seed ${seed} act ${a}: night 1 has a job`);
      assert.equal(has(2,['doc','shop']),true,`seed ${seed} act ${a}: night 2 has the doctor or the dealer`);
      assert.equal(has(3,['hideout','doc']),true,`seed ${seed} act ${a}: night 3 lets you recover`);
      // 3夜目の依頼は1夜で終わる（大仕事に食い込まない）
      assert.equal(run(`${JSON.stringify(m[3])}.filter(n=>n.tpl).every(n=>JOBS.find(t=>t.id===n.tpl).nights===1)`),true);
      assert.equal(run(`${JSON.stringify([...m[1],...m[2],...m[3]])}.filter(n=>n.tpl).every(n=>JOBS.find(t=>t.id===n.tpl).rank===(n.type==='hard'?Math.min(${a}+1,3):${a}))`),true);
    }
  }
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
  assert.equal(run('G.scouts.length===3 && G.scouts.every(s=>!["solo","driver"].includes(s.role))'),true);
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

test('night 4 is the big job; one failure allows a retry that does not count, a second ends the run',()=>{
  const {run,storage}=game();
  run('G.run.slot=3; Run.choose(0); endNight();');
  assert.equal(run('G.run.slot===4 && G.run.tonight.type==="boss" && G.board[0].runBoss && G.board[0].rank===1'),true);
  run('endNight();'); // 送り出さずに夜を明かすと失敗
  assert.equal(run('!G.ended && G.run.retried && G.run.slot===4 && G.board.length===1 && G.board[0].runBoss'),true);
  run('endNight();');
  assert.equal(run('G.ended.type'),'boss');
  assert.equal(JSON.parse(storage.get('fixers-cut-meta-v1')).runs,1);
  assert.equal(run('loadSave()'),null); // 終わったランは続きから始められない
});

test('winning the act-1 big job asks for an ally, then act 2 brings that ally’s big job',()=>{
  const {run}=game();
  run(`G.run.slot=4; G.run.tonight={type:'boss'}; G.board=[]; G.board.push(addJob(Object.assign(clone(CAMPAIGN_JOBS.camp2),{rank:1,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true)}; var out=endNight();`);
  assert.equal(run('G.awaitChoice==="cipher" && G.run.act===2 && G.run.slot===1 && G.rank===2'),true);
  assert.equal(run('out.events.some(e=>e.text.includes("第2幕"))'),true);
  run('chooseBranch(1);');
  assert.equal(run('G.flags.ally==="verde" && Run.nodeInfo(G.run.map[4][0]).title===RUN_JOBS.run_cargo_verde.title && Run.nodeInfo(G.run.map[4][0]).boss==="kaname"'),true);
});

test('act 3 opens on the ally’s coordinator chapter; clearing it ends the run as a clear',()=>{
  const {run,storage}=game();
  run(`G.flags.ally='hakurou'; G.run.act=2; G.rank=2; G.run.slot=4; G.run.tonight={type:'boss'}; G.board.push(addJob(Object.assign(clone(CAMPAIGN_JOBS.camp3),{rank:2,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true,2)}; var out=endNight();`);
  // camp3 は2夜。2夜目は幕の夜数に数えない
  assert.equal(run('G.run.act===2 && G.run.slot===4 && G.run.tonight.type==="cont"'),true);
  run('out=endNight();');
  assert.equal(run('G.run.act===3 && G.chapter==="coordinator_hakurou" && out.story.includes("coordinator_hakurou")'),true);
  run(`G.run.slot=4; G.run.tonight={type:'boss'}; G.board.push(addJob(Object.assign(clone(CAMPAIGN_JOBS.camp5),{rank:3,runBoss:true}),true)); G.board.pop(); ${send}; ${settleAs(true,2)}; endNight(); endNight();`);
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

test('run rules: no cyberware loans, one-night therapy, faster skill growth, heat 80 adds an enemy',()=>{
  const {run}=game();
  run('const r=G.runners[0]; r.contract="exclusive";');
  assert.equal(run('buyCyber(r,"reflex","loan")'),'ラン中はローンを組めません');
  assert.equal(run('World.therapyNights()'),1);
  assert.equal(run('xpNeed(3)'),4);
  run(`G.heat.verde=85; const j=addJob(clone(JOBS.find(t=>t.target==='verde'&&t.rank===1)),true); const ctx=missionContext(j,0,snapTeam({field:[r.id],support:[],net:[]}),true);`);
  assert.equal(run('ctx.mods.extraEnemy'),1);
});
