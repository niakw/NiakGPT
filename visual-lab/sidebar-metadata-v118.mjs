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
      const GOOD='g-p-good',BAD='dom-p-date1708',CID='11111111-1111-4111-8111-111111111111';
      window.__labRaw={schema:2,at:1,projects:[{id:GOOD,name:'Studio',href:`/g/${GOOD}/project`,domOnly:false},{id:BAD,name:'17/08',href:`/c/${CID}`,domOnly:true}],chats:[{id:CID,title:'Chat test',projectId:BAD,href:`/g/${GOOD}/c/${CID}`,updated:1}],counts:{[GOOD]:1,[BAD]:1},projectChats:{[BAD]:[]},indexedProjectIds:[GOOD,BAD]};
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
    const html=`<!doctype html><html><body><nav data-testid="conversation-sidebar"><section id="native-projects"><h3>Projects</h3><a href="/g/g-p-good/project">Studio</a><button>Afficher plus</button></section><section id="recents"><a id="chat" href="/c/11111111-1111-4111-8111-111111111111"><span>Chat test</span><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a></section><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-good/project"><span>Studio</span></a></section></nav></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:metadataCss});
    const started=Date.now();
    await page.evaluate(metadataJs);
    const injectionMs=Date.now()-started;
    await page.waitForTimeout(20);
    const state=await page.evaluate(()=>({
      ready:window.__NIAKGPT_METADATA_READY_118__||'',
      nativeDisplay:getComputedStyle(document.getElementById('native-projects')).display,
      nativeClasses:[...document.getElementById('native-projects').classList],
      dateTag:document.querySelector('#chat .ng8-chat-date')?.tagName||'',
      fakeBadge:!!document.querySelector('#chat .ng8-chat-project'),
      badProjects:(window.__labRaw.projects||[]).filter(p=>p.id==='dom-p-date1708').length,
      chatProject:(window.__labRaw.chats||[]).find(c=>c.id==='11111111-1111-4111-8111-111111111111')?.projectId||'',
      badCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'dom-p-date1708'),
      badIndexed:(window.__labRaw.indexedProjectIds||[]).includes('dom-p-date1708'),
      authorityMarks:document.querySelectorAll('[data-ng112-native-projects],.ng107-native-project-row,.ng107-native-project-cluster,.ng108-native-project-expando,.ng8-native-project-link-suppressed').length,
      subscribeSnapshots:window.__subscribeSnapshots,
    }));
    assert(injectionMs>=140,`async metadata injection returned before delayed read+write sanitation completed (${injectionMs}ms)`);
    assert(state.ready==='ready',`metadata injection resolved before readiness: ${JSON.stringify(state)}`);
    assert(state.subscribeSnapshots.length>=1&&!state.subscribeSnapshots[0].includes('dom-p-date1708'),`cache subscription was armed before initial sanitation completed: ${JSON.stringify(state.subscribeSnapshots)}`);
    assert(state.nativeDisplay!=='none',`metadata module suppressed native Projects: ${JSON.stringify(state)}`);
    assert(state.authorityMarks===0,`metadata module created authority marks: ${JSON.stringify(state)}`);
    assert(state.dateTag==='TIME','date metadata was not normalized to <time>');
    assert(!state.fakeBadge,'date-shaped fake Project badge survived');
    assert(state.badProjects===0&&!state.badCount&&!state.badIndexed,'date-shaped ghost Project survived cache cleanup');
    assert(state.chatProject==='g-p-good',`chat Project recovery failed: ${JSON.stringify(state)}`);

    const supportsLocks=await page.evaluate(()=>!!navigator.locks?.request);
    assert(supportsLocks,`${engine} does not expose Web Locks on secure chatgpt.com test origin`);
    await page.evaluate(()=>{
      const A={schema:2,at:2,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'dom-race-a',name:'Today',domOnly:true}],chats:[],counts:{'dom-race-a':1},projectChats:{'dom-race-a':[]},indexedProjectIds:['g-p-good','dom-race-a']};
      const B={schema:2,at:3,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'g-p-two',name:'Two',domOnly:false},{id:'dom-race-b',name:'Yesterday',domOnly:true}],chats:[],counts:{'dom-race-b':1},projectChats:{'dom-race-b':[]},indexedProjectIds:['g-p-good','g-p-two','dom-race-b']};
      window.__publishLabRaw(A,'race-a');
      setTimeout(()=>navigator.locks.request('niakgpt-data-mutation-v100',{mode:'exclusive'},async()=>window.__publishLabRaw(B,'race-b')),20);
    });
    await page.waitForTimeout(280);
    const race=await page.evaluate(()=>({ids:(window.__labRaw.projects||[]).map(p=>p.id),events:window.__raceEvents}));
    assert(race.ids.includes('g-p-two'),`metadata sanitation overwrote a later lock-coordinated cache publication: ${JSON.stringify(race)}`);
    assert(!race.ids.includes('dom-race-b'),`later lock-coordinated dirty cache was not sanitized: ${JSON.stringify(race)}`);
    console.log(`${engine} sidebar metadata read+write barrier + shared-lock race: PASS · ${injectionMs}ms`);
  }finally{
    await context.close();
    await browser.close();
  }
}
console.log(`sidebar-metadata-v118: ${Object.keys(engines).join(',')} PASS`);
