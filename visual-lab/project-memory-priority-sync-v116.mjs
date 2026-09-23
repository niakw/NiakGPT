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
    const P='g-p-prioritylab';
    const C1='11111111-1111-4111-8111-111111111111';
    const C2='22222222-2222-4222-8222-222222222222';
    const C3='33333333-3333-4333-8333-333333333333';
    const now=Date.now();
    const cache={
      schema:2,at:now,serverIndexedAt:now,
      projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
      chats:[
        {id:C1,title:'Already archived',projectId:P,updated:now-3000},
        {id:C2,title:'Needs archive A',projectId:P,updated:now-2000},
        {id:C3,title:'Needs archive B',projectId:P,updated:now-1000}
      ],
      projectChats:{[P]:[
        {id:C1,title:'Already archived',projectId:P,updated:now-3000},
        {id:C2,title:'Needs archive A',projectId:P,updated:now-2000},
        {id:C3,title:'Needs archive B',projectId:P,updated:now-1000}
      ]},
      counts:{[P]:3},indexedProjectIds:[P]
    };
    const store={
      'niakgpt-v08-cache':cache,
      'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const remote={};
    remote['projects/'+P+'/index.json']=JSON.stringify({
      schema:1,projectId:P,projectName:'Workspace',updatedAt:new Date(now-3000).toISOString(),
      bootstrapMetadataOnly:false,
      conversations:{
        [C1]:{schema:1,id:C1,title:'Already archived',updated:now-3000,capturedAt:new Date(now-3000).toISOString(),parts:1,messages:2,bootstrapMetadataOnly:false,historyPartial:false,complete:true,captureSource:'backend',signals:{tasks:[],architecture:[],decisions:[],recent:[]}}
      }
    },null,2)+'\n';
    remote['projects/'+P+'/conversations/'+C1+'/part-001.md']='# archived\n';
    const listeners=[];
    const clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>{
      if(keys==null)return Object.keys(store);
      if(typeof keys==='string')return[keys];
      if(Array.isArray(keys))return keys;
      if(keys&&typeof keys==='object')return Object.keys(keys);
      return[];
    };
    window.__priorityFetches=[];
    window.__priorityCommits=[];
    window.__priorityStates=[];
    window.__failedC3=false;
    window.__remote=remote;
    window.__store=store;
    window.chrome={
      runtime:{
        id:'priority-sync-lab',lastError:null,getManifest:()=>({version:'0.9.121'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'},github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();
            window.__priorityFetches.push({id,at:Date.now()});
            const title=id===C2?'Needs archive A':'Needs archive B';
            return reply({ok:true,status:200,data:{
              id,title,update_time:Date.now()/1000,current_node:'n2',
              mapping:{
                n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:(Date.now()-1500)/1000,content:{parts:['hello '+title]}}},
                n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:(Date.now()-800)/1000,content:{parts:['answer '+title]}}}
              }
            }});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            const files=clone(message.files||[]);
            const hasC3=files.some(file=>String(file.path||'').includes('/conversations/'+C3+'/'));
            window.__priorityCommits.push({priority:message.priority===true,paths:files.map(file=>String(file.path||'')),at:Date.now()});
            if(message.priority===true&&hasC3&&!window.__failedC3){
              window.__failedC3=true;
              return reply({ok:false,error:'synthetic_write_failure'});
            }
            for(const file of files)remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'commit-'+window.__priorityCommits.length});
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
              if(k==='niakgpt-project-memory-state-v132')window.__priorityStates.push(clone(v));
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
    try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'memory-lock'})}});}catch{}
    window.__NIAKGPT_DIAGNOSTICS__={set(){}};
  });

  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html data-ng86-activity="ready"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div><main>priority sync fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-prioritylab/c/33333333-3333-4333-8333-333333333333',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:ui});

  const button=page.locator('[data-ng132-priority]');
  await button.waitFor({state:'visible',timeout:5000});
  assert.equal((await button.textContent())?.trim(),'Forcer la synchro des chats');
  await button.click();

  await page.waitForFunction(()=>{
    const P='g-p-prioritylab',C3='33333333-3333-4333-8333-333333333333';
    const idx=window.__remote['projects/'+P+'/index.json'];
    if(!idx)return false;
    try{
      const complete=JSON.parse(idx).conversations?.[C3]?.complete===true;
      const queue=window.__store['niakgpt-project-memory-queue-v132'];
      const state=window.__store['niakgpt-project-memory-state-v132']||{};
      return complete&&queue===undefined&&state.mode==='idle'&&state.prioritySync===false;
    }catch{return false;}
  },null,{timeout:12000});

  const result=await page.evaluate(()=>{
    const P='g-p-prioritylab';
    const C1='11111111-1111-4111-8111-111111111111';
    const C2='22222222-2222-4222-8222-222222222222';
    const C3='33333333-3333-4333-8333-333333333333';
    const fetchCount=id=>window.__priorityFetches.filter(row=>row.id===id).length;
    const idx=JSON.parse(window.__remote['projects/'+P+'/index.json']);
    const resumed=window.__priorityStates.some(row=>row.mode==='syncing'&&row.projectId===P&&Number(row.chatDone||0)>=2&&Number(row.chatTotal||0)===3);
    return{
      c1:fetchCount(C1),c2:fetchCount(C2),c3:fetchCount(C3),
      complete:Object.fromEntries(Object.entries(idx.conversations||{}).map(([id,row])=>[id,row.complete===true])),
      priorityCommits:window.__priorityCommits.filter(row=>row.priority).length,
      failedC3:window.__failedC3,
      resumed,
      queue:window.__store['niakgpt-project-memory-queue-v132']||null,
      state:window.__store['niakgpt-project-memory-state-v132']||{}
    };
  });
  assert.equal(result.c1,0,'priority catch-up refetched an already complete conversation');
  assert.equal(result.c2,1,'durably checkpointed conversation was replayed after the later write failure');
  assert.ok(result.c3>=2,'synthetic failed conversation was not retried');
  assert.equal(result.failedC3,true,'synthetic GitHub failure was not exercised');
  assert.ok(result.priorityCommits>=2,'priority flag did not reach durable writes');
  assert.equal(result.resumed,true,'resume progress did not preserve the durable chat checkpoint');
  assert.equal(result.queue,null,'priority queue was not cleared after full convergence');
  assert.equal(result.state.prioritySync,false,'priority mode did not end after convergence');
  console.log('project-memory-priority-sync-v116: PASS durable per-chat resume + explicit priority transfer');
}finally{
  await page.close();
  await browser.close();
}
