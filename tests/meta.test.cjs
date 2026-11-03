const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// meta を渡すと、積み上げの保存データをその状態にしてから始める
function game({seed=1,meta=null}={}) {
  const storage=new Map();
  if (meta) storage.set('fixers-cut-meta-v1',JSON.stringify(meta));
  const math=Object.create(Math);
  math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  return {run,storage,meta:()=>JSON.parse(storage.get('fixers-cut-meta-v1')||'{}')};
}

test('a run earns credit for nights survived, big jobs beaten, a clear and first-time feats; mastery counts the background',()=>{
  const {run,meta}=game();
  run(`newGame('net',{}); G.storyQueue=[]; G.night=17; G.run.act=2; G.run.actsCleared=[1]; G.run.hardDone=true; G.ended={type:'boss'}; Run.finish();`);
  const m=meta();
  // 夜16 + 第1幕10 + 初めて第2幕10 + 初めて危ない依頼5
  assert.equal(m.credit,41);
  assert.equal(m.runs,1);
  assert.equal(m.mastery.net,1);
  assert.deepEqual(m.firsts.sort(),['act2','hard']);
  assert.equal(run('G.run.credit.total'),41);
  run('Run.finish();'); // 2回呼んでも数えない
  assert.equal(meta().credit,41);
});

test('credit buys rooms in order, allies, preparations and unlocks; it cannot go below zero',()=>{
  const {run,meta}=game({meta:{credit:100}});
  assert.equal(run('Meta.buy("room","vault")'),null);
  assert.equal(run('Meta.buy("room","vault")'),null); // 30+60
  assert.equal(run('Meta.buy("room","vault")'),'信用が足りません');
  assert.equal(meta().rooms.vault,2);
  assert.equal(meta().credit,10);
  const {run:r2,meta:m2}=game({meta:{credit:200}});
  assert.equal(r2('Meta.buy("contact","courier")'),null);
  assert.equal(r2('Meta.buy("contact","courier")'),'もう解放しています');
  assert.equal(r2('Meta.buy("prep","money")'),null);
  assert.equal(r2('Meta.buy("unlock","bg_gang")'),null);
  assert.deepEqual(m2().unlocked.sort(),['bg_gang','contact_courier','prep_money']);
  assert.equal(r2('Meta.bgOpen("gang") && !Meta.bgOpen("corp") && Meta.bgOpen("solo")'),true);
});

test('rooms, mastery and a preparation take effect at the start of a run',()=>{
  const {run}=game({meta:{credit:0,runs:5,rooms:{vault:3,terminal:1,clinic:1,armory:1,bunks:2},mastery:{net:8},unlocked:['prep_money','prep_cone']}});
  run(`newGame('net',{prep:'money'});`);
  // 3,000 + 金庫2,100 + 当座の資金1,000
  assert.equal(run('G.money'),6100);
  assert.equal(run('G.vouchers.intel'),2); // 元ネット1 + 端末室1
  assert.equal(run('G.run.rerolls'),2);
  assert.equal(run('G.run.noWeak && G.run.mastery===3'),true);
  assert.equal(run('G.runners.flatMap(r=>Object.values(r.gear)).length'),3); // 型の種（デッキ）＋熟練2段（ICE遮断フード）＋武器庫
  const {run:r2}=game({meta:{runs:5,unlocked:['prep_cone']}});
  r2(`newGame('solo',{prep:'cone'});`);
  assert.equal(r2('G.run.cones.length===1 && !CONNECTIONS[G.run.cones[0]].boss'),true);
  const {run:r3}=game({meta:{runs:5}});
  r3(`newGame('solo',{prep:'money'});`); // 解放していない準備は効かない
  assert.equal(r3('G.money'),3000);
});

test('locked items never appear in rewards until their pack is unlocked',()=>{
  for (const [unlocked,want] of [[[],false],[['items_fire'],true]]) {
    let seen=false;
    for (let seed=1; seed<=80 && !seen; seed++) {
      const {run}=game({seed,meta:{runs:5,unlocked}});
      run(`newGame('solo',{}); G.run.act=3; G.runners[0].gear={weapon:'smg'};`);
      const b=JSON.parse(run(`JSON.stringify(Run.makeReward({title:'t',nights:2}))`));
      if (b.opts.some(o=>o.id==='railgun'||o.id==='reflex3')) seen=true;
    }
    assert.equal(seen,want,JSON.stringify(unlocked));
  }
});

test('an ally appears on night 5 of every act and helps on the spot',()=>{
  const {run}=game({meta:{runs:5,unlocked:['contact_courier']}});
  run(`newGame('solo',{});`);
  assert.equal(run('G.run.map[5].some(n=>n.type==="contact"&&n.who==="courier")'),true);
  run(`G.runners[0].hp=1; var m=G.money; G.run.slot=5; G.run.pos=null; var i=Run.options().findIndex(n=>n.type==='contact'); Run.choose(i);`);
  assert.equal(run('G.runners[0].hp===maxHp(G.runners[0]) && G.money===m+1500 && G.run.tonight.note.includes("1,500cr")'),true);
});

test('the clinic’s second level saves one death per run; legends and story fragments are kept after a clear',()=>{
  const {run,meta}=game({meta:{runs:5,rooms:{clinic:2}}});
  run(`newGame('solo',{}); G.storyQueue=[]; const r=G.runners[0]; const m=snap(r); m.st.BODY=1; const ctx=missionContext({rank:1,district:'harbor',intel:true,tags:[],target:'verde',routes:[{field:[C(1,'x')],net:[null]}]},0,{field:[m],support:[],net:[]},false,false); m.hp=0; deathSave(ctx,m);`);
  assert.equal(run('!m.dead && G.run.clinicUsed===1'),true);
  run(`G.runners[0].kills=9; G.run.bossesDown=['denki','kaname']; G.ended={type:'publish'}; G.night=31; G.run.act=3; G.run.actsCleared=[1,2,3]; Run.finish();`);
  const m=meta();
  assert.equal(m.legends[0].name,run('G.runners[0].name'));
  assert.deepEqual(m.fragments.sort(),['denki','kaname']);
  assert.equal(m.clears,1);
});

test('danger tiers open one by one with clears, pay more credit, and are capped at the level unlocked',()=>{
  const {run,meta}=game({meta:{runs:5,dangerMax:1}});
  run(`newGame('solo',{danger:4});`);
  assert.equal(run('G.run.danger'),1); // 開いているのは1段まで
  run(`G.night=31; G.run.act=3; G.run.actsCleared=[1,2,3]; G.ended={type:'publish'}; Run.finish();`);
  const m=meta();
  assert.equal(m.dangerMax,2);
  assert.ok(run('G.run.credit.lines.some(([k])=>k.startsWith("危険度1"))'));
});

test('danger rules: boss resists the top type, far map hidden, hideout heals two, no big-job retry',()=>{
  const {run}=game({meta:{runs:5,dangerMax:5}});
  run(`newGame('solo',{danger:5}); G.storyQueue=[];`);
  run(`var m=snap(G.runners[0]); m.types=['fire','fire','fire','stealth','stealth']; var ctx=missionContext({rank:1,runBoss:true,boss:'kaname',district:'harbor',intel:true,tags:[],target:'verde',routes:[{field:[C(1,'x')],net:[null]}]},0,{field:[m],support:[],net:[]},false,false);`);
  assert.equal(run('typeOn(ctx,"stealth",2)'),true);
  run(`m.types=['stealth','stealth','stealth','fire','fire']; var c2=missionContext({rank:1,runBoss:true,boss:'denki',district:'harbor',intel:true,tags:[],target:'verde',routes:[{field:[C(1,'x')],net:[null]}]},0,{field:[m],support:[],net:[]},false,false);`);
  assert.equal(run('typeOn(c2,"stealth",2)'),false); // いちばん多い型には耐性
  assert.equal(run('Run.mapView().filter(r=>r.nodes.some(n=>n.hidden)).map(r=>r.slot).join()'),'4,5,6,7,8,9');
  run(`for (const r of G.runners) r.hp=1; G.run.map[1]=[{type:'hideout'}]; Run.choose(0);`);
  assert.equal(run('G.runners.filter(r=>r.hp===maxHp(r)).length'),2);
  run(`G.run.tonight=null; G.run.slot=Run.BOSS_SLOT; G.board=[]; Run.nextNight({settle:[{runBoss:true,success:false}],events:[],story:[]});`);
  assert.equal(run('G.ended && G.ended.type'),'boss');
});
