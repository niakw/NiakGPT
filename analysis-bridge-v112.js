(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_ANALYSIS_BRIDGE_112__)return;
  window.__NIAKGPT_ANALYSIS_BRIDGE_112__=true;

  const REQ='niakgpt:analysis-request-v112',RES='niakgpt:analysis-response-v112',RPC_REQ='niakgpt:rpc-request',RPC_RES='niakgpt:rpc-response';
  const CONV=/^\/backend-api\/conversation\/([A-Za-z0-9_-]{16,})$/;
  const CACHE_TTL=10*60*1000,MAX_CACHE=12,MIN_GAP=5000,MAX_MESSAGES=10,MAX_TEXT=14000;
  const cache=new Map();let lastNetworkAt=0,chain=Promise.resolve(),rpcSeq=0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const conversationQuiet=()=>/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/.test(String(location.pathname||''))||document.documentElement.dataset.ng90PeerChatActive==='1';
  const busy=()=>conversationQuiet()||document.hidden||document.documentElement.dataset.ng90Safe==='1'||document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(String(document.documentElement.dataset.ng86Activity||'').toLowerCase())||document.documentElement.dataset.ng105Verification==='1'||['verify','network'].includes(String(document.documentElement.dataset.ng119Interruption||'').toLowerCase())||Number(document.documentElement.dataset.ng100RateLimitedUntil||0)>Date.now()||Number(document.documentElement.dataset.ng100NativePriorityUntil||0)>Date.now()||Number(document.documentElement.dataset.ng100BackgroundPriorityUntil||0)>Date.now();
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
  function rpc(path){
    const id='ng112-analysis-rpc-'+Date.now()+'-'+(++rpcSeq);
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{off();resolve({ok:false,status:0,error:'analysis_rpc_timeout',transport:'analysis-rpc'});},45000);
      const handler=event=>{if(event.detail?.id!==id)return;off();resolve(event.detail);};
      const off=()=>{clearTimeout(timer);document.removeEventListener(RPC_RES,handler);};
      document.addEventListener(RPC_RES,handler);
      document.dispatchEvent(new CustomEvent(RPC_REQ,{detail:{id,path,method:'GET',analysis:true}}));
    });
  }
  async function fetchOne(path,id){
    const cached=cache.get(id);if(cached&&Date.now()-cached.at<CACHE_TTL)return{ok:true,status:200,data:cached.data,transport:'analysis-cache'};
    if(busy())return{ok:false,status:0,error:'analysis_paused_busy',transport:'analysis-guard'};
    const gap=Math.max(0,lastNetworkAt+MIN_GAP-Date.now());if(gap)await sleep(gap);if(busy())return{ok:false,status:0,error:'analysis_paused_busy',transport:'analysis-guard'};
    lastNetworkAt=Date.now();
    const r=await rpc(path);
    if(!r?.ok)return{ok:false,status:Number(r?.status||0),error:String(r?.error||'analysis_rpc_failed'),transport:String(r?.transport||'analysis-rpc')};
    const data=compact(r.data,id);cache.set(id,{at:Date.now(),data});
    if(cache.size>MAX_CACHE){const old=[...cache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,cache.size-MAX_CACHE);for(const[k]of old)cache.delete(k);}
    return{ok:true,status:200,data,transport:'analysis-rpc'};
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