(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_APP_090__) return;
  window.__NIAKGPT_APP_090__ = true;

  const VERSION = (() => { try { return chrome.runtime.getManifest().version || '0.9.6'; } catch { return '0.9.6'; } })();
  const CACHE_KEY = 'niakgpt-v08-cache';
  const GOV_KEY = 'niakgpt-governance-v085';
  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"][href*="/project"]';
  const OWN = '#ng8-rail,#ng8-panel,#ng8-status,#ng8-coach,#ng8-pins,#ng8-quick,#ng90-control,.ng8-bot';
  const LEGACY = new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development']);
  const COLORS = ['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185','#38BDF8','#34D399','#F59E0B'];
  const STOP = new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut').split(/\s+/));

  const S = {
    projects:[], projectById:new Map(), chats:[], chatById:new Map(), projectChats:new Map(), counts:new Map(), duplicates:new Map(),
    health:{bridge:'PRÊT',data:'CACHE',projects:'CACHE',quick:'PRÊT',coach:'INACTIF',toc:'INACTIF',performance:'PRÊT',matrix:'INACTIF',ui:'PRÊT'},
    errors:[], panelOpen:false, tab:'explorer', queue:[], queueTimer:0, indexing:false, indexComplete:false, generalLoaded:false,
    mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, sidebarNeedsPins:false, scanTimer:0, scanToken:0, diagTimer:0,
    cacheSaveTimer:0, lastCacheWriteAt:0, lastPath:location.pathname, projectsRefreshed:false, refreshingProjects:false,
    pendingMain:new Set(), turns:[], turnSeen:new WeakSet(), codeSeen:new WeakSet(), codeCount:0,
    matrix:null, matrixCtx:null, matrixTimer:0, matrixResize:null, matrixCols:[], matrixW:0, matrixH:0,
    governance:{coreProjectIds:[],hiddenProjectIds:[]}, cacheLoaded:false
  };

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const parseTime = v => { if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0; };
  const normalizePid = v => { if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([a-z0-9]+)(?:-.+)?$/i);return m?`g-p-${m[1]}`:s; };
  const pidFromHref = h => { const m=String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i);return m?normalizePid(m[1]):''; };
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
    return{id,title:String(raw?.title||raw?.conversation_title||'Conversation sans titre'),projectId:normalizePid(pid||raw?.gizmo_id||raw?.conversation_mode?.gizmo_id||''),snippet:String(raw?.snippet||''),updated:parseTime(raw?.update_time||raw?.create_time),href:''};
  }
  function upsertProject(p){
    if(!p?.id)return;
    const old=S.projectById.get(p.id),next={...old,...p,color:p.color||old?.color||colorFor(p.name),icon:p.icon||old?.icon||iconFor(p.name)};
    S.projectById.set(p.id,next);
    const i=S.projects.findIndex(x=>x.id===p.id);if(i<0)S.projects.push(next);else S.projects[i]=next;
  }
  function upsertChat(c){
    if(!c?.id)return;
    const old=S.chatById.get(c.id),next={...old,...c,projectId:c.projectId||old?.projectId||'',updated:Math.max(old?.updated||0,c.updated||0),href:c.href||old?.href||''};
    S.chatById.set(c.id,next);
    const i=S.chats.findIndex(x=>x.id===c.id);if(i<0)S.chats.push(next);else S.chats[i]=next;
  }
  function serialize(){ return{schema:2,at:Date.now(),projects:S.projects,chats:S.chats,counts:Object.fromEntries(S.counts),indexedProjectIds:[...S.projectChats.keys()]}; }
  async function saveCache(){
    clearTimeout(S.cacheSaveTimer);S.cacheSaveTimer=0;
    const payload=serialize();S.lastCacheWriteAt=payload.at;
    try{await chrome.storage.local.set({[CACHE_KEY]:payload});}catch{}
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
        S.counts=new Map(Object.entries(raw.counts||{}));
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
      group.sort((a,b)=>(Number(S.counts.get(b.id))||0)-(Number(S.counts.get(a.id))||0)||projectRecency(b.id)-projectRecency(a.id));
      const keep=group[0];for(const p of group)if(p.id!==keep.id)p.duplicateOf=keep.id;
    }
  }
  function isLegacy(p){ return !!p&&LEGACY.has(norm(p.name)); }
  function visibleProjects(){ const hidden=new Set(S.governance.hiddenProjectIds||[]);return S.projects.filter(p=>!hidden.has(p.id)&&!p.duplicateOf); }
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
      const known=S.projectById.get(id),name=known?.name||(a.getAttribute('aria-label')||a.querySelector('.truncate span')?.textContent||a.textContent||'').trim();
      if(name)upsertProject({id,name,color:known?.color||colorFor(name),icon:known?.icon||iconFor(name),href:a.getAttribute('href')||`/g/${id}/project`,duplicateOf:known?.duplicateOf||''});
    }
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(a.closest(OWN))continue;const id=cidFromHref(a.getAttribute('href'));if(!id)continue;const old=S.chatById.get(id),title=old?.title||(a.getAttribute('aria-label')||a.querySelector('.truncate span')?.textContent||a.textContent||id).trim();
      upsertChat({id,title,projectId:pidFromHref(a.getAttribute('href'))||old?.projectId||'',snippet:old?.snippet||'',updated:old?.updated||0,href:a.getAttribute('href')||old?.href||''});
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
    }
    if(renderManaged)renderPins();
  }
  function currentProject(){
    const path=currentProjectIdFromPath();if(path)return S.projectById.get(path)||null;
    const c=S.chatById.get(currentChatId());return c?.projectId?S.projectById.get(c.projectId)||null:null;
  }
  function renderPins(){
    const root=navRoot();if(!root)return;
    let box=root.querySelector('#ng8-pins');if(!box){box=document.createElement('section');box.id='ng8-pins';const firstProject=root.querySelector(PROJECT_SEL);if(firstProject?.parentElement)firstProject.parentElement.insertAdjacentElement('beforebegin',box);else root.prepend(box);}
    const all=sortedProjects(),coreSet=new Set(S.governance.coreProjectIds||[]),primary=all.filter(p=>coreSet.has(p.id)),extras=all.filter(p=>!coreSet.has(p.id));
    const row=p=>`<a data-ng8-pin="1" href="${esc(p.href)}" style="--ng-project:${p.color}" class="${currentProject()?.id===p.id?'ng8-active-project':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><small>${S.counts.has(p.id)?(S.counts.get(p.id)==null?'?':S.counts.get(p.id)):'…'}</small></a>`;
    box.innerHTML=`<div class="ng8-pin-head"><span>PROJECTS</span><b>${all.length}</b></div><div class="ng8-pin-list">${(primary.length?primary:all.slice(0,8)).map(row).join('')}</div>${primary.length&&extras.length?`<details class="ng90-project-extras"><summary>AUTRES · ${extras.length}</summary><div>${extras.map(row).join('')}</div></details>`:''}`;
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
      panel.innerHTML=`<header><div><small>EXPLORER</small><b>${S.projects.length} Projects · ${S.chats.length} chats</b></div><button aria-label="Fermer">×</button></header><div class="ng8-actions"><button data-repair>Nettoyer & reconstruire</button><button data-refresh>Réindexer en idle</button></div><input id="ng8-project-search" placeholder="Filtrer les Projects…"><div class="ng8-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${sortedProjects().map(p=>`<a href="${esc(p.href)}" data-project-name="${esc(norm(p.name))}" style="--ng-project:${p.color}" class="${isLegacy(p)?'legacy ':''}${p.duplicateOf?'duplicate':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><b>${S.counts.has(p.id)?(S.counts.get(p.id)==null?'?':S.counts.get(p.id)):'…'}</b></a>`).join('')}</div>`;
    }
    panel.querySelector('header button')?.addEventListener('click',()=>{S.panelOpen=false;renderPanel();});
    panel.querySelector('[data-refresh]')?.addEventListener('click',()=>{if(!confirm('Reconstruire l’index Projects/chats en tâche de fond ?'))return;S.projectChats.clear();S.counts.clear();S.indexComplete=false;S.queue=[];saveCache().then(()=>refreshProjects());});
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

  function decorateCode(pre){
    if(!(pre instanceof HTMLElement)||S.codeSeen.has(pre)||pre.closest(OWN))return;S.codeSeen.add(pre);S.codeCount++;
    pre.dataset.ng8Code='1';const code=pre.querySelector('code'),lang=(code?.className?.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase(),lines=(code?.innerText||pre.innerText||'').split('\n').length;
    const bar=document.createElement('div');bar.className='ng8-codebar';bar.innerHTML=`<span><i>●</i> ${esc(lang)} · ${lines} lignes</span><button type="button">COPIER</button>`;bar.querySelector('button').addEventListener('click',()=>navigator.clipboard.writeText(code?.innerText||pre.innerText||''));pre.prepend(bar);
  }
  function decorateTurn(turn){
    if(!(turn instanceof HTMLElement)||S.turnSeen.has(turn)||turn.closest(OWN))return;S.turnSeen.add(turn);S.turns.push(turn);
    const i=S.turns.length-1;turn.dataset.ng8Turn=String(i);turn.dataset.ng8Role=turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'unknown';turn.dataset.ng8Zebra=String(i%2);turn.querySelectorAll('pre').forEach(decorateCode);
    if(S.turns.length>8){const old=S.turns[S.turns.length-9];if(old?.isConnected)old.classList.add('ng8-offscreen');}
    const heavy=S.turns.length>=65||S.codeCount>=35;document.documentElement.dataset.ng8Heavy=heavy?'1':'0';health('performance',`OK · ${S.turns.length}${heavy?' · LOURD':''}`);health('toc',`PRÊT · ${S.turns.length} blocs`);
  }
  function scanExistingMain(){
    clearTimeout(S.scanTimer);const token=++S.scanToken,main=document.querySelector('main');if(!main)return;
    S.scanTimer=setTimeout(()=>{
      S.scanTimer=0;if(token!==S.scanToken||!main.isConnected)return;
      const nodes=[...main.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]')];
      if(nodes.length>=65)document.documentElement.dataset.ng8Heavy='1';
      let index=0;
      const chunk=()=>{
        if(token!==S.scanToken||!main.isConnected)return;
        if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}
        const end=Math.min(index+20,nodes.length);for(;index<end;index++)decorateTurn(nodes[index]);
        if(index<nodes.length)S.scanTimer=setTimeout(chunk,24);
        else{S.scanTimer=0;health('performance',`OK · ${S.turns.length}${nodes.length>=65?' · LOURD':''}`);}
      };
      chunk();
    },180);
  }
  function queueMainNodes(records){
    for(const r of records)for(const n of r.addedNodes)if(n instanceof Element)S.pendingMain.add(n);if(S.mainTimer)return;S.mainTimer=setTimeout(processPendingMain,activity()==='ready'?120:420);
  }
  function processPendingMain(){
    S.mainTimer=0;const nodes=[...S.pendingMain];S.pendingMain.clear();
    for(const node of nodes){if(node.matches?.('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]'))decorateTurn(node);node.querySelectorAll?.('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').forEach(decorateTurn);if(node.matches?.('pre'))decorateCode(node);node.querySelectorAll?.('pre').forEach(decorateCode);}
  }

  function stopMatrix(){ clearTimeout(S.matrixTimer);S.matrixTimer=0;S.matrix?.remove();S.matrix=null;S.matrixCtx=null;health('matrix','OFF'); }
  function resizeMatrix(){ if(!S.matrix)return;const host=document.querySelector('main')||document.body,r=host.getBoundingClientRect(),scale=.38;S.matrixW=S.matrix.width=Math.max(1,Math.floor(r.width*scale));S.matrixH=S.matrix.height=Math.max(1,Math.floor(innerHeight*scale));S.matrix.style.width=`${Math.max(1,r.width)}px`;S.matrix.style.height=`${innerHeight}px`;S.matrixCols=Array(Math.ceil(S.matrixW/11)).fill(0).map(()=>Math.random()*S.matrixH); }
  function matrixLoop(){
    clearTimeout(S.matrixTimer);if(!S.matrix||document.documentElement.dataset.ng90Matrix==='off'||safeMode())return stopMatrix();
    const mode=document.documentElement.dataset.ng90Matrix||'subtle',active=activity()!=='ready',heavy=document.documentElement.dataset.ng8Heavy==='1',client=role()==='client';const gap=document.hidden?5000:active?(heavy?1400:800):client?(mode==='normal'?360:700):(mode==='normal'?130:240);
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
    if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(records=>{let relevant=false,projectTouched=false;for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const hasProject=node.matches?.(PROJECT_SEL)||node.querySelector?.(PROJECT_SEL);const hasChat=node.matches?.(CHAT_SEL)||node.querySelector?.(CHAT_SEL);if(hasProject){relevant=true;projectTouched=true;}else if(hasChat)relevant=true;}if(!relevant)return;S.sidebarNeedsPins=S.sidebarNeedsPins||projectTouched;if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;const pins=S.sidebarNeedsPins;S.sidebarNeedsPins=false;decorateSidebar(pins);},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}
  }
  function resetRouteVisuals(){
    clearTimeout(S.scanTimer);S.scanTimer=0;S.scanToken++;
    S.turns=[];S.turnSeen=new WeakSet();S.codeSeen=new WeakSet();S.codeCount=0;document.documentElement.dataset.ng8Heavy='0';renderStatusBase();decorateSidebar();setTimeout(scanExistingMain,500);
  }
  function wakeBackground(){
    if(!canBackground())return;
    if(!S.projectsRefreshed&&!S.refreshingProjects)refreshProjects();else scheduleIndex(40);
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

  async function boot(){
    ensureShell();await Promise.all([loadGovernance(),loadCache()]);brand();mergeDOM();buildDuplicates();decorateSidebar();mountObservers();ensureMatrix();ensureBots();bindEvents();bindNavigation();
    if(role()==='client')health('bridge','DÉLÉGUÉ · WORKER');
    setTimeout(()=>{if(canBackground())refreshProjects();},900);
  }

  if(document.body)boot();else{const mo=new MutationObserver(()=>{if(document.body){mo.disconnect();boot();}});mo.observe(document.documentElement,{childList:true,subtree:true});}
})();
