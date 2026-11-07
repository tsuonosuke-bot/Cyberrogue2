const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(fixed) {
  const math=Object.create(Math);if(fixed!=null)math.random=()=>fixed;
  const c=vm.createContext({console,Math:math,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  for(const f of ['data','engine','world','run','meta','flavor'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'),c);
  return s=>vm.runInContext(s,c);
}

test('a check line carries its skill, role and crit/fumble so the log can narrate it',()=>{
  const run=game(.99); // d10 は10：会心
  run(`newGame(undefined,{first:true});const r=G.runners[0],team={field:[snap(r)],support:[],net:[]};
    const ctx=missionContext({rank:1,district:'harbor',routes:[{field:[S(5,'侵入')],net:[null]}]},0,team,false,true);runMission(ctx);
    const l=ctx.log.find(x=>x.text==='侵入');`);
  assert.equal(run('l.sk==="隠密" && l.role===r.role && l.crit===true && l.kind==="ok"'),true);
  assert.equal(run('typeof Flavor.of(l).text'),'string');
});

test('dice that used to sit in the text are moved to the calc, so hiding dice hides them too',()=>{
  const run=game(.5);
  run(`newGame(undefined,{first:true});const r=G.runners[0],team={field:[snap(r)],support:[],net:[]};
    const ctx=missionContext({rank:1,district:'harbor',routes:[{field:[O('x')],net:[null]}]},0,team,false,true);
    const m=team.field[0];m.hp=1;m.st.BODY=10;hit(ctx,m,5,true);`);
  assert.equal(run('ctx.log.filter(l=>!l.sub).every(l=>!/d10/.test(l.text)) && ctx.log.some(l=>/d10/.test(l.calc))'),true);
  assert.equal(run('ctx.log.find(l=>l.sub&&l.text.includes("被弾")).brief.includes("HP")'),true);
});

test('every skill has narration for success and failure, and every role has lines; the same line always reads the same',()=>{
  const run=game();
  assert.equal(run('Object.keys(SKILL_STAT).every(k=>Flavor.DESC[k]&&Flavor.DESC[k].ok.length&&Flavor.DESC[k].ng.length)'),true);
  assert.equal(run('Object.keys(ROLES).every(k=>Flavor.SAY[k]&&Flavor.SAY[k].ok.length&&Flavor.SAY[k].ng.length)'),true);
  assert.equal(run('Object.keys(SKILL_STAT).every(k=>Flavor.SAY_SK[k]&&Flavor.SAY_SK[k].ok.length&&Flavor.SAY_SK[k].ng.length)'),true);
  // ドライバーが撃つときは、運転のセリフを言わない
  run(`const drv=Flavor.SAY.driver;const lines=[...Array(60)].map((_,i)=>Flavor.of({t:String(i),who:'サエ',text:'通常兵を攻撃',kind:'ok',calc:'x',sk:'射撃',role:'driver',night:1}).text);`);
  assert.equal(run('lines.every(t=>!drv.ok.some(s=>t===`「${s}」`))'),true);
  run(`const line={t:'22:10',who:'サエ',text:'検問',kind:'ok',calc:'x',sk:'運転',role:'driver',night:1};`);
  assert.equal(run('Flavor.of(line).text===Flavor.of({...line}).text'),true);
});
