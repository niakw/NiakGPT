(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_ANALYSIS_BRIDGE_112__)return;
  window.__NIAKGPT_ANALYSIS_BRIDGE_112__=true;

  const REQ='niakgpt:analysis-request-v112',RES='niakgpt:analysis-response-v112';
  const CONV=/^\/backend-api\/conversation\/([A-Za-z0-9_-]{16,})$/;
  const CACHE_TTL=10*60*1000,MAX_CACHE=12,MIN_GAP=1800,MAX_MESSAGES=10,MAX_TEXT=14000;
  const cache=new Map();let token='',tokenAt=0,lastNetworkAt=0,chain=Promise.resolve();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const busy=()=>document.hidden||document.documentElement.dataset.ng90Safe==='1'||document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')||Number(document.documentElement.dataset.ng100RateLimitedUntil||0)>Date.now();
  function textOf(message){
    const content=message?.content;const parts=Array.isArray(content?.parts)?content.parts:[];const out=[];
    for(const part of parts){if(typeof part==='string')out.push(part);else if(part&&typeof part==='object'){if(typeof part.text==='string')out.push(part.text);else if(typeof part.content==='string')out.push(part.content);}}
    return clean(out.join('\n'));
  }
  function orderedMessages(data){
    const mapping=data?.mapping;if(!mapping||typeof mapping!=='object')return[];
    const chain=[];let id=String(data?.current_node||''),guard=0;
    while(id&&mapping[id]&&guard++<5000){const node=mapping[id],m=node?.message;if(m)chain.push(m);id=String(node?.parent||'');}
    let list=chain.length?chain.reverse():Object.values(mapping).map(n=>n?.message).filter(Boolean).sort((a,b)=>Number(a?.create_time||0)-Number(b?.create_time||0));
    const out=[];let chars=0;
    for(const m of list){const role=String(m?.author?.role||'');if(role!=='user'&&role!=='assistant')continue;const text=textOf(m);if(!text)continue;const room=Math.max(0,MAX_TEXT-chars);if(!room)break;const clipped=text.slice(0,Math.min(3200,room));out.push({role,text:clipped});chars+=clipped.length;if(out.length>=MAX_MESSAGES)break;}
    return out;
  }
  function compact(data,id){return{id,title:clean(data?.title||''),projectId:clean(data?.gizmo_id||data?.conversation_mode?.gizmo_id||''),messages:orderedMessages(data)};}
  async function accessToken(){
    if(token&&Date.now()-tokenAt<120000)return token;
    try{const r=await fetch('/api/auth/session',{credentials:'include',headers:{Accept:'application/json'}});if(!r.ok)return'';const j=await r.json();token=String(j?.accessToken||'');tokenAt=Date.now();return token;}catch{return'';}
  }
  async function fetchOne(path,id){
    const cached=cache.get(id);if(cached&&Date.now()-cached.at<CACHE_TTL)return{ok:true,status:200,data:cached.data,transport:'analysis-cache'};
    if(busy())return{ok:false,status:0,error:'analysis_paused_busy',transport:'analysis-guard'};
    const gap=Math.max(0,lastNetworkAt+MIN_GAP-Date.now());if(gap)await sleep(gap);if(busy())return{ok:false,status:0,error:'analysis_paused_busy',transport:'analysis-guard'};
    const auth=await accessToken();if(!auth)return{ok:false,status:401,error:'analysis_auth_missing',transport:'analysis-auth'};
    lastNetworkAt=Date.now();
    try{
      const r=await fetch(path,{method:'GET',credentials:'include',headers:{Accept:'application/json','OAI-Language':document.documentElement.lang||'fr-FR',Authorization:`Bearer ${auth}`}});
      if(r.status===401){token='';tokenAt=0;}if(!r.ok)return{ok:false,status:r.status,error:`analysis_http_${r.status}`,transport:'analysis-fetch'};
      const raw=await r.json(),data=compact(raw,id);cache.set(id,{at:Date.now(),data});
      if(cache.size>MAX_CACHE){const old=[...cache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,cache.size-MAX_CACHE);for(const[k]of old)cache.delete(k);}
      return{ok:true,status:200,data,transport:'analysis-fetch'};
    }catch(error){return{ok:false,status:0,error:`analysis_network:${String(error?.message||error).slice(0,120)}`,transport:'analysis-fetch'};}
  }
  document.addEventListener(REQ,event=>{
    const d=event.detail||{},requestId=String(d.id||''),path=String(d.path||''),match=path.match(CONV);
    if(!requestId||!match||d.purpose!=='classification')return;
    event.stopImmediatePropagation();
    const chatId=match[1];
    const run=()=>fetchOne(path,chatId).then(result=>document.dispatchEvent(new CustomEvent(RES,{detail:{id:requestId,...result}})));
    chain=chain.then(run,run).catch(()=>{});
  },true);
})();