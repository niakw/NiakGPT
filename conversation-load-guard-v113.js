(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LOAD_GUARD_113__)return;
  window.__NIAKGPT_LOAD_GUARD_113__=true;
  const TURN='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  let timer=0,lastPath=location.pathname;
  const isChat=()=>/\/c\/[A-Za-z0-9_-]+/.test(location.pathname);
  const hasTurns=()=>!!document.querySelector(`main ${TURN}`);
  function clearNiakGPTContentPressure(){
    const root=document.documentElement;root.dataset.ng112LongThread='0';if(!hasTurns())root.dataset.ng8Heavy='0';
    document.querySelectorAll('[data-ng112-cold]').forEach(el=>el.removeAttribute('data-ng112-cold'));
  }
  function check(){
    timer=0;if(!isChat()||document.hidden)return;if(hasTurns()){window.__NIAKGPT_DIAGNOSTICS__?.set('chargement-chat','OK · contenu natif présent');return;}
    clearNiakGPTContentPressure();window.dispatchEvent(new Event('resize'));document.dispatchEvent(new CustomEvent('niakgpt:native-content-missing'));
    window.__NIAKGPT_DIAGNOSTICS__?.set('chargement-chat','ATTENTE · contenu natif absent · garde NiakGPT relâchée');
  }
  function schedule(delay=900){clearTimeout(timer);timer=setTimeout(check,delay);}
  function route(){if(lastPath!==location.pathname){lastPath=location.pathname;clearNiakGPTContentPressure();}schedule(700);setTimeout(check,2200);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearNiakGPTContentPressure();schedule(220);}});
  document.addEventListener('niakgpt:activity-changed',()=>{if((document.documentElement.dataset.ng86Activity||'ready')==='ready')schedule(240);});
  window.addEventListener('popstate',route);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',()=>{clearNiakGPTContentPressure();schedule(180);});
  route();
})();
