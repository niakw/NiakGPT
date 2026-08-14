import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js','manual-lock-main-v085.js','activity-main-v087.js','hotcache-main-v084.js'];
const isolated=['onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js','commands-v100.js','multitab-v090.js','project-governance-v090.js','governance-queue-v101.js','reclassify-v101.js','locale-fr-v101.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','visual-stability-v101.js','coach-v101.js','polish-v090.js','side-panels-v096.js','chronology-v090.js','pin-folders-v096.js','activity-ui-v097.js','retro-loader-v097.js'];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'only hydration gate may be statically injected');
need(manifest.content_scripts.flatMap(x=>x.css||[]).join('|'),'visual-stability-v101.css','visual stability stylesheet missing from manifest');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(650)','await waitForStableShell()','stableSamples=3','maxWait=2600','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'waitForQuiet(','full-document hydration quiet gate reintroduced');
forbid(gate,"observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true})",'giant-thread bootstrap observer reintroduced');
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');
forbid(gate,'ng99Sentinel','legacy watchdog mutation');

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');need(loader,"root.dataset.ng8Heavy === '1'");

const app=read('app-v090.js');need(app,'MutationObserver(queueMainNodes)');need(app,'function renderPins()');forbid(app,'function routeTick()');
for(const token of ["const heavy=S.turns.length>=65||S.codeCount>=35","if(nodes.length>=65)document.documentElement.dataset.ng8Heavy='1'"])need(app,token,'app must remain the single heavy-thread state owner');
const control=read('control-center-v090.js');for(const token of ['CENTRE DE CONTRÔLE','MODE SÛR','railObserver.observe(document.body,{childList:true})','railWatchdog=setTimeout(stopRailWatch,15000)'])need(control,token);forbid(control,'setTimeout(ensureButton,700)','unbounded Control Center rail retry reintroduced');
const commands=read('commands-v100.js');for(const token of ["title:'Ouverture rapide'","title:'Gouvernance des projets'",'placeholder="> Palette de commandes"'])need(commands,token);
const governance=read('project-governance-v090.js');need(governance,'verifyAndLockManualMove');need(governance,'executePlan');
const govQueue=read('governance-queue-v101.js');for(const token of ['QUEUE_NAMES','coreProjectIds:after','input.disabled=true','À CLASSER · FILE D’ATTENTE','changes[CACHE_KEY].newValue'])need(govQueue,token);forbid(govQueue,'setInterval(','Governance queue guard must stay event-driven');
const reclassify=read('reclassify-v101.js');for(const token of ['QUEUE_NAMES','coreProjectIds','governance:true','BATCH=8','CONFIDENCE=58','canAutomate()','autoResync===false','!p.domOnly','if(hasTerm(text,key))'])need(reclassify,token);
const locale=read('locale-fr-v101.js');for(const token of ["['add to project','Ajouter au projet']",'MutationObserver','setTimeout(scanOpenSurfaces,900)','if(initialRoot)scan(initialRoot)','scanOpenSurfaces()','function schedule(delay=40,root=null){if(!root)return;'])need(locale,token);forbid(locale,'document.addEventListener(\'click\'','French locale click-wide wakeup reintroduced');forbid(locale,'setInterval(','French locale adapter must stay event-driven');
const visual=read('visual-stability-v101.js');for(const token of ['ng101-image-close','ng101-image-viewer-host','VIEWER_SEL','new MutationObserver(()=>scanViewer())','document.body.prepend(matrix)','scheduleMatrix(0)'])need(visual,token);forbid(visual,'setInterval(','visual stability runtime must stay event-driven');
const visualCss=read('visual-stability-v101.css');for(const token of ['content-visibility:auto','data-ng8-heavy="1"','body.ng8-ready::before','position:fixed','transform:translateZ(0)','body.ng8-ready main::before{content:none','body.ng8-ready main{background:transparent!important;box-shadow:none!important}','content:"TOI"','content:"CHATGPT"','ng101-image-viewer-host','form:has(#prompt-textarea)'])need(visualCss,token);forbid(visualCss,'data-ng101-heavy-guard','deleted heavy guard must not control visuals');forbid(visualCss,'background-attachment:fixed','scroll-coupled fixed background reintroduced');
const coach=read('coach-v101.js');for(const token of ['recentCache','recentDirty','if(!recentDirty)return recentCache','invalidateRecent()'])need(coach,token);
const panels=read('side-panels-v096.js');for(const token of ["const ready=()=>document.documentElement.dataset.ng86Activity==='ready'","if(!ready())return false"])need(panels,token);
const folders=read('pin-folders-v096.js');need(folders,'ng96-pin-drawer');need(folders,'ng96-project-open');
const hot=read('hotcache-main-v084.js');need(hot,'MAX_ENTRIES = 5');need(hot,'MAX_TOTAL_BYTES = 96');

console.log(`NiakGPT ${manifest.version} hydration-safe release invariants: OK`);
