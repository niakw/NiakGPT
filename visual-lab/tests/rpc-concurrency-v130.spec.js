const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const BRIDGE=fs.readFileSync(path.join(ROOT,'page-bridge.js'),'utf8');

async function lab(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body><main>RPC lab</main></body></html>'}));
  await page.goto('https://chatgpt.com/rpc-concurrency-lab');
  await page.evaluate(()=>{
    window.__rpcLab={backendCalls:[],inFlight:0,maxInFlight:0,delayMs:80,seq:0};
    window.fetch=async(input,init={})=>{
      const raw=typeof input==='string'?input:input?.url||'';
      const url=new URL(raw,location.origin);
      if(url.pathname==='/api/auth/session')return new Response(JSON.stringify({accessToken:'rpc-lab-token'}),{status:200,headers:{'content-type':'application/json'}});
      if(url.pathname.startsWith('/backend-api/')){
        const s=window.__rpcLab;
        s.backendCalls.push({path:`${url.pathname}${url.search}`,method:String(init.method||'GET').toUpperCase(),at:performance.now()});
        s.inFlight++;s.maxInFlight=Math.max(s.maxInFlight,s.inFlight);
        await new Promise(resolve=>setTimeout(resolve,s.delayMs));
        s.inFlight--;
        return new Response(JSON.stringify({items:[],conversations:[],cursor:null,has_more:false,ok:true}),{status:200,headers:{'content-type':'application/json'}});
      }
      return new Response('',{status:204});
    };
    window.__labRpc=(path,{timeout=1400,method='GET',body=null,governance=false}={})=>new Promise(resolve=>{
      const id=`rpc-lab-${Date.now()}-${++window.__rpcLab.seq}`;
      let done=false;
      const finish=result=>{if(done)return;done=true;clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);resolve(result);};
      const handler=event=>{if(event.detail?.id===id)finish(event.detail);};
      const timer=setTimeout(()=>finish({ok:false,status:0,error:'caller_timeout',id}),timeout);
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance}}));
    });
  });
  await page.addScriptTag({content:BRIDGE});
  return{page,browser,close:()=>browser.close()};
}

test('issue #55: different concurrent RPCs are serialized by the bridge broker',async()=>{
  const rt=await lab();
  try{
    const out=await rt.page.evaluate(()=>Promise.all([
      window.__labRpc('/backend-api/conversations?offset=0&limit=100'),
      window.__labRpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0')
    ]));
    expect(out.every(x=>x.ok)).toBeTruthy();
    const state=await rt.page.evaluate(()=>({calls:window.__rpcLab.backendCalls,maxInFlight:window.__rpcLab.maxInFlight}));
    expect(state.calls).toHaveLength(2);
    expect(state.maxInFlight).toBe(1);
  }finally{await rt.close();}
});

test('issue #55: activity becoming busy during the rate-gap wait blocks the queued request',async()=>{
  const rt=await lab();
  try{
    await rt.page.evaluate(()=>{window.__rpcLab.delayMs=5;document.documentElement.dataset.ng86Activity='ready';});
    const prime=await rt.page.evaluate(()=>window.__labRpc('/backend-api/conversations?offset=0&limit=100'));
    expect(prime.ok).toBeTruthy();

    const blocked=await rt.page.evaluate(async()=>{
      const pending=window.__labRpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0');
      setTimeout(()=>{document.documentElement.dataset.ng86Activity='thinking';},35);
      return pending;
    });
    expect(blocked.ok).toBeFalsy();
    expect(blocked.error).toBe('native_busy');
    expect(blocked.transport).toBe('bridge-pause');
    const beforeRetry=await rt.page.evaluate(()=>window.__rpcLab.backendCalls.map(x=>x.path));
    expect(beforeRetry.filter(x=>x.startsWith('/backend-api/gizmos/snorlax/sidebar'))).toHaveLength(0);

    await rt.page.evaluate(()=>{document.documentElement.dataset.ng86Activity='ready';});
    const retry=await rt.page.evaluate(()=>window.__labRpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0'));
    expect(retry.ok).toBeFalsy();
    expect(retry.error).toBe('native_busy');
    const afterRetry=await rt.page.evaluate(()=>({
      calls:window.__rpcLab.backendCalls.map(x=>x.path),
      priorityUntil:Number(document.documentElement.dataset.ng100NativePriorityUntil||0),
      priorityReason:document.documentElement.dataset.ng100NativePriorityReason||''
    }));
    expect(afterRetry.calls.filter(x=>x.startsWith('/backend-api/gizmos/snorlax/sidebar'))).toHaveLength(0);
    expect(afterRetry.priorityUntil).toBeGreaterThan(Date.now());
    expect(afterRetry.priorityReason).toBe('post-native-idle');
  }finally{await rt.close();}
});

test('issue #55: a caller timeout followed by the same GET retry does not duplicate the backend request',async()=>{
  const rt=await lab();
  try{
    await rt.page.evaluate(()=>{window.__rpcLab.delayMs=220;document.documentElement.dataset.ng86Activity='ready';});
    const first=await rt.page.evaluate(()=>window.__labRpc('/backend-api/gizmos/g-p-demo123/conversations?limit=20',{timeout:55}));
    expect(first.ok).toBeFalsy();
    expect(first.error).toBe('caller_timeout');

    const retry=await rt.page.evaluate(()=>window.__labRpc('/backend-api/gizmos/g-p-demo123/conversations?limit=20',{timeout:1200}));
    expect(retry.ok).toBeTruthy();
    const calls=await rt.page.evaluate(()=>window.__rpcLab.backendCalls.filter(x=>x.path.startsWith('/backend-api/gizmos/g-p-demo123/conversations')));
    expect(calls).toHaveLength(1);
  }finally{await rt.close();}
});

test('issue #55: identical concurrent GETs share one in-flight bridge request',async()=>{
  const rt=await lab();
  try{
    await rt.page.evaluate(()=>{window.__rpcLab.delayMs=120;});
    const out=await rt.page.evaluate(()=>Promise.all([
      window.__labRpc('/backend-api/gizmos/g-p-demo123/conversations?limit=20'),
      window.__labRpc('/backend-api/gizmos/g-p-demo123/conversations?limit=20')
    ]));
    expect(out.every(x=>x.ok)).toBeTruthy();
    const calls=await rt.page.evaluate(()=>window.__rpcLab.backendCalls.filter(x=>x.path.startsWith('/backend-api/gizmos/g-p-demo123/conversations')));
    expect(calls).toHaveLength(1);
  }finally{await rt.close();}
});
