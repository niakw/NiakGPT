import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const [metadataJs,cacheBusJs]=await Promise.all(['sidebar-metadata-v118.js','cache-bus-v096.js'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      window.__raw={projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'dom-date',name:'17/08',domOnly:true}],chats:[{id:'c1',title:'Chat',projectId:'dom-date',href:'/g/g-p-good/c/c1'}],counts:{'g-p-good':0,'dom-date':1},projectChats:{'dom-date':[]},indexedProjectIds:['g-p-good','dom-date']};
      window.__subscriptions=0;window.__writes=0;window.__events=[];
      const delay=ms=>new Promise(r=>setTimeout(r,ms));
      window.__NIAKGPT_CACHE_BUS__={
        async get(){window.__events.push('get:start');await delay(100);window.__events.push('get:end');return window.__raw;},
        peek(){return window.__raw;},
        async update(fn){const next=await fn(window.__raw)||window.__raw;window.__events.push('update:start');await delay(80);window.__raw=structuredClone(next);window.__writes++;window.__events.push('update:end');return window.__raw;},
        subscribe(){window.__subscriptions++;window.__events.push('subscribe');let live=true;return()=>{if(live){live=false;window.__subscriptions--;window.__events.push('unsubscribe');}};}
      };
      window.chrome={storage:{local:{get:async()=>({'niakgpt-v08-cache':window.__raw}),set:async obj=>{await delay(80);window.__raw=structuredClone(obj['niakgpt-v08-cache']);window.__writes++;}},onChanged:{addListener:()=>{}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:()=>{}};
      window.__fireTransition=(type,persisted=true)=>{const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});window.dispatchEvent(event);};
    });
    const html='<!doctype html><html><body><nav data-testid="conversation-sidebar"><a href="/c/c1"><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a></nav></body></html>';
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(async js=>{
      const initial=eval(js);
      await new Promise(r=>setTimeout(r,20));window.__fireTransition('pagehide',true);
      await new Promise(r=>setTimeout(r,10));const hidden={ready:window.__NIAKGPT_METADATA_READY_118__||'',subscriptions:window.__subscriptions};
      window.__fireTransition('pageshow',true);
      await initial;
      const deadline=performance.now()+800;while(performance.now()<deadline&&window.__NIAKGPT_METADATA_READY_118__!=='ready')await new Promise(r=>setTimeout(r,10));
      return{hidden,ready:window.__NIAKGPT_METADATA_READY_118__||'',subscriptions:window.__subscriptions,writes:window.__writes,bad:(window.__raw.projects||[]).some(p=>p.id==='dom-date'),chatProject:(window.__raw.chats||[]).find(c=>c.id==='c1')?.projectId||'',events:window.__events};
    },metadataJs);
    assert(outcome.hidden.ready==='stopped'&&outcome.hidden.subscriptions===0,`pagehide did not stop metadata before initial sanitation completed: ${JSON.stringify(outcome)}`);
    assert(outcome.ready==='ready',`persisted pageshow did not restore metadata readiness: ${JSON.stringify(outcome)}`);
    assert(outcome.subscriptions===1,`stale/current starts produced a missing or duplicate cache subscription: ${JSON.stringify(outcome)}`);
    assert(!outcome.bad&&outcome.chatProject==='g-p-good',`resumed metadata lifecycle did not finish sanitation: ${JSON.stringify(outcome)}`);
    assert(outcome.events.filter(x=>x==='subscribe').length===1,`stale start rearmed a second subscription after pageshow: ${JSON.stringify(outcome)}`);

    const racePage=await context.newPage();
    await racePage.addInitScript(()=>{
      window.__store={'niakgpt-v08-cache':{schema:2,at:1,projects:[{id:'g-p-base',name:'Base',domOnly:false}],chats:[],counts:{},projectChats:{},indexedProjectIds:['g-p-base']}};
      window.__changeListeners=[];window.__events=[];window.__delaySet=false;
      const emit=(oldValue,newValue)=>{for(const fn of [...window.__changeListeners])fn({'niakgpt-v08-cache':{oldValue,newValue}},'local');};
      window.chrome={runtime:{id:'lab'},storage:{local:{
        get:async key=>({[key]:structuredClone(window.__store[key])}),
        set:async obj=>{const oldValue=structuredClone(window.__store['niakgpt-v08-cache']);if(window.__delaySet)await new Promise(r=>setTimeout(r,120));window.__store['niakgpt-v08-cache']=structuredClone(obj['niakgpt-v08-cache']);window.__events.push(`own:${window.__store['niakgpt-v08-cache'].at}`);emit(oldValue,window.__store['niakgpt-v08-cache']);}
      },onChanged:{addListener:fn=>window.__changeListeners.push(fn)}}};
      window.__externalSet=(raw,label)=>{const oldValue=structuredClone(window.__store['niakgpt-v08-cache']);window.__store['niakgpt-v08-cache']=structuredClone(raw);window.__events.push(`${label}:${raw.at}`);emit(oldValue,raw);};
      window.__NIAKGPT_DIAGNOSTICS__={set:()=>{}};
      window.__fireTransition=(type,persisted=true)=>{const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});window.dispatchEvent(event);};
    });
    await racePage.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav></body></html>'}));
    await racePage.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await racePage.evaluate(cacheBusJs);
    await racePage.evaluate(metadataJs);
    assert(await racePage.evaluate(()=>window.__NIAKGPT_METADATA_READY_118__==='ready'),'metadata/cache bus race fixture did not become ready');
    await racePage.evaluate(()=>{
      window.__persistentPhase='visible';window.__persistentSeen=[];
      window.__persistentUnsub=window.__NIAKGPT_CACHE_BUS__.subscribe(raw=>window.__persistentSeen.push({phase:window.__persistentPhase,ids:(raw?.projects||[]).map(p=>p.id),chats:(raw?.chats||[]).map(c=>c.id)}));
    });
    await racePage.waitForTimeout(20);
    const persistentBaseline=await racePage.evaluate(()=>window.__persistentSeen.length);
    const dirty={schema:2,at:2,projects:[{id:'g-p-base',name:'Base',domOnly:false},{id:'dom-old',name:'Today',domOnly:true}],chats:[],counts:{'dom-old':1},projectChats:{'dom-old':[]},indexedProjectIds:['g-p-base','dom-old']};
    const newer={schema:2,at:3,projects:[{id:'g-p-base',name:'Base',domOnly:false},{id:'g-p-new',name:'New',domOnly:false}],chats:[{id:'new-chat',title:'New hidden chat',projectId:'g-p-new',href:'/c/new-chat'}],counts:{'g-p-new':1},projectChats:{},indexedProjectIds:['g-p-base','g-p-new']};
    await racePage.evaluate(({dirty,newer})=>{
      window.__delaySet=true;
      window.__externalSet(dirty,'dirty-runtime');
      setTimeout(()=>{window.__persistentPhase='hidden';window.__fireTransition('pagehide',true);},20);
      setTimeout(()=>window.__externalSet(newer,'hidden-external-new'),40);
      setTimeout(()=>{window.__persistentPhase='resuming';window.__fireTransition('pageshow',true);},50);
    },{dirty,newer});
    await racePage.waitForTimeout(520);
    const race=await racePage.evaluate(()=>({
      ready:window.__NIAKGPT_METADATA_READY_118__||'',
      store:window.__store['niakgpt-v08-cache'],
      peek:window.__NIAKGPT_CACHE_BUS__.peek(),
      events:window.__events,
      persistentSeen:window.__persistentSeen
    }));
    const storeIds=(race.store?.projects||[]).map(p=>p.id),peekIds=(race.peek?.projects||[]).map(p=>p.id),afterBaseline=(race.persistentSeen||[]).slice(persistentBaseline);
    assert(race.ready==='ready',`BFCache cache bus resume left metadata unready: ${JSON.stringify(race)}`);
    assert(storeIds.includes('g-p-new')&&peekIds.includes('g-p-new'),`BFCache cache bus resume lost the newest hidden snapshot: ${JSON.stringify(race)}`);
    assert((race.store?.chats||[]).some(c=>c.id==='new-chat')&&(race.peek?.chats||[]).some(c=>c.id==='new-chat'),`BFCache cache bus resume lost the newest hidden chat: ${JSON.stringify(race)}`);
    assert(race.events.some(x=>x==='hidden-external-new:3'),`BFCache race fixture never published the hidden external snapshot: ${JSON.stringify(race)}`);
    assert(!afterBaseline.some(x=>x.phase==='hidden'),`persisted cache subscriber was notified while BFCache-suspended: ${JSON.stringify(race.persistentSeen)}`);
    assert(afterBaseline.some(x=>x.phase==='resuming'&&x.ids.includes('g-p-new')&&x.chats.includes('new-chat')),`persisted cache subscriber did not survive BFCache or receive newest resume state: ${JSON.stringify(race.persistentSeen)}`);
    await racePage.evaluate(()=>window.__persistentUnsub?.());
    await racePage.close();

    console.log(`${engine} sidebar metadata + cache bus pagehide/pageshow/BFCache newest-state + persistent-subscriber lifecycle: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-metadata-lifecycle-v119: ${Object.keys(engines).join(',')} PASS`);
