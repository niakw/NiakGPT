(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CHAT_ATTENTION_113__)return;
  window.__NIAKGPT_CHAT_ATTENTION_113__=true;

  const CACHE_KEY='niakgpt-v08-cache',STATE_KEY='niakgpt-chat-attention-v113';
  let state={schema:1,initialized:false,seen:{}},cache={projects:[],chats:[]},timer=0,persistTimer=0,responseActivity=false,touching=false;
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const updated=c=>Math.max(parseTime(c?.updated||c?.update_time||c?.create_time),Number(c?.attentionAt||0));
  const chatById=id=>(cache.chats||[]).find(c=>c?.id===id)||null;

  function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>chrome.storage.local.set({[STATE_KEY]:state}).catch(()=>{}),160);}
  function markSeen(id,at=0){if(!id)return;const row=chatById(id),stamp=Math.max(Number(at)||0,updated(row));if(stamp>Number(state.seen[id]||0)){state.seen[id]=stamp;persist();}}
  function unread(id){const row=chatById(id),stamp=updated(row);return stamp>0&&stamp>Number(state.seen[id]||0);}
  function initializeIfNeeded(){if(state.initialized)return;for(const c of cache.chats||[])if(c?.id)state.seen[c.id]=updated(c);state.initialized=true;persist();}
  async function publishCompletion(id,at=Date.now()){
    if(!id||touching)return;const stamp=Number(at)||Date.now(),bus=window.__NIAKGPT_CACHE_BUS__;touching=true;
    try{
      const patch=raw=>{raw=raw&&typeof raw==='object'?raw:{};return{...raw,at:Date.now(),chats:(raw.chats||[]).map(c=>c?.id===id?{...c,attentionAt:Math.max(Number(c.attentionAt||0),stamp)}:c)};};
      if(bus?.update)await bus.update(patch);else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;const next=patch(raw);await chrome.storage.local.set({[CACHE_KEY]:next});accept(next);}
    }catch{}finally{touching=false;}
  }
  function apply(){
    timer=0;initializeIfNeeded();const current=currentCid();if(current&&!document.hidden)markSeen(current);
    const pins=document.getElementById('ng8-pins');if(!pins)return;const unreadByProject=new Map();
    for(const a of pins.querySelectorAll('.ng96-folder-list>a[data-chat]')){
      const id=a.dataset.chat||cid(a.getAttribute('href'));if(!id)continue;const isUnread=unread(id)&&!(id===current&&!document.hidden),row=chatById(id);
      if(isUnread){a.dataset.ng113Unread='1';a.setAttribute('aria-label',`${row?.title||'Conversation'} · nouveau message`);if(row?.projectId)unreadByProject.set(row.projectId,(unreadByProject.get(row.projectId)||0)+1);}
      else{delete a.dataset.ng113Unread;a.removeAttribute('aria-label');}
    }
    for(const entry of pins.querySelectorAll('.ng96-pin-entry')){
      const id=String(entry.dataset.pid||entry.querySelector('a[data-ng8-pin]')?.getAttribute('href')||'').match(/g-p-[^/?#]+/)?.[0]||'',count=unreadByProject.get(id)||0;
      if(count){entry.dataset.ng113UnreadCount=String(count);entry.querySelector('a[data-ng8-pin]')?.setAttribute('data-ng113-unread-project',String(count));}
      else{delete entry.dataset.ng113UnreadCount;entry.querySelector('a[data-ng8-pin]')?.removeAttribute('data-ng113-unread-project');}
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('nouveaux-messages',`OK · ${[...pins.querySelectorAll('[data-ng113-unread="1"]')].length} non lu(s)`);
  }
  function schedule(delay=25){clearTimeout(timer);timer=setTimeout(apply,delay);}
  function accept(raw){if(raw&&typeof raw==='object')cache=raw;initializeIfNeeded();schedule(15);}
  async function start(){
    try{const got=await chrome.storage.local.get([STATE_KEY,CACHE_KEY]);state=got[STATE_KEY]&&typeof got[STATE_KEY]==='object'?got[STATE_KEY]:state;state.seen=state.seen||{};cache=got[CACHE_KEY]||cache;}catch{}
    initializeIfNeeded();const bus=window.__NIAKGPT_CACHE_BUS__;if(bus){bus.subscribe(accept);try{accept(await bus.get());}catch{}}schedule(0);
  }
  document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('.ng113-native-actions'))return;const a=e.target instanceof Element?e.target.closest('#ng8-pins .ng96-folder-list>a[data-chat]'):null;if(!a)return;const id=a.dataset.chat||cid(a.getAttribute('href'));if(id){markSeen(id);schedule(0);}},true);
  document.addEventListener('niakgpt:activity-changed',event=>{
    const d=event.detail||{},stateName=String(d.state||'');
    if(d.active===true&&stateName!=='loading'){responseActivity=true;return;}
    if(stateName==='error'){responseActivity=false;return;}
    if(d.active===false&&stateName==='ready'&&responseActivity){responseActivity=false;const id=currentCid();if(id)publishCompletion(id,d.at||Date.now());}
  });
  window.addEventListener('popstate',()=>{responseActivity=false;schedule(50);});if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{responseActivity=false;schedule(50);});document.addEventListener('visibilitychange',()=>{if(!document.hidden){markSeen(currentCid());schedule(0);}});
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])accept(changes[CACHE_KEY].newValue);});}catch{}
  start();
})();
