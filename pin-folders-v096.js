(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PIN_FOLDERS_096__) return;
  window.__NIAKGPT_PIN_FOLDERS_096__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PIN_SEL='#ng8-pins a[data-ng8-pin="1"]';
  const SESSION_KEY='niakgpt-open-pin-folder-v096';
  const CHAT_ACTION_LABEL='Actions de la conversation (menu ChatGPT)';
  let cache={projects:[],chats:[],projectChats:{}};
  let openPid='';
  let filter='';
  let observer=null,observedBox=null,bootstrapObserver=null,renderTimer=0,internalWrite=false,drawerDirty=false;

  try{openPid=sessionStorage.getItem(SESSION_KEY)||'';}catch{}

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const fmt=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date(),base=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;return d.getFullYear()===now.getFullYear()?base:`${base}/${String(d.getFullYear()).slice(-2)}`;};
  const drawerId=pid=>`ng96-folder-${String(pid||'').replace(/[^A-Za-z0-9_-]/g,'')}`;
  const actionMarkup=id=>`<button type="button" class="ng113-native-actions ng113-native-actions-chat" data-ng113-actions="chat" data-ng113-id="${esc(id)}" aria-label="${CHAT_ACTION_LABEL}" title="${CHAT_ACTION_LABEL}"><span class="ng113-dots" aria-hidden="true">•••</span></button>`;

  function projectSnapshotSignature(raw,pid){
    if(!pid)return'';const chats=(raw?.chats||[]).filter(c=>c?.projectId===pid).map(c=>[c.id,c.updated||c.update_time||0,c.title||'']);return JSON.stringify([raw?.counts?.[pid]??null,chats]);
  }
  function acceptCache(next){
    const before=projectSnapshotSignature(cache,openPid);cache=next&&typeof next==='object'?next:cache;const after=projectSnapshotSignature(cache,openPid);if(!observedBox)bindBox();if(openPid&&before!==after){drawerDirty=true;schedule(40);}else if(!openPid)schedule(80);
  }
  function setOpen(pid){openPid=pid||'';filter='';drawerDirty=false;try{openPid?sessionStorage.setItem(SESSION_KEY,openPid):sessionStorage.removeItem(SESSION_KEY);}catch{}}
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
    if(!(anchor instanceof HTMLElement))return null;
    const existing=rowFor(anchor);if(existing){existing.querySelector(':scope>.ng96-project-open')?.remove();return existing;}
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return null;
    const entry=document.createElement('div');entry.className='ng96-pin-entry';entry.dataset.pid=pid;
    anchor.parentElement?.insertBefore(entry,anchor);entry.appendChild(anchor);
    return entry;
  }
  function decorateAnchor(anchor){
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return;
    const entry=wrapAnchor(anchor);if(!entry)return;
    entry.querySelector(':scope>.ng96-project-open')?.remove();
    anchor.dataset.ng96Folder='1';anchor.setAttribute('role','button');anchor.setAttribute('aria-haspopup','true');anchor.setAttribute('aria-controls',drawerId(pid));anchor.setAttribute('aria-expanded',pid===openPid?'true':'false');anchor.title='Afficher les conversations du Project';
    let chevron=anchor.querySelector(':scope > .ng96-chevron');if(!chevron){chevron=document.createElement('em');chevron.className='ng96-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');anchor.appendChild(chevron);}
    if(!anchor.dataset.ng96Bound){
      anchor.dataset.ng96Bound='1';
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
    const drawer=document.createElement('div');drawer.className='ng96-pin-drawer';drawer.id=drawerId(pid);drawer.dataset.pid=pid;drawer.setAttribute('role','region');drawer.setAttribute('aria-label','Conversations du Project');
    const rows=shown.slice(0,160).map(c=>`<div class="ng96-chat-entry" data-chat-entry="${esc(c.id)}"><a data-chat="${esc(c.id)}" href="${esc(chatHref(c,pid))}" title="${esc(c.title||'Conversation')}"><span>${esc(c.title||'Conversation sans titre')}</span><time>${fmt(c.updated)}</time></a>${actionMarkup(c.id)}</div>`).join('');
    drawer.innerHTML=`${all.length>8?`<div class="ng96-folder-search"><input type="search" value="${esc(filter)}" placeholder="Filtrer ${all.length} conversations…" aria-label="Filtrer les conversations du Project"></div>`:''}<div class="ng96-folder-list">${shown.length?rows:'<div class="ng96-folder-empty">Aucune conversation indexée</div>'}</div>${all.length>160?`<small class="ng96-folder-limit">160 / ${all.length} affichées · utilise la recherche</small>`:''}`;
    entry.insertAdjacentElement('afterend',drawer);drawerDirty=false;
    drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen('');closeDrawers();anchor.focus();}});
    const input=drawer.querySelector('input');if(input){input.addEventListener('input',()=>{filter=input.value;renderDrawer(pid,anchor);requestAnimationFrame(()=>{const next=document.querySelector(`#${CSS.escape(drawerId(pid))} input`);if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});});}
    drawer.querySelectorAll('.ng96-chat-entry>a[data-chat]').forEach(link=>link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const c=all.find(x=>x.id===link.dataset.chat);if(!c)return;event.preventDefault();event.stopPropagation();routeNative(link.getAttribute('href')||chatHref(c,pid));}));
    document.dispatchEvent(new CustomEvent('niakgpt:folder-rendered',{detail:{projectId:pid,chats:shown.length,drawerId:drawer.id}}));
  }
  function toggle(pid,anchor){
    if(openPid===pid){setOpen('');closeDrawers();return;}
    setOpen(pid);renderDrawer(pid,anchor);
  }

  function rehydrate(){
    renderTimer=0;const box=document.getElementById('ng8-pins');if(!box)return;
    internalWrite=true;
    try{
      box.querySelectorAll('.ng96-project-open').forEach(button=>button.remove());
      for(const anchor of box.querySelectorAll('a[data-ng8-pin="1"]'))decorateAnchor(anchor);
      if(openPid){
        const anchor=[...box.querySelectorAll('a[data-ng8-pin="1"]')].find(a=>pidFromHref(a.getAttribute('href'))===openPid);
        if(anchor){const existing=document.getElementById(drawerId(openPid)),entry=rowFor(anchor);if(existing&&!drawerDirty&&existing.previousElementSibling===entry)anchor.setAttribute('aria-expanded','true');else renderDrawer(openPid,anchor);}else setOpen('');
      }
    }finally{queueMicrotask(()=>{internalWrite=false;});}
  }
  function schedule(delay=30){clearTimeout(renderTimer);renderTimer=setTimeout(rehydrate,delay);}
  function cooperativeNode(n){return n instanceof Element&&!!n.closest?.('.ng96-pin-drawer,.ng96-pin-entry,.ng96-chat-entry,.ng113-native-actions,#ng113-actions-fallback');}
  function bindBox(){
    const box=document.getElementById('ng8-pins');if(!box||box===observedBox)return false;
    observer?.disconnect();observedBox=box;observer=new MutationObserver(records=>{if(internalWrite)return;const external=records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&!cooperativeNode(n)));if(external)schedule(20);});observer.observe(box,{childList:true,subtree:true});schedule(0);return true;
  }
  function bootstrap(){
    if(bindBox())return;
    bootstrapObserver=new MutationObserver(()=>{if(bindBox()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  const cacheBus=window.__NIAKGPT_CACHE_BUS__;
  if(cacheBus)cacheBus.subscribe(acceptCache);else{
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue);});
    Promise.resolve(chrome.storage.local.get(CACHE_KEY)).then(result=>acceptCache(result?.[CACHE_KEY]||{})).catch(()=>{});
  }
  document.addEventListener('niakgpt:pins-rendered',()=>{bindBox();rehydrate();});
  document.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target instanceof Element?event.target:null,anchor=target?.closest('#ng8-pins a[data-ng8-pin="1"]');
    if(!anchor||anchor.dataset.ng96Bound)return;
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return;
    event.preventDefault();event.stopImmediatePropagation();wrapAnchor(anchor);toggle(pid,anchor);schedule(0);
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();rehydrate();}});
  window.addEventListener('popstate',()=>{bindBox();rehydrate();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bindBox();rehydrate();});
  window.addEventListener('pageshow',event=>{if(event.persisted){bindBox();rehydrate();}});
  bootstrap();
})();