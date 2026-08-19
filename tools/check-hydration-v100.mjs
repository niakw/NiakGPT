import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};

const manifest=JSON.parse(read('manifest.json'));
if(manifest.manifest_version!==3)fail('manifest_version drift');
if(manifest.version!=='0.9.67')fail(`unexpected release ${manifest.version}`);
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
const main=runtimeList('MAIN_RUNTIME'),isolated=runtimeList('ISOLATED_RUNTIME');
same(main,['page-bridge.js'],'MAIN runtime mismatch');
for(const file of ['sidebar-projects-authority-v112.js','pin-folders-v096.js','native-actions-v113.js','chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','performance-guard-v112.js','reclassify-deep-v112.js','continuity-v112.js'])if(!isolated.includes(file))fail(`current runtime missing ${file}`);
for(const file of ['project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-projects-authority-v109.js','sidebar-projects-authority-v110.js','sidebar-projects-authority-v111.js'])if(isolated.includes(file))fail(`legacy runtime loaded ${file}`);
for(const file of isolated.filter(x=>x!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
for(const file of [...main,...isolated,'background-v100.js','boot-gate-v100.js'])if(!fs.existsSync(file))fail(`missing runtime ${file}`);

const bridge=read('page-bridge.js');
need(bridge,'const nativeFetch = window.fetch.bind(window);');need(bridge,'conversation_detail_get_disabled');need(bridge,'project_move_requires_governance');forbid(bridge,'window.fetch =');forbid(bridge,'globalThis.fetch =');
const gate=read('boot-gate-v100.js');for(const token of ['await waitLoad()','await waitForChatShell()','await waitForQuiet()','safeToMutate=true'])need(gate,token);forbid(gate,'document.documentElement.dataset');
const app=read('app-v090.js');need(app,'MutationObserver(queueMainNodes)');need(app,'function renderPins()');need(app,"label.textContent=String(turn.innerText||turn.textContent||'')",'TOC DOM text must stay textContent');forbid(app,'function routeTick()');

const projects=read('sidebar-projects-authority-v112.js');
for(const token of ["const MARK='data-ng112-native-projects'",'sharesSidebarShell','managedIdentityCount','identityHosts','watchRoots','bindObservers','childList:true','FALLBACK · bloc NiakGPT absent'])need(projects,token,'passive Projects authority incomplete');
for(const token of ['attributes:true','attributeFilter:','classList.add(HIDE)'])forbid(projects,token,'Projects authority must not watch or churn native classes');
forbid(projects,"setAttribute('aria-hidden'",'Projects authority must not rewrite native ARIA state');
const projectsCss=read('sidebar-projects-authority-v112.css');need(projectsCss,'[data-ng112-native-projects="1"]','passive Projects CSS marker missing');

const folders=read('pin-folders-v096.js');for(const token of ['ng96-pin-drawer','drawerDirty','cooperativeNode','existing.previousElementSibling===entry','stopImmediatePropagation'])need(folders,token,'pin idle stability incomplete');
forbid(folders,"open.className='ng96-project-open'",'obsolete open-page button must stay removed');
const actions=read('native-actions-v113.js');for(const token of ['invokeNativeMenu','fallbackChatMenu','fallbackMove','data-ng112-native-projects','ng113-native-actions-project','ng113-native-actions-chat','placeFloatingMenu','ng113-native-menu-floating',"insertAdjacentElement('afterend',actionButton('chat',id))"])need(actions,token,'native/sidebar actions incomplete');
const state=read('chat-state-authority-v113.js');need(state,'iu>pu');need(state,'iu===pu');
const breadcrumb=read('breadcrumb-v113.js');need(breadcrumb,'>Accueil<');need(breadcrumb,'ng100-bc-current');
const attention=read('chat-attention-v113.js');need(attention,'ng113Unread');need(attention,'markSeen');
const perf=read('performance-guard-v112.js');need(perf,'COLD_KEEP=44');need(perf,'requestIdleCallback');
const deep=read('reclassify-deep-v112.js');need(deep,'MAX_PER_RUN=2');need(deep,'MAX_HEAVY=1');
const continuity=read('continuity-v112.js');need(continuity,'exactProject:true');need(continuity,"source:'continuity-exact'");

const manifestText=JSON.stringify(manifest.content_scripts);
for(const css of ['sidebar-projects-authority-v112.css','native-actions-v113.css','chat-attention-v113.css','performance-guard-v112.css','sidebar-icons-v114.css'])need(manifestText,css,`${css} missing from manifest`);
for(const css of ['native-rename-v112.css','sidebar-projects-authority-v109.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v111.css'])forbid(manifestText,css,`${css} still wired`);

if(!fs.existsSync('visual-lab/experience-gate-v116.mjs'))fail('experience gate missing');
if(!fs.existsSync('visual-lab/sidebar-hitboxes-v117.mjs'))fail('left-sidebar hitbox gate missing');
const workflow=read('.github/workflows/current-finalization.yml');
for(const token of ['ubuntu-latest, windows-latest, macos-latest','chromium, firefox, webkit','Human / DOM / errors / UX / remount / anti-churn','experience-gate-v116.mjs','sidebar-hitboxes-v117.mjs','LEFT SIDEBAR pixel hitboxes','PRIMARY real Brave — left sidebar'])need(workflow,token,'cross-platform/sidebar experience matrix incomplete');
console.log(`NiakGPT ${manifest.version} current runtime invariants: OK`);
