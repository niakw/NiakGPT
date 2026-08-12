(() => {
  'use strict';

  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_V070__) return;
  window.__NIAKGPT_V070__ = true;
  document.documentElement.classList.add('ng7-boot');

  const VERSION = '0.7.0';
  const CHAT_LINKS = 'a[data-sidebar-item="true"][href*="/c/"],a[href*="/c/"]';
  const PROJECT_LINKS = 'a[data-sidebar-item="true"][href^="/g/g-p-"][href$="/project"],a[href^="/g/g-p-"][href$="/project"]';
  const OWN = '#ng7-rail,#ng7-panel,#ng7-status,#ng7-coach,#ng7-pinned-projects,#ng7-quick,.ng7-bot';
  const LEGACY = new Set([
    'design','ai','ia','coding','code','development','web development','technology','tech',
    'social','social media','writing','general knowledge','general','e-commerce','ecommerce',
    'seo','marketing','business','creative','research','productivity','other','misc','work',
    'education','health','finance','home','cars','gaming','movies','food','personal development'
  ]);
  const STOP = new Set(
    ('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes ' +
     'son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on ' +
     'with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir ' +
     'etre être besoin voudrais veux faudrait faut').split(/\s+/)
  );
  const PALETTE = ['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185'];

  const state = {
    projects: [], projectById: new Map(), projectCounts: new Map(), projectItems: new Map(), projectErrors: new Map(),
    chats: [], chatById: new Map(), profiles: new Map(),
    health: {
      bridge:'ATTENTE', data:'ATTENTE', projects:'ATTENTE', organizer:'ATTENTE', pins:'ATTENTE', quick:'ATTENTE',
      coach:'ATTENTE', toc:'ATTENTE', performance:'ATTENTE', matrix:'ATTENTE', ui:'ATTENTE'
    },
    turns: [], generation:false, wasGenerating:false, heavy:false, indexReady:false, indexRunning:false,
    organizerRunning:false, panelOpen:false, tab:'explorer', nativePins:0,
    observer:null, io:null, scanTimer:0, routeTimer:0, coachTimer:0,
    lastPath:location.pathname, lastTurnCount:-1, lastHeavyCheck:0,
    matrix:null, matrixRAF:0, matrixLastFrame:0, matrixResize:null,
    prefetched:new Set(), errors:[], loadSerial:0
  };

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const isLegacy = p => !!p && LEGACY.has(norm(p.name));
  const primaryProjects = () => state.projects.filter(p=>!isLegacy(p));

  function parseTime(value){
    if(typeof value==='number'&&Number.isFinite(value)) return value>1e12?value:value*1000;
    if(typeof value==='string'){
      const n=Number(value); if(Number.isFinite(n)) return n>1e12?n:n*1000;
      const t=Date.parse(value); return Number.isFinite(t)?t:0;
    }
    return 0;
  }
  function normalizeProjectId(value){
    if(!value||typeof value!=='string') return '';
    const s=value.trim(),m=s.match(/^g-p-([a-f0-9]+)(?:-.+)?$/i);
    return m?`g-p-${m[1]}`:s;
  }
  function projectIdFromHref(href){
    const m=String(href||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i);
    return m?normalizeProjectId(m[1]):'';
  }
  function chatIdFromHref(href){ return String(href||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||''; }
  function colorFor(name){ let h=0; for(const c of String(name)) h=((h<<5)-h+c.charCodeAt(0))|0; return PALETTE[Math.abs(h)%PALETTE.length]; }
  function iconFor(name){
    const s=norm(name);
    if(/code|dev|tech|web|api|github|program|provider/.test(s))return '</>';
    if(/legal|jurid|droit|prud|tribunal|justice/.test(s))return '§';
    if(/finance|argent|budget|banque|credit|compta/.test(s))return '€';
    if(/film|cinema|movie|serie|anime|video/.test(s))return '▶';
    if(/design|logo|image|creative|graph/.test(s))return '◇';
    if(/shop|commerce|store|product|produit|vente/.test(s))return '▣';
    if(/(^|\s)(ai|ia|gpt)(\s|$)|intelligence artificielle/.test(s))return '✦';
    if(/auto|car|voiture|vehicule/.test(s))return '◈';
    if(/health|sante|medical/.test(s))return '+';
    if(/game|gaming|jeu/.test(s))return '◆';
    if(/food|cuisine|recette/.test(s))return '◌';
    if(/social|relation|perso/.test(s))return '◎';
    return '▤';
  }
  function rememberError(scope,error){
    const msg=`${scope}: ${String(error?.message||error).slice(0,150)}`;
    state.errors.unshift(msg); state.errors=state.errors.slice(0,8);
  }
  function setHealth(key,value){ state.health[key]=value; renderStatus(); if(state.panelOpen&&state.tab==='diag')renderPanel(); }

  let rpcSeq=0;
  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng7-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'timeout'});},timeout);
      const handler=e=>{ if(e.detail?.id!==id)return; cleanup(); resolve(e.detail); };
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body}}));
    });
  }

  function projectFromRaw(raw){
    const gizmo=raw?.gizmo?.gizmo||raw?.gizmo||raw;
    const id=normalizeProjectId(gizmo?.id||raw?.id||'');
    const name=String(gizmo?.display?.name||gizmo?.name||raw?.display?.name||'').trim();
    if(!id.startsWith('g-p-')||!name)return null;
    return {
      id,name,description:String(gizmo?.display?.description||gizmo?.description||''),instructions:String(gizmo?.instructions||''),
      color:colorFor(name),icon:iconFor(name),href:`/g/${id}/project`
    };
  }
  function upsertProject(project){
    if(!project?.id)return;
    const old=state.projectById.get(project.id);
    const merged={...old,...project,color:project.color||old?.color||colorFor(project.name),icon:project.icon||old?.icon||iconFor(project.name)};
    state.projectById.set(project.id,merged);
    if(!old)state.projects.push(merged);
    else{const i=state.projects.findIndex(p=>p.id===project.id);if(i>=0)state.projects[i]=merged;}
  }
  function normalizeChat(raw,forcedProject=''){
    const id=String(raw?.id||raw?.conversation_id||''); if(!id)return null;
    return {
      id,title:String(raw?.title||raw?.conversation_title||'Conversation sans titre'),
      projectId:normalizeProjectId(forcedProject||raw?.gizmo_id||raw?.conversation_mode?.gizmo_id||''),
      snippet:String(raw?.snippet||''),updated:parseTime(raw?.update_time||raw?.create_time),href:''
    };
  }
  function upsertChat(chat){
    if(!chat?.id)return;
    const old=state.chatById.get(chat.id);
    const merged={...old,...chat,projectId:chat.projectId||old?.projectId||'',updated:Math.max(old?.updated||0,chat.updated||0),href:chat.href||old?.href||''};
    state.chatById.set(chat.id,merged);
    if(!old)state.chats.push(merged);
    else{const i=state.chats.findIndex(c=>c.id===chat.id);if(i>=0)state.chats[i]=merged;}
  }

  async function fetchAllProjects(){
    const found=new Map(),seenCursor=new Set(); let cursor=null;
    for(let page=0;page<100;page++){
      const qs=new URLSearchParams({conversations_per_gizmo:'0'}); if(cursor!=null)qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`,{timeout:14000});
      if(!r.ok){if(page===0)throw new Error(`Projects HTTP ${r.status||0}`);rememberError('projects-page',r.error||r.status);break;}
      for(const raw of Array.isArray(r.data?.items)?r.data.items:[]){const p=projectFromRaw(raw);if(p)found.set(p.id,p);}
      const next=r.data?.cursor??null; if(next==null)break;
      const key=String(next); if(seenCursor.has(key))break; seenCursor.add(key); cursor=next;
    }
    return [...found.values()];
  }
  async function fetchAllGeneralChats(){
    const out=new Map(); let offset=0; const limit=100;
    for(let page=0;page<100;page++){
      const qs=new URLSearchParams({offset:String(offset),limit:String(limit),order:'updated',expand:'true'});
      const r=await rpc(`/backend-api/conversations?${qs}`,{timeout:15000});
      if(!r.ok){if(page===0)throw new Error(`Conversations HTTP ${r.status||0}`);rememberError('conversations-page',r.error||r.status);break;}
      const items=Array.isArray(r.data?.items)?r.data.items:[];
      for(const raw of items){const c=normalizeChat(raw);if(c)out.set(c.id,c);}
      if(!items.length)break;
      offset+=items.length;
      const total=typeof r.data?.total==='number'?r.data.total:null;
      const hasMore=r.data?.has_more===true||r.data?.hasMore===true;
      if(total!=null&&offset>=total)break;
      if(!hasMore&&items.length<limit)break;
    }
    return [...out.values()];
  }
  async function fetchAllProjectChats(project){
    const out=new Map(),seenCursor=new Set(); let cursor=0;
    for(let page=0;page<200;page++){
      const qs=new URLSearchParams({cursor:String(cursor),limit:'100'});
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?${qs}`,{timeout:14000});
      if(!r.ok)throw new Error(`HTTP ${r.status||0}`);
      const items=Array.isArray(r.data?.items)?r.data.items:[];
      for(const raw of items){const c=normalizeChat(raw,project.id);if(c)out.set(c.id,c);}
      const next=r.data?.cursor??null;
      if(!items.length||next==null)break;
      const key=String(next); if(seenCursor.has(key))break; seenCursor.add(key); cursor=next;
    }
    return [...out.values()];
  }
  async function mapPool(items,limit,worker){
    let cursor=0;
    async function run(){while(cursor<items.length){const i=cursor++;await worker(items[i],i);}}
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  }

  function navRoot(){
    return document.querySelector('[data-testid="conversation-sidebar"]')
      ||document.querySelector('[data-testid="sidebar"]')
      ||document.querySelector('nav')
      ||[...document.querySelectorAll('aside')].find(x=>x.querySelector(CHAT_LINKS)||x.querySelector(PROJECT_LINKS))
      ||null;
  }
  function mergeDOMData(){
    const root=navRoot()||document;
    for(const link of root.querySelectorAll(PROJECT_LINKS)){
      if(!(link instanceof HTMLAnchorElement)||link.closest(OWN))continue;
      const id=projectIdFromHref(link.getAttribute('href'));if(!id)continue;
      const name=(link.getAttribute('aria-label')||link.querySelector('.truncate span')?.textContent||link.textContent||'').trim();if(!name)continue;
      upsertProject({id,name,color:colorFor(name),icon:iconFor(name),href:link.getAttribute('href')||`/g/${id}/project`});
    }
    for(const link of root.querySelectorAll(CHAT_LINKS)){
      if(!(link instanceof HTMLAnchorElement)||link.closest(OWN))continue;
      const id=chatIdFromHref(link.getAttribute('href'));if(!id)continue;
      const title=(link.getAttribute('aria-label')||link.querySelector('.truncate span')?.textContent||link.textContent||id).trim();
      upsertChat({id,title,projectId:projectIdFromHref(link.getAttribute('href')),snippet:'',updated:0,href:link.getAttribute('href')||''});
    }
  }
  function buildProfiles(){
    const profiles=new Map();
    for(const p of state.projects){
      const f=new Map();const add=(txt,w)=>{for(const t of words(txt))f.set(t,(f.get(t)||0)+w);};
      add(p.name,30);add(p.description,10);add(p.instructions,8);profiles.set(p.id,f);
    }
    for(const c of state.chats){const f=profiles.get(c.projectId);if(!f)continue;for(const t of words(`${c.title} ${c.snippet}`))f.set(t,(f.get(t)||0)+2);}
    for(const [pid,map] of state.projectItems){const f=profiles.get(pid);if(!f)continue;for(const c of map.values())for(const t of words(`${c.title} ${c.snippet}`))f.set(t,(f.get(t)||0)+3);}
    state.profiles=profiles;
  }

  async function indexEverything({quiet=false}={}){
    if(state.indexRunning)return false;
    if(state.generation){setHealth('data','PAUSE · génération');return false;}
    state.indexRunning=true;const serial=++state.loadSerial;
    try{
      setHealth('data','INDEXATION · Projects');
      const projects=await fetchAllProjects();if(serial!==state.loadSerial)return false;
      state.projects=[];state.projectById.clear();for(const p of projects)upsertProject(p);mergeDOMData();
      setHealth('bridge','OK');setHealth('projects',`OK · ${state.projects.length}/${state.projects.length}`);renderPinnedProjects();renderPanel();

      setHealth('data','INDEXATION · conversations');
      const general=await fetchAllGeneralChats();if(serial!==state.loadSerial)return false;
      state.chats=[];state.chatById.clear();for(const c of general)upsertChat(c);mergeDOMData();

      state.projectCounts.clear();state.projectItems.clear();state.projectErrors.clear();let done=0;
      setHealth('data',`INDEXATION · Projects 0/${state.projects.length}`);
      await mapPool(state.projects,4,async project=>{
        if(state.generation)await waitUntilIdle(45000);
        try{
          const list=await fetchAllProjectChats(project),map=new Map();
          for(const c of list){map.set(c.id,c);upsertChat(c);}
          state.projectItems.set(project.id,map);state.projectCounts.set(project.id,map.size);
        }catch(error){
          state.projectErrors.set(project.id,String(error?.message||error));state.projectCounts.set(project.id,null);rememberError(`project:${project.name}`,error);
        }
        done++;
        if(done%2===0||done===state.projects.length){setHealth('data',`INDEXATION · Projects ${done}/${state.projects.length}`);if(state.panelOpen)renderPanel();}
      });

      mergeDOMData();buildProfiles();state.indexReady=true;
      const exact=state.projects.filter(p=>state.projectCounts.get(p.id)!=null).length;
      setHealth('projects',`OK · ${state.projects.length}/${state.projects.length} · ${exact} comptés`);
      setHealth('data',`OK · ${state.projects.length} Projects · ${state.chats.length} chats`);
      setHealth('quick',`OK · ${state.projects.length+state.chats.length} entrées`);
      if(!quiet){renderPinnedProjects();decorateSidebar();renderPanel();renderStatus();applyCurrentProjectTheme();}
      return true;
    }catch(error){
      rememberError('index',error);setHealth('data',`ERREUR · ${String(error?.message||error).slice(0,80)}`);
      if(state.health.bridge==='ATTENTE')setHealth('bridge','ERREUR');return false;
    }finally{state.indexRunning=false;}
  }
  async function waitUntilIdle(maxMs){
    const start=Date.now();while(state.generation&&Date.now()-start<maxMs)await sleep(700);
  }

  function escapeRegex(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function scoreText(text,p){
    const s=norm(text),pn=norm(p.name);let score=0;
    if(pn.length>=3&&s.includes(pn))score+=250;
    for(const t of words(p.name))if(new RegExp(`\\b${escapeRegex(t)}\\b`,'i').test(s))score+=38;
    const f=state.profiles.get(p.id)||new Map();for(const t of new Set(words(text)))score+=Math.min(18,f.get(t)||0);
    return score;
  }
  function bestTarget(chat,extra=''){
    const ranked=primaryProjects().map(p=>({project:p,score:scoreText(`${chat.title} ${chat.snippet} ${extra}`,p)})).sort((a,b)=>b.score-a.score);
    const first=ranked[0],second=ranked[1];return first?{...first,margin:first.score-(second?.score||0)}:null;
  }
  function conversationText(data){
    const out=[];for(const node of Object.values(data?.mapping||{})){
      const m=node?.message;if(!m||!['user','assistant'].includes(m?.author?.role))continue;
      const parts=m?.content?.parts;if(Array.isArray(parts))for(const p of parts)if(typeof p==='string')out.push(p);
      if(out.join(' ').length>11000)break;
    }return out.join(' ').slice(0,11000);
  }
  async function moveChat(chat,project){
    const path=`/backend-api/conversation/${encodeURIComponent(chat.id)}`;
    await rpc(path,{method:'PATCH',body:{gizmo_id:project.id},timeout:12000});
    const verify=await rpc(path,{timeout:12000});
    const got=normalizeProjectId(verify.data?.gizmo_id||verify.data?.conversation_mode?.gizmo_id||'');
    if(got!==project.id)return false;
    const old=chat.projectId;chat.projectId=project.id;
    if(old&&state.projectCounts.get(old)!=null)state.projectCounts.set(old,Math.max(0,(state.projectCounts.get(old)||0)-1));
    if(state.projectCounts.get(project.id)!=null)state.projectCounts.set(project.id,(state.projectCounts.get(project.id)||0)+1);
    state.projectItems.get(old)?.delete(chat.id);
    if(!state.projectItems.has(project.id))state.projectItems.set(project.id,new Map());state.projectItems.get(project.id).set(chat.id,chat);
    return true;
  }
  async function repairOrganization({manual=false}={}){
    if(state.organizerRunning||!state.indexReady)return;
    if(state.generation){setHealth('organizer','PAUSE · génération');return;}
    state.organizerRunning=true;let moved=0,analysed=0,ambiguous=0,failed=0,deep=0;
    try{
      const candidates=state.chats.filter(c=>!c.projectId||isLegacy(state.projectById.get(c.projectId))).sort((a,b)=>b.updated-a.updated);
      const batch=manual?candidates:candidates.slice(0,60);
      setHealth('organizer',`EN COURS · 0/${batch.length}`);
      for(let i=0;i<batch.length;i++){
        if(state.generation)break;
        const chat=batch[i],fromLegacy=isLegacy(state.projectById.get(chat.projectId));analysed++;
        let best=bestTarget(chat),threshold=fromLegacy?58:40,margin=fromLegacy?21:14;
        if(!best||best.score<threshold||best.margin<margin){
          if(deep<(manual?100:25)){
            const d=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:9000});deep++;
            if(d.ok){best=bestTarget(chat,conversationText(d.data));threshold=fromLegacy?88:66;margin=fromLegacy?26:19;}
          }
        }
        if(!best||best.score<threshold||best.margin<margin)ambiguous++;
        else if(await moveChat(chat,best.project))moved++;
        else failed++;
        if(i%5===0||i===batch.length-1){setHealth('organizer',`EN COURS · ${i+1}/${batch.length} · ${moved} déplacé${moved>1?'s':''}`);await sleep(0);}
      }
      buildProfiles();
      setHealth('organizer',`OK · ${moved} déplacé${moved>1?'s':''} · ${ambiguous} ambigus${failed?` · ${failed} échec${failed>1?'s':''}`:''}`);
      renderPinnedProjects();decorateSidebar();renderPanel();
    }catch(error){rememberError('organizer',error);setHealth('organizer',`ERREUR · ${String(error?.message||error).slice(0,80)}`);}
    finally{state.organizerRunning=false;}
  }

  function currentChatId(){return chatIdFromHref(location.pathname);}
  function currentProject(){
    const fromPath=projectIdFromHref(location.pathname),direct=state.projectById.get(fromPath);if(direct)return direct;
    const chat=state.chatById.get(currentChatId());return chat?state.projectById.get(chat.projectId)||null:null;
  }
  function applyCurrentProjectTheme(){
    const p=currentProject();document.documentElement.style.setProperty('--ng7-current-project',p?.color||'#3794ff');document.documentElement.dataset.ng7Project=p?.id||'';
  }

  function findPinnedHeading(root){return [...root.querySelectorAll('div,span,h2,h3,p')].find(x=>/^(épinglés|epingles|pinned)$/i.test((x.textContent||'').trim()));}
  function projectRecency(id){let t=0;for(const c of state.chats)if(c.projectId===id)t=Math.max(t,c.updated||0);return t;}
  function sortedProjects(){
    return [...state.projects].sort((a,b)=>{
      const la=isLegacy(a),lb=isLegacy(b);if(la!==lb)return la?1:-1;
      const ca=state.projectCounts.get(a.id),cb=state.projectCounts.get(b.id);if((ca>0)!==(cb>0))return ca>0?-1:1;
      return projectRecency(b.id)-projectRecency(a.id)||a.name.localeCompare(b.name,'fr');
    });
  }
  function nativePinnedProjectIds(){
    const root=navRoot(),heading=root&&findPinnedHeading(root);if(!root||!heading)return new Set();const ids=new Set();
    let n=heading.parentElement;for(let i=0;i<5&&n;i++,n=n.parentElement){for(const a of n.querySelectorAll(PROJECT_LINKS)){const id=projectIdFromHref(a.getAttribute('href'));if(id)ids.add(id);}if(ids.size)break;}return ids;
  }
  function renderPinnedProjects(){
    const root=navRoot();if(!root||!state.projects.length)return;root.classList.add('ng7-navroot');
    document.getElementById('ng7-pinned-projects')?.remove();const projects=sortedProjects(),box=document.createElement('section');box.id='ng7-pinned-projects';
    box.innerHTML=`<div class="ng7-pin-head"><span>ÉPINGLÉS · PROJECTS</span><b>${projects.length}</b></div><div class="ng7-pin-list">${projects.map(p=>{
      const count=state.projectCounts.has(p.id)?state.projectCounts.get(p.id):'…';
      return `<a href="${esc(p.href||`/g/${p.id}/project`)}" data-ng7-managed-project="1" data-legacy="${isLegacy(p)?'1':'0'}" style="--ng-project:${p.color}" title="${esc(p.name)}"><span class="ng7-proj-icon">${esc(p.icon)}</span><span class="ng7-pin-name">${esc(p.name)}</span><small>${count==null?'?':count}</small></a>`;
    }).join('')}</div>`;
    const heading=findPinnedHeading(root),projectEntry=[...root.querySelectorAll('a,button')].find(x=>/^(projets|projects)$/i.test((x.textContent||'').trim()));
    const anchor=heading?.parentElement||projectEntry||root.firstElementChild;
    if(anchor?.parentElement)anchor.insertAdjacentElement('afterend',box);else root.prepend(box);
    const native=nativePinnedProjectIds();setHealth('pins',`OK · ${projects.length}/${projects.length} NiakGPT · ${native.size}/${projects.length} natifs`);
  }
  function rowWrap(link){return link.closest('li')||link.closest('[data-testid]')||link.parentElement||link;}
  function decorateSidebar(){
    const root=navRoot();if(!root)return;root.classList.add('ng7-navroot');
    const chatLinks=[...root.querySelectorAll(CHAT_LINKS)].filter(a=>!a.closest(OWN));let idx=0;
    for(const link of chatLinks){
      const id=chatIdFromHref(link.getAttribute('href'));if(!id)continue;const chat=state.chatById.get(id),project=chat?state.projectById.get(chat.projectId):null,row=rowWrap(link);
      row.classList.add('ng7-chat-row');row.dataset.ng7Zebra=String(idx++%2);row.style.setProperty('--ng-project',project?.color||'#607080');
      link.dataset.ng7Chat='1';link.style.setProperty('--ng-project',project?.color||'#607080');link.classList.toggle('ng7-current',id===currentChatId());
      let badge=link.querySelector(':scope > .ng7-chat-project');if(project&&!badge){badge=document.createElement('span');badge.className='ng7-chat-project';link.appendChild(badge);}if(badge){badge.textContent=project?.name||'';badge.style.setProperty('--ng-project',project?.color||'#607080');badge.hidden=!project;}
    }
    for(const link of [...root.querySelectorAll(PROJECT_LINKS)].filter(a=>!a.closest(OWN))){
      const id=projectIdFromHref(link.getAttribute('href')),project=state.projectById.get(id);if(!project)continue;const row=rowWrap(link);row.classList.add('ng7-project-row');row.dataset.ng7Icon=project.icon;row.style.setProperty('--ng-project',project.color);row.classList.toggle('ng7-legacy',isLegacy(project));row.classList.toggle('ng7-empty-legacy',isLegacy(project)&&state.projectCounts.get(project.id)===0);link.dataset.ng7Project='1';link.style.setProperty('--ng-project',project.color);
    }
  }
  async function tryNativePins(){
    const root=navRoot(),projects=sortedProjects();if(!root||!projects.length)return;let attempted=0,clicked=0;
    for(const p of projects){
      if(nativePinnedProjectIds().has(p.id))continue;
      const link=[...root.querySelectorAll(PROJECT_LINKS)].filter(a=>!a.closest('#ng7-pinned-projects')).find(a=>projectIdFromHref(a.getAttribute('href'))===p.id);if(!link)continue;
      const row=rowWrap(link);row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(70);
      const buttons=[...row.querySelectorAll('button')],menu=buttons.find(b=>/more|options|menu|davantage|plus/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);if(!menu)continue;
      attempted++;menu.click();await sleep(100);
      const item=[...document.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="option"]')].find(x=>/^(épingler|epingler|pin)\b/i.test((x.textContent||'').trim()));
      if(item){item.click();clicked++;await sleep(120);}else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    }
    const native=nativePinnedProjectIds();state.nativePins=native.size;setHealth('pins',`OK · ${projects.length}/${projects.length} NiakGPT · ${native.size}/${projects.length} natifs${attempted?` · ${clicked}/${attempted} clics`:''}`);renderPinnedProjects();
  }

  function getTurns(){const set=new Set();document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').forEach(x=>set.add(x));return [...set].filter(x=>x instanceof HTMLElement&&x.textContent?.trim());}
  function roleOf(turn){return turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';}
  function enhanceCode(root){
    root.querySelectorAll('pre').forEach(pre=>{if(pre.dataset.ng7Code)return;pre.dataset.ng7Code='1';const code=pre.querySelector('code'),cls=code?.className||'',lang=(cls.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase(),lines=(code?.innerText||pre.innerText||'').split('\n').length;
      const bar=document.createElement('div');bar.className='ng7-codebar';bar.innerHTML=`<span><i>●</i> ${esc(lang)} · ${lines} lignes</span><button type="button">COPIER</button>`;bar.querySelector('button').onclick=async()=>navigator.clipboard.writeText(code?.innerText||pre.innerText||'');pre.prepend(bar);});
  }
  function ensureIO(){
    if(state.io)return;state.io=new IntersectionObserver(entries=>{for(const e of entries)e.target.classList.toggle('ng7-offscreen',!e.isIntersecting);},{rootMargin:'1400px 0px'});
  }
  function decorateTurns({light=false}={}){
    const turns=getTurns();state.turns=turns;state.heavy=turns.length>=75||document.querySelectorAll('pre,table,.katex-display,mjx-container').length>=45;document.documentElement.dataset.ng7Heavy=state.heavy?'1':'0';
    const start=light?Math.max(0,turns.length-4):0;ensureIO();
    for(let i=start;i<turns.length;i++){const t=turns[i];t.dataset.ng7Turn=String(i);t.dataset.ng7Role=roleOf(t)||'unknown';t.dataset.ng7Zebra=String(i%2);enhanceCode(t);t.classList.add('ng7-perf');if(i<turns.length-12&&!t.dataset.ng7Observed){t.dataset.ng7Observed='1';state.io.observe(t);}}
    setHealth('toc',turns.length?`OK · ${turns.length}`:'ATTENTE');setHealth('performance',`OK · ${turns.length}${state.heavy?' · LOURD':''}`);if(state.panelOpen&&state.tab==='toc'&&!light)renderPanel();
  }

  function findComposer(){
    const editors=[...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>240&&r.height>18&&r.bottom>innerHeight*.45;});
    const editor=editors.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];if(!editor)return null;
    const form=editor.closest('form')||editor.closest('[data-type="unified-composer"]')||editor.closest('[class*="composer"]')||editor.parentElement;return {editor,form,shell:form?.parentElement||form};
  }
  function editorText(e){return e instanceof HTMLTextAreaElement?e.value:(e.innerText||e.textContent||'');}
  function recentContext(){return state.turns.slice(-5).map(t=>t.innerText||t.textContent||'').join(' ').slice(-6500);}
  function subjectFrom(prompt){const clean=String(prompt||'').replace(/\s+/g,' ').trim();if(!clean)return'ce point';const parts=clean.split(/[.!?;\n]+/).map(x=>x.trim()).filter(Boolean);let c=parts.at(-1)||clean;return c.length>80?c.slice(0,77)+'…':c;}
  function suggestionSet(prompt){
    const context=norm(`${prompt} ${recentContext()}`),pn=norm(prompt),subject=subjectFrom(prompt),project=currentProject(),scope=project?` dans « ${project.name} »`:'';const out=[];const add=(kind,title,text)=>{if(!out.some(x=>x.text===text))out.push({kind,title,text});};
    if(/bug|erreur|marche pas|fonctionne pas|chevauch|overlap|dom|extension|javascript|css|code/.test(context)){add('code','Cause racine',`Pour « ${subject} », identifie la cause racine${scope} avant de modifier le code.`);add('test','Tests runtime',`Teste « ${subject} » avec navigation SPA, gros fil, resize et pièces jointes.`);add('perf','Régression',`Vérifie que « ${subject} » n’ajoute ni double injection, ni boucle DOM, ni reflow coûteux.`);}
    if(/image|photo|fichier|piece jointe|upload|attachment/.test(context))add('ux','Pièces jointes',`Pour « ${subject} », adapte l’UI aux previews sans recouvrir le composer ni les médias.`);
    if(/design|da|couleur|fond|interface|ux|ui|styl|icone/.test(context)){add('design','DA système',`Pour « ${subject} », harmonise fonds, textes, icônes, hover, actif et exécution comme un seul langage visuel.`);add('ux','Lisibilité',`Sur « ${subject} », garde contraste, densité et scan visuel prioritaires sur l’effet décoratif.`);}
    if(/projet|project|class|rang|dossier|organis|epingle|pin/.test(context)){add('organize','Organisation',`Pour « ${subject} », protège les vrais Projects, répare les catégories génériques et vérifie chaque déplacement.`);add('table','Audit',`Pour « ${subject} », contrôle les compteurs Projects/chats et les éléments réellement indexés.`);}
    if(/cherche|verifie|actuel|recent|prix|tarif|loi|regle|source/.test(context))add('research','Sources',`Pour « ${subject} », vérifie les informations actuelles avec des sources primaires.`);
    if(/compar| vs |versus/.test(` ${context} `))add('table','Comparaison',`Compare « ${subject} » dans un tableau dense : critères, avantages, limites, coût, risque et décision.`);
    if(/long|resume|synthese|trop long/.test(context))add('summary','Synthèse',`Pour « ${subject} », commence par la conclusion courte puis garde seulement ce qui change la décision.`);
    if(!out.length&&pn.length>3){add('focus','Objectif',`Traite précisément « ${subject} »${scope} et élimine ce qui n’aide pas l’exécution.`);add('blind','Angles morts',`Sur « ${subject} », signale les hypothèses et angles morts capables de changer le résultat.`);add('action','Prochaine action',`Termine « ${subject} » par l’action concrète la plus utile maintenant.`);}
    return out.slice(0,4);
  }
  function appendPrompt(editor,text){
    editor.focus();if(editor instanceof HTMLTextAreaElement){const sep=editor.value.trim()?'\n\n':'',s=editor.selectionStart??editor.value.length,e=editor.selectionEnd??editor.value.length;editor.setRangeText(`${sep}${text}`,s,e,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));return;}
    const sel=getSelection(),r=document.createRange();r.selectNodeContents(editor);r.collapse(false);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,`${editorText(editor).trim()?'\n\n':''}${text}`);editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
  }
  function ensureCoach(){
    if(state.generation){document.getElementById('ng7-coach')?.setAttribute('hidden','');return;}
    const c=findComposer();if(!c?.editor||!c.form||!c.shell){setHealth('coach','ATTENTE');return;}
    let box=document.getElementById('ng7-coach');if(box&&box.parentElement!==c.shell){box.remove();box=null;}
    if(!box){box=document.createElement('div');box.id='ng7-coach';c.shell.insertBefore(box,c.form);}
    const prompt=editorText(c.editor),items=suggestionSet(prompt),attachments=c.form.querySelectorAll('img,[data-testid*="attachment"],[class*="attachment"],[data-testid*="file"],[class*="file"]:not(input)').length;
    box.classList.toggle('compact',attachments>0||c.form.getBoundingClientRect().height>185);box.dataset.attachments=String(attachments);box.hidden=prompt.trim().length<4||!items.length;
    box.innerHTML=`<div class="ng7-coach-label">✦ NIAKGPT · RECO${attachments?` · ${attachments} PJ`:''}</div><div class="ng7-sug-grid">${items.map((x,i)=>`<button type="button" data-i="${i}" class="ng7-sug ng7-${x.kind}"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>appendPrompt(c.editor,items[Number(b.dataset.i)].text));setHealth('coach','OK');
  }

  function ensureMatrix(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setHealth('matrix','OFF');return;}
    const host=document.querySelector('main')||document.body;if(!host)return;
    if(state.matrix?.isConnected&&state.matrix.parentElement===host)return;
    state.matrix?.remove();if(state.matrixRAF)cancelAnimationFrame(state.matrixRAF);
    const canvas=document.createElement('canvas');canvas.id='ng7-matrix';host.prepend(canvas);state.matrix=canvas;const ctx=canvas.getContext('2d',{alpha:true});let cols=[],w=0,h=0;
    const resize=()=>{const r=host.getBoundingClientRect(),scale=.52;w=canvas.width=Math.max(1,Math.floor(r.width*scale));h=canvas.height=Math.max(1,Math.floor(innerHeight*scale));canvas.style.width=`${Math.max(1,r.width)}px`;canvas.style.height=`${innerHeight}px`;cols=Array(Math.ceil(w/10)).fill(0).map(()=>Math.random()*h);};resize();state.matrixResize=resize;
    const chars='01アイウエオカキクケコｱｲｳｴｵ<>[]{}▓░λΣ∞';
    const draw=t=>{state.matrixRAF=requestAnimationFrame(draw);const minGap=state.generation?(state.heavy?240:130):58;if(document.hidden||t-state.matrixLastFrame<minGap)return;state.matrixLastFrame=t;ctx.fillStyle='rgba(3,9,7,.10)';ctx.fillRect(0,0,w,h);ctx.font='10px ui-monospace,Consolas,monospace';for(let i=0;i<cols.length;i++){const bright=Math.random()>.977;ctx.fillStyle=bright?'rgba(205,255,216,.90)':'rgba(39,242,96,.55)';ctx.fillText(chars[(Math.random()*chars.length)|0],i*10,cols[i]);cols[i]+=8.3;if(cols[i]>h&&Math.random()>.965)cols[i]=0;}};
    state.matrixRAF=requestAnimationFrame(draw);setHealth('matrix','OK');
  }
  function botSVG(){return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l8 11-3 25-9 8H22l-9-8-3-25z" fill="#8b949e" stroke="#d0d7de" stroke-width="2"/><path d="M18 19h28l4 7-5 10H19l-5-10z" fill="#151b22"/><circle cx="24" cy="28" r="4" fill="#ff3b30"/><circle cx="40" cy="28" r="4" fill="#ff3b30"/><path d="M24 41h16v10H24z" fill="#343b43"/><path d="M27 43v6m5-6v6m5-6v6" stroke="#c7d0d9" stroke-width="2"/></svg>`;}
  function ensureBots(){if(!document.body||document.getElementById('ng7-bot-a'))return;for(const [id,title]of[['ng7-bot-a',"I'll be back."],['ng7-bot-b','Skynet online.'],['ng7-bot-c','T-800-ish.']]){const d=document.createElement('div');d.id=id;d.className='ng7-bot';d.innerHTML=botSVG();d.title=title;document.body.appendChild(d);}}

  function brand(){
    if(document.title.includes('ChatGPT'))document.title=document.title.replace(/ChatGPT/g,'NiakGPT');
    const candidates=[...document.querySelectorAll('header a,header button,header span,nav a,nav button,nav span')].filter(el=>{const r=el.getBoundingClientRect();return r.top<90&&r.left<350&&r.width&&r.height&&(el.textContent||'').trim()==='ChatGPT';});
    const el=candidates.sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width)[0];if(!el)return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(node.nodeValue?.trim()==='ChatGPT'){node.nodeValue=node.nodeValue.replace('ChatGPT','NiakGPT');el.dataset.ng7Brand='1';break;}
  }

  function isGenerating(){return [...document.querySelectorAll('button,[data-testid]')].filter(el=>el.getBoundingClientRect().width).some(el=>/stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''}`));}
  function markRunning(){
    state.wasGenerating=state.generation;state.generation=isGenerating();document.documentElement.dataset.ng7Running=state.generation?'1':'0';
    const p=currentProject(),cid=currentChatId();
    document.querySelectorAll('[data-ng7-managed-project="1"],.ng7-project-row').forEach(x=>x.classList.toggle('ng7-running',!!state.generation&&!!p&&(((x.getAttribute?.('href')||'').includes(p.id))||!!x.querySelector?.(`a[href*="${p.id}"]`))));
    document.querySelectorAll('[data-ng7-chat="1"],.ng7-chat-row').forEach(x=>x.classList.toggle('ng7-running',!!state.generation&&!!cid&&(((x.getAttribute?.('href')||'').includes(cid))||!!x.querySelector?.(`a[href*="${cid}"]`))));
    if(state.wasGenerating&&!state.generation){scheduleFullScan(250);setTimeout(async()=>{await indexEverything({quiet:true});await repairOrganization({manual:false});renderPinnedProjects();decorateSidebar();},1400);}
    renderStatus();
  }

  function ensureShell(){
    if(!document.body||document.getElementById('ng7-rail'))return;
    const rail=document.createElement('aside');rail.id='ng7-rail';rail.innerHTML=`<button data-tab="explorer" title="Explorer / Projects">▤</button><button data-tab="toc" title="Sommaire">☷</button><button data-tab="diag" title="Diagnostic">◉</button><span></span><button data-action="quick" title="Quick Open · Alt+K">⌘</button>`;document.body.appendChild(rail);
    const panel=document.createElement('aside');panel.id='ng7-panel';document.body.appendChild(panel);const status=document.createElement('div');status.id='ng7-status';document.body.appendChild(status);document.body.classList.add('ng7-ready');
    rail.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const tab=b.dataset.tab;state.panelOpen=!(state.panelOpen&&state.tab===tab);state.tab=tab;renderPanel();});rail.querySelector('[data-action="quick"]').onclick=openQuick;setHealth('ui','OK');
  }
  function renderStatus(){
    const s=document.getElementById('ng7-status');if(!s)return;const p=currentProject(),err=Object.values(state.health).some(v=>String(v).startsWith('ERREUR'));
    s.classList.toggle('running',state.generation);s.innerHTML=`<span><b>NiakGPT</b> ${VERSION}</span><span class="ng7-status-project">${esc(p?.name||'Hors projet')}</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng7-health">${state.generation?'EXÉCUTION':err?'DIAGNOSTIC':'PRÊT'}</span>`;s.querySelector('[data-q]').onclick=openQuick;applyCurrentProjectTheme();
  }
  function renderPanel(){
    const panel=document.getElementById('ng7-panel');if(!panel)return;panel.classList.toggle('open',state.panelOpen);document.body.classList.toggle('ng7-panel-open',state.panelOpen);document.querySelectorAll('#ng7-rail [data-tab]').forEach(b=>b.classList.toggle('active',state.panelOpen&&b.dataset.tab===state.tab));if(!state.panelOpen)return;
    if(state.tab==='diag'){
      panel.innerHTML=`<header><div><small>DIAGNOSTIC</small><b>État réel des modules</b></div><button>×</button></header><div class="ng7-diag">${Object.entries(state.health).map(([k,v])=>`<div><span>${esc(k)}</span><b class="${String(v).startsWith('OK')?'ok':String(v).startsWith('ERREUR')?'err':'wait'}">${esc(v)}</b></div>`).join('')}</div>${state.errors.length?`<details class="ng7-errors"><summary>Dernières erreurs</summary>${state.errors.map(e=>`<code>${esc(e)}</code>`).join('')}</details>`:''}<div class="ng7-private-joke">☠ SYSTEM // SKYNET</div>`;
    }else if(state.tab==='toc'){
      panel.innerHTML=`<header><div><small>SOMMAIRE</small><b>${state.turns.length} blocs</b></div><button>×</button></header><input id="ng7-toc-search" placeholder="Filtrer le fil…"><div class="ng7-toc">${state.turns.map((t,i)=>`<button data-turn="${i}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc((t.innerText||t.textContent||'').replace(/\s+/g,' ').slice(0,128))}</span></button>`).join('')}</div>`;
    }else{
      const projects=sortedProjects();
      panel.innerHTML=`<header><div><small>EXPLORER</small><b>${state.projects.length} Projects · ${state.chats.length} chats</b></div><button>×</button></header><div class="ng7-actions"><button data-repair>Réparer le classement</button><button data-refresh>Réindexer</button></div><input id="ng7-project-search" placeholder="Filtrer les Projects…"><div class="ng7-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${projects.map(p=>{const count=state.projectCounts.has(p.id)?state.projectCounts.get(p.id):'…';return `<a href="${esc(p.href||`/g/${p.id}/project`)}" data-project-name="${esc(norm(p.name))}" style="--ng-project:${p.color}" class="${isLegacy(p)?'legacy':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><b>${count==null?'?':count}</b></a>`;}).join('')}</div>`;
    }
    panel.querySelector('header button')?.addEventListener('click',()=>{state.panelOpen=false;renderPanel();});panel.querySelector('[data-repair]')?.addEventListener('click',()=>repairOrganization({manual:true}));panel.querySelector('[data-refresh]')?.addEventListener('click',async()=>{await indexEverything();renderPanel();tryNativePins();});panel.querySelectorAll('[data-turn]').forEach(b=>b.onclick=()=>state.turns[Number(b.dataset.turn)]?.scrollIntoView({behavior:'smooth',block:'center'}));
    const tq=panel.querySelector('#ng7-toc-search');if(tq)tq.oninput=()=>{const q=norm(tq.value);panel.querySelectorAll('[data-turn]').forEach(b=>b.hidden=!!q&&!norm(b.textContent).includes(q));};
    const pq=panel.querySelector('#ng7-project-search');if(pq)pq.oninput=()=>{const q=norm(pq.value);panel.querySelectorAll('.ng7-project-table a').forEach(a=>a.hidden=!!q&&!String(a.dataset.projectName||'').includes(q));};
  }

  function routeTo(href){
    if(!href)return;const existing=[...document.querySelectorAll(`a[href="${CSS.escape(href)}"]`)].find(a=>!a.closest(OWN));if(existing){existing.click();return;}location.href=href;
  }
  function chatHref(chat){return chat.href|| (chat.projectId?`/g/${chat.projectId}/c/${chat.id}`:`/c/${chat.id}`);}
  async function prefetch(chat){if(!chat?.id||state.prefetched.has(chat.id))return;state.prefetched.add(chat.id);await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:6000});}
  function openQuick(){
    document.getElementById('ng7-quick')?.remove();const modal=document.createElement('div');modal.id='ng7-quick';modal.innerHTML=`<div><input autofocus placeholder="Quick Open — Projects & conversations"><section></section><footer>${state.projects.length} Projects · ${state.chats.length} chats · Alt+K · ↑↓ · Entrée · Échap</footer></div>`;document.body.appendChild(modal);
    const input=modal.querySelector('input'),list=modal.querySelector('section');let items=[],selected=0;
    const paint=()=>{
      const q=norm(input.value),projectItems=sortedProjects().filter(p=>!q||norm(p.name).includes(q)).map(p=>({type:'project',title:p.name,subtitle:`Project · ${state.projectCounts.get(p.id)??'?' } chats`,color:p.color,href:p.href||`/g/${p.id}/project`,project:p}));
      const chatItems=state.chats.filter(c=>{const p=state.projectById.get(c.projectId);return !q||norm(`${c.title} ${c.snippet} ${p?.name||''}`).includes(q);}).sort((a,b)=>b.updated-a.updated).slice(0,q?100:70).map(c=>{const p=state.projectById.get(c.projectId);return {type:'chat',title:c.title,subtitle:p?.name||'Hors projet',color:p?.color||'#607080',href:chatHref(c),chat:c};});
      items=[...projectItems,...chatItems].slice(0,120);selected=Math.min(selected,Math.max(0,items.length-1));
      list.innerHTML=items.map((x,i)=>`<button class="${i===selected?'sel':''}" data-i="${i}"><i style="--ng-project:${x.color}"></i><span>${esc(x.title)}</span><small>${esc(x.subtitle)}</small><em>${x.type==='project'?'PROJECT':'CHAT'}</em></button>`).join('');
      list.querySelectorAll('button').forEach(b=>{const x=items[Number(b.dataset.i)];b.onmouseenter=()=>x.chat&&prefetch(x.chat);b.onclick=()=>routeTo(x.href);});
    };
    input.oninput=()=>{selected=0;paint();};input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(selected+1,items.length-1);paint();}if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);paint();}if(e.key==='Enter'&&items[selected]){e.preventDefault();routeTo(items[selected].href);}if(e.key==='Escape')modal.remove();};modal.onmousedown=e=>{if(e.target===modal)modal.remove();};paint();setTimeout(()=>input.focus(),0);setHealth('quick',`OK · ${state.projects.length+state.chats.length} entrées`);
  }

  function scanVisual({light=false}={}){
    if(!document.body)return;ensureShell();brand();ensureMatrix();ensureBots();markRunning();decorateTurns({light:light||state.generation});
    if(!state.generation){decorateSidebar();renderPinnedProjects();ensureCoach();}else document.getElementById('ng7-coach')?.setAttribute('hidden','');
    renderStatus();applyCurrentProjectTheme();
  }
  function scheduleFullScan(delay=120){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(()=>scanVisual({light:false}),delay);}
  function scheduleLightScan(delay=700){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(()=>scanVisual({light:true}),delay);}
  function meaningfulMutation(records){
    return records.some(r=>{const el=r.target?.nodeType===1?r.target:r.target?.parentElement;if(el?.closest?.(OWN))return false;const nodes=[...(r.addedNodes||[]),...(r.removedNodes||[])];return !nodes.length||nodes.some(n=>!(n.nodeType===1&&n.closest?.(OWN)));});
  }
  function bindRuntime(){
    if(state.observer)return;
    state.observer=new MutationObserver(records=>{
      if(!meaningfulMutation(records))return;
      markRunning();
      if(location.pathname!==state.lastPath){state.lastPath=location.pathname;scheduleFullScan(50);clearTimeout(state.routeTimer);state.routeTimer=setTimeout(async()=>{if(!state.generation){await indexEverything({quiet:true});renderPinnedProjects();decorateSidebar();}},1600);return;}
      if(state.generation)scheduleLightScan(state.heavy?1300:750);else scheduleFullScan(140);
    });
    state.observer.observe(document.documentElement,{subtree:true,childList:true});
    document.addEventListener('input',e=>{if(e.target?.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||e.target?.isContentEditable){clearTimeout(state.coachTimer);state.coachTimer=setTimeout(ensureCoach,65);}},true);
    document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();openQuick();}},true);
    addEventListener('resize',()=>{state.matrixResize?.();state.generation?scheduleLightScan(100):scheduleFullScan(100);},{passive:true});
    setInterval(markRunning,650);
    setInterval(async()=>{if(!state.generation){await indexEverything({quiet:true});await repairOrganization({manual:false});}},8*60*1000);
  }

  async function bootData(){
    const ok=await indexEverything();if(ok){renderPinnedProjects();decorateSidebar();setTimeout(()=>repairOrganization({manual:false}),600);setTimeout(tryNativePins,1600);}
  }
  function bootstrap(){
    const start=()=>{ensureShell();ensureMatrix();ensureBots();brand();bindRuntime();for(let i=0;i<6;i++)setTimeout(()=>scanVisual({light:i<2}),i*180);setTimeout(bootData,250);};
    if(document.body)start();else{const mo=new MutationObserver(()=>{if(document.body){mo.disconnect();start();}});mo.observe(document.documentElement,{childList:true,subtree:true});}
  }
  bootstrap();
})();
