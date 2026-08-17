(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_CHAT_UX_109__)return;
  window.__NIAKGPT_PROJECT_CHAT_UX_109__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  let observer=null,boxNode=null,bootstrapObserver=null,timer=0,stopped=false,internal=false,rpcSeq=0,outState={out:{}};

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng109u-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  async function updateCacheTitle(chatId,title){
    try{
      const bus=window.__NIAKGPT_CACHE_BUS__;
      const update=raw=>{
        raw=raw&&typeof raw==='object'?raw:{};
        const chats=(raw.chats||[]).map(c=>c?.id===chatId?{...c,title}:c);
        const projectChats={...(raw.projectChats||{})};
        for(const [pid,list] of Object.entries(projectChats))projectChats[pid]=(list||[]).map(c=>c?.id===chatId?{...c,title}:c);
        return{...raw,at:Date.now(),chats,projectChats};
      };
      if(bus?.update)await bus.update(update);
      else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];await chrome.storage.local.set({[CACHE_KEY]:update(raw)});}
    }catch{}
  }

  async function renameChat(link){
    const chatId=link?.dataset?.chat||cid(link?.getAttribute?.('href'));if(!chatId)return;
    const titleEl=link.querySelector(':scope > span:not(.ng109-out-badge),.ng96-chat-title');
    const oldTitle=clean(titleEl?.textContent||link.getAttribute('title')||'Conversation');
    const next=clean(window.prompt('Renommer la conversation',oldTitle));
    if(!next||next===oldTitle)return;
    const result=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});
    if(!result?.ok){window.__NIAKGPT_DIAGNOSTICS__?.set('renommage',`ERREUR · ${result?.status||0}`);return;}
    if(titleEl)titleEl.textContent=next;link.title=next;await updateCacheTitle(chatId,next);
    window.__NIAKGPT_DIAGNOSTICS__?.set('renommage','OK · conversation renommée');schedule(0);
  }

  function ensureRow(link){
    let row=link.closest('.ng109-chat-row');
    if(row)return row;
    row=document.createElement('div');row.className='ng109-chat-row';
    link.parentElement?.insertBefore(row,link);row.appendChild(link);
    const rename=document.createElement('button');rename.type='button';rename.className='ng109-chat-rename';rename.textContent='✎';rename.title='Renommer la conversation';rename.setAttribute('aria-label','Renommer la conversation');
    rename.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();renameChat(link);});
    row.appendChild(rename);return row;
  }

  function decorateLink(link){
    if(!(link instanceof HTMLElement))return;
    const chatId=link.dataset.chat||cid(link.getAttribute('href'));if(!chatId)return;
    const row=ensureRow(link);if(!row)return;
    const active=chatId===currentCid();
    if(active){link.dataset.ng109Active='1';link.setAttribute('aria-current','page');row.dataset.ng109Active='1';}
    else{delete link.dataset.ng109Active;link.removeAttribute('aria-current');delete row.dataset.ng109Active;}
    const out=!!outState?.out?.[chatId];
    if(out){
      row.dataset.ng109Out='1';link.dataset.ng109Out='1';
      if(!link.querySelector(':scope > .ng109-out-badge')){const badge=document.createElement('span');badge.className='ng109-out-badge';badge.textContent='OUT';badge.title='Conversation arrivée à sa limite';link.appendChild(badge);}
    }else{
      delete row.dataset.ng109Out;delete link.dataset.ng109Out;link.querySelector(':scope > .ng109-out-badge')?.remove();
    }
  }

  function render(){
    timer=0;if(stopped)return;
    const box=document.getElementById('ng8-pins');if(!box)return;
    internal=true;
    try{
      for(const link of box.querySelectorAll('.ng96-folder-list a[data-chat]'))decorateLink(link);
      for(const list of box.querySelectorAll('.ng96-folder-list')){
        const rows=[...list.querySelectorAll(':scope > .ng109-chat-row')];
        for(const row of rows.filter(r=>r.dataset.ng109Out==='1'))list.appendChild(row);
      }
    }finally{queueMicrotask(()=>{internal=false;});}
  }
  function schedule(delay=20){if(stopped)return;clearTimeout(timer);timer=setTimeout(render,delay);}
  function bind(){
    const box=document.getElementById('ng8-pins');if(!box||box===boxNode)return !!box;
    observer?.disconnect();boxNode=box;observer=new MutationObserver(()=>{if(!internal)schedule(10);});observer.observe(box,{childList:true,subtree:true});schedule(0);return true;
  }
  function start(){
    stopped=false;
    if(bind())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bind()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;boxNode=null;}

  try{chrome.storage.local.get(OUT_KEY).then(g=>{outState=g?.[OUT_KEY]||outState;schedule(0);}).catch(()=>{});}catch{}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[OUT_KEY]){outState=changes[OUT_KEY].newValue||{out:{}};schedule(0);}if(changes[CACHE_KEY])schedule(20);});
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
