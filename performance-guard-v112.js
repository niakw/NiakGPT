(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PERF_GUARD_112__)return;
  window.__NIAKGPT_PERF_GUARD_112__=true;

  const TURN='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  const HEAVY_AT=70,COLD_KEEP=44;
  let main=null,observer=null,timer=0,route=location.pathname,epoch=0;
  const activity=()=>document.documentElement.dataset.ng86Activity||'ready';
  const idle=()=>activity()==='ready'&&document.documentElement.dataset.ng8Running!=='1';
  const scheduleTask=fn=>{if('requestIdleCallback'in window){try{return requestIdleCallback(fn,{timeout:900});}catch{}}return setTimeout(fn,60);};
  function roleOf(turn){return turn.querySelector?.('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';}
  function markChunk(turns,start,end,token){
    if(token!==epoch)return;
    const stop=Math.min(end,turns.length);
    for(let i=start;i<stop;i++){
      const turn=turns[i];if(!(turn instanceof HTMLElement)||!turn.isConnected)continue;
      const role=roleOf(turn);if(role==='user'||role==='assistant')turn.dataset.ng8Role=role;
      turn.dataset.ng112Cold=i<Math.max(0,turns.length-COLD_KEEP)?'1':'0';
    }
    if(stop<turns.length)scheduleTask(()=>markChunk(turns,stop,stop+24,token));
  }
  function evaluate(){
    timer=0;const root=document.querySelector('main');if(!root)return;
    const turns=[...root.querySelectorAll(TURN)],count=turns.length,heavy=count>=HEAVY_AT;
    document.documentElement.dataset.ng112LongThread=heavy?'1':'0';
    if(heavy)document.documentElement.dataset.ng8Heavy='1';
    const token=++epoch;markChunk(turns,0,heavy?24:turns.length,token);
    window.__NIAKGPT_DIAGNOSTICS__?.set('perf-112',heavy?`OK · fil lourd ${count} · historique froid · live ${COLD_KEEP}`:`OK · fil ${count}`);
  }
  function schedule(delay=120){clearTimeout(timer);timer=setTimeout(()=>{if(idle())evaluate();else schedule(650);},delay);}
  function bind(){
    const root=document.querySelector('main');if(!root||root===main)return;
    observer?.disconnect();main=root;observer=new MutationObserver(records=>{
      let relevant=0;for(const r of records){relevant+=r.addedNodes.length+r.removedNodes.length;if(relevant>24)break;}
      schedule(relevant>24?700:220);
    });
    observer.observe(main,{childList:true,subtree:true});schedule(220);
  }
  function routeCheck(){if(route!==location.pathname){route=location.pathname;epoch++;document.documentElement.dataset.ng112LongThread='0';schedule(420);}bind();}
  document.addEventListener('niakgpt:activity-changed',()=>{if(idle())schedule(280);});
  window.addEventListener('popstate',()=>setTimeout(routeCheck,20));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>setTimeout(routeCheck,20));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)routeCheck();});
  window.addEventListener('pagehide',()=>observer?.disconnect());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',routeCheck,{once:true});else routeCheck();
})();