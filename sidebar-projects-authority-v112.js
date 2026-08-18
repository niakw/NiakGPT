(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_112__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_112__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng112-native-projects-authoritative';
  let navNode=null,navObserver=null,rootObserver=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const ownProjects=()=>document.getElementById('ng8-pins');
  const ownReady=()=>{const box=ownProjects();return !!(box&&box.isConnected&&!box.hidden&&getComputedStyle(box).display!=='none'&&box.querySelector('[data-ng8-pin],a[href*="/g/g-p-"]'));};
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const projectLabel=v=>/^(projets?|projects?)$/.test(norm(v));
  const exactToken=(el,token)=>[...(el?.classList||[])].some(x=>x===token||x.endsWith('/'+token));
  const projectHomeHref=href=>{const raw=String(href||'').trim();if(/^\/projects\/?(?:[?#].*)?$/.test(raw))return true;try{const u=new URL(raw,location.href);return u.origin===location.origin&&/^\/projects\/?$/.test(u.pathname);}catch{return false;}};
  const projectChildHref=href=>String(href||'').includes('/g/g-p-');
  const projectHref=href=>projectHomeHref(href)||projectChildHref(href);

  function managedNames(){
    const box=ownProjects(),names=new Set();if(!box)return names;
    for(const row of box.querySelectorAll('[data-ng8-pin],.ng96-pin-entry>a[href*="/g/g-p-"],a[href*="/g/g-p-"]')){
      const label=clean(row.querySelector?.(':scope>span')?.textContent||row.getAttribute?.('aria-label')||row.textContent);
      if(label)names.add(norm(label.replace(/\s+\d{1,2}\/\d{1,2}.*$/,'')));
    }
    return names;
  }
  function labelNodes(scope){if(!scope)return[];const found=[];for(const el of scope.querySelectorAll('h1,h2,h3,[role="heading"],button,[role="button"],a[href],[aria-label]')){if(!outsideOwn(el))continue;if(projectLabel(el.textContent)||projectLabel(el.getAttribute?.('aria-label')))found.push(el);}return found;}
  function hasProjectSurface(scope){if(!scope)return false;if(scope.querySelector('[class*="project-unfurl-row"],a[href*="/g/g-p-"]'))return true;return [...scope.querySelectorAll('a[href]')].some(a=>projectHomeHref(a.getAttribute('href')));}
  function isDedicatedExpando(section,nav){if(!section||section===nav||section.contains(ownProjects())||!outsideOwn(section))return false;if(!exactToken(section,'sidebar-expando-section'))return false;return labelNodes(section).length>0&&hasProjectSurface(section);}
  function compactLabelTarget(label,nav){if(!label||label===nav)return null;const row=label.closest('[data-sidebar-item="true"],li,[class*="sidebar-item"]');if(row&&row!==nav&&outsideOwn(row)&&!row.contains(ownProjects()))return row;if(label.matches?.('a[href]'))return label;const button=label.closest('button,[role="button"]');if(button&&button!==nav&&outsideOwn(button))return button;return label;}
  function projectOnlySibling(target,nav){const sibling=target?.nextElementSibling;if(!sibling||sibling===nav||!outsideOwn(sibling)||sibling.contains(ownProjects()))return null;if(!hasProjectSurface(sibling))return null;if(sibling.querySelector('h1,h2,h3,[role="heading"]'))return null;const nonProjectLinks=[...sibling.querySelectorAll('a[href]')].some(a=>!projectHref(a.getAttribute('href')));return nonProjectLinks?null:sibling;}
  function projectHomeTarget(link,nav){if(!link||link===nav||!outsideOwn(link))return null;const row=link.closest('[data-sidebar-item="true"],li,[class*="sidebar-item"]');if(row&&row!==nav&&outsideOwn(row)&&!row.contains(ownProjects())){const genericChats=[...row.querySelectorAll('a[href*="/c/"]')].some(a=>!projectChildHref(a.getAttribute('href')));if(!genericChats)return row;}return link;}
  function directChild(root,node){if(!root||!node)return null;let cur=node;while(cur.parentElement&&cur.parentElement!==root)cur=cur.parentElement;return cur.parentElement===root?cur:null;}
  function leafLabel(el){if(!el||!outsideOwn(el))return'';const aria=clean(el.getAttribute?.('aria-label'));if(aria&&aria.length<120)return norm(aria);if(el.children.length<=2)return norm(el.textContent);const leaves=[...el.querySelectorAll?.('span,a,button')||[]].filter(x=>outsideOwn(x)&&x.children.length===0).map(x=>norm(x.textContent)).filter(Boolean);return leaves[0]||norm(el.textContent);}
  function identityHosts(nav){
    const names=managedNames(),hosts=new Set();if(names.size<2)return hosts;const matches=[];
    for(const el of nav.querySelectorAll('a,button,[role="link"],[role="button"],[data-sidebar-item="true"],[class*="project-unfurl-row"]')){if(!outsideOwn(el)||el.closest('#ng8-pins'))continue;const label=leafLabel(el);if(label&&names.has(label))matches.push(el);}
    if(matches.length<2)return hosts;
    for(const seed of matches){let node=seed;for(let depth=0;depth<7&&node&&node!==nav;depth++,node=node.parentElement){if(!outsideOwn(node)||node.contains(ownProjects()))continue;const seen=new Set();for(const hit of matches)if(node.contains(hit)){const label=leafLabel(hit);if(names.has(label))seen.add(label);}if(seen.size<2)continue;const genericChats=[...node.querySelectorAll('a[href*="/c/"]')].filter(a=>outsideOwn(a)&&!projectChildHref(a.getAttribute('href')));if(genericChats.length)continue;hosts.add(node);break;}}
    const box=ownProjects(),boxTop=directChild(nav,box);if(boxTop){for(const sibling of [...nav.children]){if(sibling===boxTop||!outsideOwn(sibling)||sibling.contains(box))continue;const seen=new Set();for(const el of sibling.querySelectorAll('a,button,[role="link"],[role="button"],[data-sidebar-item="true"],span')){const label=leafLabel(el);if(names.has(label))seen.add(label);}const genericChats=[...sibling.querySelectorAll('a[href*="/c/"]')].filter(a=>!projectChildHref(a.getAttribute('href')));if(seen.size>=2&&!genericChats.length)hosts.add(sibling);}}
    return hosts;
  }
  function nativeTargets(nav){
    const found=new Set(),dedicated=[];
    for(const section of nav.querySelectorAll('[class*="sidebar-expando-section"]')){if(!isDedicatedExpando(section,nav))continue;dedicated.push(section);found.add(section);}const insideDedicated=el=>dedicated.some(section=>section.contains(el));
    for(const link of nav.querySelectorAll('a[href]')){if(!outsideOwn(link)||insideDedicated(link)||!projectHomeHref(link.getAttribute('href')))continue;const target=projectHomeTarget(link,nav);if(target)found.add(target);}
    for(const label of labelNodes(nav)){if(insideDedicated(label))continue;const target=compactLabelTarget(label,nav);if(!target)continue;found.add(target);const sibling=projectOnlySibling(target,nav);if(sibling)found.add(sibling);}
    for(const row of nav.querySelectorAll('[class*="project-unfurl-row"]')){if(!outsideOwn(row)||insideDedicated(row))continue;if([...found].some(target=>target.contains?.(row)))continue;found.add(row);}
    for(const link of nav.querySelectorAll('a[href*="/g/g-p-"]')){if(!outsideOwn(link)||insideDedicated(link))continue;if([...found].some(target=>target.contains?.(link)))continue;const row=link.closest('[class*="project-unfurl-row"]');found.add(row&&outsideOwn(row)?row:link);}
    for(const host of identityHosts(nav))found.add(host);
    return [...found].filter(el=>el&&el!==nav&&!el.contains(ownProjects()));
  }
  function release(){for(const el of document.querySelectorAll('.'+HIDE)){el.classList.remove(HIDE);el.removeAttribute('data-ng112-native-projects');el.removeAttribute('aria-hidden');}window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');}
  function apply(){timer=0;if(stopped)return false;const nav=navRoot();if(!nav){release();return false;}if(nav!==navNode)bindNav(nav);if(!ownReady()){release();return false;}const targets=nativeTargets(nav);for(const target of targets){target.classList.add(HIDE);target.dataset.ng112NativeProjects='1';target.setAttribute('aria-hidden','true');}for(const old of nav.querySelectorAll('.'+HIDE))if(!targets.includes(old)){old.classList.remove(HIDE);old.removeAttribute('data-ng112-native-projects');old.removeAttribute('aria-hidden');}window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · identité + structure · ${targets.length} cible(s) native(s) masquée(s)`);return targets.length>0;}
  function schedule(delay=16){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}
  function bindNav(nav=navRoot()){if(!nav)return false;if(nav===navNode&&navObserver)return true;navObserver?.disconnect();navNode=nav;navObserver=new MutationObserver(()=>schedule(10));navObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','aria-label','href']});return true;}
  function relevantRootMutation(records){for(const r of records)for(const n of [...r.addedNodes,...r.removedNodes]){if(!(n instanceof Element))continue;if(n.id==='ng8-pins'||n.matches?.('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav,[class*="sidebar-expando-section"]'))return true;if(n.querySelector?.('#ng8-pins,[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav,[class*="sidebar-expando-section"]'))return true;}return false;}
  function start(){stopped=false;bindNav();apply();rootObserver?.disconnect();rootObserver=new MutationObserver(records=>{const nav=navRoot();if(nav!==navNode||relevantRootMutation(records)){bindNav(nav);schedule(8);}});rootObserver.observe(document.documentElement,{childList:true,subtree:true});}
  function stop(){stopped=true;clearTimeout(timer);timer=0;navObserver?.disconnect();rootObserver?.disconnect();navObserver=rootObserver=null;navNode=null;}
  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});window.addEventListener('popstate',()=>schedule(0));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted)start();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();