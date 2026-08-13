(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PIN_FOLDERS_096__) return;
  window.__NIAKGPT_PIN_FOLDERS_096__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PIN_SEL='#ng8-pins a[data-ng8-pin="1"]';
  const SESSION_KEY='niakgpt-open-pin-folder-v096';
  let cache={projects:[],chats:[],projectChats:{}};
  let openPid='';
  let filter='';
  let observer=null,observedBox=null,bootstrapObserver=null,renderTimer=0,internalWrite=false;

  try{openPid=sessionStorage.getItem(SESSION_KEY)||'';}catch{}

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const fmt=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date(),base=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;return d.getFullYear()===now.getFullYear()?base:`${base}/${String(d.getFullYear()).slice(-2)}`;};

  function setOpen(pid){openPid=pid||'';filter='';try{openPid?sessionStorage.setItem(SESSION_KEY,openPid):sessionStorage.removeItem(SESSION_KEY);}catch{}}
  function projectHref(pid){return cache.projects?.find(p=>p?.id===pid)?.href||`/g/${pid}/project`;}
  function chatHref(c,pid){return c?.href||`/g/${pid}/c/${c.id}`;}
  function routeNative(href){
    const chatId=cidFromHref(href),projectId=pidFromHref(href);
    const links=[...document.querySelectorAll('a[href]')].filter(a=>!a.closest('#ng8-pins,#ng8-panel,#ng8-quick,#ng90-control,#ng100-command'));
    const native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cidFromHref(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pidFromHref(a.getAttribute('href'))===projectId&&/\/project(?:$|\?)/.test(a.getAttribute('href')||'')):null);
    if(native instanceof HTMLElement){native.click();return;}
    location.assign(href);
  }
  function chatsFor(pid){
    const direct=Array.isArray(cache.projectChats?.[pid])?cache.projectChats[pid]:[];
    const source=direct.length?direct:(cache.chats||[]).filter(c=>c?.projectId===pid);
    const map=new Map();
    for(const c of source){if(!c?.id)continue;const old=map.get(c.id)||{},updated=Math.max(parseTime(old.updated||old.update_time),parseTime(c.updated||c.update_time||c.create_time));map.set(c.id,{...old,...c,updated});}
    return [...map.values()].sort((a,b)=>(b.updated||0)-(a.updated||0)||String(a.title||'').localeCompare(String(b.title||''),'fr'));
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
    anchor.dataset.ng96Folder='1';anchor.setAttribute('aria-haspopup','true');anchor.setAttribute('aria-expanded',pid===openPid?'true':'false');anchor.title='Afficher les conversations du Project';
    let chevron=anchor.querySelector(':scope > .ng96-chevron');if(!chevron){chevron=document.createElement('em');chevron.className='ng96-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');anchor.appendChild(chevron);}
    const open=entry.querySelector('.ng96-project-open');if(open&&!open.dataset.bound){open.dataset.bound='1';open.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();routeNative(projectHref(pid));});}
    if(!anchor.dataset.ng96Bound){anchor.dataset.ng96Bound='1';anchor.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();toggle(pid,anchor);});}
  }

  function closeDrawers(){for(const d of document.querySelectorAll('#ng8-pins .ng96-pin-drawer'))d.remove();document.querySelectorAll(PIN_SEL).forEach(a=>a.setAttribute('aria-expanded','false'));}
  function renderDrawer(pid,anchor){
    closeDrawers();if(!pid||!anchor)return;
    const entry=rowFor(anchor);if(!entry)return;
    anchor.setAttribute('aria-expanded','true');
    const all=chatsFor(pid),q=norm(filter),shown=q?all.filter(c=>norm(`${c.title||''} ${c.snippet||''}`).includes(q)):all;
    const drawer=document.createElement('div');drawer.className='ng96-pin-drawer';drawer.dataset.pid=pid;
    drawer.innerHTML=`${all.length>8?`<div class="ng96-folder-search"><input type="search" value="${esc(filter)}" placeholder="Filtrer ${all.length} conversations…" aria-label="Filtrer les conversations du Project"></div>`:''}<div class="ng96-folder-list">${shown.length?shown.slice(0,160).map(c=>`<button type="button" data-chat="${esc(c.id)}" title="${esc(c.title||'Conversation')}"><span>${esc(c.title||'Conversation sans titre')}</span><time>${fmt(c.updated)}</time></button>`).join(''):'<div class="ng96-folder-empty">Aucune conversation indexée</div>'}</div>${all.length>160?`<small class="ng96-folder-limit">160 / ${all.length} affichées · utilise la recherche</small>`:''}`;
    entry.insertAdjacentElement('afterend',drawer);
    const input=drawer.querySelector('input');if(input){input.addEventListener('input',()=>{filter=input.value;renderDrawer(pid,anchor);requestAnimationFrame(()=>{const next=document.querySelector(`.ng96-pin-drawer[data-pid="${CSS.escape(pid)}"] input`);if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});});}
    drawer.querySelectorAll('[data-chat]').forEach(button=>button.addEventListener('click',()=>{const c=all.find(x=>x.id===button.dataset.chat);if(c)routeNative(chatHref(c,pid));}));
  }
  function toggle(pid,anchor){
    if(openPid===pid){setOpen('');closeDrawers();return;}
    setOpen(pid);renderDrawer(pid,anchor);
  }

  function rehydrate(){
    renderTimer=0;const box=document.getElementById('ng8-pins');if(!box)return;
    internalWrite=true;
    try{for(const anchor of box.querySelectorAll('a[data-ng8-pin="1"]'))decorateAnchor(anchor);if(openPid){const anchor=[...box.querySelectorAll('a[data-ng8-pin="1"]')].find(a=>pidFromHref(a.getAttribute('href'))===openPid);if(anchor)renderDrawer(openPid,anchor);else setOpen('');}}
    finally{queueMicrotask(()=>{internalWrite=false;});}
  }
  function schedule(delay=30){clearTimeout(renderTimer);renderTimer=setTimeout(rehydrate,delay);}
  function bindBox(){
    const box=document.getElementById('ng8-pins');if(!box||box===observedBox)return false;
    observer?.disconnect();observedBox=box;observer=new MutationObserver(records=>{if(internalWrite)return;const external=records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&!n.classList?.contains('ng96-pin-drawer')&&!n.classList?.contains('ng96-pin-entry')));if(external)schedule(20);});observer.observe(box,{childList:true,subtree:true});schedule(0);return true;
  }
  function bootstrap(){
    if(bindBox())return;
    bootstrapObserver=new MutationObserver(()=>{if(bindBox()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  async function loadCache(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;}catch{}schedule(0);}

  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(40);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();schedule(80);}});
  window.addEventListener('popstate',()=>schedule(60));
  loadCache();bootstrap();
})();
