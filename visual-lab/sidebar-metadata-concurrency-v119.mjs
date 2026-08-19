import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const metadataJs=await fs.readFile(path.join(ROOT,'sidebar-metadata-v118.js'),'utf8');
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function makePage(browser,{collision=false}={}){
  const page=await browser.newPage({viewport:{width:1280,height:820},colorScheme:'dark'});
  await page.addInitScript(collision=>{
    window.__raw={schema:2,at:1,projects:[{id:'g-p-good',name:'Studio',domOnly:false}],chats:[],counts:{},projectChats:{},indexedProjectIds:['g-p-good']};
    window.__subs=[];window.__writes=0;window.__events=[];window.__collision=collision;
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
        if(window.__collision&&window.__writes===0){
          const sameAt={...structuredClone(next),projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id:'g-p-collision',name:'Collision',domOnly:false}],chats:[{id:'cx',title:'same timestamp',projectId:'g-p-collision',href:'/c/cx'}],counts:{'g-p-collision':1},projectChats:{},indexedProjectIds:['g-p-good','g-p-collision']};
          setTimeout(()=>window.__publish(sameAt,'collision-same-at'),20);
        }
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
  },collision);
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav></body></html>'}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.evaluate(metadataJs);
  assert(await page.evaluate(()=>window.__NIAKGPT_METADATA_READY_118__==='ready'),'metadata did not become ready');
  return page;
}

const dirty=(at,ghost,extra='')=>({schema:2,at,projects:[{id:'g-p-good',name:'Studio',domOnly:false},...(extra?[{id:extra,name:extra,domOnly:false}]:[]),{id:ghost,name:at%2?'Yesterday':'Today',domOnly:true}],chats:[{id:`c-${at}`,title:`chat-${at}`,projectId:ghost,href:`/g/g-p-good/c/c-${at}`}],counts:{[ghost]:1},projectChats:{[ghost]:[]},indexedProjectIds:['g-p-good',...(extra?[extra]:[]),ghost]});
const clean=(at,id)=>({schema:2,at,projects:[{id:'g-p-good',name:'Studio',domOnly:false},{id,name:id,domOnly:false}],chats:[{id:`c-${id}`,title:id,projectId:id,href:`/c/c-${id}`}],counts:{[id]:1},projectChats:{},indexedProjectIds:['g-p-good',id]});

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  try{
    {
      const page=await makePage(browser);
      await page.evaluate(({a,b})=>{window.__publish(a,'race-a');setTimeout(()=>window.__publish(b,'race-b-unlocked'),20);},{a:dirty(2,'dom-race-a'),b:dirty(3,'dom-race-b','g-p-two')});
      await sleep(520);
      const o=await page.evaluate(()=>({ids:window.__raw.projects.map(p=>p.id),chats:window.__raw.chats.map(c=>({id:c.id,projectId:c.projectId})),writes:window.__writes,events:window.__events}));
      assert(o.ids.includes('g-p-two')&&!o.ids.includes('dom-race-a')&&!o.ids.includes('dom-race-b'),`metadata sanitation overwrote a later unlocked cache publication: ${JSON.stringify(o)}`);
      assert(o.chats.length===1&&o.chats[0].id==='c-3'&&o.chats[0].projectId==='g-p-good',`latest unlocked chat snapshot was lost or not recovered: ${JSON.stringify(o)}`);
      assert(o.writes>=2,`queued unlocked snapshot was not replayed after stale write: ${JSON.stringify(o)}`);
      await page.close();
    }
    {
      const page=await makePage(browser);
      await page.evaluate(({a,b})=>{window.__publish(a,'dirty-a');setTimeout(()=>window.__publish(b,'clean-b-unlocked'),20);},{a:dirty(2,'dom-clean-a'),b:clean(3,'g-p-clean-latest')});
      await sleep(520);
      const o=await page.evaluate(()=>({ids:window.__raw.projects.map(p=>p.id),chats:window.__raw.chats.map(c=>c.id),writes:window.__writes}));
      assert(o.ids.includes('g-p-clean-latest')&&!o.ids.includes('dom-clean-a')&&o.chats[0]==='c-g-p-clean-latest'&&o.writes>=2,`clean later snapshot was not restored after stale sanitation: ${JSON.stringify(o)}`);
      await page.close();
    }
    {
      const page=await makePage(browser);
      await page.evaluate(({a,b,c})=>{window.__publish(a,'burst-a');setTimeout(()=>window.__publish(b,'burst-b'),10);setTimeout(()=>window.__publish(c,'burst-c-latest'),25);},{a:dirty(2,'dom-burst-a','g-p-a'),b:dirty(3,'dom-burst-b','g-p-b'),c:clean(4,'g-p-c')});
      await sleep(540);
      const o=await page.evaluate(()=>({ids:window.__raw.projects.map(p=>p.id),chats:window.__raw.chats.map(c=>c.id),writes:window.__writes}));
      assert(o.ids.includes('g-p-c')&&!o.ids.includes('g-p-a')&&!o.ids.includes('g-p-b')&&o.chats[0]==='c-g-p-c',`A→B→C coalescing did not preserve the newest full snapshot: ${JSON.stringify(o)}`);
      await page.close();
    }
    {
      const page=await makePage(browser,{collision:true});
      await page.evaluate(a=>window.__publish(a,'collision-seed'),dirty(2,'dom-collision'));
      await sleep(540);
      const o=await page.evaluate(()=>({ids:window.__raw.projects.map(p=>p.id),chats:window.__raw.chats.map(c=>c.id),writes:window.__writes,events:window.__events}));
      assert(o.ids.includes('g-p-collision')&&o.chats[0]==='cx'&&o.writes>=2,`same-timestamp external snapshot was mistaken for an own-write echo: ${JSON.stringify(o)}`);
      await page.close();
    }
    {
      const page=await makePage(browser);
      await page.evaluate(a=>window.__publish(a,'single-dirty'),dirty(2,'dom-single'));
      await sleep(420);
      const o=await page.evaluate(()=>({ids:window.__raw.projects.map(p=>p.id),writes:window.__writes}));
      assert(o.ids.length===1&&o.ids[0]==='g-p-good'&&o.writes===1,`metadata own-write echo caused an extra sanitation loop: ${JSON.stringify(o)}`);
      await page.close();
    }
    console.log(`${engine} sidebar metadata unlocked concurrency/clean replay/burst/signature/no-loop: PASS`);
  }finally{await browser.close();}
}
console.log(`sidebar-metadata-concurrency-v119: ${Object.keys(engines).join(',')} PASS`);
