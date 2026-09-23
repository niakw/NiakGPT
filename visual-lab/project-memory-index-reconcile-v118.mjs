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
    const P='g-p-reconcile';
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
    const now=Date.now();
    const rows=[
      {id:ids[0],title:'Archived A',projectId:P,updated:now-4000},
      {id:ids[1],title:'Archived B',projectId:P,updated:now-3000},
      {id:ids[2],title:'Archived C',projectId:P,updated:now-2000},
      {id:ids[3],title:'Missing D',projectId:P,updated:now-1000}
    ];
    const archived=(id,title,updated)=>({
      schema:1,id,title,updated,capturedAt:new Date(updated).toISOString(),parts:1,messages:2,
      canonicalHash:'hash-'+id,bootstrapMetadataOnly:false,historyPartial:false,complete:true,captureSource:'backend'
    });
    const cache={
      schema:2,at:now,serverIndexedAt:now,
      projects:[{id:P,name:'Workspace',href:'/g/'+P+'/project',domOnly:false}],
      chats:rows,projectChats:{[P]:rows},counts:{[P]:4},indexedProjectIds:[P]
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
      bootstrapMetadataOnly:false,conversations:{[ids[0]]:archived(ids[0],'Archived A',now-4000)}
    },null,2)+'\n';
    remote['projects/'+P+'/conversations/'+ids[0]+'/index.json']=JSON.stringify(archived(ids[0],'Archived A',1000),null,2)+'\n';
    remote['projects/'+P+'/conversations/'+ids[0]+'/part-001.md']='# archived A\n';

    const recovered=[
      archived(ids[1],'Archived B',now-3000),
      archived(ids[2],'Archived C',now-2000)
    ];
    const listeners=[];
    const clone=v=>v===undefined?undefined:structuredClone(v);
    const keysFor=keys=>{
      if(keys==null)return Object.keys(store);
      if(typeof keys==='string')return[keys];
      if(Array.isArray(keys))return keys;
      if(keys&&typeof keys==='object')return Object.keys(keys);
      return[];
    };
    window.__reconcileFetches=[];
    window.__reconcileCommits=[];
    window.__reconcileStates=[];
    window.__reconcileRequests=[];
    window.__remote=remote;
    window.__store=store;
    window.chrome={
      runtime:{
        id:'reconcile-lab',lastError:null,getManifest:()=>({version:'0.9.123'}),
        sendMessage(message,cb){
          const type=String(message?.type||'');
          const reply=value=>queueMicrotask(()=>cb(value));
          if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'},github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
          if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,status:200});
          if(type==='niakgpt:memory-project-archive-v132'){
            window.__reconcileRequests.push({projectId:message.projectId,known:[...(message.knownArchivedIds||[])]});
            const known=new Set(message.knownArchivedIds||[]);
            return reply({ok:true,projectId:P,directoryCount:3,knownCount:known.size,missingCount:3-known.size,recovered:recovered.filter(row=>!known.has(row.id))});
          }
          if(type==='niakgpt:memory-chatgpt-fetch-v132'){
            const id=String(message.path||'').split('/').pop();
            window.__reconcileFetches.push(id);
            const title=id===ids[3]?'Missing D':'unexpected';
            return reply({ok:true,status:200,data:{
              id,title,update_time:(now-1000)/1000,current_node:'n2',
              mapping:{
                n1:{id:'n1',parent:null,message:{author:{role:'user'},create_time:1,content:{parts:['hello '+title]}}},
                n2:{id:'n2',parent:'n1',message:{author:{role:'assistant'},create_time:2,content:{parts:['answer '+title]}}}
              }
            }});
          }
          if(type==='niakgpt:memory-read-v132'){
            const p=String(message.path||'');
            return reply(Object.prototype.hasOwnProperty.call(remote,p)?{ok:true,content:remote[p]}:{ok:false,error:'github_http_404:not_found'});
          }
          if(type==='niakgpt:memory-commit-v132'){
            const files=clone(message.files||[]);
            window.__reconcileCommits.push({priority:message.priority===true,paths:files.map(file=>String(file.path||''))});
            for(const file of files)remote[String(file.path||'')]=String(file.content||'');
            return reply({ok:true,sha:'commit-'+window.__reconcileCommits.length});
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
            for(const[k,v]of Object.entries(obj||{})){
              changes[k]={oldValue:clone(store[k]),newValue:clone(v)};
              store[k]=clone(v);
              if(k==='niakgpt-project-memory-state-v132')window.__reconcileStates.push(clone(v));
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
    body:'<!doctype html><html data-ng86-activity="ready"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div><main>reconcile fixture</main></body></html>'
  }));
  await page.goto('https://chatgpt.com/g/g-p-reconcile/c/44444444-4444-4444-8444-444444444444',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:ui});

  const button=page.locator('[data-ng132-priority]');
  await button.waitFor({state:'visible',timeout:5000});
  await button.click();

  await page.waitForFunction(()=>{
    const state=window.__store['niakgpt-project-memory-state-v132']||{};
    const queue=window.__store['niakgpt-project-memory-queue-v132'];
    return state.mode==='idle'&&state.prioritySync===false&&queue===undefined;
  },null,{timeout:12000});

  const result=await page.evaluate(()=>{
    const P='g-p-reconcile';
    const idx=JSON.parse(window.__remote['projects/'+P+'/index.json']);
    const missing='44444444-4444-4444-8444-444444444444';
    const chatIdx=JSON.parse(window.__remote['projects/'+P+'/conversations/'+missing+'/index.json']);
    return{
      fetches:[...window.__reconcileFetches],
      requests:window.__reconcileRequests,
      states:window.__reconcileStates,
      projectIndex:idx,
      newChatIndex:chatIdx,
      projectIndexChars:window.__remote['projects/'+P+'/index.json'].length
    };
  });

  assert.deepEqual(result.fetches,['44444444-4444-4444-8444-444444444444'],'already archived chats were fetched again after index reconciliation');
  assert.ok(result.requests.length>=1,'durable archive reconciliation was not requested');
  assert.deepEqual(result.requests[0].known,['11111111-1111-4111-8111-111111111111']);
  assert.ok(result.states.some(row=>row.mode==='syncing'&&Number(row.chatDone||0)===3&&Number(row.chatTotal||0)===4),'resume progress did not recover 3/4 durable chats before network fetching');
  assert.equal(Object.keys(result.projectIndex.conversations||{}).length,4,'reconciled project index did not restore full local inventory');
  assert.equal(Object.values(result.projectIndex.conversations).some(row=>Object.hasOwn(row,'signals')),false,'project index still duplicates large per-chat signals');
  assert.ok(result.newChatIndex.signals&&Array.isArray(result.newChatIndex.signals.recent),'per-conversation index lost detailed signals while compacting project index');
  assert.ok(result.projectIndexChars<10000,'synthetic compact project index remained unexpectedly large');
  console.log('project-memory-index-reconcile-v118: PASS clobbered index self-heals from durable chat directories and resumes at recovered progress');
}finally{
  await page.close();
  await browser.close();
}
