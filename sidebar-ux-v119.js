(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_UX_119__)return;
  window.__NIAKGPT_SIDEBAR_UX_119__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const CHAT='a[href*="/c/"]';
  const PROJECT_PAGE='a[href^="/g/g-p-"]:not([href*="/c/"])';
  const PROJECT_ANY='a[href*="/g/g-p-"]';
  let observer=null,observedRoot=null,timer=0,kickTimer=0,kickAt=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const topLevel=(root,node)=>{if(!root||!node)return null;let n=node;while(n.parentElement&&n.parentElement!==root)n=n.parentElement;return n.parentElement===root?n:null;};
  const isOwn=el=>!!el?.closest?.(OWN);

  // Keep the same root selection as app-v090. 0.9.69 had two different sidebar-root
  // heuristics; when ChatGPT exposed nested sidebar shells they could literally move
  // #ng8-pins back and forth between two parents.
  function navRoot(){
    return document.querySelector('[data-testid="conversation-sidebar"]')
      ||document.querySelector('[data-testid="sidebar"]')
      ||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(CHAT)||x.querySelector(PROJECT_ANY))
      ||document.querySelector('nav')||null;
  }
  function recentsSection(root){
    if(!root)return null;
    const labels=[...root.querySelectorAll('h2,h3,[role="heading"],div,span')].filter(el=>{const t=clean(el.textContent);return t.length<=24&&/^(récents|recents|recent chats?|conversations récentes)$/i.test(t);});
    for(const label of labels){let node=label;for(let depth=0;depth<7&&node?.parentElement&&node.parentElement!==root;depth++,node=node.parentElement){const parent=node.parentElement;if([...parent.querySelectorAll(CHAT)].some(a=>!a.closest('#ng8-pins')))return parent;}}
    return null;
  }
  function fallbackPlace(root,box){
    // This path exists only before app-v090 has mounted. Once app-v090 is live it is the
    // single placement authority; sidebar-ux must never fight its DOM move.
    const firstProject=[...root.querySelectorAll(PROJECT_PAGE)].find(a=>!isOwn(a));
    const recent=recentsSection(root);
    const firstChat=[...root.querySelectorAll(CHAT)].find(a=>!isOwn(a)&&!a.matches('a[href^="/g/g-p-"][href*="/c/"]'));
    const anchor=topLevel(root,firstProject)||topLevel(root,recent)||topLevel(root,firstChat)||null;
    if(box.parentElement!==root||box.nextElementSibling!==anchor)root.insertBefore(box,anchor||root.firstElementChild||null);
  }
  function placePins(){
    timer=0;const root=navRoot(),box=document.getElementById('ng8-pins');
    if(!root){document.documentElement.removeAttribute('data-ng119-pins-ready');return false;}
    if(!box){document.documentElement.removeAttribute('data-ng119-pins-ready');kickRender();bind(root);return false;}

    // app-v090 creates/renders the Project block and already owns its native Projects slot.
    // The old v119 code also moved the same node, causing the live "bloc pin qui saute".
    // From now on, once app-v090 exists, v119 only verifies/observes the placement.
    if(window.__NIAKGPT_APP_090__){
      if(box.parentElement!==root){
        // A React remount can temporarily detach the node. Reattach once, then let app-v090
        // choose its exact sibling on its next synchronous render.
        root.appendChild(box);
        document.dispatchEvent(new CustomEvent('niakgpt:settings-changed',{detail:{source:'sidebar-ux-v119-remount'}}));
      }
      box.dataset.ng119Placement='app-authority';
    }else{
      fallbackPlace(root,box);box.dataset.ng119Placement='bootstrap-fallback';
    }

    box.hidden=false;box.removeAttribute('aria-hidden');document.documentElement.dataset.ng119PinsReady='1';
    window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-ux-119',`OK · Projects ${box.dataset.ng119Placement||'stable'} · 1 autorité de placement`);
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
      for(const r of records){for(const n of [...r.addedNodes,...r.removedNodes]){if(n instanceof Element&&(n.id==='ng8-pins'||n.matches?.(`${CHAT},${PROJECT_ANY},[data-ng112-native-projects]`)||n.querySelector?.(`#ng8-pins,${CHAT},${PROJECT_ANY},[data-ng112-native-projects]`))){relevant=true;break;}}if(relevant)break;}
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

  // The Project name is a folder toggle, never a navigation target. This capture listener
  // only cancels native navigation; pin-folders-v096 receives the same click afterwards.
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
