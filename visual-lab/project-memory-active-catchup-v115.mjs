import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const source=fs.readFileSync(path.join(ROOT,'project-memory-v132.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1100,height:760}});

try{
  await page.addInitScript(()=>{
    const P='g-p-activehistory';
    const C1='11111111-1111-4111-8111-111111111111';
    const C2='22222222-2222-4222-8222-222222222222';
    const now=Date.now();
    const cache={
      schema:2,at:now,serverIndexedAt:now,
      projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
      chats:[
        {id:C1,title:'Older thread',projectId:P,updated:now-2000,href:'/g/'+P+'/c/'+C1},
        {id:C2,title:'Current thread',projectId:P,updated:now-1000,href:'/g/'+P+'/c/'+C2}
      ],
      projectChats:{[P]:[
        {id:C1,title:'Older thread',projectId:P,updated:now-2000,href:'/g/'+P+'/c/'+C1},
        {id:C2,title:'Current thread',projectId:P,updated:now-1000,href:'/g/'+P+'/c/'+C2}
      ]},
      counts:{[P]:2},indexedProjectIds:[P]
    };
    const store={
      'niakgpt-v08-cache':cache,
      'niakgpt-project-memory-prefs-v132':{autoSync:true,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const remote={};
    const listeners=[];
    const clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>{
      if(keys==null)return Object.keys(store);
      if(typeof keys==='string')return[keys];
      if(Array.isArray(keys))return keys;
      if(keys&&typeof keys==='object')return Object.keys(keys);
      return[];
    };
    window.__historyFetches=[];
    window.__memoryCommits=[];
    window.__memoryStart=Date.now();
    window.__store=store;
    window.chrome={
      runtime:{
        id:'active-history-lab',
        lastError:null,
        getManifest:()=>({version:'0.9.124'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();
            window.__historyFetches.push({id,at:Date.now()-window.__memoryStart});
            const title=id===C1?'Older thread':'Current thread';
            return reply({ok:true,status:200,data:{
              id,title,update_time:Date.now()/1000,current_node:'n2',
              mapping:{
                n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:(Date.now()-2000)/1000,content:{parts:['hello '+title]}}},
                n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:(Date.now()-1000)/1000,content:{parts:['answer '+title]}}}
              }
            }});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            const files=clone(message.files||[]);
            window.__memoryCommits.push({message:String(message.message||''),files,at:Date.now()-window.__memoryStart});
            for(const file of files)remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'commit-'+window.__memoryCommits.length});
          }
          if(type==='niakgpt:memory-catalog-v132')return reply({ok:true,projects:[]});
          return reply({ok:false,error:'unexpected:'+type});
        }
      },
      storage:{
        local:{
          async get(keys){
            if(keys&&typeof keys==='object'&&!Array.isArray(keys)){
              return Object.fromEntries(Object.entries(keys).map(([k,fallback])=>[k,store[k]===undefined?clone(fallback):clone(store[k])]));
            }
            return Object.fromEntries(keysFor(keys).filter(k=>store[k]!==undefined).map(k=>[k,clone(store[k])]));
          },
          async set(obj){
            const changes={};
            for(const[k,v]of Object.entries(obj||{})){
              changes[k]={oldValue:clone(store[k]),newValue:clone(v)};
              store[k]=clone(v);
            }
            for(const fn of listeners)fn(changes,'local');
          },
          async remove(keys){
            const changes={};
            for(const k of(Array.isArray(keys)?keys:[keys])){
              if(store[k]!==undefined)changes[k]={oldValue:clone(store[k]),newValue:undefined};
              delete store[k];
            }
            if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local');
          }
        },
        onChanged:{addListener(fn){listeners.push(fn);}}
      }
    };
    try{
      Object.defineProperty(navigator,'locks',{configurable:true,value:{
        request:async(_name,_opts,cb)=>cb({name:'memory-lock'})
      }});
    }catch{}
    window.__NIAKGPT_DIAGNOSTICS__={set(){}};
  });

  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,
    contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html data-ng86-activity="ready"><body><main>active conversation</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-activehistory/c/22222222-2222-4222-8222-222222222222',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:source});

  // The runtime has just loaded, so human quiet time is effectively zero. Before 0.9.115,
  // automatic history sync always waited 60 seconds here even though the extension-background
  // transport was already authorized and did not touch the ChatGPT page.
  await page.waitForFunction(()=>window.__historyFetches.length>=1,null,{timeout:8000});
  const first=await page.evaluate(()=>window.__historyFetches[0]);
  assert.ok(first.at<8000,'background history catch-up still waits for the 60s human-quiet gate: '+JSON.stringify(first));

  await page.waitForFunction(()=>window.__memoryCommits.some(batch=>batch.files.some(file=>/conversations\/11111111-1111-4111-8111-111111111111\/part-001\.md$/.test(file.path))),null,{timeout:8000});
  const state=await page.evaluate(()=>({
    fetches:window.__historyFetches,
    commits:window.__memoryCommits.map(batch=>({message:batch.message,paths:batch.files.map(file=>file.path),at:batch.at})),
    localState:window.__store['niakgpt-project-memory-state-v132']||{},
    queue:window.__store['niakgpt-project-memory-queue-v132']||null,
    transport:document.documentElement.dataset.ng132HistoryTransport||''
  }));
  assert.equal(state.transport,'background');
  assert.ok(state.commits.some(batch=>batch.paths.some(p=>p.includes('/conversations/'))),'no durable conversation archive was written');
  assert.notEqual(state.localState.pauseReason,'quiet','active-background catch-up incorrectly reported human quiet as a blocker');
  console.log('project-memory-active-catchup-v115: PASS active chat bypasses 60s quiet gate only for safe extension-background history transport');
}finally{
  await page.close();
  await browser.close();
}
