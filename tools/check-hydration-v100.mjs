import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

// 0.9.57 canonical isolation: page-bridge remains the only MAIN-world runtime.
const main=['page-bridge.js'];
const isolated=[
  'onboarding-v101.js',
  'profiles-v100.js',
  'control-center-v090.js',
  'cache-bus-v096.js',
  'diagnostic-bus-v096.js',
  'cache-guardian-v100.js',
  'recovery-v100.js',
  'server-index-v100.js',
  'commands-v100.js',
  'browser-compat-v102.js',
  'lifecycle-guard-v104.js',
  'multitab-v090.js',
  'governance-adapter-v105.js',
  'project-governance-v090.js',
  'governance-queue-v101.js',
  'reclassify-v101.js',
  'locale-fr-v101.js',
  'project-pins-v090.js',
  'sidebar-authority-v107.js',
  'sidebar-host-v090.js',
  'app-v090.js',
  'project-state-selfheal-v102.js',
  'project-assignment-selfheal-v103.js',
  'breadcrumb-v100.js',
  'continuity-v100.js',
  'visual-stability-v101.js',
  'coach-v101.js',
  'polish-v090.js',
  'side-panels-v096.js',
  'live-fixes-v104.js',
  'live-fixes-v106.js',
  'chronology-v090.js',
  'pin-folders-v096.js',
  'project-links-v106.js',
  'activity-ui-v097.js',
  'retro-loader-v097.js'
];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');
if(manifest.version!=='0.9.57')fail(`unexpected release ${manifest.version}`);
need(JSON.stringify(manifest.content_scripts),'live-fixes-v104.css','live UI CSS missing from manifest');
need(JSON.stringify(manifest.content_scripts),'sidebar-authority-v107.css','0.9.57 sidebar authority CSS missing from manifest');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');
forbid(background,"'manual-lock-main-v085.js'",'obsolete isolated fetch hook loaded');

for(const legacy of ['hotcache-main-v084.js','activity-main-v087.js']){
  if(fs.existsSync(legacy))fail(`obsolete MAIN runtime still present: ${legacy}`);
}

const bridge=read('page-bridge.js');
need(bridge,'const nativeFetch = window.fetch.bind(window);','native fetch capture missing');
need(bridge,'conversation_detail_get_disabled','full conversation GET guard missing');
need(bridge,'project_move_requires_governance','project governance guard missing');
need(bridge,"error:'native_busy'",'native activity circuit breaker missing');
forbid(bridge,'window.fetch =','global fetch replacement reintroduced');
forbid(bridge,'globalThis.fetch =','global fetch replacement reintroduced');

const adapter=read('governance-adapter-v105.js');
for(const token of ['governance-light-inventory','trusted-project-menu','event.stopImmediatePropagation()','/backend-api/conversations?offset=0&limit=100'])need(adapter,token,`governance adapter missing ${token}`);
forbid(adapter,'window.fetch =','governance adapter must not hook global fetch');
forbid(adapter,'setInterval(','governance adapter polling reintroduced');

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');
forbid(gate,'ng99Sentinel','legacy watchdog mutation');

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const compat=read('browser-compat-v102.js');need(compat,'crypto.randomUUID','randomUUID compatibility guard missing');need(compat,'getRandomValues','randomUUID secure fallback missing');
const lifecycle=read('lifecycle-guard-v104.js');need(lifecycle,'SafeBroadcastChannel','BroadcastChannel lifecycle guard missing');need(lifecycle,'InvalidStateError','closed channel protection missing');
const app=read('app-v090.js');
need(app,'MutationObserver(queueMainNodes)');
need(app,'function renderPins()');
need(app,'PROJECT_CHAT_SEL');
need(app,'scanRunning:false');
need(app,'scanRequested:false');
forbid(app,'function routeTick()');

const selfheal=read('project-state-selfheal-v102.js');
for(const token of ['repairGovernance','mergeNativeCanonical','renderFallback','niakgpt:force-server-index'])need(selfheal,token,`Project self-heal missing ${token}`);
forbid(selfheal,'characterData:true','Project self-heal must remain structural-only');
forbid(selfheal,'setInterval(','Project self-heal polling reintroduced');

const assignment=read('project-assignment-selfheal-v103.js');
for(const token of ['localToCanonical','projectId:target','AUTO-RÉPARÉ'])need(assignment,token,`Project assignment self-heal missing ${token}`);
forbid(assignment,'characterData:true','Project assignment self-heal must remain event-driven');
forbid(assignment,'setInterval(','Project assignment self-heal polling reintroduced');

const pins=read('project-pins-v090.js');
need(pins,'cacheProjectIds','Project pin cache fallback missing');
need(pins,'ATTENTE · inventaire/gouvernance Projects','Project pin zero-state diagnostic missing');

const sidebarAuthority=read('sidebar-authority-v107.js');
for(const token of ['ng107-native-project-cluster','isDateLike','cleanCache','date-shaped','FALLBACK · liste NiakGPT indisponible'])need(sidebarAuthority,token,`0.9.57 sidebar authority missing ${token}`);
forbid(sidebarAuthority,'setInterval(','0.9.57 sidebar authority polling reintroduced');
forbid(sidebarAuthority,'window.fetch =','0.9.57 sidebar authority must not hook fetch');

const governance=read('project-governance-v090.js');need(governance,'verifyAndLockManualMove');need(governance,'executePlan');
const folders=read('pin-folders-v096.js');
need(folders,'ng96-pin-drawer');need(folders,'ng96-project-open');
need(folders,'<a data-chat=','Project drawer chats must be native anchors');
need(folders,"event.metaKey||event.ctrlKey||event.shiftKey||event.altKey",'modified clicks must remain native');
forbid(folders,'<button type="button" data-chat=','Project drawer chat buttons reintroduced');
const projectLinks=read('project-links-v106.js');
for(const token of ["link.href='/projects'",'ng106-projects-home','verifyDrawerLinks','MutationObserver'])need(projectLinks,token,`Project link UX missing ${token}`);
forbid(projectLinks,'setInterval(','Project link UX polling reintroduced');
const activity=read('activity-ui-v097.js');need(activity,'Never watch characterData across the whole conversation');
const panels=read('side-panels-v096.js');need(panels,'ng96-native-sidepanel');
const live=read('live-fixes-v104.js');for(const token of ['suppressNativeProjects','elementsFromPoint','--ng96-rail-offset'])need(live,token,`live UI repair missing ${token}`);
const live106=read('live-fixes-v106.js');
for(const token of ['anti-race','breadcrumbContext','syncStatusProject','attributeFilter:[\'class\',\'href\',\'aria-label\']','projects-natifs','releaseNativeProjects'])need(live106,token,`0.9.56 live repair missing ${token}`);
forbid(live106,'setInterval(','0.9.56 live repair polling reintroduced');
forbid(live106,'window.fetch =','0.9.56 live repair must not hook fetch');
const cacheBus=read('cache-bus-v096.js');need(cacheBus,'suspended','cache bus lifecycle suspension missing');need(cacheBus,"addEventListener('pageshow'",'cache bus BFCache resume missing');

console.log(`NiakGPT ${manifest.version} hydration-safe release invariants: OK`);
