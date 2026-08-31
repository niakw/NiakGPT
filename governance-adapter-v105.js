(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_GOV_ADAPTER_105__) return;
  window.__NIAKGPT_GOV_ADAPTER_105__ = true;

  const REQ='niakgpt:rpc-request',RES='niakgpt:rpc-response';
  const CONV_RX=/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i;
  const PROJECT_RX=/^g-p-[A-Za-z0-9]+$/;
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-quick,#ng85-governance,#ng90-control,#ng100-command,#ng100-onboarding,#ng8-coach';
  const confirmed=new Map(),manualExpected=new Map(),pendingPatch=new Map();
  let seq=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const conversationQuiet=()=>/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/.test(String(location.pathname||''))||document.documentElement.dataset.ng90PeerChatActive==='1';
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const currentChatId=()=>location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const normalizePid=v=>{const s=String(v||'').trim();return PROJECT_RX.test(s)?s:'';};
  const listFrom=data=>Array.isArray(data)?data:Array.isArray(data?.items)?data.items:Array.isArray(data?.conversations)?data.conversations:[];
  const projectFrom=item=>normalizePid(item?.gizmo_id||item?.project_id||item?.projectId||item?.conversation_mode?.gizmo_id||item?.conversation_mode?.project_id||'');
  const fresh=(rec,ms=15000)=>rec&&Date.now()-rec.at<ms?rec:null;

  function rpc(path,{timeout=8000}={}){
    const id=`ng105-adapter-${Date.now()}-${++seq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'adapter_rpc_timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener(RES,handler);};
      document.addEventListener(RES,handler);
      // This lookup confirms an explicit user Project-menu action. Treat it as foreground UI
      // traffic so post-native background quarantine does not suppress it; page-bridge still
      // blocks foreground calls while ChatGPT is actively generating/verifying/offline.
      document.dispatchEvent(new CustomEvent(REQ,{detail:{id,path,method:'GET',foreground:true,governanceInventory:true}}));
    });
  }

  async function localConversation(chatId){
    let raw=null;
    try{raw=window.__NIAKGPT_CACHE_BUS__?.peek?.()||await window.__NIAKGPT_CACHE_BUS__?.get?.();}catch{}
    if(!raw)try{raw=(await chrome.storage.local.get('niakgpt-v08-cache'))['niakgpt-v08-cache'];}catch{}
    const all=new Map();
    for(const item of (raw?.chats||[]))if(item?.id)all.set(String(item.id),item);
    for(const [pid,list] of Object.entries(raw?.projectChats||{}))for(const item of (list||[]))if(item?.id){const old=all.get(String(item.id))||{};all.set(String(item.id),{...old,...item,projectId:item.projectId||old.projectId||pid});}
    return all.get(String(chatId))||null;
  }

  async function lookupGeneral(chatId){
    if(conversationQuiet()){
      const item=await localConversation(chatId);
      return item?{ok:true,projectId:normalizePid(item.projectId||''),item,transport:'governance-local-cache'}:{ok:false,error:'conversation_not_in_local_cache'};
    }
    const r=await rpc('/backend-api/conversations?offset=0&limit=100');
    if(!r.ok)return{ok:false,error:r.error||`HTTP ${r.status||0}`};
    const item=listFrom(r.data).find(x=>String(x?.id||x?.conversation_id||'')===chatId);
    if(!item)return{ok:false,error:'conversation_not_in_light_inventory'};
    return{ok:true,projectId:projectFrom(item),item};
  }

  async function lookupProject(chatId,projectId){
    const pid=normalizePid(projectId);if(!pid)return lookupGeneral(chatId);
    if(conversationQuiet()){
      const item=await localConversation(chatId),got=normalizePid(item?.projectId||'');
      return item&&got===pid?{ok:true,projectId:pid,item,transport:'governance-local-cache'}:{ok:false,error:'conversation_not_in_expected_project_cache'};
    }
    const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(pid)}/conversations?limit=20`);
    if(!r.ok)return{ok:false,error:r.error||`HTTP ${r.status||0}`};
    const found=listFrom(r.data).some(x=>String(x?.id||x?.conversation_id||'')===chatId);
    return found?{ok:true,projectId:pid}:{ok:false,error:'conversation_not_in_expected_project'};
  }

  async function synthesizeDetail(id,chatId){
    const patch=fresh(confirmed.get(chatId));
    if(patch){
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:true,status:200,data:{id:chatId,gizmo_id:patch.projectId||null},transport:'governance-patch-ack'}}));
      return;
    }
    const manual=fresh(manualExpected.get(chatId));
    let lookup;
    if(manual&&!manual.detached&&manual.projectId)lookup=await lookupProject(chatId,manual.projectId);
    else lookup=await lookupGeneral(chatId);
    if(lookup.ok){
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:true,status:200,data:{id:chatId,gizmo_id:lookup.projectId||null},transport:lookup.transport||'governance-light-inventory'}}));
    }else{
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:false,status:0,data:null,error:lookup.error||'governance_light_verify_failed',transport:'governance-light-inventory'}}));
    }
  }

  document.addEventListener(REQ,event=>{
    const d=event.detail||{},method=String(d.method||'GET').toUpperCase(),path=String(d.path||''),m=path.match(CONV_RX);
    if(!m||d.governance!==true)return;
    const chatId=m[1];
    if(method==='PATCH'&&d.body&&Object.prototype.hasOwnProperty.call(d.body,'gizmo_id')){
      pendingPatch.set(String(d.id||''),{chatId,projectId:normalizePid(d.body.gizmo_id||''),at:Date.now()});
      return;
    }
    if(method!=='GET')return;
    // Capture runs before the bridge target/bubble listener, so governance's legacy
    // detail verification never reaches the forbidden heavy conversation endpoint.
    event.stopImmediatePropagation();
    synthesizeDetail(String(d.id||''),chatId).catch(error=>{
      document.dispatchEvent(new CustomEvent(RES,{detail:{id:String(d.id||''),ok:false,status:0,error:`governance_adapter:${String(error?.message||error)}`,transport:'governance-light-inventory'}}));
    });
  },true);

  document.addEventListener(RES,event=>{
    const id=String(event.detail?.id||''),pending=pendingPatch.get(id);if(!pending)return;
    pendingPatch.delete(id);
    if(event.detail?.ok)confirmed.set(pending.chatId,{projectId:pending.projectId,at:Date.now()});
  });

  function cacheProjects(){
    const cache=window.__NIAKGPT_CACHE_BUS__?.peek?.();
    return Array.isArray(cache?.projects)?cache.projects:[];
  }
  function projectTarget(target){
    const el=target instanceof Element?target.closest('button,[role="menuitem"],[role="option"],a,[data-value]'):null;
    if(!el||el.closest(OWN)||el.closest('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav'))return null;
    const href=el.getAttribute('href')||'';
    if(/\/g\/g-p-[^/]+\/(?:project|c\/)/i.test(href))return null;
    const text=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));
    const detached=/^(retirer du projet|remove from project|aucun projet|no project)$/i.test(text);
    if(detached)return{projectId:'',detached:true,el};
    const exact=cacheProjects().find(p=>norm(p?.name)===norm(text)&&normalizePid(p?.id));
    if(!exact)return null;
    let host=el;
    let context='';
    for(let i=0;i<6&&host;i++,host=host.parentElement){
      context+=` ${host.getAttribute?.('aria-label')||''} ${host.getAttribute?.('data-testid')||''}`;
      if(host.matches?.('[role="menu"],[role="listbox"],[role="dialog"],[data-radix-popper-content-wrapper]'))context+=' move project';
    }
    if(!/move|déplac|deplac|project|projet|gizmo/i.test(context))return null;
    return{projectId:normalizePid(exact.id),detached:false,el};
  }

  document.addEventListener('click',event=>{
    if(!event.isTrusted)return;
    const chatId=currentChatId();if(!chatId)return;
    const target=projectTarget(event.target);if(!target)return;
    const record={projectId:target.projectId,detached:target.detached,at:Date.now()};
    manualExpected.set(chatId,record);
    setTimeout(()=>{
      if(!fresh(manualExpected.get(chatId),3000))return;
      document.dispatchEvent(new CustomEvent('niakgpt:manual-project-move',{detail:{id:chatId,projectId:record.projectId,detached:record.detached,source:'trusted-project-menu',at:Date.now()}}));
    },420);
  },true);

  const prune=()=>{
    const cutoff=Date.now()-20000;
    for(const map of [confirmed,manualExpected])for(const[k,v]of map)if((v?.at||0)<cutoff)map.delete(k);
    for(const[k,v]of pendingPatch)if((v?.at||0)<cutoff)pendingPatch.delete(k);
  };
  document.addEventListener('niakgpt:activity-changed',prune);
})();
