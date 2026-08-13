import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const has=(s,t,m=`missing: ${t}`)=>{if(!s.includes(t))fail(m);};
const no=(s,t,m=`forbidden: ${t}`)=>{if(s.includes(t))fail(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const exists=p=>{if(!fs.existsSync(p))fail(`missing file: ${p}`);};

const manifest=JSON.parse(read('manifest.json'));
if(manifest.manifest_version!==3)fail('Manifest V3 required');
if(manifest.name!=='NiakGPT')fail('Wrong extension name');
if(!/^\d+\.\d+\.\d+$/.test(String(manifest.version||'')))fail('Semantic version required');
same(manifest.permissions,['storage'],'Only storage permission is allowed');
same(manifest.host_permissions,['https://chatgpt.com/*'],'Host permissions must remain ChatGPT-only');
if(manifest.background?.service_worker!=='background-v100.js')fail('Lifecycle service worker required');
if(!manifest.content_scripts.every(x=>x.matches?.every(v=>v==='https://chatgpt.com/*')))fail('All content scripts must stay ChatGPT-only');

const expectedMain=['page-bridge.js','manual-lock-main-v085.js','activity-main-v087.js','hotcache-main-v084.js'];
const expectedIsolated=['onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js','commands-v100.js','multitab-v090.js','project-governance-v090.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','coach-v101.js','polish-v090.js','side-panels-v096.js','chronology-v090.js','pin-folders-v096.js','activity-ui-v097.js'];
const expectedCss=['theme-v08.css','polish-v081.css','chronology-v081.css','multitab-v083.css','governance-v085.css','activity-v086.css','control-center-v090.css','core-v090.css','profiles-v100.css','commands-v100.css','onboarding-v100.css','coach-v100.css','pin-folders-v096.css','side-panels-v096.css'];
const main=manifest.content_scripts.find(x=>x.world==='MAIN');
const isolated=manifest.content_scripts.find(x=>x.world!=='MAIN'&&x.js?.includes('app-v090.js'));
const cssLayer=manifest.content_scripts.find(x=>!x.js&&x.css?.includes('theme-v08.css'));
const loader=manifest.content_scripts.find(x=>x.js?.includes('retro-loader-v097.js'));
const loaderCss=manifest.content_scripts.find(x=>!x.js&&x.css?.includes('retro-loader-v097.css'));

same(main?.js,expectedMain,'MAIN runtime order mismatch');
same(isolated?.js,expectedIsolated,'Isolated runtime order mismatch');
same(cssLayer?.css,expectedCss,'CSS runtime order mismatch');
same(loader?.js,['retro-loader-v097.js'],'Retro loader runtime mismatch');
same(loaderCss?.css,['retro-loader-v097.css'],'Retro loader CSS mismatch');
if(main?.run_at!=='document_start')fail('MAIN network hooks must load at document_start');
if(cssLayer?.run_at!=='document_start'||loaderCss?.run_at!=='document_start')fail('CSS must load at document_start');
if(isolated?.run_at!=='document_idle'||loader?.run_at!=='document_idle')fail('DOM runtime must load at document_idle');
for(const entry of manifest.content_scripts.filter(x=>x.run_at==='document_start')){
  if((entry.js||[]).some(file=>expectedIsolated.includes(file)||file==='retro-loader-v097.js'))fail('DOM-dependent runtime reintroduced at document_start');
}

const forbiddenLoaded=['app-v08-safe.js','multitab-v083.js','polish-v081.js','chronology-v081.js','project-governance-v085.js','project-pins-v085.js','onboarding-v100.js','hotcache-v084.js','activity-v086.js','coach-v100.js'];
for(const file of forbiddenLoaded)if(isolated.js.includes(file))fail(`Legacy runtime loaded: ${file}`);

const runtime=[...new Set([...expectedMain,...expectedIsolated,'retro-loader-v097.js',manifest.background.service_worker])];
for(const file of [...runtime,...expectedCss,'retro-loader-v097.css'])exists(file);
const texts=Object.fromEntries(runtime.map(file=>[file,read(file)]));
const css=Object.fromEntries([...expectedCss,'retro-loader-v097.css'].map(file=>[file,read(file)]));
for(const file of expectedIsolated)no(texts[file],'setInterval(',`Permanent polling forbidden in ${file}`);

// Parser-safe modules remain event-driven even though the DOM runtime is injected at document_idle.
const activity=texts['activity-ui-v097.js'];
const coach=texts['coach-v101.js'];
const diag=texts['diagnostic-bus-v096.js'];
has(activity,"document.addEventListener('DOMContentLoaded',start");
has(coach,"document.addEventListener('DOMContentLoaded',start");
has(diag,"document.addEventListener('DOMContentLoaded',startHotcacheUI");
no(activity,'bootstrapObserver');
no(activity,"observe(document.documentElement,{childList:true,subtree:true}");

const cacheBus=texts['cache-bus-v096.js'];
has(cacheBus,"chrome.storage.local.get(KEY)");has(cacheBus,'__NIAKGPT_CACHE_BUS__');has(cacheBus,'subscribe(fn)');
for(const file of ['app-v090.js','chronology-v090.js','pin-folders-v096.js','project-governance-v090.js','multitab-v090.js']){
  has(texts[file],'__NIAKGPT_CACHE_BUS__',`Cache Bus missing from ${file}`);
  no(texts[file],'chrome.storage.local.get(CACHE_KEY)',`Direct large cache read reintroduced in ${file}`);
}

has(diag,'__NIAKGPT_DIAGNOSTICS__');has(diag,'snapshot()');
has(diag,"requestIdleCallback(run,{timeout:1800})");
has(diag,"document.addEventListener('niakgpt:hotcache-status'");
has(diag,"document.addEventListener('niakgpt:activity-network'");
has(coach,"__NIAKGPT_DIAGNOSTICS__?.set('coach',text)");
has(texts['multitab-v090.js'],"__NIAKGPT_DIAGNOSTICS__?.set('onglet'");
has(texts['project-pins-v090.js'],"__NIAKGPT_DIAGNOSTICS__?.set('pins'");

const app=texts['app-v090.js'];
has(app,'MutationObserver(queueMainNodes)');has(app,'S.pendingMain');has(app,'canBackground');has(app,'setTimeout(matrixLoop');
has(app,'function bindNavigation()');has(app,'function wakeBackground()');
no(app,'function routeTick()');no(app,'setTimeout(routeTick');no(app,'requestAnimationFrame(draw)');
no(app,"querySelectorAll('button,[data-testid]')");
has(app,'scanTimer:0, scanToken:0');has(app,'const end=Math.min(index+20,nodes.length)');
has(app,"if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}");
has(app,'function saveCacheSoon(delay=1600)');has(app,'incoming?.at!==S.lastCacheWriteAt');
has(app,'data?.cursor ?? data?.next_cursor ?? data?.nextCursor');
has(app,"listFrom(r.data,'items','conversations')");has(app,"listFrom(r.data,'items','projects','gizmos')");
no(app,"main.querySelectorAll('pre').forEach(decorateCode)");
has(app,"document.getElementById('ng8-rail')");has(app,"document.getElementById('ng8-status')");has(app,'function renderPins()');

has(texts['activity-main-v087.js'],'niakgptActivityAwareFetch');
for(const token of ["ready:'PRÊT'","loading:'CHARGEMENT'","waiting:'ATTENTE'","thinking:'RÉFLEXION / ANALYSE'","executing:'EXÉCUTION'","error:'ERREUR'"])has(activity,token);
has(activity,"document.addEventListener('niakgpt:activity-network'");has(activity,'activeObserver=new MutationObserver');
has(activity,"activeObserver.observe(root,{childList:true,subtree:true,characterData:true})");has(activity,'sidebarObserver=new MutationObserver');
has(activity,'scheduleSettle');has(activity,'scheduleHeartbeat');has(activity,'BroadcastChannel');no(activity,'function tick()');

has(css['activity-v086.css'],'--ng86-status-w:154px');has(css['activity-v086.css'],'position:absolute!important');has(css['activity-v086.css'],'width:var(--ng86-status-w)!important');
has(css['multitab-v083.css'],'width:54px');has(css['core-v090.css'],'.ng90-safe-badge{position:absolute!important');

const tabs=texts['multitab-v090.js'];
has(tabs,'navigator.locks');has(tabs,'canRunWorkerIdle');has(tabs,'dataset.ng8Running');has(tabs,'dataset.ng8Heavy');has(tabs,'releaseWorkerForSafeMode');
no(tabs,'turnCount(');no(tabs,'conversation-turn-');no(tabs,"querySelectorAll('button,[data-testid]')");no(tabs,'niakgptCoordinatedRAF');

const gov=texts['project-governance-v090.js'];
has(texts['manual-lock-main-v085.js'],'niakgpt:manual-project-move');has(texts['page-bridge.js'],'project_move_requires_governance');
for(const token of ['verifyAndLockManualMove','verifyDestination','buildCleanupPlan','buildProfiles','executePlan','unlockChat','À CLASSER','scheduleAutoResync'])has(gov,token);
has(gov,"role()==='worker'");has(gov,'safeMode()');

const pins=texts['project-pins-v090.js'];for(const token of ['syncEnabled','nativePinnedIds','verifyPinned','désépingler','épingler'])has(pins,token);
has(pins,"role()==='worker'");has(pins,'settings.safeMode!==true');
const folders=texts['pin-folders-v096.js'];for(const token of ['aria-expanded','aria-controls','chatsFor(pid)','routeNative(href)','ng96-pin-drawer','ng96-project-open','SESSION_KEY','ArrowRight','ArrowLeft'])has(folders,token);
has(folders,"drawer.setAttribute('role','region')");has(css['pin-folders-v096.css'],'max-height:min(34vh,310px)');

const panels=texts['side-panels-v096.js'];for(const token of ['activity','sources','outputs','decorateTriggers','ng96-native-side-trigger','ng96-native-sidepanel'])has(panels,token);
has(css['side-panels-v096.css'],'right:var(--ng8-rail)!important');has(css['side-panels-v096.css'],'body.ng8-panel-open .ng96-native-sidepanel');
no(panels,'niakgpt:activity-network');no(panels,'arm(7000)');no(texts['polish-v090.js'],'MutationObserver');

const hot=texts['hotcache-main-v084.js'];
for(const token of ['indexedDB.open','MAX_ENTRIES = 5','MAX_TOTAL_BYTES = 96','MAX_MEMORY_ENTRIES = 2','MAX_MEMORY_BYTES = 48','KNOWN_META_TTL = 15','navigator.locks.request','storeResponseAfterRender','getEntry(id, true)'])has(hot,token);
no(hot,'waitForPeer(');no(hot,'WAIT_OTHER_TAB_MS');has(hot,"m.type === 'invalidate' || m.type === 'updated'");has(hot,'niakgpt:hotmeta-updated');

has(coach,'function classify(prompt');has(coach,'data-ng100-coach');has(coach,'stateObserver');no(app,'ng100-coach');

const onboarding=texts['onboarding-v101.js'];has(onboarding,"chrome.storage.local.get([KEY,INSTALL_META])");no(onboarding,'chrome.storage.local.get(null)');has(onboarding,"lifecycle?.reason==='update'");

for(const [file,text] of Object.entries(texts)){
  const urls=[...text.matchAll(/https:\/\/[^'\"`\s)]+/g)].map(match=>match[0]);
  for(const url of urls)if(!url.startsWith('https://chatgpt.com'))fail(`External runtime URL in ${file}: ${url}`);
}

console.log(`NiakGPT ${manifest.version} parser-safe release invariants: OK`);
