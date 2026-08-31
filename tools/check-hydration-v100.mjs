import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};

const manifest=JSON.parse(read('manifest.json'));
if(manifest.manifest_version!==3)fail('manifest_version drift');
if(manifest.version!=='0.9.87')fail(`unexpected release ${manifest.version}`);
same(manifest.permissions,['storage','scripting','identity'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*','https://api.github.com/*','https://github.com/login/*','https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*'],'host scope mismatch');
const staticRuntime=['boot-gate-v100.js','composer-continuation-v128.js','long-run-watchdog-v129.js','pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js'];
same(manifest.content_scripts.flatMap(x=>x.js||[]),staticRuntime,'unexpected static runtime');
const jsScripts=manifest.content_scripts.filter(x=>(x.js||[]).length);
if(jsScripts.some(x=>x.run_at!=='document_idle'))fail('all NiakGPT JS content scripts must run at document_idle');
if(manifest.content_scripts.some(x=>x.run_at==='document_start'&&(x.js||[]).length))fail('document_start JS is forbidden after 0.9.81 hydration regression');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
const main=runtimeList('MAIN_RUNTIME'),isolated=runtimeList('ISOLATED_RUNTIME'),optional=runtimeList('OPTIONAL_RUNTIME');
same(main,['page-bridge.js'],'MAIN runtime mismatch');

const required=[
  'sidebar-metadata-v118.js','sidebar-projects-authority-v112.js','sidebar-projects-v121.js','sidebar-ux-v119.js','pin-folders-v096.js','app-v090.js','sidebar-actions-v123.js','folder-scroll-anchor-v124.js','project-native-name-sync-v124.js',
  'home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js',
  'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','continuity-v112.js','interruption-guard-v119.js'
];
same(optional,['project-memory-v132.js','project-memory-ui-v132.js'],'optional Project Memory runtime mismatch');
for(const file of optional)if(isolated.includes(file))fail(`optional Project Memory leaked into critical runtime ${file}`);
for(const file of required)if(!isolated.includes(file))fail(`current runtime missing ${file}`);
for(const file of ['project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','sidebar-projects-authority-v109.js','sidebar-projects-authority-v110.js','sidebar-projects-authority-v111.js','native-actions-controller-v119.js','native-actions-v113.js',...staticRuntime.slice(1)])if(isolated.includes(file))fail(`legacy/conflicting runtime loaded ${file}`);

const recoveryOverlays=[
  'native-ux-v125.js','native-ux-v126.js','continuity-limit-v125.js','continuity-live-v126.js','sidebar-route-placement-v125.js','sidebar-truth-v127.js',
  'native-ux-v125.css','native-ux-v126.css','sidebar-truth-v127.css','assets/mascot-v125.svg'
];
for(const file of recoveryOverlays){
  if(isolated.includes(file))fail(`0.9.71-0.9.73 recovery overlay loaded ${file}`);
  if(fs.existsSync(file))fail(`0.9.71-0.9.73 recovery overlay still shipped ${file}`);
}

const idx=file=>isolated.indexOf(file);
for(const consumer of ['cache-guardian-v100.js','recovery-v100.js','server-index-v100.js','project-governance-v090.js','reclassify-v101.js'])if(idx('sidebar-metadata-v118.js')<0||idx('sidebar-metadata-v118.js')>=idx(consumer))fail(`sidebar metadata must sanitize cache before ${consumer}`);
if(idx('sidebar-projects-v121.js')>=idx('sidebar-ux-v119.js'))fail('v121 Projects authority must load before v119 guard');
if(idx('sidebar-ux-v119.js')>=idx('pin-folders-v096.js'))fail('sidebar UX guard must register before folder handlers');
if(idx('sidebar-actions-v123.js')<=idx('pin-folders-v096.js')||idx('sidebar-actions-v123.js')<=idx('app-v090.js'))fail('single sidebar action owner must load after rows/render owner');
if(idx('folder-scroll-anchor-v124.js')<=idx('sidebar-actions-v123.js'))fail('folder scroll anchor must load after sidebar actions');
if(idx('project-native-name-sync-v124.js')<=idx('sidebar-actions-v123.js'))fail('native Project name sync must load after sidebar actions');
if(idx('interruption-guard-v119.js')<=idx('continuity-v112.js'))fail('interruption guard must load after continuity capture handler');

for(const file of [...isolated,...optional].filter(x=>x!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
for(const file of [...main,...isolated,...optional,'background-v100.js','project-memory-background-v132.js','github-vault-start.html','github-vault-start.js',...staticRuntime])if(!fs.existsSync(file))fail(`missing runtime ${file}`);

for(const token of ["const OPTIONAL_RUNTIME=[","sendResponse({ok:!coreFailed","PROJECT_MEMORY_BACKEND_READY"])need(background,token,'Project Memory optional boot isolation incomplete');
forbid(background,"item.includes(':project-memory-v132.js:')",'Project Memory must not be a critical coreFailed owner');

const bridge=read('page-bridge.js');
need(bridge,'const nativeFetch = window.fetch.bind(window);');need(bridge,'conversation_detail_get_disabled');need(bridge,'d.memoryBootstrap !== true');need(bridge,'project_move_requires_governance');forbid(bridge,'window.fetch =');forbid(bridge,'globalThis.fetch =');

const memoryBackend=read('project-memory-background-v132.js');
for(const token of ['memory_repository_must_be_private','meta?.private !== true','chrome.storage.session','niakgpt:memory-connect-v132','chrome.identity.launchWebAuthFlow','app-manifests/','request_oauth_on_install','niakgpt:memory-github-connect-repo-v132','github_repository_not_authorized_for_vault','refresh_token','code_challenge','code_verifier','setup_url: clean(flow.installRedirect)','request_oauth_on_install: false'])need(memoryBackend,token,'Project Memory backend invariant incomplete');
const memoryRuntime=read('project-memory-v132.js');
for(const token of ['PROJECT_STATE.md','canonicalUpdated','prefsReady','function inject(ed)','memoryBootstrap: memoryBootstrap === true','MEMORY_LOCK','autoOwner','niakgpt:tab-role-changed','primeBootstrapQueue','ensureBootstrapQueued','queuedProjects','changes[QUEUE_KEY]','githubLogin','githubRepositories','githubConnectRepo','githubLogout'])need(memoryRuntime,token,'Project Memory runtime invariant incomplete');
forbid(memoryRuntime,'async function inject(ed)','Project Memory send-time injection must be synchronous');

const gate=read('boot-gate-v100.js');
for(const token of ['waitDomInteractive','waitForChatShell','restorePendingContinuity','guardUpdateOnboarding','injectRuntime','for(const delay of [0,240,720])','safeToMutate=!!document.body','waitForQuiet(1200,7000)','waitStableHostIdentity(1600,8500)','idleTurn(2200)','requestIdleCallback','__NIAKGPT_HOST_HYDRATED_100__','niakgpt:host-hydrated-v100'])need(gate,token,'late-scheduler hydration bootstrap contract incomplete');
forbid(gate,'location.reload(','boot gate must never reload ChatGPT');
const hydrationEvent='niakgpt:host-hydrated-v100';
for(const file of staticRuntime.slice(1)){
  const src=read(file);
  need(src,'const init=()=>',`pre-runtime missing deferred init: ${file}`);
  need(src,'window.__NIAKGPT_HOST_HYDRATED_100__',`pre-runtime missing hydration flag: ${file}`);
  need(src,hydrationEvent,`pre-runtime missing hydration event: ${file}`);
  need(src,"window.addEventListener('niakgpt:host-hydrated-v100',init,{once:true})",`pre-runtime must wait exactly once for hydration: ${file}`);
}
if(!fs.existsSync('visual-lab/hydration-barrier-v080.mjs'))fail('SSR hydration barrier browser gate missing');
const hydrationLab=read('visual-lab/hydration-barrier-v080.mjs');
for(const token of ["const BOOT='boot-gate-v100.js'",'manifestOrderedSource','MessageChannel','lateHydrationStage','first false-calm scheduler window','late MessagePort hydration settled','document_idle + late MessagePort host replacements + stable-node activation'])need(hydrationLab,token,'late-scheduler hydration lab incomplete');


const parallel=read('composer-continuation-v128.js');
for(const token of ['--- CONTINUE — AJOUT EN PARALLÈLE ---','Poursuis le travail déjà en cours','waiting','thinking','executing','nativeGenerationBusy','idleTriggerUntil','CANCEL_RX','prepareParallelContinuation','niakgpt:parallel-continue','execCommand'])need(parallel,token,'parallel continuation contract incomplete');
for(const token of ['setInterval(','location.reload(','stopImmediatePropagation(','preventDefault('])forbid(parallel,token,'parallel continuation must not poll, reload or hijack native send');

const watchdog=read('long-run-watchdog-v129.js');
for(const token of ['DEFAULT_SEGMENT_MS=4*60*1000+40*1000','NIAKGPT LONG RUN — REPRISE AUTOMATIQUE','nativeStop','draft-protected','attemptResume','niakgpt:long-run-resume','CANCEL_RX','ng129NativeBusy'])need(watchdog,token,'long-run watchdog contract incomplete');
for(const token of ['setInterval(','location.reload('])forbid(watchdog,token,'long-run watchdog must stay bounded and non-reloading');
const pinRescue=read('pin-interaction-rescue-v129.js');
for(const token of ['pointerdown','pointerup','replacementAction','clickSeen','fallback'])need(pinRescue,token,'pin remount rescue incomplete');
forbid(pinRescue,'setInterval(','pin rescue must remain gesture-bounded');
const projectMenu=read('project-menu-augment-v129.js');
for(const token of ['Personnaliser le Project','Nouveau chat dans ce Project','ng129-project-context','openProjectSettings','ng129-native-stage'])need(projectMenu,token,'Project menu/context augmentation incomplete');
forbid(projectMenu,'setInterval(','Project menu augmentation must remain event-driven');
const nativeHandoff=read('continuity-native-handoff-v129.js');
for(const token of ['nativeLimitControl','CONTINUITÉ NIAKGPT','markCurrentOut','writePending','finishProjectLock','sendButton','niakgpt:activity-changed'])need(nativeHandoff,token,'native continuity handoff incomplete');
for(const token of ['setInterval(','location.reload('])forbid(nativeHandoff,token,'native continuity handoff must stay bounded');

const app=read('app-v090.js');
for(const token of ['panelSelectionActive','diagnosticSelectionHeld','syncDiagnosticSelectionLock','releaseDiagnosticSelection','selectionchange','diagSelectionGesture','sticky read/copy mode','S.diagTimer=setTimeout(retry,280)'])need(app,token,'diagnostic selection stability incomplete');
for(const token of ['MutationObserver(queueMainNodes)','function renderPins()','window.__NIAKGPT_SIDEBAR_PROJECTS_121__','niakgpt:sidebar-projects-reconcile'])need(app,token,'app/v121 cooperative ownership incomplete');
need(app,"label.textContent=String(turn.innerText||turn.textContent||'')",'TOC DOM text must stay textContent');
forbid(app,'function routeTick()');

const actions=read('sidebar-actions-v123.js');
for(const token of ['ng123-action-menu','ng123-rename-dialog','dataset.ng123Action','openMenu','state?.button===button','renameChat','moveChat','nativeProjectRename','exactProjectRow','/project','Hors projet','niakgpt:hydrate-project','stopImmediatePropagation','aria-labelledby','aria-controls','ArrowDown','Home','End','focusMenuItem'])need(actions,token,'single-owner custom/accessibility sidebar action lifecycle incomplete');
for(const token of ['native-actions-controller-v119.js','native-actions-v113.js'])forbid(background,token,'legacy action owner still wired');

const scrollAnchor=read('folder-scroll-anchor-v124.js');
for(const token of ['orderByProject','scrollByProject','stabilizeOrder','ng96-chat-entry','performance.now()+1400'])need(scrollAnchor,token,'folder scroll/order anchor incomplete');
forbid(scrollAnchor,'setInterval(','folder scroll anchor must remain event-bounded');

const nativeNameSync=read('project-native-name-sync-v124.js');
for(const token of ['nativeNames','niakgpt:force-server-index','niakgpt:sidebar-projects-reconcile','closest?.(OWN)','/project'])need(nativeNameSync,token,'native Project name synchronization incomplete');
forbid(nativeNameSync,'setInterval(','native Project name sync must remain event-driven');

const activity=read('activity-v086.js');
for(const token of ['nativeBusy=hasThinking()||hasStop()','id===currentChat()&&ACTIVE.has(localState)','remember(id,localState,cur.projectId,localAt)'])need(activity,token,'long-running native activity retention incomplete');

const catalog=read('sidebar-projects-v121.js');
for(const token of ['canonicalProjects','renderCatalog','ng121PinsReady','ng121PlacementReady','sessionOrder','armBootstrap','projectScroll','drawerScroll','projectScrollMemory','niakgpt:sidebar-projects-reconcile'])need(catalog,token,'stable Projects catalog/session ownership incomplete');
for(const token of ['slice(0,8)','setInterval('])forbid(catalog,token,'Projects catalog must not truncate or poll');

const folders=read('pin-folders-v096.js');
for(const token of ['ng96-chat-entry','hydrateProject','publishProjectChats','drawerScrollMemory','innerScroll','outerScroll','restoreDrawerScroll','niakgpt:hydrate-project'])need(folders,token,'folder hydration/scroll continuity incomplete');
forbid(folders,'ensureFullProjectInventory','pin-folders must not compete with v121 catalog ownership');

const interruption=read('interruption-guard-v119.js');
for(const token of ['LIMIT_RX','VERIFY_RX','NETWORK_RX','markCurrentOut','ng100-continue','tryNativeRecovery','restoreDraft','resumePrompt','data-ng119-resume','assistantTail','setVerificationPause','continueFrom?.(chatId)','failed\\s+to\\s+fetch','persistedIncident','allowedType','type:allowedType'])need(interruption,token,'bounded interruption recovery/security incomplete');
for(const token of ['setInterval(','location.reload(','challenge.click(','iframe.click(','retry.click('])forbid(interruption,token,'interruption guard must not bypass security, auto-retry native generation, or loop recovery');

const turnHeaders=read('turn-headers-v112.js');
for(const token of ['LIVE_KEY','nativeAt','pendingUserAt','pendingAssistantAt','data-ng8-time','date/heure fiable prioritaire'])need(turnHeaders,token,'turn timestamp/header contract incomplete');
forbid(turnHeaders,'setInterval(','turn headers must stay event-driven');

const manifestText=JSON.stringify(manifest.content_scripts);
for(const css of ['sidebar-metadata-v118.css','sidebar-projects-authority-v112.css','sidebar-ux-v119.css','native-actions-v113.css','sidebar-actions-v123.css','interruption-guard-v119.css','chat-attention-v113.css','performance-guard-v112.css','sidebar-icons-v114.css','live-stability-v129.css','project-memory-v132.css'])need(manifestText,css,`${css} missing from manifest`);
for(const css of ['native-rename-v112.css','sidebar-authority-v107.css','sidebar-expando-guard-v108.css','sidebar-projects-authority-v109.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v111.css','native-ux-v125.css','native-ux-v126.css','sidebar-truth-v127.css'])forbid(manifestText,css,`${css} still wired`);

for(const file of ['visual-lab/sidebar-session-ux-v123.mjs','visual-lab/tests/sidebar-human-ux-v123.spec.js','visual-lab/tests/activity-long-running-v124.spec.js','visual-lab/experience-gate-v116.mjs','visual-lab/false-positive-signals-v121.mjs','visual-lab/live-sidebar-state-v122.mjs','visual-lab/user-reported-regressions-v120.mjs','visual-lab/parallel-continue-v128.mjs','visual-lab/tests/composer-continuation-runtime-v128.spec.js','visual-lab/tests/live-stability-v129.spec.js'])if(!fs.existsSync(file))fail(`required current regression gate missing ${file}`);
const sessionGate=read('visual-lab/sidebar-session-ux-v123.mjs');
for(const token of ['length:28','length:58','scroll snapped','Projects block drifted above native primary/logo area','Project menu is clipped/inside sidebar/not hit-testable','Chat menu is clipped/inside sidebar/not hit-testable','WCAG 2.5.8','sidebar remount did not recover','sidebar-session-ux-v123'])need(sessionGate,token,'cross-engine full-session sidebar gate incomplete');
const liveSidebar=read('visual-lab/live-sidebar-state-v122.mjs');for(const token of ['__corruptedPins','oldRetired','retired in place','external displacement'])need(liveSidebar,token,'live sidebar displacement recovery gate incomplete');
const humanSpec=read('visual-lab/tests/sidebar-human-ux-v123.spec.js');
for(const token of ['full human sidebar session UX','Projects catalog is complete, scrollable and visually stable','Project folder and chat drawer keep independent scroll positions','true toggles','Keyboard, focus and modal accessibility','Custom chat rename and move','Project custom rename targets only the exact Project native row','Late sidebar mount and route diversity','Conversation limit CTA really starts continuity','Network/generation error recovery preserves draft','more than 10 logical minutes'])need(humanSpec,token,'browser-fixture sidebar gate incomplete');
const longRunSpec=read('visual-lab/tests/activity-long-running-v124.spec.js');
for(const token of ['native long-running analysis stays active beyond 10 minutes without text growth','page.clock.fastForward(61_000)','10*60*1000','stop-generating'])need(longRunSpec,token,'silent long-running analysis gate incomplete');
const parallelGate=read('visual-lab/parallel-continue-v128.mjs');
for(const token of ['idle+thinking+executing+cancel+native-stop+contenteditable+visual','parallel-continuation.png','chromium,firefox,webkit'])need(parallelGate,token,'parallel cross-engine/visual gate incomplete');
const parallelRuntime=read('visual-lab/tests/composer-continuation-runtime-v128.spec.js');
for(const token of ['real MV3 static continuation layer prefixes only pre-existing parallel work','Message depuis une conversation au repos.','Ajoute ce contrôle sans arrêter ce que tu fais.','annule',"page.locator('#ng8-rail')",'isolated world'])need(parallelRuntime,token,'parallel real-extension/hydration gate incomplete');
const sidebarProjects=read('sidebar-projects-v121.js');
for(const token of ['safeInsert(parent,node,before=null)','retireStaleBox','mountParentByBox','box.parentElement!==mountedParent','ng121MountPolicy','direct-once','placementTarget(root=navRoot(),box=null)','visiblePlacementNode','nativeSectionAfterPrimary','projectLinks(parent).length'])need(sidebarProjects,token,'sidebar no-reparent/slot contract incomplete');
for(const forbidden of ["section.parentElement.insertBefore(box,section)","tail.insertAdjacentElement('afterend',box)","root.appendChild(box)"])if(sidebarProjects.includes(forbidden))fail('Pins reparenting path reintroduced: '+forbidden);
const domNodeLab=read('visual-lab/dom-node-stability-v082.mjs');
for(const token of ['syntheticMoveNodeErrors','mountParents','late shell remount','Node cannot be found','direct-once'])need(domNodeLab,token,'DOM node stability lab incomplete');
const pinsSlotLab=read('visual-lab/pins-primary-slot-v083.mjs');for(const token of ['hidden-native-above-primary','visible-native-after-primary','Pins rendered above native ChatGPT navigation','after-primary'])need(pinsSlotLab,token,'Pins primary slot lab incomplete');
const diagnosticSelectionLab=read('visual-lab/diagnostic-selection-v083.mjs');for(const token of ['diagnostic update destroyed the active text selection','sameNode','diagnostics did not resume after selection ended'])need(diagnosticSelectionLab,token,'diagnostic selection lab incomplete');
for(const token of ['launchManifestRegistrationTab','chrome.tabs.create','github_auth_url_invalid_scheme','launchIdentityFlow','chrome.runtime.onConnect.addListener'])need(memoryBackend,token,'GitHub auth transport contract incomplete');
if(/launchWebAuthFlow\(\{\s*url:\s*chrome\.runtime\.getURL/s.test(memoryBackend))fail('launchWebAuthFlow still receives chrome-extension:// starter URL');
const humanSidebar=read('visual-lab/tests/sidebar-human-ux-v123.spec.js');
for(const token of ["page.locator('#ng8-status')","manifest.version,{timeout:20000}","CONTINUITÉ NIAKGPT',{timeout:12000}"])need(humanSidebar,token,'real continuity reload must wait for post-hydration runtime readiness');
const liveSpec=read('visual-lab/tests/live-stability-v129.spec.js');
for(const token of ['NIAKGPT_EXECUTABLE_PATH','long-run recovery + remount-safe pins + Project context + native limit handoff','Brouillon utilisateur à préserver','draft-protected','Personnaliser le Project','CONTINUITÉ NIAKGPT'])need(liveSpec,token,'0.9.76 focused live stability gate incomplete');

const packageJson=read('visual-lab/package.json');
const packageVersion=JSON.parse(packageJson).devDependencies?.['@playwright/test'];if(packageVersion!=='1.62.1')fail(`Playwright package/image version drift: ${packageVersion}`);
const currentScript=JSON.parse(packageJson).scripts?.['test:current']||'';need(currentScript,'dom-node-stability-v082.mjs','current visual gate missing DOM node stability regression');need(currentScript,'pins-primary-slot-v083.mjs','current visual gate missing Pins slot regression');need(currentScript,'diagnostic-selection-v083.mjs','current visual gate missing diagnostic selection regression');
const workflow=read('.github/workflows/current-finalization.yml');
for(const token of ['chromium, firefox, webkit','sidebar-session-ux-v123.mjs','CURRENT LEFT SIDEBAR complete session contract','dom-node-stability-v082.mjs','Reported DOM node stability — direct chat and late shell remount','pins-primary-slot-v083.mjs','Reported Pins placement — native controls stay above Projects','sidebar-human-ux-v123.spec.js','PRIMARY real Brave — FULL human sidebar','experience-linux:','extension-runtime-linux:','mcr.microsoft.com/playwright:v1.62.1-noble','PLAYWRIGHT_BROWSERS_PATH: /ms-playwright','HOME: /root'])need(workflow,token,'current full-session/cross-platform workflow incomplete');
const imageLines=workflow.split(/\r?\n/).filter(line=>/^\s+image:\s+mcr\.microsoft\.com\/playwright:v1\.62\.1-noble\s*$/.test(line));if(imageLines.length!==3)fail(`expected 3 pinned Linux Playwright image jobs, got ${imageLines.length}`);
if(/^\s*npx playwright install --with-deps\b/m.test(workflow))fail('Linux Finalization reintroduced apt --with-deps');
const parallelWorkflow=read('.github/workflows/parallel-continuation-v128.yml');
for(const token of ['parallel-continue-v128.mjs','composer-continuation-runtime-v128.spec.js','matrix:','browser: [chromium, firefox, webkit]','parallel-continuation-v128'])need(parallelWorkflow,token,'parallel continuation workflow incomplete');
const liveWorkflow=read('.github/workflows/live-stability-v129.yml');
for(const token of ['live-stability-v129.spec.js','Brave stable','NIAKGPT_EXECUTABLE_PATH','chromium'])need(liveWorkflow,token,'0.9.76 live stability workflow incomplete');

if(!fs.existsSync('TESTING_TRUTH.md'))fail('testing truth contract missing');
const truth=read('TESTING_TRUTH.md');
for(const token of ['Authenticated live evidence','Legacy naming warning','Recovery baseline rule'])need(truth,token,'testing truth/recovery contract incomplete');

console.log(`NiakGPT ${manifest.version} current runtime invariants: OK`);
