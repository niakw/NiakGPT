import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const has=(s,t,m=`missing: ${t}`)=>{if(!s.includes(t))fail(m);};
const no=(s,t,m=`forbidden: ${t}`)=>{if(s.includes(t))fail(m);};

const app=read('app-v090.js');
const tabs=read('multitab-v090.js');
const gov=read('project-governance-v090.js');
const chronology=read('chronology-v090.js');
const pins=read('project-pins-v090.js');
const panels=read('side-panels-v096.js');
const polish=read('polish-v090.js');
const coach=read('coach-v100.js');
const hotcache=read('hotcache-main-v084.js');

// Matrix stays visually present but low-frequency, especially on CLIENT tabs.
has(app,"client?(mode==='normal'?360:700)",'client Matrix cadence must remain low');
has(app,'document.hidden?5000','hidden Matrix cadence must remain very low');
has(app,'mountObservers();ensureMatrix();wakeBackground();','Matrix must remount only on real route changes');

// UI animation must stay native; coordination is for idle/background work only.
no(tabs,'niakgptCoordinatedRAF','Global NiakGPT RAF throttling reintroduced');
no(tabs,'rafTasks','RAF task registry reintroduced');
no(tabs,'virtualRafSeq','Virtual RAF sequence reintroduced');
no(tabs,'nativeRAF=','RAF wrapper reintroduced');
has(tabs,'niakgptCoordinatedIdle','Idle coordination must remain active');

// Conversation clicks must not wake administrative modules.
has(gov,"if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control,#ng85-governance'))return;",'Governance click scope missing');
has(chronology,"target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-pins')",'Chronology click scope missing');
has(pins,"if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control'))return;",'Native-pin click scope missing');

// Initial heavy-thread decoration yields in small chunks and pauses during generation.
has(app,'scanTimer:0, scanToken:0','Chunked scan state missing');
has(app,'const end=Math.min(index+20,nodes.length)','Chunked initial conversation scan missing');
has(app,"if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}",'Initial scan must pause during activity');
no(app,"main.querySelectorAll('pre').forEach(decorateCode)",'Duplicate synchronous full code scan reintroduced');

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

// Hot cache bounds both staleness and RAM, and a tab waiting on the lock rechecks disk.
has(hotcache,'const MAX_MEMORY_ENTRIES = 2','Hot-cache RAM entry bound missing');
has(hotcache,'const MAX_MEMORY_BYTES = 48 * 1024 * 1024','Hot-cache RAM byte bound missing');
has(hotcache,'const KNOWN_META_TTL = 15 * 60 * 1000','Known-metadata freshness bound missing');
has(hotcache,'latest <= entry.updateTime && age <= KNOWN_META_TTL','Known cache entries can become stale');
has(hotcache,'const latest = await getEntry(id, true)','Cross-tab lock must recheck IndexedDB');
has(hotcache,"m.type === 'invalidate' || m.type === 'updated'",'Cross-tab RAM invalidation missing');

// Coach must have a single owner outside the core.
no(app,'function ensureCoach()','Legacy core coach renderer reintroduced');
no(app,'function suggestionSet(prompt)','Legacy core coach classifier reintroduced');
has(coach,"setAttribute('data-ng100-coach-status',text)",'Coach status DOM attribute missing');
has(coach,'stateObserver','Coach state wakeup missing');

// Native side panels: no generation listener and no always-on body observer at rest.
no(panels,'niakgpt:activity-network','Side-panel adapter must not wake from generation traffic');
no(panels,'arm(7000)','Long startup body observer reintroduced');
has(panels,"attributeFilter:['data-ng86-activity']",'Side-panel READY refresh observer missing');
has(panels,'if(!relevant)return;arm();scheduleScan(80','Side-panel interaction scoping missing');
has(panels,'const closeHost=head instanceof HTMLElement?head:panel;','sticky side-panel close missing');
no(polish,'MutationObserver','Duplicate panel observer reintroduced in polish');

console.log('NiakGPT 0.9.6 hot-path invariants: OK');
