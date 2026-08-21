import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};

const manifest=JSON.parse(read('manifest.json'));
if(manifest.manifest_version!==3)fail('manifest_version drift');
if(manifest.version!=='0.9.73')fail(`unexpected release ${manifest.version}`);
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
const main=runtimeList('MAIN_RUNTIME'),isolated=runtimeList('ISOLATED_RUNTIME');
same(main,['page-bridge.js'],'MAIN runtime mismatch');

const required=[
  'sidebar-metadata-v118.js','sidebar-truth-v127.js','sidebar-projects-authority-v112.js','sidebar-projects-v121.js','sidebar-ux-v119.js','pin-folders-v096.js','app-v090.js','sidebar-actions-v123.js','folder-scroll-anchor-v124.js','project-native-name-sync-v124.js',
  'home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js',
  'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','continuity-v112.js','continuity-live-v126.js','interruption-guard-v119.js','continuity-limit-v125.js','native-ux-v126.js','native-ux-v125.js'
];
for(const file of required)if(!isolated.includes(file))fail(`current runtime missing ${file}`);
for(const file of ['project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','sidebar-projects-authority-v109.js','sidebar-projects-authority-v110.js','sidebar-projects-authority-v111.js','native-actions-controller-v119.js','native-actions-v113.js'])if(isolated.includes(file))fail(`legacy/conflicting runtime loaded ${file}`);

const idx=file=>isolated.indexOf(file);
for(const consumer of ['cache-guardian-v100.js','recovery-v100.js','server-index-v100.js','project-governance-v090.js','reclassify-v101.js'])if(idx('sidebar-metadata-v118.js')<0||idx('sidebar-metadata-v118.js')>=idx(consumer))fail(`sidebar metadata must sanitize cache before ${consumer}`);
if(idx('sidebar-truth-v127.js')>=idx('sidebar-projects-authority-v112.js'))fail('v127 truth owner must disable legacy Project suppression before v112 loads');
if(idx('sidebar-projects-v121.js')>=idx('sidebar-ux-v119.js'))fail('v121 Projects authority must load before v119 guard');
if(idx('sidebar-ux-v119.js')>=idx('pin-folders-v096.js'))fail('sidebar UX guard must register before folder handlers');
if(idx('sidebar-actions-v123.js')<=idx('pin-folders-v096.js')||idx('sidebar-actions-v123.js')<=idx('app-v090.js'))fail('single sidebar action owner must load after rows/render owner');
if(idx('folder-scroll-anchor-v124.js')<=idx('sidebar-actions-v123.js'))fail('folder scroll anchor must load after sidebar actions');
if(idx('project-native-name-sync-v124.js')<=idx('sidebar-actions-v123.js'))fail('native Project name sync must load after sidebar actions');
if(idx('continuity-live-v126.js')>=idx('continuity-v112.js'))fail('live continuity owner must register before legacy v112 so v112 no-ops at runtime');
if(idx('continuity-live-v126.js')<=idx('continuity-v100.js'))fail('live continuity owner needs v100 capsule/state helpers first');
if(idx('interruption-guard-v119.js')<=idx('continuity-v112.js'))fail('interruption guard must load after continuity ownership is settled');
if(idx('continuity-limit-v125.js')<=idx('interruption-guard-v119.js'))fail('modern limit detector must load after interruption guard');
if(idx('native-ux-v126.js')<=idx('sidebar-actions-v123.js'))fail('live native UX owner must load after sidebar actions');
if(idx('native-ux-v126.js')>=idx('native-ux-v125.js'))fail('v126 must disable v125 before the old repair shim executes');
if(idx('native-ux-v125.js')>=idx('sidebar-route-placement-v125.js'))fail('legacy v125 shim order drift');

for(const file of isolated.filter(x=>x!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
for(const file of [...main,...isolated,'background-v100.js','boot-gate-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);

const bridge=read('page-bridge.js');
need(bridge,'const nativeFetch = window.fetch.bind(window);');need(bridge,'conversation_detail_get_disabled');need(bridge,'project_move_requires_governance');forbid(bridge,'window.fetch =');forbid(bridge,'globalThis.fetch =');
const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await waitForQuiet()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset');

const app=read('app-v090.js');
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

const truth=read('sidebar-truth-v127.js');
for(const token of ['window.__NIAKGPT_PROJECTS_AUTHORITY_112__=true','projectInventoryVerified','projectInventorySource:\'sidebar-truth-v127\'','limit:\'100\'','next_page_cursor','nativeProjectIds','customCount','stableScans>=2','ng127InventoryReady','releaseNative','suppressNative'])need(truth,token,'0.9.73 live sidebar truth gate incomplete');
forbid(truth,'setInterval(','live sidebar truth gate must remain event-bounded');
const truthCss=read('sidebar-truth-v127.css');
for(const token of ['data-ng127-inventory-ready','display:none!important','border-color:transparent!important','box-shadow:none!important'])need(truthCss,token,'0.9.73 screenshot-derived sidebar CSS guard incomplete');
const nativeDa=read('native-da-v112.css');
for(const token of ['border-radius:5px!important','background:linear-gradient(90deg,rgba(55,148,255'])forbid(nativeDa,token,'native ChatGPT sidebar geometry must not be restyled');

const folders=read('pin-folders-v096.js');
for(const token of ['ng96-chat-entry','hydrateProject','publishProjectChats','drawerScrollMemory','innerScroll','outerScroll','restoreDrawerScroll','niakgpt:hydrate-project'])need(folders,token,'folder hydration/scroll continuity incomplete');
forbid(folders,'ensureFullProjectInventory','pin-folders must not compete with v121 catalog ownership');

const interruption=read('interruption-guard-v119.js');
for(const token of ['LIMIT_RX','VERIFY_RX','NETWORK_RX','nativeRetry','markCurrentOut','ng100-continue','tryNativeRecovery','incident.retried','resumePrompt','continueFrom?.(chatId)','failed\\s+to\\s+fetch'])need(interruption,token,'bounded interruption recovery incomplete');
for(const token of ['setInterval(','location.reload(','challenge.click(','iframe.click('])forbid(interruption,token,'interruption guard must not bypass security or loop recovery');

const nativeUx126=read('native-ux-v126.js');
for(const token of ['Paramètres du projet','openProjectSettings','__NIAKGPT_NATIVE_UX_125__=true','__NIAKGPT_SIDEBAR_ROUTE_PLACEMENT_125__=true','event.stopImmediatePropagation();return','input.click();event.preventDefault()','aucune redirection effectuée','niakgpt:sidebar-projects-reconcile','ng125NativeModal'])need(nativeUx126,token,'live native interaction repair incomplete');
for(const token of ['location.assign(`/g/','window.open('])forbid(nativeUx126,token,'project settings / modified click must not emulate navigation');
for(const token of ['setInterval(','location.reload('])forbid(nativeUx126,token,'live native UX must remain event-bounded');

const continuity126=read('continuity-live-v126.js');
for(const token of ['window.__NIAKGPT_CONTINUITY_112__=true','projectFromRenderedChat','projectFromProjectChats','PROJECT EXACT À CONSERVER','window.addEventListener(\'click\'','source:\'continuity-live-v126\'','nativeNavigate','setEditor','await clearPending();document.documentElement.dataset.ng126Continuity=\'ready\'','CONTINUITÉ NIAKGPT','ng119-interruption[data-type="limit"]'])need(continuity126,token,'live continuity handoff incomplete');
forbid(continuity126,'setInterval(','live continuity handoff must remain event-bounded');

const limit125=read('continuity-limit-v125.js');
for(const token of ['interactiveLimitCard','CONTINUE_RX','markCurrentOut','native-limit-v120','ng100-continue','ng125LimitReady'])need(limit125,token,'modern limit continuity incomplete');
forbid(limit125,'setInterval(','modern limit detection must remain event-bounded');
const uxCss126=read('native-ux-v126.css');
for(const token of ['grid-template-columns:minmax(0,1fr) 38px','width:36px','height:34px','pointer-events:auto','ng126-native-stage','ng126-project-settings-error','data-ng125-native-modal'])need(uxCss126,token,'live UX CSS incomplete');

const manifestText=JSON.stringify(manifest.content_scripts);
for(const css of ['sidebar-metadata-v118.css','sidebar-projects-authority-v112.css','sidebar-ux-v119.css','native-actions-v113.css','sidebar-actions-v123.css','interruption-guard-v119.css','chat-attention-v113.css','performance-guard-v112.css','sidebar-icons-v114.css','native-ux-v125.css','native-ux-v126.css','sidebar-truth-v127.css'])need(manifestText,css,`${css} missing from manifest`);
for(const css of ['native-rename-v112.css','sidebar-authority-v107.css','sidebar-expando-guard-v108.css','sidebar-projects-authority-v109.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v111.css'])forbid(manifestText,css,`${css} still wired`);

for(const file of ['visual-lab/sidebar-session-ux-v123.mjs','visual-lab/tests/sidebar-human-ux-v123.spec.js','visual-lab/tests/activity-long-running-v124.spec.js','visual-lab/tests/native-ux-v125.spec.js','visual-lab/tests/live-user-regressions-v126.spec.js','visual-lab/tests/live-sidebar-truth-v127.spec.js','visual-lab/experience-gate-v116.mjs','visual-lab/false-positive-signals-v121.mjs','visual-lab/live-sidebar-state-v122.mjs','visual-lab/user-reported-regressions-v120.mjs'])if(!fs.existsSync(file))fail(`required current regression gate missing ${file}`);
const sessionGate=read('visual-lab/sidebar-session-ux-v123.mjs');
for(const token of ['length:28','length:58','scroll snapped','Projects block drifted above native primary/logo area','Project menu is clipped/inside sidebar/not hit-testable','Chat menu is clipped/inside sidebar/not hit-testable','WCAG 2.5.8','sidebar remount did not recover','sidebar-session-ux-v123'])need(sessionGate,token,'cross-engine full-session sidebar gate incomplete');
const fixtureSpec=read('visual-lab/tests/sidebar-human-ux-v123.spec.js');
for(const token of ['full MV3 browser-fixture sidebar session UX','boot MV3 extension against deterministic ChatGPT fixture','Projects catalog is verified, complete, scrollable and visually stable','ng127InventoryReady','managed Projects must not become testable until v127 verified the fixture inventory and renderer','Project folder and chat drawer keep independent scroll positions','true toggles','Keyboard, focus and modal accessibility','Custom chat rename and move','Project custom rename targets only the exact Project native row','Late sidebar mount and route diversity','Conversation limit CTA really starts continuity','Network/generation error recovery preserves draft','more than 10 logical minutes'])need(fixtureSpec,token,'MV3 extension-on-fixture sidebar gate incomplete');
const longRunSpec=read('visual-lab/tests/activity-long-running-v124.spec.js');
for(const token of ['native long-running analysis stays active beyond 10 minutes without text growth','page.clock.fastForward(61_000)','10*60*1000','stop-generating'])need(longRunSpec,token,'silent long-running analysis gate incomplete');
const liveSpec=read('visual-lab/tests/live-user-regressions-v126.spec.js');
for(const token of ['visible in rendered evidence, not just source contracts','opens native popup without redirect','corners are all owned by the button','is not prevented by NiakGPT','actual file input chooser','No continuity UI before a native limit','project-settings-popup-v126','continuity-after-real-limit-v126'])need(liveSpec,token,'rendered regression evidence gate incomplete');
const truthSpec=read('visual-lab/tests/live-sidebar-truth-v127.spec.js');
for(const token of ['never replaces a larger native Project inventory with one cached pin','neutralises NiakGPT border/shadow leakage','cannot self-certify a one-Project inventory on its first scan'])need(truthSpec,token,'0.9.73 live screenshot regression gate incomplete');

const packageJson=read('visual-lab/package.json');
const packageVersion=JSON.parse(packageJson).devDependencies?.['@playwright/test'];if(packageVersion!=='1.62.1')fail(`Playwright package/image version drift: ${packageVersion}`);need(packageJson,'live-user-regressions-v126.spec.js','rendered regression spec missing from current suite');need(packageJson,'live-sidebar-truth-v127.spec.js','0.9.73 sidebar truth spec missing from current suite');
const workflow=read('.github/workflows/current-finalization.yml');
for(const token of ['chromium, firefox, webkit','sidebar-session-ux-v123.mjs','CURRENT LEFT SIDEBAR complete session contract','sidebar-human-ux-v123.spec.js','experience-linux:','extension-runtime-linux:','mcr.microsoft.com/playwright:v1.62.1-noble','PLAYWRIGHT_BROWSERS_PATH: /ms-playwright','HOME: /root'])need(workflow,token,'current full-session/cross-platform workflow incomplete');
const imageLines=workflow.split(/\r?\n/).filter(line=>/^\s+image:\s+mcr\.microsoft\.com\/playwright:v1\.62\.1-noble\s*$/.test(line));if(imageLines.length!==3)fail(`expected 3 pinned Linux Playwright image jobs, got ${imageLines.length}`);
if(/^\s*npx playwright install --with-deps\b/m.test(workflow))fail('Linux Finalization reintroduced apt --with-deps');

console.log(`NiakGPT ${manifest.version} current runtime invariants: OK`);