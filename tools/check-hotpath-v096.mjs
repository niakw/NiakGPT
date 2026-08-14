import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const has=(s,t,m=`missing: ${t}`)=>{if(!s.includes(t))fail(m);};
const no=(s,t,m=`forbidden: ${t}`)=>{if(s.includes(t))fail(m);};

const app=read('app-v090.js');
const tabs=read('multitab-v090.js');
const control=read('control-center-v090.js');
const commands=read('commands-v100.js');
const gov=read('project-governance-v090.js');
const reclassify=read('reclassify-v101.js');
const locale=read('locale-fr-v101.js');
const visual=read('visual-stability-v101.js');
const visualCss=read('visual-stability-v101.css');
const activity=read('activity-ui-v097.js');
const sidebarHost=read('sidebar-host-v090.js');
const chronology=read('chronology-v090.js');
const pins=read('project-pins-v090.js');
const panels=read('side-panels-v096.js');
const polish=read('polish-v090.js');
const coach=read('coach-v101.js');
const loader=read('retro-loader-v097.js');
const hotcache=read('hotcache-main-v084.js');

// Matrix stays visually present but low-frequency, especially on CLIENT tabs.
has(app,"client?(mode==='normal'?360:700)",'client Matrix cadence must remain low');
has(app,'document.hidden?5000','hidden Matrix cadence must remain very low');
has(app,'mountObservers();ensureMatrix();wakeBackground();','Matrix must remount only on real route changes');

// Heavy state has one owner only: app-v090.js.
has(app,"const heavy=S.turns.length>=65||S.codeCount>=35",'Core heavy-thread owner missing');
has(app,"if(nodes.length>=65)document.documentElement.dataset.ng8Heavy='1'",'Initial heavy-thread guard missing');
has(visualCss,'content-visibility:auto','Offscreen turn paint skipping missing');
has(visualCss,'html[data-ng8-heavy="1"]','Heavy-thread visual guard missing');

// UI animation must stay native; coordination is for idle/background work only.
no(tabs,'niakgptCoordinatedRAF','Global NiakGPT RAF throttling reintroduced');
no(tabs,'rafTasks','RAF task registry reintroduced');
no(tabs,'virtualRafSeq','Virtual RAF sequence reintroduced');
no(tabs,'nativeRAF=','RAF wrapper reintroduced');
has(tabs,'niakgptCoordinatedIdle','Idle coordination must remain active');

// Control Center waits for its rail with one bounded direct-child observer, never a retry loop.
has(control,'railObserver.observe(document.body,{childList:true})','Control Center rail observer missing');
has(control,'railWatchdog=setTimeout(stopRailWatch,15000)','Control Center rail watchdog missing');
no(control,'setTimeout(ensureButton,700)','Control Center permanent rail retry reintroduced');
has(control,'CENTRE DE CONTRÔLE','Control Center French source label missing');
has(commands,"title:'Ouverture rapide'",'French command palette source missing');
has(commands,"title:'Gouvernance des projets'",'French Governance command missing');

// Conversation clicks must not wake administrative modules.
has(gov,"if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control,#ng85-governance'))return;",'Governance click scope missing');
has(chronology,"target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-pins')",'Chronology click scope missing');
has(pins,"if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control'))return;",'Native-pin click scope missing');

// Initial heavy-thread decoration yields in small chunks and pauses during generation.
has(app,'scanTimer:0, scanToken:0','Chunked scan state missing');
has(app,'const end=Math.min(index+20,nodes.length)','Chunked initial conversation scan missing');
has(app,"if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}",'Initial scan must pause during activity');
no(app,"main.querySelectorAll('pre').forEach(decorateCode)",'Duplicate synchronous full code scan reintroduced');

// Activity tracking must not observe giant hydration as if it were model generation.
has(activity,"const GENERATING=new Set(['waiting','thinking','executing'])",'Activity generating-state split missing');
has(activity,"if(state==='loading')",'Loading-specific activity path missing');
has(activity,'disarmActive();scheduleDeadline();scheduleSettle(650)','Loading must stay observer-free');
has(activity,'if(!root||!GENERATING.has(localState))return','Deep activity observer must be generation-only');

// Project indexing batches full storage writes and never self-rehydrates its own save.
has(app,'function saveCacheSoon(delay=1600)','Batched Project cache writer missing');
has(app,"health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);saveCacheSoon();",'Per-Project cache batching missing');
no(app,"health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);await saveCache();",'Per-Project full storage write reintroduced');
has(app,'await saveCache();decorateSidebar();if(S.panelOpen)renderPanel();','Consolidated end-of-index flush/render missing');
has(app,'incoming?.at!==S.lastCacheWriteAt','Core cache feedback-loop guard missing');
no(app,'await saveCache();renderPins();renderPanel();','Per-Project full Project/Explorer redraw reintroduced');
no(app,'renderPins();decorateSidebar();','Duplicate Project render reintroduced');

// Project pagination accepts compatible response shapes without inventing cursors.
has(app,"const nextCursor = data => data?.cursor ?? data?.next_cursor ?? data?.nextCursor ?? null",'Opaque cursor compatibility missing');
has(app,"listFrom(r.data,'items','conversations')",'Conversation-list response compatibility missing');
has(app,"listFrom(r.data,'items','projects','gizmos')",'Project-list response compatibility missing');

// AUTO rebuild: moves are bounded, concurrent, resumable, and avoid redundant verification GETs.
has(sidebarHost,'const MOVE_CONCURRENCY=4','AUTO rebuild move concurrency missing');
has(sidebarHost,'Promise.all(batch.map','AUTO rebuild verified batching missing');
has(sidebarHost,'if(ack===expected)return true','AUTO rebuild PATCH acknowledgement fast-path missing');
has(sidebarHost,"'a classer','hors projet'",'Unclassified queue must stay excluded from recurring Projects');
has(sidebarHost,'if(hasTerm(text,key))','AUTO rebuild must use boundary-safe category terms');
no(sidebarHost,"keys:['famille','mariage','voiture','auto','santé','sante','fatigue','chat','chats'",'Chat/ChatGPT substring classifier regression reintroduced');

// Automatic reclassification stays bounded and obeys Governance/Safe Mode.
has(reclassify,'const BATCH=8','Reclassification batch bound missing');
has(reclassify,'const CONFIDENCE=58','Reclassification confidence floor missing');
has(reclassify,'gov.autoResync===false','Reclassification must honor auto-resync setting');
has(reclassify,'!p.domOnly','Reclassification must never target DOM-only pseudo Projects');
has(reclassify,'navigator.locks.request','Reclassification cross-tab lock missing');
has(reclassify,'if(hasTerm(text,key))','Reclassification category matching must stay boundary-safe');

// French localization: only Project/UI interactions may arm the temporary body observer.
has(locale,"['add to project','Ajouter au projet']",'French Add to project translation missing');
has(locale,'function schedule(delay=40,root=null){if(!root)return;','Locale wakeup must require a relevant UI root');
has(locale,'setTimeout(scanOpenSurfaces,900)','Locale startup must scan open UI surfaces only');
has(locale,'scanOpenSurfaces()','Open menu/dialog rescan missing');
no(locale,"document.addEventListener('click'",'Normal conversation clicks must not arm localization');
no(locale,'setInterval(','Locale adapter must not poll');

// Viewer detection only wakes after an image intent and never polls; Matrix is detached from volatile main.
has(visual,'if(imageIntent(target))armDetector()','Image viewer detection must stay interaction-driven');
has(visual,'activeObserver.observe(parent,{childList:true})','Viewer observer must stay locally scoped');
has(visual,'document.body.prepend(matrix)','Matrix must be reparented out of giant main');
no(visual,'setInterval(','Image viewer adapter must not poll');
has(visualCss,'form:has(#prompt-textarea)','Composer border cleanup missing');

// Hot cache bounds both staleness and RAM, and a tab waiting on the lock rechecks disk.
has(hotcache,'const MAX_MEMORY_ENTRIES = 2','Hot-cache RAM entry bound missing');
has(hotcache,'const MAX_MEMORY_BYTES = 48 * 1024 * 1024','Hot-cache RAM byte bound missing');
has(hotcache,'const KNOWN_META_TTL = 15 * 60 * 1000','Known-metadata freshness bound missing');
has(hotcache,'latest <= entry.updateTime && age <= KNOWN_META_TTL','Known cache entries can become stale');
has(hotcache,'const latest = await getEntry(id, true)','Cross-tab lock must recheck IndexedDB');
has(hotcache,"m.type === 'invalidate' || m.type === 'updated'",'Cross-tab RAM invalidation missing');

// Coach must have a single owner and must not rescan the long thread on each keystroke.
no(app,'function ensureCoach()','Legacy core coach renderer reintroduced');
no(app,'function suggestionSet(prompt)','Legacy core coach classifier reintroduced');
has(coach,"setAttribute('data-ng100-coach-status',text)",'Coach status DOM attribute missing');
has(coach,'if(!recentDirty)return recentCache','Coach recent-context cache missing');
has(coach,"if(nextActivity==='ready'&&lastActivity!=='ready')invalidateRecent()",'Coach context invalidation missing');

// Native side panels: no generation listener and no body scan while ChatGPT is active.
no(panels,'niakgpt:activity-network','Side-panel adapter must not wake from generation traffic');
no(panels,'arm(7000)','Long startup body observer reintroduced');
has(panels,"const ready=()=>document.documentElement.dataset.ng86Activity==='ready'",'Side-panel readiness guard missing');
has(panels,'if(!ready())return false','Side-panel scan must pause during activity');
has(panels,'if(!relevant)return;arm();scheduleScan(80','Side-panel interaction scoping missing');
has(panels,'const closeHost=head instanceof HTMLElement?head:panel;','sticky side-panel close missing');
no(polish,'MutationObserver','Duplicate panel observer reintroduced in polish');

// Loader repaint cadence backs off on heavy chats.
has(loader,"if (root.dataset.ng8Heavy === '1') return 700",'Heavy loader throttle missing');
has(loader,"if (root.dataset.ng86Activity === 'loading') return 420",'Loading loader throttle missing');

console.log('NiakGPT 0.9.11 hot-path invariants: OK');
