import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const [v100,v112,v124,v129]=await Promise.all(
  ['continuity-v100.js','continuity-v112.js','continuity-consumer-v124.js','continuity-native-handoff-v129.js']
    .map(f=>fs.readFile(path.join(ROOT,f),'utf8'))
);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const OLD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PID='g-p-tech123';

try{
  await page.addInitScript(({OLD,PID})=>{
    const pending={
      schema:3,chatId:OLD,projectId:PID,projectName:'Tech & Développement',
      chatName:'Long thread',capsule:'CONTINUITÉ NIAKGPT — REPRENDRE LE FIL PRÉCÉDENT\n\nPROJECT EXACT À CONSERVER : Tech & Développement',
      createdAt:Date.now(),sourceUrl:'https://chatgpt.com/c/'+OLD,patched:false,exactProject:true
    };
    sessionStorage.setItem('niakgpt-continuity-pending-v100',JSON.stringify(pending));
    const store={
      'niakgpt-v08-cache':{
        schema:2,projects:[{id:PID,name:'Tech & Développement'}],
        chats:[{id:OLD,title:'Long thread',projectId:PID,updated:Date.now()-1000}],
        projectChats:{[PID]:[{id:OLD,title:'Long thread',projectId:PID,updated:Date.now()-1000}]},
        counts:{[PID]:1},indexedProjectIds:[PID]
      },
      'niakgpt-governance-v085':{coreProjectIds:[PID],hiddenProjectIds:[],locks:{}},
      'niakgpt-continuity-pending-v124':structuredClone(pending)
    };
    const listeners=[];
    window.__store=store;window.__patches=[];window.__lockNames=[];window.__diag={};
    window.chrome={storage:{
      local:{
        async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>store[k]!==undefined).map(k=>[k,structuredClone(store[k])]));},
        async set(obj){const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:structuredClone(v)};store[k]=structuredClone(v);}for(const fn of listeners)fn(changes,'local');},
        async remove(keys){const list=Array.isArray(keys)?keys:[keys];const changes={};for(const k of list){changes[k]={oldValue:store[k],newValue:undefined};delete store[k];}for(const fn of listeners)fn(changes,'local');}
      },
      onChanged:{addListener(fn){listeners.push(fn);}}
    }};
    try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name,opts,cb)=>{window.__lockNames.push(name);return cb({name});}}});}catch{}
    window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    window.__NIAKGPT_CACHE_BUS__={
      async get(){return structuredClone(store['niakgpt-v08-cache']);},
      subscribe(){return()=>{};},
      async update(fn){store['niakgpt-v08-cache']=await fn(structuredClone(store['niakgpt-v08-cache']));return structuredClone(store['niakgpt-v08-cache']);}
    };
    document.addEventListener('niakgpt:rpc-request',e=>{
      const d=e.detail||{};
      if(d.method==='PATCH'&&Object.prototype.hasOwnProperty.call(d.body||{},'gizmo_id')){
        window.__patches.push({id:d.id,path:d.path,body:structuredClone(d.body)});
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:d.body.gizmo_id}}})),5);
        return;
      }
      setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{}}})),5);
    });
  },{OLD,PID});

  await page.route('https://chatgpt.com/**',r=>r.fulfill({
    status:200,contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav><main><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div></main></body></html>'
  }));
  await page.goto(`https://chatgpt.com/g/${PID}/project`,{waitUntil:'domcontentloaded'});

  for(const code of [v100,v112,v124])await page.addScriptTag({content:code});
  await page.waitForFunction(()=>document.documentElement.dataset.ng124ContinuityConsumed==='1',null,{timeout:3000});
  let state=await page.evaluate(()=>({
    patches:structuredClone(window.__patches),
    lock:structuredClone(window.__store['niakgpt-continuity-project-lock-v124']||null),
    pending:window.__store['niakgpt-continuity-pending-v124']||null
  }));
  assert(state.patches.length===0,`continuity assigned a Project before a new chat existed: ${JSON.stringify(state)}`);
  assert(state.lock?.projectId===PID&&state.lock?.chatId===OLD,`continuity consumer did not persist exact Project lock: ${JSON.stringify(state)}`);
  assert(state.pending===null,`shared pending was not consumed exactly once: ${JSON.stringify(state)}`);

  await page.evaluate(({PID,NEW})=>{
    history.pushState({},'',`/g/${PID}/c/${NEW}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },{PID,NEW});
  await page.waitForFunction(()=>window.__patches.length===1,null,{timeout:3000});
  await page.waitForTimeout(350);

  state=await page.evaluate(({NEW,PID})=>({
    patches:structuredClone(window.__patches),
    locks:structuredClone(window.__lockNames),
    gov:structuredClone(window.__store['niakgpt-governance-v085']),
    cache:structuredClone(window.__store['niakgpt-v08-cache']),
    lockResidue:window.__store['niakgpt-continuity-project-lock-v124']||null,
    newId:NEW,pid:PID
  }),{NEW,PID});
  assert(state.patches.length===1,`shared continuity flow issued ${state.patches.length} Project PATCHes instead of one: ${JSON.stringify(state)}`);
  assert(state.patches[0].path.includes(NEW)&&state.patches[0].body?.gizmo_id===PID,`continuity PATCH target drift: ${JSON.stringify(state)}`);
  assert(state.locks.includes('niakgpt-data-mutation-v100'),`continuity assignment bypassed shared data lock: ${JSON.stringify(state)}`);
  assert(state.gov.locks?.[NEW]?.projectId===PID&&state.gov.locks?.[NEW]?.source==='continuity-consumer-v124',`continuity governance lock missing: ${JSON.stringify(state)}`);
  assert(state.cache.chats.some(c=>c.id===NEW&&c.projectId===PID),`continued chat missing from canonical cache: ${JSON.stringify(state)}`);
  assert(state.lockResidue===null,`continuity lock residue remained after successful assignment: ${JSON.stringify(state)}`);

  assert(!v100.includes('patchNewChat'),'legacy continuity-v100 Project PATCH owner reintroduced');
  assert(!v112.includes("method:'PATCH'"),'continuity-v112 regained Project PATCH ownership');
  assert(v124.includes("const DATA_LOCK='niakgpt-data-mutation-v100'"),'continuity-v124 lost shared mutation lock');
  assert(v129.includes("const DATA_LOCK='niakgpt-data-mutation-v100'"),'native continuity handoff lost shared mutation lock');

  console.log('continuity-authority-v099: PASS');
}finally{
  await page.close();
  await browser.close();
}
