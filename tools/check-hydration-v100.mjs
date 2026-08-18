import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js'];
const isolated=[
  'onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js','cache-guardian-v100.js','recovery-v100.js','server-index-v100.js',
  'commands-v100.js','browser-compat-v102.js','lifecycle-guard-v104.js','multitab-v090.js','governance-adapter-v105.js','project-governance-v090.js','governance-queue-v101.js',
  'reclassify-v101.js','analysis-bridge-v112.js','reclassify-deep-v112.js','locale-fr-v101.js','sidebar-icons-v114.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','sidebar-projects-authority-v112.js',
  'sidebar-host-v090.js','performance-guard-v112.js','app-v090.js','home-layout-v112.js','matrix-guardian-v112.js','turn-headers-v112.js','project-state-selfheal-v102.js','project-assignment-selfheal-v103.js',
  'chat-state-authority-v113.js','breadcrumb-v113.js','continuity-v100.js','continuity-v112.js','visual-stability-v101.js','coach-v101.js','polish-v090.js','side-panels-v096.js','live-fixes-v104.js','live-fixes-v106.js',
  'chronology-v090.js','pin-folders-v096.js','project-chat-ux-v110.js','chat-attention-v113.js','native-actions-v113.js','conversation-load-guard-v113.js','project-links-v106.js','activity-ui-v097.js','retro-loader-v097.js'
];
const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');
if(manifest.version!=='0.9.66')fail(`unexpected release ${manifest.version}`);
const manifestText=JSON.stringify(manifest.content_scripts);
for(const css of ['live-fixes-v104.css','sidebar-authority-v107.css','sidebar-expando-guard-v108.css','sidebar-projects-authority-v112.css','project-chat-ux-v110.css','home-layout-v112.css','native-actions-v113.css','chat-attention-v113.css','matrix-guardian-v112.css','performance-guard-v112.css','sidebar-icons-v114.css','native-da-v112.css'])need(manifestText,css,`${css} missing from manifest`);
for(const obsolete of ['native-rename-v112.css','sidebar-projects-authority-v109.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v111.css','project-chat-ux-v109.css'])forbid(manifestText,obsolete,`${obsolete} still wired`);

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');need(background,'chrome.scripting.executeScript');need(background,'niakgpt:inject-runtime-v100');
for(const obsolete of ["'project-pins-v090.js'","'native-rename-v112.js'","'breadcrumb-v100.js'","'manual-lock-main-v085.js'","'sidebar-projects-authority-v109.js'","'sidebar-projects-authority-v110.js'","'sidebar-projects-authority-v111.js'"])forbid(background,obsolete,`${obsolete} loaded`);
for(const legacy of ['hotcache-main-v084.js','activity-main-v087.js'])if(fs.existsSync(legacy))fail(`obsolete MAIN runtime still present: ${legacy}`);
for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const bridge=read('page-bridge.js');need(bridge,'const nativeFetch = window.fetch.bind(window);','native fetch capture missing');need(bridge,'conversation_detail_get_disabled','full conversation GET guard missing');need(bridge,'project_move_requires_governance','project governance guard missing');need(bridge,"error:'native_busy'",'native activity circuit breaker missing');forbid(bridge,'window.fetch =','global fetch replacement reintroduced');forbid(bridge,'globalThis.fetch =','global fetch replacement reintroduced');
const gate=read('boot-gate-v100.js');for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');
const lifecycle=read('lifecycle-guard-v104.js');need(lifecycle,'SafeBroadcastChannel');need(lifecycle,'InvalidStateError');
const app=read('app-v090.js');need(app,'MutationObserver(queueMainNodes)');need(app,'function renderPins()');need(app,'PROJECT_CHAT_SEL');forbid(app,'function routeTick()');need(app,'label.textContent=String(turn.innerText||turn.textContent||\'\')','TOC DOM text must stay textContent');
const adapter=read('governance-adapter-v105.js');need(adapter,'trusted-project-menu');forbid(adapter,'window.fetch =');forbid(adapter,'setInterval(');
const selfheal=read('project-state-selfheal-v102.js');need(selfheal,'repairGovernance');need(selfheal,'mergeNativeCanonical');forbid(selfheal,'setInterval(');
const assignment=read('project-assignment-selfheal-v103.js');need(assignment,'localToCanonical');need(assignment,'projectId:target');forbid(assignment,'setInterval(');

const projectsAuthority=read('sidebar-projects-authority-v112.js');
for(const token of ['ownReady',"const MARK='data-ng112-native-projects'",'projectHomeHref','managedNames','sharesSidebarShell','managedIdentityCount','identityHosts','watchRoots','bindObservers','FALLBACK · bloc NiakGPT absent'])need(projectsAuthority,token);
for(const token of ['attributes:true','attributeFilter:','classList.add(HIDE)',"setAttribute('aria-hidden'"])forbid(projectsAuthority,token,'Projects authority must not observe/rewrite native class or ARIA state');
forbid(projectsAuthority,'setInterval(');forbid(projectsAuthority,'window.fetch =');
const projectsCss=read('sidebar-projects-authority-v112.css');need(projectsCss,'[data-ng112-native-projects="1"]','passive Projects CSS marker missing');
const folders=read('pin-folders-v096.js');for(const token of ['ng96-pin-drawer','ng96-project-open','<a data-chat=',"niakgpt:pins-rendered",'stopImmediatePropagation','drawerDirty','cooperativeNode','existing.previousElementSibling===entry'])need(folders,token);forbid(folders,'<button type="button" data-chat=','Project chat buttons reintroduced');
const projectChatUx=read('project-chat-ux-v110.js');for(const token of ['aria-current','ng110Active','ng110Out'])need(projectChatUx,token);for(const old of ['isRenameHit','Renommer la conversation','body:{title:next}','ng110Renamable'])forbid(projectChatUx,old,'legacy custom rename interception remains');forbid(projectChatUx,'setInterval(');

const state=read('chat-state-authority-v113.js');for(const token of ['iu>pu','iu===pu','titleFromDocument','projectId:prev.projectId||ip||\'\''])need(state,token);forbid(state,'setInterval(');
const breadcrumb=read('breadcrumb-v113.js');for(const token of ['>Accueil<','ng100-bc-project','ng100-bc-current','badProjectLabel','canonicalChat'])need(breadcrumb,token);forbid(breadcrumb,'setInterval(');
const attention=read('chat-attention-v113.js');for(const token of ['ng113Unread','ng113UnreadCount','markSeen','initialized'])need(attention,token);forbid(attention,'setInterval(');
const actions=read('native-actions-v113.js');for(const token of ['invokeNativeMenu','fallbackChatMenu','fallbackMove','Déplacer vers','ng113-native-actions-project','ng113-native-actions-chat','niakgpt:pins-rendered','pageshow','data-ng112-native-projects'])need(actions,token);forbid(actions,'setInterval(');
const loadGuard=read('conversation-load-guard-v113.js');for(const token of ['clearNiakGPTContentPressure','ng112LongThread','ng8Heavy','niakgpt:native-content-missing'])need(loadGuard,token);forbid(loadGuard,'setInterval(');
const icons=read('sidebar-icons-v114.js');for(const token of ['ng114NavIcon','kindFor','sidebar-icons','navigatesuccess'])need(icons,token);forbid(icons,'setInterval(');

const continuity=read('continuity-v100.js');need(continuity,"const STATE_KEY='niakgpt-continuity-v100'");need(continuity,'function outSignal()');need(continuity,'markCurrentOut');
const continuity112=read('continuity-v112.js');for(const token of ['Reprends la conversation nommée','PROJECT EXACT À CONSERVER','exactProject:true','source:\'continuity-exact\''])need(continuity112,token);
const deep=read('reclassify-deep-v112.js');for(const token of ['MAX_PER_RUN=2','MAX_HEAVY=1','analysisRpc','orphan','progressive'])need(deep,token);forbid(deep,'setInterval(');
const analysis=read('analysis-bridge-v112.js');for(const token of ['MIN_GAP=1800','MAX_MESSAGES=10','MAX_TEXT=14000','analysis_paused_busy'])need(analysis,token);forbid(analysis,'setInterval(');
const perf=read('performance-guard-v112.js');for(const token of ['HEAVY_AT=70','COLD_KEEP=44','requestIdleCallback','ng112Cold'])need(perf,token);forbid(perf,'setInterval(');
const headers=read('turn-headers-v112.js');for(const token of ['data-message-timestamp','data-create-time','ng112TimeSource','pendingUserAt'])need(headers,token);forbid(headers,'setInterval(');
const home=read('home-layout-v112.js');need(home,'ng112-home-heading-repaired');need(home,'getBoundingClientRect');forbid(home,'setInterval(');
const matrix=read('matrix-guardian-v112.js');need(matrix,'ng112-matrix-fallback');forbid(matrix,'setInterval(');
const reclassify=read('reclassify-v101.js');need(reclassify,'RECENT_CATCHUP_MS');need(reclassify,'recentUnassigned');
const projectLinks=read('project-links-v106.js');need(projectLinks,"link.href='/projects'");forbid(projectLinks,'setInterval(');
const activity=read('activity-ui-v097.js');need(activity,'Never watch characterData across the whole conversation');
const workflow=read('.github/workflows/current-finalization.yml');for(const token of ['ubuntu-latest, windows-latest, macos-latest','chromium, firefox, webkit','Human / DOM / errors / UX / remount / anti-churn','experience-gate-v116.mjs'])need(workflow,token,'cross-platform experience matrix incomplete');
if(!fs.existsSync('visual-lab/experience-gate-v116.mjs'))fail('experience gate missing');
console.log(`NiakGPT ${manifest.version} current runtime invariants: OK`);
