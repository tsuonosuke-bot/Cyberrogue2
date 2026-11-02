const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game() {
  let calls=0,value=.5;const storage=new Map();
  const math=Object.create(Math);math.random=()=>{calls++;return value;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run(`newGame();G.money=20000;G.news=3;G.conditions={};G.board=[];G.runners=G.runners.slice(0,1);G.runners[0].contract='exclusive';G.runners[0].stipend=100;`);
  const job=(field,net='N5()',nights=1)=>run(`
    const job=addJob({id:'test',title:'試験依頼',client:'resident',target:'verde',rank:1,district:'harbor',tags:[],req:[],payout:1000,cred:2,heat:10,nights:${nights},routes:[{name:'試験',field:${field},net:${net}}]},false);
    dispatch(job.uid,0,{field:[G.runners[0].id],support:[],net:[]});
  `);
  return {run,job,calls:()=>calls,value:v=>value=v};
}

test('trap warning pauses before settlement and upkeep; repeated waiting cannot advance or reroll',()=>{
  const {run,job,calls}=game();job(`[T(999,'警報罠'),_,_,_,O('目標')]`);
  run('const beforeMoney=G.money;const out=endNight();const logs=JSON.stringify(G.missions[0].progress.log);');
  assert.equal(run('out.pending && !out.settle.length && out.upkeepTotal===0 && G.money===beforeMoney && G.night===1'),true);
  assert.equal(run('G.missions[0].progress.waiting && G.missions[0].progress.decisions===1'),true);
  const n=calls();run('const again=endNight();');assert.equal(calls(),n);
  assert.equal(run('JSON.stringify(G.missions[0].progress.log)===logs'),true);
});
test('retreat ends in failure with half target heat, no payout, one ordinary upkeep',()=>{
  const {run,job}=game();job(`[T(999,'警報罠'),_,_,_,O('目標')]`);
  run('const beforeMoney=G.money;endNight();missionDecision(job.uid,false);const out=endNight();');
  assert.equal(run('out.settle.length===1 && !out.settle[0].success && out.settle[0].net===0'),true);
  assert.equal(run('out.settle[0].heat.verde'),13); // 8 for triggered trap + half of declared job heat 10
  assert.equal(run('G.money===beforeMoney-out.upkeepTotal && G.missions.length===0 && G.night===2'),true);
  assert.equal(run('out.settle[0].reason'),'フィクサーの判断で撤退');
});
test('continue preserves prior phase result and rolls only remaining phases',()=>{
  const {run,job}=game();job(`[T(999,'一度だけの罠'),_,_,_,O('目標')]`);
  run('endNight();const first=G.missions[0].progress.log.map(l=>l.text);missionDecision(job.uid,true);const out=endNight();');
  assert.equal(run('out.settle.length===1 && out.settle[0].success'),true);
  assert.equal(run('out.comms[0].lines.filter(l=>l.text==="一度だけの罠").length'),1);
  assert.equal(run('first.every((s,i)=>out.comms[0].lines[i].text===s)'),true);
});
test('two-night missions stop after phase five without rolling future night',()=>{
  const {run,job}=game();job(`[_,_,_,_,_,T(999,'翌夜の罠'),_,_,_,O('目標')]`,'Array(10).fill(null)',2);
  run('const first=endNight();');
  assert.equal(run('!first.pending && !first.settle.length && G.night===2 && G.missions[0].progress.ph===5'),true);
  assert.equal(run('G.missions[0].progress.log.some(l=>l.text.includes("翌夜の罠"))'),false);
  run('const second=endNight();');
  assert.equal(run('second.pending && G.night===2 && G.missions[0].progress.waiting'),true);
});
test('pending contexts persist and rebind member aliases after reload',()=>{
  const {run,job}=game();job(`[T(999,'警報罠'),_,_,_,O('目標')]`);
  run('endNight();save();G=loadSave();const ms=G.missions[0];');
  assert.equal(run('ms.progress.waiting'),true);
  run('missionDecision(ms.uid,true);runMission(ms.progress,1);');
  assert.equal(run('ms.progress.all[0]===ms.progress.team.field[0]'),true);
  assert.equal(run('ms.progress.finished && ms.progress.success'),true);
});
test('network alarm uses same pause and resumes before the field phase',()=>{
  const {run,job}=game();job(`[O('現場目標'),_,_,_,_]`,`[I(999,'警報網','alarm'),_,_,_,_]`);
  run('const out=endNight();');
  assert.equal(run('out.pending && G.missions[0].progress.stage===1 && G.missions[0].progress.ph===0'),true);
  assert.equal(run('G.missions[0].progress.log.some(l=>l.text.includes("現場目標"))'),false);
  run('missionDecision(job.uid,true);const final=endNight();');
  assert.equal(run('final.settle[0].success'),true);
});
test('mission decisions are capped at two even when more alarms fail',()=>{
  const {run,job}=game();job(`[T(999,'一つ目'),T(999,'二つ目'),T(999,'三つ目'),_,O('目標')]`);
  run('const first=endNight();missionDecision(job.uid,true);const second=endNight();');
  assert.equal(run('first.pending && second.pending && G.missions[0].progress.decisions===2'),true);
  run('missionDecision(job.uid,true);const third=endNight();');
  assert.equal(run('!third.pending && third.settle[0].success && G.night===2'),true);
});
test('a field critical wound and a survived death save each request a decision',()=>{
  const {run}=game();
  run(`const r=G.runners[0],team={field:[snap(r)],support:[],net:[]};
    const ctx=missionContext({rank:1,district:'harbor',routes:[{field:[O('目標')],net:[null]}]},0,team,false,true);
    const m=team.field[0];hit(ctx,m,Math.ceil(m.maxHp/2)+1,true);`);
  assert.equal(run('ctx.alert'),'現場の仲間が重傷になった');
  run(`ctx.alert=null;m.hp=1;m.st.BODY=10;hit(ctx,m,5,true);`);
  assert.equal(run('m.down && !m.dead && ctx.alert.includes("死亡セーブ")'),true);
});

test('combat cursor resumes after the hit, without repeating enemy attacks or rerolling damage',()=>{
  const {run,calls}=game();
  run(`
    Object.assign(RANK_ENEMY[1],{dice:2,plus:1});
    const r=G.runners[0],team={field:[snap(r)],support:[],net:[]};
    const m=team.field[0];m.maxHp=20;m.hp=12;m.armor=0;m.st.REF=0;m.sk.回避=0;m.st.BODY=10;
    const j={rank:1,district:'harbor',intel:false,routes:[{field:[H(C(2,'待ち伏せ'))],net:[null]}]};
    const ctx=missionContext(j,0,team,false,true);runMission(ctx,1);
  `);
  assert.equal(run('ctx.waiting && ctx.combatState.enemy===1 && ctx.team.field[0].hp===3'),true);
  const n=calls();run('runMission(ctx,1)');assert.equal(calls(),n);
  run('ctx.waiting=false;ctx.alert=null;runMission(ctx,1);');
  assert.equal(run('ctx.waiting && ctx.combatState.enemy===2 && ctx.team.field[0].hp===0 && !ctx.team.field[0].dead'),true);
  assert.equal(run('ctx.log.filter(l=>l.text.includes("攻撃をかわせない")).length'),2);
  assert.equal(run('ctx.log.filter(l=>l.text.includes("HP 3/20")).length'),1);
});
