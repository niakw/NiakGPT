(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_RUNTIME_INTEGRITY_101__)return;
  window.__NIAKGPT_RUNTIME_INTEGRITY_101__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  let timer=0,running=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const realProject=p=>normalizePid(p?.id).startsWith('g-p-');
  const queueProject=p=>QUEUE_NAMES.has(norm(p?.name));

  function normalizeCache(cache){
    if(!cache||typeof cache!=='object')return{cache,changed:false};
    let changed=false;
    const projects=(cache.projects||[]).map(raw=>{
      if(!realProject(raw))return raw;
      const id=normalizePid(raw.id),href=`/g/${id}/project`;
      if(raw.id===id&&raw.href===href&&raw.domOnly===false)return raw;
      changed=true;
      return{...raw,id,href,domOnly:false};
    });
    return{cache:changed?{...cache,projects,at:Date.now()}:cache,changed};
  }

  function repairGovernance(cache,gov){
    gov=gov&&typeof gov==='object'?gov:{};
    const projects=(cache?.projects||[]).filter(p=>realProject(p)&&!queueProject(p));
    const valid=new Set(projects.map(p=>normalizePid(p.id)));
    const original=Array.isArray(gov.coreProjectIds)?gov.coreProjectIds:[];
    const current=[...new Set(original.map(normalizePid).filter(id=>valid.has(id)))];
    const manual=gov.manualCoreSelection===true;
    let next=current;
    let reason='ok';

    if(!manual&&valid.size>0&&(!gov.seeded||current.length===0)){
      next=[...valid];
      reason='reseed-empty-core';
    }else if(current.length!==original.length){
      reason='drop-stale-core';
    }

    const changed=reason!=='ok'||gov.seeded!==true||!Array.isArray(gov.coreProjectIds);
    return{
      gov:changed?{...gov,seeded:true,seedVersion:4,coreProjectIds:next,runtimeIntegrityAt:Date.now()}:gov,
      changed,
      reason,
      valid:valid.size,
      core:next.length,
      manual
    };
  }

  async function repair(){
    if(running)return;
    running=true;
    try{
      const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);
      const normalized=normalizeCache(raw[CACHE_KEY]||{});
      const repaired=repairGovernance(normalized.cache,raw[GOV_KEY]||{});
      const writes={};
      if(normalized.changed)writes[CACHE_KEY]=normalized.cache;
      if(repaired.changed)writes[GOV_KEY]=repaired.gov;
      if(Object.keys(writes).length)await chrome.storage.local.set(writes);

      // 0.9.52+ must never expose the retired fetch hotcache as an active module.
      delete document.documentElement.dataset.ng8Hotcache;
      delete document.documentElement.dataset.ng8HotcacheId;
      delete document.documentElement.dataset.ng8HotcacheHits;
      delete document.documentElement.dataset.ng8HotcacheMisses;
      delete document.documentElement.dataset.ng8HotcacheNetwork;
      delete document.documentElement.dataset.ng8HotcacheDeduped;
      delete document.documentElement.dataset.ng8HotcacheEntries;
      window.__NIAKGPT_DIAGNOSTICS__?.set('hotcache','OFF · retiré du runtime');
      window.__NIAKGPT_DIAGNOSTICS__?.set('intégrité',`OK · ${repaired.core}/${repaired.valid} Projects principaux${repaired.reason==='reseed-empty-core'?' · gouvernance réparée':''}`);
      document.dispatchEvent(new CustomEvent('niakgpt:runtime-integrity-ready',{detail:{core:repaired.core,valid:repaired.valid,reason:repaired.reason}}));
    }catch(error){
      window.__NIAKGPT_DIAGNOSTICS__?.set('intégrité',`ERREUR · ${String(error?.message||error).slice(0,90)}`);
    }finally{running=false;}
  }

  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(repair,delay);}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE_KEY]||changes[GOV_KEY]))schedule(60);});
  document.addEventListener('niakgpt:cache-guard-ready',()=>schedule(0));
  document.addEventListener('niakgpt:server-projects-ready',()=>schedule(30));
  document.addEventListener('niakgpt:server-indexed',()=>schedule(30));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(30));
  if(document.documentElement.dataset.ng100CacheGuard==='pending')document.addEventListener('niakgpt:cache-guard-ready',()=>schedule(0),{once:true});
  else schedule(0);
})();
