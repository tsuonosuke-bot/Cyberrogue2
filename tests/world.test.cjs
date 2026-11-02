const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function game() {
  const ctx = vm.createContext({ console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  for (const file of ['data','engine','world','run']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file+'.js'), 'utf8'),ctx);
  vm.runInContext('newGame(); G.news=3; G.conditions={};',ctx);
  return code => vm.runInContext(code,ctx);
}
test('all templates and generated deserter jobs have districts independent of rank',()=>{
  const run=game();
  assert.equal(run('[...JOBS,...Object.values(INTRO_JOBS),...Object.values(CAMPAIGN_JOBS)].every(j=>World.districts[j.district])'),true);
  assert.equal(run('JOBS.find(j=>j.id==="r1_cargo").district'),'harbor');
  assert.equal(run('World.prepareJob({rank:3,deserter:true}).district'),'street');
});
test('personal quests require exclusive loyalty70, cannot repeat, expire with departure',()=>{
  const run=game();
  run('G.runners=[]; const r=makeStory("yoru"); G.runners.push(r); r.loyalty=70; World.refreshBoard();');
  assert.equal(run('G.board.some(j=>j.personal)'),false);
  run('r.contract="exclusive"; World.refreshBoard(); World.refreshBoard();');
  assert.equal(run('G.board.filter(j=>j.personal).length'),1);
  assert.equal(run('G.personalNotices[0]'),'yoru');
  run('const q=G.board.find(j=>j.personal); G.night=q.expires; const out={events:[]}; World.afterNight(out,new Set());');
  assert.equal(run('G.runners.length'),0);
  assert.equal(run('out.events.some(e=>e.text.includes("期限切れ"))'),true);
});
test('personal success coexists with role perk and failure costs loyalty',()=>{
  const run=game();
  run('const r=makeStory("haruka"); G.runners.push(r); r.perk=true; r.loyalty=80; const s={notes:[]}; const ms={job:{personal:"haruka",runnerId:r.id,client:"resident",target:"gang",district:"street"},result:{success:true,log:[]}}; World.settle(ms,s,{});');
  assert.equal(run('r.perk && r.storyPerk==="haruka"'),true);
  assert.equal(run('G.gangRelation'),-15);
  run('ms.result.success=false; World.settle(ms,s,{});');
  assert.equal(run('r.loyalty'),50);
});
test('tiered upgrades are affordable, stack, charge upkeep and stop at max',()=>{
  const run=game();
  assert.equal(run('Object.keys(World.upgrades).length>=8 && Object.values(World.upgrades).every(u=>u.levels.every(l=>l.cost<=10000))'),true);
  run('delete G.run; G.money=100000; World.buyUpgrade("medical"); World.buyUpgrade("network"); World.buyUpgrade("bunks");'); // 設備はキャンペーン版だけ
  assert.equal(run('World.therapyNights()'),2);
  assert.equal(run('World.upkeep().reduce((n,r)=>n+r[1],0)'),80);
  assert.equal(run('World.recoveryBonus()'),4);
  assert.equal(run('World.buyUpgrade("network")'),null);
  assert.equal(run('World.level("network")'),2);
  assert.equal(run('World.upkeep().reduce((n,r)=>n+r[1],0)'),120);
  assert.equal(run('World.buyUpgrade("network")'),'購入済みです');
  run('G.upgrades.armory=true; World.init(G);');
  assert.equal(run('G.upgrades.armory===1 && World.gearMultiplier()===.8'),true);
});
test('training grows the main skill of idle runners overnight',()=>{
  const run=game();
  run('G.money=100000; World.buyUpgrade("training"); const r=G.runners[0]; r.status="idle"; const before=r.skills["射撃"]; r.xp={射撃:xpNeed(before)-1}; const out={events:[]}; World.afterNight(out,new Set());');
  assert.equal(run('r.skills["射撃"]===before+1 && out.events.some(e=>e.text.includes("訓練"))'),true);
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
test('gang benefit, hostile interference and security prevent harassment',()=>{
  const run=game();
  run('G.gangRelation=35');
  assert.equal(run('World.intelMultiplier({district:"street"})'),.5);
  run('G.gangRelation=-40; const ctx={job:{district:"street"},mods:{extraEnemy:0},sim:true}; World.context(ctx);');
  assert.equal(run('ctx.mods.extraEnemy'),1);
  run('G.night=3; G.upgrades.security=true; const out={events:[]}; const before=G.money; World.beforeNight(out);');
  assert.equal(run('G.money'),run('before'));
  assert.equal(run('out.events.some(e=>e.text.includes("防いだ"))'),true);
});
test('rival job stealing excludes specials and poaching names the rival',()=>{
  const run=game();
  // Rivals only take jobs that outlive tonight; pin expiry so random board timing cannot leave nothing to take.
  run('delete G.run; refreshBoard(); G.night=3; G.board.forEach(j=>j.expires=10); const out={events:[]}; World.beforeNight(out);'); // 横取りはキャンペーン版の依頼盤だけ
  assert.equal(run('out.events.some(e=>e.text.includes("引き受けた"))'),true);
  assert.equal(run('const rivalName=World.poached(G.runners[0]); Object.values(World.rivals).some(r=>r.name===rivalName)'),true);
  run('G.night=4; G.rank=2; World.refreshBoard();');
  assert.equal(run('G.board.some(j=>j.rival)'),true);
});
test('personal dispatch validates the named runner and perks affect rolls separately',()=>{
  const run=game();
  run('const r=makeStory("yoru"); G.runners.push(r); r.contract="exclusive"; r.loyalty=70; World.refreshBoard(); const j=G.board.find(j=>j.personal);');
  assert.equal(run('validateTeam(j,{field:[G.runners[0].id],support:[],net:[]}).some(e=>e.includes("本人"))'),true);
  run('r.storyPerk="yoru"; const ctx={job:j,worldConditions:{news:null,condition:null}};');
  assert.equal(run('World.checkBonus(ctx,snap(r),"射撃")'),2);
});
test('news transport payout is previewed and locked at dispatch',()=>{
  const run=game();
  run('G.news=1; const j=addJob(JOBS.find(j=>j.id==="r1_delivery"),false); const t={field:[G.runners[0].id],support:[],net:[]}; const p=payPreview(j,t);');
  assert.equal(run('p.fee'),480);
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
