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
    // types を渡すと、その型の数だけ持っている人になる（品の中身は見ない）
    function who(role,types=[],st={},sk={}){const r=makeRunner(role,{trait:null});G.runners.push(r);const m=snap(r);
      for(const k of STATS)m.st[k]=st[k]??5;for(const k of SKILLS)m.sk[k]=sk[k]??0;m.hp=m.maxHp=99;m.armor=m.armorMax=0;m.humanity=50;m.types=types;return m;}
    function mission(field,team,job={}){const j={rank:1,district:'harbor',intel:true,tags:[],target:'verde',routes:[{field,net:field.map(()=>null)}],...job};
      return missionContext(j,0,team,false,false);}
    const said=(ctx,t)=>ctx.log.filter(l=>l.text.includes(t)).length;
    const fill=(t,n)=>Array(n).fill(t);`);
  return {run,storage};
}

test('every implant, gear and trait type is a known type; a runner lists the types of everything they carry',()=>{
  const {run}=game();
  assert.equal(run(`[...Object.values(CYBER),...Object.values(GEAR)].every(x=>x.types&&x.types.length>=1&&x.types.length<=2&&x.types.every(t=>TYPES[t]))`),true);
  run('var r=makeRunner("solo",{trait:"tolerant"}); r.cyber=["reflex"]; r.gear={weapon:"silenced"};');
  assert.equal(run('typesOf(r).sort().join()'),'chrome,chrome,fire,fire,stealth');
  assert.equal(run('JSON.stringify(countTypes(typesOf(r)))'),JSON.stringify({fire:2,chrome:2,stealth:1}));
});

test('types count only the runners sent on the job; a boss turns off the type it resists',()=>{
  const {run}=game();
  run(`var a=who('solo',fill('fire',3)), b=who('net',fill('fire',1)); var ctx=mission([C(1,'x')],{field:[a],support:[],net:[]});`);
  assert.equal(run('typeOn(ctx,"fire",2) && !typeOn(ctx,"fire",4)'),true);
  run(`var ctx2=mission([C(1,'x')],{field:[a],support:[],net:[b]});`);
  assert.equal(run('typeOn(ctx2,"fire",4)'),true);
  run(`var boss=mission([C(1,'x')],{field:[a],support:[],net:[b]},{runBoss:true,boss:'kaname'});`); // カナメは火力に強い
  assert.equal(run('typeOn(boss,"fire",2)'),false);
});

test('火力: +1 to shooting in the first round at 2; a kill lets the shooter fire again at 4; no ambush at 6',()=>{
  const {run}=game({fixed:.5});
  run(`var m=who('solo',fill('fire',2),{REF:5},{射撃:5}); var ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]}); runMission(ctx);`);
  assert.equal(run('ctx.log.find(l=>l.text.includes("を攻撃")).calc.includes("火力の型 1")'),true);
  run(`var m4=who('solo',fill('fire',4),{REF:10},{射撃:10}); var c4=mission([C(2,'見張り')],{field:[m4],support:[],net:[]}); runMission(c4);`);
  assert.equal(run('said(c4,"次を狙う（火力）")>=1 && said(c4,"通常兵を攻撃")===2 && c4.log.filter(l=>l.text.includes("の攻撃")).length===0'),true); // 1ラウンドで2体
  run(`var m6=who('solo',fill('fire',6),{REF:10},{射撃:10,回避:20}); var c6=mission([H(C(1,'伏兵'))],{field:[m6],support:[],net:[]},{intel:false}); runMission(c6);`);
  assert.equal(run('said(c6,"待ち伏せを読んで先に撃つ")'),1);
});

test('隠密: +1 to sneaking at 2; a quiet approach removes one enemy at 4; one whole fight avoided at 6',()=>{
  const {run}=game({fixed:.5});
  run(`var m=who('solo',fill('stealth',4),{COOL:10},{隠密:10,射撃:10}); var ctx=mission([S(13,'忍び込む'),C(1,'見張り')],{field:[m],support:[],net:[]}); runMission(ctx);`);
  assert.equal(run('ctx.log.find(l=>l.text==="忍び込む").calc.includes("隠密の型 1") && said(ctx,"見張りはいなかった")===1 && said(ctx,"見張りを攻撃")===0'),true);
  run(`var g=who('solo',fill('stealth',6)); var c6=mission([C(2,'一つ目'),C(2,'二つ目')],{field:[g],support:[],net:[]}); runMission(c6);`);
  assert.equal(run('said(c6,"交戦を避けた")===1 && said(c6,"二つ目と交戦")===1'),true);
});

test('電脳: a passed ICE weakens the next fight at 4; black ICE backlash is ignored at 6',()=>{
  const {run}=game({fixed:.5});
  run(`var nr=who('net',fill('net',4),{INT:10},{インターフェース:10}); var f=who('solo',[],{REF:10},{射撃:10,回避:20});
    var ctx=missionContext({rank:1,district:'harbor',intel:true,tags:[],target:'verde',routes:[{field:[_,C(1,'見張り')],net:[I(13,'カメラ','cam'),_]}]},0,{field:[f],support:[],net:[nr]},false,false); runMission(ctx);`);
  assert.equal(run('said(ctx,"敵のDVと攻撃−1（電脳）")'),1);
  run(`var n6=who('net',fill('net',6),{INT:1},{インターフェース:0}); var c6=missionContext({rank:1,district:'harbor',intel:true,tags:[],target:'verde',routes:[{field:[_],net:[I(19,'黒ICE','trace')]}]},0,{field:[who('solo')],support:[],net:[n6]},false,false); runMission(c6);`);
  assert.equal(run('said(c6,"逆流を受け流した")>=1 && n6.hp===99'),true);
});

test('持久: HP+5 and no wound penalty at 2; a fourth round at 4; the first death is only a collapse at 6',()=>{
  const {run}=game({fixed:.5});
  run(`var m=who('solo',fill('endure',2),{REF:10},{射撃:10}); m.hp=40; var ctx=mission([C(1,'見張り')],{field:[m],support:[],net:[]}); runMission(ctx);`);
  assert.equal(run('said(ctx,"全員HP+5（持久）")===1 && !ctx.log.find(l=>l.text.includes("を攻撃")).calc.includes("重傷")'),true);
  // 4つで4ラウンド目まで粘る（当たらない射手と、硬い敵）
  run(`var g4=who('solo',fill('endure',4),{REF:1},{射撃:0,回避:20}); var c4=mission([C(1,'壁','armored',40)],{field:[g4],support:[],net:[]}); runMission(c4);`);
  assert.equal(run('c4.log.filter(l=>l.text.includes("を攻撃")).length'),4);
  run(`var dd=who("solo",fill("endure",6),{BODY:1}); var c6=mission([C(1,"x")],{field:[dd],support:[],net:[]}); dd.hp=0; deathSave(c6,dd);`);
  assert.equal(run('!dd.dead && dd.down && said(c6,"動けないだけで済んだ")===1'),true);
  run(`var e=who('solo',fill('endure',6),{BODY:1}); deathSave(c6,e);`); // 2人目からは普通の死亡セーブ
  assert.equal(run('e.dead'),true);
});

test('義体狂い: runners at humanity 30 or less shoot +1 at 2 and dodge +1 at 4; a berserk runner cannot fall at 6',()=>{
  const {run}=game({fixed:.5});
  run(`var m=who('solo',fill('chrome',4)); m.humanity=25; var ctx=mission([C(1,'x')],{field:[m],support:[],net:[]}); ctx.combatState={round:0,shaken:[],mad:[]};`);
  assert.equal(run('Run.checkParts(ctx,m,"射撃").some(p=>p.label==="義体狂いの型") && Run.checkParts(ctx,m,"回避").some(p=>p.label==="義体狂いの型")'),true);
  run('m.humanity=40;');
  assert.equal(run('Run.checkParts(ctx,m,"射撃").some(p=>p.label==="義体狂いの型")'),false);
  run(`var x=who('solo',fill('chrome',6)); var c6=mission([C(1,'x')],{field:[x],support:[],net:[]}); c6.combatState={mad:[x.id]}; x.hp=3; hit(c6,x,50,true);`);
  assert.equal(run('x.hp===1 && !x.down'),true);
});

test('rewards: slot 1 is the crew’s top type, slot 2 another type, slot 3 a connection or a typeless reward',()=>{
  for (let seed=1; seed<=60; seed++) {
    const {run}=game({seed});
    run('G.run.act=2; G.runners[0].gear={weapon:"smg"}; G.runners[0].cyber=["optics","synapse"];'); // 火力が多い
    const b=JSON.parse(run(`JSON.stringify(Run.makeReward({title:'t',nights:1}))`));
    const T=(o)=>JSON.parse(run(`JSON.stringify((${o.kind==='cyber'?'CYBER':'GEAR'})['${o.id}'].types)`));
    assert.equal(b.top,'fire',`seed ${seed}`);
    assert.ok(T(b.opts[0]).includes('fire'),`seed ${seed}: slot 1 ${b.opts[0].id}`);
    assert.ok(['cyber','gear'].includes(b.opts[1].kind) && !T(b.opts[1]).includes('fire'),`seed ${seed}: slot 2 ${b.opts[1].id}`);
    assert.ok(['cone','runner','cr'].includes(b.opts[2].kind),`seed ${seed}: slot 3 ${b.opts[2].kind}`);
    assert.ok(b.opts.every(o=>o.kind!=='intel'));
  }
});

test('hard jobs always offer a connection; big jobs offer one of the strong connections with a weakness',()=>{
  for (let seed=1; seed<=40; seed++) {
    const {run}=game({seed});
    run('G.run.act=2;');
    const hard=JSON.parse(run(`JSON.stringify(Run.makeReward({title:'危',nights:1,hard:true}))`));
    assert.equal(hard.opts[2].kind,'cone',`seed ${seed}`);
    assert.ok(hard.opts.some(o=>o.rare),`seed ${seed}: rare`);
    const boss=JSON.parse(run(`JSON.stringify(Run.makeReward({title:'大',nights:1,runBoss:true}))`));
    assert.equal(run(`CONNECTIONS['${boss.opts[2].id}'].boss===true && !!CONNECTIONS['${boss.opts[2].id}'].weak`),true,`seed ${seed}`);
  }
});

test('connections change the rules: discounts, payouts, insurance and the broken conscience',()=>{
  const {run}=game();
  run('var g0=gearPrice("smg"), c0=cyberPrice("optics"); G.run.cones=["blackmarket"];');
  assert.equal(run('gearPrice("smg")===Math.round(g0*0.8/50)*50 && cyberPrice("optics")<c0'),true);
  run('G.run.cones=["insurance"]; var m=G.money; killRunner(G.runners[0],"t");');
  assert.equal(run('G.money===m+1500'),true);
  run('G.run.cones=["brokenConscience"]; var r=G.runners[0]; r.hp=1; r.humanity=20; G.run.map[1]=[{type:"hideout"}]; Run.choose(0);');
  assert.equal(run('r.hp===maxHp(r) && r.humanity===20 && hlCost(r,"optics")===CYBER.optics.hl-1'),true);
  run(`G.run.cones=["scavenger","backer"]; G.run.tonight=null; G.run.slot=2; G.run.map[2]=[{type:'job',tpl:'r1_watch'}]; Run.choose(0); var j=G.board[0]; j.req=[];
    G.missions.push({uid:j.uid,job:j,routeIdx:0,team:{field:[G.runners[0].id],support:[],net:[]},start:G.night,result:{success:true,reason:'',members:[{id:G.runners[0].id}],heat:{},lazarus:[],rewardMult:1,log:[],endNight:1,xp:{},credit:{}}});
    G.board=[]; G.runners[0].status='mission'; var out=endNight();`);
  assert.equal(run('out.settle[0].lines.some(([k,v])=>k==="拾い屋"&&v===300) && out.settle[0].lines.some(([k,v])=>k==="依頼の報酬"&&v===Math.round(j.payout*1.2))'),true);
});

test('each background starts with one item of its type; the gang starts chromed instead',()=>{
  for (const [bg,item] of [['solo','pistol'],['net','deck'],['ripper','jacket'],['corp','fakeid']]) {
    const {run}=game();
    run(`G=null; newGame('${bg}',{});`);
    assert.equal(run(`G.runners.some(r=>Object.values(r.gear).includes('${item}'))`),true,bg);
  }
});
