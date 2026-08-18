(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CHAT_STATE_113__)return;
  window.__NIAKGPT_CHAT_STATE_113__=true;

  const CACHE_KEY='niakgpt-v08-cache',STATE_KEY='niakgpt-chat-state-v113';
  let state={schema:1,chats:{}},cache=null,writing=false,persistTimer=0,routeTimer=0;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const pid=v=>String(v||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const currentCid=()=>cid(location.pathname),routePid=()=>pid(location.pathname);
  const genericTitle=v=>!clean(v)||/^(conversation(?: sans titre)?|new chat|nouveau chat|chatgpt)$/i.test(clean(v));
  const validPid=v=>/^g-p-/i.test(clean(v));

  function titleFromDocument(){
    let t=clean(document.title).replace(/\s*[|·]\s*(?:ChatGPT|NiakGPT)\s*$/i,'');
    let m=t.match(/^(.*?),\s*chat dans le projet\s+.+$/i);if(!m)m=t.match(/^(.*?),\s*chat in (?:the )?project\s+.+$/i);
    if(m)t=clean(m[1]);return genericTitle(t)?'':t;
  }
  function choose(prev,incoming){
    const iu=parseTime(incoming?.updated||incoming?.update_time||incoming?.create_time),pu=parseTime(prev?.updated),it=clean(incoming?.title),ip=clean(incoming?.projectId);
    if(!prev)return{title:it||'Conversation',projectId:ip,updated:iu};
    if(iu>pu)return{title:genericTitle(it)&&!genericTitle(prev.title)?prev.title:(it||prev.title),projectId:ip||'',updated:iu};
    if(iu===pu)return{title:genericTitle(prev.title)&&!genericTitle(it)?it:prev.title,projectId:prev.projectId||ip||'',updated:pu};
    return{title:prev.title,projectId:prev.projectId,updated:pu};
  }
  function schedulePersist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{chrome.storage.local.set({[STATE_KEY]:state}).catch(()=>{});},220);}
  function canonicalFor(id){return state.chats?.[id]||null;}

  async function reconcile(raw){
    if(!raw||typeof raw!=='object'||writing)return;cache=raw;let stateChanged=false,cacheChanged=false;
    const rows=Array.isArray(raw.chats)?raw.chats:[];
    for(const c of rows){
      if(!c?.id)continue;const before=state.chats[c.id],next=choose(before,c);
      if(!before||before.title!==next.title||before.projectId!==next.projectId||before.updated!==next.updated){state.chats[c.id]=next;stateChanged=true;}
      if(clean(c.title)!==next.title||clean(c.projectId)!==next.projectId||parseTime(c.updated)!==next.updated)cacheChanged=true;
    }
    const active=currentCid();
    if(active){
      const row=state.chats[active]||{title:'Conversation',projectId:'',updated:0},rp=routePid(),dt=titleFromDocument();let changed=false;
      if(validPid(rp)&&row.projectId!==rp){row.projectId=rp;changed=true;}
      // The browser tab title is only a rescue source for empty/generic chat names.
      // A non-generic server/cache title is canonical and must never be replaced by page chrome.
      if(dt&&!genericTitle(dt)&&genericTitle(row.title)){row.title=dt;changed=true;}
      if(changed){state.chats[active]=row;stateChanged=true;cacheChanged=true;}
    }
    if(stateChanged)schedulePersist();
    if(!cacheChanged)return;
    const bus=window.__NIAKGPT_CACHE_BUS__;writing=true;
    try{
      const patch=latest=>{latest=latest&&typeof latest==='object'?latest:{};return{...latest,at:Date.now(),chats:(latest.chats||[]).map(c=>{const s=canonicalFor(c?.id);return s?{...c,title:s.title,projectId:s.projectId,updated:Math.max(parseTime(c.updated),s.updated)}:c;})};};
      if(bus?.update)await bus.update(patch);else await chrome.storage.local.set({[CACHE_KEY]:patch(raw)});
    }catch{}finally{writing=false;}
  }
  function scheduleRoute(delay=180){clearTimeout(routeTimer);routeTimer=setTimeout(()=>{const bus=window.__NIAKGPT_CACHE_BUS__;const raw=bus?.peek?.()||cache;if(raw)reconcile(raw);},delay);}

  async function start(){
    try{const got=await chrome.storage.local.get([STATE_KEY,CACHE_KEY]);state=got[STATE_KEY]&&typeof got[STATE_KEY]==='object'?got[STATE_KEY]:state;state.chats=state.chats||{};cache=got[CACHE_KEY]||null;}catch{}
    const bus=window.__NIAKGPT_CACHE_BUS__;
    if(bus){bus.subscribe(raw=>reconcile(raw));try{const raw=await bus.get();if(raw)await reconcile(raw);}catch{}}
    else if(cache)await reconcile(cache);
    window.__NIAKGPT_CHAT_STATE_113__={get:id=>canonicalFor(id),all:()=>state.chats};
  }
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]&&!writing)reconcile(changes[CACHE_KEY].newValue);});}catch{}
  window.addEventListener('popstate',()=>scheduleRoute(80));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>scheduleRoute(80));
  document.addEventListener('niakgpt:activity-changed',()=>{if((document.documentElement.dataset.ng86Activity||'ready')==='ready')scheduleRoute(120);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRoute(80);});
  start();
})();
