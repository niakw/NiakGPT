(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_DOM_PROJECT_BOUNDARY_0912__)return;
  window.__NIAKGPT_DOM_PROJECT_BOUNDARY_0912__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const REQ='niakgpt:rpc-request';
  const RES='niakgpt:rpc-response';
  const DOM_RX=/^dom-p-/i;
  const NATIVE_RX=/^g-p-[a-z0-9_-]+$/i;
  const PROJECT_PATH=/^\/backend-api\/gizmos\/(dom-p-[^/]+)\/conversations(?:\?|$)/i;
  let sanitizing=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const metaLabel=v=>/^(?:\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|aujourd'hui|hier|today|yesterday)$/i.test(clean(v));
  const isDom=id=>DOM_RX.test(String(id||''));
  const isNative=id=>NATIVE_RX.test(String(id||''));

  function sanitize(raw){
    if(!raw||typeof raw!=='object')return raw;
    const sourceProjects=Array.isArray(raw.projects)?raw.projects:[];
    const sourceChats=Array.isArray(raw.chats)?raw.chats:[];
    const counts={...(raw.counts||{})};
    const removed=new Set();
    const nativeByName=new Map();
    const alias=new Map();

    for(const p of sourceProjects){
      if(isNative(p?.id)&&p?.name)nativeByName.set(norm(p.name),p.id);
    }
    for(const p of sourceProjects){
      if(!isDom(p?.id))continue;
      if(metaLabel(p?.name)){removed.add(p.id);continue;}
      const native=nativeByName.get(norm(p?.name));
      if(native){alias.set(p.id,native);removed.add(p.id);}
    }

    const chats=sourceChats.map(c=>{
      let projectId=String(c?.projectId||'');
      if(alias.has(projectId))projectId=alias.get(projectId);
      else if(removed.has(projectId))projectId='';
      return projectId===(c?.projectId||'')?c:{...c,projectId};
    });

    const referenced=new Set(chats.map(c=>c?.projectId).filter(Boolean));
    const projects=sourceProjects.filter(p=>{
      if(removed.has(p?.id))return false;
      if(isDom(p?.id)&&!referenced.has(p.id))return false;
      return true;
    });
    const validIds=new Set(projects.map(p=>p.id));

    for(const [domId,nativeId] of alias){
      if((counts[nativeId]==null||counts[nativeId]==='')&&counts[domId]!=null)counts[nativeId]=counts[domId];
      delete counts[domId];
    }
    for(const id of removed)delete counts[id];
    for(const id of Object.keys(counts))if(isDom(id)&&!validIds.has(id))delete counts[id];
    for(const p of projects){
      if(!isDom(p.id))continue;
      const visible=chats.reduce((n,c)=>n+(c.projectId===p.id?1:0),0);
      if(counts[p.id]==null)counts[p.id]=visible;
    }

    const indexedProjectIds=(Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]).filter(id=>isNative(id)&&validIds.has(id));
    return{...raw,projects,chats,counts,indexedProjectIds};
  }

  async function sanitizeStored(rawOverride){
    if(sanitizing)return;
    sanitizing=true;
    try{
      const raw=rawOverride!==undefined?rawOverride:(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
      if(!raw)return;
      const next=sanitize(raw);
      if(JSON.stringify(next)!==JSON.stringify(raw))await chrome.storage.local.set({[CACHE_KEY]:next});
      window.__NIAKGPT_DIAGNOSTICS__?.set('boundary','OK · DOM local ≠ API native');
    }catch(error){
      window.__NIAKGPT_DIAGNOSTICS__?.set('boundary',`ERREUR · ${String(error?.message||error).slice(0,70)}`);
    }finally{sanitizing=false;}
  }

  document.addEventListener(REQ,event=>{
    const detail=event.detail||{};
    const match=String(detail.path||'').match(PROJECT_PATH);
    if(!match)return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const projectId=match[1],id=String(detail.id||'');
    (async()=>{
      let raw={};try{raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{}
      const items=(raw.chats||[]).filter(c=>c?.projectId===projectId).map(c=>({id:c.id,title:c.title||'Conversation',gizmo_id:null,update_time:c.updated||0,create_time:c.updated||0}));
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:true,status:200,data:{items,cursor:null},error:'',transport:'dom-cache'}}));
    })();
  },true);

  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[CACHE_KEY]&&!sanitizing)sanitizeStored(changes[CACHE_KEY].newValue);
  });
  sanitizeStored();
})();
