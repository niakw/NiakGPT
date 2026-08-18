(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_FOLDERS_110__) return;
  window.__NIAKGPT_PROJECT_FOLDERS_110__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  const PIN_SEL='#ng8-pins a[data-ng8-pin="1"]';
  const SESSION_KEY='niakgpt-open-pin-folder-v096';
  let cache={projects:[],chats:[],projectChats:{}};
  let outState={out:{}};
  let openPid='';
  let filter='';
  let observer=null,observedBox=null,rootObserver=null,bootstrapObserver=null,renderTimer=0,activeTimer=0,internalWrite=false,rpcSeq=0;

  try{openPid=sessionStorage.getItem(SESSION_KEY)||'';}catch{}

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]{8,})/i)?.[1]||'';
  const currentCid=()=>cidFromHref(location.pathname);
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const fmt=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date(),base=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;return d.getFullYear()===now.getFullYear()?base:`${base}/${String(d.getFullYear()).slice(-2)}`;};
  const drawerId=pid=>`ng96-folder-${String(pid||'').replace(/[^A-Za-z0-9_-]/g,'')}`;

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng110f-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  function projectSnapshotSignature(raw,pid){
    if(!pid)return'';
    const direct=Array.isArray(raw?.projectChats?.[pid])?raw.projectChats[pid]:[];
    const source=direct.length?direct:(raw?.chats||[]).filter(c=>c?.projectId===pid);
    const chats=source.map(c=>[c?.id,c?.updated||c?.update_time||c?.create_time||0,c?.title||'',!!c?.out]);
    return JSON.stringify([raw?.counts?.[pid]??null,chats]);
  }
  function outSignature(state,pid){
    const ids=new Set(chatsForRaw(cache,pid).map(c=>c.id));
    return JSON.stringify([...ids].filter(id=>state?.out?.[id]).sort());
  }
  function chatsForRaw(raw,pid){
    const direct=Array.isArray(raw?.projectChats?.[pid])?raw.projectChats[pid]:[];
    const source=direct.length?direct:(raw?.chats||[]).filter(c=>c?.projectId===pid);
    const map=new Map();
    for(const c of source){
      if(!c?.id)continue;
      const old=map.get(c.id)||{};
      const updated=Math.max(parseTime(old.updated||old.update_time),parseTime(c.updated||c.update_time||c.create_time));
      map.set(c.id,{...old,...c,updated});
    }
    return [...map.values()];
  }
  function isOut(c){return !!(c?.out||outState?.out?.[c?.id]);}
  function chatsFor(pid){
    return chatsForRaw(cache,pid).sort((a,b)=>{
      const ao=isOut(a)?1:0,bo=isOut(b)?1:0;
      if(ao!==bo)return ao-bo;
      return (b.updated||0)-(a.updated||0)||String(a.title||'').localeCompare(String(b.title||''),'fr');
    });
  }

  function acceptCache(next){
    const before=projectSnapshotSignature(cache,openPid);
    cache=next&&typeof next==='object'?next:cache;
    const after=projectSnapshotSignature(cache,openPid);
    if(!observedBox)bindBox();
    if(openPid&&before!==after)schedule(24);
    else if(!openPid)schedule(60);
  }
  function acceptOut(next){
    const before=outSignature(outState,openPid);
    outState=next&&typeof next==='object'?next:{out:{}};outState.out=outState.out||{};
    const after=outSignature(outState,openPid);
    if(openPid&&before!==after)schedule(20);else scheduleActive(0);
  }
  function setOpen(pid){openPid=pid||'';filter='';try{openPid?sessionStorage.setItem(SESSION_KEY,openPid):sessionStorage.removeItem(SESSION_KEY);}catch{}}
  function projectHref(pid){return cache.projects?.find(p=>p?.id===pid)?.href||`/g/${pid}/project`;}
  function chatHref(c,pid){return c?.href||`/g/${pid}/c/${c.id}`;}

  function scheduleActive(delay=20){
    clearTimeout(activeTimer);activeTimer=setTimeout(()=>{activeTimer=0;applyActiveState();},delay);
  }
  function applyActiveState(){
    const id=currentCid();
    for(const row of document.querySelectorAll('#ng8-pins .ng109-chat-row[data-chat-row]')){
      const active=row.dataset.chatRow===id;
      const link=row.querySelector(':scope > a[data-chat]');
      if(active){row.dataset.ng109Active='1';if(link){link.dataset.ng109Active='1';link.setAttribute('aria-current','page');}}
      else{delete row.dataset.ng109Active;if(link){delete link.dataset.ng109Active;link.removeAttribute('aria-current');}}
    }
  }
  function routeNative(href){
    const chatId=cidFromHref(href),projectId=pidFromHref(href);
    const links=[...document.querySelectorAll('a[href]')].filter(a=>!a.closest('#ng8-pins,#ng8-panel,#ng8-quick,#ng90-control,#ng100-command'));
    const native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cidFromHref(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pidFromHref(a.getAttribute('href'))===projectId&&/\/project(?:$|\?)/.test(a.getAttribute('href')||'')):null);
    if(native instanceof HTMLElement){native.click();scheduleActive(20);setTimeout(()=>scheduleActive(0),140);return;}
    location.assign(href);
  }

  async function updateCacheTitle(chatId,title){
    const update=raw=>{
      raw=raw&&typeof raw==='object'?raw:{};
      const chats=(raw.chats||[]).map(c=>c?.id===chatId?{...c,title}:c);
      const projectChats={...(raw.projectChats||{})};
      for(const [pid,list] of Object.entries(projectChats))projectChats[pid]=(list||[]).map(c=>c?.id===chatId?{...c,title}:c);
      return{...raw,at:Date.now(),chats,projectChats};
    };
    try{
      const bus=window.__NIAKGPT_CACHE_BUS__;
      if(bus?.update)await bus.update(update);
      else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];await chrome.storage.local.set({[CACHE_KEY]:update(raw)});}
    }catch{}
  }
  async function renameChat(chatId,oldTitle){
    const next=clean(window.prompt('Renommer la conversation',oldTitle));
    if(!next||next===oldTitle)return;
    const result=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});
    if(!result?.ok){window.__NIAKGPT_DIAGNOSTICS__?.set('renommage',`ERREUR · ${result?.status||0}`);return;}
    await updateCacheTitle(chatId,next);
    window.__NIAKGPT_DIAGNOSTICS__?.set('renommage','OK · conversation renommée');
  }

  function rowFor(anchor){return anchor.closest('.ng96-pin-entry');}
  function wrapAnchor(anchor){
    if(!(anchor instanceof HTMLElement)||anchor.closest('.ng96-pin-entry'))return rowFor(anchor);
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return null;
    const entry=document.createElement('div');entry.className='ng96-pin-entry';entry.dataset.pid=pid;
    anchor.parentElement?.insertBefore(entry,anchor);entry.appendChild(anchor);
    const open=document.createElement('button');open.type='button';open.className='ng96-project-open';open.textContent='↗';open.title='Ouvrir la page complète du Project';open.setAttribute('aria-label','Ouvrir la page complète du Project');entry.appendChild(open);
    return entry;
  }
  function decorateAnchor(anchor){
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return;
    const entry=wrapAnchor(anchor);if(!entry)return;
    anchor.dataset.ng96Folder='1';anchor.setAttribute('role','button');anchor.setAttribute('aria-haspopup','true');anchor.setAttribute('aria-controls',drawerId(pid));anchor.setAttribute('aria-expanded',pid===openPid?'true':'false');anchor.title='Afficher les conversations du Project';
    let chevron=anchor.querySelector(':scope > .ng96-chevron');if(!chevron){chevron=document.createElement('em');chevron.className='ng96-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');anchor.appendChild(chevron);}
    const open=entry.querySelector('.ng96-project-open');if(open&&!open.dataset.bound){open.dataset.bound='1';open.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();routeNative(projectHref(pid));});}
    if(!anchor.dataset.ng110Bound){
      anchor.dataset.ng110Bound='1';
      anchor.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();toggle(pid,anchor);});
      anchor.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();toggle(pid,anchor);}else if(event.key==='ArrowRight'&&openPid!==pid){event.preventDefault();setOpen(pid);renderDrawer(pid,anchor);}else if(event.key==='ArrowLeft'&&openPid===pid){event.preventDefault();setOpen('');closeDrawers();}});
    }
  }

  function closeDrawers(){for(const d of document.querySelectorAll('#ng8-pins .ng96-pin-drawer'))d.remove();document.querySelectorAll(PIN_SEL).forEach(a=>a.setAttribute('aria-expanded','false'));}
  function renderDrawer(pid,anchor){
    closeDrawers();if(!pid||!anchor)return;
    const entry=rowFor(anchor);if(!entry)return;
    anchor.setAttribute('aria-expanded','true');
    const all=chatsFor(pid),q=norm(filter),shown=q?all.filter(c=>norm(`${c.title||''} ${c.snippet||''}`).includes(q)):all;
    const activeId=currentCid();
    const drawer=document.createElement('div');drawer.className='ng96-pin-drawer';drawer.id=drawerId(pid);drawer.dataset.pid=pid;drawer.setAttribute('role','region');drawer.setAttribute('aria-label','Conversations du Project');
    const rows=shown.slice(0,160).map(c=>{
      const title=clean(c.title)||'Conversation sans titre',out=isOut(c),active=c.id===activeId;
      return `<div class="ng109-chat-row" data-chat-row="${esc(c.id)}"${active?' data-ng109-active="1"':''}${out?' data-ng109-out="1"':''}><a data-chat="${esc(c.id)}" href="${esc(chatHref(c,pid))}" title="${esc(title)}"${active?' data-ng109-active="1" aria-current="page"':''}${out?' data-ng109-out="1"':''}><span class="ng96-chat-title">${esc(title)}</span><time>${fmt(c.updated)}</time>${out?'<span class="ng109-out-badge" title="Conversation arrivée à sa limite">OUT</span>':''}</a><button type="button" class="ng109-chat-rename" data-rename-chat="${esc(c.id)}" title="Renommer la conversation" aria-label="Renommer la conversation">✎</button></div>`;
    }).join('');
    drawer.innerHTML=`${all.length>8?`<div class="ng96-folder-search"><input type="search" value="${esc(filter)}" placeholder="Filtrer ${all.length} conversations…" aria-label="Filtrer les conversations du Project"></div>`:''}<div class="ng96-folder-list">${rows||'<div class="ng96-folder-empty">Aucune conversation indexée</div>'}</div>${all.length>160?`<small class="ng96-folder-limit">160 / ${all.length} affichées · utilise la recherche</small>`:''}`;
    entry.insertAdjacentElement('afterend',drawer);
    drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen('');closeDrawers();anchor.focus();}});
    const input=drawer.querySelector('input');if(input){input.addEventListener('input',()=>{filter=input.value;renderDrawer(pid,anchor);requestAnimationFrame(()=>{const next=document.querySelector(`#${CSS.escape(drawerId(pid))} input`);if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});});}
    drawer.querySelectorAll('a[data-chat]').forEach(link=>link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const c=all.find(x=>x.id===link.dataset.chat);if(!c)return;event.preventDefault();event.stopPropagation();routeNative(link.getAttribute('href')||chatHref(c,pid));}));
    drawer.querySelectorAll('.ng109-chat-rename[data-rename-chat]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const id=button.dataset.renameChat,c=all.find(x=>x.id===id);if(id&&c)renameChat(id,clean(c.title)||'Conversation');}));
    document.dispatchEvent(new CustomEvent('niakgpt:folder-rendered',{detail:{pid}}));
  }
  function toggle(pid,anchor){if(openPid===pid){setOpen('');closeDrawers();return;}setOpen(pid);renderDrawer(pid,anchor);}

  function rehydrate(){
    renderTimer=0;const box=document.getElementById('ng8-pins');if(!box)return;
    internalWrite=true;
    try{
      for(const anchor of box.querySelectorAll('a[data-ng8-pin="1"]'))decorateAnchor(anchor);
      if(openPid){const anchor=[...box.querySelectorAll('a[data-ng8-pin="1"]')].find(a=>pidFromHref(a.getAttribute('href'))===openPid);if(anchor)renderDrawer(openPid,anchor);else setOpen('');}
    }finally{queueMicrotask(()=>{internalWrite=false;});}
  }
  function schedule(delay=30){clearTimeout(renderTimer);renderTimer=setTimeout(rehydrate,delay);}
  function relevantPinMutation(record){
    const target=record.target instanceof Element?record.target:null;
    if(target?.closest('.ng96-pin-drawer'))return false;
    const nodes=[...record.addedNodes,...record.removedNodes].filter(n=>n instanceof Element);
    return nodes.some(n=>n.matches?.('a[data-ng8-pin="1"],.ng96-pin-entry')||n.querySelector?.('a[data-ng8-pin="1"],.ng96-pin-entry'));
  }
  function bindBox(){
    const box=document.getElementById('ng8-pins');if(!box)return false;
    if(box===observedBox&&observer)return true;
    observer?.disconnect();observedBox=box;
    observer=new MutationObserver(records=>{if(internalWrite)return;if(records.some(relevantPinMutation))schedule(18);});
    observer.observe(box,{childList:true,subtree:true});schedule(0);return true;
  }
  function bindRoot(){
    rootObserver?.disconnect();
    rootObserver=new MutationObserver(()=>{const box=document.getElementById('ng8-pins');if(box!==observedBox||!observedBox?.isConnected)bindBox();});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function bootstrap(){
    bindRoot();
    if(bindBox())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bindBox()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  const cacheBus=window.__NIAKGPT_CACHE_BUS__;
  if(cacheBus)cacheBus.subscribe(acceptCache);
  else chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue);});
  try{chrome.storage.local.get(OUT_KEY).then(g=>acceptOut(g?.[OUT_KEY]||{out:{}})).catch(()=>{});}catch{}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[OUT_KEY])acceptOut(changes[OUT_KEY].newValue||{out:{}});if(!cacheBus&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();scheduleActive(30);}});
  document.addEventListener('niakgpt:pins-rendered',()=>{bindBox();schedule(0);});
  document.addEventListener('click',e=>{const a=e.target instanceof Element?e.target.closest('a[href*="/c/"]'):null;if(a)setTimeout(()=>scheduleActive(0),90);},true);
  window.addEventListener('popstate',()=>scheduleActive(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>scheduleActive(0));
  window.addEventListener('pagehide',()=>{clearTimeout(renderTimer);clearTimeout(activeTimer);observer?.disconnect();rootObserver?.disconnect();bootstrapObserver?.disconnect();observer=rootObserver=bootstrapObserver=null;observedBox=null;});
  window.addEventListener('pageshow',event=>{if(event.persisted)bootstrap();});
  bootstrap();
})();
