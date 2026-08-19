(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SERVER_INDEX_100__)return;
  window.__NIAKGPT_SERVER_INDEX_100__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const LOCK_NAME='niakgpt-data-mutation-v100';
  const FRESH_MS=30*60*1000;
  const PROJECT_FRESH_MS=10*60*1000;
  let busy=false,timer=0,rpcSeq=0,partialRetries=0,pendingDeep=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const listFrom=(data,...keys)=>{for(const key of keys)if(Array.isArray(data?.[key]))return data[key];return[];};
  const nextCursor=data=>data?.cursor??data?.next_cursor??data?.nextCursor??null;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const ratePaused=()=>Number(document.documentElement.dataset.ng100RateLimitedUntil||0)>Date.now();
  const nativeBusy=()=>document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')||document.documentElement.dataset.ng105Verification==='1';
  const projectReady=()=>document.documentElement.dataset.ng100CacheGuard!=='pending'&&!ratePaused()&&!document.hidden&&document.documentElement.dataset.ng90Safe!=='1'&&!document.documentElement.dataset.ng100Recovery&&!nativeBusy();
  const chatReady=()=>projectReady();

  function diagnostic(text){window.__NIAKGPT_DIAGNOSTICS__?.set('index-serveur',text);}
  function rpc(path,{method='GET',body=null,timeout=18000}={}){
    const id=`ng100-index-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timeoutId=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=event=>{if(event.detail?.id!==id)return;off();resolve(event.detail);};
      const off=()=>{clearTimeout(timeoutId);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }
  function projectFromRaw(raw){
    const g=raw?.gizmo?.gizmo||raw?.gizmo||raw,id=normalizePid(clean(g?.id||raw?.id)),name=clean(g?.display?.name||g?.name||raw?.display?.name);
    if(!id.startsWith('g-p-')||!name)return null;
    return{id,name,description:clean(g?.display?.description||g?.description||''),instructions:clean(g?.instructions||''),href:`/g/${id}/project`,domOnly:false};
  }
  function directProjectId(raw){const value=raw&&Object.prototype.hasOwnProperty.call(raw,'gizmo_id')?raw.gizmo_id:raw?.conversation_mode?.gizmo_id;return normalizePid(clean(value));}
  function chatFromRaw(raw,projectId=''){
    const id=clean(raw?.id||raw?.conversation_id);if(!id)return null;
    return{id,title:clean(raw?.title||raw?.conversation_title)||'Conversation',snippet:clean(raw?.snippet||''),projectId:normalizePid(projectId||directProjectId(raw)),updated:parseTime(raw?.update_time||raw?.create_time),href:''};
  }
  async function fetchProjects(){
    const found=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<100;page++){
      if(!projectReady())throw new Error('paused');
      const qs=new URLSearchParams({conversations_per_gizmo:'0'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`);if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`Projects ${r.status||0} · ${r.error||'erreur'}`);}
      for(const raw of listFrom(r.data,'items','projects','gizmos')){const p=projectFromRaw(raw);if(p)found.set(p.id,p);}
      const next=nextCursor(r.data);if(next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;await sleep(35);
    }
    return[...found.values()];
  }
  async function fetchProjectChats(project){
    const out=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<250;page++){
      if(!chatReady())throw new Error('paused');
      const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?${qs}`);if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`${project.name} · ${r.status||0}`);}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const c=chatFromRaw(raw,project.id);if(c)out.set(c.id,c);}
      const next=nextCursor(r.data);if(!items.length||next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;await sleep(45);
    }
    return[...out.values()];
  }
  async function fetchGeneral(){
    const out=new Map();let offset=0;
    for(let page=0;page<100;page++){
      if(!chatReady())throw new Error('paused');
      const qs=new URLSearchParams({offset:String(offset),limit:'100',order:'updated'}),r=await rpc(`/backend-api/conversations?${qs}`);
      if(!r.ok){if(r.status===429)throw new Error('rate-limited');throw new Error(`Conversations ${r.status||0} · ${r.error||'erreur'}`);}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const c=chatFromRaw(raw);if(c)out.set(c.id,c);}
      if(!items.length)break;offset+=items.length;if(!(r.data?.has_more===true||r.data?.hasMore===true)&&items.length<100)break;await sleep(55);
    }
    return[...out.values()];
  }
  async function readCache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function publishProjectsEarly(before,projects){
    if(!projects?.length)return;
    const bus=window.__NIAKGPT_CACHE_BUS__;
    const merge=latest=>{
      latest=latest&&typeof latest==='object'?latest:(before||{});
      const merged=new Map((latest.projects||[]).filter(p=>p?.id).map(p=>[p.id,{...p}]));
      for(const p of projects){const old=merged.get(p.id)||{};merged.set(p.id,{...old,...p,domOnly:false,href:`/g/${p.id}/project`});}
      return{...latest,schema:2,projects:[...merged.values()],projectInventoryAt:Date.now(),at:Date.now()};
    };
    try{if(bus?.update)await bus.update(merge);else await chrome.storage.local.set({[CACHE_KEY]:merge(before)});document.dispatchEvent(new CustomEvent('niakgpt:server-projects-ready',{detail:{projects:projects.length}}));}catch{}
  }
  function needsIndex(raw,force=false){
    if(force)return true;
    const server=(raw.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly).length,dated=(raw.chats||[]).filter(c=>parseTime(c?.updated||c?.update_time||c?.create_time)).length,last=Number(raw.serverIndexedAt||0)||0;
    const polluted=(raw.projects||[]).some(p=>p?.domOnly&&(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(clean(p.name))||String(p.id||'').startsWith('dom-p-')));
    return polluted||!last||Date.now()-last>FRESH_MS||server===0||((raw.chats||[]).length>5&&dated===0);
  }
  async function indexNow(force=false){
    if(busy||!projectReady())return;busy=true;
    try{
      let before=await readCache();if(!needsIndex(before,force)){diagnostic(`OK · index serveur récent · ${(before.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly).length} Projects`);return;}
      const cachedProjects=(before.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly);
      const inventoryFresh=Number(before.projectInventoryAt||0)>0&&Date.now()-Number(before.projectInventoryAt)<PROJECT_FRESH_MS&&cachedProjects.length>0;
      let projects=cachedProjects;
      if(!inventoryFresh){
        diagnostic('INDEX · inventaire Projects');
        projects=await fetchProjects();if(!projects.length)throw new Error('aucun Project serveur retourné');
        // 0.9.51: never hit ChatGPT's undocumented Project APIs while a response, native
        // verification, or generation is active. Cached Projects remain visible immediately;
        // background refresh resumes on the next activity-ready event.
        await publishProjectsEarly(before,projects);
        before=await readCache();
      }
      diagnostic(`PROJECTS PRÊTS · ${projects.length} · conversations en arrière-plan`);
      if(!chatReady()){
        pendingDeep=true;
        diagnostic(`PROJECTS PRÊTS · ${projects.length} · chats en pause activité · reprise événementielle`);
        return;
      }
      pendingDeep=false;
      const projectMap=new Map((before.projects||[]).filter(p=>p?.id&&String(p.id).startsWith('g-p-')&&!p.domOnly).map(p=>[p.id,{...p}]));for(const p of projects){const old=projectMap.get(p.id)||{};projectMap.set(p.id,{...old,...p,domOnly:false,href:`/g/${p.id}/project`});}
      const chats=new Map((before.chats||[]).filter(c=>c?.id).map(c=>[c.id,{...c,updated:parseTime(c.updated||c.update_time||c.create_time)}]));
      const seenIds=new Set();
      const counts={};for(const [id,count] of Object.entries(before.counts||{}))if(String(id).startsWith('g-p-'))counts[id]=count;
      const indexed=new Set((Array.isArray(before.indexedProjectIds)?before.indexedProjectIds:[]).filter(id=>String(id).startsWith('g-p-')));let failures=0;
      for(let i=0;i<projects.length;i++){
        if(!chatReady())throw new Error('paused');const p=projects[i];diagnostic(`INDEX · ${i+1}/${projects.length} · ${p.name}`);
        try{const list=await fetchProjectChats(p);counts[p.id]=list.length;indexed.add(p.id);for(const c of list){seenIds.add(c.id);const old=chats.get(c.id)||{};chats.set(c.id,{...old,...c,projectId:p.id,updated:Math.max(parseTime(old.updated),c.updated||0)});}}catch(error){if(['paused','rate-limited'].includes(String(error?.message)))throw error;failures++;}
        await sleep(35);
      }
      diagnostic('INDEX · conversations générales');
      try{for(const c of await fetchGeneral()){seenIds.add(c.id);const old=chats.get(c.id)||{},projectId=c.projectId||old.projectId||'';chats.set(c.id,{...old,...c,projectId,updated:Math.max(parseTime(old.updated),c.updated||0),snippet:c.snippet||old.snippet||''});}}catch(error){if(['paused','rate-limited'].includes(String(error?.message)))throw error;failures++;}
      const freshProjectIds=new Set(projects.map(p=>p.id));
      // Never treat one undocumented API inventory as destructive truth. ChatGPT can return
      // a short/partial Project or conversation page under load without an explicit error.
      // Preserve previously known server Projects/chats and only enrich/overwrite records
      // that were actually observed in this run.
      const beforeServerProjects=(before.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly).length;
      const beforeChats=(before.chats||[]).filter(c=>c?.id).length;
      const beforeDated=(before.chats||[]).filter(c=>parseTime(c?.updated||c?.update_time||c?.create_time)).length;
      const freshDated=[...chats.values()].filter(c=>seenIds.has(c.id)&&parseTime(c.updated)).length;
      const suspiciousProjectDrop=beforeServerProjects>=4&&projects.length<beforeServerProjects;
      const suspiciousChatDrop=beforeChats>=30&&seenIds.size<Math.floor(beforeChats*.65);
      const suspiciousDates=beforeDated>=20&&freshDated<Math.floor(beforeDated*.45);
      const partial=failures>0||suspiciousProjectDrop||suspiciousChatDrop||suspiciousDates;
      const finalChats=[...chats.values()];
      const next={...before,schema:2,projectInventoryAt:Number(before.projectInventoryAt)||Date.now(),serverIndexedAt:partial?(Number(before.serverIndexedAt)||0):Date.now(),projects:[...projectMap.values()],chats:finalChats,counts,indexedProjectIds:[...new Set([...(before.indexedProjectIds||[]),...indexed])].filter(id=>String(id).startsWith('g-p-'))};
      const bus=window.__NIAKGPT_CACHE_BUS__;
      if(bus?.update){
        await bus.update(latest=>{
          latest=latest&&typeof latest==='object'?latest:{};
          const mergedChats=new Map((latest.chats||[]).filter(c=>c?.id).map(c=>[c.id,{...c,updated:parseTime(c.updated||c.update_time||c.create_time)}]));
          for(const c of next.chats||[]){const old=mergedChats.get(c.id)||{};mergedChats.set(c.id,{...old,...c,projectId:c.projectId||old.projectId||'',updated:Math.max(parseTime(old.updated),parseTime(c.updated)),snippet:c.snippet||old.snippet||''});}
          const mergedProjects=new Map((latest.projects||[]).filter(p=>p?.id).map(p=>[p.id,{...p}]));for(const p of next.projects||[]){if(!p?.id)continue;const old=mergedProjects.get(p.id)||{};mergedProjects.set(p.id,{...old,...p,domOnly:old.domOnly===false?false:p.domOnly});}
          return{...latest,...next,projects:[...mergedProjects.values()],chats:[...mergedChats.values()],counts:{...(latest.counts||{}),...next.counts},indexedProjectIds:[...new Set([...(latest.indexedProjectIds||[]),...(next.indexedProjectIds||[])])],serverIndexedAt:Math.max(Number(latest.serverIndexedAt)||0,Number(next.serverIndexedAt)||0)};
        });
      }else await chrome.storage.local.set({[CACHE_KEY]:{...next,at:Date.now()}});
      const dated=[...chats.values()].filter(c=>c.updated).length;
      if(partial){
        diagnostic(`PARTIEL PRÉSERVÉ · API ${projects.length} Projects / ${seenIds.size} chats · cache conservé ${projectMap.size}/${chats.size}`);
        document.dispatchEvent(new CustomEvent('niakgpt:server-index-partial',{detail:{projects:projects.length,seen:seenIds.size,cachedProjects:projectMap.size,cachedChats:chats.size,failures}}));
        if(partialRetries<2){partialRetries++;if(chatReady())schedule(30000,true);else pendingDeep=true;}
      }else{
        partialRetries=0;diagnostic(`OK · ${projects.length} Projects · ${chats.size} chats · ${dated} datés`);
        document.dispatchEvent(new CustomEvent('niakgpt:server-indexed',{detail:{projects:projects.length,chats:chats.size,dated,failures:0}}));
      }
    }catch(error){if(String(error?.message)==='paused'){pendingDeep=true;diagnostic('PAUSE · reprise événementielle à la prochaine fenêtre disponible');}else if(String(error?.message)==='rate-limited'){diagnostic('PAUSE · limite API ChatGPT · reprise automatique');}else diagnostic(`ERREUR · ${String(error?.message||error).slice(0,100)}`);}finally{busy=false;}
  }
  async function locked(force=false){
    if(!projectReady())return;
    if(navigator.locks?.request){
      let acquired=false;
      await navigator.locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await indexNow(force);});
      if(!acquired&&projectReady())schedule(500,force);
      return;
    }
    return indexNow(force);
  }
  function schedule(delay=900,force=false){clearTimeout(timer);timer=setTimeout(()=>locked(force),delay);}
  document.addEventListener('niakgpt:cache-guard-ready',()=>schedule(40,true));document.addEventListener('niakgpt:force-server-index',()=>schedule(0,true));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(250,true));
  document.addEventListener('niakgpt:tab-role-changed',()=>schedule(500,false));
  document.addEventListener('niakgpt:activity-changed',event=>{if(event.detail?.active===false||chatReady()){const force=pendingDeep;pendingDeep=false;schedule(250,force);}});document.addEventListener('niakgpt:rate-limit-cleared',()=>schedule(450,true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){const force=pendingDeep&&chatReady();if(force)pendingDeep=false;schedule(700,force);}});
  window.addEventListener('popstate',()=>schedule(900,false));
  schedule(80,false);
})();