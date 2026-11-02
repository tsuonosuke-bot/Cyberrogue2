const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function setup({saved = {}, blocked = false} = {}) {
  const storage = new Map(Object.entries(saved)), tones = [];
  const listeners = [];
  let now = 1000;
  const context = vm.createContext({ console, Math, Date: {now: () => now},
    localStorage: {getItem: k => {if (blocked) throw Error('denied'); return storage.get(k);}, setItem: (k,v) => {if (blocked) throw Error('denied'); storage.set(k,v);}},
    window: {AudioContext: class {
      constructor() {this.state='running';this.currentTime=0;this.destination={};}
      createOscillator() {const note=[];tones.push(note);return {frequency:{setValueAtTime:f=>note.push(f)},connect(){},start(){},stop(){}};}
      createGain() {return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
    }},
    document: {addEventListener: (...args) => listeners.push(args), querySelectorAll: () => []},
    setTimeout, clearTimeout,
  });
  const run = s => vm.runInContext(s, context);
  for (const file of ['js/data.js','js/engine.js','js/world.js']) run(fs.readFileSync(path.join(root,file),'utf8'));
  run(`
    const UI={team:{},est:{}}; let reduced=false; const prefs={speed:'normal'};
    const instantLog=()=>reduced||prefs.speed==='instant';
    G={nextId:1,night:1,runners:[],scouts:[],memorial:[],missions:[],board:[],news:3};World.init(G);
  `);
  run(fs.readFileSync(path.join(root,'js/comfort.js'),'utf8'));
  return {run,storage,tones,listeners,advance:()=>now+=200};
}

test('last dispatch survives persistence, failed dispatch does not overwrite it', () => {
  const {run} = setup();
  assert.equal(run(`
    const a=makeRunner('solo');G.runners.push(a);
    G.board.push({uid:99,req:[],routes:[{}],payout:1000,tags:[]});
    dispatch(99,0,{field:[a.id],support:[],net:[]});
    const previous=JSON.stringify(G.lastTeam);
    dispatch(-1,0,{field:[],support:[],net:[]});
    previous===JSON.stringify(G.lastTeam) && JSON.parse(JSON.stringify(G)).lastTeam.field[0]===a.id;
  `),true);
});
test('usual team removes busy, missing and wrong-lane runners and reports required roles',()=>{
  const {run}=setup();
  assert.equal(run(`
    const a=makeRunner('solo'),b=makeRunner('driver'),c=makeRunner('net');
    G.runners.push(a,b,c);b.status='therapy';
    G.lastTeam={field:[a.id,b.id,9999],support:[],net:[a.id,c.id]};
    const msg=Comfort.restoreTeam({uid:42,req:['driver']});
    UI.team[42].field.length===1 && UI.team[42].net[0]===c.id && /除外/.test(msg) && /必要/.test(msg);
  `),true);
});
test('duplicate and non-net assignments are rejected by normal validation',()=>{
  const {run}=setup();
  assert.equal(run(`
    const a=makeRunner('solo');G.runners.push(a);
    const errors=validateTeam({req:[]},{field:[a.id],support:[],net:[a.id]});
    errors.some(x=>x.includes('複数')) && errors.some(x=>x.includes('ネットランナー'));
  `),true);
});
test('four distinct synthesized cues, persisted opt in and silent instant playback',()=>{
  const {run,tones,storage,advance}=setup();
  assert.equal(run(`Comfort.soundButton().includes('効果音 オフ')`),true);
  run('Comfort.toggleSound()');
  for(const kind of ['ok','ng','dead','goal']) {
    run(`Comfort.tone({classList:{contains:k=>k==='${kind}'},textContent:''})`);advance();
  }
  assert.equal(new Set(tones.map(x=>x.join(','))).size,4);
  run(`prefs.speed='instant';Comfort.tone({classList:{contains:()=>true},textContent:''})`);
  assert.equal(tones.length,4);
  assert.equal(storage.get('fixers-cut-sound'),'on');
});
test('audio opt in survives refresh; unavailable storage and audio never stop play',()=>{
  assert.equal(setup({saved:{'fixers-cut-sound':'on'}}).run(`Comfort.soundButton().includes('効果音 オン')`),true);
  const {run}=setup({blocked:true});
  assert.doesNotThrow(()=>run('window.AudioContext=undefined;Comfort.toggleSound()'));
});

