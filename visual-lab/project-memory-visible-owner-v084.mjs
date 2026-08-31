import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
let source=await fs.readFile(path.join(ROOT,'project-memory-v132.js'),'utf8');
// Keep the production five-minute quiet policy intact; only compress time inside this focused
// ownership lab so it can still prove hidden-tab lock exclusion + visible-tab queue consumption.
source=source.replace('const HUMAN_QUIET_MS = 5*60*1000;','const HUMAN_QUIET_MS = 180;').replace('const WAKE_HEARTBEAT_MS = 60000;','const WAKE_HEARTBEAT_MS = 120;');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1000,height:760}});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      window.__ng084Hidden=true;window.__ng084LockCalls=0;window.__ng084CommitCalls=0;
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__ng084Hidden});
      Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,fn)=>{window.__ng084LockCalls++;return fn({name:'memory'});}}});
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
      window.__localData=data;
      const listeners=[];
      const clone=v=>v===undefined?undefined:structuredClone(v);
      window.chrome={
        runtime:{
          lastError:null,
          sendMessage(message,cb){
            if(message.type==='niakgpt:memory-status-v132')return cb({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private-vault',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(message.type==='niakgpt:memory-read-v132')return cb({ok:false,error:'github_http_404:not_found'});
            if(message.type==='niakgpt:memory-commit-v132'){window.__ng084CommitCalls++;return cb({ok:true,sha:'synthetic-'+window.__ng084CommitCalls});}
            cb({ok:false,error:'unexpected:'+message.type});
          }
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return clone(data);
              const list=Array.isArray(keys)?keys:[keys],out={};
              for(const key of list)if(data[key]!==undefined)out[key]=clone(data[key]);
              return out;
            },
            async set(obj){
              const changes={};
              for(const [key,value] of Object.entries(obj)){changes[key]={oldValue:clone(data[key]),newValue:clone(value)};data[key]=clone(value);}
              for(const fn of listeners)fn(changes,'local');
            },
            async remove(keys){
              const changes={};
              for(const key of (Array.isArray(keys)?keys:[keys])){if(data[key]!==undefined){changes[key]={oldValue:clone(data[key]),newValue:undefined};delete data[key];}}
              if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local');
            }
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><main>Hidden worker handoff lab</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.documentElement.dataset.ng8TabRole='worker';
      document.addEventListener('niakgpt:rpc-request',event=>{
        const id=event.detail?.id;if(!id)return;
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{
          id,ok:true,status:200,data:{
            title:'First chat',update_time:Date.now()/1000,current_node:'n1',
            mapping:{n1:{parent:null,message:{author:{role:'user'},create_time:Date.now()/1000,content:{parts:['Hello from the synthetic Project Memory lab.']}}}}
          }
        }})),5);
      });
    });
    await page.addScriptTag({content:source});
    await page.waitForTimeout(260);
    let state=await page.evaluate(()=>({locks:window.__ng084LockCalls,commits:window.__ng084CommitCalls}));
    assert(state.locks===0&&state.commits===0,'hidden tab acquired the Project Memory lock before becoming runnable: '+JSON.stringify(state));

    await page.evaluate(()=>{window.__ng084Hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>window.__ng084CommitCalls>=2,null,{timeout:7000});
    state=await page.evaluate(()=>({
      locks:window.__ng084LockCalls,commits:window.__ng084CommitCalls,
      memoryState:window.__localData
    }));
    assert(state.locks>=1&&state.commits>=2,'visible tab did not consume the persistent Project Memory queue: '+JSON.stringify(state));
  }finally{await context.close();}
}finally{await browser.close();}
console.log('project-memory-visible-owner-v084: PASS hidden tabs do not own the lock + visible tab consumes queue after the production-safe quiet gate');
