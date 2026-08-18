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
  const isProjectHref=el=>el?.matches?.('a[href*="/g/g-p-"]');
  const isProjectRow=el=>!!el?.matches?.('[class*="project-unfurl-row"]')||!!el?.querySelector?.('[class*="project-unfurl-row"]');

  function labelNodes(scope){
    if(!scope)return[];
    const found=[];
    for(const el of scope.querySelectorAll('h1,h2,h3,[role="heading"],button,[role="button"],[aria-label]')){
      if(!outsideOwn(el))continue;
      if(projectLabel(el.textContent)||projectLabel(el.getAttribute?.('aria-label')))found.push(el);
    }
    return found;
  }

  function hasProjectRows(scope){
    if(!scope)return false;
    return !!scope.querySelector('[class*="project-unfurl-row"],a[href*="/g/g-p-"]');
  }

  function isDedicatedExpando(section,nav){
    if(!section||section===nav||section.contains(ownProjects())||!outsideOwn(section))return false;
    if(!exactToken(section,'sidebar-expando-section'))return false;
    return labelNodes(section).length>0&&hasProjectRows(section);
  }

  function compactLabelTarget(label,nav){
    if(!label||label===nav)return null;
    const button=label.closest('button,[role="button"]');
    if(button&&button!==nav&&outsideOwn(button))return button;
    return label;
  }

  function nativeTargets(nav){
    const found=new Set();
    const dedicated=[];
    for(const section of nav.querySelectorAll('[class*="sidebar-expando-section"]')){
      if(!isDedicatedExpando(section,nav))continue;
      dedicated.push(section);found.add(section);
    }

    const insideDedicated=el=>dedicated.some(section=>section.contains(el));

    // Loose ChatGPT layouts can place Projects and Recents in the same nav. Never hide that
    // shared ancestor: hide only the exact Projects label and Project-specific rows/links.
    for(const label of labelNodes(nav)){
      if(insideDedicated(label))continue;
      const target=compactLabelTarget(label,nav);if(target)found.add(target);
    }
    for(const row of nav.querySelectorAll('[class*="project-unfurl-row"]')){
      if(!outsideOwn(row)||insideDedicated(row))continue;
      found.add(row);
    }
    for(const link of nav.querySelectorAll('a[href*="/g/g-p-"]')){
      if(!outsideOwn(link)||insideDedicated(link))continue;
      const row=link.closest('[class*="project-unfurl-row"]');
      found.add(row&&outsideOwn(row)?row:link);
    }
    return [...found].filter(el=>el&&el!==nav&&!el.contains(ownProjects()));
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
    const targets=nativeTargets(nav);
    for(const target of targets){target.classList.add(HIDE);target.dataset.ng110NativeProjects='1';target.setAttribute('aria-hidden','true');}
    for(const old of nav.querySelectorAll('.'+HIDE))if(!targets.includes(old)){old.classList.remove(HIDE);old.removeAttribute('data-ng110-native-projects');old.removeAttribute('aria-hidden');}
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · NiakGPT autoritaire · ${targets.length} cible(s) native(s) masquée(s)`);
    return targets.length>0;
  }

  function schedule(delay=16){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}

  function bindNav(nav=navRoot()){
    if(!nav)return false;
    if(nav===navNode&&navObserver)return true;
    navObserver?.disconnect();navNode=nav;
    navObserver=new MutationObserver(()=>schedule(10));
    navObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','aria-label','href']});
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
