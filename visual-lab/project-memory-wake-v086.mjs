import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
let source=await fs.readFile(path.join(ROOT,'project-memory-v132.js'),'utf8');
source=source
  .replace('const HISTORY_FETCH_GAP_MS = 20000;','const HISTORY_FETCH_GAP_MS = 60;')
  .replace('const HUMAN_QUIET_MS = 60*1000;','const HUMAN_QUIET_MS = 180;')
  .replace('const WAKE_HEARTBEAT_MS = 30000;','const WAKE_HEARTBEAT_MS = 120;');

const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1000,height:760}});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      window.__wakeLockCalls=0;window.__wakeCommitCalls=0;window.__wakeRpcCalls=0;window.__wakeRemote={};window.__wakeCommittedFiles=[];
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
      Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,fn)=>{
        window.__wakeLockCalls++;
        if(window.__wakeLockCalls===1)return fn(null);
        return fn({name:'memory'});
      }}});
      const CACHE='niakgpt-v08-cache',PREFS='niakgpt-project-memory-prefs-v132',QUEUE='niakgpt-project-memory-queue-v132';
      const data={
        [CACHE]:{
          projects:[{id:'g-p-one',name:'One',href:'/g/g-p-one/project'}],
          chats:[{id:'11111111-1111-4111-8111-111111111111',title:'First chat',projectId:'g-p-one',updated:Date.now()}],
          counts:{'g-p-one':1},indexedProjectIds:['g-p-one']
        },
        [PREFS]:{autoSync:true,injectOnNewChat:true},
        [QUEUE]:{pending:['g-p-one'],force:false,at:Date.now()}
      };
      window.__wakeLocal=data;
      const listeners=[],clone=v=>v===undefined?undefined:structuredClone(v);
      window.chrome={
        runtime:{
          lastError:null,
          sendMessage(message,cb){
            if(message.type==='niakgpt:memory-status-v132')return cb({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private-vault',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(message.type==='niakgpt:memory-read-v132'){
              const content=window.__wakeRemote[String(message.path||'')];
              return content===undefined?cb({ok:false,error:'github_http_404:not_found'}):cb({ok:true,content});
            }
            if(message.type==='niakgpt:memory-commit-v132'){
              window.__wakeCommitCalls++;
              for(const file of (message.files||[])){
                window.__wakeRemote[String(file.path||'')]=String(file.content||'');
                window.__wakeCommittedFiles.push({path:String(file.path||''),content:String(file.content||'')});
              }
              return cb({ok:true,sha:'wake-'+window.__wakeCommitCalls});
            }
            cb({ok:false,error:'unexpected:'+message.type});
          }
        },
        storage:{
          local:{
            async get(keys){const list=keys==null?Object.keys(data):(Array.isArray(keys)?keys:[keys]),out={};for(const key of list)if(data[key]!==undefined)out[key]=clone(data[key]);return out;},
            async set(obj){const changes={};for(const [key,value] of Object.entries(obj)){changes[key]={oldValue:clone(data[key]),newValue:clone(value)};data[key]=clone(value);}for(const fn of listeners)fn(changes,'local');},
            async remove(keys){for(const key of (Array.isArray(keys)?keys:[keys]))delete data[key];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><main>Wake heartbeat lab</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.documentElement.dataset.ng8TabRole='worker';
      document.documentElement.dataset.ng8Running='1';
      document.addEventListener('niakgpt:rpc-request',event=>{
        window.__wakeRpcCalls++;
        const id=event.detail?.id;if(!id)return;
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{
          id,ok:true,status:200,data:{
            title:'First chat',update_time:Date.now()/1000,current_node:'n1',
            mapping:{n1:{parent:null,message:{author:{role:'user'},create_time:Date.now()/1000,content:{parts:['Wake heartbeat synthetic conversation.']}}}}
          }
        }})),5);
      });
    });
    await page.addScriptTag({content:source});
    await page.waitForTimeout(300);
    let snapshot=await page.evaluate(()=>({locks:window.__wakeLockCalls,commits:window.__wakeCommitCalls,rpc:window.__wakeRpcCalls,state:window.__wakeLocal['niakgpt-project-memory-state-v132']||{}}));
    assert(snapshot.commits>=1,'busy startup did not persist the required local-cache GitHub snapshot: '+JSON.stringify(snapshot));
    assert(snapshot.rpc===0,'busy startup touched ChatGPT history before native ChatGPT became idle: '+JSON.stringify(snapshot));
    assert(snapshot.state.bootstrapSource==='local-cache-only'&&snapshot.state.bootstrapCachedFiles===4,'busy startup commit was not the metadata-only cache bootstrap: '+JSON.stringify(snapshot));
    const cachedCommitCount=snapshot.commits;

    // Clear native busy with NO activity/visibility/storage event. The shortened lab-only quiet
    // window + heartbeat must recover the persistent queue without restoring production aggressiveness.
    await page.evaluate(()=>{document.documentElement.dataset.ng8Running='0';});
    await page.waitForFunction(({cachedCommitCount})=>{const q=window.__wakeLocal['niakgpt-project-memory-queue-v132'];const st=window.__wakeLocal['niakgpt-project-memory-state-v132']||{};return window.__wakeRpcCalls>=1&&window.__wakeCommitCalls>cachedCommitCount&&!q?.pending?.length&&st.mode==='idle';},{cachedCommitCount},{timeout:7000});

    snapshot=await page.evaluate(()=>({
      locks:window.__wakeLockCalls,
      commits:window.__wakeCommitCalls,
      rpc:window.__wakeRpcCalls,
      queue:window.__wakeLocal['niakgpt-project-memory-queue-v132'],
      state:window.__wakeLocal['niakgpt-project-memory-state-v132']||{},
      wakeBeat:document.documentElement.dataset.ng132WakeBeat||''
    }));
    assert(snapshot.locks>=2,'lock-unavailable attempt was not retried by heartbeat: '+JSON.stringify(snapshot));
    assert(snapshot.rpc>=1,'persistent Project Memory history did not resume after heartbeat recovery: '+JSON.stringify(snapshot));
    assert(snapshot.commits>cachedCommitCount,'persistent Project Memory queue did not produce a post-idle history commit: '+JSON.stringify(snapshot));
    assert(!snapshot.queue?.pending?.length,'persistent queue was not consumed after heartbeat recovery: '+JSON.stringify(snapshot));
    assert(snapshot.state.mode==='idle','Project Memory did not reach idle after heartbeat recovery: '+JSON.stringify(snapshot));
    assert(!!snapshot.wakeBeat,'heartbeat diagnostic marker was never published: '+JSON.stringify(snapshot));

    // Regression 0.9.101: a later cache-only bootstrap (the in-chat path) must preserve the
    // archive metadata that the full-history pass just wrote instead of resetting it to 0/0.
    await page.evaluate(async()=>{
      history.pushState({},'', '/g/g-p-one/c/11111111-1111-4111-8111-111111111111');
      await window.__NIAKGPT_PROJECT_MEMORY__.syncNow({force:false});
    });
    let archive=await page.evaluate(()=>{
      const raw=window.__wakeRemote['projects/g-p-one/index.json'];
      const idx=raw?JSON.parse(raw):null,row=idx?.conversations?.['11111111-1111-4111-8111-111111111111'];
      return{topBootstrap:idx?.bootstrapMetadataOnly,row};
    });
    assert(Number(archive.row?.parts||0)>0&&Number(archive.row?.messages||0)>0,'cache bootstrap erased archived transcript metadata: '+JSON.stringify(archive));
    assert(archive.topBootstrap===false,'mixed/full archive was mislabeled metadata-only: '+JSON.stringify(archive));

    // Current-chat archival no longer needs a ChatGPT RPC: serialize the already-rendered DOM
    // straight to the private GitHub vault, normalize polluted Project UI text, and leave it
    // marked partial so the later off-chat backend pass can replace it canonically.
    const rpcBeforeDom=await page.evaluate(()=>window.__wakeRpcCalls);
    await page.evaluate(()=>{
      const cache=window.__wakeLocal['niakgpt-v08-cache'];
      cache.projects[0].name='▤▤One21/09 [1]›';
      const main=document.querySelector('main');main.innerHTML='';
      const u=document.createElement('div');u.dataset.messageAuthorRole='user';u.textContent='Visible user message';
      const a=document.createElement('div');a.dataset.messageAuthorRole='assistant';a.textContent='Visible assistant reply';
      main.append(u,a);
    });
    const domResult=await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.syncNow({force:true}));
    const domProof=await page.evaluate(()=>{
      const index=JSON.parse(window.__wakeRemote['projects/g-p-one/index.json']||'{}');
      const row=index.conversations?.['11111111-1111-4111-8111-111111111111']||{};
      const project=JSON.parse(window.__wakeRemote['projects/g-p-one/project.json']||'{}');
      const part=window.__wakeRemote['projects/g-p-one/conversations/11111111-1111-4111-8111-111111111111/part-001.md']||'';
      const conversationIndex=JSON.parse(window.__wakeRemote['projects/g-p-one/conversations/11111111-1111-4111-8111-111111111111/index.json']||'{}');
      return{rpc:window.__wakeRpcCalls,index,row,project,part,conversationIndex,marker:document.documentElement.dataset.ng132DomCapture||''};
    });
    assert(domResult?.domCaptured===true,'manual in-chat sync did not report DOM capture: '+JSON.stringify(domResult));
    assert(domProof.rpc===rpcBeforeDom,'current-chat DOM capture touched ChatGPT RPC: '+JSON.stringify(domProof));
    assert(domProof.row.captureSource==='live-dom'&&domProof.row.complete===false&&domProof.row.historyPartial===true,'DOM capture was not marked partial: '+JSON.stringify(domProof.row));
    assert(domProof.row.messages===2&&domProof.row.parts>=1,'DOM capture did not persist visible messages: '+JSON.stringify(domProof.row));
    assert(domProof.conversationIndex.captureSource==='live-dom'&&domProof.conversationIndex.messages===2,'per-conversation DOM index missing or stale: '+JSON.stringify(domProof.conversationIndex));
    assert(domProof.project.name==='One'&&domProof.index.projectName==='One','polluted Project name reached private vault: '+JSON.stringify({project:domProof.project.name,index:domProof.index.projectName}));
    assert(domProof.part.includes('Visible user message')&&domProof.part.includes('Visible assistant reply'),'DOM transcript content missing: '+domProof.part);
    assert(domProof.marker.includes(':2'),'DOM capture diagnostic marker missing: '+domProof.marker);
  }finally{await context.close();}
}finally{await browser.close();}

console.log('project-memory-wake-v086: PASS bootstrap preservation + queued backend archive + zero-RPC live DOM archive');
