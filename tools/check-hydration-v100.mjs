import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js'];
const isolated=[
  'onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js',
  'diagnostic-bus-v096.js','cache-guardian-v100.js','recovery-v100.js','server-index-v100.js',
  'commands-v100.js','browser-compat-v102.js','lifecycle-guard-v104.js','multitab-v090.js',
  'governance-adapter-v105.js','project-governance-v090.js','governance-queue-v101.js',
  'reclassify-v101.js','locale-fr-v101.js','sidebar-projects-authority-v112.js','sidebar-host-v090.js',
  'app-v090.js','project-state-selfheal-v102.js','project-assignment-selfheal-v103.js',
  'breadcrumb-v100.js','continuity-v100.js','visual-stability-v101.js','home-layout-v112.js','coach-v101.js',
  'polish-v090.js','side-panels-v096.js','live-fixes-v104.js','live-fixes-v106.js',
  'chronology-v090.js','pin-folders-v096.js','project-chat-ux-v110.js','project-links-v106.js',
  'activity-ui-v097.js','retro-loader-v097.js'
];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');
const release=manifest.version.split('.').map(Number);
if(release.length!==3||release.some(Number.isNaN)||release[0]!==0||release[1]!==9||release[2]<62)fail(`unexpected release ${manifest.version}`);
const manifestText=JSON.stringify(manifest.content_scripts);
for(const css of ['live-fixes-v104.css','sidebar-projects-authority-v112.css','project-chat-ux-v110.css','home-layout-v112.css'])need(manifestText,css,`${css} missing from manifest`);
for(const obsolete of ['sidebar-authority-v107.css','sidebar-expando-guard-v108.css','sidebar-projects-authority-v109.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v111.css','project-chat-ux-v109.css'])forbid(manifestText,obsolete,`${obsolete} still wired`);

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');
for(const obsolete of ["'manual-lock-main-v085.js'","'project-pins-v090.js'","'sidebar-authority-v107.js'","'sidebar-expando-guard-v108.js'","'sidebar-projects-authority-v109.js'","'sidebar-projects-authority-v110.js'","'sidebar-projects-authority-v111.js'","'project-chat-ux-v109.js'"])forbid(background,obsolete,`${obsolete} loaded`);
for(const legacy of ['hotcache-main-v084.js','activity-main-v087.js'])if(fs.existsSync(legacy))fail(`obsolete MAIN runtime still present: ${legacy}`);

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const bridge=read('page-bridge.js');
need(bridge,'const nativeFetch = window.fetch.bind(window);','native fetch capture missing');
need(bridge,'conversation_detail_get_disabled','full conversation GET guard missing');
need(bridge,'project_move_requires_governance','project governance guard missing');
need(bridge,"error:'native_busy'",'native activity circuit breaker missing');
forbid(bridge,'window.fetch =','global fetch replacement reintroduced');
forbid(bridge,'globalThis.fetch =','global fetch replacement reintroduced');

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');

const lifecycle=read('lifecycle-guard-v104.js');need(lifecycle,'SafeBroadcastChannel');need(lifecycle,'InvalidStateError');
const app=read('app-v090.js');need(app,'MutationObserver(queueMainNodes)');need(app,'function renderPins()');need(app,'PROJECT_CHAT_SEL');forbid(app,'function routeTick()');
const adapter=read('governance-adapter-v105.js');need(adapter,'trusted-project-menu');forbid(adapter,'window.fetch =');forbid(adapter,'setInterval(');
const selfheal=read('project-state-selfheal-v102.js');need(selfheal,'repairGovernance');need(selfheal,'mergeNativeCanonical');forbid(selfheal,'setInterval(');
const assignment=read('project-assignment-selfheal-v103.js');need(assignment,'localToCanonical');need(assignment,'projectId:target');forbid(assignment,'setInterval(');

const projectsAuthority=read('sidebar-projects-authority-v112.js');
for(const token of ['ownReady','managedNames','nameTargets','ng112-native-projects-hidden','sidebar-expando-section','project-unfurl-row','FALLBACK · bloc NiakGPT absent','UI NiakGPT unique'])need(projectsAuthority,token,`Projects authority missing ${token}`);
forbid(projectsAuthority,'setInterval(','Projects authority polling reintroduced');
forbid(projectsAuthority,'window.fetch =','Projects authority must not hook fetch');
const homeLayout=read('home-layout-v112.js');
for(const token of ['Par quoi','greeting','composer','ng112-home-composer-shift','getBoundingClientRect','desiredGap','home-layout'])need(homeLayout,token,`Home layout guard missing ${token}`);
forbid(homeLayout,'setInterval(','Home layout polling reintroduced');
forbid(homeLayout,'window.fetch =','Home layout must not hook fetch');

// project-pins-v090.js stays in the source tree for history/labs, but it must never be
// loaded in the 0.9.62 runtime: it synchronizes NiakGPT core Projects back into native
// ChatGPT pins, which is incompatible with a single visible Projects UI.
if(!fs.existsSync('project-pins-v090.js'))fail('historical native pin synchronizer unexpectedly removed');

const folders=read('pin-folders-v096.js');
need(folders,'ng96-pin-drawer');need(folders,'ng96-project-open');need(folders,'<a data-chat=');
need(folders,"event.metaKey||event.ctrlKey||event.shiftKey||event.altKey");
forbid(folders,'<button type="button" data-chat=','Project chat buttons reintroduced');
const projectChatUx=read('project-chat-ux-v110.js');
for(const token of ['aria-current','ng110Renamable','ng110Out','isRenameHit','Renommer la conversation',"body:{title:next}"])need(projectChatUx,token);
forbid(projectChatUx,'document.createElement','Project chat UX must not create/reparent rows');
forbid(projectChatUx,'setInterval(');

const continuity=read('continuity-v100.js');
need(continuity,"const STATE_KEY='niakgpt-continuity-v100'");
need(continuity,'function outSignal()');
need(continuity,'markCurrentOut');
const reclassify=read('reclassify-v101.js');need(reclassify,'RECENT_CATCHUP_MS');need(reclassify,'recentUnassigned');
const projectLinks=read('project-links-v106.js');need(projectLinks,"link.href='/projects'");forbid(projectLinks,'setInterval(');
const activity=read('activity-ui-v097.js');need(activity,'Never watch characterData across the whole conversation');

console.log(`NiakGPT ${manifest.version} current runtime invariants: OK`);
