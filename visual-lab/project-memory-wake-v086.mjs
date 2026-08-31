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
      window.__wakeLockCalls=0;window.__wakeCommitCalls=0;
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
            if(message.type==='niakgpt:memory-read-v132')return cb({ok:false,error:'github_http_404:not_found'});
            if(message.type==='niakgpt:memory-commit-v132'){window.__wakeCommitCalls++;return cb({ok:true,sha:'wake-'+window.__wakeCommitCalls});}
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
    let snapshot=await page.evaluate(()=>({locks:window.__wakeLockCalls,commits:window.__wakeCommitCalls,state:window.__wakeLocal['niakgpt-project-memory-state-v132']||{}}));
    assert(snapshot.commits===0,'busy bootstrap wrote before native ChatGPT became idle: '+JSON.stringify(snapshot));

    // Clear native busy with NO activity/visibility/storage event. The shortened lab-only quiet
    // window + heartbeat must recover the persistent queue without restoring production aggressiveness.
    await page.evaluate(()=>{document.documentElement.dataset.ng8Running='0';});
    await page.waitForFunction(()=>window.__wakeCommitCalls>=2,null,{timeout:5000});

    snapshot=await page.evaluate(()=>({
      locks:window.__wakeLockCalls,
      commits:window.__wakeCommitCalls,
      queue:window.__wakeLocal['niakgpt-project-memory-queue-v132'],
      state:window.__wakeLocal['niakgpt-project-memory-state-v132']||{},
      wakeBeat:document.documentElement.dataset.ng132WakeBeat||''
    }));
    assert(snapshot.locks>=2,'lock-unavailable attempt was not retried by heartbeat: '+JSON.stringify(snapshot));
    assert(snapshot.commits>=2,'persistent Project Memory queue did not self-wake: '+JSON.stringify(snapshot));
    assert(!snapshot.queue?.pending?.length,'persistent queue was not consumed after heartbeat recovery: '+JSON.stringify(snapshot));
    assert(snapshot.state.mode==='idle','Project Memory did not reach idle after heartbeat recovery: '+JSON.stringify(snapshot));
    assert(!!snapshot.wakeBeat,'heartbeat diagnostic marker was never published: '+JSON.stringify(snapshot));
  }finally{await context.close();}
}finally{await browser.close();}

console.log('project-memory-wake-v086: PASS queued bootstrap self-wakes after lost busy/lock races using production-safe quiet semantics');
