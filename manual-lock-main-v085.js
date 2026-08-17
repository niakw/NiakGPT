(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_MANUAL_LOCK_MAIN_085__)return;
  window.__NIAKGPT_MANUAL_LOCK_MAIN_085__=true;

  // Despite the historical filename, this module intentionally runs in the isolated
  // world. It never wraps window.fetch. A manual lock is created only after a user
  // gesture selects a Project and the sidebar/cache visibly confirms the destination.
  const CACHE_KEY='niakgpt-v08-cache';
  const CHAT_RX=/\/c\/([0-9a-f-]{20,})/i;
  let projects=[],moveIntentUntil=0,pending=null,observer=null,timers=[],disposed=false;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const cid=h=>String(h||'').match(CHAT_RX)?.[1]||'';
  const pid=h=>{const m=String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i);return m?normalizePid(m[1]):'';};
  const currentChatId=()=>cid(location.pathname);
  const sidebar=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||document.querySelector('nav');
  const invalidated=error=>/extension context invalidated|context invalidated/i.test(String(error?.message||error||''));

  function clearTimers(){for(const t of timers)clearTimeout(t);timers=[];}
  function stopPending(){pending=null;clearTimers();observer?.disconnect();observer=null;}
  function dispose(){if(disposed)return;disposed=true;stopPending();try{chrome.storage.onChanged.removeListener(storageChanged);}catch{}}

  async function loadProjects(){
    if(disposed)return;
    try{
      const raw=window.__NIAKGPT_CACHE_BUS__?await window.__NIAKGPT_CACHE_BUS__.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
      if(disposed)return;projects=(raw?.projects||[]).filter(p=>normalizePid(p?.id).startsWith('g-p-')&&p?.name).map(p=>({...p,id:normalizePid(p.id)}));
    }catch(error){if(invalidated(error))dispose();}
  }
  function projectForLabel(text){
    const key=norm(text);if(!key)return null;
    return projects.find(p=>norm(p.name)===key)||projects.find(p=>key===norm(`project ${p.name}`)||key===norm(`projet ${p.name}`))||null;
  }
  function currentRow(id){const root=sidebar();if(!root||!id)return null;return[...root.querySelectorAll('a[href*="/c/"]')].find(a=>cid(a.getAttribute('href'))===id)||null;}
  function domConfirms(p){
    if(!p)return false;const row=currentRow(p.id);if(!row)return false;
    const href=row.getAttribute('href')||'',rowPid=pid(href);
    if(p.detached)return !rowPid&&!row.querySelector('.ng8-chat-project');
    if(rowPid===p.projectId)return true;
    const labels=[row.querySelector('.ng8-chat-project')?.textContent,row.querySelector('small')?.textContent,row.getAttribute('aria-label')].map(norm).filter(Boolean);
    return labels.includes(norm(p.projectName));
  }
  async function cacheConfirms(p){
    if(disposed||!p)return false;
    try{
      const raw=window.__NIAKGPT_CACHE_BUS__?await window.__NIAKGPT_CACHE_BUS__.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
      const chat=raw?.chats?.find?.(c=>c?.id===p.id);if(!chat)return false;
      return normalizePid(chat.projectId||'')===(p.detached?'':p.projectId);
    }catch(error){if(invalidated(error))dispose();return false;}
  }
  async function confirm(){
    if(disposed||!pending)return;const candidate=pending;
    if(!(domConfirms(candidate)||await cacheConfirms(candidate)))return;
    if(pending!==candidate)return;stopPending();
    const detail={id:candidate.id,projectId:candidate.projectId,projectName:candidate.projectName,detached:candidate.detached,verified:true,verifiedBy:'native-dom',status:200,ok:true,at:Date.now()};
    document.dispatchEvent(new CustomEvent('niakgpt:manual-project-move-confirmed',{detail}));
    setTimeout(()=>{if(!disposed)document.dispatchEvent(new CustomEvent('niakgpt:manual-project-move',{detail}));},0);
  }
  function arm(candidate){
    stopPending();pending={...candidate,at:Date.now()};const root=sidebar();
    if(root){observer=new MutationObserver(()=>confirm());observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['href','aria-label']});}
    for(const delay of [80,220,520,1000,1800,3200])timers.push(setTimeout(confirm,delay));
    timers.push(setTimeout(stopPending,5200));
  }

  function targetText(target){return String(`${target?.getAttribute?.('aria-label')||''} ${target?.getAttribute?.('title')||''} ${target?.textContent||''}`).replace(/\s+/g,' ').trim();}
  function isMenuChoice(el){return !!el?.closest?.('[role="menu"],[role="listbox"],[data-radix-menu-content],[data-radix-popper-content-wrapper]');}
  function handleClick(event){
    if(disposed||!(event.target instanceof Element))return;
    const item=event.target.closest('[role="menuitem"],[role="option"],[data-radix-collection-item],button,[role="button"]');if(!item)return;
    const text=targetText(item),key=norm(text),id=currentChatId();if(!id)return;
    if(/(?:deplacer|déplacer|move|changer|change).{0,28}(?:projet|project)|(?:projet|project).{0,28}(?:deplacer|déplacer|move|changer|change)/i.test(text)){
      moveIntentUntil=Date.now()+7000;return;
    }
    if(/retirer.{0,20}(?:projet|project)|remove.{0,20}(?:project)/i.test(text)){
      arm({id,projectId:'',projectName:'',detached:true});moveIntentUntil=0;return;
    }
    if(Date.now()>moveIntentUntil||!isMenuChoice(item))return;
    const project=projectForLabel(key);if(!project)return;
    moveIntentUntil=0;arm({id,projectId:project.id,projectName:project.name,detached:false});
  }

  const storageChanged=(changes,area)=>{if(disposed||area!=='local'||!changes[CACHE_KEY])return;loadProjects().then(()=>confirm());};
  document.addEventListener('click',handleClick,true);
  try{chrome.storage.onChanged.addListener(storageChanged);}catch(error){if(invalidated(error))dispose();}
  window.addEventListener('pagehide',dispose,{once:true});
  loadProjects();
})();
