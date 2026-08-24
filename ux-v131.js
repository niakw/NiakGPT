(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_UX_131__)return;
  window.__NIAKGPT_UX_131__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng119-interruption';
  const PROJECT='a[href*="/g/g-p-"]';
  const CHAT='a[href*="/c/"]';
  const PRIMARY=/^(?:\/?$|\/new(?:\/|$)|\/search(?:\/|$)|\/library(?:\/|$)|\/images?(?:\/|$)|\/apps?(?:\/|$)|\/codex(?:\/|$))/i;
  const SIDEBAR_CANDIDATE='[data-testid="conversation-sidebar"],[data-testid*="sidebar" i],nav,aside';
  let timer=0,observer=null;

  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const text=el=>String(el?.getAttribute?.('aria-label')||el?.textContent||'').replace(/\s+/g,' ').trim();
  const own=el=>!!el?.closest?.(OWN);

  function score(el){
    if(!(el instanceof HTMLElement)||el.closest('main,[role="main"]')||own(el))return-Infinity;
    const r=el.getBoundingClientRect();if(r.width<140||r.height<240)return-Infinity;
    let n=0,tid=String(el.getAttribute('data-testid')||'').toLowerCase(),aria=String(el.getAttribute('aria-label')||'').toLowerCase();
    if(tid==='conversation-sidebar')n+=160;else if(tid.includes('sidebar'))n+=90;
    if(/sidebar|conversations|historique|history|navigation/.test(aria))n+=35;
    if(r.left<=24)n+=55;else if(r.left<innerWidth*.18)n+=34;else if(r.left>innerWidth*.32)n-=120;
    if(r.width>=180&&r.width<=420)n+=45;else if(r.width>520)n-=90;
    if(r.right<Math.min(innerWidth*.42,620))n+=24;else n-=35;
    const projects=el.querySelectorAll(PROJECT).length,chats=el.querySelectorAll(CHAT).length;
    n+=Math.min(projects,8)*5+Math.min(chats,12)*2;
    if([...el.querySelectorAll('a[href]')].some(a=>PRIMARY.test(a.getAttribute('href')||'')))n+=28;
    return n;
  }
  function findSidebar(){
    const candidates=[...new Set([...document.querySelectorAll(SIDEBAR_CANDIDATE)].filter(el=>!el.closest(OWN)))];
    const ranked=candidates.map(el=>[el,score(el)]).filter(([,n])=>Number.isFinite(n)).sort((a,b)=>b[1]-a[1]);
    const winner=ranked[0];
    if(!winner||winner[1]<25)return null;
    return winner[0];
  }
  window.__NIAKGPT_FIND_SIDEBAR_V131__=findSidebar;

  function topChild(root,node){let cur=node;if(!root||!cur)return null;while(cur.parentElement&&cur.parentElement!==root)cur=cur.parentElement;return cur.parentElement===root?cur:null;}
  function nativeProjectSection(root){
    const links=[...root.querySelectorAll(PROJECT)].filter(a=>!own(a));
    const labels=[...root.querySelectorAll('h1,h2,h3,[role="heading"],span,div')].filter(el=>!own(el)&&/^(projects?|projets?)$/i.test(text(el)));
    for(const seed of [...labels,...links]){
      let node=seed;
      for(let depth=0;depth<7&&node&&node!==root&&node!==document.body;depth++,node=node.parentElement){
        const p=[...node.querySelectorAll?.(PROJECT)||[]].filter(a=>!own(a));
        const primary=[...node.querySelectorAll?.('a[href]')||[]].some(a=>PRIMARY.test(a.getAttribute('href')||''));
        if(p.length&&!primary)return node;
      }
    }
    return null;
  }
  function fallbackAnchor(root){
    const chat=[...root.querySelectorAll(CHAT)].find(a=>!own(a)&&!a.getAttribute('href')?.includes('/g/g-p-'));
    return topChild(root,chat);
  }
  function movePreservingScroll(box,move){
    const list=box?.querySelector?.(':scope>.ng8-pin-list'),before=list?.scrollTop||0;
    move();
    if(list&&before>0){list.scrollTop=before;requestAnimationFrame(()=>{if(list.isConnected&&Math.abs(list.scrollTop-before)>1)list.scrollTop=before;});}
  }
  function markVerified(box){
    box.dataset.ng131Mounted='1';box.dataset.ng131SidebarVerified='1';
    document.documentElement.dataset.ng131Sidebar='verified';
    window.__NIAKGPT_DIAGNOSTICS__?.set('ux-v131','OK · sidebar vérifiée · chrome discret');
    return true;
  }
  function repairPins(){
    const box=document.getElementById('ng8-pins'),root=findSidebar();
    if(!box||!root)return false;
    // v121 is the one and only production placement owner. v131 validates the host and
    // supplies the sidebar finder/visual guard; it must not race v121 by reparenting the
    // same scroll container on every cache reconciliation.
    if(window.__NIAKGPT_SIDEBAR_PROJECTS_121__){
      if(!root.contains(box))return false;
      return markVerified(box);
    }
    const section=nativeProjectSection(root);
    if(section?.parentElement){
      if(box.parentElement!==section.parentElement||box.nextElementSibling!==section)movePreservingScroll(box,()=>section.parentElement.insertBefore(box,section));
    }else{
      const anchor=fallbackAnchor(root);
      if(anchor?.parentElement){if(box.parentElement!==anchor.parentElement||box.nextElementSibling!==anchor)movePreservingScroll(box,()=>anchor.parentElement.insertBefore(box,anchor));}
      else if(box.parentElement!==root)movePreservingScroll(box,()=>root.appendChild(box));
    }
    return markVerified(box);
  }
  function surface(){
    const p=location.pathname;
    let value='utility';
    if(p==='/'||p===''||/^\/new(?:\/|$)/.test(p))value='home';
    else if(/\/c\/[A-Za-z0-9_-]+/.test(p))value='conversation';
    else if(/^\/g\/g-p-[^/]+\/project/.test(p))value='project';
    document.documentElement.dataset.ng131Surface=value;
  }
  function enhanceA11y(){
    const rail=document.getElementById('ng8-rail');if(rail){rail.setAttribute('aria-label','Outils NiakGPT');for(const b of rail.querySelectorAll('button')){if(!b.title)b.title=b.getAttribute('aria-label')||'Outil NiakGPT';if(b.hasAttribute('data-q'))b.setAttribute('aria-keyshortcuts','Alt+K');}}
    const status=document.getElementById('ng8-status');if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','false');}
  }
  function reconcile(){timer=0;surface();repairPins();enhanceA11y();}
  function schedule(ms=70){clearTimeout(timer);timer=setTimeout(reconcile,ms);}
  function structuralNode(node){
    if(!(node instanceof Element))return false;
    if(node.id==='ng8-pins'||node.matches?.(SIDEBAR_CANDIDATE)||node.matches?.(`${PROJECT},${CHAT}`))return true;
    return !!node.querySelector?.(`#ng8-pins,${SIDEBAR_CANDIDATE},${PROJECT},${CHAT}`);
  }
  function relevant(records){
    return records.some(r=>[...r.addedNodes,...r.removedNodes].some(structuralNode));
  }
  function bindObserver(){
    observer?.disconnect();
    observer=new MutationObserver(records=>{if(relevant(records))schedule(90);});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  function start(){
    surface();schedule(0);bindObserver();
    for(const d of[120,420,1000,2200,4500])setTimeout(()=>schedule(0),d);
  }
  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:sidebar-projects-reconcile',()=>schedule(40));
  window.addEventListener('popstate',()=>schedule(20));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(20));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});
  window.addEventListener('pageshow',()=>{bindObserver();schedule(0);});
  window.addEventListener('pagehide',()=>{observer?.disconnect();observer=null;clearTimeout(timer);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
