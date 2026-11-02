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
  run('newGame();G.money=50000;G.news=3;G.conditions={};G.board=[];');
  return run;
}
const ctxOf=`(team)=>({sim:false,all:[...team.field,...team.support,...team.net],team,job:{district:'harbor'},worldConditions:{news:null,condition:null},log:[],checks:{},xp:{},credit:{},clock:0,lazarus:[],mods:{extraEnemy:0},interactive:false})`;

test('every new implant, gear and story runner is fully defined',()=>{
  const run=game();
  assert.equal(run(`['reflex','milplate','tacai','firewall','heart','chameleon','emochip'].every(k=>CYBER[k]&&CYBER[k].loan&&CYBER[k].hl>0)`),true);
  assert.equal(run(`Object.values(ROLE_CYBER).flat().every(k=>CYBER[k])`),true);
  assert.equal(run(`Object.values(GEAR).every(g=>GEAR_SLOTS[g.slot]&&g.price>0&&g.roles.every(r=>ROLES[r]))`),true);
  assert.equal(run(`['shigure','mikoto'].every(k=>{const r=makeStory(k);return r.story===k&&r.bio&&World.perks[k];})`),true);
});

test('random runners get an origin-based background line',()=>{
  const run=game();
  assert.equal(run(`const r=makeRunner('solo',{origin:'street'}); BIOS.street.past.some(p=>r.bio.startsWith(p))`),true);
});

test('artificial heart adds two to the death save; neural firewall blocks black ICE',()=>{
  const run=game(.5); // d10 always 6
  run(`const r=G.runners[0]; r.base.BODY=5; r.cyber=['heart']; const m=snap(r); m.st.BODY=5; const ctx=(${ctxOf})({field:[m],support:[],net:[]}); deathSave(ctx,m);`);
  assert.equal(run('m.down && !m.dead && ctx.credit[m.id+"|"+CYBER.heart.name]===1'),true); // 6 < 5+1? no: 6 < 5+2 thanks to heart
  run(`const n=makeRunner('net'); n.cyber=['firewall']; G.runners.push(n); const nm=snap(n); const c2=(${ctxOf})({field:[],support:[],net:[nm]}); const hp=nm.hp; iceHit(c2,nm,10);`);
  assert.equal(run('nm.hp===hp'),true);
  run(`n.cyber=[]; n.gear={body:'icehood'}; const gm=snap(n); const c3=(${ctxOf})({field:[],support:[],net:[gm]}); const hp3=gm.hp; iceHit(c3,gm,10);`);
  assert.equal(run('hp3-gm.hp'),5);
});

test('interludes play once each, at most one per night, in priority order',()=>{
  const run=game();
  run(`G.flags.anyCyber=true; G.memorial.push({name:'テツ',role:'solo',night:1,cause:'x',jobs:0}); const o1={story:[]}; interlude(o1); const o2={story:[]}; interlude(o2); const o3={story:[]}; interlude(o3);`);
  assert.deepEqual(run('JSON.stringify([o1.story,o2.story,o3.story])'),JSON.stringify([['firstCyber'],['firstDeath'],[]]));
  assert.equal(run(`Object.keys(INTERLUDES).every(k=>INTERLUDE_WHEN[k]&&INTERLUDES[k].title.startsWith('幕間　'))`),true);
});

test('nightly rumor is set and can reflect the fallen',()=>{
  const run=game(.1);
  run(`G.memorial.push({name:'ナギ',role:'solo',night:1,cause:'x',jobs:0}); World.nextNight();`);
  assert.equal(run('typeof G.rumor==="string" && G.rumor.length>0'),true);
});

test('new personal quests appear for loyal exclusive story runners and need them on the team',()=>{
  const run=game();
  run(`const s=makeStory('shigure'); G.runners.push(s); s.contract='exclusive'; s.loyalty=80; World.refreshBoard(); const j=G.board.find(j=>j.personal==='shigure');`);
  assert.equal(run('!!j && j.rival==="kurogane" && j.target===null'),true);
  assert.equal(run('validateTeam(j,{field:[G.runners[0].id],support:[],net:[]}).some(e=>e.includes("本人"))'),true);
});

test('implant table: every entry has a category, lines point at a lower base model, borrowed looks exist',()=>{
  const run=game();
  assert.equal(run(`Object.entries(CYBER).every(([k,c])=>CYBER_CATS[c.cat]&&c.tier>=1&&(!c.line||(CYBER[c.line]&&CYBER[c.line].tier<c.tier&&!CYBER[c.line].line))&&(!c.look||CYBER[c.look]))`),true);
  assert.equal(run(`Object.keys(CYBER_CATS).every(k=>Object.values(CYBER).some(c=>c.cat===k&&c.tier>=2))`),true);
  assert.equal(run(`Object.values(CYBER).filter(c=>c.tier>=2).every(c=>c.hl>CYBER[c.line].hl)`),true);
});

test('a higher model replaces the lower one and costs only the humanity difference; downgrades are refused',()=>{
  const run=game();
  run(`const r=G.runners[0]; r.contract='exclusive'; r.cyber=[]; r.humanity=maxHum(r); const h0=r.humanity; buyCyber(r,'optics','cash'); const h1=r.humanity; buyCyber(r,'optics2','cash');`);
  assert.equal(run('r.cyber.join()'),'optics2');
  assert.equal(run('h0-h1===CYBER.optics.hl && h1-r.humanity===CYBER.optics2.hl-CYBER.optics.hl'),true);
  assert.match(run(`buyCyber(r,'optics','cash')`),/上位モデル/);
  run(`buyCyber(r,'plating','cash'); const am=armorMax(r); r.armor=am-2; buyCyber(r,'milplate','cash');`);
  assert.equal(run('r.cyber.includes("milplate") && !r.cyber.includes("plating") && r.armor===armorMax(r)-2'),true);
});

test('rare traits: anomaly caps humanity at 150 and halves implant cost; prodigy learns faster; odds roll from the table',()=>{
  const run=game();
  run(`const a=makeRunner('solo',{trait:'anomaly',cyber:['reflex']}); const t=makeRunner('solo',{trait:'tolerant'}); const p=makeRunner('net',{trait:'prodigy'});`);
  assert.equal(run('maxHum(a)'),150);
  assert.equal(run('a.humanity'),150-Math.round(12*0.5));
  assert.equal(run('maxHum(t)===t.base.EMP*10+30 && hlCost(t,"reflex")===9'),true);
  assert.equal(run('xpNeed(6,p)===5 && xpNeed(6)===7 && xpNeed(0)===2'),true);
  assert.equal(run('demand(a)>demand(makeRunner("solo",{trait:null,base:a.base,skills:a.skills,origin:a.origin}))'),true);
  for (const [v,want] of [[.01,'anomaly'],[.05,'tolerant'],[.15,'prodigy'],[.5,null]]) assert.equal(game(v)(`makeRunner('solo').trait`),want);
  assert.equal(run(`makeStory('kagerou').trait===null && makeStory('yoru').trait==='tolerant' && G.runners.every(r=>r.trait===null)`),true);
});

test('saves that stacked two models of one line keep only the highest; second-tier heart adds three',()=>{
  const run=game(.5);
  run(`const r=G.runners[0]; r.cyber=['synapse','reflex','plating','milplate','arm']; delete r.trait; migrate(G);`);
  assert.equal(run('r.cyber.join()'),'reflex,milplate,arm');
  assert.equal(run('r.trait'),null);
  run(`r.cyber=['heart2']; const m=snap(r); m.st.BODY=4; const ctx=(${ctxOf})({field:[m],support:[],net:[]}); deathSave(ctx,m);`);
  assert.equal(run('m.down && !m.dead && ctx.credit[m.id+"|"+CYBER.heart2.name]===1'),true); // d10=6 < 4+3
});
