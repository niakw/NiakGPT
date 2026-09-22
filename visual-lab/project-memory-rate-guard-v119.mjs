import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const core=fs.readFileSync(path.join(ROOT,'project-memory-v132.js'),'utf8');
const ui=fs.readFileSync(path.join(ROOT,'project-memory-ui-v132.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1180,height:820}});

try{
  await page.addInitScript(()=>{
    const P='g-p-rate-guard';
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
    const now=Date.now();
    const chats=ids.map((id,i)=>({id,title:'Synthetic '+(i+1),projectId:P,updated:now-i*1000}));
    const store={
      'niakgpt-v08-cache':{schema:2,at:now,serverIndexedAt:now,projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project'}],chats,projectChats:{[P]:chats},counts:{[P]:2},indexedProjectIds:[P]},
      'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const remote={['projects/'+P+'/index.json']:JSON.stringify({schema:1,projectId:P,projectName:'Workspace',conversations:{}},null,2)+'\n'};
    const listeners=[];
    const clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>keys==null?Object.keys(store):typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys||{});
    window.__rateFetches=[];
    window.__store=store;
    window.__remote=remote;
    window.chrome={
      runtime:{
        id:'rate-guard-lab',lastError:null,getManifest:()=>({version:'0.9.119'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'},github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-project-archive-v132')return reply({ok:true,projectId:P,directoryCount:0,knownCount:0,missingCount:0,recovered:[]});
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            window.__rateFetches.push({path:String(message.path||''),at:Date.now()});
            return reply({ok:false,status:429,error:'chatgpt_memory_http_429'});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            for(const file of(message.files||[]))remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'commit'});
          }
          if(type==='niakgpt:memory-catalog-v132')return reply({ok:true,projects:[]});
          return reply({ok:false,error:'unexpected:'+type});
        }
      },
      storage:{
        local:{
          async get(keys){
            if(keys&&typeof keys==='object'&&!Array.isArray(keys))return Object.fromEntries(Object.entries(keys).map(([k,fallback])=>[k,store[k]===undefined?clone(fallback):clone(store[k])]));
            return Object.fromEntries(keysFor(keys).filter(k=>store[k]!==undefined).map(k=>[k,clone(store[k])]));
          },
          async set(obj){
            const changes={};
            for(const[k,v]of Object.entries(obj||{})){changes[k]={oldValue:clone(store[k]),newValue:clone(v)};store[k]=clone(v);}
            for(const fn of listeners)fn(changes,'local');
          },
          async remove(keys){
            const changes={};
            for(const k of(Array.isArray(keys)?keys:[keys])){if(store[k]!==undefined)changes[k]={oldValue:clone(store[k]),newValue:undefined};delete store[k];}
            if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local');
          }
        },
        onChanged:{addListener(fn){listeners.push(fn);}}
      }
    };
    try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'memory-lock'})}});}catch{}
    window.__NIAKGPT_DIAGNOSTICS__={set(){}};
  });

  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html data-ng86-activity="ready"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div><main>rate guard fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-rate-guard/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:ui});

  const button=page.locator('[data-ng132-priority]');
  await button.waitFor({state:'visible',timeout:5000});
  await button.click();

  await page.waitForFunction(()=>{
    const state=window.__store['niakgpt-project-memory-state-v132']||{};
    const guard=window.__store['niakgpt-project-memory-rate-guard-v119']||{};
    return state.mode==='queued'&&state.pauseReason==='rate-limit'&&Number(guard.cooldownUntil||0)>Date.now()+10*60*1000;
  },null,{timeout:10000});

  await page.waitForTimeout(2500);

  const result=await page.evaluate(()=>({
    fetches:[...window.__rateFetches],
    state:window.__store['niakgpt-project-memory-state-v132']||{},
    guard:window.__store['niakgpt-project-memory-rate-guard-v119']||{},
    queue:window.__store['niakgpt-project-memory-queue-v132']||{},
    status:document.querySelector('[data-ng132-memory] .ng132-memory-status b')?.textContent||'',
    priorityDisabled:document.querySelector('[data-ng132-priority]')?.disabled===true,
    priorityText:document.querySelector('[data-ng132-priority]')?.textContent||''
  }));

  assert.equal(result.fetches.length,1,'429 protection emitted another conversation request during cooldown');
  assert.equal(result.state.pauseReason,'rate-limit');
  assert.ok(Number(result.guard.cooldownUntil||0)>Date.now()+10*60*1000,'429 did not persist a long account cooldown');
  assert.ok(Number(result.queue.retryAt||0)>=Number(result.guard.cooldownUntil||0)-1000,'queue did not inherit account cooldown');
  assert.match(result.status,/Protection ChatGPT/i);
  assert.equal(result.priorityDisabled,true,'manual priority action remained enabled during account cooldown');
  assert.match(result.priorityText,/Protection ChatGPT active/i);
  console.log('project-memory-rate-guard-v119: PASS 429 => persistent 15m account cooldown + zero retry storm');
}finally{
  await page.close();
  await browser.close();
}
