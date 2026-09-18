(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__)return;
  window.__NIAKGPT_CONVERSATION_SCROLL_GUARD_133__=true;

  const CHAT_RX=/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/;
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  const SEND_LATCH_MS=6500;
  let root=null,main=null,observer=null,shellObserver=null,resizeObserver=null,raf=0,sticky=false,userUpAt=-Infinity,lastBottom=Infinity,lastPath=location.pathname,touchY=null;
  let sendIntentAt=-Infinity,sendLatched=false,wasActive=false,latchTimer=0,observedTail=null,programmaticUntil=0;

  const diag=text=>window.__NIAKGPT_DIAGNOSTICS__?.set('scroll-chat',text);
  const isChat=()=>CHAT_RX.test(String(location.pathname||''));
  const nativeActive=()=>isChat()&&(document.documentElement.dataset.ng8Running==='1'||ACTIVE.has(document.documentElement.dataset.ng86Activity||'')||!!document.querySelector('[data-testid="stop-button"],[data-testid*="stop-generating" i],button[aria-label*="Stop" i],button[aria-label*="Arrêter" i]'));
  const recentSend=()=>sendLatched&&performance.now()-sendIntentAt<SEND_LATCH_MS;
  const followingActive=()=>nativeActive()||recentSend();
  const editable=el=>el instanceof Element&&!!el.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  const touchPoint=event=>{const p=event.touches?.[0]||event.changedTouches?.[0];const y=Number(p?.clientY);return Number.isFinite(y)?y:null;};

  function scrollableNode(node){
    if(!(node instanceof HTMLElement)&&node!==document.scrollingElement)return false;
    const range=Math.max(0,node.scrollHeight-node.clientHeight);if(range<2)return false;
    const style=getComputedStyle(node),overflow=String(style.overflowY||style.overflow||'').toLowerCase();
    if(node===document.scrollingElement)return !/hidden|clip/.test(overflow);
    return /^(auto|scroll|overlay)$/.test(overflow);
  }
  function conversationMain(){return document.querySelector('main,[role="main"]')||null;}
  function conversationTail(){
    const host=conversationMain()||document.body;if(!host)return null;
    const turns=[...host.querySelectorAll('[data-testid^="conversation-turn-"],[data-message-author-role]')].filter(el=>el instanceof HTMLElement&&el.isConnected);
    return turns.at(-1)||host;
  }
  function ancestorScroller(tail){
    if(!(tail instanceof Node))return null;
    let el=tail instanceof Element?tail:tail.parentElement;
    while(el&&el!==document.body&&el!==document.documentElement){
      if(scrollableNode(el)){
        const rect=el.getBoundingClientRect?.();
        if(!rect||rect.height>=Math.min(180,innerHeight*.25))return el;
      }
      el=el.parentElement;
    }
    const doc=document.scrollingElement;
    return doc&&scrollableNode(doc)?doc:null;
  }
  function scrollRoot(){
    const host=conversationMain(),tail=conversationTail(),ancestor=ancestorScroller(tail);
    if(ancestor)return ancestor;
    const candidates=[],push=el=>{if(el&&!candidates.includes(el))candidates.push(el);};
    push(document.scrollingElement);push(host);
    let parent=host?.parentElement;
    while(parent&&parent!==document.body){push(parent);parent=parent.parentElement;}
    if(host)for(const el of host.querySelectorAll('[class*="overflow-y-auto"],[class*="overflow-auto"],[data-scroll-root],section,div'))push(el);
    let best=null,bestScore=-Infinity;
    for(const node of candidates){
      if(!(node instanceof HTMLElement)&&node!==document.scrollingElement)continue;
      const range=Math.max(0,node.scrollHeight-node.clientHeight);if(range<120||!scrollableNode(node))continue;
      let score=Math.min(400,range/5);
      if(node===document.scrollingElement)score+=30;
      if(host&&(node===host||node.contains?.(host)||host.contains(node)))score+=80;
      if(tail&&node.contains?.(tail))score+=320;
      const r=node.getBoundingClientRect?.();if(r&&r.height>innerHeight*.45)score+=40;
      if(score>bestScore){best=node;bestScore=score;}
    }
    return best||document.scrollingElement;
  }
  const distanceBottom=el=>Math.max(0,el.scrollHeight-el.clientHeight-el.scrollTop);
  const connected=el=>el===document.scrollingElement||!!el?.isConnected;
  function cancelRaf(){if(raf){cancelAnimationFrame(raf);raf=0;}}
  function clearLatch(){clearTimeout(latchTimer);latchTimer=0;sendLatched=false;sendIntentAt=-Infinity;}
  function setSticky(value,reason){
    sticky=!!value;if(!sticky)cancelRaf();
    document.documentElement.dataset.ng133ScrollSticky=sticky?'1':'0';
    diag(sticky?`OK · bas suivi pendant génération · ${reason}`:`OK · scroll utilisateur libre · ${reason}`);
  }
  function setBottom(el){
    const max=Math.max(0,el.scrollHeight-el.clientHeight);
    programmaticUntil=performance.now()+120;
    if(el===document.scrollingElement){
      try{window.scrollTo({top:max,left:window.scrollX||0,behavior:'auto'});}catch{window.scrollTo(0,max);}
      el.scrollTop=max;
    }else{
      try{el.scrollTo({top:max,left:el.scrollLeft||0,behavior:'auto'});}catch{el.scrollTop=max;}
      if(Math.abs(el.scrollTop-max)>2)el.scrollTop=max;
    }
  }
  function refreshResizeTargets(){
    if(!resizeObserver||!root)return;
    const tail=conversationTail();if(tail===observedTail)return;observedTail=tail;
    try{resizeObserver.disconnect();resizeObserver.observe(root);if(tail&&tail!==root)resizeObserver.observe(tail);}catch{}
  }
  function bind(){
    const nextMain=conversationMain(),nextRoot=scrollRoot();if(!nextRoot)return;
    const mainChanged=nextMain!==main,rootChanged=nextRoot!==root;
    if(!mainChanged&&!rootChanged&&observer){refreshResizeTargets();return;}
    observer?.disconnect();resizeObserver?.disconnect();shellObserver?.disconnect();
    main=nextMain;root=nextRoot;observedTail=null;
    observer=new MutationObserver(()=>{if(main!==conversationMain()){bind();return;}refreshResizeTargets();pinBottom('mutation');});
    if(main)observer.observe(main,{childList:true,subtree:true,characterData:true});
    if(main?.parentElement){
      const shell=main.parentElement;
      shellObserver=new MutationObserver(records=>{
        if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n===main||(n instanceof Element&&(n.matches?.('main,[role="main"]')||n.querySelector?.('main,[role="main"]'))))))bind();
      });
      shellObserver.observe(shell,{childList:true,subtree:false});
    }
    if('ResizeObserver'in window){resizeObserver=new ResizeObserver(()=>pinBottom('resize'));refreshResizeTargets();}
    lastBottom=distanceBottom(root);
    document.documentElement.dataset.ng133ScrollRoot=root===document.scrollingElement?'document':(root.id||root.getAttribute?.('data-testid')||root.tagName||'element');
  }
  function restoreBottom(el,reason,phase){
    if(!sticky||!followingActive()||!connected(el))return;
    setBottom(el);lastBottom=distanceBottom(el);
    document.documentElement.dataset.ng133ScrollRestore=`${reason}:${phase}`;
  }
  function pinBottom(reason='growth'){
    if(!sticky||!followingActive())return;
    if(!root||!connected(root)){bind();if(!root)return;}
    const el=root;restoreBottom(el,reason,'sync');queueMicrotask(()=>restoreBottom(el,reason,'microtask'));
    cancelRaf();raf=requestAnimationFrame(()=>{
      raf=0;restoreBottom(el,reason,'raf1');
      if(!sticky||!followingActive())return;
      raf=requestAnimationFrame(()=>{raf=0;restoreBottom(el,reason,'raf2');});
    });
  }
  function armFromPosition(reason){
    if(!followingActive()||!root)return;
    const d=distanceBottom(root);lastBottom=d;
    if(d<=220&&performance.now()-userUpAt>180)setSticky(true,reason);
  }
  function targetsConversationScroller(target){
    if(!(target instanceof Node)||!root)return false;
    if(root===document.scrollingElement){
      const host=conversationMain();return !!host&&(target===host||host.contains(target)||target===document.body||target===document.documentElement);
    }
    return target===root||root.contains(target);
  }
  function isSendIntent(event){
    if(event.type==='keydown')return event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing&&editable(event.target);
    const el=event.target instanceof Element?event.target.closest('button,[role="button"]'):null;if(!el)return false;
    const label=`${el.getAttribute('data-testid')||''} ${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''}`;
    return /(?:send-button|composer-submit|\bSend\b|\bEnvoyer\b|\bSubmit\b)/i.test(label);
  }
  function noteSendIntent(event){
    if(!isChat()||!isSendIntent(event))return;bind();if(!root)return;
    sendIntentAt=performance.now();sendLatched=true;userUpAt=-Infinity;clearTimeout(latchTimer);
    setSticky(true,'envoi utilisateur');pinBottom('send-intent');
    latchTimer=setTimeout(()=>{latchTimer=0;if(!nativeActive()){clearLatch();if(sticky)setSticky(false,'aucune génération détectée');}},SEND_LATCH_MS);
  }
  function touchStart(event){if(!isChat())return;bind();if(!targetsConversationScroller(event.target))return;touchY=touchPoint(event);}
  function touchEnd(){touchY=null;}
  function userIntent(event){
    if(!isChat())return;bind();
    if(event.type==='keydown'){
      if(editable(event.target))return;
      if(root!==document.scrollingElement&&event.target instanceof Node&&event.target!==document.body&&event.target!==document.documentElement&&!targetsConversationScroller(event.target))return;
    }else if(!targetsConversationScroller(event.target))return;
    let dir=0;
    if(event.type==='wheel')dir=Math.sign(Number(event.deltaY)||0);
    else if(event.type==='touchmove'){const next=touchPoint(event);if(next!=null&&touchY!=null)dir=Math.sign(touchY-next);touchY=next;}
    else if(event.type==='keydown'){
      if(/^(ArrowUp|PageUp|Home)$/.test(event.key)||(event.key===' '&&event.shiftKey))dir=-1;
      else if(/^(ArrowDown|PageDown|End)$/.test(event.key)||event.key===' ')dir=1;
    }
    if(dir<0){
      userUpAt=performance.now();sendLatched=false;setSticky(false,'remontée volontaire');return;
    }
    requestAnimationFrame(()=>{
      if(dir>0&&root&&distanceBottom(root)<=100){
        userUpAt=-Infinity;lastBottom=distanceBottom(root);setSticky(true,'retour utilisateur vers le bas');pinBottom('user-bottom');return;
      }
      armFromPosition(dir>0?'retour utilisateur vers le bas':'position utilisateur');
    });
  }
  function scrollEvent(event){
    if(!root||event.target!==root)return;
    const d=distanceBottom(root);
    if(sticky&&performance.now()>programmaticUntil&&d>Math.max(160,lastBottom+100)){
      userUpAt=performance.now();sendLatched=false;setSticky(false,'défilement manuel détecté');
    }
    lastBottom=d;
    if(!sticky&&d<=45&&followingActive()&&performance.now()-userUpAt>120){userUpAt=-Infinity;setSticky(true,'bas retrouvé');pinBottom('scroll-bottom');}
  }
  function activity(){
    if(!isChat()){clearLatch();setSticky(false,'hors conversation');return;}
    bind();const now=nativeActive();
    if(now&&!wasActive){
      if(sendLatched||distanceBottom(root)<=260){userUpAt=-Infinity;setSticky(true,sendLatched?'génération après envoi':'génération démarrée au bas');pinBottom('generation-start');}
    }
    if(!now&&wasActive){clearLatch();setSticky(false,'génération terminée');}
    wasActive=now;if(now&&sticky)pinBottom('activity');
  }
  function route(){
    if(lastPath===location.pathname)return;lastPath=location.pathname;clearLatch();sticky=false;userUpAt=-Infinity;lastBottom=Infinity;main=null;root=null;observer?.disconnect();resizeObserver?.disconnect();shellObserver?.disconnect();observer=resizeObserver=shellObserver=null;bind();activity();
  }

  document.addEventListener('pointerdown',noteSendIntent,true);
  document.addEventListener('keydown',event=>{noteSendIntent(event);userIntent(event);},true);
  document.addEventListener('wheel',userIntent,{capture:true,passive:true});
  document.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',userIntent,{capture:true,passive:true});
  document.addEventListener('touchend',touchEnd,{capture:true,passive:true});
  document.addEventListener('touchcancel',touchEnd,{capture:true,passive:true});
  document.addEventListener('scroll',scrollEvent,true);
  document.addEventListener('niakgpt:activity-changed',activity);
  window.addEventListener('popstate',route);
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',route);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();activity();}});
  window.addEventListener('pagehide',()=>{observer?.disconnect();resizeObserver?.disconnect();shellObserver?.disconnect();cancelRaf();clearLatch();});
  window.addEventListener('pageshow',event=>{if(event.persisted){bind();activity();}});

  bind();activity();
})();