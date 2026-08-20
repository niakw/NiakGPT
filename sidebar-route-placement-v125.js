(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_ROUTE_PLACEMENT_125__)return;
  window.__NIAKGPT_SIDEBAR_ROUTE_PLACEMENT_125__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const TOP_PATH=/^(?:\/?$|\/new(?:\/|$)|\/search(?:\/|$)|\/library(?:\/|$)|\/images?(?:\/|$)|\/apps?(?:\/|$)|\/codex(?:\/|$)|\/projects?(?:\/|$)|\/tasks?(?:\/|$)|\/plugins?(?:\/|$)|\/gpts?(?:\/|$)|\/explore(?:\/|$)|\/sora(?:\/|$))/i;
  let observer=null,timer=0,epoch=0,mutating=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const own=el=>!!el?.closest?.(OWN);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};

  function sidebar(){
    const box=document.getElementById('ng8-pins');
    const candidates=[...document.querySelectorAll('[data-testid="conversation-sidebar"],[data-testid*="sidebar" i],aside,nav')].filter(el=>!el.closest('main,[role="main"]'));
    const score=el=>{let n=0;if(el.matches('[data-testid="conversation-sidebar"]'))n+=60;if(box&&el.contains(box))n+=45;if(el.querySelector('a[href="/projects"],a[href*="/g/g-p-"]'))n+=25;const r=el.getBoundingClientRect();if(r.left<innerWidth*.35&&r.width>150&&r.width<540)n+=10;return n;};
    return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function contentHost(root,box){
    if(!root)return null;
    const current=box?.parentElement;
    if(current&&current!==root&&root.contains(current)&&(current.matches('nav,[role="navigation"]')||current.querySelector('a[href="/projects"],a[href*="/c/"]')))return current;
    const candidates=[...root.querySelectorAll('nav,[role="navigation"]')].filter(el=>!own(el));
    const score=el=>(el.querySelector('a[href="/projects"]')?30:0)+(el.querySelector('a[href*="/c/"]')?20:0)+(box&&el.contains(box)?15:0);
    const best=candidates.sort((a,b)=>score(b)-score(a))[0];return best&&score(best)>0?best:root;
  }
  function topChild(root,node){if(!root||!node)return null;let cur=node;while(cur.parentElement&&cur.parentElement!==root)cur=cur.parentElement;return cur.parentElement===root?cur:null;}
  function sectionFromHeading(root,rx){
    const headings=[...root.querySelectorAll('h1,h2,h3,[role="heading"],div,span')].filter(el=>!own(el)&&rx.test(clean(el.textContent))&&clean(el.textContent).length<28);
    for(const h of headings){let n=h;for(let d=0;d<6&&n&&n!==root;d++,n=n.parentElement){const parent=n.parentElement;if(!parent||parent===root)return topChild(root,n)||n;const text=clean(parent.textContent);const chats=parent.querySelectorAll('a[href*="/c/"]').length,projects=parent.querySelectorAll('a[href*="/g/g-p-"]').length;if(chats||projects||text.length<900)return topChild(root,parent)||parent;}}
    return null;
  }
  function nativeProjectSection(root){
    const marked=[...root.querySelectorAll('[data-ng112-native-projects="1"]')].find(el=>!el.contains(document.getElementById('ng8-pins')));
    if(marked)return topChild(root,marked)||marked;
    const link=[...root.querySelectorAll('a[href*="/g/g-p-"]')].find(a=>!own(a));if(link){let n=link;for(let d=0;d<7&&n&&n!==root;d++,n=n.parentElement){const parent=n.parentElement;if(!parent)break;const links=[...parent.querySelectorAll('a[href*="/g/g-p-"]')].filter(a=>!own(a));const genericChats=[...parent.querySelectorAll('a[href*="/c/"]')].filter(a=>!own(a)&&!String(a.getAttribute('href')||'').includes('/g/g-p-'));if(links.length&&!genericChats.length)return topChild(root,parent)||parent;}}
    return sectionFromHeading(root,/^(?:projets?|projects?)$/i);
  }
  function recentsSection(root){return sectionFromHeading(root,/^(?:r[eé]cents?|recents?|recent)$/i);}
  function primaryTail(root){
    const links=[...root.querySelectorAll('a[href]')].filter(a=>!own(a)&&TOP_PATH.test(a.getAttribute('href')||''));if(!links.length)return null;
    const last=links.sort((a,b)=>a.getBoundingClientRect().bottom-b.getBoundingClientRect().bottom).at(-1);return topChild(root,last)||last;
  }
  function brandBottom(root){
    const candidates=[...root.querySelectorAll('[data-testid*="logo" i],a[aria-label*="ChatGPT" i],button[aria-label*="ChatGPT" i],.brand')].filter(el=>!own(el)&&visible(el));return candidates.reduce((m,el)=>Math.max(m,el.getBoundingClientRect().bottom),0);
  }
  function place(){
    timer=0;if(mutating)return false;const box=document.getElementById('ng8-pins'),root=sidebar();if(!box||!root)return false;const host=contentHost(root,box);if(!host)return false;
    const project=nativeProjectSection(host),recent=recentsSection(host),tail=primaryTail(host);let anchor=null,mode='';
    if(project&&project!==box&&!box.contains(project)){anchor=project;mode='native-projects';}
    else if(recent&&recent!==box&&!box.contains(recent)){anchor=recent;mode='before-recents';}
    else if(tail&&tail!==box&&!box.contains(tail)){mode='after-primary';}
    mutating=true;
    try{
      if(anchor?.parentElement){if(box.parentElement!==anchor.parentElement||box.nextElementSibling!==anchor)anchor.parentElement.insertBefore(box,anchor);}
      else if(tail?.parentElement){if(box.parentElement!==tail.parentElement||tail.nextElementSibling!==box)tail.insertAdjacentElement('afterend',box);}
      else if(box.parentElement!==host)host.appendChild(box);
      const br=brandBottom(root),r=box.getBoundingClientRect();
      if(br&&r.top<br-3&&tail?.parentElement){tail.insertAdjacentElement('afterend',box);mode='after-primary-brand-guard';}
      box.hidden=false;box.removeAttribute('aria-hidden');box.dataset.ng125RoutePlacement=mode||'sidebar-tail';document.documentElement.dataset.ng125RoutePlacement='ready';
      return true;
    }finally{mutating=false;}
  }
  function reconcile(source='event'){
    document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile',{detail:{source:`route-placement-v125:${source}`}}));
    requestAnimationFrame(()=>place());
  }
  function arm(source='route'){
    const token=++epoch;clearTimeout(timer);
    for(const delay of [0,70,190,430,900,1800,3200])setTimeout(()=>{if(token===epoch)reconcile(source);},delay);
  }

  observer=new MutationObserver(records=>{
    if(mutating)return;
    const relevant=records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&(n.id==='ng8-pins'||n.matches?.('[data-testid*="sidebar" i],aside,nav,a[href="/projects"],a[href*="/g/g-p-"]')||n.querySelector?.('#ng8-pins,a[href="/projects"],a[href*="/g/g-p-"]'))));
    if(relevant){clearTimeout(timer);timer=setTimeout(()=>reconcile('remount'),55);}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('niakgpt:pins-rendered',()=>reconcile('pins-rendered'));
  window.addEventListener('popstate',()=>arm('popstate'));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>arm('navigation'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm('visible');});window.addEventListener('pageshow',()=>arm('pageshow'));
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(timer);},{once:true});
  arm('init');
})();