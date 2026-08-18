(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECTS_AUTHORITY_112__)return;
  window.__NIAKGPT_PROJECTS_AUTHORITY_112__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const HIDE='ng112-native-projects-hidden';
  const MORE_RX=/^(afficher plus|voir plus|show more|more)$/i;
  const PROJECT_RX=/^(projets?|projects?)$/i;
  let rootNode=null,observer=null,rootObserver=null,timer=0,stopped=false,lastNames=new Set();

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const ownProjects=()=>document.getElementById('ng8-pins');
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const exactToken=(el,token)=>[...(el?.classList||[])].some(x=>x===token||x.endsWith('/'+token));
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;};

  function sidebarRoot(){
    const own=ownProjects();
    if(own){
      const explicit=own.closest('[data-testid="conversation-sidebar"],[data-testid="sidebar"]');
      if(explicit)return explicit;
      const aside=own.closest('aside');if(aside)return aside;
      let node=own.parentElement;
      for(let depth=0;depth<8&&node&&node!==document.body;depth++,node=node.parentElement){
        if(node.querySelector?.('a,button,[role="button"],[data-sidebar-item="true"]'))return node;
      }
    }
    return document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('aside')||document.querySelector('nav');
  }

  function ownReady(){
    const box=ownProjects();
    return !!(box&&box.isConnected&&!box.hidden&&getComputedStyle(box).display!=='none');
  }

  function managedNames(){
    const box=ownProjects(),names=new Set();
    if(!box)return lastNames;
    for(const row of box.querySelectorAll('a[data-ng8-pin="1"],a[href*="/g/g-p-"][href*="/project"]')){
      const direct=row.querySelector(':scope > span')||row.querySelector('span');
      const label=norm(direct?.textContent||row.getAttribute('aria-label')||row.textContent);
      if(label&&!PROJECT_RX.test(label)&&!MORE_RX.test(label)&&!/^[0-9\s/.[\]-]+$/.test(label))names.add(label);
    }
    if(names.size)lastNames=names;
    return names.size?names:lastNames;
  }

  const beforeOwn=el=>{
    const own=ownProjects();
    if(!own||!el||el===own||el.contains(own))return false;
    return !!(el.compareDocumentPosition(own)&Node.DOCUMENT_POSITION_FOLLOWING);
  };

  function rowTarget(el,root){
    if(!el||el===root)return null;
    const row=el.closest('[data-sidebar-item="true"],li,[class*="project-unfurl-row"]');
    if(row&&row!==root&&outsideOwn(row)&&!row.contains(ownProjects()))return row;
    const interactive=el.closest('a,button,[role="button"],[role="link"]');
    return interactive&&interactive!==root&&outsideOwn(interactive)?interactive:el;
  }

  function dedicatedSections(root){
    const out=new Set();
    for(const heading of root.querySelectorAll('h1,h2,h3,[role="heading"]')){
      if(!outsideOwn(heading)||!PROJECT_RX.test(norm(heading.textContent||heading.getAttribute('aria-label'))))continue;
      let node=heading.parentElement;
      for(let depth=0;depth<9&&node&&node!==root;depth++,node=node.parentElement){
        if(exactToken(node,'sidebar-expando-section')){if(!node.contains(ownProjects()))out.add(node);break;}
      }
    }
    return out;
  }

  function structuralTargets(root,sections){
    const out=new Set(sections);
    for(const link of root.querySelectorAll('a[href]')){
      if(!outsideOwn(link)||sections.has(link.closest('.'+HIDE)))continue;
      const href=String(link.getAttribute('href')||'');
      if(/^\/projects\/?(?:[?#].*)?$/.test(href)||/\/g\/g-p-[^/]+\/project(?:[?#/]|$)/i.test(href)){
        const row=rowTarget(link,root);if(row)out.add(row);
      }
    }
    for(const row of root.querySelectorAll('[class*="project-unfurl-row"]'))if(outsideOwn(row))out.add(row);
    return out;
  }

  function nameTargets(root,names){
    const out=new Set();
    if(!names.size)return out;
    const pool=root.querySelectorAll('[data-sidebar-item="true"],a,button,[role="button"],[role="link"]');
    for(const el of pool){
      if(!outsideOwn(el)||!beforeOwn(el))continue;
      const href=String(el.getAttribute?.('href')||'');
      if(/\/c\//i.test(href))continue;
      const label=norm(el.getAttribute?.('aria-label')||el.textContent);
      if(!label||!names.has(label))continue;
      const row=rowTarget(el,root);if(row)out.add(row);
    }
    return out;
  }

  function nearbyMoreTargets(root,projectRows){
    const out=new Set();
    if(!projectRows.size)return out;
    const rows=[...projectRows];
    for(const el of root.querySelectorAll('button,a,[role="button"]')){
      if(!outsideOwn(el)||!beforeOwn(el)||!MORE_RX.test(norm(el.textContent||el.getAttribute('aria-label'))))continue;
      let host=el.parentElement,match=false;
      for(let depth=0;depth<5&&host&&host!==root;depth++,host=host.parentElement){
        if(rows.some(row=>host.contains(row))){match=true;break;}
      }
      if(!match){
        let cursor=rowTarget(el,root)||el;
        for(let i=0;i<8&&(cursor=cursor.previousElementSibling);i++){
          if(rows.some(row=>row===cursor||cursor.contains(row)||row.contains(cursor))){match=true;break;}
        }
      }
      if(match){const row=rowTarget(el,root);if(row)out.add(row);}
    }
    return out;
  }

  function release(root=document){
    for(const el of root.querySelectorAll?.('.'+HIDE)||[]){
      el.classList.remove(HIDE);el.removeAttribute('data-ng112-native-projects');el.removeAttribute('aria-hidden');
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority','FALLBACK · bloc NiakGPT absent');
  }

  function apply(){
    timer=0;if(stopped)return false;
    const root=sidebarRoot();if(!root){release();return false;}
    if(root!==rootNode)bind(root);
    if(!ownReady()){release(root);return false;}

    const sections=dedicatedSections(root);
    const structural=structuralTargets(root,sections);
    const byName=nameTargets(root,managedNames());
    const projectRows=new Set([...structural,...byName]);
    const more=nearbyMoreTargets(root,projectRows);
    const targets=new Set([...projectRows,...more]);

    for(const target of targets){
      if(!target||target===root||target.contains(ownProjects()))continue;
      target.classList.add(HIDE);target.dataset.ng112NativeProjects='1';target.setAttribute('aria-hidden','true');
    }
    for(const old of root.querySelectorAll('.'+HIDE))if(!targets.has(old)){
      old.classList.remove(HIDE);old.removeAttribute('data-ng112-native-projects');old.removeAttribute('aria-hidden');
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-authority',`OK · UI NiakGPT unique · ${targets.size} cible(s) native(s) masquée(s)`);
    return targets.size>0;
  }

  function schedule(delay=12){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}
  function bind(root=sidebarRoot()){
    if(!root)return false;
    if(root===rootNode&&observer)return true;
    observer?.disconnect();rootNode=root;
    observer=new MutationObserver(()=>schedule(8));
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','aria-label','href']});
    return true;
  }
  function relevant(records){
    return records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&(n.id==='ng8-pins'||n.matches?.('[data-testid="conversation-sidebar"],[data-testid="sidebar"],aside,nav')||n.querySelector?.('#ng8-pins,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))));
  }
  function start(){
    stopped=false;bind();schedule(0);
    rootObserver?.disconnect();rootObserver=new MutationObserver(records=>{if(relevant(records)){bind();schedule(6);}});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();rootObserver?.disconnect();observer=rootObserver=null;rootNode=null;}

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(10));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});
  window.addEventListener('popstate',()=>schedule(0));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
