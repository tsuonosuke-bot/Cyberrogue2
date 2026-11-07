const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// fixed を渡すと乱数はその値に固定。d10 は 0.05 で1、0.25 で3、0.5 で6
function game({fixed=null,seed=1}={}) {
  const storage=new Map();
  const math=Object.create(Math);
  math.random=()=>{if(fixed!==null)return fixed;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run(`newGame(undefined,{first:true});G.storyQueue=[];G.news=2;G.conditions={};G.gangRelation=0;G.run.bg='none';
    
    function who(role,hum,st={},sk={}){const r=makeRunner(role,{trait:null});G.runners.push(r);const m=snap(r);
      for(const k of STATS)m.st[k]=st[k]??5;for(const k of SKILLS)m.sk[k]=sk[k]??0;m.hp=m.maxHp=99;m.armor=m.armorMax=0;m.humanity=hum;return m;}
    function mission(field,team,interactive=false,target='verde'){const j={rank:1,district:'harbor',intel:true,tags:[],target,routes:[{field,net:field.map(()=>null)}]};
      const ctx=missionContext(j,0,team,false,interactive);return ctx;}
    const said=(ctx,t)=>ctx.log.filter(l=>l.text.includes(t)).length;
    const shooter=(hum)=>who('solo',hum,{REF:10},{射撃:10,回避:20});`);
  return {run,storage};
}

test("不安定: a 1 or 2 on the d10 shakes the runner (−2 to shooting and dodging); every fight costs 1 humanity",()=>{
  const {run}=game({fixed:.05});
  run(`const m=shooter(25);const ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]});runMission(ctx);
    const shot=ctx.log.find(l=>l.text.includes('を攻撃'));`);
  assert.equal(run('said(ctx,"動揺している")'),1);
  assert.equal(run('shot.calc.includes("－動揺 2")'),true);
  assert.equal(run('ctx.humLoss[m.id]===1 && m.humanity===24'),true); // 張りつめた交戦で人間性−1
  const two=game({fixed:.15}).run; // d10 は2
  two(`const m=shooter(25);const ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]});runMission(ctx);`);
  assert.equal(two('said(ctx,"動揺している")'),1);
  const three=game({fixed:.25}).run; // d10 は3：動揺しないが、人間性は減る
  three(`const m=shooter(25);const ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]});runMission(ctx);`);
  assert.equal(three('said(ctx,"動揺している")===0 && ctx.humLoss[m.id]===1'),true);
  const calm=game({fixed:.05}).run;
  calm(`const m=shooter(50);const ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]});runMission(ctx);`);
  assert.equal(calm('said(ctx,"動揺")===0 && !(ctx.humLoss||{})[m.id]'),true);
});

test('兆候: the seizure needs a d10 at or under ceil((16 − humanity) / 4)',()=>{
  for (const [hum,v,want] of [[12,.05,true],[12,.15,false],[8,.15,true],[8,.25,false],[3,.35,true],[3,.45,false],[16,.05,false]]) {
    const {run}=game({fixed:v});
    run(`const m=shooter(${hum});const ctx=mission([C(1,'x')],{field:[m],support:[],net:[]});const s={};psychosis(ctx,s,[m]);`);
    assert.equal(run('s.mad.length===1'),want,`humanity ${hum}, d10 from ${v}`);
  }
});

test('暴走: +2 and two shots a round, certain heat per kill, humanity −2 afterwards, lines marked in the log',()=>{
  const {run}=game({fixed:.25});
  run(`const m=shooter(5);const ctx=mission([C(3,'見張り')],{field:[m],support:[],net:[]});runMission(ctx);
    const shots=ctx.log.filter(l=>l.text.includes('を攻撃'));`);
  assert.equal(run('said(ctx,"暴走した")'),1);
  assert.equal(run('shots[0].calc.includes("＋暴走 2") && shots.length'),3);
  assert.equal(run('ctx.log.findIndex(l=>l.text.includes("攻撃をかわせない")||l.text.includes("の攻撃"))'),-1); // 2発ずつで敵の番が来る前に片付く
  assert.equal(run('ctx.heat.verde'),12);
  assert.equal(run('ctx.humLoss[m.id]===2 && m.humanity===3'),true);
  assert.equal(run('shots.every(l=>l.mad) && ctx.log.some(l=>l.text.includes("我に返った")&&l.mad)'),true);
  assert.equal(run('ctx.maxtac && ctx.maxtac.id===m.id'),true); // 3体倒したので鎮圧班が向かう
});

test('暴走: berserk runners are outside the Lazarus contract',()=>{
  const {run}=game({fixed:.25});
  run(`const m=who('solo',5,{BODY:1});m.lazarus='basic';m.hp=0;const ctx=mission([C(1,'x')],{field:[m],support:[],net:[]});`);
  run('ctx.combatState={mad:[m.id],foes:[]};deathSave(ctx,m);');
  assert.equal(run('m.dead && !m.rescued && said(ctx,"暴走中はラザロの対象外")===1'),true);
  run(`const n=who('solo',50,{BODY:1});n.lazarus='basic';const c2=mission([C(1,'x')],{field:[n],support:[],net:[]});c2.combatState={mad:[],foes:[]};deathSave(c2,n);`);
  assert.equal(run('n.rescued && !n.dead && n.hp===1'),true);
});

// 暴走する一人が4体のうち3体を倒し、次の交戦の前に鎮圧班が来る
const SETUP=`const mad=shooter(5);const mate=shooter(50);
  const ctx=mission([C(4,'見張り'),_,C(1,'増援'),O('目標')],{field:[mad,mate],support:[],net:[]},true);runMission(ctx);`;

test('鎮圧班: after three berserk kills, the next fight stops for a choice',()=>{
  const {run}=game({fixed:.25});
  run(SETUP);
  assert.equal(run('ctx.waiting && ctx.decision==="maxtac" && said(ctx,"鎮圧班が到着した")===1 && ctx.decisions'),0);
});

test('鎮圧班: hand over — the runner is taken and the job goes on without them',()=>{
  const {run}=game({fixed:.25});
  run(`${SETUP} ctx.waiting=false;ctx.alert=null;ctx.decision=null;ctx.maxtac.choice='handover';runMission(ctx);`);
  assert.equal(run('ctx.custody.join()==String(mad.id) && mad.custody && ctx.success'),true);
});

test('鎮圧班: protect — fight the squad (the berserk runner is hunted first); a win keeps everyone and flags the act',()=>{
  const {run}=game({fixed:.25});
  run(`${SETUP} ctx.waiting=false;ctx.alert=null;ctx.decision=null;ctx.maxtac.choice='protect';runMission(ctx);`);
  assert.equal(run('said(ctx,"鎮圧班と交戦")===1 && said(ctx,"鎮圧班を退けた")===1 && ctx.wanted && ctx.success && !ctx.custody.length'),true);
});

test('鎮圧班: the choice is hand over or protect only; anything else hands over',()=>{
  const {run}=game({fixed:.25});
  run(`${SETUP} const ms={uid:1,progress:ctx};G.missions=[ms];missionDecision(1,'retreat');`);
  assert.equal(run('ctx.maxtac.choice'),'handover');
});

test('鎮圧班: estimates hand the runner over without asking',()=>{
  const {run}=game({fixed:.25});
  run(`const mad=shooter(5);const mate=shooter(50);const ctx=mission([C(4,'見張り'),_,C(1,'増援'),O('目標')],{field:[mad,mate],support:[],net:[]});runMission(ctx);`);
  assert.equal(run('!ctx.waiting && ctx.custody.length===1 && ctx.success'),true);
});

test('settlement: custody removes the runner from the run, humanity loss sticks, protecting flags the act with +1 enemy',()=>{
  const {run}=game({fixed:.5});
  run(`const a=G.runners[0],b=G.runners[1];const hb=b.humanity;const j=addJob({id:'t',title:'試験',client:'resident',target:null,rank:1,district:'harbor',tags:[],req:[],payout:1000,cred:0,heat:0,nights:1,routes:[{name:'x',field:[_],net:[_]}]},true);G.board=[];
    const s=settle({job:j,routeIdx:0,result:{success:true,reason:'',members:[{id:a.id,hp:10,armor:0,kills:0},{id:b.id,hp:10,armor:0,kills:0}],heat:{},lazarus:[],rewardMult:1,log:[],xp:{},credit:{},custody:[a.id],humLoss:{[b.id]:2},wanted:true}},{story:[],touched:{}});`);
  assert.equal(run('!G.runners.includes(a) && G.run.custody.length===1 && b.humanity===hb-2 && G.run.wanted===1'),true);
  run(`const ctx=mission([C(1,'x')],{field:[shooter(50)],support:[],net:[]});`);
  assert.equal(run('ctx.mods.extraEnemy===1 && said(ctx,"市警の手配")===1'),true);
});

test('Lazarus armed retrieval: once per job, shoots one round, carries the runner out at half HP',()=>{
  const {run}=game({fixed:.25});
  run(`const m=who('solo',50,{BODY:1});m.lazarus='armed';m.hp=0;const n=who('solo',50,{BODY:1});n.lazarus='armed';n.hp=0;
    const ctx=mission([C(1,'x')],{field:[m,n],support:[],net:[]});ctx.combatState={mad:[],foes:[{name:'敵',hits:1,dv:17}]};
    deathSave(ctx,m);deathSave(ctx,n);`);
  assert.equal(run('m.rescued && m.hp===50 && ctx.armed.join()===String(m.id)'),true);
  assert.equal(run('ctx.combatState.foes[0].hits===0 && said(ctx,"敵を撃つ")===1'),true); // 腕前15＋d10(3)＝18 ≧ 17
  assert.equal(run('n.rescued && n.hp===1 && ctx.lazarus.join()===String(n.id)'),true); // 2人目は基本プランと同じ
  run(`const k=who('solo',50,{BODY:10});k.lazarus='armed';const c2=mission([C(1,'x')],{field:[k],support:[],net:[]});deathSave(c2,k);`);
  assert.equal(run('k.rescued && k.hp===50 && !k.dead'),true); // 生き延びて動けないときも運び出す
});

test('Lazarus plans: armed from act 2, a one-time fee (the difference when upgrading), charged per callout',()=>{
  const {run}=game();
  run('const r=G.runners[0];G.money=10000;');
  assert.equal(run('Run.setLazarus(r,"armed")'),'武装回収は第2幕から入れます');
  assert.equal(run('Run.setLazarus(r,"basic")===null && G.money'),10000-600);
  run('G.run.act=2;');
  assert.equal(run('Run.setLazarus(r,"armed")===null && G.money'),10000-2000);
  assert.equal(run('Run.setLazarus(r,null)===null && Run.setLazarus(r,"basic")===null && G.money'),10000-2000-600);
  assert.equal(run('G.money=0;Run.setLazarus(G.runners[1],"basic")'),'所持金が足りません');
  run('G.money=10000;');
  run(`const j=addJob({id:'t',title:'試験',client:'resident',target:null,rank:2,district:'harbor',tags:[],req:[],payout:1000,cred:0,heat:0,nights:1,routes:[{name:'x',field:[_],net:[_]}]},true);G.board=[];const m0=G.money;
    const s=settle({job:j,routeIdx:0,result:{success:false,reason:'x',members:[{id:r.id,hp:20,armor:0,kills:0,rescued:true,down:true}],heat:{},lazarus:[],armed:[r.id],rewardMult:1,log:[],xp:{},credit:{}}},{story:[],touched:{}});`);
  assert.equal(run('m0-G.money'),1500+600);
});

test('元部下: a runner at humanity 0 becomes a map destination for five nights, then the squad deals with them',()=>{
  const {run}=game({seed:3});
  run(`G.runners[0].humanity=0;G.run.map[1]=[{type:'hideout'}];Run.choose(0);G.runners[0].humanity=0;endNight();`);
  assert.equal(run('G.run.deserters.length===1 && Run.options(G.run.slot).some(n=>n.type==="deserter")'),true);
  assert.equal(run('Run.nodeInfo(Run.options(G.run.slot).find(n=>n.type==="deserter")).title.includes("を止める")'),true);
  for (let i=0;i<5;i++) run('if(!G.run.tonight){Run.choose(0);} if(G.board.length&&G.run.tonight.type!=="boss")G.board=[]; endNight();');
  assert.equal(run('G.run.deserters.length===0 && G.memorial.some(m=>m.cause.includes("鎮圧班"))'),true);
});

test('元部下: choosing them puts the job on the board; stopping them or a squad takeover closes it',()=>{
  const {run}=game({seed:3});
  run(`const r=G.runners[0];r.humanity=0;const out={events:[],deserted:[]};desert(r,out);const i=Run.options(1).findIndex(n=>n.type==="deserter");Run.choose(i);const j=G.board[0];`);
  assert.equal(run('j.deserter && j.rank===1 && j.payout===3000'),true);
  run(`G.board=[];const s={notes:[]};Run.deserterDone(j,{success:false,suppressed:true},s);`);
  assert.equal(run('G.run.deserters.length===0 && G.memorial.at(-1).cause'),'鎮圧班が片付けた（元部下）');
  // 元部下を倒した報酬は、幕のボスの品を探さずに出る（boss がボスの名前ではなく能力の形なので）
  assert.equal(run('Run.makeReward(j,{success:true,bossDown:true}).opts.length'),3);
});

test('元部下: not beaten in three rounds, the squad steps in — the job fails and no heat is added',()=>{
  const {run}=game({fixed:.05});
  run(`const r=G.runners[0];const out={events:[],deserted:[]};desert(r,out);const j=clone(G.run.deserters[0].tpl);j.intel=true;j.routes[0].field=[B(r.name)];
    const ctx=missionContext(j,0,{field:[who('solo',50,{REF:1},{回避:20})],support:[],net:[]},false);runMission(ctx);`); // 当たらないが、かわし続ける
  assert.equal(run('ctx.suppressed && ctx.aborted && ctx.reason.includes("鎮圧班が割り込んで")'),true);
});
