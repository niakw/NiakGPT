import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const [metadataJs,metadataCss]=await Promise.all(['sidebar-metadata-v118.js','sidebar-metadata-v118.css'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const GOOD='g-p-good',REALDATE='g-p-date-real',BAD='dom-p-date1708',NESTED='dom-p-nested-date';
      const CID='11111111-1111-4111-8111-111111111111',CID2='22222222-2222-4222-8222-222222222222',CID3='33333333-3333-4333-8333-333333333333',CID4='44444444-4444-4444-8444-444444444444';
      const badChat={id:CID,title:'Chat test',projectId:BAD,href:`/g/${GOOD}/c/${CID}`,updated:1};
      const nestedChat={id:CID2,title:'Nested ghost chat',projectId:NESTED,href:`/g/${GOOD}/c/${CID2}`,updated:2};
      const realDateChat={id:CID3,title:'Real date Project chat',projectId:REALDATE,href:`/c/${CID3}`,updated:3};
      const existingGood={id:CID4,title:'Existing Studio chat',projectId:GOOD,href:`/g/${GOOD}/c/${CID4}`,updated:4};
      window.__labRaw={schema:2,at:1,projects:[{id:GOOD,name:'Studio',href:`/g/${GOOD}/project`,domOnly:false},{id:REALDATE,name:'Today',href:`/g/${REALDATE}/project`,domOnly:true},{id:BAD,name:'17/08',href:`/c/${CID}`,domOnly:true},{id:NESTED,name:'Yesterday',href:`/g/${GOOD}/c/${CID2}`,domOnly:true}],chats:[badChat,nestedChat,realDateChat,existingGood],counts:{[GOOD]:1,[REALDATE]:1,[BAD]:1,[NESTED]:1},projectChats:{[GOOD]:[existingGood],[REALDATE]:[realDateChat],[BAD]:[badChat],[NESTED]:[nestedChat]},indexedProjectIds:[GOOD,REALDATE,BAD,NESTED]};
      window.__subs=[];window.__subscribeSnapshots=[];window.__raceEvents=[];
      const publish=(next,label='publish')=>{window.__labRaw=structuredClone(next);window.__raceEvents.push(`${label}:${(window.__labRaw.projects||[]).map(p=>p.id).join(',')}`);for(const sub of [...window.__subs])sub(window.__labRaw);};
      window.__publishLabRaw=publish;
      window.__NIAKGPT_CACHE_BUS__={
        async get(){await new Promise(r=>setTimeout(r,80));return window.__labRaw;},
        peek(){return window.__labRaw;},
        async update(fn){const next=await fn(window.__labRaw)||window.__labRaw;await new Promise(r=>setTimeout(r,80));publish(next,'bus');return window.__labRaw;},
        subscribe(fn){window.__subs.push(fn);queueMicrotask(()=>{window.__subscribeSnapshots.push((window.__labRaw.projects||[]).map(p=>p.id));fn(window.__labRaw);});return()=>{window.__subs=window.__subs.filter(x=>x!==fn);};}
      };
      window.chrome={storage:{local:{async get(){return{'niakgpt-v08-cache':window.__labRaw};},async set(obj){await new Promise(r=>setTimeout(r,80));if(obj['niakgpt-v08-cache'])publish(obj['niakgpt-v08-cache'],'storage');}},onChanged:{addListener(){}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    });
    const html=`<!doctype html><html><body><nav data-testid="conversation-sidebar"><section id="native-projects"><h3>Projects</h3><a href="/g/g-p-good/project">Studio</a><button>Afficher plus</button></section><section id="recents"><a id="chat" href="/c/11111111-1111-4111-8111-111111111111"><span>Chat test</span><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a><a id="real-date-chat" href="/c/33333333-3333-4333-8333-333333333333"><span>Real date Project chat</span><span class="ng8-chat-project">Today</span></a></section><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-good/project"><span>Studio</span></a></section></nav></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:metadataCss});
    const started=Date.now();
    await page.evaluate(metadataJs);
    const injectionMs=Date.now()-started;
    await page.waitForTimeout(20);
    const state=await page.evaluate(()=>({
      ready:window.__NIAKGPT_METADATA_READY_118__||'',nativeDisplay:getComputedStyle(document.getElementById('native-projects')).display,dateTag:document.querySelector('#chat .ng8-chat-date')?.tagName||'',fakeBadge:!!document.querySelector('#chat .ng8-chat-project'),realDateBadge:document.querySelector('#real-date-chat .ng8-chat-project')?.textContent||'',
      badProjects:(window.__labRaw.projects||[]).filter(p=>p.id==='dom-p-date1708').length,nestedGhosts:(window.__labRaw.projects||[]).filter(p=>p.id==='dom-p-nested-date').length,realDateProject:(window.__labRaw.projects||[]).find(p=>p.id==='g-p-date-real')||null,
      chatProject:(window.__labRaw.chats||[]).find(c=>c.id==='11111111-1111-4111-8111-111111111111')?.projectId||'',nestedChatProject:(window.__labRaw.chats||[]).find(c=>c.id==='22222222-2222-4222-8222-222222222222')?.projectId||'',
      goodDirect:(window.__labRaw.projectChats?.['g-p-good']||[]).map(c=>c?.id),goodCount:window.__labRaw.counts?.['g-p-good']||0,
      badCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'dom-p-date1708'),nestedCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'dom-p-nested-date'),badIndexed:(window.__labRaw.indexedProjectIds||[]).includes('dom-p-date1708'),nestedIndexed:(window.__labRaw.indexedProjectIds||[]).includes('dom-p-nested-date'),realDateCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'g-p-date-real'),realDateIndexed:(window.__labRaw.indexedProjectIds||[]).includes('g-p-date-real'),authorityMarks:document.querySelectorAll('[data-ng112-native-projects],.ng107-native-project-row,.ng107-native-project-cluster,.ng108-native-project-expando,.ng8-native-project-link-suppressed').length,subscribeSnapshots:window.__subscribeSnapshots
    }));
    assert(injectionMs>=140,`async metadata injection returned before delayed read+write sanitation completed (${injectionMs}ms)`);
    assert(state.ready==='ready',`metadata injection resolved before readiness: ${JSON.stringify(state)}`);
    assert(state.subscribeSnapshots.length>=1&&!state.subscribeSnapshots[0].includes('dom-p-date1708')&&!state.subscribeSnapshots[0].includes('dom-p-nested-date'),`cache subscription was armed before initial sanitation completed: ${JSON.stringify(state.subscribeSnapshots)}`);
    assert(state.nativeDisplay!=='none'&&state.authorityMarks===0,`metadata module mutated native Projects authority: ${JSON.stringify(state)}`);
    assert(state.dateTag==='TIME'&&!state.fakeBadge,'fake date metadata was not normalized/removed');
    assert(state.realDateBadge==='Today',`canonical date-named Project badge was removed: ${JSON.stringify(state)}`);
    assert(state.badProjects===0&&!state.badCount&&!state.badIndexed,'date-shaped ghost Project survived cache cleanup');
    assert(state.nestedGhosts===0&&!state.nestedCount&&!state.nestedIndexed,`date ghost nested under a canonical Project chat survived cache cleanup: ${JSON.stringify(state)}`);
    assert(state.realDateProject?.name==='Today'&&state.realDateCount&&state.realDateIndexed,`canonical date-named Project was deleted as a ghost: ${JSON.stringify(state)}`);
    assert(state.chatProject==='g-p-good'&&state.nestedChatProject==='g-p-good',`recovered chats did not resolve to canonical Project: ${JSON.stringify(state)}`);
    assert(state.goodDirect.length===3&&['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444'].every(id=>state.goodDirect.includes(id)),`recovered chats missing from existing Project snapshot: ${JSON.stringify(state)}`);
    assert(state.goodCount>=3,`recovered Project count stayed below known chats: ${JSON.stringify(state)}`);

    const supportsLocks=await page.evaluate(()=>!!navigator.locks?.request);
    assert(supportsLocks,`${engine} does not expose Web Locks on secure chatgpt.com test origin`);
    await page.evaluate(()=>{
      const A={schema:2,at:2,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'dom-race-a',name:'Today',domOnly:true}],chats:[],counts:{'dom-race-a':1},projectChats:{'dom-race-a':[]},indexedProjectIds:['g-p-good','dom-race-a']};
      const B={schema:2,at:3,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'g-p-two',name:'Two',domOnly:false},{id:'dom-race-b',name:'Yesterday',domOnly:true}],chats:[],counts:{'dom-race-b':1},projectChats:{'dom-race-b':[]},indexedProjectIds:['g-p-good','g-p-two','dom-race-b']};
      window.__publishLabRaw(A,'race-a');setTimeout(()=>navigator.locks.request('niakgpt-data-mutation-v100',{mode:'exclusive'},async()=>window.__publishLabRaw(B,'race-b')),20);
    });
    await page.waitForTimeout(280);
    const race=await page.evaluate(()=>({ids:(window.__labRaw.projects||[]).map(p=>p.id),events:window.__raceEvents}));
    assert(race.ids.includes('g-p-two'),`metadata sanitation overwrote a later lock-coordinated cache publication: ${JSON.stringify(race)}`);
    assert(!race.ids.includes('dom-race-b'),`later lock-coordinated dirty cache was not sanitized: ${JSON.stringify(race)}`);
    console.log(`${engine} sidebar metadata barrier + canonical badges + recovered snapshots + shared-lock race: PASS · ${injectionMs}ms`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-metadata-v118: ${Object.keys(engines).join(',')} PASS`);
await import('./sidebar-metadata-failure-v119.mjs');
