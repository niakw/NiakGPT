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
    const P='g-p-ratehold';
    const C1='11111111-1111-4111-8111-111111111111';
    const C2='22222222-2222-4222-8222-222222222222';
    const now=Date.now();
    const chats=[
      {id:C1,title:'Rate limited A',projectId:P,updated:now-2000},
      {id:C2,title:'Later B',projectId:P,updated:now-1000}
    ];
    const store={
      'niakgpt-v08-cache':{
        schema:2,at:now,serverIndexedAt:now,
        projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
        chats,projectChats:{[P]:chats},counts:{[P]:2},indexedProjectIds:[P]
      },
      'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const remote={
      ['projects/'+P+'/index.json']:JSON.stringify({schema:1,projectId:P,projectName:'Workspace',updatedAt:new Date(now-5000).toISOString(),bootstrapMetadataOnly:true,conversations:{}},null,2)+'\n'
    };
    const listeners=[];
    const clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>{
      if(keys==null)return Object.keys(store);
      if(typeof keys==='string')return[keys];
      if(Array.isArray(keys))return keys;
      if(keys&&typeof keys==='object')return Object.keys(keys);
      return[];
    };
    const conversationData=(id,title)=>({
      id,title,update_time:Date.now()/1000,current_node:'n2',
      mapping:{
        n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:(Date.now()-1500)/1000,content:{parts:['hello '+title]}}},
        n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:(Date.now()-800)/1000,content:{parts:['answer '+title]}}}
      }
    });
    window.__fetches=[];
    window.__recoverRate=false;
    window.__store=store;
    window.__remote=remote;
    window.chrome={
      runtime:{
        id:'manual-rate-hold-lab',lastError:null,getManifest:()=>({version:'0.9.121'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'},github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-project-archive-v132')return reply({ok:true,projectId:P,directoryCount:0,knownCount:0,missingCount:0,recovered:[]});
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();
            window.__fetches.push({id,at:Date.now()});
            if(id===C1&&!window.__recoverRate)return reply({ok:false,status:429,error:'chatgpt_memory_http_429'});
            return reply({ok:true,status:200,data:conversationData(id,id===C1?'Rate limited A':'Later B')});
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
    body:'<!doctype html><html data-ng86-activity="ready"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div><main>manual 429 hold fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-ratehold/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:ui});

  const priority=page.locator('[data-ng132-priority]');
  await priority.waitFor({state:'visible',timeout:5000});
  await priority.click();

  await page.waitForFunction(()=>{
    const q=window.__store['niakgpt-project-memory-queue-v132']||{};
    const s=window.__store['niakgpt-project-memory-state-v132']||{};
    return q.hold===true&&q.holdReason==='rate-limit-manual'&&s.pauseReason==='rate-limit-manual';
  },null,{timeout:10000});

  const firstCount=await page.evaluate(()=>window.__fetches.length);
  assert.equal(firstCount,1,'a real 429 did not stop Project Memory immediately');

  await page.waitForTimeout(2500);
  const afterWait=await page.evaluate(()=>window.__fetches.length);
  assert.equal(afterWait,1,'held 429 queue resumed automatically');

  await page.waitForFunction(()=>{
    const b=document.querySelector('[data-ng132-priority]');
    return /Reprendre après restriction ChatGPT/.test(b?.textContent||'');
  },null,{timeout:5000});

  await page.evaluate(()=>{window.__recoverRate=true;});
  await priority.click();

  await page.waitForFunction(()=>{
    const P='g-p-ratehold',C1='11111111-1111-4111-8111-111111111111',C2='22222222-2222-4222-8222-222222222222';
    const raw=window.__remote['projects/'+P+'/index.json'];
    const state=window.__store['niakgpt-project-memory-state-v132']||{};
    if(!raw)return false;
    try{
      const idx=JSON.parse(raw);
      return idx.conversations?.[C1]?.complete===true&&idx.conversations?.[C2]?.complete===true&&state.mode==='idle';
    }catch{return false;}
  },null,{timeout:12000});

  const final=await page.evaluate(()=>{
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
    return{
      counts:Object.fromEntries(ids.map(id=>[id,window.__fetches.filter(row=>row.id===id).length])),
      queue:window.__store['niakgpt-project-memory-queue-v132'],
      state:window.__store['niakgpt-project-memory-state-v132']
    };
  });
  assert.equal(final.counts['11111111-1111-4111-8111-111111111111'],2,'manual resume did not retry the rate-limited conversation exactly once');
  assert.equal(final.counts['22222222-2222-4222-8222-222222222222'],1,'later conversation was not archived after manual resume');
  assert.equal(final.queue,undefined,'manual resume left a stale queue behind');
  assert.equal(final.state.pauseReason,'','rate-limit hold survived successful manual resume');

  console.log('project-memory-manual-rate-hold-v121: PASS real 429 => zero auto retry + explicit user resume + convergence');
}finally{
  await page.close();
  await browser.close();
}
