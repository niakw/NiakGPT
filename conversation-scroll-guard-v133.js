(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__)return;
  window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__=true;

  const CHAT_RX=/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/;
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  // No upward gesture exists at boot. Using 0 here accidentally creates a synthetic
  // 180 ms "user scrolled up" grace period from navigation time and can miss the first
  // streamed growth entirely. Only a real upward input should arm that grace period.
  let root=null,observer=null,resizeObserver=null,raf=0,sticky=false,userUpAt=-Infinity,lastBottom=Infinity,lastPath=location.pathname,touchY=null;

  const diag=text=>window.__NIAKGPT_DIAGNOSTICS__?.set('scroll-chat',text);
  const isChat=()=>CHAT_RX.test(String(location.pathname||''));
  const active=()=>isChat()&&(document.documentElement.dataset.ng8Running==='1'||ACTIVE.has(document.documentElement.dataset.ng86Activity||'')||!!document.querySelector('[data-testid="stop-button"],[data-testid*="stop-generating" i],button[aria-label*="Stop" i],button[aria-label*="Arrêter" i]'));
  const editable=el=>el instanceof Element&&!!el.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  const touchPoint=event=>{const p=event.touches?.[0]||event.changedTouches?.[0];const y=Number(p?.clientY);return Number.isFinite(y)?y:null;};
  function scrollableNode(node){
    if(!(node instanceof HTMLElement)&&node!==document.scrollingElement)return false;
    const range=Math.max(0,node.scrollHeight-node.clientHeight);if(range<2)return false;
    const style=getComputedStyle(node),overflow=String(style.overflowY||style.overflow||'').toLowerCase();
    if(node===document.scrollingElement)return !/hidden|clip/.test(overflow);
    return /^(auto|scroll|overlay)$/.test(overflow);
  }
  function targetsConversationScroller(target){
    if(!(target instanceof Node)||!root)return false;
    if(root===document.scrollingElement){
      const main=document.querySelector('main,[role="main"]');
      return !!main&&(target===main||main.contains(target));
    }
    return target===root||root.contains(target);
  }
  function scrollRoot(){
    const main=document.querySelector('main,[role="main"]');
    const candidates=[document.scrollingElement,...(main?[main,...main.querySelectorAll('[class*="overflow-y-auto"],[class*="overflow-auto"],[data-scroll-root],section,div')]:[])].filter(Boolean);
    let best=null,bestScore=-Infinity;
    for(const el of candidates){
      if(!(el instanceof HTMLElement)&&el!==document.scrollingElement)continue;
      const node=el,range=Math.max(0,node.scrollHeight-node.clientHeight);if(range<120||!scrollableNode(node))continue;
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
  function touchStart(event){
    if(!isChat())return;bind();
    if(!targetsConversationScroller(event.target))return;
    touchY=touchPoint(event);
  }
  function touchEnd(){touchY=null;}
  function userIntent(event){
    if(!isChat())return;bind();
    if(event.type==='keydown'){
      if(editable(event.target))return;
      const target=event.target;
      if(root!==document.scrollingElement&&target instanceof Node&&target!==document.body&&target!==document.documentElement&&!targetsConversationScroller(target))return;
    }else if(!targetsConversationScroller(event.target))return;
    let dir=0;
    if(event.type==='wheel')dir=Math.sign(Number(event.deltaY)||0);
    else if(event.type==='touchmove'){
      const next=touchPoint(event);
      if(next!=null&&touchY!=null)dir=Math.sign(touchY-next);
      touchY=next;
    }else if(event.type==='keydown'){
      if(/^(ArrowUp|PageUp|Home)$/.test(event.key)||(event.key===' '&&event.shiftKey))dir=-1;
      else if(/^(ArrowDown|PageDown|End)$/.test(event.key)||event.key===' ')dir=1;
    }
    if(dir<0){userUpAt=performance.now();setSticky(false,'remontée volontaire');return;}
    requestAnimationFrame(()=>{
      if(dir>0&&root&&active()&&distanceBottom(root)<=80){
        // An explicit downward gesture that actually reaches the bottom is stronger evidence
        // than the short anti-snap grace period left by the previous upward gesture.
        userUpAt=-Infinity;lastBottom=distanceBottom(root);setSticky(true,'retour utilisateur vers le bas');pinBottom('user-bottom');
        return;
      }
      armFromPosition(dir>0?'retour utilisateur vers le bas':'position utilisateur');
    });
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
    if(lastPath===location.pathname)return;lastPath=location.pathname;sticky=false;userUpAt=-Infinity;lastBottom=Infinity;bind();activity();
  }

  document.addEventListener('wheel',userIntent,{capture:true,passive:true});
  document.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',userIntent,{capture:true,passive:true});
  document.addEventListener('touchend',touchEnd,{capture:true,passive:true});
  document.addEventListener('touchcancel',touchEnd,{capture:true,passive:true});
  document.addEventListener('keydown',userIntent,true);
  document.addEventListener('scroll',onScroll,true);
  document.addEventListener('niakgpt:activity-changed',activity);
  window.addEventListener('popstate',route);
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',()=>{bind();activity();});
  window.addEventListener('pagehide',()=>{observer?.disconnect();resizeObserver?.disconnect();cancelRaf();observer=null;resizeObserver=null;root=null;});
  bind();activity();
})();
