const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function game() {
  const ctx = vm.createContext({ console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  for (const file of ['data','engine','world','run','meta']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file+'.js'), 'utf8'),ctx);
  vm.runInContext('newGame(undefined,{first:true}); G.news=3; G.conditions={};',ctx);
  return code => vm.runInContext(code,ctx);
}
test('all templates and generated deserter jobs have districts independent of rank',()=>{
  const run=game();
  assert.equal(run('[...JOBS,...Object.values(RUN_JOBS)].every(j=>World.districts[j.district])'),true);
  assert.equal(run('JOBS.find(j=>j.id==="r1_cargo").district'),'harbor');
  assert.equal(run('World.prepareJob({rank:3,deserter:true}).district'),'street');
});
test('news has at least10 effects, shared conditions modifiers and discounts expire',()=>{
  const run=game();
  assert.equal(run('World.news.length>=10'),true);
  run('G.news=0; G.conditions.harbor={skill:"隠密",bonus:-2,until:3}; const j={district:"harbor",target:"verde"}; const ctx={job:j,mods:{extraEnemy:0},sim:true,log:[]}; World.context(ctx);');
  assert.equal(run('World.checkBonus(ctx,{id:999},"隠密")'),-4);
  run('G.news=2');
  assert.equal(run('World.priceMultiplier()'),.8);
  run('G.news=3');
  assert.equal(run('World.priceMultiplier()'),1);
});
test('gang benefit, hostile interference and harassment',()=>{
  const run=game();
  run('G.gangRelation=35');
  assert.equal(run('World.intelMultiplier({district:"street"})'),.5);
  run('G.gangRelation=-40; const ctx={job:{district:"street"},mods:{extraEnemy:0},sim:true}; World.context(ctx);');
  assert.equal(run('ctx.mods.extraEnemy'),1);
  run('G.night=3; const out={events:[]}; const before=G.money; World.beforeNight(out);');
  assert.equal(run('before-G.money'),250);
});
test('news transport payout is previewed and locked at dispatch',()=>{
  const run=game();
  run('G.news=1; const j=addJob(JOBS.find(j=>j.id==="r1_delivery"),false); const t={field:[G.runners[0].id],support:[],net:[]}; const p=payPreview(j,t);');
  assert.equal(run('p.payout===2400 && p.total===2400'),true); // 運搬の報酬+20%
  run('dispatch(j.uid,0,t); G.news=3;');
  assert.equal(run('G.missions[0].job.payout'),2400);
});
test('news chip names the effect and appears only when a visible phase rolls that skill',()=>{
  const run=game();
  run(`const idx=t=>World.news.findIndex(n=>n.text.includes(t));
    const ice=addJob({id:'n1',title:'ICEあり',client:'resident',target:null,rank:1,district:'street',tags:['operation'],req:[],payout:1000,cred:1,heat:0,nights:1,routes:[{name:'a',field:[S(15,'x'),_,_,_,O('y')],net:[I(15,'z','data'),_,_,_,_]},{name:'b',field:[S(15,'x'),_,_,_,O('y')],net:N5()}]},false);
    const plain=addJob({id:'n2',title:'ICEなし',client:'resident',target:null,rank:1,district:'street',tags:['operation'],req:[],payout:1000,cred:1,heat:0,nights:1,routes:[{name:'a',field:[S(15,'x'),_,_,_,O('y')],net:N5()}]},false);
    G.news=idx('大規模障害');`);
  assert.equal(run('World.newsEffects(plain).length'),0);
  assert.equal(run('World.newsEffects(ice).map(f=>f.text).join()'),'インターフェース+1');
  assert.equal(run('World.newsEffects(ice,1).length'),0); // the selected route has no ICE
  run('var esc=s=>String(s);'); // jobBadge escapes with ui.js's helper
  assert.match(run('World.jobBadge(ice)'),/ニュース：インターフェース\+1/);
  run(`G.news=idx('湾岸道路で事故'); const cargo=addJob(JOBS.find(j=>j.id==='r1_cargo'),false); ice.tags=['operation'];`);
  assert.equal(run('World.newsEffects(cargo,1).map(f=>f.text).join()'),'報酬+20%,運転−2'); // the canal route drives
  run(`const delivery=addJob(JOBS.find(j=>j.id==='r1_delivery'),false);`);
  assert.equal(run('World.newsEffects(delivery,1).map(f=>f.text).join()'),'報酬+20%'); // back alleys: no driving
  assert.equal(run('World.newsEffects(plain).length'),0); // no driving phase
  run(`G.news=idx('港湾労組'); const hidden=addJob({id:'n3',title:'隠し',client:'resident',target:null,rank:1,district:'harbor',tags:['operation'],req:[],payout:1000,cred:1,heat:0,nights:1,routes:[{name:'a',field:[H(S(15,'x')),_,_,_,O('y')],net:N5()}]},false);`);
  assert.equal(run('World.newsEffects(hidden).length'),0); // unrevealed phases do not leak through the chip
  assert.equal(run('hidden.intel=true; World.newsEffects(hidden)[0].good'),false);
});
