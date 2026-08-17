(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_109__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_109__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng109-native-projects-authoritative';
  let navNode=null,observer=null,bootstrapObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const ownProjects=()=>document.getElementById('ng8-pins');
  const ownProjectsPresent=()=>{const box=ownProjects();return !!(box&&box.isConnected&&!box.hidden);};
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const isProjectsHeading=el=>!!el&&outsideOwn(el)&&/^(projets?|projects?)$/.test(norm(el.textContent));
  const hasExactToken=(el,token)=>[...(el?.classList||[])].some(x=>x===token);

  function sectionFromHeading(heading,nav){
    let node=heading?.parentElement||null;
    for(let depth=0;depth<10&&node&&node!==nav;depth++,node=node.parentElement){
      if(hasExactToken(node,'group/sidebar-expando-section')||hasExactToken(node,'sidebar-expando-section'))return node;
    }
    node=heading?.parentElement||null;
    for(let depth=0;depth<7&&node&&node!==nav;depth++,node=node.parentElement){
      if(node.contains(ownProjects()))continue;
      const rows=node.querySelectorAll?.('[class*="project-unfurl-row"],[aria-label*="projet" i],[aria-label*="project" i]')?.length||0;
      if(rows>0)return node;
    }
    return null;
  }

  function nativeSections(nav){
    const found=new Set();
    for(const heading of nav.querySelectorAll('h1,h2,h3,[role="heading"]')){
      if(!isProjectsHeading(heading))continue;
      const section=sectionFromHeading(heading,nav);
      if(!section||section===nav||section.contains(ownProjects())||!outsideOwn(section))continue;
      found.add(section);
    }
    return [...found];
  }

  function release(nav){
    for(const el of nav?.querySelectorAll?.('.'+HIDE)||[]){
      el.classList.remove(HIDE);el.removeAttribute('data-ng109-native-projects');el.removeAttribute('aria-hidden');
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');
  }

  function apply(){
    if(stopped)return false;
    const nav=navRoot();if(!nav)return false;
    if(!ownProjectsPresent()){release(nav);return false;}
    const sections=nativeSections(nav);
    for(const section of sections){section.classList.add(HIDE);section.dataset.ng109NativeProjects='1';section.setAttribute('aria-hidden','true');}
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · NiakGPT autoritaire · ${sections.length} bloc(s) natif(s) masqué(s)`);
    return sections.length>0;
  }

  function schedule(delay=8){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;apply();},delay);}
  function bind(){
    const nav=navRoot();if(!nav||nav===navNode)return !!nav;
    observer?.disconnect();navNode=nav;observer=new MutationObserver(()=>schedule(6));
    observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded']});
    return true;
  }
  function start(){
    stopped=false;
    if(bind()){apply();return;}
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(!bind())return;bootstrapObserver?.disconnect();bootstrapObserver=null;apply();});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;navNode=null;}

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(10));
  window.addEventListener('popstate',()=>schedule(8));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(8));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
