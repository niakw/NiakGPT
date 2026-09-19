import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const [base,deep,selfheal,cacheGuardian,recovery]=await Promise.all(
  ['reclassify-v101.js','reclassify-deep-v112.js','project-state-selfheal-v102.js','cache-guardian-v100.js','recovery-v100.js'].map(f=>fs.readFile(path.join(ROOT,f),'utf8'))
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

  {
    const page=await browser.newPage({viewport:{width:1200,height:800}});
    const now=Date.now();
    const projects=[
      {id:VISIBLE,name:'Création & Contenu'},
      {id:HIDDEN,name:'Tech & Développement'},
      {id:'g-p-extra1',name:'Recherche'},
      {id:'g-p-extra2',name:'Perso'}
    ];
    const chats=Array.from({length:20},(_,i)=>({
      id:`90000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
      title:`Chat ${i+1}`,projectId:i%2?VISIBLE:HIDDEN,updated:now-i*1000
    }));
    const backup={at:now-5000,projects,chats};
    const store={
      'niakgpt-v08-cache':{schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[],serverIndexedAt:0},
      'niakgpt-governance-v085':{seeded:true,coreProjectIds:[],hiddenProjectIds:[HIDDEN],locks:{}},
      'niakgpt-auto-rebuild-backup-v0911':backup
    };
    await page.addInitScript(store=>{
      const data=structuredClone(store);window.__store=data;
      window.chrome={storage:{local:{
        async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>k&&data[k]!==undefined).map(k=>[k,structuredClone(data[k])]));},
        async set(obj){for(const[k,v]of Object.entries(obj))data[k]=structuredClone(v);}
      }}};
      try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'fixture-data-lock'})}});}catch{}
      try{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});}catch{}
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    },store);
    await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><main>Home</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:cacheGuardian});
    await page.waitForTimeout(220);
    const g=await page.evaluate(()=>window.__store['niakgpt-governance-v085']);
    assert(g.hiddenProjectIds.includes(HIDDEN),`cache guardian erased hidden Projects during restore: ${JSON.stringify(g)}`);
    assert(!g.coreProjectIds.includes(HIDDEN),`cache guardian resurrected hidden Project as core: ${JSON.stringify(g)}`);
    assert(g.coreProjectIds.includes(VISIBLE),`cache guardian failed to recover visible core Projects: ${JSON.stringify(g)}`);
    await page.close();
  }
  {
    const page=await browser.newPage({viewport:{width:1200,height:800}});
    const now=Date.now(),OLD_VISIBLE='g-p-oldvisible',OLD_HIDDEN='g-p-oldhidden',NEW_VISIBLE='g-p-newvisible',NEW_HIDDEN='g-p-newhidden',TEMP='g-p-temp';
    const chat='88888888-8888-4888-8888-888888888888';
    const backup={
      at:now-10000,
      projects:[{id:OLD_VISIBLE,name:'Visible Project'},{id:OLD_HIDDEN,name:'Hidden Project'}],
      chats:[{id:chat,title:'Hidden history',projectId:OLD_HIDDEN,updated:now-20000}]
    };
    const rebuild={created:{temp:TEMP},plan:{oldProjects:backup.projects,targets:[{name:'Temporary Rebuild'}]}};
    const cache={schema:2,projects:[
      {id:NEW_VISIBLE,name:'Visible Project',href:`/g/${NEW_VISIBLE}/project`},
      {id:NEW_HIDDEN,name:'Hidden Project',href:`/g/${NEW_HIDDEN}/project`},
      {id:TEMP,name:'Temporary Rebuild',href:`/g/${TEMP}/project`}
    ],chats:[{id:chat,title:'Hidden history',projectId:NEW_HIDDEN,updated:now-20000}],counts:{[NEW_VISIBLE]:0,[NEW_HIDDEN]:1,[TEMP]:0}};
    const store={
      'niakgpt-v08-cache':cache,
      'niakgpt-governance-v085':{seeded:true,coreProjectIds:[],hiddenProjectIds:[OLD_HIDDEN],locks:{}},
      'niakgpt-auto-rebuild-v0911':rebuild,
      'niakgpt-auto-rebuild-backup-v0911':backup
    };
    await page.addInitScript(({store,ids,chat,now})=>{
      const data=structuredClone(store);window.__store=data;
      let serverProjects=[
        {id:ids.NV,name:'Visible Project'},
        {id:ids.NH,name:'Hidden Project'},
        {id:ids.TEMP,name:'Temporary Rebuild'}
      ];
      window.chrome={storage:{local:{
        async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>k&&data[k]!==undefined).map(k=>[k,structuredClone(data[k])]));},
        async set(obj){for(const[k,v]of Object.entries(obj))data[k]=structuredClone(v);}
      }}};
      try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'fixture-data-lock'})}});}catch{}
      try{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});}catch{}
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
      document.documentElement.dataset.ng100CacheGuardRestored='backup';
      document.documentElement.dataset.ng86Activity='ready';
      document.addEventListener('niakgpt:rpc-request',e=>{
        const d=e.detail||{};let detail={id:d.id,ok:true,status:200,data:{}};
        if(String(d.path).startsWith('/backend-api/gizmos/snorlax/sidebar')){
          detail.data={items:serverProjects.map(p=>({id:p.id,display:{name:p.name}}))};
        }else if(String(d.path).startsWith('/backend-api/conversations?')){
          detail.data={items:[{id:chat,title:'Hidden history',gizmo_id:ids.NH,update_time:now-20000}],has_more:false};
        }else if(String(d.path).startsWith('/backend-api/gizmos/'+ids.TEMP+'/conversations?')){
          detail.data={items:[]};
        }else if(d.method==='DELETE'&&String(d.path)==='/backend-api/gizmos/'+ids.TEMP){
          serverProjects=serverProjects.filter(p=>p.id!==ids.TEMP);detail.data={};
        }else if(d.method==='PATCH'&&String(d.path).startsWith('/backend-api/conversation/')){
          detail.data={gizmo_id:d.body?.gizmo_id||''};
        }else{
          detail={id:d.id,ok:false,status:404,error:'unexpected_rpc:'+d.path};
        }
        queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail})));
      });
    },{store,ids:{NV:NEW_VISIBLE,NH:NEW_HIDDEN,TEMP},chat,now});
    await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><main>Home</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:recovery});
    await page.waitForFunction(()=>window.__store['niakgpt-recovery-v100']?.done===true,null,{timeout:6000});
    const g=await page.evaluate(()=>window.__store['niakgpt-governance-v085']);
    assert(g.hiddenProjectIds.includes(NEW_HIDDEN),`structural recovery lost/remapped hidden Project incorrectly: ${JSON.stringify(g)}`);
    assert(!g.coreProjectIds.includes(NEW_HIDDEN),`structural recovery resurrected hidden Project as core: ${JSON.stringify(g)}`);
    assert(g.coreProjectIds.includes(NEW_VISIBLE),`structural recovery failed to keep visible Project core: ${JSON.stringify(g)}`);
    await page.close();
  }

  console.log('hidden-project-classification-v099: PASS');
}finally{
  await browser.close();
}
