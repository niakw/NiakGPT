(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_ICONS_114__)return;
  window.__NIAKGPT_SIDEBAR_ICONS_114__=true;
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  let navNode=null,observer=null,rootObserver=null,timer=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  function kindFor(el){
    const text=norm(`${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('title')||''} ${el.textContent||''}`),href=String(el.getAttribute?.('href')||'');
    if(/nouvelle discussion|nouveau chat|new chat/.test(text))return'new';
    if(/rechercher|search/.test(text))return'search';
    if(/(^| )images?( |$)|\/images(?:[/?#]|$)/.test(text+' '+href))return'images';
    if(/applications?|(^| )apps?( |$)|\/apps(?:[/?#]|$)/.test(text+' '+href))return'apps';
    if(/codex/.test(text+' '+href))return'codex';
    return'';
  }
  function decorate(){
    timer=0;const nav=navRoot();if(!nav)return;if(nav!==navNode)bind(nav);
    let count=0;
    for(const el of nav.querySelectorAll('a,button,[role="button"],[role="link"]')){
      if(!(el instanceof HTMLElement)||el.closest(OWN)||el.matches('[data-ng8-chat],[data-ng8-project]')||el.closest('[data-ng8-chat],[data-ng8-project]'))continue;
      const kind=kindFor(el);if(!kind)continue;el.dataset.ng114NavIcon=kind;const svg=el.querySelector('svg');if(svg)svg.classList.add('ng114-native-icon');count++;
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-icons',count?`OK · ${count} contrôles NiakGPT`:'ATTENTE · navigation native non rendue');
  }
  function schedule(delay=20){clearTimeout(timer);timer=setTimeout(decorate,delay);}
  function bind(nav=navRoot()){if(!nav)return false;if(nav===navNode&&observer)return true;observer?.disconnect();navNode=nav;observer=new MutationObserver(()=>schedule(12));observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','title','href','class']});return true;}
  function start(){bind();decorate();rootObserver?.disconnect();rootObserver=new MutationObserver(()=>{const next=navRoot();if(next!==navNode){bind(next);decorate();}});rootObserver.observe(document.documentElement,{childList:true,subtree:true});}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();decorate();}});window.addEventListener('popstate',()=>decorate());if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>decorate());window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
