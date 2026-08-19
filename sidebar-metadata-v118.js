(async() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_METADATA_118__)return;
  window.__NIAKGPT_SIDEBAR_METADATA_118__=true;
  window.__NIAKGPT_METADATA_READY_118__='pending';

  const CACHE_KEY='niakgpt-v08-cache';
  const DATA_LOCK='niakgpt-data-mutation-v100';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  let sidebarObserver=null,sidebarNode=null,bootstrapObserver=null,timer=0,stopped=false,cacheUnsub=null,sanitizeTask=null;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i)?.[1]||'';
  const isDateLike=v=>{
    const s=norm(v).replace(/^dernier(?:e)?\s+(?:echange|activité|activite)\s*:?\s*/,'');
    return /^(?:aujourd'hui|aujourdhui|hier|today|yesterday|\d{1,2}:\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?(?:\s+[·-]?\s*\d{1,2}:\d{2})?)$/.test(s);
  };
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const outsideOwn=el=>!!el&&!el.closest(OWN);

  function replaceDateNode(node){
    if(!(node instanceof HTMLElement)||node.tagName==='TIME')return node;
    const time=document.createElement('time');
    for(const attr of [...node.attributes])time.setAttribute(attr.name,attr.value);
    time.textContent=node.textContent||'';
    node.replaceWith(time);return time;
  }
  function normalizeChatMetadata(){
    const nav=sidebarRoot();if(!nav)return;
    for(const link of nav.querySelectorAll('a[href*="/c/"]')){
      if(!outsideOwn(link))continue;
      for(const date of link.querySelectorAll(':scope > .ng8-chat-date'))if(isDateLike(date.textContent))replaceDateNode(date);
      for(const badge of link.querySelectorAll(':scope > .ng8-chat-project')){
        if(!isDateLike(badge.textContent))continue;
        badge.dataset.ng118InvalidProject='1';badge.remove();
      }
    }
  }

  function cleanCache(raw){
    if(!raw||typeof raw!=='object')return null;
    const projects=Array.isArray(raw.projects)?raw.projects:[],badIds=new Set(projects.filter(p=>{const id=String(p?.id||'');const canonical=id.startsWith('g-p-');return p?.domOnly&&isDateLike(p?.name)&&!canonical;}).map(p=>String(p.id||'')).filter(Boolean));
    if(!badIds.size)return null;
    const cleanedProjects=projects.filter(p=>!badIds.has(String(p?.id||'')));
    const cleanedChats=(Array.isArray(raw.chats)?raw.chats:[]).map(c=>{
      if(!badIds.has(String(c?.projectId||'')))return c;
      const recovered=pidFromHref(c?.href||'');return{...c,projectId:recovered||''};
    });
    const counts={...(raw.counts||{})};for(const id of badIds)delete counts[id];
    const projectChats={...(raw.projectChats||{})};for(const id of badIds)delete projectChats[id];
    const indexed=(Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]).filter(id=>!badIds.has(String(id)));
    return{...raw,at:Date.now(),projects:cleanedProjects,chats:cleanedChats,counts,projectChats,indexedProjectIds:indexed};
  }
  const cleanRead=raw=>cleanCache(raw)||raw;
  function wrapCacheBus(){
    const bus=window.__NIAKGPT_CACHE_BUS__;if(!bus||bus.__ng118Sanitized)return bus;
    const originalGet=typeof bus.get==='function'?bus.get.bind(bus):null;
    const originalPeek=typeof bus.peek==='function'?bus.peek.bind(bus):null;
    const originalSubscribe=typeof bus.subscribe==='function'?bus.subscribe.bind(bus):null;
    try{
      Object.defineProperties(bus,{
        __ng118RawGet:{value:originalGet,configurable:true},
        __ng118RawPeek:{value:originalPeek,configurable:true},
        __ng118RawSubscribe:{value:originalSubscribe,configurable:true},
        __ng118Sanitized:{value:true,configurable:true}
      });
      if(originalGet)bus.get=async()=>cleanRead(await originalGet());
      if(originalPeek)bus.peek=()=>cleanRead(originalPeek());
      if(originalSubscribe)bus.subscribe=fn=>originalSubscribe(raw=>fn(cleanRead(raw)));
      if(bus.ready&&typeof bus.ready.then==='function')bus.ready=Promise.resolve(bus.ready).then(cleanRead);
    }catch{}
    return bus;
  }
  function sanitizeCache(){
    if(stopped)return Promise.resolve({ok:false,stopped:true,error:new Error('metadata_stopped')});
    if(sanitizeTask)return sanitizeTask;
    sanitizeTask=(async()=>{
      const run=async()=>{
        const bus=wrapCacheBus()||window.__NIAKGPT_CACHE_BUS__;
        const raw=bus?.__ng118RawGet?await bus.__ng118RawGet():bus?.get?await bus.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
        const cleaned=cleanCache(raw);if(!cleaned)return;
        if(bus?.update)await bus.update(latest=>cleanCache(latest)||latest);
        else await chrome.storage.local.set({[CACHE_KEY]:cleaned});
        window.__NIAKGPT_DIAGNOSTICS__?.set('metadata-sidebar','RÉPARÉ · faux Project/date supprimé');
      };
      try{
        if(navigator.locks?.request)await navigator.locks.request(DATA_LOCK,{mode:'exclusive'},run);
        else await run();
        return{ok:true};
      }catch(error){
        const msg=String(error?.message||error||'');
        if(/Extension context invalidated|context invalidated/i.test(msg))stop();
        window.__NIAKGPT_DIAGNOSTICS__?.set('metadata-sidebar',`ERREUR · sanitation cache · ${msg.slice(0,120)}`);
        return{ok:false,error};
      }
    })().finally(()=>{sanitizeTask=null;});
    return sanitizeTask;
  }

  function repair(){if(stopped)return;bindSidebar();normalizeChatMetadata();sanitizeCache();}
  function schedule(delay=24){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}
  function bindSidebar(){
    const nav=sidebarRoot();if(!nav||nav===sidebarNode)return !!nav;
    sidebarObserver?.disconnect();sidebarNode=nav;
    sidebarObserver=new MutationObserver(()=>schedule(18));
    sidebarObserver.observe(nav,{childList:true,subtree:true});
    return true;
  }
  function bootstrap(){
    if(bindSidebar())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bindSidebar()){bootstrapObserver?.disconnect();bootstrapObserver=null;schedule(0);}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){
    stopped=true;clearTimeout(timer);timer=0;sidebarObserver?.disconnect();bootstrapObserver?.disconnect();sidebarObserver=bootstrapObserver=null;sidebarNode=null;
    try{cacheUnsub?.();}catch{}cacheUnsub=null;
  }

  async function start(){
    stopped=false;const bus=wrapCacheBus();bootstrap();normalizeChatMetadata();
    let result=await sanitizeCache();
    if(!result?.ok&&!stopped){await new Promise(resolve=>setTimeout(resolve,80));result=await sanitizeCache();}
    if(!result?.ok){window.__NIAKGPT_METADATA_READY_118__='error';throw result?.error||new Error('metadata_sanitize_failed');}
    window.__NIAKGPT_METADATA_READY_118__='ready';
    const rawSubscribe=bus?.__ng118RawSubscribe||null;
    if(rawSubscribe&&!cacheUnsub)cacheUnsub=rawSubscribe(raw=>{sanitizeCache(raw);schedule(8);});
    else if(bus?.subscribe&&!cacheUnsub)cacheUnsub=bus.subscribe(raw=>{sanitizeCache(raw);schedule(8);});
    schedule(0);
  }

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(20));
  window.addEventListener('popstate',()=>schedule(20));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(20));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  await start();
})();
