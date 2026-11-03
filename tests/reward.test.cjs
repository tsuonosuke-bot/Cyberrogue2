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
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run('newGame(undefined,{first:true});G.storyQueue=[];');
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

test('taking each kind of reward (implant, gear, connection, cr, runner) applies it once; skipping pays 500cr',()=>{
  const run=game();
  run(`var r=G.runners[0]; var m=G.money;
    G.pending=[{run:true,title:'t',opts:[{kind:'cyber',id:'optics'},{kind:'gear',id:'smg'},{kind:'cr',amount:800}]}];`);
  assert.equal(run('Run.takeReward(0,G.runners[1].id)'),null); // ドライバーにも鷹の目は合う
  assert.equal(run('G.runners[1].cyber.includes("optics") && G.run.taken.includes("optics") && G.pending.length===0'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'cyber',id:'jack'},{kind:'gear',id:'smg'},{kind:'cone',id:'scavenger'}]}];`);
  assert.equal(run('Run.takeReward(0,r.id)'),'ソロには合いません');
  assert.equal(run('Run.takeReward(1)'),'持たせる人を選んでください');
  assert.equal(run('Run.takeReward(1,r.id)'),null);
  assert.equal(run('r.gear.weapon==="smg" && G.money===m'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'cone',id:'scavenger'}]}];`);
  assert.equal(run('Run.takeReward(0)===null && G.run.cones.join()==="scavenger" && cone("scavenger")'),true);
  run(`G.pending=[{run:true,title:'t',opts:[{kind:'cr',amount:800}]}];`);
  assert.equal(run('Run.takeReward(-1)===null && G.money===m+500'),true);
  run(`var nr=makeRunner('net'); G.pending=[{run:true,title:'t',opts:[{kind:'runner',runner:nr}]}];`);
  assert.equal(run('Run.takeReward(0)===null && G.runners.includes(nr) && true'),true);
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

test('walk-ins: two candidates a night, missing roles first, paid by act, gone the next night',()=>{
  const run=game();
  run('G.runners=G.runners.slice(0,2); var have=G.runners.map(r=>r.role); var w=Run.walkins();');
  assert.equal(run('w.length'),2);
  assert.equal(run('w.every(r=>!have.includes(r.role))'),true);
  assert.equal(run('Run.walkins()===w'),true); // 同じ夜は同じ顔ぶれ
  run('G.money=1000;');
  assert.equal(run('Run.hireWalkin(0)'),'契約金が足りません');
  run('G.money=5000; var x=w[0];');
  assert.equal(run('Run.hireWalkin(0)'),null);
  assert.equal(run('G.money===3500 && G.runners.includes(x) && Run.walkins().length===1'),true);
  run('G.run.act=3; G.money=4000;');
  assert.equal(run('Run.hireWalkin(0)'),'契約金が足りません'); // 第3幕は5,000cr
  run('G.run.map[1]=[{type:"hideout"}]; Run.choose(0); endNight();');
  assert.equal(run('Run.walkins().length===2 && !Run.walkins().includes(x)'),true);
});

test('losing a runner guarantees a runner in the next reward; firing one does not',()=>{
  for (let seed=1; seed<=40; seed++) {
    const run=game(seed);
    run('G.run.act=2; killRunner(G.runners[0],"t");');
    const b=JSON.parse(run(`JSON.stringify(Run.makeReward(${ONE_NIGHT}))`));
    assert.ok(b.opts.some(o=>o.kind==='runner'),`seed ${seed}`);
    assert.equal(run('G.run.refill'),false);
  }
  const run=game();
  run('fire(G.runners[0]);');
  assert.equal(run('!!G.run.refill'),false);
  run('leaveRunner(G.runners[0]);');
  assert.equal(run('G.run.refill'),true);
});

test('the alley offers more traits than the street at large',()=>{
  let alley=0, walk=0;
  for (let seed=1; seed<=200; seed++) {
    const run=game(seed);
    run('refreshScouts({traitMult:2});');
    alley+=run('G.scouts.filter(r=>r.trait).length');
    walk+=run('Run.walkins().filter(r=>r.trait).length')*1.5; // 顔見せは2人、路地裏は3人
  }
  assert.ok(alley>walk*1.4,`alley ${alley} vs walk-ins ${walk}`);
});

test('a full crew of four swaps someone out to hire; the dropped runner and their implants are gone',()=>{
  const run=game();
  run('G.runners=G.runners.slice(0,3); G.runners.push(makeRunner("med")); G.money=9000; var w=Run.walkins(); var x=w[0]; var out=G.runners[1];');
  assert.equal(run('crewSize()'),4);
  assert.match(run('Run.hireWalkin(0)'),/入れ替える人を選んで/);
  assert.equal(run('Run.hireWalkin(0,out.id)'),null);
  assert.equal(run('crewSize()===4 && G.runners.includes(x) && !G.runners.includes(out) && !G.run.refill'),true);
});

test('a temporary hire fills a missing required role for one job, is paid afterwards, and leaves',()=>{
  const run=game();
  run(`G.runners=G.runners.filter(r=>r.role!=='net'); G.run.map[1]=[{type:'job',tpl:'r1_watch'}]; Run.choose(0); var j=G.board[0]; j.req=['net']; G.money=100;`);
  assert.equal(run('Run.tempFee(j)'),750);
  run('var t=Run.tempHire(j.uid,"net");');
  assert.equal(run('t.temp.uid===j.uid && crewSize()===2 && G.runners.length===3'),true);
  assert.match(run('Run.tempHire(j.uid,"net")'),/もう隊にいます/);
  run(`G.missions.push({uid:j.uid,job:j,routeIdx:0,team:{field:[G.runners[0].id],support:[],net:[t.id]},start:1,result:{success:true,reason:'',members:[{id:G.runners[0].id},{id:t.id}],heat:{},lazarus:[],rewardMult:1,log:[],endNight:1,xp:{},credit:{}}});
    G.board=[]; t.status='mission'; G.runners[0].status='mission'; var out=endNight();`);
  assert.equal(run('!G.runners.includes(t) && out.settle[0].lines.some(([k,v])=>k.includes("臨時雇い")&&v===-750)'),true);
  // 大仕事では各幕1回だけ無料
  run('var boss={uid:999,runBoss:true,req:["net"]}; G.board=[boss];');
  assert.equal(run('Run.tempFee(boss)'),0);
  run('Run.tempHire(999,"net");');
  assert.equal(run('Run.tempFee(boss)'),750);
});
