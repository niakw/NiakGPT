import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const governance=await fs.readFile(path.join(ROOT,'project-governance-v090.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:800}});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

try{
  await page.addInitScript(()=>{
    const realSetTimeout=window.setTimeout.bind(window);
    window.setTimeout=(fn,ms=0,...args)=>realSetTimeout(fn,Number(ms)>1000?25:Number(ms),...args);
    const P1='g-p-tech123',P2='g-p-film123',CHAT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const store={
      'niakgpt-v08-cache':{
        schema:2,
        projects:[
          {id:P1,name:'Tech & Développement',description:'JavaScript extension GitHub'},
          {id:P2,name:'Films',description:'Cinéma séries anime'}
        ],
        chats:[{id:CHAT,title:'Tech JavaScript extension GitHub',snippet:'runtime code chrome',projectId:'',updated:Date.now()-60000}],
        counts:{[P1]:0,[P2]:0}
      },
      'niakgpt-governance-v085':{seeded:true,autoResync:true,coreProjectIds:[P1,P2],hiddenProjectIds:[],locks:{}}
    };
    const listeners=[];window.__store=store;window.__patches=[];window.__locks=[];
    window.chrome={storage:{local:{
      async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>store[k]!==undefined).map(k=>[k,structuredClone(store[k])]));},
      async set(obj){const ch={};for(const[k,v]of Object.entries(obj)){ch[k]={oldValue:store[k],newValue:structuredClone(v)};store[k]=structuredClone(v);}for(const fn of listeners)fn(ch,'local');}
    },onChanged:{addListener:fn=>listeners.push(fn)}}};
    Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name,opts,cb)=>{window.__locks.push(name);return cb({name});}}});
    window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    document.documentElement.dataset.ng8TabRole='worker';
    document.documentElement.dataset.ng86Activity='ready';
    document.addEventListener('niakgpt:rpc-request',e=>{
      const d=e.detail||{};
      if(d.method==='PATCH'){window.__patches.push(structuredClone(d));queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:d.body?.gizmo_id||''}}})));return;}
      const chat=store['niakgpt-v08-cache'].chats.find(c=>String(d.path).includes(c.id));
      queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:chat?.projectId||''}}})));
    });
    window.confirm=()=>true;
  });
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav><main>Home</main></body></html>'}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:governance});
  await page.waitForTimeout(260);

  const auto=await page.evaluate(()=>({patches:window.__patches,locks:window.__locks}));
  assert(auto.patches.length===0,`governance still performs automatic classification PATCHes: ${JSON.stringify(auto)}`);
  assert(governance.includes("const DATA_LOCK='niakgpt-data-mutation-v100'"),'manual governance cleanup is not wired to shared data-mutation lock');
  assert(!governance.includes('async function autoResync()'),'legacy governance autoResync classifier still exists');

  console.log('classification-authority-v099: PASS');
}finally{
  await page.close();
  await browser.close();
}
