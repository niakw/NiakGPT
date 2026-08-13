import fs from 'node:fs';
// One-shot 0.9.6 Matrix cadence convergence; remove after final certification.
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const old="const mode=document.documentElement.dataset.ng90Matrix||'subtle',active=activity()!=='ready',heavy=document.documentElement.dataset.ng8Heavy==='1';const gap=document.hidden?1200:active?(heavy?900:420):(mode==='normal'?95:180);";
const next="const mode=document.documentElement.dataset.ng90Matrix||'subtle',active=activity()!=='ready',heavy=document.documentElement.dataset.ng8Heavy==='1',client=role()==='client';const gap=document.hidden?5000:active?(heavy?1400:800):client?(mode==='normal'?360:700):(mode==='normal'?130:240);";
if(s.includes(old))s=s.replace(old,next);
if(!s.includes("client?(mode==='normal'?360:700)"))throw new Error('client Matrix cadence not converged');
s=s.replace('S.lastPath=next;resetRouteVisuals();mountObservers();wakeBackground();','S.lastPath=next;resetRouteVisuals();mountObservers();ensureMatrix();wakeBackground();');
if(!s.includes('mountObservers();ensureMatrix();wakeBackground();'))throw new Error('Matrix route remount missing');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('client Matrix cadence'))c=c.replace("// UI animation must stay native; coordination is for idle/background work only.","// Matrix stays visually present but low-frequency, especially on CLIENT tabs.\nhas(app,\"client?(mode==='normal'?360:700)\",'client Matrix cadence must remain low');\nhas(app,'document.hidden?5000','hidden Matrix cadence must remain very low');\nhas(app,'mountObservers();ensureMatrix();wakeBackground();','Matrix must remount only on real route changes');\n\n// UI animation must stay native; coordination is for idle/background work only.");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 Matrix cadence converged');
