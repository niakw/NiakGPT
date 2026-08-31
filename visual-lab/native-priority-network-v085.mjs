import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const source=await fs.readFile(path.join(ROOT,'page-bridge.js'),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1000,height:700}});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.__backendCalls=0;window.__sessionCalls=0;window.__xhrCalls=0;
    const NativeXHR=window.XMLHttpRequest;
    window.XMLHttpRequest=class extends NativeXHR{constructor(){super();window.__xhrCalls++;}};
    window.fetch=(input,init={})=>{
      const url=String(typeof input==='string'?input:input?.url||'');
      if(url.includes('/api/auth/session')){
        window.__sessionCalls++;
        return Promise.resolve(new Response(JSON.stringify({accessToken:'test-token'}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      if(url.includes('/backend-api/conversation/')){
        window.__backendCalls++;
        return new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>resolve(new Response(JSON.stringify({title:'Synthetic',mapping:{}}),{status:200,headers:{'Content-Type':'application/json'}})),5000);
          const signal=init?.signal;
          if(signal){
            const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
            if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
          }
        });
      }
      return Promise.resolve(new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
    };
  });
  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html><body><main><form id="composer"><textarea id="prompt-textarea"></textarea><button id="send" type="button" aria-label="Envoyer">Envoyer</button></form></main></body></html>'
  }));
  await page.goto('https://chatgpt.com/c/native-priority',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:source});

  // 0.9.87 first prevents the old failure mode entirely: a background conversation GET on
  // /c/... must be rejected before auth/backend network even starts.
  const chatBackground=await page.evaluate(()=>new Promise(resolve=>{
    const id='network-v085-chat-background';
    const handler=event=>{if(event.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',handler);resolve(event.detail);};
    document.addEventListener('niakgpt:rpc-response',handler);
    document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversation/abcdefghijklmnop',method:'GET',memoryBootstrap:true,governance:true}}));
  }));
  let state=await page.evaluate(()=>({backend:window.__backendCalls,session:window.__sessionCalls,xhr:window.__xhrCalls}));
  assert(chatBackground.error==='native_conversation_quiet','chat-route background GET was not prevented before network: '+JSON.stringify(chatBackground));
  assert(state.backend===0&&state.session===0&&state.xhr===0,'chat-route prevention still emitted network traffic: '+JSON.stringify(state));

  // Preserve the original v085 contract too: when an allowed request is already in flight off
  // a conversation route, a native send must abort it immediately and must never retry via XHR.
  await page.evaluate(()=>history.pushState({},'', '/'));
  const first=page.evaluate(()=>new Promise(resolve=>{
    const id='network-v085-first';
    const handler=event=>{if(event.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',handler);resolve(event.detail);};
    document.addEventListener('niakgpt:rpc-response',handler);
    document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversation/abcdefghijklmnop',method:'GET',memoryBootstrap:true,governance:true}}));
  }));
  await page.waitForFunction(()=>window.__backendCalls===1);
  await page.getByRole('button',{name:'Envoyer'}).click();
  const firstResult=await first;
  const afterAbort=await page.evaluate(()=>({backend:window.__backendCalls,xhr:window.__xhrCalls,until:Number(document.documentElement.dataset.ng100NativePriorityUntil||0),reason:document.documentElement.dataset.ng100NativePriorityReason||''}));
  assert(firstResult.status===0&&/fetch_aborted_native_priority/.test(String(firstResult.error||'')),'in-flight NiakGPT GET was not aborted by native send: '+JSON.stringify(firstResult));
  assert(afterAbort.backend===1,'native send duplicated the NiakGPT backend request');
  assert(afterAbort.xhr===0,'network failure triggered an XHR fallback');
  assert(afterAbort.until>Date.now(),'native priority quarantine was not armed');
  assert(/user-send/.test(afterAbort.reason),'native priority reason missing: '+JSON.stringify(afterAbort));

  const second=await page.evaluate(()=>new Promise(resolve=>{
    const id='network-v085-second';
    const handler=event=>{if(event.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',handler);resolve(event.detail);};
    document.addEventListener('niakgpt:rpc-response',handler);
    document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversation/qrstuvwxyzabcdef',method:'GET',memoryBootstrap:true,governance:true}}));
  }));
  const finalState=await page.evaluate(()=>({backend:window.__backendCalls,xhr:window.__xhrCalls}));
  assert(second.error==='native_busy','second NiakGPT request was not blocked during native priority: '+JSON.stringify(second));
  assert(finalState.backend===1&&finalState.xhr===0,'native priority still emitted background traffic: '+JSON.stringify(finalState));
}finally{await browser.close();}
console.log('native-priority-network-v085: PASS chat-route prevention + native send abort + no XHR duplicate + quarantine blocks new traffic');
