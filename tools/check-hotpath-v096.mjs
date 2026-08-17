import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const has=(s,t,m=`missing: ${t}`)=>{if(!s.includes(t))fail(m);};
const no=(s,t,m=`forbidden: ${t}`)=>{if(s.includes(t))fail(m);};

const background=read('background-v100.js');
const bridge=read('page-bridge.js');
const integrity=read('runtime-integrity-v101.js');
const manual=read('manual-lock-main-v085.js');
const app=read('app-v090.js');
const tabs=read('multitab-v090.js');
const panels=read('side-panels-v096.js');
const coach=read('coach-v101.js');
const activity=read('activity-ui-v097.js');

// Production MAIN world is deliberately tiny. The retired fetch/activity interceptors
// must never return: they were a freeze/crash risk on large ChatGPT conversations.
const mainBody=(background.match(/const\s+MAIN_RUNTIME\s*=\s*\[(.*?)\];/s)||[])[1]||'';
const mainFiles=[...mainBody.matchAll(/["']([^"']+\.js)["']/g)].map(x=>x[1]);
if(JSON.stringify(mainFiles)!==JSON.stringify(['page-bridge.js']))fail(`unsafe MAIN runtime: ${mainFiles.join(', ')}`);
no(background,"'hotcache-main-v084.js'",'Retired fetch hotcache reintroduced into bootstrap');
no(background,"'activity-main-v087.js'",'Retired MAIN activity interceptor reintroduced into bootstrap');
has(background,"'runtime-integrity-v101.js'",'Runtime integrity repair missing from bootstrap');
has(integrity,"reason='reseed-empty-core'",'Persisted empty Project core repair missing');
has(integrity,'domOnly:false','Real Project canonicalization missing');
has(integrity,"OFF · retiré du runtime",'Retired hotcache diagnostic suppression missing');

// Project-move verification never fetches a full conversation. Native/manual moves are
// confirmed from the DOM/cache, while bridge-issued PATCHes use a minimal assignment ACK.
has(bridge,'assignmentAcks','Project assignment acknowledgement cache missing');
has(bridge,"transport:'assignment-ack'",'Synthetic Project assignment ACK missing');
has(bridge,'conversation_detail_get_disabled','Full conversation GET guard missing');
no(manual,'window.fetch =','Manual Project lock must not wrap ChatGPT fetch');
no(manual,'window.fetch=','Manual Project lock must not wrap ChatGPT fetch');
has(manual,'niakgpt:manual-project-move-confirmed','DOM-confirmed manual Project move signal missing');
has(manual,'verifiedBy:\'native-dom\'','Manual Project move DOM verification marker missing');

// Native animation remains untouched; only idle/background coordination is allowed.
no(tabs,'niakgptCoordinatedRAF','Global NiakGPT RAF throttling reintroduced');
no(tabs,'rafTasks','RAF task registry reintroduced');
no(tabs,'virtualRafSeq','Virtual RAF sequence reintroduced');
no(tabs,'nativeRAF=','RAF wrapper reintroduced');
has(tabs,'niakgptCoordinatedIdle','Idle coordination must remain active');
has(tabs,'safeBroadcast','Closed BroadcastChannel guard missing');
has(tabs,'disposed','Multitab lifecycle disposal guard missing');

// Sidebar ownership must include native Project conversations so ChatGPT cannot render
// a second Project tree underneath NiakGPT's managed Project list.
has(app,'PROJECT_CHAT_SEL','Native Project conversation selector missing');
has(app,"const PROJECT_SEL = 'a[href^=\"/g/g-p-\"]:not([href*=\"/c/\"])'",'Native Project selector missing');
has(app,'function renderPins()','Managed Project renderer missing');

// Long conversations are incremental and bounded. A full-history characterData observer
// is explicitly forbidden because it is the main freeze/crash regression surface.
has(app,'scanTimer:0, scanToken:0, scanRunning:false, scanRequested:false','Bounded scan state missing');
has(app,'pendingMain:new Set()','Incremental main-node queue missing');
has(app,'MutationObserver(queueMainNodes)','Incremental conversation observer missing');
no(app,"main.querySelectorAll('pre').forEach(decorateCode)",'Duplicate synchronous full code scan reintroduced');
has(activity,'Never watch characterData across the whole conversation','Whole-thread characterData guard missing');

// Cache writes remain batched and protected from self-rehydration loops.
has(app,'function saveCacheSoon(delay=1600)','Batched Project cache writer missing');
has(app,'incoming?.at!==S.lastCacheWriteAt','Core cache feedback-loop guard missing');
no(app,'await saveCache();renderPins();renderPanel();','Per-Project full Project/Explorer redraw reintroduced');

// Project pagination accepts compatible response shapes without inventing cursors.
has(app,"const nextCursor = data => data?.cursor ?? data?.next_cursor ?? data?.nextCursor ?? null",'Opaque cursor compatibility missing');
has(app,"listFrom(r.data,'items','conversations')",'Conversation-list response compatibility missing');
has(app,"listFrom(r.data,'items','projects','gizmos')",'Project-list response compatibility missing');

// Coach has a single owner outside the core and exposes status through the current dataset API.
no(app,'function ensureCoach()','Legacy core coach renderer reintroduced');
no(app,'function suggestionSet(prompt)','Legacy core coach classifier reintroduced');
has(coach,'root.dataset.ng100CoachStatus=text','Coach status dataset marker missing');
has(coach,"window.__NIAKGPT_DIAGNOSTICS__?.set('coach',text)",'Coach diagnostics bridge missing');

// Side panels stay native-looking overlays and do not wake from generation-network traffic.
no(panels,'niakgpt:activity-network','Side-panel adapter must not wake from generation traffic');
has(panels,'ng96-native-sidepanel','Native side-panel ownership marker missing');
has(panels,'ng96-native-side-trigger','Collapsed native side-panel handle support missing');
has(panels,'observer.observe(document.documentElement,{childList:true,subtree:true})','Side-panel structural observer missing');
no(panels,'characterData:true','Side-panel text mutation observer reintroduced');
has(panels,"document.addEventListener('click',()=>schedule(document,100),true)",'Side-panel interaction wakeup missing');
no(panels,'arm(7000)','Long startup body observer reintroduced');

console.log('NiakGPT 0.9.52 current hot-path/runtime invariants: OK');
