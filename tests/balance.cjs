// Reproducible neutral baseline: midpoint role stats/skills, no cyberware or perks,
// required roles plus two full-health solos; purchased intel; no district/news buff.
const fs = require('node:fs'), vm = require('node:vm'), path=require('node:path');
let seed=20261102;
const math=Object.create(Math);
math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
const ctx=vm.createContext({console,Math:math,localStorage:{getItem(){return null;},setItem(){},removeItem(){}}});
for(const f of ['data','engine','world','run'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'),ctx);
vm.runInContext(`
newGame(); G.news=2; G.conditions={}; G.gangRelation=0;
const rows=[];
for(const j of JOBS.filter(j=>j.rank===2)) {
  G.runners=[];
  const team={field:[],support:[],net:[]};
  for(const role of [...j.req,'solo','solo']) {
    const R=ROLES[role], base={}, skills={};
    for(const k of STATS)base[k]=Math.round((R.base[k][0]+R.base[k][1])/2);
    for(const k of SKILLS)skills[k]=R.skills[k]?Math.round((R.skills[k][0]+R.skills[k][1])/2):0;
    const r=makeRunner(role,{base,skills,origin:'drifter'}); G.runners.push(r);
    const lane=role==='net'?'net':role==='driver'?'support':'field'; team[lane].push(r.id);
  }
  j.intel=true;
  for(let route=0;route<j.routes.length;route++) { const e=estimate(j,route,team,5000); rows.push({job:j.id,route:j.routes[route].name,p:+(e.p*100).toFixed(1),death:+(e.death*100).toFixed(1)}); }
}
console.table(rows);
if (rows.some(r=>r.p<70||r.p>85)) throw new Error('Rank-two neutral baseline must remain between 70% and 85% for every route');
if (!rows.some(r=>r.death>0)) throw new Error('Rank-two baseline should retain meaningful danger');
`,ctx);
