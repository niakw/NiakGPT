(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_DRAWER_110__)return;
  window.__NIAKGPT_PROJECT_DRAWER_110__=true;

  // One owner for Project drawers. The historical modules stay in the repo/labs,
  // but must not both mutate the same drawer in production.
  window.__NIAKGPT_PIN_FOLDERS_096__=true;
  window.__NIAKGPT_PROJECT_CHAT_UX_109__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  const SESSION_KEY='niakgpt-open-pin-folder-v096';
  const PIN_SEL='#ng8-pins a[data-ng8-pin="1"]';
  let cache={projects:[],chats:[],projectChats:{}};
  let outState={out:{}};
  let openPid='';
  let filter='';
  let box=null,observer=null,bootstrapObserver=null,renderTimer=0,stopped=false,rpcSeq=0,cacheUnsub=null;

  try{openPid=sessionStorage.getItem(SESSION_KEY)||'';}catch{}

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cidFromHref(location.pathname);
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const fmt=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date(),base=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;return d.getFullYear()===now.getFullYear()?base:`${base}/${String(d.getFullYear()).slice(-2)}`;};
  const drawerId=pid=>`ng110-drawer-${String(pid||'').replace(/[^A-Za-z0-9_-]/g,'')}`;

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng110-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const on=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',on);};
      document.addEventListener('niakgpt:rpc-response',on);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  function projectHref(pid){return cache.projects?.find(p=>p?.id===pid)?.href||`/g/${pid}/project`;}
  function chatHref(chat,pid){return chat?.href||`/g/${pid}/c/${chat.id}`;}
  function setOpen(pid){openPid=pid||'';filter='';try{openPid?sessionStorage.setItem(SESSION_KEY,openPid):sessionStorage.removeItem(SESSION_KEY);}catch{}}
  function isOut(id){return !!(outState?.out?.[id]?.out||outState?.out?.[id]||cache.chats?.find(c=>c?.id===id)?.out);}

  function chatsFor(pid){
    const direct=Array.isArray(cache.projectChats?.[pid])?cache.projectChats[pid]:[];
    const source=direct.length?direct:(cache.chats||[]).filter(c=>c?.projectId===pid);
    const map=new Map();
    for(const item of source){
      if(!item?.id)continue;
      const old=map.get(item.id)||{};
      const updated=Math.max(parseTime(old.updated||old.update_time),parseTime(item.updated||item.update_time||item.create_time));
      map.set(item.id,{...old,...item,updated});
    }
    return [...map.values()].sort((a,b)=>{
      const ao=isOut(a.id)?1:0,bo=isOut(b.id)?1:0;
      return ao-bo||(b.updated||0)-(a.updated||0)||String(a.title||'').localeCompare(String(b.title||''),'fr');
    });
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
      if(bus?.update){cache=await bus.update(update)||cache;return;}
      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
      cache=update(raw);await chrome.storage.local.set({[CACHE_KEY]:cache});
    }catch{}
  }

  async function renameChat(chatId,titleEl,link){
    const oldTitle=clean(titleEl?.textContent||link?.title||'Conversation');
    const next=clean(window.prompt('Renommer la conversation',oldTitle));
    if(!next||next===oldTitle)return;
    const result=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});
    if(!result?.ok){window.__NIAKGPT_DIAGNOSTICS__?.set('renommage',`ERREUR · ${result?.status||0}`);return;}
    if(titleEl)titleEl.textContent=next;if(link)link.title=next;
    await updateCacheTitle(chatId,next);
    window.__NIAKGPT_DIAGNOSTICS__?.set('renommage','OK · conversation renommée');
  }

  function createChatRow(chat,pid){
    const row=document.createElement('div');row.className='ng110-chat-row';row.dataset.chatRow=chat.id;
    const link=document.createElement('a');link.dataset.chat=chat.id;link.className='ng110-chat-link';
    const title=document.createElement('span');title.className='ng110-chat-title';
    const date=document.createElement('time');date.className='ng110-chat-date';
    const status=document.createElement('span');status.className='ng110-chat-status';status.setAttribute('aria-hidden','true');
    link.append(title,date,status);
    const rename=document.createElement('button');rename.type='button';rename.className='ng110-chat-rename';rename.textContent='✎';rename.title='Renommer la conversation';rename.setAttribute('aria-label','Renommer la conversation');
    rename.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();renameChat(chat.id,title,link);});
    row.append(link,rename);return row;
  }

  function patchChatRow(row,chat,pid){
    const link=row.querySelector(':scope > a[data-chat]');
    const title=row.querySelector('.ng110-chat-title');
    const date=row.querySelector('.ng110-chat-date');
    const status=row.querySelector('.ng110-chat-status');
    if(!link||!title||!date||!status)return;
    const text=clean(chat.title)||'Conversation sans titre';
    const href=chatHref(chat,pid);
    if(link.getAttribute('href')!==href)link.setAttribute('href',href);
    if(link.title!==text)link.title=text;
    if(title.textContent!==text)title.textContent=text;
    const stamp=fmt(chat.updated||parseTime(chat.update_time)||parseTime(chat.create_time));
    if(date.textContent!==stamp)date.textContent=stamp;
    const active=chat.id===currentCid();
    const out=isOut(chat.id);
    row.toggleAttribute('data-ng110-active',active);row.toggleAttribute('data-ng110-out',out);
    link.toggleAttribute('data-ng110-active',active);link.toggleAttribute('data-ng110-out',out);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    status.textContent=out?'OUT':'';status.title=out?'Conversation arrivée à sa limite — état conservé localement':'';
    status.toggleAttribute('data-visible',out);
  }

  function desiredChats(pid){
    const all=chatsFor(pid),q=norm(filter);
    const matched=q?all.filter(c=>norm(`${c.title||''} ${c.snippet||''}`).includes(q)):all;
    return{all,shown:matched.slice(0,160)};
  }

  function reconcileList(drawer,pid){
    const list=drawer.querySelector('.ng110-chat-list');if(!list)return;
    const{all,shown}=desiredChats(pid);
    const wanted=new Set(shown.map(c=>c.id));
    const existing=new Map([...list.querySelectorAll(':scope > .ng110-chat-row')].map(row=>[row.dataset.chatRow,row]));
    const fragment=document.createDocumentFragment();
    for(const chat of shown){
      let row=existing.get(chat.id);if(!row)row=createChatRow(chat,pid);
      patchChatRow(row,chat,pid);fragment.appendChild(row);
    }
    for(const [id,row] of existing)if(!wanted.has(id))row.remove();
    list.appendChild(fragment);
    const empty=drawer.querySelector('.ng110-folder-empty');empty.hidden=shown.length>0;
    const limit=drawer.querySelector('.ng110-folder-limit');
    limit.hidden=all.length<=160;limit.textContent=all.length>160?`160 / ${all.length} affichées · utilise la recherche`:'';
    const search=drawer.querySelector('.ng110-folder-search');
    search.hidden=all.length<=8;search.placeholder=`Filtrer ${all.length} conversations…`;
    window.__NIAKGPT_DIAGNOSTICS__?.set('project-drawer',`OK · ${shown.length}/${all.length} chats · DOM stable`);
  }

  function createDrawer(pid){
    const drawer=document.createElement('div');drawer.className='ng110-pin-drawer';drawer.id=drawerId(pid);drawer.dataset.pid=pid;drawer.setAttribute('role','region');drawer.setAttribute('aria-label','Conversations du Project');
    const searchWrap=document.createElement('div');searchWrap.className='ng110-folder-search-wrap';
    const search=document.createElement('input');search.type='search';search.className='ng110-folder-search';search.value=filter;search.setAttribute('aria-label','Filtrer les conversations du Project');
    search.addEventListener('input',()=>{filter=search.value;reconcileList(drawer,pid);});
    searchWrap.appendChild(search);
    const list=document.createElement('div');list.className='ng110-chat-list';
    const empty=document.createElement('div');empty.className='ng110-folder-empty';empty.textContent='Aucune conversation indexée';
    const limit=document.createElement('small');limit.className='ng110-folder-limit';
    drawer.append(searchWrap,list,empty,limit);return drawer;
  }

  function closeDrawers(){
    for(const drawer of document.querySelectorAll('#ng8-pins .ng110-pin-drawer'))drawer.remove();
    for(const anchor of document.querySelectorAll(PIN_SEL))anchor.setAttribute('aria-expanded','false');
  }

  function openDrawer(pid,anchor){
    closeDrawers();if(!pid||!anchor)return;
    const entry=anchor.closest('.ng110-pin-entry');if(!entry)return;
    anchor.setAttribute('aria-expanded','true');
    const drawer=createDrawer(pid);entry.insertAdjacentElement('afterend',drawer);reconcileList(drawer,pid);
    drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen('');closeDrawers();anchor.focus();}});
  }

  function toggle(pid,anchor){
    if(openPid===pid){setOpen('');closeDrawers();return;}
    setOpen(pid);openDrawer(pid,anchor);
  }

  function ensurePinEntry(anchor){
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return null;
    let entry=anchor.closest('.ng110-pin-entry');
    if(!entry){entry=document.createElement('div');entry.className='ng110-pin-entry';entry.dataset.pid=pid;anchor.parentElement?.insertBefore(entry,anchor);entry.appendChild(anchor);}
    anchor.dataset.ng110Folder='1';anchor.setAttribute('aria-haspopup','true');anchor.setAttribute('aria-controls',drawerId(pid));anchor.setAttribute('aria-expanded',pid===openPid?'true':'false');anchor.title='Afficher les conversations du Project';
    let chevron=anchor.querySelector(':scope > .ng110-chevron');if(!chevron){chevron=document.createElement('em');chevron.className='ng110-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');anchor.appendChild(chevron);}
    let open=entry.querySelector(':scope > .ng110-project-open');
    if(!open){open=document.createElement('a');open.className='ng110-project-open';open.textContent='↗';open.title='Ouvrir la page complète du Project';open.setAttribute('aria-label','Ouvrir la page complète du Project');entry.appendChild(open);}
    open.href=projectHref(pid);
    if(!anchor.dataset.ng110Bound){
      anchor.dataset.ng110Bound='1';
      anchor.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();toggle(pid,anchor);});
      anchor.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();toggle(pid,anchor);}else if(event.key==='ArrowRight'&&openPid!==pid){event.preventDefault();setOpen(pid);openDrawer(pid,anchor);}else if(event.key==='ArrowLeft'&&openPid===pid){event.preventDefault();setOpen('');closeDrawers();}});
    }
    return entry;
  }

  function observeBox(){
    observer?.disconnect();if(!box)return;
    observer=new MutationObserver(records=>{
      const external=records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&!node.closest?.('.ng110-pin-drawer,.ng110-pin-entry')&&!node.matches?.('.ng110-pin-drawer,.ng110-pin-entry')));
      if(external)schedule(20);
    });
    observer.observe(box,{childList:true,subtree:true});
  }

  function render(){
    renderTimer=0;if(stopped)return;
    const next=document.getElementById('ng8-pins');if(!next)return;
    if(next!==box){box=next;observeBox();}
    observer?.disconnect();
    try{
      for(const anchor of box.querySelectorAll('a[data-ng8-pin="1"]'))ensurePinEntry(anchor);
      if(openPid){const anchor=[...box.querySelectorAll('a[data-ng8-pin="1"]')].find(a=>pidFromHref(a.getAttribute('href'))===openPid);if(anchor){let drawer=box.querySelector(`#${CSS.escape(drawerId(openPid))}`);if(!drawer)openDrawer(openPid,anchor);else reconcileList(drawer,openPid);}else setOpen('');}
      for(const drawer of box.querySelectorAll('.ng110-pin-drawer'))if(drawer.dataset.pid!==openPid)drawer.remove();
    }finally{observeBox();}
  }

  function schedule(delay=20){if(stopped)return;clearTimeout(renderTimer);renderTimer=setTimeout(render,delay);}
  function bind(){const next=document.getElementById('ng8-pins');if(!next)return false;if(next!==box){box=next;observeBox();}schedule(0);return true;}
  function start(){
    stopped=false;
    if(bind())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bind()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){stopped=true;clearTimeout(renderTimer);renderTimer=0;observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;box=null;cacheUnsub?.();cacheUnsub=null;}

  const acceptCache=next=>{cache=next&&typeof next==='object'?next:cache;schedule(10);};
  const bus=window.__NIAKGPT_CACHE_BUS__;
  if(bus?.subscribe)cacheUnsub=bus.subscribe(acceptCache);
  else{
    try{chrome.storage.local.get(CACHE_KEY).then(g=>acceptCache(g?.[CACHE_KEY]||cache)).catch(()=>{});}catch{}
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue||cache);});
  }
  try{chrome.storage.local.get(OUT_KEY).then(g=>{outState=g?.[OUT_KEY]||outState;schedule(0);}).catch(()=>{});}catch{}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[OUT_KEY]){outState=changes[OUT_KEY].newValue||{out:{}};schedule(0);}});
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(0);}});
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
