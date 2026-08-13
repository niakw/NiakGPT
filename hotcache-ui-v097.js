(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_HOTCACHE_UI_097__) return;
  window.__NIAKGPT_HOTCACHE_UI_097__ = true;

  const META_KEY='niakgpt-hotmeta-v084';
  const DIRTY_KEY='niakgpt-hotdirty-v084';
  let started=false,metaTimer=0,diagTimer=0,pending=null,lastSignature='';

  const parseTime=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return value>1e12?value:value*1000;
    if(typeof value==='string'){
      const n=Number(value);if(Number.isFinite(n))return n>1e12?n:n*1000;
      const d=Date.parse(value);return Number.isFinite(d)?d:0;
    }
    return 0;
  };
  const currentChat=()=>location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';

  function publishMeta(raw){
    metaTimer=0;
    const source=raw&&typeof raw==='object'?raw:{};
    const meta={};let newest=0;
    const add=(chat,pid='')=>{
      if(!chat?.id)return;
      const updated=parseTime(chat.updated||chat.update_time||chat.create_time);if(!updated)return;
      const old=meta[chat.id];if(!old||updated>old.updated)meta[chat.id]={updated,projectId:chat.projectId||pid||''};
      newest=Math.max(newest,updated);
    };
    for(const chat of source.chats||[])add(chat);
    for(const [pid,list] of Object.entries(source.projectChats||{}))for(const chat of list||[])add(chat,pid);
    const signature=`${source.at||0}:${Object.keys(meta).length}:${newest}`;
    if(signature===lastSignature)return;lastSignature=signature;
    try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch{}
    document.documentElement.dataset.ng8Hotmeta=String(Object.keys(meta).length);
    document.dispatchEvent(new CustomEvent('niakgpt:hotmeta-updated'));
  }

  function scheduleMeta(raw){
    pending=raw&&typeof raw==='object'?raw:{};clearTimeout(metaTimer);
    const queue=()=>{
      const next=pending;pending=null;
      if('requestIdleCallback'in window){try{requestIdleCallback(()=>publishMeta(next),{timeout:1800});return;}catch{}}
      metaTimer=setTimeout(()=>publishMeta(next),180);
    };
    metaTimer=setTimeout(queue,220);
  }

  function markDirty(id=currentChat()){
    if(!id)return;
    try{const dirty=JSON.parse(localStorage.getItem(DIRTY_KEY)||'{}');dirty[id]=Date.now();localStorage.setItem(DIRTY_KEY,JSON.stringify(dirty));}catch{}
    document.dispatchEvent(new CustomEvent('niakgpt:hotcache-dirty',{detail:{id}}));
  }

  function updateDiagnostic(detail={}){
    clearTimeout(diagTimer);
    diagTimer=setTimeout(()=>{
      const root=document.documentElement;
      const mode=String(detail.mode||root.dataset.ng8Hotcache||'READY');
      const hits=Number(detail.hits??root.dataset.ng8HotcacheHits??0);
      const net=Number(detail.network??root.dataset.ng8HotcacheNetwork??0);
      const shared=Number(detail.deduped??root.dataset.ng8HotcacheDeduped??0);
      const entries=Number(detail.entries??root.dataset.ng8HotcacheEntries??0);
      const text=`${mode} · ${entries}/5 · ${hits} hit · ${net} net${shared?` · ${shared} partagé${shared>1?'s':''}`:''}`;
      window.__NIAKGPT_DIAGNOSTICS__?.set('hotcache',text);
    },20);
  }

  function start(){
    if(started)return;started=true;
    window.__NIAKGPT_CACHE_BUS__?.subscribe(raw=>scheduleMeta(raw));
    document.addEventListener('niakgpt:hotcache-status',event=>updateDiagnostic(event.detail||{}));
    document.addEventListener('niakgpt:activity-network',event=>{if(event.detail?.phase==='request')markDirty(String(event.detail?.chatId||currentChat()));});
    document.addEventListener('click',event=>{
      const button=event.target instanceof Element?event.target.closest('button'):null;if(!button)return;
      const label=`${button.getAttribute('aria-label')||''} ${button.getAttribute('data-testid')||''}`;
      if(/send|envoyer/i.test(label))markDirty();
    },true);
    document.addEventListener('keydown',event=>{
      const target=event.target instanceof Element?event.target:null;
      const composer=target&&(target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||target.isContentEditable);
      if(composer&&event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing)markDirty();
    },true);
    updateDiagnostic();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else queueMicrotask(start);
})();
