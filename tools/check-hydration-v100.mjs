import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js','manual-lock-main-v085.js','activity-main-v087.js','hotcache-main-v084.js'];
const isolated=['onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js','commands-v100.js','multitab-v090.js','project-governance-v090.js','reclassify-v101.js','locale-fr-v101.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','coach-v101.js','polish-v090.js','side-panels-v096.js','chronology-v090.js','pin-folders-v096.js','activity-ui-v097.js','retro-loader-v097.js'];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'only hydration gate may be statically injected');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');
forbid(gate,'ng99Sentinel','legacy watchdog mutation');

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const app=read('app-v090.js');need(app,'MutationObserver(queueMainNodes)');need(app,'function renderPins()');forbid(app,'function routeTick()');
const governance=read('project-governance-v090.js');need(governance,'verifyAndLockManualMove');need(governance,'executePlan');
const reclassify=read('reclassify-v101.js');for(const token of ['QUEUE_NAMES','coreProjectIds','governance:true','BATCH=8','CONFIDENCE=58','canAutomate()','autoResync===false','!p.domOnly'])need(reclassify,token);
const locale=read('locale-fr-v101.js');for(const token of ["['add to project','Ajouter au projet']",'MutationObserver','setTimeout(()=>arm(2200),900)'])need(locale,token);forbid(locale,'setInterval(','French locale adapter must stay event-driven');
const folders=read('pin-folders-v096.js');need(folders,'ng96-pin-drawer');need(folders,'ng96-project-open');
const hot=read('hotcache-main-v084.js');need(hot,'MAX_ENTRIES = 5');need(hot,'MAX_TOTAL_BYTES = 96');

console.log(`NiakGPT ${manifest.version} hydration-safe release invariants: OK`);
