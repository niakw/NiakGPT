import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const has=(s,t,m=`missing ${t}`)=>{if(!s.includes(t))fail(m);};
const no=(s,t,m=`forbidden ${t}`)=>{if(s.includes(t))fail(m);};

const MAIN=['page-bridge.js','manual-lock-main-v085.js','activity-main-v087.js','hotcache-main-v084.js'];
const ISO=['onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js','commands-v100.js','multitab-v090.js','project-governance-v090.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','coach-v101.js','polish-v090.js','side-panels-v096.js','chronology-v090.js','pin-folders-v096.js','activity-ui-v097.js','retro-loader-v097.js'];
const CSS=['theme-v08.css','polish-v081.css','chronology-v081.css','multitab-v083.css','governance-v085.css','activity-v086.css','control-center-v090.css','core-v090.css','profiles-v100.css','commands-v100.css','onboarding-v100.css','coach-v100.css','pin-folders-v096.css','side-panels-v096.css'];

const m=JSON.parse(read('manifest.json'));
same(m.permissions,['storage','scripting'],'permissions mismatch');
same(m.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
if(m.background?.service_worker!=='background-v100.js')fail('background missing');
const js=m.content_scripts.flatMap(x=>x.js||[]);
same(js,['boot-gate-v100.js'],'Only hydration gate may be statically injected');
const css=m.content_scripts.find(x=>x.css?.includes('theme-v08.css'));
same(css?.css,CSS,'CSS order mismatch');
if(!m.content_scripts.every(x=>x.run_at==='document_start'))fail('Static layers must be document_start');

const bg=read('background-v100.js');
const arr=name=>[...(bg.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(arr('MAIN_RUNTIME'),MAIN,'MAIN runtime mismatch');
same(arr('ISOLATED_RUNTIME'),ISO,'isolated runtime mismatch');
has(bg,'chrome.scripting.executeScript');
has(bg,"injectOne(tabId,frameId,file,'MAIN')");
has(bg,"injectOne(tabId,frameId,file,'ISOLATED')");
has(bg,"niakgpt:inject-runtime-v100");

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true','niakgpt:inject-runtime-v100'])has(gate,token);
no(gate,'document.documentElement.dataset','gate mutates html before hydration');
no(gate,'ng99Sentinel','legacy watchdog mutation present');

const runtime=[...new Set([...MAIN,...ISO,'boot-gate-v100.js','background-v100.js'])];
for(const file of runtime){
  if(!fs.existsSync(file))fail(`missing runtime ${file}`);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}
for(const file of ISO)no(read(file),'setInterval(',`polling in ${file}`);

const app=read('app-v090.js');
for(const token of ['MutationObserver(queueMainNodes)','function bindNavigation()','function renderPins()','data?.cursor ?? data?.next_cursor ?? data?.nextCursor'])has(app,token);
no(app,'function routeTick()');
const gov=read('project-governance-v090.js');
for(const token of ['verifyAndLockManualMove','verifyDestination','buildCleanupPlan','executePlan','unlockChat'])has(gov,token);
const folders=read('pin-folders-v096.js');
for(const token of ['aria-expanded','chatsFor(pid)','ng96-pin-drawer','ng96-project-open'])has(folders,token);
const hot=read('hotcache-main-v084.js');
for(const token of ['MAX_ENTRIES = 5','MAX_TOTAL_BYTES = 96','navigator.locks.request','storeResponseAfterRender'])has(hot,token);

console.log(`NiakGPT ${m.version} hydration-safe runtime invariants: OK`);
