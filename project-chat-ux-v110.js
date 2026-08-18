(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_CHAT_UX_110__)return;
  window.__NIAKGPT_PROJECT_CHAT_UX_110__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  let observer=null,boxNode=null,bootstrapObserver=null,timer=0,stopped=false,rpcSeq=0,outState={out:{}},cache={chats:[],projectChats:{}};

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng110u-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
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
      if(bus?.update){cache=await bus.update(update)||cache;}
      else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];const next=update(raw);await chrome.storage.local.set({[CACHE_KEY]:next});cache=next;}
    }catch{}
  }

  function titleElement(link){
    const direct=[...link.children].find(el=>el.tagName==='SPAN'&&!el.classList.contains('ng100-out-badge'));
    return direct||link.querySelector('.ng96-chat-title,span');
  }

  async function renameChat(link){
    const chatId=link?.dataset?.chat||cid(link?.getAttribute?.('href'));if(!chatId)return;
    const titleEl=titleElement(link);
    const oldTitle=clean(titleEl?.textContent||link.getAttribute('title')||'Conversation');
    const next=clean(window.prompt('Renommer la conversation',oldTitle));
    if(!next||next===oldTitle)return;
    const result=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});
    if(!result?.ok){window.__NIAKGPT_DIAGNOSTICS__?.set('renommage',`ERREUR · ${result?.status||0}`);return;}
    if(titleEl)titleEl.textContent=next;
    link.dataset.ng110Title=next;
    link.title=`${next} · F2 pour renommer`;
    await updateCacheTitle(chatId,next);
    window.__NIAKGPT_DIAGNOSTICS__?.set('renommage','OK · conversation renommée');
    schedule(0);
  }

  function decorateLink(link){
    if(!(link instanceof HTMLElement))return;
    const chatId=link.dataset.chat||cid(link.getAttribute('href'));if(!chatId)return;
    const titleEl=titleElement(link);if(titleEl)titleEl.classList.add('ng110-chat-title');
    link.dataset.ng110Chat='1';
    link.dataset.ng110Renamable='1';
    const title=clean(titleEl?.textContent||link.getAttribute('title')||'Conversation');
    link.dataset.ng110Title=title;
    link.title=`${title} · F2 pour renommer`;
    const active=chatId===currentCid();
    if(active){link.dataset.ng110Active='1';link.setAttribute('aria-current','page');}
    else{delete link.dataset.ng110Active;link.removeAttribute('aria-current');}
    const out=!!outState?.out?.[chatId];
    if(out)link.dataset.ng110Out='1';else delete link.dataset.ng110Out;
  }

  function render(){
    timer=0;if(stopped)return;
    const box=document.getElementById('ng8-pins');if(!box)return;
    for(const link of box.querySelectorAll('.ng96-folder-list a[data-chat]'))decorateLink(link);
  }
  function schedule(delay=18){if(stopped)return;clearTimeout(timer);timer=setTimeout(render,delay);}

  function isRenameHit(link,event){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return false;
    const r=link.getBoundingClientRect();
    return event.clientX>=r.right-31&&event.clientX<=r.right+1&&event.clientY>=r.top&&event.clientY<=r.bottom;
  }
  function onClick(event){
    const link=event.target instanceof Element?event.target.closest('.ng96-folder-list a[data-chat]'):null;
    if(!link||!boxNode?.contains(link)||!isRenameHit(link,event))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();renameChat(link);
  }
  function onKey(event){
    if(event.key!=='F2')return;
    const link=event.target instanceof Element?event.target.closest('.ng96-folder-list a[data-chat]'):null;
    if(!link||!boxNode?.contains(link))return;
    event.preventDefault();event.stopPropagation();renameChat(link);
  }

  function bind(){
    const box=document.getElementById('ng8-pins');if(!box)return false;
    if(box===boxNode)return true;
    if(boxNode){boxNode.removeEventListener('click',onClick,true);boxNode.removeEventListener('keydown',onKey,true);}
    observer?.disconnect();boxNode=box;
    box.addEventListener('click',onClick,true);box.addEventListener('keydown',onKey,true);
    observer=new MutationObserver(()=>schedule(10));
    observer.observe(box,{childList:true,subtree:true});
    schedule(0);return true;
  }
  function start(){
    stopped=false;
    if(bind())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bind()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){
    stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;
    if(boxNode){boxNode.removeEventListener('click',onClick,true);boxNode.removeEventListener('keydown',onKey,true);}boxNode=null;
  }

  try{chrome.storage.local.get([OUT_KEY,CACHE_KEY]).then(g=>{outState=g?.[OUT_KEY]||outState;cache=g?.[CACHE_KEY]||cache;schedule(0);}).catch(()=>{});}catch{}
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[OUT_KEY])outState=changes[OUT_KEY].newValue||{out:{}};if(changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;schedule(0);});}catch{}
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(0);}});
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
