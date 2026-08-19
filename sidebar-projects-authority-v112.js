(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_112__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_112__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const MARK='data-ng112-native-projects';
  const LEGACY='ng112-native-projects-authoritative';
  let observer=null,timer=0,stopped=false,observedRoots=[];

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const ownProjects=()=>document.getElementById('ng8-pins');
  const ownReady=()=>{const box=ownProjects();return !!(box&&box.isConnected&&!box.hidden&&getComputedStyle(box).display!=='none'&&box.querySelector('[data-ng8-pin],a[href*="/g/g-p-"]'));};
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const inMain=el=>!!el?.closest?.('main,[role="main"],article');
  const projectLabel=v=>/^(projets?|projects?)$/.test(norm(v));
  const showMoreLabel=v=>/^(afficher|voir) plus$|^show more$/.test(norm(v));
  const projectHomeHref=href=>{const raw=String(href||'').trim();if(/^\/projects\/?(?:[?#].*)?$/.test(raw))return true;try{const u=new URL(raw,location.href);return u.origin===location.origin&&/^\/projects\/?$/.test(u.pathname);}catch{return false;}};
  const projectChildHref=href=>/\/g\/g-p-[^/?#]+(?:\/|$)/i.test(String(href||''));

  function sharesSidebarShell(el){
    if(!el||!outsideOwn(el)||inMain(el))return false;
    if(el.closest('aside,nav,[data-testid*="sidebar" i],[class*="sidebar" i]'))return true;
    const own=ownProjects();if(!own)return false;
    let node=own.parentElement;
    for(let depth=0;depth<7&&node&&node!==document.body&&node!==document.documentElement;depth++,node=node.parentElement){if(node.contains(el))return true;}
    return false;
  }
  function managedNames(){
    const box=ownProjects(),names=new Set();if(!box)return names;
    for(const row of box.querySelectorAll('[data-ng8-pin],.ng96-pin-entry>a[href*="/g/g-p-"],a[href*="/g/g-p-"]')){
      const label=clean(row.querySelector?.(':scope>span')?.textContent||row.getAttribute?.('aria-label')||row.textContent);
      if(label)names.add(norm(label.replace(/\s+\d{1,2}\/\d{1,2}.*$/,'')));
    }
    return names;
  }
  function rowTarget(el){
    if(!el||!sharesSidebarShell(el))return null;
    const row=el.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],[role="listitem"],li');
    return row&&sharesSidebarShell(row)&&!row.contains(ownProjects())?row:el;
  }
  function projectLinks(scope){return [...scope.querySelectorAll?.('a[href]')||[]].filter(a=>sharesSidebarShell(a)&&projectChildHref(a.getAttribute('href')));}
  function genericChatLinks(scope){return [...scope.querySelectorAll?.('a[href*="/c/"]')||[]].filter(a=>sharesSidebarShell(a)&&!projectChildHref(a.getAttribute('href')));}
  function hasProjectHeading(scope){return [...scope.querySelectorAll?.('h1,h2,h3,[role="heading"],button,[role="button"],a,[aria-label],div,span')||[]].some(el=>sharesSidebarShell(el)&&(projectLabel(el.textContent)||projectLabel(el.getAttribute?.('aria-label'))));}
  function hasShowMore(scope){return [...scope.querySelectorAll?.('button,[role="button"],a')||[]].some(el=>sharesSidebarShell(el)&&showMoreLabel(el.textContent||el.getAttribute?.('aria-label')));}
  function managedIdentityCount(scope,names=managedNames()){
    if(!scope||!names.size)return 0;const seen=new Set();
    for(const el of scope.querySelectorAll?.('a,button,[role="link"],[role="button"],[class*="project-unfurl-row"],span')||[]){
      if(!sharesSidebarShell(el))continue;const label=norm(el.getAttribute?.('aria-label')||el.textContent);if(label&&names.has(label))seen.add(label);
    }
    return seen.size;
  }
  function nearestProjectHost(seed){
    const names=managedNames();let node=seed;
    for(let depth=0;depth<8&&node&&node!==document.body&&node!==document.documentElement;depth++,node=node.parentElement){
      if(!sharesSidebarShell(node)||node.contains(ownProjects()))continue;
      const links=projectLinks(node),identities=managedIdentityCount(node,names);if(links.length<2&&identities<2)continue;
      if(genericChatLinks(node).length)continue;
      if(hasProjectHeading(node)||hasShowMore(node)||node.matches?.('[class*="sidebar-expando-section"],[class*="project"]'))return node;
    }
    return null;
  }
  function identityHosts(){
    const hosts=new Set(),names=managedNames();
    for(const link of document.querySelectorAll('a[href*="/g/g-p-"]')){if(!sharesSidebarShell(link))continue;const host=nearestProjectHost(link);if(host)hosts.add(host);}
    if(names.size>=2){
      for(const el of document.querySelectorAll('a,button,[role="link"],[role="button"],[class*="project" i]')){
        if(!sharesSidebarShell(el))continue;const label=norm(el.getAttribute?.('aria-label')||el.textContent);if(!names.has(label))continue;const host=nearestProjectHost(el);if(host)hosts.add(host);
      }
    }
    return hosts;
  }
  function pruneTargets(items){
    const list=[...new Set(items)].filter(el=>el&&outsideOwn(el)&&sharesSidebarShell(el)&&!el.contains(ownProjects()));
    return list.filter(el=>!list.some(other=>other!==el&&other.contains(el)));
  }
  function nativeTargets(){
    const found=new Set(),names=managedNames();
    for(const link of document.querySelectorAll('a[href*="/g/g-p-"]')){if(!sharesSidebarShell(link))continue;const row=rowTarget(link);if(row)found.add(row);const host=nearestProjectHost(link);if(host)found.add(host);}
    for(const host of identityHosts())found.add(host);
    for(const link of document.querySelectorAll('a[href]')){if(!sharesSidebarShell(link)||!projectHomeHref(link.getAttribute('href')))continue;const row=rowTarget(link);if(row)found.add(row);}
    for(const el of document.querySelectorAll('h1,h2,h3,[role="heading"],button,[role="button"],a,[aria-label],span,div')){
      if(!sharesSidebarShell(el))continue;
      const label=norm(el.getAttribute?.('aria-label')||el.textContent);
      if(projectLabel(label)){
        const host=nearestProjectHost(el);if(host)found.add(host);else{const target=rowTarget(el);if(target)found.add(target);}continue;
      }
      if(showMoreLabel(label)){const host=nearestProjectHost(el);if(host)found.add(host);continue;}
      if(names.size&&names.has(label)){
        const host=nearestProjectHost(el);if(host){found.add(host);continue;}
        const hasProjectIdentity=projectChildHref(el.getAttribute?.('href'))||!!el.closest?.('[class*="project-unfurl-row"]');
        if(hasProjectIdentity){const target=rowTarget(el);if(target)found.add(target);}
      }
    }
    return pruneTargets(found);
  }
  function clearLegacyMarks(){
    for(const el of document.querySelectorAll('.'+LEGACY)){el.classList.remove(LEGACY);el.removeAttribute('aria-hidden');}
  }
  function release(){
    for(const el of document.querySelectorAll(`[${MARK}="1"]`))el.removeAttribute(MARK);
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');
  }
  function apply(){
    timer=0;if(stopped)return false;
    if(!ownReady()){release();bindObservers();return false;}
    const targets=nativeTargets(),targetSet=new Set(targets);
    for(const target of targets)if(target.getAttribute(MARK)!=='1')target.setAttribute(MARK,'1');
    for(const old of document.querySelectorAll(`[${MARK}="1"]`))if(!targetSet.has(old))old.removeAttribute(MARK);
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',targets.length?`OK · ${targets.length} surface(s) Projects native(s) masquée(s)`:'ERREUR · Projects natifs non localisés');
    bindObservers();
    return targets.length>0;
  }
  function schedule(delay=12){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}
  function relevantNode(node){
    if(!(node instanceof Element))return false;
    if(node.id==='ng8-pins'||node.matches?.('a[href*="/g/g-p-"],a[href="/projects"],[class*="project-unfurl-row"],[class*="sidebar-expando-section"],aside,nav,[data-testid*="sidebar" i]'))return true;
    if(node.querySelector?.('#ng8-pins,a[href*="/g/g-p-"],a[href="/projects"],[class*="project-unfurl-row"],[class*="sidebar-expando-section"]'))return true;
    const label=clean(node.getAttribute?.('aria-label')||node.textContent);return label.length<80&&(projectLabel(label)||showMoreLabel(label));
  }
  function relevantMutation(records){
    for(const r of records)for(const n of [...r.addedNodes,...r.removedNodes])if(relevantNode(n))return true;
    return false;
  }
  function watchRoots(){
    const roots=new Set(),own=ownProjects();
    if(own){
      const shell=own.closest('aside,[data-testid*="sidebar" i],[class*="sidebar" i]');if(shell)roots.add(shell);
      if(own.parentElement&&own.parentElement!==document.body)roots.add(own.parentElement);
      if(own.parentElement?.parentElement&&own.parentElement.parentElement!==document.body)roots.add(own.parentElement.parentElement);
    }
    for(const root of document.querySelectorAll('aside,nav,[data-testid*="sidebar" i],[class*="sidebar" i]')){
      if(inMain(root))continue;
      if(root.contains(own)||root.querySelector('a[href="/projects"],a[href*="/g/g-p-"],[class*="project-unfurl-row"]'))roots.add(root);
    }
    return [...roots].filter(r=>r&&r.isConnected&&!inMain(r));
  }
  function bindObservers(){
    const roots=watchRoots();
    if(roots.length===observedRoots.length&&roots.every((r,i)=>r===observedRoots[i])&&observer)return;
    observer?.disconnect();observedRoots=roots;observer=new MutationObserver(records=>{if(relevantMutation(records))schedule(8);});
    for(const root of roots){observer.observe(root,{childList:true,subtree:true});if(root.parentElement&&!roots.includes(root.parentElement))observer.observe(root.parentElement,{childList:true,subtree:false});}
  }
  function start(){
    stopped=false;clearLegacyMarks();bindObservers();apply();
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();observer=null;observedRoots=[];}
  document.addEventListener('niakgpt:pins-rendered',()=>apply());
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindObservers();apply();}});
  window.addEventListener('popstate',()=>{bindObservers();apply();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bindObservers();apply();});
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
