(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__)return;
  window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__=true;

  const CHAT_RX=/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/;
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  let root=null,observer=null,resizeObserver=null,raf=0,sticky=false,userUpAt=0,lastBottom=Infinity,lastPath=location.pathname;

  const diag=text=>window.__NIAKGPT_DIAGNOSTICS__?.set('scroll-chat',text);
  const isChat=()=>CHAT_RX.test(String(location.pathname||''));
  const active=()=>isChat()&&(document.documentElement.dataset.ng8Running==='1'||ACTIVE.has(document.documentElement.dataset.ng86Activity||'')||!!document.querySelector('[data-testid="stop-button"],[data-testid*="stop-generating" i],button[aria-label*="Stop" i],button[aria-label*="Arrêter" i]'));
  const visible=el=>el instanceof HTMLElement&&el.isConnected&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  function scrollRoot(){
    const main=document.querySelector('main,[role="main"]');
    const candidates=[document.scrollingElement,...(main?[main,...main.querySelectorAll('[class*="overflow-y-auto"],[class*="overflow-auto"],[data-scroll-root],section,div')]:[])].filter(Boolean);
    let best=null,bestScore=-Infinity;
    for(const el of candidates){
      if(!(el instanceof HTMLElement)&&el!==document.scrollingElement)continue;
      const node=el,range=Math.max(0,node.scrollHeight-node.clientHeight);if(range<120)continue;
      let score=Math.min(400,range/5);
      if(node===document.scrollingElement)score+=30;
      if(main&&(node===main||main.contains(node)))score+=80;
      if(node.querySelector?.('[data-message-author-role="assistant"],[data-testid^="conversation-turn-"]'))score+=220;
      const r=node.getBoundingClientRect?.();if(r&&r.height>innerHeight*.45)score+=40;
      if(score>bestScore){best=node;bestScore=score;}
    }
    return best||document.scrollingElement;
  }
  const distanceBottom=el=>Math.max(0,el.scrollHeight-el.clientHeight-el.scrollTop);
  function cancelRaf(){if(raf){cancelAnimationFrame(raf);raf=0;}}
  function setSticky(value,reason){
    sticky=!!value;
    document.documentElement.dataset.ng133ScrollSticky=sticky?'1':'0';
    diag(sticky?`OK · bas verrouillé pendant génération · ${reason}`:`OK · scroll utilisateur libre · ${reason}`);
  }
  function pinBottom(reason='growth'){
    if(!sticky||!active())return;
    const el=root&&root.isConnected?root:scrollRoot();if(!el)return;root=el;
    const restore=phase=>{
      if(!sticky||!active()||!el.isConnected)return;
      const max=Math.max(0,el.scrollHeight-el.clientHeight);
      if(Math.abs(el.scrollTop-max)>2)el.scrollTop=max;
      lastBottom=distanceBottom(el);document.documentElement.dataset.ng133ScrollRestore=`${reason}:${phase}`;
    };
    // MutationObserver already runs after the streamed DOM mutation. Reading scrollHeight here
    // forces the current layout and lets us restore the bottom before paint; the rAF pass then
    // catches async font/layout expansion without relying on arbitrary timers.
    restore('sync');
    queueMicrotask(()=>restore('microtask'));
    cancelRaf();raf=requestAnimationFrame(()=>{raf=0;restore('raf');});
  }
  function bind(){
    const next=scrollRoot();if(!next||next===root&&observer)return;
    observer?.disconnect();resizeObserver?.disconnect();root=next;
    observer=new MutationObserver(()=>pinBottom('mutation'));
    const host=document.querySelector('main,[role="main"]')||document.body;
    observer.observe(host,{childList:true,subtree:true,characterData:true});
    if('ResizeObserver'in window){
      resizeObserver=new ResizeObserver(()=>pinBottom('resize'));
      resizeObserver.observe(root);const tail=[...document.querySelectorAll('[data-message-author-role="assistant"],[data-testid^="conversation-turn-"]')].at(-1);if(tail)resizeObserver.observe(tail);
    }
  }
  function armFromPosition(reason){
    if(!active()||!root)return;
    const d=distanceBottom(root);lastBottom=d;
    if(d<=140&&performance.now()-userUpAt>180)setSticky(true,reason);
  }
  function userIntent(event){
    if(!isChat())return;bind();
    let dir=0;
    if(event.type==='wheel')dir=Math.sign(Number(event.deltaY)||0);
    else if(event.type==='touchmove')dir=0;
    else if(event.type==='keydown')dir=/^(ArrowUp|PageUp|Home)$/.test(event.key)?-1:/^(ArrowDown|PageDown|End| )$/.test(event.key)?1:0;
    if(dir<0){userUpAt=performance.now();setSticky(false,'remontée volontaire');return;}
    requestAnimationFrame(()=>armFromPosition(dir>0?'retour utilisateur vers le bas':'position utilisateur'));
  }
  function onScroll(event){
    if(!root||event.target!==root&&!(root===document.scrollingElement&&(event.target===document||event.target===document.documentElement)))return;
    const d=distanceBottom(root),delta=d-lastBottom;lastBottom=d;
    if(active()&&d<=80&&performance.now()-userUpAt>180&&!sticky)setSticky(true,'bas atteint');
    if(sticky&&delta>120&&performance.now()-userUpAt<700)setSticky(false,'remontée volontaire');
  }
  function activity(){
    bind();
    if(!active()){setSticky(false,'génération terminée');return;}
    armFromPosition('activité');
    pinBottom('activity');
  }
  function route(){
    if(lastPath===location.pathname)return;lastPath=location.pathname;sticky=false;userUpAt=0;lastBottom=Infinity;bind();activity();
  }

  for(const type of ['wheel','touchmove'])document.addEventListener(type,userIntent,{capture:true,passive:true});
  document.addEventListener('keydown',userIntent,true);
  document.addEventListener('scroll',onScroll,true);
  document.addEventListener('niakgpt:activity-changed',activity);
  window.addEventListener('popstate',route);
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',()=>{bind();activity();});
  window.addEventListener('pagehide',()=>{observer?.disconnect();resizeObserver?.disconnect();cancelRaf();observer=null;resizeObserver=null;root=null;});
  bind();activity();
})();
