const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// fixed を渡すと乱数はその値に固定（d10 は 0.5 で6）。省くと種から決まる
function game({bg='solo',opt={},fixed=null,seed=1}={}) {
  const storage=new Map();
  const math=Object.create(Math);
  math.random=()=>{if(fixed!==null)return fixed;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const c=vm.createContext({console,Math:math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const run=s=>vm.runInContext(s,c);
  for(const f of ['data','engine','world','run','meta'])run(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));
  run(`newGame(${JSON.stringify(bg)},${JSON.stringify(opt)});G.storyQueue=[];G.news=2;G.conditions={};G.gangRelation=${bg==='gang'?30:0};`);
  // 能力値と技能を直接決めた隊員（snap）。st と sk は判定にそのまま使われる
  run(`function who(role,st={},sk={}){const r=makeRunner(role,{trait:null});G.runners.push(r);const m=snap(r);
    for(const k of STATS)m.st[k]=st[k]??5;for(const k of SKILLS)m.sk[k]=sk[k]??0;m.hp=m.maxHp=99;m.armor=m.armorMax=0;return m;}
    function fight(rank,field,team){const j={rank,district:'harbor',intel:true,tags:[],routes:[{field,net:field.map(()=>null)}]};
      const ctx=missionContext(j,0,team,false);runMission(ctx);return ctx;}
    const said=(ctx,t)=>ctx.log.filter(l=>l.text.includes(t)).length;`);
  return run;
}

/* ───────── 前歴 ───────── */

test('the starting crew is random but always has a netrunner and a fighter; the first run is the fixed crew',()=>{
  for (const bg of ['solo','net','ripper','corp','gang']) for (let seed=1; seed<=40; seed++) {
    const run=game({bg,seed});
    const roles=run('G.runners.map(r=>r.role)');
    assert.equal(roles.length,3,bg);
    assert.ok(roles.includes('net') && roles.some(r=>['solo','driver'].includes(r)),`${bg} seed ${seed}: ${roles}`);
    assert.equal(run('G.runners.every(r=>r.trait===null) && G.money'),3000,bg);
    assert.equal(run('G.run.bg+G.run.rerolls'),bg+'1');
  }
  const run=game({bg:'patchwork',opt:{roles:['med','med','tech']}});
  assert.equal(run('G.runners.map(r=>r.role).join()+"|"+G.money+"|"+G.run.rerolls'),'med,med,tech|1500|1');
  assert.equal(run('Run.canReroll()'),false); // 寄せ集めは自分で選んだので引き直さない
  const first=game({opt:{first:true}});
  assert.equal(first('G.runners.map(r=>r.name+":"+r.role).slice(0,2).join()+"|"+G.runners[2].role+"|"+G.run.rerolls'),'ジロウ:solo,サエ:driver|net|0');
});

test('the starting crew can be rerolled once, only before the first destination',()=>{
  const run=game({bg:'net',seed:5});
  run('var before=G.runners.map(r=>r.id).join();');
  assert.equal(run('Run.rerollCrew()'),null);
  assert.equal(run('G.runners.length===3 && G.runners.map(r=>r.id).join()!==before && G.run.rerolls===0'),true);
  assert.equal(run('Run.rerollCrew()'),'今は引き直せません');
  const later=game({bg:'net',seed:6});
  later('G.run.map[1]=[{type:"hideout"}]; Run.choose(0);');
  assert.equal(later('Run.rerollCrew()'),'今は引き直せません');
});

test('元ソロ: +1 to shooting only in the first round of a fight',()=>{
  const run=game({fixed:.5});
  run(`const m=who('solo',{REF:1});const ctx=fight(1,[C(3,'見張り')],{field:[m],support:[],net:[]});
    const shots=ctx.log.filter(l=>l.text.includes('を攻撃'));`);
  assert.equal(run('shots.length'),3);
  assert.equal(run('shots[0].calc.includes("元ソロの勘 1") && !shots[1].calc.includes("元ソロの勘")'),true);
  const other=game({bg:'net',fixed:.5});
  other(`const m=who('solo',{REF:1});const ctx=fight(1,[C(3,'見張り')],{field:[m],support:[],net:[]});`);
  assert.equal(other('ctx.log.some(l=>l.calc.includes("元ソロの勘"))'),false);
});

test('元ネットランナー: one free intel at the start of every act',()=>{
  const run=game({bg:'net'});
  assert.equal(run('G.vouchers.intel'),1);
  run(`G.run.act=1;G.run.slot=Run.BOSS_SLOT;Run.nextNight({settle:[{runBoss:true,success:true}],events:[],story:[]});`);
  assert.equal(run('G.run.act===2 && G.vouchers.intel'),2);
});

test('闇医者のツテ: implants cost one less humanity, never below one',()=>{
  const run=game({bg:'ripper'});
  assert.equal(run('hlCost(G.runners[0],"ears")'),CYBER_HL('ears')-1);
  assert.equal(game()('hlCost(G.runners[0],"ears")'),CYBER_HL('ears'));
  function CYBER_HL(id){return Number(game()(`CYBER.${id}.hl`));}
});

test('企業の元社員: heat −15 for the chosen company, +10 for the rest, and the branch is fixed',()=>{
  const run=game({bg:'corp',opt:{corp:'verde'}});
  assert.equal(run('JSON.stringify(G.heat)'),JSON.stringify({mitsukane:15,verde:0,hakurou:15}));
  run(`G.awaitChoice='cipher';`);
  assert.equal(run('chooseBranch(0)'),'ヴェルデと組むことは、始めから決まっています');
  assert.equal(run('chooseBranch(1)===null && G.flags.ally'),'verde');
});

test('白蛇会の身内: starts at +30 with the gang; alley candidates often come chromed and frayed',()=>{
  let gang=0, plain=0;
  for (let seed=1; seed<=30; seed++) {
    for (const bg of ['gang','solo']) {
      const run=game({bg,seed});
      if (bg==='gang') assert.equal(run('G.gangRelation'),30);
      run(`G.run.map[1]=[{type:'alley'}];Run.choose(0);`);
      const n=Number(run('G.scouts.filter(r=>!r.story&&r.cyber.length).length'));
      if (bg==='gang') gang+=n; else plain+=n;
      if (bg==='gang') assert.equal(run('G.scouts.every(r=>r.humanity>15 && r.cyber.every(c=>CYBER[c].tier===1))'),true);
    }
  }
  assert.ok(gang>30 && plain===0,`chromed candidates: gang ${gang}, solo ${plain}`);
});

test('寄せ集め: rewards offer two options instead of three',()=>{
  const run=game({bg:'patchwork',opt:{roles:['solo','net','driver']}});
  assert.equal(run(`Run.makeReward({title:'t',nights:1}).opts.length`),2);
});

/* ───────── 幕のボス ───────── */

test('big jobs follow the act and the ally, at the act’s rank',()=>{
  const run=game();
  assert.equal(run('Run.bossJob().id+"|"+Run.bossJob().rank'),'run_denki|1');
  run(`G.run.act=2;G.flags.ally='verde';`);
  assert.equal(run('Run.bossJob().id+"|"+Run.bossJob().boss'),'run_cargo_verde|kaname');
  run(`G.run.act=3;`);
  assert.equal(run('Run.bossJob().id+"|"+Run.bossJob().boss'),'run_box_verde|subject');
  assert.equal(run(`Object.values(RUN_JOBS).every(j=>RUN_BOSSES[j.boss]&&CHAPTERS[j.campaign]&&j.routes.every(r=>r.field.some(p=>p&&p.t==='boss'&&p.boss===j.boss)))`),true);
});

test('電気屋: hidden from the field unless found; the netrunner burns him down',()=>{
  const run=game({fixed:.5});
  run(`const ctx=fight(1,[BS('denki','店')],{field:[who('solo',{REF:10,INT:1},{射撃:10,回避:20})],support:[],net:[who('net',{INT:10},{インターフェース:10})]});`);
  assert.equal(run('said(ctx,"見つからない")'),1);
  assert.equal(run('said(ctx,"電気屋を攻撃")'),0);
  assert.equal(run('said(ctx,"電気屋の回線を焼く")'),2);
  assert.equal(run('ctx.bossDown && !ctx.aborted && ctx.bossLeft'),0);
});

test('電気屋: with the gang at +30, a talk turns the fight into a 1,000cr deal',()=>{
  const run=game({bg:'gang',fixed:.5});
  run(`const ctx=fight(1,[BS('denki','店')],{field:[who('solo',{COOL:10},{説得:10})],support:[],net:[]});`);
  assert.equal(run('said(ctx,"話がついた") && !ctx.bossDown && !ctx.aborted'),true);
  assert.equal(run('JSON.stringify(ctx.costs)'),JSON.stringify([['電気屋との取引',-1000]]));
});

test('カナメ: not beaten in two rounds, she takes a goal; a successful chase and drive bring it back',()=>{
  const run=game({fixed:.5});
  // 射撃 REF7+射撃6+d10(6)=19：カナメ（DV21）には届かず、追手（DV19）には届く（第1幕の上乗せ+1込み）
  run(`const ctx=fight(2,[O('名簿'),BS('kaname','待ち伏せ'),E(15,'離脱')],{field:[who('solo',{REF:7,INT:10},{射撃:6,回避:20,知覚:10})],support:[who('driver',{REF:10},{運転:10,回避:20})],net:[]});`);
  assert.equal(run('said(ctx,"目標を1つ持ち去った")'),1);
  assert.equal(run('said(ctx,"カナメを攻撃")'),2);
  assert.equal(run('said(ctx,"取り返した")'),1);
  assert.equal(run('ctx.success && ctx.bossLeft===3 && !ctx.bossDown'),true);
});

test('鋼の番犬: armour halves each hit without a tech; the commander adds +1 to the others',()=>{
  const shots=(tech)=>{
    const run=game({fixed:.5});
    run(`const sh=()=>who('solo',{REF:10},{射撃:10});const ctx=fight(3,[BS('hound','甲板')],{field:[sh(),sh()],support:${tech?"[who('tech')]":'[]'},net:[]});`);
    return run('JSON.stringify([said(ctx,"鋼の番犬を攻撃"),ctx.bossDown,ctx.log.some(l=>l.text.includes("ミツカネの警備兵の攻撃")&&l.calc.endsWith("DV22"))])');
  };
  assert.equal(shots(false),JSON.stringify([5,true,true])); // 耐久5を1ずつ // 警備兵の攻撃21（第3幕の基準18＋装甲兵2＋第1幕の上乗せ1）＋指揮官1
  assert.equal(shots(true),JSON.stringify([3,true,true])); // テックがいれば1発で2
});

test('被検体: a talk at DV18 ends it without a shot, and the run remembers it',()=>{
  const run=game({fixed:.5});
  run(`const ctx=fight(3,[BS('subject','病室')],{field:[who('med',{COOL:10},{説得:10})],support:[],net:[]});`);
  assert.equal(run('ctx.spared && !ctx.aborted && said(ctx,"を攻撃")===0'),true);
  run(`const j=addJob(clone(RUN_JOBS.run_box_verde),true);G.board=[];
    settle({job:j,routeIdx:0,result:{success:true,reason:'',members:[],heat:{},lazarus:[],rewardMult:1,log:[],xp:{},credit:{},spared:true}},{story:[],touched:{}});`);
  assert.equal(run('G.flags.spared'),true);
});

test('保守主任: three layers of black ICE, a physical cut as the fallback, one more layer at danger 5',()=>{
  const net=game({fixed:.5});
  net(`const ctx=fight(3,[BS('keeper','回線')],{field:[who('solo')],support:[],net:[who('net',{INT:10},{インターフェース:10})]});`);
  assert.equal(net('said(ctx,"黒ICE 第")+"|"+ctx.bossDown'),'3|true');
  const cut=game({fixed:.5});
  cut(`const ctx=fight(3,[BS('keeper','回線')],{field:[who('solo')],support:[who('tech',{TECH:10},{電子:10})],net:[who('net',{INT:1})]});`);
  assert.equal(cut('said(ctx,"黒ICE 第1層")+"|"+said(ctx,"黒ICEの逆流")+"|"+said(ctx,"物理的に切る")+"|"+ctx.bossDown'),'1|1|1|true');
  const hard=game({fixed:.5});
  hard(`G.run.danger=5;const ctx=fight(3,[BS('keeper','回線')],{field:[who('solo')],support:[],net:[who('net',{INT:10},{インターフェース:10})]});`);
  assert.equal(hard('said(ctx,"残り4層")'),1);
  assert.equal(game({fixed:.5})(`bossHits(RUN_BOSSES.keeper)`),3);
});

test('a failed big job ends the run at once — there is no retry',()=>{
  const run=game();
  run(`G.run.slot=Run.BOSS_SLOT;G.run.tonight={type:'boss'};G.board=[];Run.nextNight({settle:[{runBoss:true,success:false,bossLeft:1}],events:[],story:[]});`);
  assert.equal(run('G.ended && G.ended.type'),'boss');
});

test('a beaten boss drops its item into the reward; a boss that was not beaten does not',()=>{
  const run=game();
  run(`G.runners.push(makeRunner('net'));const j=clone(RUN_JOBS.run_denki);j.runBoss=true;`);
  assert.equal(run(`Run.makeReward(j,{bossDown:true}).opts.some(o=>o.id==='denkiDeck'&&o.drop==='denki'&&o.rare)`),true);
  assert.equal(run(`Run.makeReward(j,{bossDown:false}).opts.some(o=>o.id==='denkiDeck')`),false);
});
