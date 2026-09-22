import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const core=fs.readFileSync(path.join(ROOT,'project-memory-v132.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1180,height:820}});

try{
  await page.addInitScript(()=>{
    const P='g-p-indexunion';
    const ids=[
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    ];
    const now=Date.now();
    const chat=(id,i)=>({id,title:'Thread '+(i+1),projectId:P,updated:now-(5000-i*500)});
    const chats=ids.map(chat);
    const cache={
      schema:2,at:now,serverIndexedAt:now,
      projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
      chats,projectChats:{[P]:chats},counts:{[P]:5},indexedProjectIds:[P]
    };
    const archived=id=>({
      schema:1,id,title:'Archived '+id.slice(0,4),updated:now-10000,capturedAt:new Date(now-10000).toISOString(),
      parts:1,messages:2,canonicalHash:'hash-'+id,bootstrapMetadataOnly:false,historyPartial:false,complete:true,captureSource:'backend',
      signals:{tasks:[],architecture:[],decisions:[],recent:[]}
    });
    const initial={
      schema:1,projectId:P,projectName:'Workspace',bootstrapMetadataOnly:false,updatedAt:new Date(now-10000).toISOString(),
      conversations:{[ids[0]]:archived(ids[0]),[ids[1]]:archived(ids[1])}
    };
    const recovered={
      ...initial,updatedAt:new Date(now-5000).toISOString(),
      conversations:{...initial.conversations,[ids[2]]:archived(ids[2]),[ids[3]]:archived(ids[3])}
    };
    const remote={'projects/'+P+'/index.json':JSON.stringify(initial,null,2)+'\n'};
    const store={
      'niakgpt-v08-cache':cache,
      'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const listeners=[],clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>keys==null?Object.keys(store):typeof keys==='string'?[keys]:Array.isArray(keys)?keys:(keys&&typeof keys==='object'?Object.keys(keys):[]);
    window.__fetches=[];window.__recoverCalls=[];window.__states=[];window.__remote=remote;window.__store=store;window.__ids=ids;
    window.chrome={
      runtime:{
        id:'index-union-lab',lastError:null,getManifest:()=>({version:'0.9.118'}),
        sendMessage(message,cb){
          const type=String(message?.type||''),reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-project-index-recover-v132'){
            window.__recoverCalls.push({projectId:message.projectId,at:Date.now()});
            remote['projects/'+P+'/index.json']=JSON.stringify(recovered,null,2)+'\n';
            return reply({ok:true,projectId:P,discovered:4,recovered:2,indexed:4,index:clone(recovered)});
          }
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();window.__fetches.push(id);
            const title='Thread 5';
            return reply({ok:true,status:200,data:{
              id,title,update_time:Date.now()/1000,current_node:'n2',
              mapping:{
                n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:(Date.now()-1000)/1000,content:{parts:['hello']}}},
                n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:(Date.now()-500)/1000,content:{parts:['answer']}}}
              }
            }});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            for(const file of(message.files||[]))remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'synthetic-commit'});
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
            for(const[k,v]of Object.entries(obj||{})){changes[k]={oldValue:clone(store[k]),newValue:clone(v)};store[k]=clone(v);if(k==='niakgpt-project-memory-state-v132')window.__states.push(clone(v));}
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
    body:'<!doctype html><html data-ng86-activity="ready"><body><main>index union fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-indexunion/c/55555555-5555-4555-8555-555555555555',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.syncPriorityNow());

  await page.waitForFunction(()=>{
    const P='g-p-indexunion',ids=window.__ids;
    const raw=window.__remote['projects/'+P+'/index.json'];
    const st=window.__store['niakgpt-project-memory-state-v132']||{};
    if(!raw)return false;
    try{return Object.keys(JSON.parse(raw).conversations||{}).length===5&&st.mode==='idle';}catch{return false;}
  },null,{timeout:12000});

  const result=await page.evaluate(()=>{
    const P='g-p-indexunion',ids=window.__ids,idx=JSON.parse(window.__remote['projects/'+P+'/index.json']);
    return{
      recoverCalls:window.__recoverCalls.length,
      fetches:window.__fetches.slice(),
      rows:Object.keys(idx.conversations||{}).length,
      complete:Object.values(idx.conversations||{}).filter(row=>row?.complete===true&&Number(row?.parts||0)>0).length,
      sawRepair:window.__states.some(row=>row.indexRepairPending===true),
      sawRecovered:window.__states.some(row=>Number(row.recoveredChats||0)===2&&Number(row.indexRows||0)===4),
      finalState:window.__store['niakgpt-project-memory-state-v132']||{}
    };
  });
  assert.equal(result.recoverCalls,1,'collapsed Project index was not repaired before history fetch');
  assert.deepEqual(result.fetches,['55555555-5555-4555-8555-555555555555'],'already archived conversations were fetched again after index recovery');
  assert.equal(result.rows,5);
  assert.equal(result.complete,5);
  assert.equal(result.sawRepair,true);
  assert.equal(result.sawRecovered,true);
  assert.equal(result.finalState.mode,'idle');
  console.log('project-memory-index-union-v118: PASS collapsed index rebuilt from durable conversation checkpoints; only missing chat fetched');
}finally{
  await page.close();
  await browser.close();
}
