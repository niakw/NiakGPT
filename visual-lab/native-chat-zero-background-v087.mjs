import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const bridgeSource=await fs.readFile(path.join(ROOT,'page-bridge.js'),'utf8');
const indexSource=await fs.readFile(path.join(ROOT,'server-index-v100.js'),'utf8');
const bootstrapSource=await fs.readFile(path.join(ROOT,'server-index-bootstrap-v124.js'),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1000,height:700}});
  const page=await context.newPage();

  await page.addInitScript(()=>{
    const store={
      'niakgpt-v08-cache':{schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[]}
    };
    window.__startupRpc=[];
    window.__sessionCalls=0;
    window.__backendCalls=0;
    window.chrome={
      storage:{
        local:{
          async get(keys){
            if(typeof keys==='string')return{[keys]:store[keys]};
            if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));
            if(keys&&typeof keys==='object')return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]??v]));
            return{...store};
          },
          async set(values){Object.assign(store,values||{});},
          async remove(keys){for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}
        },
        onChanged:{addListener(){}}
      },
      runtime:{getManifest:()=>({version:'0.9.88'})}
    };
    window.addEventListener('niakgpt:rpc-request',event=>{
      window.__startupRpc.push({
        path:String(event.detail?.path||''),
        foreground:event.detail?.foreground===true,
        memoryBootstrap:event.detail?.memoryBootstrap===true,
        analysis:event.detail?.analysis===true
      });
    });
    window.fetch=(input,init={})=>{
      const url=String(typeof input==='string'?input:input?.url||'');
      if(url.includes('/api/auth/session')){
        window.__sessionCalls++;
        return Promise.resolve(new Response(JSON.stringify({accessToken:'test-token'}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      if(url.includes('/backend-api/')){
        window.__backendCalls++;
        return Promise.resolve(new Response(JSON.stringify({items:[],projects:[],conversations:[],cursor:null}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      return Promise.resolve(new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
    };
  });

  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,
    contentType:'text/html; charset=utf-8',
    body:'<!doctype html><html><body><main><form><textarea id="prompt-textarea"></textarea><button aria-label="Envoyer">Envoyer</button></form></main></body></html>'
  }));
  await page.goto('https://chatgpt.com/c/abcdefghijklmnop',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:bridgeSource});
  await page.addScriptTag({content:indexSource});
  await page.addScriptTag({content:bootstrapSource});

  // Exact field regression: 0.9.86 started server-index ~80 ms after runtime injection.
  // A conversation page must stay completely silent without any user request.
  await page.waitForTimeout(1200);
  let snapshot=await page.evaluate(()=>({
    rpc:window.__startupRpc.slice(),
    session:window.__sessionCalls,
    backend:window.__backendCalls
  }));
  assert(snapshot.rpc.length===0,'automatic runtime emitted RPC on chat startup: '+JSON.stringify(snapshot));
  assert(snapshot.session===0&&snapshot.backend===0,'automatic runtime touched ChatGPT backend on chat startup: '+JSON.stringify(snapshot));

  const rpc=detail=>page.evaluate(d=>new Promise(resolve=>{
    const id='v087-'+Math.random().toString(36).slice(2);
    const handler=event=>{
      if(event.detail?.id!==id)return;
      document.removeEventListener('niakgpt:rpc-response',handler);
      resolve(event.detail);
    };
    document.addEventListener('niakgpt:rpc-response',handler);
    document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,...d}}));
  }),detail);

  const backgroundRequests=[
    {path:'/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0',method:'GET'},
    {path:'/backend-api/conversations?offset=0&limit=100&order=updated',method:'GET'},
    {path:'/backend-api/conversation/abcdefghijklmnop',method:'GET',memoryBootstrap:true,governance:true},
    {path:'/backend-api/conversation/abcdefghijklmnop',method:'GET',analysis:true}
  ];
  for(const request of backgroundRequests){
    const result=await rpc(request);
    assert(result.error==='native_conversation_quiet','background GET escaped chat-route quarantine: '+JSON.stringify({request,result}));
    assert(result.transport==='chat-route-guard','wrong chat-route guard transport: '+JSON.stringify(result));
  }
  const foregroundOnChat=await rpc({
    path:'/backend-api/gizmos/g-p-abcdefghijklmnop/conversations?limit=20',
    method:'GET',
    foreground:true
  });
  assert(foregroundOnChat.error==='native_conversation_quiet'&&foregroundOnChat.transport==='chat-route-guard','foreground GET escaped absolute conversation quarantine: '+JSON.stringify(foregroundOnChat));
  const mutationOnChat=await rpc({
    path:'/backend-api/conversation/abcdefghijklmnop',
    method:'PATCH',
    body:{gizmo_id:'g-p-abcdefghijklmnop'},
    governance:true
  });
  assert(mutationOnChat.error==='native_conversation_quiet','NiakGPT mutation escaped absolute conversation quarantine: '+JSON.stringify(mutationOnChat));
  snapshot=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
  assert(snapshot.session===0&&snapshot.backend===0,'blocked chat-route requests still reached network: '+JSON.stringify(snapshot));

  // Cross-tab safety: even from a non-chat route, a visible peer conversation blocks all NiakGPT backend work, including foreground.
  await page.evaluate(()=>{
    history.pushState({},'', '/');
    document.documentElement.dataset.ng90PeerChatActive='1';
  });
  const peerBlocked=await rpc({path:'/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0',method:'GET',foreground:true});
  assert(peerBlocked.error==='native_conversation_quiet','peer chat did not quarantine background GET: '+JSON.stringify(peerBlocked));
  snapshot=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
  assert(snapshot.session===0&&snapshot.backend===0,'peer-quarantined request reached network: '+JSON.stringify(snapshot));

  // Explicit user foreground hydration remains possible only off-chat, when no visible peer conversation exists.
  await page.evaluate(()=>{delete document.documentElement.dataset.ng90PeerChatActive;});
  const foreground=await rpc({
    path:'/backend-api/gizmos/g-p-abcdefghijklmnop/conversations?limit=20',
    method:'GET',
    foreground:true
  });
  assert(foreground.ok===true,'explicit foreground Project read was incorrectly blocked: '+JSON.stringify(foreground));
  snapshot=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
  assert(snapshot.session===1&&snapshot.backend===1,'foreground read did not use exactly one auth + one backend request: '+JSON.stringify(snapshot));

  // A foreground request must still yield instantly to an active native generation.
  await page.evaluate(()=>{document.documentElement.dataset.ng8Running='1';});
  const blockedForeground=await rpc({
    path:'/backend-api/gizmos/g-p-abcdefghijklmnop/conversations?limit=20&cursor=next',
    method:'GET',
    foreground:true
  });
  assert(blockedForeground.error==='native_busy','native generation did not block foreground extension GET: '+JSON.stringify(blockedForeground));
  const finalState=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
  assert(finalState.session===1&&finalState.backend===1,'native-busy foreground request still reached network: '+JSON.stringify(finalState));
}finally{
  await browser.close();
}

console.log('native-chat-zero-background-v087: PASS absolute current/peer conversation quarantine + off-chat foreground-only exception');
