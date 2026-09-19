import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const [base,deep,selfheal]=await Promise.all(
  ['reclassify-v101.js','reclassify-deep-v112.js','project-state-selfheal-v102.js'].map(f=>fs.readFile(path.join(ROOT,f),'utf8'))
);
const browser=await chromium.launch({headless:true});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const VISIBLE='g-p-visible123',HIDDEN='g-p-hidden123';
const CHAT='77777777-7777-4777-8777-777777777777';

async function makePage({attemptAmbiguous=false,core=[HIDDEN]}={}){
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const now=Date.now();
  const cache={
    schema:2,
    projects:[
      {id:VISIBLE,name:'Création & Contenu',href:`/g/${VISIBLE}/project`,domOnly:false},
      {id:HIDDEN,name:'Tech & Développement',href:`/g/${HIDDEN}/project`,domOnly:false}
    ],
    chats:[{id:CHAT,title:'GitHub extension JavaScript runtime bug',snippet:'chrome extension github javascript code runtime provider',projectId:'',updated:now-60_000}],
    counts:{[VISIBLE]:0,[HIDDEN]:0},
    indexedProjectIds:[VISIBLE,HIDDEN],
    serverIndexedAt:now-120_000
  };
  const gov={seeded:true,coreProjectIds:core,hiddenProjectIds:[HIDDEN],locks:{},autoResync:true};
  const reclassState=attemptAmbiguous?{schema:7,attempts:{[CHAT]:{status:'ambiguous',at:0,sig:'old',score:1,margin:0}},firstSeen:{[CHAT]:now-60_000}}:{schema:7,attempts:{},firstSeen:{[CHAT]:now-60_000}};
  const html=`<!doctype html><html><body>
    <nav data-testid="conversation-sidebar">
      <section><h2>Projects</h2>
        <a href="/g/${VISIBLE}/project">Création & Contenu</a>
        <a href="/g/${HIDDEN}/project">Tech & Développement</a>
      </section>
    </nav><main>Home</main>
  </body></html>`;
  await page.addInitScript(({cache,gov,reclassState})=>{
    const store={
      'niakgpt-v08-cache':structuredClone(cache),
      'niakgpt-governance-v085':structuredClone(gov),
      'niakgpt-reclassify-v101-state':structuredClone(reclassState),
      'niakgpt-reclassify-deep-v112-state':{schema:2,checked:{}}
    };
    const listeners=[];
    window.__store=store;window.__rpc=[];window.__diag={};
    window.chrome={storage:{
      local:{
        async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>k&&store[k]!==undefined).map(k=>[k,structuredClone(store[k])]));},
        async set(obj){const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:structuredClone(v)};store[k]=structuredClone(v);}for(const fn of [...listeners])fn(changes,'local');},
        async remove(key){const list=Array.isArray(key)?key:[key];const changes={};for(const k of list){changes[k]={oldValue:store[k],newValue:undefined};delete store[k];}for(const fn of [...listeners])fn(changes,'local');}
      },
      onChanged:{addListener(fn){listeners.push(fn);}}
    }};
    window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    document.addEventListener('niakgpt:rpc-request',e=>{
      const d=e.detail||{};window.__rpc.push(structuredClone(d));
      if(d.method==='PATCH'){
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:d.body?.gizmo_id||''}}})),5);
      }else{
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:false,status:0,error:'disabled-in-test'}})),5);
      }
    });
    document.documentElement.dataset.ng8TabRole='worker';
    document.documentElement.dataset.ng86Activity='ready';
  },{cache,gov,reclassState});
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  return page;
}

try{
  {
    const page=await makePage();
    await page.addScriptTag({content:base});
    await page.waitForTimeout(2700);
    const s=await page.evaluate(()=>({patches:window.__rpc.filter(x=>x.method==='PATCH'),gov:window.__store['niakgpt-governance-v085']}));
    assert(!s.patches.some(x=>x.body?.gizmo_id===HIDDEN),`base classifier targeted hidden Project: ${JSON.stringify(s)}`);
    await page.close();
  }
  {
    const page=await makePage({attemptAmbiguous:true});
    await page.addScriptTag({content:deep});
    await page.waitForTimeout(3700);
    const s=await page.evaluate(()=>({patches:window.__rpc.filter(x=>x.method==='PATCH')}));
    assert(!s.patches.some(x=>x.body?.gizmo_id===HIDDEN),`deep classifier targeted hidden Project: ${JSON.stringify(s)}`);
    await page.close();
  }
  {
    const page=await makePage({core:[HIDDEN]});
    await page.addScriptTag({content:selfheal});
    await page.waitForTimeout(500);
    const s=await page.evaluate(()=>window.__store['niakgpt-governance-v085']);
    assert(!s.coreProjectIds.includes(HIDDEN),`self-heal kept/reseeded hidden Project as core: ${JSON.stringify(s)}`);
    assert(s.coreProjectIds.includes(VISIBLE),`self-heal failed to recover visible canonical core: ${JSON.stringify(s)}`);
    await page.close();
  }
  console.log('hidden-project-classification-v099: PASS');
}finally{
  await browser.close();
}
