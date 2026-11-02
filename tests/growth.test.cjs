const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(value=.5) {
  const math=Object.create(Math);math.random=()=>value;
  const c=vm.createContext({console,Math:math,localStorage:{getItem(){return null;},setItem(){},removeItem(){}}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run('newGame();G.money=20000;G.news=3;G.conditions={};G.board=[];G.runners=G.runners.slice(0,1);G.runners[0].contract="exclusive";G.runners[0].stipend=100;');
  return run;
}

test('gear adds skills, swaps by slot with a half refund, and commission runners pay from their wallet',()=>{
  const run=game();
  run('const r=G.runners[0]; const base=skill(r,"射撃"); buyGear(r,"pistol");');
  assert.equal(run('skill(r,"射撃")===base+1 && G.money===20000-gearPrice("pistol")'),true);
  run('const m=G.money; buyGear(r,"smg");');
  assert.equal(run('r.gear.weapon==="smg" && skill(r,"射撃")===base+2 && G.money===m-gearPrice("smg")+gearRefund("pistol")'),true);
  assert.equal(run('buyGear(r,"smg")'),'もう持っています');
  run('const am=armorMax(r); buyGear(r,"jacket");');
  assert.equal(run('armorMax(r)===am+2 && r.armor===armorMax(r)'),true);
  run('r.contract="commission"; r.wallet=500;');
  assert.match(run('buyGear(r,"deck")'),/手持ち/);
});

test('real missions grant skill experience; skills level up and settlement reports growth and credits',()=>{
  const run=game();
  run(`const r=G.runners[0]; const before=r.skills['隠密']; r.xp={隠密:xpNeed(before)-1};
    const job=addJob({id:'t',title:'試験',client:'resident',target:null,rank:1,district:'harbor',tags:[],req:[],payout:1000,cred:2,heat:0,nights:1,routes:[{name:'試験',field:[S(1,'忍び込む'),_,_,_,O('目標')],net:N5()}]},false);
    dispatch(job.uid,0,{field:[r.id],support:[],net:[]}); const out=endNight();`);
  assert.equal(run('r.skills["隠密"]===before+1'),true);
  assert.equal(run('out.settle[0].growth.some(g=>g.includes("隠密"))'),true);
});

test('gear that turns a failure into a success is credited by name',()=>{
  const run=game();
  run(`const r=G.runners[0]; r.gear.tool='scanner'; const m=snap(r);
    const ctx={sim:false,all:[m],team:{field:[m],support:[],net:[]},job:{district:'harbor'},worldConditions:{news:null,condition:null},log:[],checks:{},xp:{},credit:{},clock:0};
    const need=m.st.INT+m.sk['知覚']+6; const c=check(ctx,m,'知覚',need);`);
  assert.equal(run('c.ok && ctx.credit[m.id+"|熱源スキャナー"]===1'),true);
  assert.match(run('c.calc'),/装備\+2/);
});

test('estimate reports per-skill odds and the main failure causes',()=>{
  const run=game();
  run(`const job=addJob({id:'t2',title:'試験',client:'resident',target:null,rank:1,district:'harbor',tags:[],req:[],payout:1000,cred:2,heat:0,nights:1,routes:[{name:'試験',field:[S(30,'無理な潜入'),GT(40,'開かない扉'),_,_,O('目標')],net:N5()}]},false);
    const e=estimate(job,0,{field:[G.runners[0].id],support:[],net:[]},20);`);
  assert.equal(run('e.p'),0);
  assert.equal(run('e.skills.map(s=>s.sk).sort().join()'),['隠密','電子'].sort().join());
  assert.match(run('e.causes[0].reason'),/開かない扉/);
});
