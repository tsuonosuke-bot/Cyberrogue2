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
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run(`newGame(undefined,{first:true});G.money=20000;G.news=3;G.conditions={};G.board=[];G.runners=G.runners.slice(0,1);`);
  const job=(field,net='N5()',nights=1)=>run(`
    const job=addJob({id:'test',title:'試験依頼',client:'resident',target:'verde',rank:1,district:'harbor',tags:[],req:[],payout:1000,cred:2,heat:10,nights:${nights},routes:[{name:'試験',field:${field},net:${net}}]},false);
    dispatch(job.uid,0,{field:[G.runners[0].id],support:[],net:[]});
  `);
  return {run,job,calls:()=>calls,value:v=>value=v};
}

test('a failed trap does not pause: the job runs to the end and settles the same night',()=>{
  const {run,job}=game();job(`[T(999,'警報罠'),_,_,_,O('目標')]`);
  run('const out=endNight();');
  assert.equal(run('!out.pending && out.settle.length===1 && out.settle[0].success && G.missions.length===0 && G.night===2'),true);
  assert.equal(run('out.settle[0].heat.verde'),18); // 8 for the triggered trap + the job's declared heat 10
});
test('a wound, a survived death save and a network alarm never ask to continue or retreat',()=>{
  const {run}=game();
  run(`const r=G.runners[0],team={field:[snap(r)],support:[],net:[]};
    const ctx=missionContext({rank:1,district:'harbor',routes:[{field:[O('目標')],net:[null]}]},0,team,false,true);
    const m=team.field[0];hit(ctx,m,Math.ceil(m.maxHp/2)+1,true);`);
  assert.equal(run('ctx.alert'),null);
  run(`m.hp=1;m.st.BODY=10;hit(ctx,m,5,true);`);
  assert.equal(run('m.down && !m.dead && ctx.alert===null'),true);
  const g=game();g.job(`[O('現場目標'),_,_,_,_]`,`[I(999,'警報網','alarm'),_,_,_,_]`);
  g.run('const out=endNight();');
  assert.equal(g.run('!out.pending && out.settle[0].success'),true);
});
test('two-night missions stop after phase five without rolling future night',()=>{
  const {run,job}=game();job(`[_,_,_,_,_,T(999,'翌夜の罠'),_,_,_,O('目標')]`,'Array(10).fill(null)',2);
  run('const first=endNight();');
  assert.equal(run('!first.pending && !first.settle.length && G.night===2 && G.missions[0].progress.ph===5'),true);
  assert.equal(run('G.missions[0].progress.log.some(l=>l.text.includes("翌夜の罠"))'),false);
  run('const second=endNight();');
  assert.equal(run('!second.pending && second.settle.length===1 && second.settle[0].success && G.night===3'),true);
});
test('a save that stopped for continue/retreat in the old version simply goes on, with member aliases rebound',()=>{
  const {run,job}=game();job(`[_,_,_,_,O('目標')]`);
  run(`const ms=G.missions[0];ms.progress=missionContext(ms.job,ms.routeIdx,snapTeam(ms.team),false,true);
    ms.progress.waiting=true;ms.progress.alert='現場の仲間が重傷になった';save();G=loadSave();const ms2=G.missions[0];`);
  run('missionDecision(ms2.uid,true);runMission(ms2.progress,1);');
  assert.equal(run('ms2.progress.all[0]===ms2.progress.team.field[0]'),true);
  assert.equal(run('ms2.progress.finished && ms2.progress.success'),true);
});
