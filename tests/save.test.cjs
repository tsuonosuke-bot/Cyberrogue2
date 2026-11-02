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
  return {run,storage};
}

test('a save that fails to load is kept, reported, and backed up before a new game replaces it',()=>{
  const {run,storage}=game();
  storage.set('fixers-cut-run-v1','{"v":1,"broken":');
  assert.equal(run('loadSave()'),null);
  assert.equal(run('typeof loadError==="string" && loadError.length>0'),true);
  assert.equal(storage.get('fixers-cut-run-v1'),'{"v":1,"broken":'); // untouched
  run('clearSave()');
  assert.equal(storage.has('fixers-cut-run-v1'),false);
  assert.equal(storage.get('fixers-cut-run-v1-backup'),'{"v":1,"broken":');
});

test('no save is not an error',()=>{
  const {run}=game();
  assert.equal(run('loadSave()'),null);
  assert.equal(run('loadError'),null);
});

test('a save stripped of every field added since the first release still loads and plays a night',()=>{
  const {run}=game();
  run(`newGame(); G.storyQueue=[]; const r=G.runners[0];
    for(const x of [...G.runners,...G.scouts]){ delete x.gear; delete x.xp; delete x.trait; delete x.gender; delete x.perkUses; }
    G.chapter=2; delete G.chapterLog; delete G.chapterSince; delete G.awaitChoice; delete G.upgrades; delete G.rumor; delete G.lastTeam;
    save(); G=null; G=loadSave();`);
  assert.equal(run('G.chapter==="cipher" && G.runners.every(r=>r.gear&&r.xp&&r.trait===null&&r.gender) && maxHum(G.runners[0])>0'),true);
  assert.equal(run('endNight()!==null && G.night'),2);
});
