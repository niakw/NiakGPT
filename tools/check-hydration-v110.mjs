import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const main=['page-bridge.js'];
const isolated=[
  'onboarding-v101.js','profiles-v100.js','control-center-v090.js','cache-bus-v096.js','diagnostic-bus-v096.js',
  'cache-guardian-v100.js','recovery-v100.js','server-index-v100.js','commands-v100.js','browser-compat-v102.js',
  'lifecycle-guard-v104.js','multitab-v090.js','governance-adapter-v105.js','project-governance-v090.js',
  'governance-queue-v101.js','reclassify-v101.js','locale-fr-v101.js','project-pins-v090.js','sidebar-authority-v107.js',
  'sidebar-projects-authority-v110.js','sidebar-host-v090.js','app-v090.js','project-state-selfheal-v102.js',
  'project-assignment-selfheal-v103.js','breadcrumb-v100.js','continuity-v100.js','continuity-out-cache-v110.js',
  'visual-stability-v101.js','coach-v101.js','polish-v090.js','side-panels-v096.js','live-fixes-v104.js',
  'live-fixes-v106.js','chronology-v090.js','project-folders-v110.js','project-links-v106.js','activity-ui-v097.js','retro-loader-v097.js'
];

const manifest=JSON.parse(read('manifest.json'));
same(manifest.permissions,['storage','scripting'],'permissions mismatch');
same(manifest.host_permissions,['https://chatgpt.com/*'],'host scope mismatch');
same(manifest.content_scripts.flatMap(x=>x.js||[]),['boot-gate-v100.js'],'unexpected static runtime');
const release=manifest.version.split('.').map(Number);
if(release.length!==3||release.some(Number.isNaN)||release[0]!==0||release[1]!==9||release[2]<60)fail(`unexpected release ${manifest.version}`);
for(const css of ['live-fixes-v104.css','sidebar-authority-v107.css','sidebar-projects-authority-v109.css','project-chat-ux-v109.css'])need(JSON.stringify(manifest.content_scripts),css,`missing CSS ${css}`);

const background=read('background-v100.js');
const runtimeList=name=>[...(background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
same(runtimeList('MAIN_RUNTIME'),main,'MAIN runtime mismatch');
same(runtimeList('ISOLATED_RUNTIME'),isolated,'isolated runtime mismatch');
need(background,'chrome.scripting.executeScript');
need(background,'niakgpt:inject-runtime-v100');
for(const old of ["'sidebar-expando-guard-v108.js'","'sidebar-projects-authority-v109.js'","'pin-folders-v096.js'","'project-chat-ux-v109.js'"])forbid(background,old,`legacy competing runtime still injected: ${old}`);

for(const file of [...main,...isolated,'boot-gate-v100.js','background-v100.js']){
  if(!fs.existsSync(file))fail(`missing runtime ${file}`);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}
for(const file of isolated.filter(file=>file!=='retro-loader-v097.js'))forbid(read(file),'setInterval(',`permanent polling in ${file}`);
const loader=read('retro-loader-v097.js');need(loader,'function stopTicker()');need(loader,'clearInterval(timer)');

const bridge=read('page-bridge.js');
for(const token of ['const nativeFetch = window.fetch.bind(window);','conversation_detail_get_disabled','project_move_requires_governance',"error:'native_busy'"])need(bridge,token,`bridge missing ${token}`);
forbid(bridge,'window.fetch =','global fetch replacement reintroduced');

const gate=read('boot-gate-v100.js');
for(const token of ['await waitLoad()','await waitForChatShell()','await sleep(2500)','await waitForQuiet()','await nextFrames()','safeToMutate=true'])need(gate,token);
forbid(gate,'document.documentElement.dataset','pre-hydration html mutation');

const authority=read('sidebar-projects-authority-v110.js');
for(const token of ['ownProjectsPresent','sectionToken','rootObserver','ng109-native-projects-authoritative','FALLBACK · bloc NiakGPT absent'])need(authority,token,`0.9.60 Projects authority missing ${token}`);
forbid(authority,'setInterval(','0.9.60 Projects authority polling reintroduced');
forbid(authority,'window.fetch =','0.9.60 Projects authority must not hook fetch');

const folders=read('project-folders-v110.js');
for(const token of ['ng96-pin-drawer','ng109-chat-row','aria-current','ng109-chat-rename','ng109-out-badge','relevantPinMutation','rootObserver',"event.metaKey||event.ctrlKey||event.shiftKey||event.altKey"])need(folders,token,`0.9.60 Project folders missing ${token}`);
forbid(folders,'setInterval(','0.9.60 Project folders polling reintroduced');
forbid(folders,'window.fetch =','0.9.60 Project folders must not hook fetch');

const outCache=read('continuity-out-cache-v110.js');
for(const token of ['out:true','outUpdatedAt','projectChats','bus?.get&&bus?.update'])need(outCache,token,`0.9.60 OUT cache missing ${token}`);
forbid(outCache,'setInterval(','0.9.60 OUT cache polling reintroduced');

const selfheal=read('project-state-selfheal-v102.js');
for(const token of ['repairGovernance','mergeNativeCanonical','renderFallback','niakgpt:force-server-index'])need(selfheal,token,`Project self-heal missing ${token}`);
const assignment=read('project-assignment-selfheal-v103.js');
for(const token of ['localToCanonical','projectId:target','AUTO-RÉPARÉ'])need(assignment,token,`Project assignment self-heal missing ${token}`);
const reclassify=read('reclassify-v101.js');for(const token of ['RECENT_CATCHUP_MS','recentUnassigned','needsClassification'])need(reclassify,token,`classification catch-up missing ${token}`);
need(read('activity-ui-v097.js'),'Never watch characterData across the whole conversation','activity hot-path guard missing');
need(read('chronology-v090.js'),"document.createElement('time')",'chronology must emit semantic time nodes');

console.log(`NiakGPT ${manifest.version} hydration-safe 0.9.60 runtime invariants: OK`);
