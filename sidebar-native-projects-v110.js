(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_PROJECTS_110__)return;
  window.__NIAKGPT_NATIVE_PROJECTS_110__=true;

  // 0.9.60 owns native Projects suppression. Keep historical modules in the
  // repository/labs, but prevent three competing sidebar observers at runtime.
  window.__NIAKGPT_SIDEBAR_AUTHORITY_107__=true;
  window.__NIAKGPT_SIDEBAR_EXPANDO_GUARD_108__=true;
  window.__NIAKGPT_PROJECTS_AUTHORITY_109__=true;

  const HIDE='ng110-native-projects-hidden';
  const SECTION='[class~="group/sidebar-expando-section"],[class~="sidebar-expando-section"]';
  const PROJECT_ROW='[class~="group/project-unfurl-row"],[class~="project-unfurl-row"]';
  let root=null,observer=null,bootstrapObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sidebar=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav,aside');
  const headingIsProjects=el=>/^(projets?|projects?)$/.test(norm(el?.textContent));

  function isNativeProjectsSection(section){
    if(!(section instanceof Element)||section.closest('#ng8-pins'))return false;
    if(section.querySelector(PROJECT_ROW))return true;
    const heading=[...section.querySelectorAll('h1,h2,h3,[role="heading"]')].find(headingIsProjects);
    if(!heading)return false;
    return !!section.querySelector('[data-sidebar-item="true"],[role="button"],button');
  }

  function hideNativeProjects(scope=document){
    let count=0;
    for(const section of scope.querySelectorAll?.(SECTION)||[]){
      if(!isNativeProjectsSection(section))continue;
      section.classList.add(HIDE);
      section.dataset.ng110NativeProjects='1';
      section.setAttribute('aria-hidden','true');
      count++;
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-natifs',`MASQUÉS · ${count} bloc(s) natif(s)`);
    return count;
  }

  function schedule(delay=0){
    if(stopped)return;
    clearTimeout(timer);
    timer=setTimeout(()=>{timer=0;hideNativeProjects(root||document);},delay);
  }

  function bind(){
    const next=sidebar();
    if(!next)return false;
    if(next===root)return true;
    observer?.disconnect();root=next;
    observer=new MutationObserver(records=>{
      if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule(0);
    });
    observer.observe(root,{childList:true,subtree:true});
    hideNativeProjects(root);
    return true;
  }

  function start(){
    stopped=false;
    hideNativeProjects(document);
    if(bind())return;
    bootstrapObserver?.disconnect();
    bootstrapObserver=new MutationObserver(()=>{
      // CSS already prevents the native Projects expando from flashing; this
      // observer exists only until the sidebar root is mounted.
      hideNativeProjects(document);
      if(bind()){bootstrapObserver?.disconnect();bootstrapObserver=null;}
    });
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  function stop(){
    stopped=true;clearTimeout(timer);timer=0;
    observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;root=null;
  }

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(0));
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
