(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PERF_GUARD_101__)return;
  window.__NIAKGPT_PERF_GUARD_101__=true;

  const TURN_SEL='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  const HEAVY_TURNS=65;
  const HEAVY_CODE=35;
  let main=null,observer=null,timer=0,heavyLatched=false,lastPath=location.pathname;

  const root=document.documentElement;
  const activity=()=>root.dataset.ng86Activity||'ready';

  function schedule(delay=420){
    clearTimeout(timer);
    timer=setTimeout(()=>{timer=0;evaluate();},delay);
  }
  function stopObserver(){observer?.disconnect();observer=null;}
  function bind(){
    const next=document.querySelector('main');
    if(next===main&&observer)return;
    stopObserver();main=next;
    if(main&&!heavyLatched){
      observer=new MutationObserver(records=>{
        if(heavyLatched){stopObserver();return;}
        let relevant=false;
        for(const r of records){if(r.addedNodes.length||r.removedNodes.length){relevant=true;break;}}
        if(relevant)schedule(activity()==='ready'?700:1400);
      });
      observer.observe(main,{childList:true,subtree:true});
    }
  }
  function count(selector){return main?main.querySelectorAll(selector).length:0;}
  function setHeavy(heavy,turns=0,codes=0){
    heavyLatched=!!heavy;
    root.dataset.ng8Heavy=heavy?'1':'0';
    root.dataset.ng101HeavyGuard=heavy?'1':'0';
    if(heavy){
      root.dataset.ng101AutoLight='1';
      stopObserver();
      window.__NIAKGPT_DIAGNOSTICS__?.set('performance',`AUTO-LÉGER · ${turns} tours · ${codes} blocs code`);
    }else{
      delete root.dataset.ng101AutoLight;
      window.__NIAKGPT_DIAGNOSTICS__?.set('performance','PRÊT · garde fil lourd inactive');
    }
  }
  function evaluate(){
    bind();
    if(!main||!location.pathname.includes('/c/')){if(heavyLatched)setHeavy(false);return;}
    if(heavyLatched)return;
    const turns=count(TURN_SEL);
    if(turns>=HEAVY_TURNS){setHeavy(true,turns,0);return;}
    const codes=count('pre');
    if(codes>=HEAVY_CODE)setHeavy(true,turns,codes);
  }
  function onRoute(){
    const next=location.pathname;
    if(next!==lastPath){
      lastPath=next;heavyLatched=false;setHeavy(false);main=null;bind();schedule(280);
    }else if(!heavyLatched)schedule(650);
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!heavyLatched)schedule(400);});
  window.addEventListener('popstate',onRoute);
  document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href]'))setTimeout(onRoute,0);},true);
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);stopObserver();},{once:true});

  bind();
  schedule(180);
})();
