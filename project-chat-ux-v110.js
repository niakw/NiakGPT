(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_CHAT_UX_110__)return;
  window.__NIAKGPT_PROJECT_CHAT_UX_110__=true;

  const OUT_KEY='niakgpt-continuity-v100';
  let observer=null,boxNode=null,bootstrapObserver=null,timer=0,stopped=false,outState={out:{}};
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  function decorateLink(link){
    if(!(link instanceof HTMLElement))return;const chatId=link.dataset.chat||cid(link.getAttribute('href'));if(!chatId)return;
    const row=link.closest('.ng96-chat-entry');
    link.dataset.ng110Chat='1';const titleEl=link.querySelector(':scope>span,.ng96-chat-title,span');if(titleEl)titleEl.classList.add('ng110-chat-title');
    const active=chatId===currentCid(),out=!!outState?.out?.[chatId];
    if(active){link.dataset.ng110Active='1';link.setAttribute('aria-current','page');}else{delete link.dataset.ng110Active;link.removeAttribute('aria-current');}
    if(out)link.dataset.ng110Out='1';else delete link.dataset.ng110Out;
    if(row){row.dataset.ng110ChatRow='1';if(active)row.dataset.ng110Active='1';else delete row.dataset.ng110Active;if(out)row.dataset.ng110Out='1';else delete row.dataset.ng110Out;}
  }
  function revealActive(){
    const id=currentCid();if(!id)return;const box=document.getElementById('ng8-pins'),link=box?.querySelector(`.ng96-folder-list a[data-chat="${CSS.escape(id)}"]`);if(!(link instanceof HTMLElement))return;
    const list=link.closest('.ng96-folder-list');if(!(list instanceof HTMLElement))return;
    const lr=list.getBoundingClientRect(),rr=link.getBoundingClientRect();if(rr.top<lr.top+1||rr.bottom>lr.bottom-1){try{link.scrollIntoView({block:'nearest',inline:'nearest'});}catch{}}
  }
  function render(){timer=0;if(stopped)return;const box=document.getElementById('ng8-pins');if(!box)return;for(const link of box.querySelectorAll('.ng96-folder-list a[data-chat]'))decorateLink(link);requestAnimationFrame(()=>{if(!stopped)revealActive();});}
  function schedule(delay=18){if(stopped)return;clearTimeout(timer);timer=setTimeout(render,delay);}
  function bind(){const box=document.getElementById('ng8-pins');if(!box)return false;if(box===boxNode)return true;observer?.disconnect();boxNode=box;observer=new MutationObserver(()=>schedule(10));observer.observe(box,{childList:true,subtree:true});schedule(0);return true;}
  function start(){stopped=false;if(bind())return;bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bind()){bootstrapObserver?.disconnect();bootstrapObserver=null;}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);}
  function stop(){stopped=true;clearTimeout(timer);observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;boxNode=null;}
  try{chrome.storage.local.get(OUT_KEY).then(g=>{outState=g?.[OUT_KEY]||outState;schedule(0);}).catch(()=>{});chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[OUT_KEY]){outState=changes[OUT_KEY].newValue||{out:{}};schedule(0);}});}catch{}
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});document.addEventListener('niakgpt:folder-rendered',()=>{schedule(0);setTimeout(revealActive,25);});document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(0);}});window.addEventListener('popstate',()=>schedule(0));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted)start();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();