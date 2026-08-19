(async() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_METADATA_118__)return;
  window.__NIAKGPT_SIDEBAR_METADATA_118__=true;
  window.__NIAKGPT_METADATA_READY_118__='pending';

  const CACHE_KEY='niakgpt-v08-cache';
  const DATA_LOCK='niakgpt-data-mutation-v100';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  let sidebarObserver=null,sidebarNode=null,bootstrapObserver=null,timer=0,stopped=false,cacheUnsub=null,sanitizeTask=null,lifecycleEpoch=0,pendingRaw=undefined,pendingReplay=false,runtimeRetryTimer=0;
  const ownWriteSignatures=new Set();

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const isDateLike=v=>{
    const s=norm(v).replace(/^dernier(?:e)?\s+(?:echange|activité|activite)\s*:?\s*/,'');
    return /^(?:aujourd'hui|aujourdhui|hier|today|yesterday|\d{1,2}:\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?(?:\s+[·-]?\s*\d{1,2}:\d{2})?)$/.test(s);
  };
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  function rawCacheSnapshot(){
    const bus=window.__NIAKGPT_CACHE_BUS__;
    try{return bus?.__ng118RawPeek?bus.__ng118RawPeek():bus?.peek?bus.peek():null;}catch{return null;}
  }
  function isCanonicalProjectBadge(link,badge){
    const raw=rawCacheSnapshot();if(!raw)return false;
    let projectId=pidFromHref(link?.getAttribute?.('href')||'');
    if(!projectId){const chatId=cidFromHref(link?.getAttribute?.('href')||'');projectId=String((raw.chats||[]).find(c=>String(c?.id||'')===chatId)?.projectId||'');}
    if(!projectId.startsWith('g-p-'))return false;
    const project=(raw.projects||[]).find(p=>String(p?.id||'')===projectId);
    return !!project&&norm(project.name)===norm(badge?.textContent);
  }

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
        if(!isDateLike(badge.textContent)||isCanonicalProjectBadge(link,badge))continue;
        badge.dataset.ng118InvalidProject='1';badge.remove();
      }
    }
  }

  function cleanCache(raw){
    if(!raw||typeof raw!=='object')return null;
    const projects=Array.isArray(raw.projects)?raw.projects:[],badIds=new Set(projects.filter(p=>{const id=String(p?.id||'');const canonical=id.startsWith('g-p-');return p?.domOnly&&isDateLike(p?.name)&&!canonical;}).map(p=>String(p.id||'')).filter(Boolean));
    if(!badIds.size)return null;
    const cleanedProjects=projects.filter(p=>!badIds.has(String(p?.id||''))),recoveries=[];
    const cleanedChats=(Array.isArray(raw.chats)?raw.chats:[]).map(c=>{
      if(!badIds.has(String(c?.projectId||'')))return c;
      const recovered=pidFromHref(c?.href||''),next={...c,projectId:recovered||''};if(recovered)recoveries.push(next);return next;
    });
    const counts={...(raw.counts||{})};for(const id of badIds)delete counts[id];
    const projectChats={...(raw.projectChats||{})};for(const id of badIds)delete projectChats[id];
    for(const chat of recoveries){
      const projectId=String(chat.projectId||'');if(!projectId)continue;
      const existing=Array.isArray(projectChats[projectId])?projectChats[projectId]:[];
      if(existing.length){const list=[...existing],at=list.findIndex(c=>String(c?.id||'')===String(chat.id||''));if(at>=0)list[at]={...list[at],...chat};else list.push(chat);projectChats[projectId]=list;}
      const known=cleanedChats.filter(c=>String(c?.projectId||'')===projectId).length;counts[projectId]=Math.max(Number(counts[projectId])||0,known);
    }
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
  const ownWriteSignature=raw=>{
    if(!raw||typeof raw!=='object')return '';
    try{return JSON.stringify(raw);}catch{return '';}
  };
  const isOwnWrite=raw=>{const signature=ownWriteSignature(raw);return !!signature&&ownWriteSignatures.has(signature);};
  function rememberOwnWrite(raw){
    const signature=ownWriteSignature(raw);if(!signature)return;
    ownWriteSignatures.add(signature);setTimeout(()=>ownWriteSignatures.delete(signature),10000);
  }
  function sanitizeCache(rawOverride){
    if(stopped)return Promise.resolve({ok:false,stopped:true,error:new Error('metadata_stopped')});
    if(rawOverride!==undefined&&isOwnWrite(rawOverride))return sanitizeTask||Promise.resolve({ok:true,own:true});
    if(sanitizeTask){
      if(rawOverride!==undefined){pendingRaw=rawOverride;pendingReplay=true;}
      return sanitizeTask;
    }
    sanitizeTask=(async()=>{
      let source=rawOverride,replay=false;
      try{
        for(;;){
          const run=async()=>{
            const bus=wrapCacheBus()||window.__NIAKGPT_CACHE_BUS__;
            const raw=source!==undefined?source:(bus?.__ng118RawGet?await bus.__ng118RawGet():bus?.get?await bus.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]);
            const cleaned=cleanCache(raw),target=cleaned||(replay&&raw&&typeof raw==='object'?raw:null);if(!target)return;
            if(bus?.update)await bus.update(latest=>{
              const next=source!==undefined||replay?target:(cleanCache(latest)||latest);
              rememberOwnWrite(next);return next;
            });
            else{rememberOwnWrite(target);await chrome.storage.local.set({[CACHE_KEY]:target});}
            window.__NIAKGPT_DIAGNOSTICS__?.set('metadata-sidebar','RÉPARÉ · faux Project/date supprimé');
          };
          if(navigator.locks?.request)await navigator.locks.request(DATA_LOCK,{mode:'exclusive'},run);
          else await run();
          if(pendingRaw===undefined)break;
          source=pendingRaw;pendingRaw=undefined;replay=pendingReplay;pendingReplay=false;
        }
        return{ok:true};
      }catch(error){
        pendingRaw=undefined;pendingReplay=false;
        const msg=String(error?.message||error||'');
        if(/Extension context invalidated|context invalidated/i.test(msg))stop();
        window.__NIAKGPT_DIAGNOSTICS__?.set('metadata-sidebar',`ERREUR · sanitation cache · ${msg.slice(0,120)}`);
        return{ok:false,error};
      }finally{
        sanitizeTask=null;
      }
    })();
    return sanitizeTask;
  }

  function queueRuntimeSanitize(raw){
    const epoch=lifecycleEpoch;
    sanitizeCache(raw).then(result=>{
      if(result?.ok){clearTimeout(runtimeRetryTimer);runtimeRetryTimer=0;return;}
      if(stopped||epoch!==lifecycleEpoch||window.__NIAKGPT_METADATA_READY_118__!=='ready')return;
      clearTimeout(runtimeRetryTimer);runtimeRetryTimer=setTimeout(()=>{
        runtimeRetryTimer=0;
        if(stopped||epoch!==lifecycleEpoch||window.__NIAKGPT_METADATA_READY_118__!=='ready')return;
        sanitizeCache();
      },80);
    });
    schedule(8);
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
    stopped=true;lifecycleEpoch++;pendingRaw=undefined;pendingReplay=false;window.__NIAKGPT_METADATA_READY_118__='stopped';clearTimeout(timer);timer=0;clearTimeout(runtimeRetryTimer);runtimeRetryTimer=0;sidebarObserver?.disconnect();bootstrapObserver?.disconnect();sidebarObserver=bootstrapObserver=null;sidebarNode=null;
    try{cacheUnsub?.();}catch{}cacheUnsub=null;
  }

  async function start(){
    const epoch=++lifecycleEpoch;stopped=false;window.__NIAKGPT_METADATA_READY_118__='pending';const current=()=>!stopped&&epoch===lifecycleEpoch;
    const bus=wrapCacheBus();bootstrap();normalizeChatMetadata();
    let result=await sanitizeCache();if(!current())return;
    if(!result?.ok){await new Promise(resolve=>setTimeout(resolve,80));if(!current())return;result=await sanitizeCache();if(!current())return;}
    if(!result?.ok){window.__NIAKGPT_METADATA_READY_118__='error';throw result?.error||new Error('metadata_sanitize_failed');}
    if(!current())return;window.__NIAKGPT_METADATA_READY_118__='ready';
    const rawSubscribe=bus?.__ng118RawSubscribe||null;
    if(rawSubscribe&&!cacheUnsub)cacheUnsub=rawSubscribe(queueRuntimeSanitize);
    else if(bus?.subscribe&&!cacheUnsub)cacheUnsub=bus.subscribe(queueRuntimeSanitize);
    if(current())schedule(0);
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
