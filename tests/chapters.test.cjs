const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game() {
  const storage=new Map();
  const c=vm.createContext({console,Math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  // キャンペーン版の章の仕組みを確かめる。ラン中は run.js が幕を進めるので、ランを外して従来の依頼盤に戻す
  run('newGame();delete G.run;refreshScouts();refreshBoard();G.money=99999;G.news=3;G.conditions={};');
  return {run,storage};
}
// Settles a won mission for the given board job without rolling dice.
const win=`(job)=>{const out={story:[],touched:{}};const ms={job,routeIdx:0,result:{success:true,reason:'',members:[],heat:{},lazarus:[],rewardMult:1,log:[]}};G.board=G.board.filter(j=>j!==job);return {s:settle(ms,out),out};}`;
const winMain=`()=>{refreshBoard(true);const j=G.board.find(j=>j.campaign===G.chapter);if(!j)throw new Error('no main job in '+G.chapter);return (${win})(j);}`;
const ALLIES=['mitsukane','verde','hakurou'];

test('chapter table is consistent: links, branches, jobs and conditions all resolve',()=>{
  const {run}=game();
  assert.equal(run(`Object.entries(CHAPTERS).every(([k,c])=>{
    const nexts=c.ending?[]:c.choice?c.choice.options.map(o=>o.next):typeof c.next==='string'?[c.next]:Object.values(c.next.ally);
    return (c.ending||nexts.length)&&nexts.every(n=>CHAPTERS[n])&&(!c.job||CAMPAIGN_JOBS[c.job].campaign===k)&&Object.keys({...c.unlock,...c.advance}).every(r=>REQS[r]);
  })`),true);
  assert.equal(run(`Object.values(CAMPAIGN_JOBS).every(j=>CHAPTERS[j.campaign]&&CHAPTERS[j.campaign].job===j.id)`),true);
  assert.equal(run(`CHAPTERS.cipher.choice.options.map(o=>o.ally).sort().join()`),[...ALLIES].sort().join());
});

for (const [i, ally] of ALLIES.entries()) test(`branch ${ally}: handover → cipher → choice → cargo → drowned → coordinator → dawn → ending`,()=>{
  const {run}=game();
  run(`G.successes=3; var out=endNight();`);
  assert.equal(run('G.chapter'),'cipher');
  run(`G.rank=2; const n=makeRunner('net'); n.skills['インターフェース']=6; G.runners.push(n); var r=(${winMain})();`);
  assert.equal(run('G.awaitChoice==="cipher" && G.chapter==="cipher" && r.s.bonus'),true);
  assert.equal(run('endNight()'),null); // the night cannot end until a branch is chosen
  run(`G.heat={mitsukane:40,verde:40,hakurou:40}; chooseBranch(${i});`);
  assert.equal(run('G.chapter'),`cargo_${ally}`);
  assert.equal(run(`G.flags.ally==="${ally}" && G.heat.${ally}===10 && Object.entries(G.heat).every(([k,v])=>k==="${ally}"||v===50)`),true);
  assert.equal(run(`G.storyQueue.includes("cargo_${ally}") && G.board.some(j=>j.campaign==="cargo_${ally}")`),true);
  run(`(${winMain})();`);
  assert.equal(run('G.chapter'),'drowned');
  assert.equal(run('refreshBoard(true); G.board.some(j=>j.campaign==="drowned")'),false); // needs two nights of digging
  run('G.night+=2;');
  run(`r=(${winMain})();`);
  assert.equal(run('G.chapter'),`coordinator_${ally}`);
  assert.equal(run('refreshBoard(true); G.board.some(j=>j.campaign)'),false); // rank 3 first
  run(`G.rank=3; (${winMain})();`);
  assert.equal(run('G.chapter'),'dawn');
  run(`r=(${winMain})();`);
  assert.equal(run('G.awaitEnding===true && !r.s.bonus'),true);
  assert.equal(run('G.chapterLog.join()'),`handover,cipher,cargo_${ally},drowned,coordinator_${ally},dawn`);
});

test('heatPerNight chapters keep every corporation heating; others cool when untouched',()=>{
  const {run}=game();
  run(`G.missions=[];G.board=[];G.heat={mitsukane:20,verde:20,hakurou:20};endNight();`);
  assert.equal(run('G.heat.verde'),19);
  run(`G.chapter='coordinator_verde';G.flags.ally='verde';G.missions=[];G.board=[];G.heat={mitsukane:20,verde:20,hakurou:20};endNight();`);
  assert.equal(run('G.heat.verde'),23);
});

test('saves with numeric chapters continue on the Hakurou branch, which keeps the original jobs',()=>{
  const {run}=game();
  run(`G.chapter=3; delete G.chapterLog; delete G.chapterSince; G.flags.camp2=true; G.board.push({...clone(CAMPAIGN_JOBS.camp3),uid:777,tpl:'camp3',campaign:3});`);
  run('G=migrate(clone(G));'); // ローグライク版は別の保存キーなので、読み替えは migrate を直接確かめる
  assert.equal(run('G.chapter'),'cargo_hakurou');
  assert.equal(run('G.chapterLog.join()'),'handover,cipher,cargo_hakurou');
  assert.equal(run('G.flags.done_cipher===true && G.flags.camp2===undefined && G.flags.ally==="hakurou"'),true);
  assert.equal(run('G.board.find(j=>j.uid===777).campaign'),'cargo_hakurou');
  assert.equal(run('typeof G.chapterSince==="number" && G.awaitChoice===null'),true);
});

test('saves from before branching (cargo / coordinator keys) are renamed onto the Hakurou branch',()=>{
  const {run}=game();
  run(`G.chapter='coordinator'; G.chapterLog=['handover','cipher','cargo','coordinator']; G.flags.done_cipher=true; G.flags.done_cargo=true; G=migrate(clone(G));`);
  assert.equal(run('G.chapter'),'coordinator_hakurou');
  assert.equal(run('G.chapterLog.join()'),'handover,cipher,cargo_hakurou,coordinator_hakurou');
  assert.equal(run('G.flags.done_cargo_hakurou===true && G.flags.done_cargo===undefined && G.flags.ally==="hakurou"'),true);
});
