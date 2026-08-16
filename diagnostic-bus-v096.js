(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_DIAGNOSTICS__)return;

  // Retired modules stay blocked even if an old unpacked build left their files on disk.
  // 0.9.52 production no longer injects either hotcache runtime.
  window.__NIAKGPT_HOTCACHE_084__=true;
  window.__NIAKGPT_HOTCACHE_MAIN_084__=true;

  const META_KEY='niakgpt-hotmeta-v084'; // legacy local metadata key kept for compatibility only
  const GOV_KEY='niakgpt-governance-v085';
  const SETTINGS_KEY='niakgpt-settings-v090';
  const values=new Map();
  let metaTimer=0,lastMetaSignature='',disposed=false;
  const invalidated=error=>/extension context invalidated|context invalidated/i.test(String(error?.message||error||''));
  const api={
    set(key,text){
      if(disposed)return;key=String(key||'').trim().toLowerCase();text=String(text||'').trim();if(!key)return;
      if(values.get(key)===text)return;values.set(key,text);
      document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text}}));
    },
    delete(key){if(disposed)return;key=String(key||'').trim().toLowerCase();if(values.delete(key))document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text:''}}));},
    snapshot(){return Object.fromEntries(values);}
  };
  window.__NIAKGPT_DIAGNOSTICS__=api;

  const parseTime=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return value>1e12?value:value*1000;
    if(typeof value==='string'){const n=Number(value);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(value);return Number.isFinite(d)?d:0;}
    return 0;
  };
  function publishMeta(raw){
    if(disposed)return;metaTimer=0;const source=raw&&typeof raw==='object'?raw:{};const meta={};let newest=0;
    const add=(chat,pid='')=>{if(!chat?.id)return;const updated=parseTime(chat.updated||chat.update_time||chat.create_time);if(!updated)return;const old=meta[chat.id];if(!old||updated>old.updated)meta[chat.id]={updated,projectId:chat.projectId||pid||''};newest=Math.max(newest,updated);};
    for(const chat of source.chats||[])add(chat);
    for(const [pid,list] of Object.entries(source.projectChats||{}))for(const chat of list||[])add(chat,pid);
    const signature=`${source.at||0}:${Object.keys(meta).length}:${newest}`;if(signature===lastMetaSignature)return;lastMetaSignature=signature;
    try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch{}
    document.documentElement.dataset.ng8Hotmeta=String(Object.keys(meta).length);
    document.dispatchEvent(new CustomEvent('niakgpt:hotmeta-updated'));
  }
  function scheduleMeta(raw){
    if(disposed)return;clearTimeout(metaTimer);metaTimer=setTimeout(()=>{
      if(disposed)return;const run=()=>publishMeta(raw);
      if('requestIdleCallback'in window){try{requestIdleCallback(run,{timeout:1800});return;}catch{}}
      setTimeout(run,120);
    },220);
  }
  function role(){return document.documentElement.dataset.ng8TabRole||'unknown';}
  function safe(){return document.documentElement.dataset.ng90Safe==='1';}
  function publishOrganizer(governance={}){
    if(safe()){api.set('organizer','PAUSE · SAFE MODE');return;}
    if(role()==='client'){api.set('organizer','DÉLÉGUÉ · WORKER');return;}
    const core=Array.isArray(governance.coreProjectIds)?governance.coreProjectIds.length:0;
    const locks=governance.locks&&typeof governance.locks==='object'?Object.keys(governance.locks).length:0;
    const hidden=Array.isArray(governance.hiddenProjectIds)?governance.hiddenProjectIds.length:0;
    api.set('organizer',`OK · ${core} principaux · ${locks} manuels · ${hidden} masqués`);
  }
  function publishPins(settings={}){
    if(safe()||settings.safeMode===true){api.set('pins','PAUSE · SAFE MODE');return;}
    if(settings.nativePins===false){api.set('pins','OFF · synchro native désactivée');return;}
    const current=String(api.snapshot().pins||'');if(/^CORE ·/.test(current))return;
    api.set('pins',role()==='client'?'DÉLÉGUÉ · WORKER':'PRÊT · synchro native');
  }
  async function refreshWorkspaceDiagnostics(){
    if(disposed)return;
    try{
      const raw=await chrome.storage.local.get([GOV_KEY,SETTINGS_KEY]);if(disposed)return;
      publishOrganizer(raw[GOV_KEY]||{});publishPins(raw[SETTINGS_KEY]||{});
    }catch(error){
      if(invalidated(error)){dispose('extension-context');return;}
      api.set('organizer','ERREUR · état local indisponible');api.set('pins','ERREUR · état local indisponible');
    }
  }
  function start(){
    if(disposed)return;
    window.__NIAKGPT_CACHE_BUS__?.subscribe(raw=>scheduleMeta(raw));
    api.set('hotcache','OFF · retiré du runtime 0.9.52');
    document.addEventListener('niakgpt:settings-changed',refreshWorkspaceDiagnostics);
    try{chrome.storage.onChanged.addListener(storageChanged);}catch(error){if(invalidated(error)){dispose('extension-context');return;}}
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng8-tab-role','data-ng90-safe']});
    refreshWorkspaceDiagnostics();
  }
  const storageChanged=(changes,area)=>{if(!disposed&&area==='local'&&(changes[GOV_KEY]||changes[SETTINGS_KEY]))refreshWorkspaceDiagnostics();};
  const observer=new MutationObserver(records=>{if(!disposed&&records.some(r=>r.attributeName==='data-ng8-tab-role'||r.attributeName==='data-ng90-safe'))refreshWorkspaceDiagnostics();});
  function dispose(reason='pagehide'){
    if(disposed)return;disposed=true;clearTimeout(metaTimer);observer.disconnect();
    try{chrome.storage.onChanged.removeListener(storageChanged);}catch{}
    try{document.documentElement.dataset.ng96Diagnostics=reason;}catch{}
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose('pagehide');},{once:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();
