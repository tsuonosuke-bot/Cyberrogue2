const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(seed=1) {
  const storage=new Map();
  const math=Object.create(Math);
  math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run('newGame();G.storyQueue=[];for(const r of G.runners){r.contract="exclusive";r.stipend=100;}');
  return run;
}
const ONE_NIGHT=`{title:'試験',nights:1}`;

test('implant slots: two per body part, one for the skin; upgrades swap in place',()=>{
  const run=game();
  run('var r=G.runners[0];');
  assert.equal(run('Object.values(CYBER_SLOTS).reduce((a,b)=>a+b,0)'),11);
  run('installCyber(r,"synapse"); installCyber(r,"painblock");');
  assert.equal(run('cyberBlocker(r,"steering")'),'神経系の枠がいっぱいです（2つまで）');
  assert.equal(run('cyberBlocker(r,"reflex")'),null); // 同じ系統の上位モデルは枠を使わない
  assert.equal(run('swapChoices(r,"steering").join()'),'synapse,painblock');
  run('const h=r.humanity; installCyber(r,"steering","painblock");');
  assert.equal(run('r.cyber.join()'),'synapse,steering');
  assert.equal(run('r.humanity===h-hlCost(r,"steering")'),true); // 外した分の人間性は戻らない
  run('installCyber(r,"plating");');
  assert.equal(run('cyberBlocker(r,"chameleon")'),'体表の枠がいっぱいです（1つまで）');
  assert.equal(run('cyberBlocker(r,"chameleon","synapse")!==null'),true); // 別の部位を外しても空かない
});

test('removing an implant frees the slot but keeps the humanity spent',()=>{
  const run=game();
  run('var r=G.runners[0]; installCyber(r,"plating"); var h=r.humanity;');
  assert.equal(run('removeCyber(r,"plating")'),null);
  assert.equal(run('r.cyber.length===0 && r.humanity===h && r.armor<=armorMax(r)'),true);
  assert.equal(run('removeCyber(r,"plating")'),'入っていません');
});

test('campaign rules have no implant slots',()=>{
  const run=game();
  run('delete G.run; var r=G.runners[0]; installCyber(r,"synapse"); installCyber(r,"painblock");');
  assert.equal(run('cyberBlocker(r,"steering")'),null);
});

test('rewards offer three distinct options within the act limits',()=>{
  for (let seed=1; seed<=120; seed++) {
    const run=game(seed);
    for (const a of [1,2,3]) {
      run(`G.run.act=${a};`);
      const b=JSON.parse(run(`JSON.stringify(Run.makeReward(${ONE_NIGHT}))`));
      assert.equal(b.opts.length,3,`seed ${seed} act ${a}`);
      const keys=b.opts.map(o=>o.id||o.kind);
      assert.equal(new Set(keys).size,3,`seed ${seed} act ${a}: duplicate option ${keys}`);
      for (const o of b.opts) {
        if (o.kind==='cyber') assert.ok(run(`CYBER['${o.id}'].tier<=${a} && Run.cyberTakers('${o.id}').length>0`),`seed ${seed}: ${o.id} in act ${a}`);
        if (o.kind==='gear') assert.ok(run(`GEAR['${o.id}'].price<=${[0,2000,5000,1e9][a]}`),`seed ${seed}: ${o.id} too pricey for act ${a}`);
        if (o.kind==='cr') assert.equal(o.amount,[0,800,2000,4000][a]);
      }
    }
  }
});

test('hard jobs, two-night jobs and big jobs guarantee a rare option',()=>{
  for (let seed=1; seed<=80; seed++) {
    const run=game(seed);
    run('G.run.act=2;');
    for (const job of [`{title:'危',nights:1,hard:true}`,`{title:'二夜',nights:2}`,`{title:'大',nights:1,runBoss:true}`]) {
      const b=JSON.parse(run(`JSON.stringify(Run.makeReward(${job}))`));
      assert.equal(b.rare,true);
      assert.ok(b.opts.some(o=>o.rare),`seed ${seed}: no rare option for ${job}`);
    }
  }
});

test('upgrades of installed lines and missing roles are favoured',()=>{
  let up=0, missing=0, n=0;
  for (let seed=1; seed<=300; seed++) {
    const run=game(seed);
    run('G.run.act=2; G.runners[0].cyber=["optics"];');
    const b=JSON.parse(run(`JSON.stringify(Run.makeReward(${ONE_NIGHT}))`));
    for (const o of b.opts) {
      if (o.kind==='cyber') { n++; if (o.id==='optics2') up++; }
      if (o.kind==='runner' && !['solo','driver'].includes(o.runner.role)) missing++;
    }
  }
  // optics2 は solo に合う Mk.II 以下の約20系統のうちの1つ。3倍なら1/20を大きく超える
  assert.ok(up/n>0.08,`upgrade share ${up}/${n}`);
  assert.ok(missing>0);
});

test('taking each kind of reward applies it once; skipping pays 500cr',()=>{
  const run=game();
  run(`var r=G.runners[0]; var m=G.money;
    G.pending=[{run:true,title:'t',opts:[{kind:'cyber',id:'optics'},{kind:'gear',id:'smg'},{kind:'cr',amount:800}]}];`);
  assert.equal(run('Run.takeReward(0,G.runners[1].id)'),null); // ドライバーにも鷹の目は合う
  assert.equal(run('G.runners[1].cyber.includes("optics") && G.run.taken.includes("optics") && G.pending.length===0'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'cyber',id:'jack'},{kind:'gear',id:'smg'},{kind:'intel'}]}];`);
  assert.equal(run('Run.takeReward(0,r.id)'),'ソロには合いません');
  assert.equal(run('Run.takeReward(1)'),'持たせる人を選んでください');
  assert.equal(run('Run.takeReward(1,r.id)'),null);
  assert.equal(run('r.gear.weapon==="smg" && G.money===m'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'intel'}]}];`);
  assert.equal(run('Run.takeReward(0)===null && G.vouchers.intel===2'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'cr',amount:800}]}];`);
  assert.equal(run('Run.takeReward(-1)===null && G.money===m+500'),true);
  run(`var nr=makeRunner('net'); G.pending=[{run:true,title:'t',opts:[{kind:'runner',runner:nr}]}];`);
  assert.equal(run('Run.takeReward(0)===null && G.runners.includes(nr) && nr.contract==="commission"'),true);
});

test('a taken item never comes back in the same run; untaken ones can',()=>{
  const run=game(3);
  run('G.run.act=3; G.run.taken=Object.keys(GEAR).filter(id=>id!=="railgun");');
  for (let i=0;i<30;i++) {
    const b=JSON.parse(run(`JSON.stringify(Run.makeReward(${ONE_NIGHT}))`));
    assert.ok(b.opts.every(o=>o.kind!=='gear'||o.id==='railgun'));
  }
});

test('a won job puts the reward in the settlement; a lost job does not',()=>{
  const run=game();
  run(`G.run.map[1]=[{type:'job',tpl:'r1_watch'}]; Run.choose(0); const j=G.board[0]; j.req=[];
    G.missions.push({uid:j.uid,job:j,routeIdx:0,team:{field:[G.runners[0].id],support:[],net:[]},start:1,result:{success:true,reason:'',members:[G.runners[0].id],heat:{},lazarus:[],rewardMult:1,log:[],endNight:1,xp:{},credit:{}}});
    G.board=[]; G.runners[0].status='mission'; var out=endNight();`);
  assert.equal(run('out.settle[0].bonus && G.pending.length===1 && G.pending[0].run && G.pending[0].opts.length===3'),true);
  run(`G.pending=[]; Run.choose(0); G.board=[]; endNight();`);
  assert.equal(run('G.pending.length'),0);
});
