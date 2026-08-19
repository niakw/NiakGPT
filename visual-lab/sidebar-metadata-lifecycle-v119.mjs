import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const metadataJs=await fs.readFile(path.join(ROOT,'sidebar-metadata-v118.js'),'utf8');
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
    console.log(`${engine} sidebar metadata pagehide/pageshow epoch lifecycle: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-metadata-lifecycle-v119: ${Object.keys(engines).join(',')} PASS`);
await import('./sidebar-metadata-concurrency-v119.mjs');
