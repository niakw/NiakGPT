(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PERF_GUARD_101__)return;
  window.__NIAKGPT_PERF_GUARD_101__=true;

  const TURN_SEL='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  const HEAVY_TURNS=65;
  const HEAVY_CODE=35;
  let main=null,observer=null,timer=0,autoSafe=false,baseSafe=false,lastPath=location.pathname;

  const root=document.documentElement;
  const activity=()=>root.dataset.ng86Activity||'ready';

  function schedule(delay=420){
    clearTimeout(timer);
    timer=setTimeout(()=>{timer=0;evaluate();},delay);
  }
  function bind(){
    const next=document.querySelector('main');
    if(next===main)return;
    observer?.disconnect();main=next;
    if(main){
      observer=new MutationObserver(records=>{
        let relevant=false;
        for(const r of records){if(r.addedNodes.length||r.removedNodes.length){relevant=true;break;}}
        if(relevant)schedule(activity()==='ready'?700:1400);
      });
      observer.observe(main,{childList:true,subtree:true});
    }
  }
  function countBounded(selector,limit){
    if(!main)return 0;
    const all=main.querySelectorAll(selector);
    return Math.min(all.length,limit);
  }
  function desiredBaseSafe(){
    try{
      const raw=JSON.parse(localStorage.getItem('niakgpt-settings-mirror-v090')||'{}');
      if(typeof raw.safeMode==='boolean')return raw.safeMode;
    }catch{}
    return root.dataset.ng90Safe==='1'&&!autoSafe;
  }
  function setHeavy(heavy,turns,codes){
    root.dataset.ng8Heavy=heavy?'1':'0';
    root.dataset.ng101HeavyGuard=heavy?'1':'0';
    if(heavy){
      if(!autoSafe){baseSafe=desiredBaseSafe();autoSafe=true;}
      root.dataset.ng90Safe='1';
      root.dataset.ng101AutoSafe='1';
      window.__NIAKGPT_DIAGNOSTICS__?.set('performance',`AUTO-LÉGER · ${turns}+ tours · ${codes}+ blocs code`);
    }else if(autoSafe){
      autoSafe=false;
      delete root.dataset.ng101AutoSafe;
      root.dataset.ng90Safe=baseSafe?'1':'0';
      window.__NIAKGPT_DIAGNOSTICS__?.set('performance','PRÊT · garde fil lourd inactive');
    }
  }
  function evaluate(){
    bind();
    if(!main||!location.pathname.includes('/c/')){setHeavy(false,0,0);return;}
    const turns=countBounded(TURN_SEL,HEAVY_TURNS+1);
    const codes=countBounded('pre',HEAVY_CODE+1);
    setHeavy(turns>=HEAVY_TURNS||codes>=HEAVY_CODE,turns,codes);
  }
  function onRoute(){
    const next=location.pathname;
    if(next!==lastPath){lastPath=next;bind();schedule(280);}else schedule(650);
  }

  document.addEventListener('niakgpt:settings-changed',event=>{
    const wanted=event.detail?.settings?.safeMode;
    if(typeof wanted==='boolean')baseSafe=wanted;
    if(autoSafe)root.dataset.ng90Safe='1';
    schedule(160);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(400);});
  window.addEventListener('popstate',onRoute);
  document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href]'))setTimeout(onRoute,0);},true);
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);observer?.disconnect();},{once:true});

  bind();
  schedule(180);
})();
