(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_RENAME_112__)return;
  window.__NIAKGPT_NATIVE_RENAME_112__=true;
  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  let box=null,observer=null,boot=null,timer=0,rpcSeq=0,cache={projects:[],chats:[]};
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function rpc(path,{method='GET',body=null,timeout=15000}={}){const id=`ng112r-${Date.now()}-${++rpcSeq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});}
  function projectName(id){return clean(cache.projects?.find(p=>p?.id===id)?.name)||'';}
  function chatTitle(id){return clean(cache.chats?.find(c=>c?.id===id)?.title)||'';}
  function outsideOwn(el){return !!el&&!el.closest(OWN);}
  function nativeProjectRow(projectId,name){
    const links=[...document.querySelectorAll(`a[href*="/g/${CSS.escape(projectId)}/"]`)].filter(outsideOwn);if(links.length)return links[0].closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0];
    const target=norm(name);if(!target)return null;
    for(const el of document.querySelectorAll('nav a,nav button,nav [role="link"],nav [role="button"],[data-testid*="sidebar" i] a,[data-testid*="sidebar" i] button')){if(!outsideOwn(el))continue;if(norm(el.textContent||el.getAttribute('aria-label'))===target)return el.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||el;}
    return null;
  }
  function nativeChatRow(chatId){const links=[...document.querySelectorAll(`a[href*="/c/${CSS.escape(chatId)}"]`)].filter(outsideOwn);return links[0]?.closest('[data-sidebar-item="true"],li')||links[0]||null;}
  function fireHover(el){for(const type of ['pointerover','pointerenter','mouseover','mouseenter']){try{el.dispatchEvent(new MouseEvent(type,{bubbles:true,clientX:2,clientY:2}));}catch{}}}
  function menuButton(row){if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')];return buttons.find(b=>/more|options|menu|davantage|plus|actions?|modifier/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1)||null;}
  function renameMenuItem(){return [...document.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="option"]')].find(x=>/^(renommer|rename)\b/i.test(clean(x.textContent||x.getAttribute('aria-label'))));}
  async function invokeNativeRename(row){
    if(!row)return false;fireHover(row);await sleep(90);let b=menuButton(row);if(!b){fireHover(row);await sleep(180);b=menuButton(row);}if(!b)return false;
    b.click();await sleep(130);let item=renameMenuItem();if(!item){await sleep(180);item=renameMenuItem();}if(!item){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return false;}item.click();return true;
  }
  async function fallbackChatRename(chatId){
    const old=chatTitle(chatId)||'Conversation';const next=clean(window.prompt('Renommer la conversation',old));if(!next||next===old)return true;const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});if(!r.ok)return false;
    try{const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)cache=await bus.update(raw=>({...raw,at:Date.now(),chats:(raw.chats||[]).map(c=>c.id===chatId?{...c,title:next}:c)}))||cache;}catch{}
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));return true;
  }
  async function renameProject(projectId){
    const name=projectName(projectId),row=nativeProjectRow(projectId,name);const ok=await invokeNativeRename(row);window.__NIAKGPT_DIAGNOSTICS__?.set('renommage-project',ok?'OK · menu natif ouvert':'ERREUR · ligne native Project introuvable');
  }
  async function renameChat(chatId){
    const row=nativeChatRow(chatId);if(await invokeNativeRename(row)){window.__NIAKGPT_DIAGNOSTICS__?.set('renommage-chat','OK · menu natif ouvert');return;}
    const ok=await fallbackChatRename(chatId);window.__NIAKGPT_DIAGNOSTICS__?.set('renommage-chat',ok?'OK · renommage direct':'ERREUR · renommage impossible');
  }
  function button(kind,id){const b=document.createElement('button');b.type='button';b.className=`ng112-native-rename ng112-native-rename-${kind}`;b.dataset.ng112Rename=kind;b.dataset.ng112Id=id;b.textContent='⋯';b.title=kind==='project'?'Renommer ce Project avec le menu natif ChatGPT':'Renommer cette conversation avec le menu natif ChatGPT';b.setAttribute('aria-label',b.title);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();kind==='project'?renameProject(id):renameChat(id);},true);return b;}
  function decorate(){
    timer=0;const pins=document.getElementById('ng8-pins');if(!pins)return;
    for(const entry of pins.querySelectorAll('.ng96-pin-entry')){const a=entry.querySelector(':scope>a[data-ng8-pin]');const id=pid(a?.getAttribute('href'));if(!id)continue;let b=entry.querySelector(':scope>.ng112-native-rename-project');if(!b)entry.insertBefore(button('project',id),entry.querySelector(':scope>.ng96-project-open'));else b.dataset.ng112Id=id;}
    for(const a of pins.querySelectorAll('.ng96-folder-list>a[data-chat]')){const id=a.dataset.chat||cid(a.getAttribute('href'));if(!id)continue;if(!a.querySelector(':scope>.ng112-native-rename-chat'))a.appendChild(button('chat',id));}
  }
  function schedule(delay=20){clearTimeout(timer);timer=setTimeout(decorate,delay);}
  function bind(){const next=document.getElementById('ng8-pins');if(!next||next===box)return false;observer?.disconnect();box=next;observer=new MutationObserver(()=>schedule(15));observer.observe(box,{childList:true,subtree:true});schedule(0);return true;}
  async function start(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;}catch{}if(bind())return;boot?.disconnect();boot=new MutationObserver(()=>{if(bind()){boot.disconnect();boot=null;}});boot.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>boot?.disconnect(),15000);}
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(0);}});}catch{}
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();