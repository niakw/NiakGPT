(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_TRUTH_127__)return;
  window.__NIAKGPT_SIDEBAR_TRUTH_127__=true;

  // v112 hid ChatGPT's native Projects surface as soon as *one* custom pin existed.
  // That makes a partial cache look authoritative. v127 owns suppression instead and
  // keeps native Projects visible until both server inventory and rendered catalog agree.
  window.__NIAKGPT_PROJECTS_AUTHORITY_112__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const MARK='data-ng112-native-projects';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const PROJECT_RX=/\/g\/(g-p-[^/?#]+)(?:\/|$)/i;
  const SHOW_MORE_RX=/^(?:afficher|voir)\s+plus$|^show\s+more$/i;
  let cache={},rpcSeq=0,refreshTimer=0,applyTimer=0,busy=false,attempts=0,lastSignature='',stableScans=0,observer=null;
  // Verified inventory is runtime authority owned by v127, not a field other cache
  // writers are allowed to accidentally revoke. Shared-cache metadata is persisted for
  // diagnostics/recovery only; unrelated chat hydration cannot erase this page proof.
  let verifiedCount=0,verifiedIds=new Set(),verifiedAt=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>normalizePid(String(h||'').match(PROJECT_RX)?.[1]||'');
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const serverProjects=raw=>(raw?.projects||[]).filter(p=>normalizePid(p?.id).startsWith('g-p-')&&!p?.domOnly);
  const dataRoot=data=>data?.data&&typeof data.data==='object'?data.data:data;
  const rowsFrom=data=>{const root=dataRoot(data)||{};for(const key of ['items','projects','gizmos'])if(Array.isArray(root?.[key]))return root[key];return[];};
  const nextCursor=data=>{const root=dataRoot(data)||{};return root?.cursor??root?.next_cursor??root?.nextCursor??root?.next_page_cursor??root?.nextPageCursor??root?.pagination?.cursor??root?.pagination?.next_cursor??null;};
  const hasMore=data=>{const root=dataRoot(data)||{};return root?.has_more===true||root?.hasMore===true||root?.pagination?.has_more===true||root?.pagination?.hasMore===true;};
  const totalHint=data=>{const root=dataRoot(data)||{},values=[root.total,root.total_count,root.totalCount,root.project_count,root.projectCount,root.pagination?.total,root.metadata?.total];return Math.max(0,...values.map(Number).filter(Number.isFinite));};
  const projectFromRaw=raw=>{const g=raw?.gizmo?.gizmo||raw?.gizmo||raw,id=normalizePid(clean(g?.id||raw?.id)),name=clean(g?.display?.name||g?.name||raw?.display?.name);return id.startsWith('g-p-')&&name?{id,name,description:clean(g?.display?.description||g?.description||''),instructions:clean(g?.instructions||''),href:`/g/${id}/project`,domOnly:false}:null;};
  const nativeBusy=()=>document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')||document.documentElement.dataset.ng105Verification==='1';

  function rpc(path,timeout=9000){
    const id=`ng127-projects-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=event=>{if(event.detail?.id!==id)return;off();resolve(event.detail);};
      const off=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method:'GET',governance:true}}));
    });
  }
  async function readCache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function updateCache(mutator){
    const bus=window.__NIAKGPT_CACHE_BUS__;
    if(bus?.update){try{return await bus.update(mutator);}catch{}}
    try{const before=await readCache(),next=mutator(before);if(next&&next!==before)await chrome.storage.local.set({[CACHE_KEY]:next});return next||before;}catch{return{};}
  }

  function nativeProjectIds(){
    const ids=new Set();
    for(const a of document.querySelectorAll('a[href*="/g/g-p-"]'))if(outsideOwn(a)){const id=pidFromHref(a.getAttribute('href'));if(id)ids.add(id);}
    return ids;
  }
  function nativeTargets(){
    const out=new Set(),links=[...document.querySelectorAll('a[href*="/g/g-p-"]')].filter(outsideOwn);
    for(const link of links){
      const row=link.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],[role="listitem"],li')||link;
      if(row&&!row.contains(document.getElementById('ng8-pins')))out.add(row);
    }
    if(links.length){
      let node=links[0].parentElement;
      for(let depth=0;depth<7&&node&&node!==document.body;depth++,node=node.parentElement){
        const children=[...node.querySelectorAll('a[href*="/g/g-p-"]')].filter(outsideOwn);
        const hasPrimary=[...node.querySelectorAll('a[href]')].some(a=>/^\/(?:$|new(?:\/|$)|library(?:\/|$)|projects(?:\/|$)|tasks(?:\/|$)|plugins(?:\/|$))/.test(a.getAttribute('href')||''));
        if(children.length>=links.length&&!hasPrimary){out.add(node);break;}
      }
    }
    for(const el of document.querySelectorAll('h1,h2,h3,[role="heading"],button,[role="button"]')){
      if(!outsideOwn(el))continue;const label=clean(el.getAttribute('aria-label')||el.textContent);
      if(/^(?:projets?|projects?)$/i.test(label)||SHOW_MORE_RX.test(label)){
        const near=el.closest('[data-sidebar-item="true"],[class*="sidebar-expando-section"],[class*="project" i],li')||el;
        if(near&&!near.contains(document.getElementById('ng8-pins')))out.add(near);
      }
    }
    return [...out].filter(el=>el?.isConnected&&outsideOwn(el));
  }
  function releaseNative(){for(const el of document.querySelectorAll(`[${MARK}="1"]`))el.removeAttribute(MARK);}
  function suppressNative(){const targets=nativeTargets();for(const el of targets)el.setAttribute(MARK,'1');return targets.length;}
  function customCount(){return new Set([...document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]')].map(a=>normalizePid(a.dataset.ng121Pid||pidFromHref(a.getAttribute('href')))).filter(Boolean)).size;}
  function clearProof(reason='contradiction'){
    if(!verifiedCount)return;
    verifiedCount=0;verifiedIds=new Set();verifiedAt=0;
    delete document.documentElement.dataset.ng127InventoryReady;releaseNative();
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-truth-127',`ATTENTE · preuve inventaire invalidée · ${reason}`);
  }
  function inventoryState(raw=cache){
    const native=nativeProjectIds().size,server=serverProjects(raw).length,cacheExpected=Math.max(0,Number(raw?.projectInventoryCount||0)||0),expected=verifiedCount||cacheExpected;
    const verified=verifiedCount>0;
    const trusted=verified&&server>=verifiedCount&&verifiedCount>=native;
    const rendered=customCount(),ready=trusted&&rendered>=verifiedCount;
    return{native,server,expected,verified,trusted,rendered,ready,verifiedAt};
  }
  function apply(source='state'){
    clearTimeout(applyTimer);applyTimer=0;
    const state=inventoryState();
    if(state.ready){
      document.documentElement.dataset.ng127InventoryReady='1';
      const hidden=suppressNative();
      window.__NIAKGPT_DIAGNOSTICS__?.set('projects-truth-127',`OK · inventaire vérifié ${state.rendered}/${state.expected} · natif masqué ${hidden}`);
    }else{
      delete document.documentElement.dataset.ng127InventoryReady;
      releaseNative();
      window.__NIAKGPT_DIAGNOSTICS__?.set('projects-truth-127',`ATTENTE · inventaire non prouvé · custom ${state.rendered} · serveur ${state.server}/${state.expected||'?'} · natif ≥${state.native} · source ${source}`);
    }
    return state;
  }
  function scheduleApply(source='event',delay=0){clearTimeout(applyTimer);applyTimer=setTimeout(()=>apply(source),delay);}

  async function fetchInventory(){
    const found=new Map(),seen=new Set();let cursor=null,maxTotal=0,transportComplete=true;
    for(let page=0;page<100;page++){
      const qs=new URLSearchParams({conversations_per_gizmo:'0',limit:'100'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const result=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`);if(!result?.ok)return{ok:false,found,maxTotal,transportComplete:false,error:result?.error||`HTTP ${result?.status||0}`};
      maxTotal=Math.max(maxTotal,totalHint(result.data));
      for(const raw of rowsFrom(result.data)){const p=projectFromRaw(raw);if(p)found.set(p.id,p);}
      const next=nextCursor(result.data),more=hasMore(result.data);
      if(next==null||next===''){
        if(more)transportComplete=false;
        break;
      }
      const key=String(next);if(seen.has(key)){transportComplete=false;break;}seen.add(key);cursor=next;
    }
    return{ok:true,found,maxTotal,transportComplete};
  }
  async function refresh(source='event'){
    clearTimeout(refreshTimer);refreshTimer=0;if(busy||document.hidden||nativeBusy())return scheduleRefresh('busy',700);
    busy=true;attempts++;
    try{
      cache=await readCache();const result=await fetchInventory();
      if(!result.ok){window.__NIAKGPT_DIAGNOSTICS__?.set('projects-truth-127',`ATTENTE · inventaire serveur indisponible · ${result.error}`);if(attempts<8)scheduleRefresh('retry-error',1200);return;}
      const found=[...result.found.values()],signature=found.map(p=>p.id).sort().join('|');
      stableScans=signature&&signature===lastSignature?stableScans+1:1;lastSignature=signature;
      const nativeLower=nativeProjectIds().size,lowerBound=Math.max(nativeLower,result.maxTotal||0);
      const oneItemNeedsConfirmation=found.length<=1&&lowerBound<=1&&result.maxTotal<=1;
      if(verifiedCount&&(nativeLower>verifiedCount||result.maxTotal>verifiedCount||(result.transportComplete&&found.length!==verifiedCount)))clearProof(`serveur=${found.length}, total=${result.maxTotal||'?'}, natif≥${nativeLower}`);
      const verified=result.transportComplete&&found.length>0&&found.length>=lowerBound&&(!oneItemNeedsConfirmation||stableScans>=2);
      const proofCount=verified?Math.max(nativeLower,result.maxTotal||0,found.length):0;
      if(verified){verifiedCount=proofCount;verifiedIds=new Set(found.map(p=>p.id));verifiedAt=Date.now();}
      cache=await updateCache(latest=>{
        latest=latest&&typeof latest==='object'?latest:{};
        const merged=new Map(serverProjects(latest).map(p=>[normalizePid(p.id),{...p}]));for(const p of found){const old=merged.get(p.id)||{};merged.set(p.id,{...old,...p,domOnly:false,href:`/g/${p.id}/project`});}
        const other=(latest.projects||[]).filter(p=>!normalizePid(p?.id).startsWith('g-p-')||p?.domOnly);
        const expected=verifiedCount||Math.max(nativeLower,result.maxTotal||0,found.length);
        return{...latest,projects:[...merged.values(),...other],projectInventoryCount:expected,projectInventoryAt:verifiedAt||0,projectInventoryVerified:verifiedCount>0,projectInventorySource:'sidebar-truth-v127',projectInventoryObservedAt:Date.now(),at:Date.now()};
      });
      document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile',{detail:{source:'sidebar-truth-v127'}}));
      const state=apply(`refresh:${source}`);
      if(!verified&&attempts<8)scheduleRefresh('retry-unverified',oneItemNeedsConfirmation?550:1200);
      else if(verified&&!state.ready)scheduleApply('await-render',120);
    }finally{busy=false;}
  }
  function scheduleRefresh(source='event',delay=120){if(attempts>=8&&source.startsWith('retry'))return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(source),delay);}

  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes[CACHE_KEY])return;cache=changes[CACHE_KEY].newValue||{};scheduleApply('storage',0);});}catch{}
  document.addEventListener('niakgpt:pins-rendered',()=>scheduleApply('pins-rendered',0));
  document.addEventListener('niakgpt:server-projects-ready',()=>scheduleRefresh('server-projects-ready',40));
  document.addEventListener('niakgpt:server-indexed',()=>scheduleApply('server-indexed',0));
  document.addEventListener('niakgpt:activity-changed',event=>{if(event.detail?.active===false){attempts=0;scheduleRefresh('activity-ready',120);}});
  document.addEventListener('niakgpt:rate-limit-cleared',()=>{attempts=0;scheduleRefresh('rate-limit-cleared',180);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){attempts=0;scheduleRefresh('visible',120);}});
  window.addEventListener('popstate',()=>scheduleApply('popstate',40));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>scheduleApply('navigation',40));
  window.addEventListener('pageshow',()=>{attempts=0;scheduleRefresh('pageshow',80);});
  window.addEventListener('pagehide',()=>{clearTimeout(refreshTimer);clearTimeout(applyTimer);observer?.disconnect();},{once:true});
  observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&(n.id==='ng8-pins'||n.matches?.('a[href*="/g/g-p-"],[data-ng112-native-projects]')||n.querySelector?.('#ng8-pins,a[href*="/g/g-p-"]')))))scheduleApply('dom',30);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  readCache().then(raw=>{cache=raw;apply('init');scheduleRefresh('init',80);});
})();