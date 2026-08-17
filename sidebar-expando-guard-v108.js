(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_EXPANDO_GUARD_108__)return;
  window.__NIAKGPT_SIDEBAR_EXPANDO_GUARD_108__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng108-native-project-expando';
  let navNode=null,observer=null,bootstrapObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const managedPins=()=>document.getElementById('ng8-pins');
  const managedReady=()=>{
    const box=managedPins();
    return !!(box&&box.isConnected&&!box.hidden&&box.querySelector('a[data-ng8-pin="1"],a[href*="/g/g-p-"]'));
  };
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const isProjectHeading=el=>!!el&&outsideOwn(el)&&/^(projets?|projects?)$/.test(norm(el.textContent));

  function nativeExpandoSections(nav){
    const found=new Set();
    for(const heading of nav.querySelectorAll('h1,h2,h3,[role="heading"]')){
      if(!isProjectHeading(heading))continue;
      const section=heading.closest('[class*="sidebar-expando-section"]');
      if(!section||section===nav||section.contains(managedPins())||!outsideOwn(section))continue;
      found.add(section);
    }
    return [...found];
  }

  function release(nav){
    for(const el of nav?.querySelectorAll?.('.'+HIDE)||[])el.classList.remove(HIDE);
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-expando','FALLBACK · bloc natif disponible');
  }

  function apply(){
    if(stopped)return false;
    const nav=navRoot();if(!nav)return false;
    if(!managedReady()){release(nav);return false;}
    const sections=nativeExpandoSections(nav);
    for(const section of sections)section.classList.add(HIDE);
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-expando',`OK · ${sections.length} section(s) Projets native(s) masquée(s)`);
    return sections.length>0;
  }

  function schedule(delay=12){
    if(stopped)return;
    clearTimeout(timer);
    timer=setTimeout(()=>{timer=0;apply();},delay);
  }

  function bind(){
    const nav=navRoot();if(!nav||nav===navNode)return !!nav;
    observer?.disconnect();navNode=nav;
    observer=new MutationObserver(()=>schedule(8));
    observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded']});
    return true;
  }

  function bootstrap(){
    if(bind()){apply();return;}
    bootstrapObserver?.disconnect();
    bootstrapObserver=new MutationObserver(()=>{
      if(!bind())return;
      bootstrapObserver?.disconnect();bootstrapObserver=null;apply();
    });
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  function stop(){
    stopped=true;clearTimeout(timer);timer=0;
    observer?.disconnect();bootstrapObserver?.disconnect();observer=bootstrapObserver=null;navNode=null;
  }
  function start(){stopped=false;bootstrap();schedule(0);}

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));
  window.addEventListener('popstate',()=>schedule(12));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(12));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
