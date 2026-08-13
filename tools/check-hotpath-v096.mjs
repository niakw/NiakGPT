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

// Project indexing must not redraw the full Project UI per Project.
no(app,'await saveCache();renderPins();renderPanel();','Per-Project full Project/Explorer redraw reintroduced');
no(app,'renderPins();decorateSidebar();','Duplicate Project render reintroduced');
has(app,"health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);await saveCache();",'Cache-only per-Project index step missing');
has(app,'await saveCache();decorateSidebar();if(S.panelOpen)renderPanel();','Consolidated end-of-index render missing');

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
