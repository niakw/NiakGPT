import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js'];
const isolated=[
  'onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js',
  'runtime-integrity-v101.js','cache-guardian-v100.js','recovery-v100.js','server-index-v100.js','commands-v100.js',
  'multitab-v090.js','project-governance-v090.js','governance-queue-v101.js','reclassify-v101.js','manual-lock-main-v085.js',
  'locale-fr-v101.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','breadcrumb-v100.js','continuity-v100.js',
  'visual-stability-v101.js','coach-v101.js','polish-v090.js','side-panels-v096.js','chronology-v090.js','pin-folders-v096.js',
  'activity-ui-v097.js','retro-loader-v097.js'
];
const retired=['hotcache-main-v084.js','hotcache-ui-v097.js','hotcache-v084.js','activity-main-v087.js'];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');
if(manifest.version!=='0.9.52')fail(`unexpected release ${manifest.version}`);
for(const entry of manifest.content_scripts||[])for(const file of [...(entry.js||[]),...(entry.css||[])])if(!fs.existsSync(file))fail(`missing manifest runtime ${file}`);
forbid(JSON.stringify(manifest),'style.css','unexpected style.css reference');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');
for(const dead of retired)forbid(background,`'${dead}'`,`retired runtime reinjected: ${dead}`);

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');
forbid(gate,'ng99Sentinel','legacy watchdog mutation');

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const integrity=read('runtime-integrity-v101.js');
need(integrity,"reason='reseed-empty-core'",'empty persisted core repair missing');
need(integrity,'domOnly:false','real Project canonicalization missing');
need(integrity,"OFF · retiré du runtime",'retired hotcache diagnostic guard missing');
need(integrity,'manualCoreSelection===true','manual core selection protection missing');

const app=read('app-v090.js');
need(app,'MutationObserver(queueMainNodes)');
need(app,'function renderPins()');
need(app,'PROJECT_CHAT_SEL');
need(app,'scanRunning:false');
need(app,'scanRequested:false');
forbid(app,'function routeTick()');

const governance=read('project-governance-v090.js');need(governance,'verifyAndLockManualMove');need(governance,'executePlan');
const folders=read('pin-folders-v096.js');need(folders,'ng96-pin-drawer');need(folders,'ng96-project-open');
const activity=read('activity-ui-v097.js');need(activity,'Never watch characterData across the whole conversation');
const panels=read('side-panels-v096.js');need(panels,'ng96-native-sidepanel');

console.log(`NiakGPT ${manifest.version} hydration/runtime integrity invariants: OK`);
