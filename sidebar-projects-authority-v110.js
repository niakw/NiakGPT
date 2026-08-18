(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_110__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_110__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng110-native-projects-authoritative';
  let navNode=null,navObserver=null,rootObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const ownProjects=()=>document.getElementById('ng8-pins');
  const ownReady=()=>{const box=ownProjects();return !!(box&&box.isConnected&&!box.hidden&&getComputedStyle(box).display!=='none');};
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const projectLabel=v=>/^(projets?|projects?)$/.test(norm(v));
  const exactToken=(el,token)=>[...(el?.classList||[])].some(x=>x===token||x.endsWith('/'+token));

  function hasProjectLabel(scope){
    if(!scope)return false;
    const nodes=scope.querySelectorAll('h1,h2,h3,[role="heading"],button,[role="button"],[aria-label],[title]');
    for(const el of nodes){
      if(!outsideOwn(el))continue;
      if(projectLabel(el.textContent)||projectLabel(el.getAttribute?.('aria-label'))||projectLabel(el.getAttribute?.('title')))return true;
    }
    return false;
  }

  function hasProjectRows(scope){
    if(!scope)return false;
    return !!scope.querySelector('[class*="project-unfurl-row"],a[href*="/g/g-p-"],[data-sidebar-item="true"]');
  }

  function looksLikeProjectSection(section,nav){
    if(!section||section===nav||section.contains(ownProjects())||!outsideOwn(section))return false;
    if(!hasProjectRows(section))return false;
    if(hasProjectLabel(section))return true;
    const text=norm(section.textContent);
    return /^(projets?|projects?)\b/.test(text);
  }

  function sectionAncestors(node,nav,found){
    let cur=node?.parentElement||null;
    for(let depth=0;depth<9&&cur&&cur!==nav;depth++,cur=cur.parentElement){
      if(exactToken(cur,'sidebar-expando-section')||looksLikeProjectSection(cur,nav)){
        if(looksLikeProjectSection(cur,nav))found.add(cur);
        break;
      }
    }
  }

  function nativeSections(nav){
    const found=new Set();
    for(const section of nav.querySelectorAll('[class*="sidebar-expando-section"]'))if(looksLikeProjectSection(section,nav))found.add(section);
    for(const row of nav.querySelectorAll('[class*="project-unfurl-row"],a[href*="/g/g-p-"],[data-sidebar-item="true"]')){
      if(!outsideOwn(row))continue;
      sectionAncestors(row,nav,found);
    }
    return [...found];
  }

  function release(){
    for(const el of document.querySelectorAll('.'+HIDE)){
      el.classList.remove(HIDE);el.removeAttribute('data-ng110-native-projects');el.removeAttribute('aria-hidden');
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');
  }

  function apply(){
    timer=0;if(stopped)return false;
    const nav=navRoot();if(!nav){release();return false;}
    if(nav!==navNode)bindNav(nav);
    if(!ownReady()){release();return false;}
    const sections=nativeSections(nav);
    for(const section of sections){section.classList.add(HIDE);section.dataset.ng110NativeProjects='1';section.setAttribute('aria-hidden','true');}
    for(const old of nav.querySelectorAll('.'+HIDE))if(!sections.includes(old)){old.classList.remove(HIDE);old.removeAttribute('data-ng110-native-projects');old.removeAttribute('aria-hidden');}
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · NiakGPT autoritaire · ${sections.length} bloc(s) natif(s) masqué(s)`);
    return sections.length>0;
  }

  function schedule(delay=16){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}

  function bindNav(nav=navRoot()){
    if(!nav)return false;
    if(nav===navNode&&navObserver)return true;
    navObserver?.disconnect();navNode=nav;
    navObserver=new MutationObserver(()=>schedule(10));
    navObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','aria-label']});
    return true;
  }

  function relevantRootMutation(records){
    for(const r of records){
      for(const n of [...r.addedNodes,...r.removedNodes]){
        if(!(n instanceof Element))continue;
        if(n.id==='ng8-pins'||n.matches?.('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav,[class*="sidebar-expando-section"]'))return true;
        if(n.querySelector?.('#ng8-pins,[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav,[class*="sidebar-expando-section"]'))return true;
      }
    }
    return false;
  }

  function start(){
    stopped=false;bindNav();apply();
    rootObserver?.disconnect();rootObserver=new MutationObserver(records=>{const nav=navRoot();if(nav!==navNode||relevantRootMutation(records)){bindNav(nav);schedule(8);}});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;navObserver?.disconnect();rootObserver?.disconnect();navObserver=rootObserver=null;navNode=null;}

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
