(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_110__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_110__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng109-native-projects-authoritative';
  const SIDEBAR_SEL='[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav';
  let navNode=null,observer=null,rootObserver=null,bootstrapObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const ownProjects=()=>document.getElementById('ng8-pins');
  const ownProjectsPresent=()=>{const box=ownProjects();return !!(box&&box.isConnected&&!box.hidden);};
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const isProjectsLabel=el=>!!el&&outsideOwn(el)&&/^(projets?|projects?)(?:\s+.*)?$/.test(norm(el.textContent));
  const sectionToken=el=>[...(el?.classList||[])].some(x=>x==='group/sidebar-expando-section'||x==='sidebar-expando-section'||x.endsWith('/sidebar-expando-section'));
  const projectSeed=el=>!!el&&outsideOwn(el)&&(
    [...(el.classList||[])].some(x=>/project-unfurl-row/.test(x))||
    (el.matches?.('a[href*="/g/g-p-"][href*="/project"]')??false)||
    (el.matches?.('[data-testid*="project" i],[aria-label*="project" i],[aria-label*="projet" i]')??false)
  );
  const isProjectChatHref=h=>/\/g\/g-p-[^/]+\/c\//i.test(String(h||''));
  const genericChatCount=host=>[...(host?.querySelectorAll?.('a[href*="/c/"]')||[])].filter(a=>outsideOwn(a)&&!isProjectChatHref(a.getAttribute('href'))).length;
  const unrelatedNavCount=host=>[...(host?.querySelectorAll?.('a[href],button')||[])].filter(el=>{
    if(!outsideOwn(el))return false;
    const href=String(el.getAttribute?.('href')||'');
    if(/^\/(?:library|tasks|plugins)(?:[/?#]|$)/i.test(href))return true;
    const t=norm(el.textContent||el.getAttribute?.('aria-label'));
    return /^(nouveau chat|new chat|bibliotheque|library|planification|tasks|plugins|plus|more)$/.test(t);
  }).length;
  const safeSection=section=>!!section&&genericChatCount(section)===0&&unrelatedNavCount(section)===0;

  function sectionFrom(node,nav){
    let cur=node;
    for(let depth=0;depth<12&&cur&&cur!==nav;depth++,cur=cur.parentElement){
      if(sectionToken(cur)&&safeSection(cur))return cur;
    }
    cur=node;
    for(let depth=0;depth<9&&cur&&cur!==nav;depth++,cur=cur.parentElement){
      if(cur.contains(ownProjects())||!safeSection(cur))continue;
      const seeds=[...cur.querySelectorAll?.('[class*="project-unfurl-row"],a[href*="/g/g-p-"][href*="/project"],[data-testid*="project" i]')||[]].filter(outsideOwn);
      const labels=[...cur.querySelectorAll?.('h1,h2,h3,[role="heading"],button')||[]].filter(isProjectsLabel);
      if(seeds.length&&labels.length)return cur;
    }
    return null;
  }

  function nativeSections(nav){
    const found=new Set();
    const labels=[...nav.querySelectorAll('h1,h2,h3,[role="heading"],button')].filter(isProjectsLabel);
    for(const label of labels){const section=sectionFrom(label,nav);if(section&&section!==nav&&!section.contains(ownProjects())&&outsideOwn(section))found.add(section);}
    const seeds=[...nav.querySelectorAll('[class*="project-unfurl-row"],a[href*="/g/g-p-"][href*="/project"],[data-testid*="project" i]')].filter(projectSeed);
    for(const seed of seeds){const section=sectionFrom(seed,nav);if(section&&section!==nav&&!section.contains(ownProjects())&&outsideOwn(section))found.add(section);}
    return [...found];
  }

  function release(nav){
    for(const el of nav?.querySelectorAll?.('.'+HIDE)||[]){el.classList.remove(HIDE);el.removeAttribute('data-ng109-native-projects');el.removeAttribute('aria-hidden');}
    document.documentElement.removeAttribute('data-ng110-projects-authority');
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');
  }
  function apply(){
    if(stopped)return false;
    const nav=navRoot();if(!nav)return false;
    if(!ownProjectsPresent()){release(nav);return false;}
    document.documentElement.dataset.ng110ProjectsAuthority='1';
    const sections=nativeSections(nav);
    for(const section of sections){section.classList.add(HIDE);section.dataset.ng109NativeProjects='1';section.setAttribute('aria-hidden','true');}
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · NiakGPT autoritaire · ${sections.length} bloc(s) natif(s) masqué(s)`);
    return sections.length>0;
  }
  function schedule(delay=6){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;bind();apply();},delay);}
  function bind(){
    const nav=navRoot();if(!nav)return false;
    if(nav===navNode&&observer)return true;
    observer?.disconnect();navNode=nav;observer=new MutationObserver(()=>schedule(4));
    observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','data-testid']});
    return true;
  }
  function relevantRootMutation(records){
    for(const record of records){
      for(const node of [...record.addedNodes,...record.removedNodes]){
        if(!(node instanceof Element))continue;
        if(node.matches?.(SIDEBAR_SEL)||node.querySelector?.(SIDEBAR_SEL))return true;
      }
    }
    return false;
  }
  function bindRoot(){
    rootObserver?.disconnect();
    rootObserver=new MutationObserver(records=>{if(!relevantRootMutation(records))return;const nav=navRoot();if(nav!==navNode||!navNode?.isConnected)schedule(0);});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function start(){
    stopped=false;bindRoot();
    if(bind()){apply();return;}
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(!bind())return;bootstrapObserver?.disconnect();bootstrapObserver=null;apply();});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();rootObserver?.disconnect();bootstrapObserver?.disconnect();observer=rootObserver=bootstrapObserver=null;navNode=null;}

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(8));
  window.addEventListener('popstate',()=>schedule(4));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(4));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
