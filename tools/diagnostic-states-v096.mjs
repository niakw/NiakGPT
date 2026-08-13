import fs from 'node:fs';
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};
const old=`  function diagnosticRows(){\n    const external=window.__NIAKGPT_DIAGNOSTICS__?.snapshot?.()||{};\n    return Object.entries({...S.health,...external});\n  }`;
const next=`  function diagnosticRows(){\n    const external=window.__NIAKGPT_DIAGNOSTICS__?.snapshot?.()||{},merged={...S.health,...external},root=document.documentElement,tabRole=root.dataset.ng8TabRole||'unknown',safe=root.dataset.ng90Safe==='1';\n    if(safe){for(const key of ['projects','data','organizer','pins'])merged[key]='PAUSE · SAFE MODE';}\n    else if(tabRole==='client'){for(const key of ['bridge','projects','data','organizer'])if(/^(ATTENTE|CACHE|INDEX)/i.test(String(merged[key]||'')))merged[key]='DÉLÉGUÉ · WORKER';}\n    if(/^ATTENTE/i.test(String(merged.toc||'')))merged.toc=location.pathname.includes('/c/')?'VIDE · 0 bloc':'INACTIF · hors conversation';\n    return Object.entries(merged);\n  }`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes("merged[key]='DÉLÉGUÉ · WORKER'"),'client delegated diagnostic missing');
must(s.includes("merged[key]='PAUSE · SAFE MODE'"),'safe mode diagnostic missing');
fs.writeFileSync(p,s);

const cp='tools/check-runtime.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes("merged[key]='DÉLÉGUÉ · WORKER'")){
  const marker="has(texts['app-v090.js'],'function diagnosticRows()');";
  must(c.includes(marker),'diagnostic checker anchor missing');
  c=c.replace(marker,`${marker}\nhas(texts['app-v090.js'],\"merged[key]='DÉLÉGUÉ · WORKER'\");\nhas(texts['app-v090.js'],\"merged[key]='PAUSE · SAFE MODE'\");`);
}
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 diagnostics are role-aware');
