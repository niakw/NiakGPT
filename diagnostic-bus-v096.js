(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_DIAGNOSTICS__) return;

  // Disable the legacy isolated hotcache UI before it executes later in the same world.
  // The MAIN-world network/IndexedDB cache remains active; only its UI bridge is replaced.
  window.__NIAKGPT_HOTCACHE_084__=true;

  const META_KEY='niakgpt-hotmeta-v084';
  const values=new Map();
  let metaTimer=0,lastMetaSignature='';
  const api={
    set(key,text){
      key=String(key||'').trim().toLowerCase();text=String(text||'').trim();if(!key)return;
      if(values.get(key)===text)return;values.set(key,text);
      document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text}}));
    },
    delete(key){key=String(key||'').trim().toLowerCase();if(values.delete(key))document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text:''}}));},
    snapshot(){return Object.fromEntries(values);}
  };
  window.__NIAKGPT_DIAGNOSTICS__=api;

  const parseTime=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return value>1e12?value:value*1000;
    if(typeof value==='string'){
      const n=Number(value);if(Number.isFinite(n))return n>1e12?n:n*1000;
      const d=Date.parse(value);return Number.isFinite(d)?d:0;
    }
    return 0;
  };

  function publishMeta(raw){
    metaTimer=0;const source=raw&&typeof raw==='object'?raw:{};const meta={};let newest=0;
    const add=(chat,pid='')=>{
      if(!chat?.id)return;const updated=parseTime(chat.updated||chat.update_time||chat.create_time);if(!updated)return;
      const old=meta[chat.id];if(!old||updated>old.updated)meta[chat.id]={updated,projectId:chat.projectId||pid||''};newest=Math.max(newest,updated);
    };
    for(const chat of source.chats||[])add(chat);
    for(const [pid,list] of Object.entries(source.projectChats||{}))for(const chat of list||[])add(chat,pid);
    const signature=`${source.at||0}:${Object.keys(meta).length}:${newest}`;if(signature===lastMetaSignature)return;lastMetaSignature=signature;
    try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch{}
    document.documentElement.dataset.ng8Hotmeta=String(Object.keys(meta).length);
    document.dispatchEvent(new CustomEvent('niakgpt:hotmeta-updated'));
  }
  function scheduleMeta(raw){
    clearTimeout(metaTimer);metaTimer=setTimeout(()=>{
      const run=()=>publishMeta(raw);
      if('requestIdleCallback'in window){try{requestIdleCallback(run,{timeout:1800});return;}catch{}}
      setTimeout(run,120);
    },220);
  }
  function hotcacheDiagnostic(detail={}){
    const root=document.documentElement,mode=String(detail.mode||root.dataset.ng8Hotcache||'READY');
    const hits=Number(detail.hits??root.dataset.ng8HotcacheHits??0),net=Number(detail.network??root.dataset.ng8HotcacheNetwork??0),shared=Number(detail.deduped??root.dataset.ng8HotcacheDeduped??0),entries=Number(detail.entries??root.dataset.ng8HotcacheEntries??0);
    api.set('hotcache',`${mode} · ${entries}/5 · ${hits} hit · ${net} net${shared?` · ${shared} partagé${shared>1?'s':''}`:''}`);
  }
  function startHotcacheUI(){
    window.__NIAKGPT_CACHE_BUS__?.subscribe(raw=>scheduleMeta(raw));
    document.addEventListener('niakgpt:hotcache-status',event=>hotcacheDiagnostic(event.detail||{}));
    document.addEventListener('niakgpt:activity-network',event=>{
      if(event.detail?.phase!=='request')return;const id=String(event.detail?.chatId||location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'');
      if(id)document.dispatchEvent(new CustomEvent('niakgpt:hotcache-dirty',{detail:{id}}));
    });
    hotcacheDiagnostic();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startHotcacheUI,{once:true});
  else queueMicrotask(startHotcacheUI);
})();
