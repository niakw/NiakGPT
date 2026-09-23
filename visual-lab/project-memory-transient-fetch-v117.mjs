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
    const P='g-p-transientlab';
    const C1='11111111-1111-4111-8111-111111111111';
    const C2='22222222-2222-4222-8222-222222222222';
    const C3='33333333-3333-4333-8333-333333333333';
    const C4='44444444-4444-4444-8444-444444444444';
    const now=Date.now();
    const chats=[
      {id:C1,title:'Already archived',projectId:P,updated:now-4000},
      {id:C2,title:'Temporarily unavailable',projectId:P,updated:now-3000},
      {id:C3,title:'Continue after failure A',projectId:P,updated:now-2000},
      {id:C4,title:'Continue after failure B',projectId:P,updated:now-1000}
    ];
    const cache={
      schema:2,at:now,serverIndexedAt:now,
      projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
      chats,projectChats:{[P]:chats},counts:{[P]:4},indexedProjectIds:[P]
    };
    const store={
      'niakgpt-v08-cache':cache,
      'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:false},
      'niakgpt-project-memory-state-v132':{},
      'niakgpt-project-memory-queue-v132':{}
    };
    const remote={};
    remote['projects/'+P+'/index.json']=JSON.stringify({
      schema:1,projectId:P,projectName:'Workspace',updatedAt:new Date(now-4000).toISOString(),
      bootstrapMetadataOnly:false,
      conversations:{
        [C1]:{schema:1,id:C1,title:'Already archived',updated:now-4000,capturedAt:new Date(now-4000).toISOString(),parts:1,messages:2,bootstrapMetadataOnly:false,historyPartial:false,complete:true,captureSource:'backend',signals:{tasks:[],architecture:[],decisions:[],recent:[]}}
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
    window.__fetches=[];
    window.__commits=[];
    window.__states=[];
    window.__recoverC2=false;
    window.__remote=remote;
    window.__store=store;
    const conversationData=(id,title)=>({
      id,title,update_time:Date.now()/1000,current_node:'n2',
      mapping:{
        n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:(Date.now()-1500)/1000,content:{parts:['hello '+title]}}},
        n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:(Date.now()-800)/1000,content:{parts:['answer '+title]}}}
      }
    });
    window.chrome={
      runtime:{
        id:'transient-sync-lab',lastError:null,getManifest:()=>({version:'0.9.124'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'},github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-project-archive-v132')return reply({ok:true,projectId:P,directoryCount:1,knownCount:1,missingCount:0,recovered:[]});
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();
            const count=window.__fetches.filter(row=>row.id===id).length+1;
            window.__fetches.push({id,count,at:Date.now()});
            if(id===C2&&!window.__recoverC2){
              if(count===1)return reply({ok:false,status:500,error:'chatgpt_memory_http_500'});
              return reply({ok:false,status:0,error:'Failed to fetch'});
            }
            const title=id===C2?'Temporarily unavailable':id===C3?'Continue after failure A':'Continue after failure B';
            return reply({ok:true,status:200,data:conversationData(id,title)});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            const files=clone(message.files||[]);
            window.__commits.push({priority:message.priority===true,paths:files.map(file=>String(file.path||'')),at:Date.now()});
            for(const file of files)remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'commit-'+window.__commits.length});
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
              if(k==='niakgpt-project-memory-state-v132')window.__states.push(clone(v));
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
    body:'<!doctype html><html data-ng86-activity="ready"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div><main>transient sync fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-transientlab/c/44444444-4444-4444-8444-444444444444',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:ui});

  const button=page.locator('[data-ng132-priority]');
  await button.waitFor({state:'visible',timeout:5000});
  await button.click();

  await page.waitForFunction(()=>{
    const P='g-p-transientlab',C3='33333333-3333-4333-8333-333333333333',C4='44444444-4444-4444-8444-444444444444';
    const idx=window.__remote['projects/'+P+'/index.json'];
    const state=window.__store['niakgpt-project-memory-state-v132']||{};
    const pile=window.__store['niakgpt-project-memory-chat-retry-v117']||{};
    if(!idx)return false;
    try{
      const conv=JSON.parse(idx).conversations||{};
      return conv[C3]?.complete===true&&conv[C4]?.complete===true&&state.mode==='idle'&&Object.keys(pile).length===1;
    }catch{return false;}
  },null,{timeout:12000});

  const first=await page.evaluate(()=>{
    const P='g-p-transientlab';
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
    const counts=Object.fromEntries(ids.map(id=>[id,window.__fetches.filter(row=>row.id===id).length]));
    const idx=JSON.parse(window.__remote['projects/'+P+'/index.json']);
    const c3Writes=window.__commits.filter(row=>row.paths.some(p=>p.includes('/conversations/'+ids[2]+'/'))).length;
    const c4Writes=window.__commits.filter(row=>row.paths.some(p=>p.includes('/conversations/'+ids[3]+'/'))).length;
    return {
      counts,
      state:window.__store['niakgpt-project-memory-state-v132'],
      queue:window.__store['niakgpt-project-memory-queue-v132'],
      pile:window.__store['niakgpt-project-memory-chat-retry-v117']||{},
      idx,c3Writes,c4Writes,
      handledAll:window.__states.some(row=>row.mode==='syncing'&&Number(row.chatDone||0)===4&&Number(row.chatTotal||0)===4)
    };
  });
  assert.equal(first.counts['11111111-1111-4111-8111-111111111111'],0,'already archived chat was fetched again');
  assert.equal(first.counts['22222222-2222-4222-8222-222222222222'],2,'transient failing chat exceeded the bounded immediate retry count');
  assert.equal(first.counts['33333333-3333-4333-8333-333333333333'],1,'later chat A did not continue after transient failure');
  assert.equal(first.counts['44444444-4444-4444-8444-444444444444'],1,'later chat B did not continue after transient failure');
  assert.equal(first.state.mode,'idle','transient chat failure prevented healthy backlog completion');
  assert.equal(first.handledAll,true,'quarantined chat did not count as handled for automatic progress');
  assert.equal(Object.keys(first.pile).length,1,'failed chat was not quarantined into the manual retry pile');
  assert.equal(first.queue,undefined,'failed chat incorrectly kept the automatic Project queue alive');
  assert.equal(first.c3Writes,1,'healthy chat A did not receive one canonical durable write');
  assert.equal(first.c4Writes,1,'healthy chat B did not receive one canonical durable write');

  await page.waitForTimeout(2500);
  const c2AfterWait=await page.evaluate(()=>window.__fetches.filter(row=>row.id==='22222222-2222-4222-8222-222222222222').length);
  assert.equal(c2AfterWait,2,'manual retry pile emitted an automatic retry');

  await page.evaluate(()=>{ window.__recoverC2=true; });
  const retryButton=page.locator('[data-ng132-retry-failed]');
  await retryButton.waitFor({state:'visible',timeout:5000});
  assert.equal(await retryButton.isEnabled(),true,'manual retry button stayed disabled with one failed chat');
  assert.match((await retryButton.textContent())||'',/\(1\)/);
  await retryButton.click();

  await page.waitForFunction(()=>{
    const P='g-p-transientlab',C2='22222222-2222-4222-8222-222222222222';
    const idx=window.__remote['projects/'+P+'/index.json'];
    const state=window.__store['niakgpt-project-memory-state-v132']||{};
    if(!idx)return false;
    const pile=window.__store['niakgpt-project-memory-chat-retry-v117'];
    try{return JSON.parse(idx).conversations?.[C2]?.complete===true&&state.mode==='idle'&&(!pile||Object.keys(pile).length===0);}catch{return false;}
  },null,{timeout:12000});

  const final=await page.evaluate(()=>{
    const ids=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
    return Object.fromEntries(ids.map(id=>[id,window.__fetches.filter(row=>row.id===id).length]));
  });
  assert.equal(final['22222222-2222-4222-8222-222222222222'],3,'failed chat did not retry exactly once after the manual button was used');
  assert.equal(final['33333333-3333-4333-8333-333333333333'],1,'already imported chat A was duplicated/refetched on deferred retry');
  assert.equal(final['44444444-4444-4444-8444-444444444444'],1,'already imported chat B was duplicated/refetched on deferred retry');

  console.log('project-memory-transient-fetch-v117: PASS bounded retry + continue + manual retry pile + no automatic loop + no duplicate refetch');
}finally{
  await page.close();
  await browser.close();
}
