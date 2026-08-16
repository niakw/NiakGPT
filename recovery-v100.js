(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_RECOVERY_100__)return;
  window.__NIAKGPT_RECOVERY_100__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const REBUILD_KEY='niakgpt-auto-rebuild-v0911';
  const BACKUP_KEY='niakgpt-auto-rebuild-backup-v0911';
  const MARK_KEY='niakgpt-recovery-v100';
  const QUARANTINE_KEY='niakgpt-recovery-v100-quarantine';
  const DATA_LOCK='niakgpt-data-mutation-v100';
  const VERSION='0.9.44';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  let busy=false,timer=0,rpcSeq=0,attempts=0,preflightDone=false;
  document.documentElement.dataset.ng100Recovery='pending';

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const ratePaused=()=>Number(document.documentElement.dataset.ng100RateLimitedUntil||0)>Date.now();
  const ready=()=>document.documentElement.dataset.ng100CacheGuard!=='pending'&&!ratePaused()&&!document.hidden&&document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng8Running!=='1'&&!['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'');
  const isQueueName=name=>QUEUE_NAMES.has(norm(name));
  const listFrom=(data,...keys)=>{for(const key of keys)if(Array.isArray(data?.[key]))return data[key];return[];};
  const nextCursor=data=>data?.cursor??data?.next_cursor??data?.nextCursor??null;

  function diagnostic(text){window.__NIAKGPT_DIAGNOSTICS__?.set('récupération',text);}
  function rpc(path,{method='GET',body=null,timeout=18000}={}){
    const id=`ng100-recovery-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  function projectFromRaw(raw){
    const g=raw?.gizmo?.gizmo||raw?.gizmo||raw,id=normalizePid(clean(g?.id||raw?.id)),name=clean(g?.display?.name||g?.name||raw?.display?.name);
    if(!id.startsWith('g-p-')||!name)return null;
    return{id,name,description:clean(g?.display?.description||g?.description||''),instructions:clean(g?.instructions||''),href:`/g/${id}/project`,domOnly:false};
  }
  function chatFromRaw(raw,projectId=''){
    const id=clean(raw?.id||raw?.conversation_id);if(!id)return null;
    const direct=raw&&Object.prototype.hasOwnProperty.call(raw,'gizmo_id')?raw.gizmo_id:raw?.conversation_mode?.gizmo_id;
    return{id,title:clean(raw?.title||raw?.conversation_title)||'Conversation',snippet:clean(raw?.snippet||''),projectId:normalizePid(projectId||direct||''),updated:parseTime(raw?.update_time||raw?.create_time)};
  }
  async function fetchProjects(){
    const found=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<100;page++){
      if(!ready())throw new Error('paused');
      const qs=new URLSearchParams({conversations_per_gizmo:'0'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`);if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`projects:${r.status||0}:${r.error||'error'}`);}
      for(const raw of listFrom(r.data,'items','projects','gizmos')){const p=projectFromRaw(raw);if(p)found.set(p.id,p);}
      const next=nextCursor(r.data);if(next==null||next==='')break;const k=String(next);if(seen.has(k))break;seen.add(k);cursor=next;await sleep(30);
    }
    return[...found.values()];
  }
  async function fetchProjectChats(projectId){
    const out=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<250;page++){
      if(!ready())throw new Error('paused');
      const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(projectId)}/conversations?${qs}`);if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`project-chats:${r.status||0}`);}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const c=chatFromRaw(raw,projectId);if(c)out.set(c.id,c);}
      const next=nextCursor(r.data);if(!items.length||next==null||next==='')break;const k=String(next);if(seen.has(k))break;seen.add(k);cursor=next;await sleep(35);
    }
    return[...out.values()];
  }
  async function fetchGeneral(){
    const out=new Map();let offset=0;
    for(let page=0;page<100;page++){
      if(!ready())throw new Error('paused');
      const r=await rpc(`/backend-api/conversations?${new URLSearchParams({offset:String(offset),limit:'100',order:'updated'})}`);if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`general:${r.status||0}`);}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const c=chatFromRaw(raw);if(c)out.set(c.id,c);}
      if(!items.length)break;offset+=items.length;if(!(r.data?.has_more===true||r.data?.hasMore===true)&&items.length<100)break;await sleep(40);
    }
    return[...out.values()];
  }
  async function liveInventory(projects,expectedIds=[]){
    const chats=new Map(),counts={};
    // The general list usually already carries gizmo_id. Prefer it: this turns recovery
    // from N Project inventories into 1-2 paginated requests and sharply reduces 429 risk.
    try{for(const c of await fetchGeneral())chats.set(c.id,c);}catch(error){if(['paused','rate-limited'].includes(String(error?.message)))throw error;}
    const expected=new Set(expectedIds),missing=()=>[...expected].filter(id=>!chats.has(id));
    if(expected.size&&missing().length===0){for(const p of projects)counts[p.id]=0;for(const c of chats.values())if(c.projectId&&counts[c.projectId]!=null)counts[c.projectId]++;return{chats,counts};}
    const needed=new Set(missing());
    for(let i=0;i<projects.length;i++){
      if(!ready())throw new Error('paused');const p=projects[i];diagnostic(`RÉCUPÉRATION · inventaire complémentaire ${i+1}/${projects.length}`);
      try{const rows=await fetchProjectChats(p.id);counts[p.id]=rows.length;for(const c of rows){const old=chats.get(c.id)||{};chats.set(c.id,{...c,...old,projectId:c.projectId||old.projectId||'',updated:Math.max(parseTime(old.updated),parseTime(c.updated))});needed.delete(c.id);}}catch(error){if(['paused','rate-limited'].includes(String(error?.message)))throw error;}
      if(expected.size&&!needed.size)break;
    }
    for(const p of projects)if(counts[p.id]==null)counts[p.id]=0;for(const c of chats.values())if(c.projectId&&counts[c.projectId]!=null)counts[c.projectId]=Math.max(counts[c.projectId]||0,[...chats.values()].filter(x=>x.projectId===c.projectId).length);
    return{chats,counts};
  }
  async function createProject(name){
    const list=await fetchProjects(),existing=list.find(p=>norm(p.name)===norm(name));if(existing)return existing;
    const r=await rpc('/backend-api/projects',{method:'POST',body:{instructions:'',name,memory_scope:'unset'},timeout:20000});if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`create:${name}:${r.status||0}`);}
    for(let i=0;i<12;i++){await sleep(350);const fresh=await fetchProjects(),made=fresh.find(p=>norm(p.name)===norm(name));if(made)return made;}
    throw new Error(`create-unverified:${name}`);
  }
  async function moveChat(chatId,targetId){
    const expected=normalizePid(targetId),r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{gizmo_id:targetId||null},timeout:15000});
    if(r.status===429)throw new Error('rate-limited');if(!r.ok)return false;
    const direct=r.data&&Object.prototype.hasOwnProperty.call(r.data,'gizmo_id')?r.data.gizmo_id:r.data?.conversation_mode?.gizmo_id;
    const got=normalizePid(clean(direct||''));return !got||got===expected;
  }
  async function deleteIfEmpty(projectId){
    try{if((await fetchProjectChats(projectId)).length)return false;}catch{return false;}
    const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(projectId)}`,{method:'DELETE',timeout:18000});if(r.status===429)throw new Error('rate-limited');return !!r.ok;
  }

  function divergence(current,backup){
    const a=new Set((current||[]).map(p=>norm(p?.name)).filter(Boolean)),b=new Set((backup||[]).map(p=>norm(p?.name)).filter(Boolean));if(!a.size||!b.size)return 1;
    let same=0;for(const x of b)if(a.has(x))same++;return 1-same/Math.max(1,b.size);
  }
  function recoveryMaterial({rebuild,backup}){
    return !!(rebuild&&backup&&Array.isArray(backup.projects)&&backup.projects.length>=2&&Array.isArray(backup.chats)&&backup.chats.length);
  }
  function createdProjectIds(rebuild,projects=[]){
    const ids=new Set(Object.values(rebuild?.created||{}).map(normalizePid).filter(Boolean));
    // Older interrupted builds may have lost the created-id map while keeping the target
    // names in the plan. Resolve only names that did not exist in the pre-rebuild backup.
    const backupNames=new Set((rebuild?.plan?.oldProjects||[]).map(p=>norm(p?.name)).filter(Boolean));
    const targetNames=new Set((rebuild?.plan?.targets||[]).map(t=>norm(t?.name)).filter(n=>n&&!backupNames.has(n)));
    for(const p of projects){if(targetNames.has(norm(p?.name)))ids.add(normalizePid(p.id));}
    return ids;
  }
  function shouldRecoverLocal({rebuild,backup,gov,cache}){
    if(!recoveryMaterial({rebuild,backup}))return false;
    const createdIds=createdProjectIds(rebuild,cache?.projects||[]);if(!createdIds.size)return false;
    const currentIds=new Set((cache?.projects||[]).map(p=>normalizePid(p?.id)).filter(Boolean));let createdVisible=0;for(const id of createdIds)if(currentIds.has(id))createdVisible++;
    const core=(gov?.coreProjectIds||[]).length,locks=Object.keys(gov?.locks||{}).length,drift=divergence(cache?.projects||[],backup.projects);
    const guardRestored=!!document.documentElement.dataset.ng100CacheGuardRestored;
    return guardRestored||(createdVisible>0&&(core===0||drift>=0.12||locks>=6));
  }

  function remapLocks(gov,backup,targetByOldId){
    const oldChats=new Map((backup.chats||[]).filter(c=>c?.id).map(c=>[c.id,c])),kept={},quarantined={};const backupAt=Number(backup.at||0)||0;
    for(const [id,lock] of Object.entries(gov?.locks||{})){
      const old=oldChats.get(id),lockedPid=normalizePid(lock?.projectId||''),oldPid=normalizePid(old?.projectId||'');
      const predatesBackup=!backupAt||!Number(lock?.at)||Number(lock.at)<=backupAt+5000;
      const matchesOld=!!old&&(lockedPid===oldPid);
      if(old&&(predatesBackup||matchesOld))kept[id]={...lock,projectId:oldPid?targetByOldId.get(oldPid)||'':'',source:'manual',recoveredAt:Date.now()};
      else quarantined[id]=lock;
    }
    return{kept,quarantined};
  }

  async function recoverCore(){
    if(busy||!ready())return;busy=true;document.documentElement.dataset.ng100Recovery='1';let release=false;
    try{
      const raw=await chrome.storage.local.get([MARK_KEY,REBUILD_KEY,BACKUP_KEY,GOV_KEY,CACHE_KEY]);
      const ctx={mark:raw[MARK_KEY],rebuild:raw[REBUILD_KEY],backup:raw[BACKUP_KEY],gov:raw[GOV_KEY]||{},cache:raw[CACHE_KEY]||{}};
      if(!recoveryMaterial(ctx)){diagnostic('OK · aucun snapshot de récupération');release=true;document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));return;}
      const {backup,rebuild}=ctx;
      // A previous build could mark recovery done while the generated Projects were still
      // present. Never trust the marker alone: if local evidence is suspicious, verify the
      // live Project inventory before deciding that recovery is finished.
      const localSuspicion=shouldRecoverLocal(ctx);
      if(!localSuspicion&&!document.documentElement.dataset.ng100CacheGuardRestored){diagnostic('OK · aucune récupération nécessaire');release=true;document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));return;}
      attempts++;diagnostic(`VÉRIFICATION · structure antérieure (${backup.projects.length} Projects)`);

      let current=await fetchProjects();
      const liveCreated=createdProjectIds(rebuild,current),currentIds=new Set(current.map(p=>normalizePid(p.id)));
      const createdVisible=[...liveCreated].filter(id=>currentIds.has(id));
      const backupNames=new Set((backup.projects||[]).map(p=>norm(p?.name)).filter(Boolean));
      const extraTargets=current.filter(p=>!backupNames.has(norm(p.name))&&(rebuild?.plan?.targets||[]).some(t=>norm(t?.name)===norm(p.name)));
      if(!createdVisible.length&&!extraTargets.length){
        diagnostic('OK · structure serveur déjà restaurée');release=true;document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));return;
      }
      diagnostic(`RÉCUPÉRATION · ${createdVisible.length||extraTargets.length} Project(s) généré(s) encore présent(s)`);
      const currentByName=new Map(current.map(p=>[norm(p.name),p])),targetByOldId=new Map();
      for(let i=0;i<backup.projects.length;i++){
        if(!ready())throw new Error('paused');const old=backup.projects[i];if(!old?.id||!clean(old.name))continue;
        diagnostic(`RÉCUPÉRATION · Projects ${i+1}/${backup.projects.length} · ${clean(old.name)}`);
        let target=currentByName.get(norm(old.name));if(!target){target=await createProject(clean(old.name));currentByName.set(norm(target.name),target);current.push(target);}targetByOldId.set(normalizePid(old.id),target.id);
      }

      const oldChats=(backup.chats||[]).filter(c=>c?.id);const inventory=await liveInventory(current,oldChats.map(c=>c.id)),live=inventory.chats;let moved=0,failed=0;
      for(let i=0;i<oldChats.length;i+=4){
        if(!ready())throw new Error('paused');const batch=oldChats.slice(i,i+4);diagnostic(`RÉCUPÉRATION · chats ${i+1}-${Math.min(i+batch.length,oldChats.length)}/${oldChats.length}`);
        const results=await Promise.all(batch.map(async old=>{
          const row=live.get(old.id);if(!row)return{old,skip:true};const oldPid=normalizePid(old.projectId||''),target=oldPid?targetByOldId.get(oldPid)||'':'';
          if(normalizePid(row.projectId||'')===normalizePid(target))return{old,ok:true,unchanged:true,target};
          return{old,ok:await moveChat(old.id,target),target};
        }));
        for(const r of results){if(r.skip)continue;if(r.ok){if(!r.unchanged)moved++;const row=live.get(r.old.id);if(row)row.projectId=r.target;}else failed++;}if(failed)throw new Error(`move-failed:${failed}`);await sleep(80);
      }

      // Remove only Projects that the recorded AUTO REBUILD itself created, and only after
      // every backed-up chat has been restored and the Project is verified empty.
      current=await fetchProjects();const currentIdsAfter=new Set(current.map(p=>p.id)),restoredIds=new Set(targetByOldId.values()),deleted=[];
      for(const idRaw of liveCreated){
        const id=normalizePid(idRaw);if(!id||!currentIdsAfter.has(id)||restoredIds.has(id))continue;
        if(await deleteIfEmpty(id))deleted.push(id);
      }
      current=await fetchProjects();

      const oldById=new Map((backup.projects||[]).map(p=>[normalizePid(p.id),p]));
      const finalProjectById=new Map(current.map(p=>[p.id,p]));
      const finalChats=new Map();
      for(const row of live.values())finalChats.set(row.id,{...row,updated:parseTime(row.updated)});
      for(const old of oldChats){const row=finalChats.get(old.id)||{...old};const oldPid=normalizePid(old.projectId||''),target=oldPid?targetByOldId.get(oldPid)||'':'';row.projectId=target;row.updated=Math.max(parseTime(row.updated),parseTime(old.updated||old.update_time||old.create_time));row.title=clean(row.title||old.title)||'Conversation';row.snippet=clean(row.snippet||old.snippet||'');finalChats.set(old.id,row);}
      const counts={};for(const p of current)counts[p.id]=0;for(const c of finalChats.values())if(c.projectId&&counts[c.projectId]!=null)counts[c.projectId]++;
      const nextCache={schema:2,at:Date.now(),serverIndexedAt:Date.now(),projects:current,chats:[...finalChats.values()],counts,indexedProjectIds:current.map(p=>p.id)};

      const {kept,quarantined}=remapLocks(ctx.gov,backup,targetByOldId);
      const core=[];for(const old of backup.projects){if(isQueueName(old.name))continue;const id=targetByOldId.get(normalizePid(old.id));if(id&&finalProjectById.has(id))core.push(id);}
      const nextGov={...ctx.gov,seeded:true,seedVersion:3,manualCoreSelection:false,coreProjectIds:[...new Set(core)],hiddenProjectIds:[],locks:kept,recoveredAt:Date.now(),recoveryVersion:VERSION};
      const quarantineCount=Object.keys(quarantined).length;
      await chrome.storage.local.set({
        [CACHE_KEY]:nextCache,
        [GOV_KEY]:nextGov,
        [MARK_KEY]:{done:true,at:Date.now(),version:VERSION,moved,deleted:deleted.length,restoredProjects:targetByOldId.size,keptLocks:Object.keys(kept).length,quarantinedLocks:quarantineCount},
        [QUARANTINE_KEY]:{at:Date.now(),reason:'post-auto-rebuild-lock-sanitization',locks:quarantined}
      });
      try{localStorage.setItem('niakgpt-manual-locks-v085',JSON.stringify(kept));localStorage.setItem('niakgpt-governance-mirror-v0932',JSON.stringify(nextGov));}catch{}
      diagnostic(`OK · ${targetByOldId.size} Projects restaurés · ${moved} chats · ${Object.keys(kept).length} verrou(x) conservé(s)${quarantineCount?` · ${quarantineCount} ancien(s) isolé(s)`:''}`);
      release=true;document.dispatchEvent(new CustomEvent('niakgpt:recovery-complete',{detail:{projects:targetByOldId.size,moved,locks:Object.keys(kept).length,quarantined:quarantineCount}}));
      setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:force-server-index')),500);
    }catch(error){
      if(String(error?.message)==='paused'){diagnostic('PAUSE · récupération reprendra au repos');schedule(1200);}else if(String(error?.message)==='rate-limited'){attempts=Math.max(0,attempts-1);diagnostic('PAUSE · limite API ChatGPT · reprise automatique');}
      else{diagnostic(`ERREUR · ${String(error?.message||error).slice(0,100)}`);if(attempts<3)schedule(1800);else{release=true;document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));}}
    }finally{if(release)delete document.documentElement.dataset.ng100Recovery;busy=false;}
  }
  async function locked(){
    if(!ready())return;
    if(navigator.locks?.request){let acquired=false;await navigator.locks.request(DATA_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await recoverCore();});if(!acquired&&ready())schedule(900);return;}
    return recoverCore();
  }
  function schedule(delay=900){clearTimeout(timer);timer=setTimeout(locked,delay);}

  async function preflight(){
    if(preflightDone)return;
    if(document.documentElement.dataset.ng100CacheGuard==='pending'){setTimeout(preflight,80);return;}
    preflightDone=true;
    try{
      const raw=await chrome.storage.local.get([MARK_KEY,REBUILD_KEY,BACKUP_KEY,GOV_KEY,CACHE_KEY]);
      const ctx={mark:raw[MARK_KEY],rebuild:raw[REBUILD_KEY],backup:raw[BACKUP_KEY],gov:raw[GOV_KEY]||{},cache:raw[CACHE_KEY]||{}};
      if(!recoveryMaterial(ctx)){
        delete document.documentElement.dataset.ng100Recovery;
        diagnostic('OK · aucun snapshot de récupération');
        document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));
        return;
      }
      const localSuspicion=shouldRecoverLocal(ctx);
      if(!localSuspicion&&!document.documentElement.dataset.ng100CacheGuardRestored){
        delete document.documentElement.dataset.ng100Recovery;
        diagnostic('OK · aucune récupération nécessaire');
        document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));
        return;
      }
      // A real recovery is needed. Keep the gate only for that destructive path;
      // ordinary fresh installs must never block Project bootstrap behind activity state.
      document.documentElement.dataset.ng100Recovery='pending';
      diagnostic('ATTENTE · récupération structurelle au prochain repos');
      schedule(80);
    }catch(error){
      delete document.documentElement.dataset.ng100Recovery;
      diagnostic(`ERREUR PRÉ-VÉRIF · ${String(error?.message||error).slice(0,80)}`);
      document.dispatchEvent(new CustomEvent('niakgpt:recovery-ready'));
    }
  }

  document.addEventListener('niakgpt:cache-guard-ready',preflight,{once:true});
  document.addEventListener('niakgpt:activity-changed',()=>{if(preflightDone&&document.documentElement.dataset.ng100Recovery)schedule(250);});
  document.addEventListener('niakgpt:rate-limit-cleared',()=>{if(document.documentElement.dataset.ng100Recovery)schedule(250);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.documentElement.dataset.ng100Recovery)schedule(250);});
  document.addEventListener('niakgpt:tab-role-changed',()=>{if(document.documentElement.dataset.ng100Recovery)schedule(300);});
  preflight();
})();
