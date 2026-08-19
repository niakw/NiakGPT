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
      window.__raw={schema:2,at:1,projects:[{id:'g-p-good',name:'Studio',domOnly:false}],chats:[],counts:{},projectChats:{},indexedProjectIds:['g-p-good']};
      window.__subs=[];window.__writes=0;window.__events=[];
      window.__publish=(next,label='external')=>{
        window.__raw=structuredClone(next);window.__events.push(`${label}:${window.__raw.at}`);
        for(const fn of [...window.__subs])fn(window.__raw);
      };
      window.__NIAKGPT_CACHE_BUS__={
        async get(){return window.__raw;},
        peek(){return window.__raw;},
        async update(fn){
          const next=await fn(window.__raw)||window.__raw;
          window.__events.push(`update:start:${next.at}`);
          await new Promise(r=>setTimeout(r,100));
          window.__raw=structuredClone(next);window.__writes++;
          window.__events.push(`update:end:${next.at}`);
          for(const sub of [...window.__subs])sub(window.__raw);
          return window.__raw;
        },
        subscribe(fn){window.__subs.push(fn);queueMicrotask(()=>fn(window.__raw));return()=>{window.__subs=window.__subs.filter(x=>x!==fn);};}
      };
      window.chrome={storage:{local:{get:async()=>({'niakgpt-v08-cache':window.__raw}),set:async obj=>{window.__raw=structuredClone(obj['niakgpt-v08-cache']);window.__writes++;}},onChanged:{addListener:()=>{}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:()=>{}};
    });
    const html='<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav></body></html>';
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(metadataJs);
    assert(await page.evaluate(()=>window.__NIAKGPT_METADATA_READY_118__==='ready'),`${engine} metadata did not become ready`);

    await page.evaluate(()=>{
      const A={schema:2,at:2,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'dom-race-a',name:'Today',domOnly:true}],chats:[{id:'c1',title:'older',projectId:'dom-race-a',href:'/g/g-p-good/c/c1'}],counts:{'dom-race-a':1},projectChats:{'dom-race-a':[]},indexedProjectIds:['g-p-good','dom-race-a']};
      const B={schema:2,at:3,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'g-p-two',name:'Two',domOnly:false},{id:'dom-race-b',name:'Yesterday',domOnly:true}],chats:[{id:'c2',title:'latest',projectId:'dom-race-b',href:'/g/g-p-good/c/c2'}],counts:{'dom-race-b':1},projectChats:{'dom-race-b':[]},indexedProjectIds:['g-p-good','g-p-two','dom-race-b']};
      window.__publish(A,'race-a');
      setTimeout(()=>window.__publish(B,'race-b-unlocked'),20);
    });
    await page.waitForTimeout(520);
    const outcome=await page.evaluate(()=>({
      ready:window.__NIAKGPT_METADATA_READY_118__||'',
      ids:(window.__raw.projects||[]).map(p=>p.id),
      chats:(window.__raw.chats||[]).map(c=>({id:c.id,projectId:c.projectId})),
      writes:window.__writes,
      events:window.__events
    }));
    assert(outcome.ready==='ready',`metadata left ready state during unlocked race: ${JSON.stringify(outcome)}`);
    assert(outcome.ids.includes('g-p-two'),`metadata sanitation overwrote a later unlocked cache publication: ${JSON.stringify(outcome)}`);
    assert(!outcome.ids.includes('dom-race-a')&&!outcome.ids.includes('dom-race-b'),`dirty Project survived unlocked race replay: ${JSON.stringify(outcome)}`);
    assert(outcome.chats.length===1&&outcome.chats[0].id==='c2'&&outcome.chats[0].projectId==='g-p-good',`latest unlocked chat snapshot was lost or not recovered: ${JSON.stringify(outcome)}`);
    assert(outcome.writes>=2,`queued unlocked snapshot was not replayed after stale write: ${JSON.stringify(outcome)}`);
    console.log(`${engine} sidebar metadata unlocked concurrent publish replay: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-metadata-concurrency-v119: ${Object.keys(engines).join(',')} PASS`);
