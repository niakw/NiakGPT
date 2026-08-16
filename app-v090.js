(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_APP_090__) return;
  window.__NIAKGPT_APP_090__ = true;

  const VERSION = (() => { try { return chrome.runtime.getManifest().version || '0.9.6'; } catch { return '0.9.6'; } })();
  const CACHE_KEY = 'niakgpt-v08-cache';
  const GOV_KEY = 'niakgpt-governance-v085';
  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"]:not([href*="/c/"])';
  const PROJECT_CHAT_SEL = 'a[href^="/g/g-p-"][href*="/c/"]';
  const OWN = '#ng8-rail,#ng8-panel,#ng8-status,#ng8-coach,#ng8-pins,#ng8-quick,#ng90-control,.ng8-bot';
  const LEGACY = new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development']);
  const COLORS = ['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185','#38BDF8','#34D399','#F59E0B'];
  const STOP = new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut').split(/\s+/));

  const S = {
    projects:[], projectById:new Map(), chats:[], chatById:new Map(), projectChats:new Map(), counts:new Map(), duplicates:new Map(),
    health:{bridge:'PRÊT',data:'CACHE',projects:'CACHE',quick:'PRÊT',coach:'INACTIF',toc:'INACTIF',performance:'PRÊT',matrix:'INACTIF',ui:'PRÊT'},
    errors:[], panelOpen:false, tab:'explorer', queue:[], queueTimer:0, indexing:false, indexComplete:false, generalLoaded:false,
    mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, sidebarNeedsPins:false, scanTimer:0, scanToken:0, scanRunning:false, scanRequested:false, diagTimer:0,
    cacheSaveTimer:0, lastCacheWriteAt:0, lastPath:location.pathname, projectsRefreshed:false, refreshingProjects:false,
    pendingMain:new Set(), turns:[], turnSeen:new WeakSet(), codeSeen:new WeakSet(), codeCount:0, turnTimeline:[], turnTimeById:new Map(), timelineRequestedFor:'',
    matrix:null, matrixCtx:null, matrixTimer:0, matrixResize:null, matrixCols:[], matrixW:0, matrixH:0,
    governance:{coreProjectIds:[],hiddenProjectIds:[]}, cacheLoaded:false, serverIndexedAt:0
  };

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const cleanProjectLabel = v => String(v || '').replace(/\s+/g,' ').trim().replace(/^(?:ouvrir|open)\s+(?:le\s+)?projet\s+/i,'').replace(/^(?:projet|project)\s*[:·-]\s*/i,'');
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const parseTime = v => { if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0; };
  const normalizePid = v => { if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([a-z0-9]+)(?:-.+)?$/i);return m?`g-p-${m[1]}`:s; };
  const pidFromHref = h => { const m=String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i);return m?normalizePid(m[1]):''; };
  const cidFromHref = h => String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const currentChatId = () => cidFromHref(location.pathname);
  const currentProjectIdFromPath = () => pidFromHref(location.pathname);
  const colorFor = name => { let h=0;for(const c of String(name))h=((h<<5)-h+c.charCodeAt(0))|0;return COLORS[Math.abs(h)%COLORS.length]; };
  const iconFor = name => { const s=norm(name);if(/code|dev|tech|web|api|github|program|provider/.test(s))return'</>';if(/legal|jurid|droit|prud|tribunal|justice/.test(s))return'§';if(/finance|argent|budget|banque|credit|compta/.test(s))return'€';if(/film|cinema|movie|serie|anime|video/.test(s))return'▶';if(/design|logo|image|creative|graph/.test(s))return'◇';if(/shop|commerce|store|product|produit|vente/.test(s))return'▣';if(/(^|\s)(ai|ia|gpt)(\s|$)/.test(s))return'✦';if(/auto|car|voiture|vehicule/.test(s))return'◈';if(/health|sante|medical/.test(s))return'+';if(/game|gaming|jeu/.test(s))return'◆';if(/food|cuisine|recette/.test(s))return'◌';if(/social|relation|perso/.test(s))return'◎';return'▤'; };

  function role(){ return document.documentElement.dataset.ng8TabRole || 'unknown'; }
  function activity(){ return document.documentElement.dataset.ng86Activity || 'ready'; }
  function safeMode(){ return document.documentElement.dataset.ng90Safe === '1'; }
  function enabled(name, fallback=true){ const v=document.documentElement.dataset[name];return v==null||v===''?fallback:v==='on'; }
  function canBackground(){ return role()==='worker'&&!document.hidden&&!safeMode()&&activity()==='ready'; }
  function error(scope,e){ S.errors.unshift(`${scope}: ${String(e?.message||e).slice(0,180)}`);S.errors=S.errors.slice(0,12);renderPanelIfDiag(); }
  function health(key,value){ if(S.health[key]===value)return;S.health[key]=value;renderPanelIfDiag(); }

  let rpcSeq=0;
  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng90-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body}}));
    });
  }

  function projectFromRaw(raw){
    const g=raw?.gizmo?.gizmo||raw?.gizmo||raw;
    const id=normalizePid(g?.id||raw?.id||'');
    const name=String(g?.display?.name||g?.name||raw?.display?.name||'').trim();
    if(!id.startsWith('g-p-')||!name)return null;
    return{id,name,description:String(g?.display?.description||g?.description||''),instructions:String(g?.instructions||''),color:colorFor(name),icon:iconFor(name),href:`/g/${id}/project`,duplicateOf:''};
  }
  function chatFromRaw(raw,pid=''){
    const id=String(raw?.id||raw?.conversation_id||'');if(!id)return null;
    const direct=raw&&Object.prototype.hasOwnProperty.call(raw,'gizmo_id')?raw.gizmo_id:raw?.conversation_mode?.gizmo_id;return{id,title:String(raw?.title||raw?.conversation_title||'Conversation sans titre'),projectId:normalizePid(pid||direct||''),snippet:String(raw?.snippet||''),updated:parseTime(raw?.update_time||raw?.create_time),href:''};
  }
  const isServerProject=p=>!!p&&String(p.id||'').startsWith('g-p-')&&!p.domOnly;
  const canonicalProjectHref=p=>{const id=normalizePid(p?.id||'');return id.startsWith('g-p-')?`/g/${id}/project`:'';};
  function canonicalProjectId(id){
    const p=S.projectById.get(id);if(!p?.domOnly)return id||'';const key=norm(p.name),server=S.projects.find(x=>isServerProject(x)&&norm(x.name)===key);return server?.id||id||'';
  }
  function upsertProject(p){
    if(!p?.id)return;
    if(String(p.id).startsWith('g-p-'))p={...p,id:normalizePid(p.id),href:canonicalProjectHref(p),domOnly:false};
    const old=S.projectById.get(p.id),next={...old,...p,color:p.color||old?.color||colorFor(p.name),icon:p.icon||old?.icon||iconFor(p.name)};
    S.projectById.set(p.id,next);
    const i=S.projects.findIndex(x=>x.id===p.id);if(i<0)S.projects.push(next);else S.projects[i]=next;
    if(isServerProject(next)){
      const key=norm(next.name),twins=S.projects.filter(x=>x.id!==next.id&&x.domOnly&&norm(x.name)===key);
      if(twins.length){const ids=new Set(twins.map(x=>x.id));for(const c of S.chats)if(ids.has(c.projectId))c.projectId=next.id;for(const twin of twins){S.projectById.delete(twin.id);const j=S.projects.findIndex(x=>x.id===twin.id);if(j>=0)S.projects.splice(j,1);}}
    }
  }
  function upsertChat(c){
    if(!c?.id)return;
    const old=S.chatById.get(c.id),rawProjectId=c.projectId||old?.projectId||'',projectId=canonicalProjectId(rawProjectId),next={...old,...c,projectId,updated:Math.max(old?.updated||0,c.updated||0),href:c.href||old?.href||''};
    S.chatById.set(c.id,next);
    const i=S.chats.findIndex(x=>x.id===c.id);if(i<0)S.chats.push(next);else S.chats[i]=next;
  }
  function serialize(){ return{schema:2,at:Date.now(),serverIndexedAt:S.serverIndexedAt||0,projects:S.projects,chats:S.chats,counts:Object.fromEntries(S.counts),indexedProjectIds:[...S.projectChats.keys()]}; }
  async function saveCache(){
    clearTimeout(S.cacheSaveTimer);S.cacheSaveTimer=0;
    const payload=serialize(),bus=window.__NIAKGPT_CACHE_BUS__;
    try{
      if(bus?.update){
        const written=await bus.update(latest=>{
          latest=latest&&typeof latest==='object'?latest:{};
          const staleAgainstServer=(Number(latest.serverIndexedAt)||0)>(Number(payload.serverIndexedAt)||0);
          const projects=new Map((latest.projects||[]).map(p=>[p.id,{...p}]));
          for(const incoming of payload.projects||[]){if(!incoming?.id||(staleAgainstServer&&!projects.has(incoming.id)))continue;const old=projects.get(incoming.id)||{};projects.set(incoming.id,{...old,...incoming,domOnly:old.domOnly===false?false:incoming.domOnly});}
          const chats=new Map((latest.chats||[]).map(c=>[c.id,{...c}]));
          for(const incoming of payload.chats||[]){if(!incoming?.id||(staleAgainstServer&&!chats.has(incoming.id)))continue;const old=chats.get(incoming.id)||{};chats.set(incoming.id,{...old,...incoming,projectId:old.projectId||incoming.projectId||'',updated:Math.max(Number(old.updated)||0,Number(incoming.updated)||0),snippet:incoming.snippet||old.snippet||''});}
          return{...latest,...payload,projects:[...projects.values()],chats:[...chats.values()],counts:{...(payload.counts||{}),...(latest.counts||{})},indexedProjectIds:[...new Set([...(latest.indexedProjectIds||[]),...(payload.indexedProjectIds||[])])],serverIndexedAt:Math.max(Number(latest.serverIndexedAt)||0,Number(payload.serverIndexedAt)||0)};
        });
        S.lastCacheWriteAt=written?.at||0;
      }else{await chrome.storage.local.set({[CACHE_KEY]:payload});S.lastCacheWriteAt=payload.at;}
    }catch{}
  }
  function saveCacheSoon(delay=1600){
    clearTimeout(S.cacheSaveTimer);S.cacheSaveTimer=setTimeout(()=>{
      S.cacheSaveTimer=0;
      if(activity()!=='ready'){saveCacheSoon(1200);return;}
      saveCache();
    },delay);
  }
  async function loadGovernance(){ try{const g=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY];if(g)S.governance={...S.governance,...g};}catch{} }
  async function loadCache(rawOverride){
    try{
      const bus=window.__NIAKGPT_CACHE_BUS__;
      const raw=rawOverride!==undefined?rawOverride:(bus?await bus.get():null);
      if(raw){
        S.projects=[];S.projectById.clear();for(const p of raw.projects||[])upsertProject(p);
        S.chats=[];S.chatById.clear();for(const c of raw.chats||[])upsertChat(c);
        const legacyProjectIds=Object.keys(raw.projectChats||{});
        for(const [pid,list] of Object.entries(raw.projectChats||{}))for(const c of list||[])upsertChat({...c,projectId:c.projectId||pid});
        S.counts=new Map(Object.entries(raw.counts||{}));S.serverIndexedAt=Number(raw.serverIndexedAt||0)||0;
        const indexed=new Set([...(Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]),...legacyProjectIds]);
        S.projectChats.clear();for(const pid of indexed)S.projectChats.set(pid,new Map());
        for(const c of S.chats){const m=S.projectChats.get(c.projectId);if(m)m.set(c.id,c);}
      }
      S.cacheLoaded=true;buildDuplicates();
      health('data',`CACHE · ${S.projects.length} Projects · ${S.chats.length} chats`);
      health('projects',S.projects.length?`CACHE · ${S.projects.length} Projects`:'PRÊT · index vide');
      health('quick',`PRÊT · ${S.projects.length+S.chats.length} entrées`);
    }catch(e){error('cache',e);health('data','ERREUR · cache');}
  }

  function projectRecency(id){ let t=0;for(const c of S.chats)if(c.projectId===id)t=Math.max(t,c.updated||0);return t; }
  function buildDuplicates(){
    S.duplicates.clear();
    for(const p of S.projects){p.duplicateOf='';const k=norm(p.name);if(!S.duplicates.has(k))S.duplicates.set(k,[]);S.duplicates.get(k).push(p);}
    for(const group of S.duplicates.values()){
      if(group.length<2)continue;
      group.sort((a,b)=>(isServerProject(b)?1:0)-(isServerProject(a)?1:0)||(Number(S.counts.get(b.id))||0)-(Number(S.counts.get(a.id))||0)||projectRecency(b.id)-projectRecency(a.id));
      const keep=group[0];for(const p of group)if(p.id!==keep.id)p.duplicateOf=keep.id;
    }
  }
  function isQueueProject(p){return !!p&&['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify'].includes(norm(p.name));}
  function isLegacy(p){ return !!p&&(LEGACY.has(norm(p.name))||isQueueProject(p)); }
  function visibleProjects(){ const hidden=new Set(S.governance.hiddenProjectIds||[]);return S.projects.filter(p=>isServerProject(p)&&!isQueueProject(p)&&!hidden.has(p.id)&&!p.duplicateOf); }
  function sortedProjects(){
    const core=new Set(S.governance.coreProjectIds||[]);
    return visibleProjects().sort((a,b)=>(core.has(b.id)?1:0)-(core.has(a.id)?1:0)||projectRecency(b.id)-projectRecency(a.id)||a.name.localeCompare(b.name,'fr'));
  }
  const listFrom = (data,...keys) => { for(const key of keys){if(Array.isArray(data?.[key]))return data[key];}return[]; };
  const nextCursor = data => data?.cursor ?? data?.next_cursor ?? data?.nextCursor ?? null;

  async function fetchProjects(){
    const found=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<100;page++){
      if(!canBackground())throw new Error('paused');
      const qs=new URLSearchParams({conversations_per_gizmo:'0'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`);
      if(!r.ok)throw new Error(`${r.status||0} · ${r.error||'projects_error'}`);
      for(const raw of listFrom(r.data,'items','projects','gizmos')){const p=projectFromRaw(raw);if(p)found.set(p.id,p);}
      const next=nextCursor(r.data);if(next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;
    }
    return[...found.values()];
  }
  async function fetchProjectChats(project){
    const out=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<250;page++){
      if(!canBackground())throw new Error('paused');
      const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?${qs}`);
      if(!r.ok)throw new Error(`${r.status||0} · ${r.error||'project_chats_error'}`);
      const items=listFrom(r.data,'items','conversations');
      for(const raw of items){const c=chatFromRaw(raw,project.id);if(c)out.set(c.id,c);}
      const next=nextCursor(r.data);if(!items.length||next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;await sleep(70);
    }
    return[...out.values()];
  }
  async function fetchGeneralBestEffort(){
    if(!canBackground()||S.generalLoaded)return;
    let offset=0;
    for(let page=0;page<100;page++){
      if(!canBackground())return;
      const qs=new URLSearchParams({offset:String(offset),limit:'100',order:'updated'});
      const r=await rpc(`/backend-api/conversations?${qs}`);
      if(!r.ok){error('general',`${r.status||0} · ${r.error||'error'}`);return;}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const c=chatFromRaw(raw);if(c)upsertChat(c);}
      if(!items.length)break;offset+=items.length;if(!(r.data?.has_more===true||r.data?.hasMore===true)&&items.length<100)break;await sleep(90);
    }
    S.generalLoaded=true;await saveCache();decorateSidebar();health('quick',`OK · ${S.projects.length+S.chats.length} entrées`);
  }

  function scheduleIndex(delay=120){
    clearTimeout(S.queueTimer);S.queueTimer=0;
    if(!canBackground())return;
    S.queueTimer=setTimeout(()=>{
      S.queueTimer=0;if(!canBackground())return;
      if('requestIdleCallback'in window)requestIdleCallback(()=>runOneIndex(),{timeout:2600});else runOneIndex();
    },delay);
  }
  async function refreshProjects(){
    if(S.refreshingProjects||!canBackground())return;
    S.refreshingProjects=true;
    try{
      health('projects','INDEXATION · Projects');
      const list=await fetchProjects();for(const p of list)upsertProject(p);buildDuplicates();
      S.projectsRefreshed=true;S.indexComplete=false;
      S.queue=S.projects.filter(p=>!S.projectChats.has(p.id)||S.counts.get(p.id)==null);
      health('bridge','OK');health('projects',`OK · ${S.projects.length} Projects`);decorateSidebar();renderPanel();await saveCache();scheduleIndex(60);
    }catch(e){if(String(e?.message)!=='paused'){error('projects',e);health('projects',`ERREUR · ${String(e?.message||e).slice(0,80)}`);}}
    finally{S.refreshingProjects=false;}
  }
  async function runOneIndex(){
    if(S.indexing||!canBackground())return;
    if(!S.queue.length){
      if(!S.indexComplete){S.indexComplete=true;health('data',`OK · ${S.projects.length} Projects · ${S.chats.length} chats`);await saveCache();decorateSidebar();if(S.panelOpen)renderPanel();setTimeout(()=>{if(canBackground())fetchGeneralBestEffort();},1800);}return;
    }
    S.indexing=true;const p=S.queue.shift();
    try{
      const list=await fetchProjectChats(p),map=new Map();for(const c of list){map.set(c.id,c);upsertChat(c);}S.projectChats.set(p.id,map);S.counts.set(p.id,map.size);buildDuplicates();
      health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);saveCacheSoon();
    }catch(e){if(String(e?.message)==='paused')S.queue.unshift(p);else{S.counts.set(p.id,null);error(`project:${p.name}`,e);saveCacheSoon();}}
    finally{S.indexing=false;if(canBackground())scheduleIndex(S.queue.length?260:100);}
  }

  function navRoot(){ return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(CHAT_SEL)||x.querySelector(PROJECT_SEL))||document.querySelector('nav')||null; }
  function mergeDOM(){
    const root=navRoot();if(!root)return;
    for(const a of root.querySelectorAll(PROJECT_SEL)){
      if(a.closest(OWN))continue;const id=pidFromHref(a.getAttribute('href'));if(!id)continue;
      const known=S.projectById.get(id);if(!known&&S.serverIndexedAt>0)continue;
      const domName=cleanProjectLabel(a.querySelector('.truncate span')?.textContent||a.textContent||a.getAttribute('aria-label')||''),name=cleanProjectLabel(known?.name)||domName;
      if(name)upsertProject({id,name,color:known?.color||colorFor(name),icon:known?.icon||iconFor(name),href:`/g/${id}/project`,duplicateOf:known?.duplicateOf||'',domOnly:false});
    }
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(a.closest(OWN))continue;const id=cidFromHref(a.getAttribute('href'));if(!id)continue;const old=S.chatById.get(id),title=old?.title||(a.getAttribute('aria-label')||a.querySelector('.truncate span')?.textContent||a.textContent||id).trim();
      // A PATCH can move a chat before React refreshes the sidebar href. Never let a
      // stale DOM route overwrite the verified cache/server assignment.
      upsertChat({id,title,projectId:old?.projectId||pidFromHref(a.getAttribute('href'))||'',snippet:old?.snippet||'',updated:old?.updated||0,href:a.getAttribute('href')||old?.href||''});
    }
  }
  function decorateSidebar(renderManaged=true){
    const root=navRoot();if(!root)return;mergeDOM();buildDuplicates();
    const currentCid=currentChatId(),currentPid=currentProject();
    let z=0;
    for(const a of root.querySelectorAll(PROJECT_SEL)){
      if(a.closest(OWN))continue;const id=pidFromHref(a.getAttribute('href')),p=S.projectById.get(id);if(!id||!p)continue;
      a.dataset.ng8Project='1';a.dataset.ng8Icon=p.icon;a.style.setProperty('--ng-project',p.color);a.classList.toggle('ng8-legacy',isLegacy(p));a.classList.toggle('ng8-duplicate',!!p.duplicateOf);a.classList.toggle('ng8-current',currentPid?.id===id);
    }
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(a.closest(OWN))continue;const id=cidFromHref(a.getAttribute('href'));if(!id)continue;const c=S.chatById.get(id),p=S.projectById.get(c?.projectId||pidFromHref(a.getAttribute('href')));
      a.dataset.ng8Chat='1';a.dataset.ng8Zebra=String(z++%2);if(p)a.style.setProperty('--ng-project',p.color);a.classList.toggle('ng8-current',id===currentCid);
      let badge=a.querySelector(':scope > .ng8-chat-project');
      if(p&&!badge){badge=document.createElement('span');badge.className='ng8-chat-project';a.appendChild(badge);}if(badge){if(p){badge.textContent=p.name;badge.style.setProperty('--ng-project',p.color);}else badge.remove();}
      dedupeChatTitle(a);
    }
    if(renderManaged)renderPins();
  }
  function dedupeChatTitle(anchor){
    if(!(anchor instanceof HTMLElement))return;
    anchor.querySelectorAll('[data-ng8-title-duplicate="1"]').forEach(el=>delete el.dataset.ng8TitleDuplicate);
    const own='.ng8-chat-date,.ng8-chat-project,.ng85-manual-lock,.ng8-project-meta,.ng100-out-badge,.ng100-continue';
    const leaves=[...anchor.querySelectorAll('span,div')].filter(el=>{
      if(el.matches(own)||el.closest(own))return false;
      if(el.querySelector('span,div'))return false;
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();return text.length>=3&&text.length<=180;
    });
    const groups=new Map();
    for(const el of leaves){const key=norm(el.textContent);if(!key)continue;(groups.get(key)||groups.set(key,[]).get(key)).push(el);}
    for(const group of groups.values()){
      if(group.length<2)continue;
      const visible=group.filter(el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;});
      const list=visible.length>1?visible:group;
      const canonical=list.find(el=>el.closest('.truncate'))||list[0];
      for(const el of list)if(el!==canonical)el.dataset.ng8TitleDuplicate='1';
    }
  }
  function nativeProjectSection(root,anchor){
    let node=anchor,best=null;
    while(node?.parentElement&&node.parentElement!==root){
      const parent=node.parentElement;
      const projectRows=parent.querySelectorAll(PROJECT_SEL).length;
      const projectChats=parent.querySelectorAll(PROJECT_CHAT_SEL).length;
      const genericChats=[...parent.querySelectorAll(CHAT_SEL)].filter(a=>!a.matches(PROJECT_CHAT_SEL)&&!a.closest('#ng8-pins')).length;
      const headings=[...parent.querySelectorAll(':scope > h2,:scope > h3,:scope > [role="heading"],:scope > div > h2,:scope > div > h3')];
      if(headings.some(h=>/^(projets?|projects?)$/i.test(String(h.textContent||'').replace(/\s+/g,' ').trim()))&&genericChats===0)return parent;
      if(projectRows>=1&&(projectChats>=1||projectRows>=2)&&genericChats===0)best=parent;
      node=parent;
    }
    return best;
  }
  function syncNativeProjectSection(root,box,active){
    root.querySelectorAll('.ng8-native-projects-suppressed,.ng8-native-project-link-suppressed,.ng8-native-project-chat-suppressed,.ng8-native-project-label-suppressed,.ng8-native-project-more-suppressed').forEach(el=>el.classList.remove('ng8-native-projects-suppressed','ng8-native-project-link-suppressed','ng8-native-project-chat-suppressed','ng8-native-project-label-suppressed','ng8-native-project-more-suppressed'));
    if(!active)return;
    const groups=new Set();
    const nativeLinks=[...root.querySelectorAll(PROJECT_SEL)].filter(a=>!a.closest('#ng8-pins')&&!a.closest(OWN));
    const nativeProjectChats=[...root.querySelectorAll(PROJECT_CHAT_SEL)].filter(a=>!a.closest('#ng8-pins')&&!a.closest(OWN));
    for(const a of nativeLinks){
      a.classList.add('ng8-native-project-link-suppressed');
      const host=nativeProjectSection(root,a);
      if(host&&!host.contains(box))groups.add(host);
    }
    for(const a of nativeProjectChats)a.classList.add('ng8-native-project-chat-suppressed');
    for(const label of root.querySelectorAll('h1,h2,h3,[role="heading"],div,span')){
      if(label.closest('#ng8-pins')||label.closest(OWN))continue;
      const text=String(label.textContent||'').replace(/\s+/g,' ').trim();
      if(!/^(projets?|projects?)$/i.test(text))continue;
      label.classList.add('ng8-native-project-label-suppressed');
    }
    for(const more of root.querySelectorAll('button,a,[role="button"]')){
      if(more.closest('#ng8-pins')||more.closest(OWN))continue;
      const text=String(more.textContent||more.getAttribute?.('aria-label')||'').replace(/\s+/g,' ').trim();
      if(!/^(afficher plus|show more|voir plus)$/i.test(text))continue;
      const parent=more.parentElement;if(!parent)continue;
      if(parent.querySelector(PROJECT_CHAT_SEL)||parent.querySelector(PROJECT_SEL))more.classList.add('ng8-native-project-more-suppressed');
    }
    for(const host of groups){
      const genericChats=[...host.querySelectorAll(CHAT_SEL)].filter(a=>!a.matches(PROJECT_CHAT_SEL)&&!a.closest('#ng8-pins')).length;
      if(!genericChats)host.classList.add('ng8-native-projects-suppressed');
    }
  }

  function currentProject(){
    // A background reclassification/recovery can move the current chat before ChatGPT
    // rewrites the SPA URL. Prefer the verified cache assignment for a conversation and
    // use the route Project only as a fallback.
    const c=S.chatById.get(currentChatId());
    if(c?.projectId&&S.projectById.has(c.projectId))return S.projectById.get(c.projectId)||null;
    const path=currentProjectIdFromPath();return path?S.projectById.get(path)||null:null;
  }
  function topLevelChild(root,node){if(!root||!node)return null;let current=node;while(current.parentElement&&current.parentElement!==root)current=current.parentElement;return current.parentElement===root?current:null;}
  function recentsSection(root){
    if(!root)return null;
    const labels=[...root.querySelectorAll('h2,h3,[role="heading"],div,span')].filter(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim();return t.length<=20&&/^(récents|recents|recent)$/i.test(t);});
    for(const label of labels){let node=label;while(node.parentElement&&node.parentElement!==root){const parent=node.parentElement;if(parent.querySelector(CHAT_SEL))return parent;node=parent;}}
    return null;
  }
  function placePins(root,box){
    if(!root||!box)return;
    // Always mount the NiakGPT Project block as a DIRECT child of the sidebar host.
    // ChatGPT's Recents subtree can be virtualized/clipped; inserting inside it made
    // a fully rendered #ng8-pins collapse to a thin empty-looking line.
    const recent=recentsSection(root),recentTop=topLevelChild(root,recent);
    const firstProject=[...root.querySelectorAll(PROJECT_SEL)].find(a=>!a.closest('#ng8-pins')&&!a.closest(OWN));
    const firstProjectTop=topLevelChild(root,firstProject);
    const firstChat=[...root.querySelectorAll(CHAT_SEL)].find(a=>!a.matches(PROJECT_CHAT_SEL)&&!a.closest('#ng8-pins')&&!a.closest(OWN));
    const fallback=topLevelChild(root,firstChat);
    // Occupy the exact native Projects slot when it exists; Recents is only the fallback.
    const anchor=firstProjectTop||recentTop||fallback||null;
    if(box.parentElement!==root||box.nextElementSibling!==anchor){
      root.insertBefore(box,anchor||root.firstElementChild||null);
    }
    box.hidden=false;
    box.removeAttribute('aria-hidden');
  }
  function pinDate(ms){if(!ms)return'—';const d=new Date(ms),now=new Date();if(Number.isNaN(d.getTime()))return'—';const dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0');return d.getFullYear()===now.getFullYear()?`${dd}/${mm}`:`${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;}
  function pinMeta(project){const latest=projectRecency(project.id),count=S.counts.has(project.id)?S.counts.get(project.id):null;return{latest,count,text:`${pinDate(latest)}  [${count==null?'…':count}]`};}
  function renderPins(){
    const root=navRoot();if(!root)return;
    let box=document.getElementById('ng8-pins');if(!box){box=document.createElement('section');box.id='ng8-pins';}placePins(root,box);
    const all=sortedProjects(),coreSet=new Set(S.governance.coreProjectIds||[]),primary=all.filter(p=>coreSet.has(p.id)),extras=all.filter(p=>!coreSet.has(p.id));
    const shown=primary.length?primary:all.slice(0,8),active=currentProject()?.id||'';
    const metaFor=p=>pinMeta(p);
    const signature=JSON.stringify([all.map(p=>[p.id,p.name,p.color,p.icon,metaFor(p).latest,metaFor(p).count]),primary.map(p=>p.id),shown.map(p=>p.id),active]);
    // Do not tear down/rebuild the whole Project block for benign sidebar/cache mutations.
    // The previous two-stage render (count first, then chronology date) was visible as a
    // 100-300 ms flicker between `41` and `15/08 [41]`. Render the final metadata atomically.
    if(box.dataset.ng8Signature===signature){
      box.hidden=false;box.removeAttribute('aria-hidden');syncNativeProjectSection(root,box,shown.length>0);
      window.__NIAKGPT_DIAGNOSTICS__?.set('pins-ui',shown.length?`OK · ${shown.length} Projects NiakGPT · stable`:'ATTENTE · aucun Project à afficher');
      return;
    }
    const row=p=>{const meta=metaFor(p),title=meta.latest?`Dernier échange du Project : ${new Date(meta.latest).toLocaleString('fr-FR')}`:'Aucune date disponible';return`<a data-ng8-pin="1" href="${esc(p.href)}" style="--ng-project:${p.color}" class="${active===p.id?'ng8-active-project':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><small class="ng8-project-meta" title="${esc(title)}">${esc(meta.text)}</small></a>`;};
    box.innerHTML=`<div class="ng8-pin-head"><span>PROJECTS</span><b>${all.length}</b></div><div class="ng8-pin-list">${shown.map(row).join('')}</div>${primary.length&&extras.length?`<details class="ng90-project-extras"><summary>AUTRES · ${extras.length}</summary><div>${extras.map(row).join('')}</div></details>`:''}`;
    box.dataset.ng8Rendered=String(shown.length);box.dataset.ng8Signature=signature;syncNativeProjectSection(root,box,shown.length>0);
    window.__NIAKGPT_DIAGNOSTICS__?.set('pins-ui',shown.length?`OK · ${shown.length} Projects NiakGPT · stable`:'ATTENTE · aucun Project à afficher');
    document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:all.length,shown:shown.length}}));
  }

  function ensureShell(){
    if(!document.getElementById('ng8-rail')){
      const rail=document.createElement('aside');rail.id='ng8-rail';rail.setAttribute('aria-label','Outils NiakGPT');rail.innerHTML='<button data-tab="explorer" aria-label="Explorer">▤</button><button data-tab="toc" aria-label="Sommaire">☷</button><button data-tab="diag" aria-label="Diagnostic">◉</button><span></span><button data-q aria-label="Quick Open">⌘</button>';document.body.appendChild(rail);
      const panel=document.createElement('aside');panel.id='ng8-panel';panel.setAttribute('aria-label','Panneau NiakGPT');document.body.appendChild(panel);
      rail.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{const tab=b.dataset.tab;S.panelOpen=!(S.panelOpen&&S.tab===tab);S.tab=tab;renderPanel();}));rail.querySelector('[data-q]').addEventListener('click',openQuick);
    }
    if(!document.getElementById('ng8-status')){
      const status=document.createElement('div');status.id='ng8-status';status.innerHTML=`<span class="ng8-version"><b>NiakGPT</b> ${esc(VERSION)}</span><span class="ng8-status-project">Hors projet</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng8-core-state">PRÊT</span>`;document.body.appendChild(status);status.querySelector('[data-q]').addEventListener('click',openQuick);
    }
    document.body.classList.add('ng8-ready');health('ui','OK');renderStatusBase();
  }
  function renderStatusBase(){
    const status=document.getElementById('ng8-status');if(!status)return;const v=status.querySelector('.ng8-version');if(v)v.innerHTML=`<b>NiakGPT</b> ${esc(VERSION)}`;const p=status.querySelector('.ng8-status-project');if(p)p.textContent=currentProject()?.name||'Hors projet';applyProjectTheme();
  }
  function applyProjectTheme(){ const p=currentProject();document.documentElement.style.setProperty('--ng8-current-project',p?.color||'#3794ff'); }

  function diagnosticRows(){
    const external=window.__NIAKGPT_DIAGNOSTICS__?.snapshot?.()||{},merged={...S.health,...external},root=document.documentElement,tabRole=root.dataset.ng8TabRole||'unknown',safe=root.dataset.ng90Safe==='1';
    if(safe){for(const key of ['projects','data','organizer','pins'])merged[key]='PAUSE · SAFE MODE';}
    else if(tabRole==='client'){for(const key of ['bridge','projects','data','organizer'])if(/^(ATTENTE|CACHE|INDEX)/i.test(String(merged[key]||'')))merged[key]='DÉLÉGUÉ · WORKER';}
    if(/^ATTENTE/i.test(String(merged.toc||'')))merged.toc=location.pathname.includes('/c/')?'VIDE · 0 bloc':'INACTIF · hors conversation';
    return Object.entries(merged);
  }
  function renderPanelIfDiag(){
    if(!(S.panelOpen&&S.tab==='diag')||S.diagTimer)return;
    S.diagTimer=setTimeout(()=>{S.diagTimer=0;if(S.panelOpen&&S.tab==='diag')renderPanel();},70);
  }
  function liveTurns(){ S.turns=S.turns.filter(t=>t?.isConnected);return S.turns; }
  function renderPanel(){
    const panel=document.getElementById('ng8-panel');if(!panel)return;panel.classList.toggle('open',S.panelOpen);document.body.classList.toggle('ng8-panel-open',S.panelOpen);document.querySelectorAll('#ng8-rail [data-tab]').forEach(b=>b.classList.toggle('active',S.panelOpen&&b.dataset.tab===S.tab));if(!S.panelOpen)return;
    if(S.tab==='diag'){
      panel.innerHTML=`<header><div><small>DIAGNOSTIC</small><b>État des modules</b></div><button aria-label="Fermer">×</button></header><div class="ng8-diag">${diagnosticRows().map(([k,v])=>`<div><span>${esc(k)}</span><b class="${/^OK|^PRÊT/.test(String(v))?'ok':/^ERREUR/.test(String(v))?'err':'wait'}">${esc(v)}</b></div>`).join('')}</div>${S.errors.length?`<details class="ng8-errors"><summary>Dernières erreurs</summary>${S.errors.map(e=>`<code>${esc(e)}</code>`).join('')}</details>`:''}<div class="ng8-joke">☠ SYSTEM // SKYNET</div>`;
    }else if(S.tab==='toc'){
      const turns=liveTurns();health('toc',turns.length?`OK · ${turns.length} blocs`:'VIDE · 0 bloc');
      panel.innerHTML=`<header><div><small>SOMMAIRE</small><b>${turns.length} blocs</b></div><button aria-label="Fermer">×</button></header><input id="ng8-toc-search" placeholder="Filtrer le fil…"><div class="ng8-toc">${turns.map((t,i)=>`<button data-turn="${i}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc((t.innerText||t.textContent||'').replace(/\s+/g,' ').slice(0,135))}</span></button>`).join('')}</div>`;
    }else{
      panel.innerHTML=`<header><div><small>EXPLORER</small><b>${S.projects.length} Projects · ${S.chats.length} chats</b></div><button aria-label="Fermer">×</button></header><div class="ng8-actions"><button data-repair>Nettoyer & reconstruire</button><button data-refresh>Réindexer maintenant</button></div><input id="ng8-project-search" placeholder="Filtrer les Projects…"><div class="ng8-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${sortedProjects().map(p=>`<a href="${esc(p.href)}" data-project-name="${esc(norm(p.name))}" style="--ng-project:${p.color}" class="${isLegacy(p)?'legacy ':''}${p.duplicateOf?'duplicate':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><b>${S.counts.has(p.id)?(S.counts.get(p.id)==null?'?':S.counts.get(p.id)):'…'}</b></a>`).join('')}</div>`;
    }
    panel.querySelector('header button')?.addEventListener('click',()=>{S.panelOpen=false;renderPanel();});
    panel.querySelector('[data-refresh]')?.addEventListener('click',()=>{if(!confirm('Réindexer maintenant tous les Projects et conversations depuis ChatGPT ?'))return;document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));health('projects','RÉINDEXATION · demandée');});
    panel.querySelectorAll('.ng8-project-table a').forEach(a=>a.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();const id=pidFromHref(a.getAttribute('href')||'');routeTo(id?`/g/${id}/project`:(a.getAttribute('href')||''));}));
    panel.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>{const t=liveTurns()[Number(b.dataset.turn)];t?.scrollIntoView({behavior:enabled('ng90Motion')?'smooth':'auto',block:'center'});}));
    const ts=panel.querySelector('#ng8-toc-search');if(ts)ts.addEventListener('input',()=>{const q=norm(ts.value);panel.querySelectorAll('[data-turn]').forEach(b=>b.hidden=!!q&&!norm(b.textContent).includes(q));});
    const ps=panel.querySelector('#ng8-project-search');if(ps)ps.addEventListener('input',()=>{const q=norm(ps.value);panel.querySelectorAll('.ng8-project-table a').forEach(a=>a.hidden=!!q&&!String(a.dataset.projectName||'').includes(q));});
  }

  function chatHref(c){ return c.href||(c.projectId?`/g/${c.projectId}/c/${c.id}`:`/c/${c.id}`); }
  function routeTo(href){ const root=navRoot(),chatId=cidFromHref(href),projectId=pidFromHref(href),links=root?[...root.querySelectorAll('a[href]')]:[],native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cidFromHref(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pidFromHref(a.getAttribute('href'))===projectId&&/\/project(?:$|\?)/.test(a.getAttribute('href')||'')):null);if(native){native.click();return;}location.assign(href); }
  function formatDate(ms){ if(!ms)return'—';const d=new Date(ms);return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }
  function openQuick(){
    document.getElementById('ng8-quick')?.remove();
    const modal=document.createElement('div');modal.id='ng8-quick';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML=`<div><input autofocus placeholder="Quick Open — Projects & conversations"><section></section><footer>${S.projects.length} Projects · ${S.chats.length} chats · Alt+K · ↑↓ · Entrée · Échap</footer></div>`;document.body.appendChild(modal);
    const input=modal.querySelector('input'),list=modal.querySelector('section');let items=[],sel=0;
    const paint=()=>{
      const q=norm(input.value),ps=sortedProjects().filter(p=>!q||norm(p.name).includes(q)).map(p=>({type:'PROJECT',title:p.name,sub:`${formatDate(projectRecency(p.id))} · [${S.counts.get(p.id)??'…'}]`,color:p.color,href:p.href}));
      const cs=S.chats.filter(c=>{const p=S.projectById.get(c.projectId);return!q||norm(`${c.title} ${c.snippet} ${p?.name||''}`).includes(q);}).sort((a,b)=>b.updated-a.updated).slice(0,q?120:80).map(c=>{const p=S.projectById.get(c.projectId);return{type:'CHAT',title:c.title,sub:`${formatDate(c.updated)} · ${p?.name||'Hors projet'}`,color:p?.color||'#607080',href:chatHref(c)};});
      items=[...ps,...cs].slice(0,140);sel=Math.min(sel,Math.max(0,items.length-1));list.innerHTML=items.map((x,i)=>`<button class="${i===sel?'sel':''}" data-i="${i}"><i style="--ng-project:${x.color}"></i><span>${esc(x.title)}</span><small>${esc(x.sub)}</small><em>${x.type}</em></button>`).join('');list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>routeTo(items[Number(b.dataset.i)].href)));
    };
    input.addEventListener('input',()=>{sel=0;paint();});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,items.length-1);paint();}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}else if(e.key==='Enter'&&items[sel]){e.preventDefault();routeTo(items[sel].href);}else if(e.key==='Escape')modal.remove();});modal.addEventListener('mousedown',e=>{if(e.target===modal)modal.remove();});paint();setTimeout(()=>input.focus(),0);health('quick',`OK · ${S.projects.length+S.chats.length} entrées`);
  }

  function formatClock(ms){
    if(!ms)return'';const d=new Date(ms);if(!Number.isFinite(d.getTime()))return'';
    return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function turnMessageId(turn){
    return String(turn?.getAttribute?.('data-message-id')||turn?.querySelector?.('[data-message-id]')?.getAttribute('data-message-id')||'');
  }
  function nativeTurnTime(turn){
    const el=turn?.querySelector?.('time[datetime],[data-message-timestamp],[data-timestamp],[data-create-time],[datetime]');if(!el)return 0;
    for(const key of['datetime','data-message-timestamp','data-timestamp','data-create-time']){const raw=el.getAttribute?.(key);const at=parseTime(raw);if(at)return at;}
    return 0;
  }
  function timelineTimeForTurn(turn){
    const direct=nativeTurnTime(turn);if(direct)return direct;
    const id=turnMessageId(turn),byId=id?S.turnTimeById.get(id):0;if(byId)return byId;
    const role=turn?.dataset?.ng8Role||turn?.querySelector?.('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';
    if(role!=='user'&&role!=='assistant')return 0;
    let ordinal=0;for(const old of S.turns){if(old===turn)break;if(old?.dataset?.ng8Role===role)ordinal++;}
    return S.turnTimeline.filter(x=>x.role===role)[ordinal]?.at||0;
  }
  function stampTurn(turn){
    const at=timelineTimeForTurn(turn),clock=formatClock(at);if(clock)turn.dataset.ng8Time=clock;else delete turn.dataset.ng8Time;
  }
  function applyTurnTimeline(){for(const turn of S.turns)if(turn?.isConnected)stampTurn(turn);}

  function timelineFromConversation(data){
    const mapping=data?.mapping;if(!mapping||typeof mapping!=='object')return[];
    const chain=[];let nodeId=String(data.current_node||'');let guard=0;
    while(nodeId&&mapping[nodeId]&&guard++<5000){const node=mapping[nodeId],m=node?.message,role=m?.author?.role,at=parseTime(m?.create_time||m?.update_time||0);if(m?.id&&(role==='user'||role==='assistant')&&at)chain.push({id:String(m.id),role,at});nodeId=String(node?.parent||'');}
    return chain.reverse();
  }
  async function requestTurnTimeline(){
    // 0.9.49: timestamps are derived from native DOM/local cache only. Full conversation GETs are forbidden.
    if(document.documentElement.dataset.ng86Activity!=='ready')return;
    try{applyTurnTimeline?.();}catch{}
  }
  function scheduleTurnTimeline(delay=900){setTimeout(()=>requestTurnTimeline().catch(()=>{}),delay);}

  function decorateCode(pre){
    if(!(pre instanceof HTMLElement)||S.codeSeen.has(pre)||pre.closest(OWN))return;S.codeSeen.add(pre);S.codeCount++;
    pre.dataset.ng8Code='1';const code=pre.querySelector('code'),lang=(code?.className?.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase(),lines=(code?.innerText||pre.innerText||'').split('\n').length;
    const bar=document.createElement('div');bar.className='ng8-codebar';bar.innerHTML=`<span><i>●</i> ${esc(lang)} · ${lines} lignes</span><button type="button">COPIER</button>`;bar.querySelector('button').addEventListener('click',()=>navigator.clipboard.writeText(code?.innerText||pre.innerText||''));pre.prepend(bar);
  }
  function decorateTurn(turn){
    if(!(turn instanceof HTMLElement)||S.turnSeen.has(turn)||turn.closest(OWN))return;S.turnSeen.add(turn);S.turns.push(turn);
    const i=S.turns.length-1;turn.dataset.ng8Turn=String(i);turn.dataset.ng8Role=turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'unknown';turn.dataset.ng8Zebra=String(i%2);stampTurn(turn);turn.querySelectorAll('pre').forEach(decorateCode);
    if(S.turns.length>8){const old=S.turns[S.turns.length-9];if(old?.isConnected)old.classList.add('ng8-offscreen');}
    const heavy=S.turns.length>=65||S.codeCount>=35;document.documentElement.dataset.ng8Heavy=heavy?'1':'0';health('performance',`OK · ${S.turns.length}${heavy?' · LOURD':''}`);health('toc',`PRÊT · ${S.turns.length} blocs`);
  }
  function finishMainScan(token){
    if(token!==S.scanToken)return;
    clearTimeout(S.scanTimer);S.scanTimer=0;S.scanRunning=false;
    if(S.scanRequested){S.scanRequested=false;S.scanTimer=setTimeout(()=>{S.scanTimer=0;scanExistingMain();},240);}
  }
  function scanExistingMain(){
    const main=document.querySelector('main');if(!main)return;
    if(activity()!=='ready'){S.scanRequested=true;return;}
    if(S.scanRunning){S.scanRequested=true;return;}
    clearTimeout(S.scanTimer);S.scanTimer=0;S.scanRunning=true;S.scanRequested=false;
    const token=++S.scanToken;
    const nodes=main.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]');
    const total=nodes.length,heavy=total>=65;
    if(heavy)document.documentElement.dataset.ng8Heavy='1';
    // Historical turns are cold data. Decorating every old turn on a 300+ message thread
    // causes large style/layout bursts for no user benefit. Keep a generous live tail only.
    let index=heavy?Math.max(0,total-160):0;
    const chunk=()=>{
      if(token!==S.scanToken||!main.isConnected){finishMainScan(token);return;}
      if(activity()!=='ready'){S.scanRequested=true;finishMainScan(token);return;}
      const size=heavy?6:12,end=Math.min(index+size,total);
      for(;index<end;index++)decorateTurn(nodes[index]);
      if(index<total)S.scanTimer=setTimeout(chunk,heavy?72:34);
      else{health('performance',`OK · ${total}${heavy?' · LOURD · tail 160':''}`);finishMainScan(token);}
    };
    S.scanTimer=setTimeout(chunk,heavy?120:60);
  }
  function deferMainSnapshot(delay=700){
    clearTimeout(S.mainTimer);S.mainTimer=0;S.pendingMain.clear();S.scanRequested=true;
    S.mainTimer=setTimeout(function waitMainReady(){
      S.mainTimer=0;if(activity()!=='ready'){deferMainSnapshot(1000);return;}scanExistingMain();
    },delay);
  }
  function queueMainNodes(records){
    let added=0;for(const r of records){added+=r.addedNodes?.length||0;if(added>120)break;}
    if(activity()!=='ready'||added>120){deferMainSnapshot(activity()==='ready'?320:700);return;}
    for(const r of records){for(const n of r.addedNodes){if(!(n instanceof Element))continue;S.pendingMain.add(n);if(S.pendingMain.size>80){deferMainSnapshot(320);return;}}}
    if(S.mainTimer)return;S.mainTimer=setTimeout(processPendingMain,140);
  }
  function processPendingMain(){
    S.mainTimer=0;if(activity()!=='ready'){deferMainSnapshot(700);return;}
    const roots=[...S.pendingMain];
    S.pendingMain.clear();
    const turnSel='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
    const work=[];
    const seen=new Set();
    const add=(kind,el)=>{if(!el||seen.has(el))return true;if(work.length>=40)return false;seen.add(el);work.push([kind,el]);return true;};
    for(const node of roots){if(!node?.isConnected)continue;if(node.matches?.(turnSel)){if(!add('turn',node)){deferMainSnapshot(260);return;}}else if(node.matches?.('pre')){if(!add('code',node)){deferMainSnapshot(260);return;}}else{const nested=node.querySelectorAll?.(`${turnSel},pre`)||[];if(nested.length>40||work.length+nested.length>40){deferMainSnapshot(260);return;}for(const el of nested)if(!add(el.matches?.(turnSel)?'turn':'code',el)){deferMainSnapshot(260);return;}}}
    let index=0;const chunk=()=>{if(activity()!=='ready'){deferMainSnapshot(700);return;}const end=Math.min(index+10,work.length);for(;index<end;index++){const [kind,el]=work[index];if(!el?.isConnected)continue;if(kind==='turn')decorateTurn(el);else decorateCode(el);}if(index<work.length)S.mainTimer=setTimeout(()=>{S.mainTimer=0;chunk();},36);};chunk();
  }

  function stopMatrix(){ clearTimeout(S.matrixTimer);S.matrixTimer=0;S.matrix?.remove();S.matrix=null;S.matrixCtx=null;health('matrix','OFF'); }
  function resizeMatrix(){ if(!S.matrix)return;const host=document.querySelector('main')||document.body,r=host.getBoundingClientRect(),scale=.38;S.matrixW=S.matrix.width=Math.max(1,Math.floor(r.width*scale));S.matrixH=S.matrix.height=Math.max(1,Math.floor(innerHeight*scale));S.matrix.style.width=`${Math.max(1,r.width)}px`;S.matrix.style.height=`${innerHeight}px`;S.matrixCols=Array(Math.ceil(S.matrixW/11)).fill(0).map(()=>Math.random()*S.matrixH); }
  function matrixLoop(){
    clearTimeout(S.matrixTimer);if(!S.matrix||document.documentElement.dataset.ng90Matrix==='off'||safeMode())return stopMatrix();
    const mode=document.documentElement.dataset.ng90Matrix||'subtle',active=activity()!=='ready',heavy=document.documentElement.dataset.ng8Heavy==='1',client=role()==='client';const gap=document.hidden?5000:heavy?(active?1800:(mode==='normal'?900:1400)):active?800:client?(mode==='normal'?360:700):(mode==='normal'?130:240);
    if(!document.hidden&&!(active&&heavy)){
      const x=S.matrixCtx,w=S.matrixW,h=S.matrixH,chars='01アイウエオカキクケコ<>[]{}▓░λΣ∞';x.fillStyle='rgba(2,8,5,.14)';x.fillRect(0,0,w,h);x.font='9px Consolas,monospace';for(let i=0;i<S.matrixCols.length;i++){x.fillStyle=Math.random()>.982?'rgba(215,255,222,.82)':'rgba(28,255,88,.52)';x.fillText(chars[(Math.random()*chars.length)|0],i*11,S.matrixCols[i]);S.matrixCols[i]+=7.2;if(S.matrixCols[i]>h&&Math.random()>.97)S.matrixCols[i]=0;}
    }
    S.matrixTimer=setTimeout(matrixLoop,gap);
  }
  function ensureMatrix(){
    if(safeMode()||document.documentElement.dataset.ng90Matrix==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches)return stopMatrix();
    const host=document.querySelector('main')||document.body;if(!host)return;if(S.matrix?.isConnected)return;
    const c=document.createElement('canvas');c.id='ng8-matrix';host.prepend(c);S.matrix=c;S.matrixCtx=c.getContext('2d',{alpha:true});resizeMatrix();matrixLoop();health('matrix','OK · éco');
  }
  function ensureBots(){
    const wanted=enabled('ng90Eggs')&&!safeMode();if(!wanted){document.querySelectorAll('.ng8-bot').forEach(x=>x.remove());return;}if(document.getElementById('ng8-bot-a'))return;
    const svg='<svg viewBox="0 0 64 64"><path d="M18 10h28l8 11-3 25-9 8H22l-9-8-3-25z" fill="#8b949e"/><path d="M18 19h28l4 7-5 10H19l-5-10z" fill="#151b22"/><circle cx="24" cy="28" r="4" fill="#ff3b30"/><circle cx="40" cy="28" r="4" fill="#ff3b30"/></svg>';for(const id of['ng8-bot-a','ng8-bot-b','ng8-bot-c']){const d=document.createElement('div');d.id=id;d.className='ng8-bot';d.innerHTML=svg;document.body.appendChild(d);}
  }

  function brand(){
    if(document.title.includes('ChatGPT'))document.title=document.title.replace(/ChatGPT/g,'NiakGPT');
    if(activity()!=='ready')return;const root=navRoot();const candidates=[...document.querySelectorAll('header a,header button,header span'),...(root?[...root.querySelectorAll(':scope a,:scope button,:scope span')]:[])].slice(0,120);for(const el of candidates){if(!(el instanceof HTMLElement))continue;const r=el.getBoundingClientRect();if(r.top>100||r.left>370)continue;const text=(el.textContent||'').trim();if(text==='ChatGPT'||text==='ChatGPT Plus'||text==='NiakGPT Plus'){if(el.childElementCount===0)el.textContent='NiakGPT';el.dataset.ng8Brand='1';break;}}
  }

  function mountObservers(){
    const main=document.querySelector('main');
    if(main&&main!==S.mainRoot){S.mainObserver?.disconnect();S.mainRoot=main;S.mainObserver=new MutationObserver(queueMainNodes);S.mainObserver.observe(main,{childList:true,subtree:true});scanExistingMain();}
    const side=navRoot();
    if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(records=>{let relevant=false,projectTouched=false,pinsLost=false;for(const record of records){for(const node of record.removedNodes){if(!(node instanceof Element))continue;if(node.id==='ng8-pins'||node.querySelector?.('#ng8-pins')){pinsLost=true;relevant=true;}}for(const node of record.addedNodes){if(!(node instanceof Element))continue;const hasProject=node.matches?.(PROJECT_SEL)||node.querySelector?.(PROJECT_SEL);const hasChat=node.matches?.(CHAT_SEL)||node.querySelector?.(CHAT_SEL);if(hasProject){relevant=true;projectTouched=true;}else if(hasChat)relevant=true;}}if(!relevant)return;S.sidebarNeedsPins=S.sidebarNeedsPins||projectTouched||pinsLost;if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;const pins=S.sidebarNeedsPins||!document.getElementById('ng8-pins');S.sidebarNeedsPins=false;decorateSidebar(pins);},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}
  }
  function resetRouteVisuals(){
    clearTimeout(S.scanTimer);S.scanTimer=0;S.scanToken++;S.scanRunning=false;S.scanRequested=false;
    S.turns=[];S.turnSeen=new WeakSet();S.codeSeen=new WeakSet();S.codeCount=0;S.turnTimeline=[];S.turnTimeById=new Map();S.timelineRequestedFor='';document.documentElement.dataset.ng8Heavy='0';renderStatusBase();decorateSidebar();setTimeout(scanExistingMain,500);scheduleTurnTimeline(1300);
  }
  function wakeBackground(){
    // server-index-v100.js is the sole backend index owner in 0.9.37.
    // Keeping the legacy app indexer dormant prevents duplicate requests and stale cache overwrites.
    if(!canBackground())return;
  }
  function handleRouteChange(){
    mountObservers();const next=location.pathname;if(next===S.lastPath)return;
    S.lastPath=next;resetRouteVisuals();mountObservers();ensureMatrix();wakeBackground();
  }
  function bindNavigation(){
    const later=()=>setTimeout(handleRouteChange,0);
    window.addEventListener('popstate',later);
    document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('a[href]'))later();},true);
    if(window.navigation?.addEventListener){window.navigation.addEventListener('navigatesuccess',handleRouteChange);window.navigation.addEventListener('currententrychange',later);}
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){mountObservers();handleRouteChange();wakeBackground();}});
    const runtimeObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe'].includes(r.attributeName)))wakeBackground();});
    runtimeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe']});
  }

  function bindEvents(){
    document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&String(e.key).toLowerCase()==='k'){e.preventDefault();openQuick();}},true);
    document.addEventListener('niakgpt:settings-changed',()=>{ensureMatrix();ensureBots();renderPins();});
    document.addEventListener('niakgpt:diagnostic-changed',()=>renderPanelIfDiag());
    document.addEventListener('niakgpt:turn-timeline',event=>{const d=event.detail||{};if(d.conversationId&&currentChatId()&&d.conversationId!==currentChatId())return;const turns=Array.isArray(d.turns)?d.turns.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&parseTime(x.at)):[];S.turnTimeline=turns.map(x=>({...x,at:parseTime(x.at)}));S.turnTimeById=new Map(S.turnTimeline.filter(x=>x.id).map(x=>[String(x.id),x.at]));applyTurnTimeline();});
    document.addEventListener('niakgpt:activity-changed',()=>{if(activity()==='ready'){if(S.scanRequested||!S.turns.length)scanExistingMain();scheduleTurnTimeline(500);}});
    document.addEventListener('niakgpt:rate-limit-cleared',()=>scheduleTurnTimeline(700));
    window.addEventListener('resize',()=>{resizeMatrix();},{passive:true});
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local')return;
      if(changes[GOV_KEY]){S.governance={...S.governance,...(changes[GOV_KEY].newValue||{})};decorateSidebar();renderPanel();}
      if(changes[CACHE_KEY]&&!S.indexing){
        const incoming=changes[CACHE_KEY].newValue;
        if(incoming?.at!==S.lastCacheWriteAt)loadCache(incoming).then(()=>{decorateSidebar();if(S.panelOpen)renderPanel();});
      }
    });
  }

  async function waitCacheGuard(timeout=3000){
    if(document.documentElement.dataset.ng100CacheGuard!=='pending')return;
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(t);document.removeEventListener('niakgpt:cache-guard-ready',finish);resolve();};const t=setTimeout(finish,timeout);document.addEventListener('niakgpt:cache-guard-ready',finish,{once:true});});
  }
  async function boot(){
    ensureShell();await waitCacheGuard();await Promise.all([loadGovernance(),loadCache()]);brand();mergeDOM();buildDuplicates();decorateSidebar();mountObservers();ensureMatrix();ensureBots();bindEvents();bindNavigation();
    if(role()==='client')health('bridge','DÉLÉGUÉ · WORKER');scheduleTurnTimeline(900);
  }

  if(document.body)boot();else{const mo=new MutationObserver(()=>{if(document.body){mo.disconnect();boot();}});mo.observe(document.documentElement,{childList:true,subtree:true});}
})();
