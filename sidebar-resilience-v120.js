(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_RESILIENCE_120__)return;
  window.__NIAKGPT_SIDEBAR_RESILIENCE_120__=true;

  const PROJECT_MARK='[data-ng112-native-projects="1"]';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const CHAT_SEL='a[href*="/c/"]';
  const OPEN_KEY='niakgpt-open-pin-folder-v096';
  let root=null,observer=null,bootObserver=null,timer=0,routeEpoch=0,placing=false;

  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const outsidePins=el=>!!el&&!el.closest('#ng8-pins');
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('aside,nav')].find(el=>el.querySelector(PROJECT_SEL)||el.querySelector(CHAT_SEL))||document.querySelector('nav');
  const depth=el=>{let n=0;for(let p=el;p;p=p.parentElement)n++;return n;};

  function outerMarkedSurface(side){
    const marks=[...side.querySelectorAll(PROJECT_MARK)].filter(outsidePins);
    if(!marks.length)return null;
    return marks.sort((a,b)=>depth(a)-depth(b))[0]||null;
  }
  function projectSurface(side){
    const marked=outerMarkedSurface(side);if(marked?.parentElement)return marked;
    const link=[...side.querySelectorAll(PROJECT_SEL)].find(outsidePins);
    if(link){
      const row=link.closest('[data-sidebar-item="true"],[class*="project-list" i],[class*="project" i],li,section');
      if(row?.parentElement)return row;
    }
    return null;
  }
  function mountPoint(side){
    const surface=projectSurface(side);if(surface?.parentElement)return{parent:surface.parentElement,before:surface,reason:'native-projects'};
    const chat=[...side.querySelectorAll(CHAT_SEL)].find(outsidePins);
    if(chat){const row=chat.closest('[data-sidebar-item="true"],li')||chat;if(row.parentElement)return{parent:row.parentElement,before:row,reason:'before-recents'};}
    const nav=side.matches('nav')?side:side.querySelector('nav')||side;
    const headings=[...nav.querySelectorAll('h2,h3')];
    const recent=headings.find(h=>/r[ée]cents?|recent/i.test((h.textContent||'').trim()));
    if(recent?.parentElement)return{parent:recent.parentElement,before:recent,reason:'before-recents-heading'};
    return{parent:nav,before:null,reason:'nav-end'};
  }
  function host(){
    const boxes=[...document.querySelectorAll('#ng8-pins')];let box=boxes[0]||null;
    if(!box){box=document.createElement('section');box.id='ng8-pins';}
    for(const extra of boxes)if(extra!==box)extra.remove();
    return box;
  }
  function place(){
    timer=0;if(placing)return false;const side=navRoot();if(!side)return false;placing=true;
    try{
      root=side;const box=host(),point=mountPoint(side);
      if(point.parent&&box.parentElement!==point.parent)point.parent.insertBefore(box,point.before);
      else if(point.parent&&point.before&&box.nextElementSibling!==point.before)point.parent.insertBefore(box,point.before);
      else if(point.parent&&!point.before&&box.parentElement===point.parent&&box!==point.parent.lastElementChild)point.parent.appendChild(box);
      box.dataset.ng120StableSlot=point.reason;box.dataset.ng90SidebarHost='1';
      document.documentElement.dataset.ng90ProjectHosts='1';
      bindRoot(side);markWelcome();return true;
    }finally{placing=false;}
  }
  function schedule(delay=40){clearTimeout(timer);timer=setTimeout(place,delay);}
  function bindRoot(side){
    if(side===root&&observer)return;observer?.disconnect();root=side;
    observer=new MutationObserver(records=>{
      if(placing)return;
      if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule(36);
    });
    observer.observe(side,{childList:true,subtree:true});
  }
  function markWelcome(){
    const home=location.pathname==='/'||location.pathname==='';
    for(const el of document.querySelectorAll('[data-ng120-welcome]'))el.removeAttribute('data-ng120-welcome');
    if(!home)return;
    const main=document.querySelector('main');if(!main)return;
    const composer=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');
    for(const h of main.querySelectorAll('h1,h2')){
      const text=(h.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      const greeting=/^(que puis-je faire pour vous|comment puis-je vous aider|comment puis-je aider|how can i help|what can i help with|what can i do for you)/i.test(text);
      if(greeting||composer&&h.getBoundingClientRect().top<composer.getBoundingClientRect().top)h.dataset.ng120Welcome='1';
    }
  }
  function revealActive(epoch=routeEpoch){
    if(epoch!==routeEpoch)return;const id=currentCid();if(!id)return;
    const box=document.getElementById('ng8-pins'),link=box?.querySelector(`.ng96-folder-list a[data-chat="${CSS.escape(id)}"]`);if(!link)return;
    link.dataset.ng110Active='1';link.setAttribute('aria-current','page');link.closest('.ng96-chat-entry')?.setAttribute('data-ng110-active','1');
    const list=link.closest('.ng96-folder-list');if(list){const lr=list.getBoundingClientRect(),rr=link.getBoundingClientRect();if(rr.top<lr.top||rr.bottom>lr.bottom)link.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  function route(){
    const epoch=++routeEpoch;schedule(20);markWelcome();
    for(const delay of [40,140,360,800])setTimeout(()=>revealActive(epoch),delay);
  }
  function bootstrap(){
    if(place())return;bootObserver?.disconnect();bootObserver=new MutationObserver(()=>{if(place()){bootObserver?.disconnect();bootObserver=null;}});bootObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>bootObserver?.disconnect(),15000);
  }

  document.addEventListener('click',event=>{const t=event.target instanceof Element?event.target:null;if(t?.closest('[data-testid*="sidebar" i],aside,nav'))schedule(140);},true);
  document.addEventListener('input',event=>{const t=event.target instanceof Element?event.target:null;if(t?.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]'))setTimeout(()=>{const box=document.getElementById('ng8-pins');if(box&&!box.dataset.ng120StableSlot)schedule(0);},0);},true);
  document.addEventListener('niakgpt:pins-rendered',()=>{schedule(0);setTimeout(revealActive,25);});
  document.addEventListener('niakgpt:folder-rendered',()=>setTimeout(revealActive,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)route();});
  window.addEventListener('popstate',route);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',()=>route());
  window.addEventListener('pagehide',()=>{observer?.disconnect();bootObserver?.disconnect();clearTimeout(timer);},{once:true});
  bootstrap();route();
})();