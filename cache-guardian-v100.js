(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CACHE_GUARD_100__)return;
  window.__NIAKGPT_CACHE_GUARD_100__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const BACKUP_KEY='niakgpt-auto-rebuild-backup-v0911';
  const GOOD_KEY='niakgpt-state-highwater-v100';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  document.documentElement.dataset.ng100CacheGuard='pending';

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const isServerProject=p=>!!p&&normalizePid(p.id).startsWith('g-p-')&&!p.domOnly;
  const isQueue=p=>!!p&&QUEUE_NAMES.has(norm(p.name));
  const health=cache=>{
    const projects=(cache?.projects||[]).filter(isServerProject),chats=(cache?.chats||[]).filter(c=>c?.id),dated=chats.filter(c=>parseTime(c.updated||c.update_time||c.create_time)).length;
    return{projects:projects.length,chats:chats.length,dated,ratio:chats.length?dated/chats.length:0};
  };
  const better=(a,b)=>a.chats>b.chats||a.projects>b.projects||a.dated>b.dated;
  const structural=h=>h.projects>=4&&h.chats>=20;
  const healthy=h=>structural(h)&&h.dated>=Math.min(10,Math.max(1,Math.floor(h.chats*.35)));
  const collapsed=(cur,ref)=>{
    if(!ref||!structural(ref))return false;
    if(cur.dated===0&&ref.dated>=10)return true;
    if(cur.chats<Math.max(12,Math.floor(ref.chats*.62)))return true;
    if(cur.projects+2<ref.projects)return true;
    return false;
  };

  function backupAsCache(backup,current={}){
    if(!Array.isArray(backup?.projects)||!Array.isArray(backup?.chats))return null;
    const pm=new Map();
    for(const p of backup.projects){const id=normalizePid(p?.id);if(!id.startsWith('g-p-')||!clean(p?.name))continue;pm.set(id,{...p,id,name:clean(p.name),href:`/g/${id}/project`,domOnly:false});}
    const cm=new Map((current.chats||[]).filter(c=>c?.id).map(c=>[c.id,{...c,updated:parseTime(c.updated||c.update_time||c.create_time)}]));
    for(const c of backup.chats||[]){if(!c?.id)continue;const old=cm.get(c.id)||{};cm.set(c.id,{...old,...c,id:c.id,projectId:normalizePid(c.projectId||old.projectId||''),updated:Math.max(parseTime(old.updated),parseTime(c.updated||c.update_time||c.create_time)),snippet:clean(c.snippet||old.snippet||'')});}
    const counts={};for(const p of pm.values())counts[p.id]=0;for(const c of cm.values())if(c.projectId&&counts[c.projectId]!=null)counts[c.projectId]++;
    return{...current,schema:2,at:Date.now(),serverIndexedAt:0,projects:[...pm.values()],chats:[...cm.values()],counts,indexedProjectIds:[]};
  }

  function rescueGovernance(gov,cache,backup){
    const projects=(cache?.projects||[]).filter(isServerProject),valid=new Set(projects.map(p=>p.id));
    const existing=(gov?.coreProjectIds||[]).map(normalizePid).filter(id=>valid.has(id));
    if(existing.length)return gov||{};
    const backupIds=(backup?.projects||[]).filter(p=>isServerProject(p)&&!isQueue(p)).map(p=>normalizePid(p.id)).filter(id=>valid.has(id));
    if(!backupIds.length)return gov||{};
    return{...(gov||{}),seeded:true,seedVersion:3,manualCoreSelection:false,coreProjectIds:[...new Set(backupIds)],hiddenProjectIds:[],guardRecoveredAt:Date.now()};
  }

  async function rememberGood(cache,gov,source='runtime'){
    const h=health(cache);if(!healthy(h))return false;
    let old=null;try{old=(await chrome.storage.local.get(GOOD_KEY))[GOOD_KEY]||null;}catch{}
    const oh=health(old?.cache||{});
    if(old&&healthy(oh)&&!better(h,oh)&&h.chats<Math.floor(oh.chats*.95))return false;
    try{await chrome.storage.local.set({[GOOD_KEY]:{at:Date.now(),source,cache,governance:gov||{},health:h}});return true;}catch{return false;}
  }

  async function run(){
    try{
      const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY,BACKUP_KEY,GOOD_KEY]);
      const current=raw[CACHE_KEY]||{},gov=raw[GOV_KEY]||{},backup=raw[BACKUP_KEY]||null,good=raw[GOOD_KEY]||null;
      const ch=health(current),gh=health(good?.cache||{}),bh=health(backupAsCache(backup,{})||{});
      let candidate=null,source='';
      if(good?.cache&&healthy(gh)){candidate=good.cache;source='highwater';}
      else if(backup&&structural(bh)){candidate=backupAsCache(backup,current);source='backup';}

      if(candidate&&collapsed(ch,health(candidate))){
        const rescued=source==='backup'?candidate:{...candidate,serverIndexedAt:0,at:Date.now()};
        const nextGov=rescueGovernance(good?.governance&&source==='highwater'?good.governance:gov,rescued,backup);
        await chrome.storage.local.set({[CACHE_KEY]:rescued,[GOV_KEY]:nextGov});
        document.documentElement.dataset.ng100CacheGuardRestored=source;
        window.__NIAKGPT_DIAGNOSTICS__?.set('cache-garde',`RESTAURÉ · ${source} · ${health(rescued).projects} Projects · ${health(rescued).chats} chats · ${health(rescued).dated} dates`);
      }else{
        if(!structural(ch))window.__NIAKGPT_DIAGNOSTICS__?.set('cache-garde',`PARTIEL · ${ch.projects} Projects · ${ch.chats} chats · ${ch.dated} dates · index serveur requis`);
        else window.__NIAKGPT_DIAGNOSTICS__?.set('cache-garde',`OK · ${ch.projects} Projects · ${ch.chats} chats · ${ch.dated} dates`);
        await rememberGood(current,gov,'boot');
      }
    }catch(error){
      window.__NIAKGPT_DIAGNOSTICS__?.set('cache-garde',`ERREUR · ${String(error?.message||error).slice(0,90)}`);
    }finally{
      delete document.documentElement.dataset.ng100CacheGuard;
      document.dispatchEvent(new CustomEvent('niakgpt:cache-guard-ready'));
    }
  }

  document.addEventListener('niakgpt:server-projects-ready',async()=>{try{const raw=await chrome.storage.local.get(CACHE_KEY),h=health(raw[CACHE_KEY]||{});window.__NIAKGPT_DIAGNOSTICS__?.set('cache-garde',`PROJECTS PRÊTS · ${h.projects} Projects · ${h.chats} chats · ${h.dated} dates · détails en arrière-plan`);}catch{}});
  document.addEventListener('niakgpt:server-indexed',async()=>{try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);await rememberGood(raw[CACHE_KEY]||{},raw[GOV_KEY]||{},'server-index');}catch{}});
  document.addEventListener('niakgpt:recovery-complete',async()=>{try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);await rememberGood(raw[CACHE_KEY]||{},raw[GOV_KEY]||{},'recovery');}catch{}});
  run();
})();
