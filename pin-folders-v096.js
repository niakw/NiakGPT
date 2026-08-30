(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PIN_FOLDERS_096__) return;
  window.__NIAKGPT_PIN_FOLDERS_096__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PROJECT_CHAT_FRESH_MS=10*60*1000;
  const PIN_SEL='#ng8-pins a[data-ng8-pin="1"]';
  const SESSION_KEY='niakgpt-open-pin-folder-v096';
  const CHAT_ACTION_LABEL='Actions de la conversation (menu ChatGPT)';
  let cache={projects:[],chats:[],projectChats:{},counts:{},indexedProjectIds:[]};
  let openPid='';
  let filter='';
  let observer=null,observedBox=null,bootstrapObserver=null,renderTimer=0,internalWrite=false,drawerDirty=false,rpcSeq=0;
  const loadState=new Map(),drawerScrollMemory=new Map();

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=String(v||'').trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'');
  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const fmt=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date(),base=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;return d.getFullYear()===now.getFullYear()?base:`${base}/${String(d.getFullYear()).slice(-2)}`;};
  const drawerId=pid=>`ng96-folder-${String(pid||'').replace(/[^A-Za-z0-9_-]/g,'')}`;
  const actionMarkup=id=>`<button type="button" class="ng113-native-actions ng113-native-actions-chat" data-ng113-actions="chat" data-ng113-id="${esc(id)}" aria-label="${CHAT_ACTION_LABEL}" title="${CHAT_ACTION_LABEL}"><span class="ng113-dots" aria-hidden="true">•••</span></button>`;
  const listFrom=(data,...keys)=>{for(const key of keys)if(Array.isArray(data?.[key]))return data[key];return[];};
  const nextCursor=data=>data?.cursor??data?.next_cursor??data?.nextCursor??null;
  const bridgeBusy=()=>document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')||document.documentElement.dataset.ng105Verification==='1';

  try{openPid=normalizePid(sessionStorage.getItem(SESSION_KEY)||'');}catch{}

  function rpc(path,{timeout=18000}={}){
    const id=`ng96-folder-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method:'GET',foreground:true}}));});
  }
  function projectSnapshotSignature(raw,pid){
    if(!pid)return'';const chats=(raw?.chats||[]).filter(c=>normalizePid(c?.projectId)===pid).map(c=>[c.id,c.title||'',normalizePid(c.projectId||pid)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));return JSON.stringify([raw?.counts?.[pid]??null,chats]);
  }
  function acceptCache(next){
    const before=projectSnapshotSignature(cache,openPid);cache=next&&typeof next==='object'?next:cache;const after=projectSnapshotSignature(cache,openPid);if(!observedBox)bindBox();if(openPid&&before!==after){drawerDirty=true;schedule(20);}else if(!openPid)schedule(40);
  }
  function setOpen(pid){openPid=normalizePid(pid||'');filter='';drawerDirty=false;try{openPid?sessionStorage.setItem(SESSION_KEY,openPid):sessionStorage.removeItem(SESSION_KEY);}catch{}}
  function projectBase(pid){
    pid=normalizePid(pid);const p=(cache.projects||[]).find(x=>normalizePid(x?.id)===pid),href=String(p?.href||'');
    const m=href.match(/^(\/g\/g-p-[^/]+)(?:\/project|\/c\/)/i);return m?.[1]||`/g/${pid}`;
  }
  function chatHref(c,pid){return c?.href||`${projectBase(pid)}/c/${c.id}`;}
  function routeNative(href){
    const chatId=cidFromHref(href),projectId=pidFromHref(href);
    const links=[...document.querySelectorAll('a[href]')].filter(a=>!a.closest('#ng8-pins,#ng8-panel,#ng8-quick,#ng90-control,#ng100-command'));
    const native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cidFromHref(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pidFromHref(a.getAttribute('href'))===projectId&&/\/project(?:$|\?)/.test(a.getAttribute('href')||'')):null);
    if(native instanceof HTMLElement){native.click();return;}
    location.assign(href);
  }
  function chatsFor(pid){
    pid=normalizePid(pid);
    let direct=[];
    for(const [key,list] of Object.entries(cache.projectChats||{}))if(normalizePid(key)===pid&&Array.isArray(list))direct.push(...list);
    const source=[...(cache.chats||[]).filter(c=>normalizePid(c?.projectId)===pid),...direct];
    const map=new Map();
    for(const c of source){if(!c?.id)continue;const old=map.get(c.id)||{},updated=Math.max(parseTime(old.updated||old.update_time),parseTime(c.updated||c.update_time||c.create_time));map.set(c.id,{...old,...c,projectId:pid,updated});}
    return [...map.values()].sort((a,b)=>(b.updated||0)-(a.updated||0)||String(a.title||'').localeCompare(String(b.title||''),'fr'));
  }

  function rowFor(anchor){return anchor?.closest?.('.ng96-pin-entry')||null;}
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
    entry.dataset.pid=pid;entry.querySelector(':scope>.ng96-project-open')?.remove();
    anchor.dataset.ng96Folder='1';anchor.dataset.ng96Pid=pid;anchor.setAttribute('role','button');anchor.setAttribute('aria-haspopup','true');anchor.setAttribute('aria-controls',drawerId(pid));anchor.setAttribute('aria-expanded',pid===openPid?'true':'false');anchor.title='Afficher les conversations du Project';
    let chevron=anchor.querySelector(':scope > .ng96-chevron');if(!chevron){chevron=document.createElement('em');chevron.className='ng96-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');anchor.appendChild(chevron);}
    if(!anchor.dataset.ng96Bound){
      anchor.dataset.ng96Bound='1';
      anchor.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();toggle(pid,anchor);});
      anchor.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();toggle(pid,anchor);}else if(event.key==='ArrowRight'&&openPid!==pid){event.preventDefault();setOpen(pid);renderDrawer(pid,anchor);}else if(event.key==='ArrowLeft'&&openPid===pid){event.preventDefault();setOpen('');closeDrawers();}});
    }
  }

  async function publishProjectChats(pid,list){
    const merge=latest=>{
      latest=latest&&typeof latest==='object'?latest:{};const chats=new Map((latest.chats||[]).filter(c=>c?.id).map(c=>[c.id,{...c}]));
      for(const c of list){const old=chats.get(c.id)||{};chats.set(c.id,{...old,...c,projectId:pid,updated:Math.max(parseTime(old.updated||old.update_time),parseTime(c.updated||c.update_time||c.create_time))});}
      const projectChats={...(latest.projectChats||{}),[pid]:list.map(c=>({...c,projectId:pid}))};
      const projectChatInventoryAt={...(latest.projectChatInventoryAt||{}),[pid]:Date.now()};
      return{...latest,at:Date.now(),chats:[...chats.values()],projectChats,projectChatInventoryAt,counts:{...(latest.counts||{}),[pid]:list.length},indexedProjectIds:[...new Set([...(latest.indexedProjectIds||[]),pid])]};
    };
    try{
      const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update){const next=await bus.update(merge);if(next)acceptCache(next);}else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache,next=merge(raw);await chrome.storage.local.set({[CACHE_KEY]:next});acceptCache(next);}
    }catch{}
  }
  function projectInventoryComplete(pid){
    pid=normalizePid(pid);const current=chatsFor(pid).length;
    const indexed=(cache.indexedProjectIds||[]).some(id=>normalizePid(id)===pid);
    const direct=Object.entries(cache.counts||{}).find(([id])=>normalizePid(id)===pid)?.[1];
    const expected=Number(direct);
    const perProject=Object.entries(cache.projectChatInventoryAt||{}).find(([id])=>normalizePid(id)===pid)?.[1];
    const freshAt=Math.max(Number(perProject)||0,Number(cache.serverIndexedAt)||0);
    const fresh=freshAt>0&&Date.now()-freshAt<PROJECT_CHAT_FRESH_MS;
    // indexedProjectIds/counts alone can describe a stale partial snapshot. A user opening a
    // drawer must not be trapped forever at that old count: only a recent full server index or
    // a recent foreground hydration is authoritative enough to suppress a refresh.
    return fresh&&indexed&&Number.isFinite(expected)&&expected>=0&&current>=expected;
  }
  async function hydrateProject(pid){
    pid=normalizePid(pid);if(!pid||projectInventoryComplete(pid))return;
    const state=loadState.get(pid);if(state==='loading')return;
    if(bridgeBusy()){loadState.set(pid,'waiting');window.__NIAKGPT_DIAGNOSTICS__?.set('pins-chats',`ATTENTE · ${pid} · reprise après réponse ChatGPT`);if(openPid===pid){drawerDirty=true;schedule(40);}return;}
    loadState.set(pid,'loading');if(openPid===pid&&!chatsFor(pid).length){drawerDirty=true;schedule(0);}window.__NIAKGPT_DIAGNOSTICS__?.set('pins-chats',`CHARGEMENT · ${pid}`);
    const out=new Map(),seen=new Set();let cursor=null,error='';
    for(let page=0;page<40;page++){
      if(bridgeBusy()){error='native_busy';break;}
      const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(pid)}/conversations?${qs}`);
      if(!r.ok){error=r.error||`HTTP ${r.status||0}`;break;}
      const items=listFrom(r.data,'items','conversations');for(const raw of items){const id=String(raw?.id||raw?.conversation_id||'').trim();if(!id)continue;out.set(id,{id,title:String(raw?.title||raw?.conversation_title||'Conversation'),snippet:String(raw?.snippet||''),projectId:pid,updated:parseTime(raw?.update_time||raw?.create_time),href:''});}
      const next=nextCursor(r.data);if(!items.length||next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;
    }
    if(error){
      const waiting=error==='native_busy'||/native_busy|bridge-pause/i.test(error);loadState.set(pid,waiting?'waiting':'error');window.__NIAKGPT_DIAGNOSTICS__?.set('pins-chats',`${waiting?'ATTENTE':'ERREUR'} · ${pid} · ${String(error).slice(0,80)}`);if(openPid===pid&&!chatsFor(pid).length){drawerDirty=true;schedule(80);}return;
    }
    const list=[...out.values()].sort((a,b)=>(b.updated||0)-(a.updated||0));await publishProjectChats(pid,list);loadState.set(pid,list.length?'ready':'ready-empty');window.__NIAKGPT_DIAGNOSTICS__?.set('pins-chats',`OK · ${pid} · ${list.length} chats`);if(openPid===pid){drawerDirty=true;schedule(0);}
  }

  function closeDrawers(){for(const d of document.querySelectorAll('#ng8-pins .ng96-pin-drawer'))d.remove();document.querySelectorAll(PIN_SEL).forEach(a=>a.setAttribute('aria-expanded','false'));}
  function emptyMessage(pid){const state=loadState.get(pid);if(state==='loading')return'Chargement des conversations…';if(state==='waiting')return'En attente de la fin de la réponse ChatGPT…';if(state==='error')return'Chargement impossible · reclique pour réessayer';if(state==='ready-empty')return'Aucune conversation dans ce Project';return'Chargement des conversations…';}
  function restoreDrawerScroll(pid,list,desired){
    desired=Math.max(0,Number(desired)||0);if(!(list instanceof HTMLElement)){if(desired)drawerScrollMemory.set(pid,desired);return;}if(!desired){drawerScrollMemory.set(pid,0);return;}
    drawerScrollMemory.set(pid,desired);let settled=false;
    const apply=()=>{
      if(settled||!list.isConnected)return settled;
      const max=Math.max(0,list.scrollHeight-list.clientHeight);
      if(max<=0){drawerScrollMemory.set(pid,desired);return false;}
      const next=Math.min(desired,max);if(Math.abs(list.scrollTop-next)>1)list.scrollTop=next;drawerScrollMemory.set(pid,next);settled=true;return true;
    };
    // Retry only while layout is not scrollable yet. Once restoration succeeds, never keep
    // forcing the old position across later frames: a user can legitimately scroll immediately
    // after opening the drawer and that interaction must win.
    if(apply())return;
    queueMicrotask(()=>{if(apply())return;requestAnimationFrame(()=>{if(apply())return;requestAnimationFrame(apply);});});
  }
  function renderDrawer(pid,anchor){
    pid=normalizePid(pid);const outer=document.querySelector('#ng8-pins>.ng8-pin-list'),outerScroll=outer?.scrollTop||0,previous=document.getElementById(drawerId(pid)),innerScroll=previous?.querySelector('.ng96-folder-list')?.scrollTop??drawerScrollMemory.get(pid)??0;if(previous){const old=previous.querySelector('.ng96-folder-list');if(old)drawerScrollMemory.set(pid,old.scrollTop);}closeDrawers();if(!pid||!anchor)return;
    const entry=rowFor(anchor);if(!entry)return;
    anchor.setAttribute('aria-expanded','true');
    const all=chatsFor(pid),q=norm(filter),shown=q?all.filter(c=>norm(`${c.title||''} ${c.snippet||''}`).includes(q)):all;
    const drawer=document.createElement('div');drawer.className='ng96-pin-drawer';drawer.id=drawerId(pid);drawer.dataset.pid=pid;drawer.setAttribute('role','region');drawer.setAttribute('aria-label','Conversations du Project');
    const rows=shown.slice(0,160).map(c=>`<div class="ng96-chat-entry" data-chat-entry="${esc(c.id)}"><a data-chat="${esc(c.id)}" href="${esc(chatHref(c,pid))}" title="${esc(c.title||'Conversation')}"><span>${esc(c.title||'Conversation sans titre')}</span><time>${fmt(c.updated)}</time></a>${actionMarkup(c.id)}</div>`).join('');
    drawer.innerHTML=`${all.length>8?`<div class="ng96-folder-search"><input type="search" value="${esc(filter)}" placeholder="Filtrer ${all.length} conversations…" aria-label="Filtrer les conversations du Project"></div>`:''}<div class="ng96-folder-list">${shown.length?rows:`<div class="ng96-folder-empty">${esc(emptyMessage(pid))}</div>`}</div>${all.length>160?`<small class="ng96-folder-limit">160 / ${all.length} affichées · utilise la recherche</small>`:''}`;
    entry.insertAdjacentElement('afterend',drawer);drawerDirty=false;
    if(outer&&outer.scrollTop!==outerScroll)outer.scrollTop=outerScroll;restoreDrawerScroll(pid,drawer.querySelector('.ng96-folder-list'),innerScroll);
    drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen('');closeDrawers();anchor.focus();}});
    const input=drawer.querySelector('input');if(input){input.addEventListener('input',()=>{filter=input.value;renderDrawer(pid,anchor);requestAnimationFrame(()=>{const next=document.querySelector(`#${CSS.escape(drawerId(pid))} input`);if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});});}
    drawer.querySelectorAll('.ng96-chat-entry>a[data-chat]').forEach(link=>link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const c=all.find(x=>x.id===link.dataset.chat);if(!c)return;event.preventDefault();event.stopPropagation();routeNative(link.getAttribute('href')||chatHref(c,pid));}));
    document.dispatchEvent(new CustomEvent('niakgpt:folder-rendered',{detail:{projectId:pid,chats:shown.length,drawerId:drawer.id}}));
    const inventoryState=loadState.get(pid);
    // Cached rows are useful immediately, but they do not prove completeness. A stale/partial
    // snapshot (for example 2 cached chats out of 72) must hydrate in foreground as soon as the
    // user opens the Project. Avoid automatic retry loops after a hard error; a new click resets it.
    if(!projectInventoryComplete(pid)&&!['loading','waiting','error'].includes(inventoryState))queueMicrotask(()=>hydrateProject(pid));
  }
  function toggle(pid,anchor){
    pid=normalizePid(pid);if(openPid===pid){setOpen('');closeDrawers();return;}
    if(loadState.get(pid)==='error')loadState.delete(pid);setOpen(pid);renderDrawer(pid,anchor);
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
    observer?.disconnect();observedBox=box;observer=new MutationObserver(records=>{if(internalWrite)return;const external=records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&!cooperativeNode(n)));if(external)schedule(10);});observer.observe(box,{childList:true,subtree:true});schedule(0);return true;
  }
  function bootstrap(){
    if(bindBox())return;
    bootstrapObserver=new MutationObserver(()=>{if(bindBox()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  const cacheBus=window.__NIAKGPT_CACHE_BUS__;
  if(cacheBus){
    try{cacheBus.subscribe(acceptCache);}catch{}
    Promise.resolve(cacheBus.get?.()).then(raw=>{if(raw)acceptCache(raw);}).catch(()=>{});
  }else{
    try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue);});}catch{}
    Promise.resolve(chrome.storage.local.get(CACHE_KEY)).then(result=>acceptCache(result?.[CACHE_KEY]||{})).catch(()=>{});
  }
  document.addEventListener('scroll',event=>{const list=event.target instanceof Element?event.target.closest?.('#ng8-pins .ng96-folder-list'):null;if(!list||!list.isConnected||internalWrite)return;const drawer=list.closest('.ng96-pin-drawer'),pid=normalizePid(drawer?.dataset.pid||'');if(pid)drawerScrollMemory.set(pid,list.scrollTop);},true);
  document.addEventListener('niakgpt:pins-rendered',()=>{bindBox();rehydrate();});
  document.addEventListener('niakgpt:hydrate-project',event=>{const pid=normalizePid(event.detail?.projectId||'');if(!pid)return;loadState.delete(pid);if(openPid===pid){drawerDirty=true;schedule(0);}hydrateProject(pid);});
  document.addEventListener('niakgpt:activity-changed',event=>{if(event.detail?.active===false){for(const [pid,state] of loadState)if(state==='waiting')hydrateProject(pid);}});
  document.addEventListener('niakgpt:rate-limit-cleared',()=>{for(const [pid,state] of loadState)if(state==='waiting')hydrateProject(pid);});
  window.addEventListener('online',()=>{for(const [pid,state] of loadState)if(state==='waiting'||state==='error'){loadState.delete(pid);if(openPid===pid)hydrateProject(pid);}});
  document.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target instanceof Element?event.target:null,anchor=target?.closest('#ng8-pins a[data-ng8-pin="1"]');
    if(!anchor||anchor.dataset.ng96Bound)return;
    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return;
    event.preventDefault();event.stopImmediatePropagation();wrapAnchor(anchor);toggle(pid,anchor);schedule(0);
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();rehydrate();for(const [pid,state] of loadState)if(state==='waiting')hydrateProject(pid);}});
  window.addEventListener('popstate',()=>{bindBox();rehydrate();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bindBox();rehydrate();});
  window.addEventListener('pageshow',event=>{if(event.persisted){bindBox();rehydrate();}});
  bootstrap();
})();