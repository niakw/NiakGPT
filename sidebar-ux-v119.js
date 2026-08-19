(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_UX_119__)return;
  window.__NIAKGPT_SIDEBAR_UX_119__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const CHAT='a[href*="/c/"]';
  const PROJECT='a[href*="/g/g-p-"]';
  let observer=null,observedRoot=null,timer=0,kickTimer=0,kickAt=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof Element)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';};
  const topLevel=(root,node)=>{if(!root||!node)return null;let n=node;while(n.parentElement&&n.parentElement!==root)n=n.parentElement;return n.parentElement===root?n:null;};
  const isOwn=el=>!!el?.closest?.(OWN);

  function scoreRoot(root){
    if(!(root instanceof HTMLElement)||root.closest('main,[role="main"]'))return-1;
    let score=0;
    if(root.matches('[data-testid="conversation-sidebar"]'))score+=30;
    if(root.matches('[data-testid*="sidebar" i]'))score+=20;
    if(root.matches('aside'))score+=10;
    if(root.querySelector('#ng8-pins'))score+=25;
    if(root.querySelector(CHAT))score+=12;
    if(root.querySelector(PROJECT))score+=8;
    const r=root.getBoundingClientRect();if(r.width>150&&r.width<520&&r.left<innerWidth*.35)score+=8;
    return score;
  }
  function navRoot(){
    const candidates=[...document.querySelectorAll('[data-testid="conversation-sidebar"],[data-testid*="sidebar" i],aside,nav')].filter(x=>!x.closest('main,[role="main"]'));
    return candidates.sort((a,b)=>scoreRoot(b)-scoreRoot(a))[0]||null;
  }
  function recentsSection(root){
    if(!root)return null;
    const labels=[...root.querySelectorAll('h2,h3,[role="heading"],div,span')].filter(el=>{const t=clean(el.textContent);return t.length<=24&&/^(récents|recents|recent chats?|conversations récentes)$/i.test(t);});
    for(const label of labels){let node=label;for(let depth=0;depth<7&&node?.parentElement&&node.parentElement!==root;depth++,node=node.parentElement){const parent=node.parentElement;if([...parent.querySelectorAll(CHAT)].some(a=>!a.closest('#ng8-pins')))return parent;}}
    return null;
  }
  function nativeProjectsAnchor(root){
    if(!root)return null;
    const marked=[...root.querySelectorAll('[data-ng112-native-projects="1"]')].find(el=>!isOwn(el));
    if(marked)return topLevel(root,marked);
    const projectsHome=[...root.querySelectorAll('a[href]')].find(a=>!isOwn(a)&&/^\/projects\/?(?:[?#].*)?$/.test(a.getAttribute('href')||''));
    if(projectsHome)return topLevel(root,projectsHome);
    const nativeProject=[...root.querySelectorAll(PROJECT)].find(a=>!isOwn(a));
    return topLevel(root,nativeProject);
  }
  function firstRecentsAnchor(root){
    const recent=topLevel(root,recentsSection(root));if(recent)return recent;
    const firstChat=[...root.querySelectorAll(CHAT)].find(a=>!isOwn(a)&&!a.closest('[data-ng112-native-projects="1"]'));
    return topLevel(root,firstChat);
  }
  function primaryTail(root){
    if(!root)return null;
    const known=/^(?:\/?$|\/new(?:\/|$)|\/search(?:\/|$)|\/library(?:\/|$)|\/images?(?:\/|$)|\/apps?(?:\/|$)|\/codex(?:\/|$)|\/projects(?:\/|$))/i;
    const direct=[...root.children].filter(el=>el.id!=='ng8-pins'&&!el.matches('[data-ng112-native-projects="1"]'));
    let best=null,bestIndex=-1;
    direct.forEach((child,index)=>{
      const links=[...child.querySelectorAll('a[href]')].filter(a=>!isOwn(a));
      const buttons=[...child.querySelectorAll('button,[role="button"]')].filter(b=>!isOwn(b));
      const primary=links.some(a=>known.test(a.getAttribute('href')||''))||buttons.some(b=>/(nouveau|new chat|recherche|search|bibliothèque|library|images?|applications?|apps?|codex)/i.test(`${b.getAttribute('aria-label')||''} ${b.textContent||''}`));
      if(primary&&index>bestIndex){best=child;bestIndex=index;}
    });
    return best;
  }
  function placePins(){
    timer=0;const root=navRoot(),box=document.getElementById('ng8-pins');
    if(!root){document.documentElement.removeAttribute('data-ng119-pins-ready');return false;}
    if(!box){document.documentElement.removeAttribute('data-ng119-pins-ready');kickRender();bind(root);return false;}
    const anchor=nativeProjectsAnchor(root)||firstRecentsAnchor(root);
    if(anchor){
      if(box.parentElement!==root||box.nextElementSibling!==anchor)root.insertBefore(box,anchor);
      box.dataset.ng119Placement='projects-slot';
    }else{
      const tail=primaryTail(root);
      if(tail){if(box.parentElement!==root||tail.nextElementSibling!==box)tail.insertAdjacentElement('afterend',box);box.dataset.ng119Placement='after-primary';}
      else if(box.parentElement!==root){root.appendChild(box);box.dataset.ng119Placement='sidebar-tail';}
    }
    box.hidden=false;box.removeAttribute('aria-hidden');document.documentElement.dataset.ng119PinsReady='1';
    window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-ux-119',`OK · Projects ${box.dataset.ng119Placement||'stable'} · nom = dossier`);
    bind(root);hideWelcome();return true;
  }
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(placePins,delay);}
  function kickRender(){
    const now=Date.now();if(now-kickAt<500)return;kickAt=now;clearTimeout(kickTimer);
    kickTimer=setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:settings-changed',{detail:{source:'sidebar-ux-v119'}})),80);
  }
  function bind(root=navRoot()){
    if(!root||root===observedRoot&&observer)return;
    observer?.disconnect();observedRoot=root;observer=new MutationObserver(records=>{
      let relevant=false;
      for(const r of records){for(const n of [...r.addedNodes,...r.removedNodes]){if(n instanceof Element&&(n.id==='ng8-pins'||n.matches?.(`${CHAT},${PROJECT},[data-ng112-native-projects]`)||n.querySelector?.(`#ng8-pins,${CHAT},${PROJECT},[data-ng112-native-projects]`))){relevant=true;break;}}if(relevant)break;}
      if(relevant)schedule(0);
    });
    observer.observe(root,{childList:true,subtree:true});
    if(root.parentElement)observer.observe(root.parentElement,{childList:true,subtree:false});
  }
  function hideWelcome(){
    const main=document.querySelector('main,[role="main"]');if(!main)return;
    if(main.querySelector('[data-message-author-role]')){main.querySelectorAll('.ng119-native-home-greeting').forEach(el=>el.classList.remove('ng119-native-home-greeting'));return;}
    const rx=/^(?:bonjour|bonsoir|salut|hello|hi)(?:\s+[\p{L}\p{N}._'-]{1,40})?[!,.? ]*$|^(?:par quoi commençons-nous|comment puis-je vous aider|que puis-je faire pour vous|qu[’']est-ce qu[’']on fait|how can i help|what can i help with|what(?:'|’)s on your mind)[?!. ]*$/iu;
    for(const el of main.querySelectorAll('h1,h2,[role="heading"],[data-testid*="welcome" i]')){
      const text=clean(el.textContent);if(text&&text.length<=140&&rx.test(text))el.classList.add('ng119-native-home-greeting');
    }
  }

  // This listener is intentionally injected before pin-folders-v096. It cancels the
  // anchor's native navigation but lets the existing folder handler receive the same
  // click and toggle the chat drawer.
  document.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target instanceof Element?event.target:null,anchor=target?.closest('#ng8-pins a[data-ng8-pin="1"]');
    if(anchor)event.preventDefault();
  },true);
  document.addEventListener('auxclick',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng8-pins a[data-ng8-pin="1"]'))event.preventDefault();},true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;const target=event.target instanceof Element?event.target:null,anchor=target?.closest('#ng8-pins a[data-ng8-pin="1"]');if(!anchor)return;
    event.preventDefault();anchor.click();
  },true);
  document.addEventListener('niakgpt:pins-rendered',()=>placePins());
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(0);}});
  window.addEventListener('popstate',()=>{bind();schedule(0);});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bind();schedule(0);});
  window.addEventListener('pageshow',()=>{bind();schedule(0);});
  const bodyObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&n.closest?.('main,[role="main"]'))))hideWelcome();});
  const start=()=>{bind();schedule(0);hideWelcome();bodyObserver.observe(document.body||document.documentElement,{childList:true,subtree:true});setTimeout(()=>{if(!document.getElementById('ng8-pins'))kickRender();schedule(0);},260);setTimeout(()=>schedule(0),900);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();