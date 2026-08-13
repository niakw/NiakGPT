(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_POLISH_090__) return;
  window.__NIAKGPT_POLISH_090__ = true;

  let a11yTimer=0;

  function polishControlAccessibility(){
    const modal=document.getElementById('ng90-control');if(!modal)return false;
    const safe=modal.querySelector('[data-setting="safeMode"]');
    if(safe instanceof HTMLInputElement){
      safe.setAttribute('aria-label','Activer le Safe Mode');
      safe.setAttribute('role','switch');
      safe.setAttribute('aria-checked',safe.checked?'true':'false');
      if(!safe.dataset.ng90A11yBound){
        safe.dataset.ng90A11yBound='1';
        safe.addEventListener('change',()=>safe.setAttribute('aria-checked',safe.checked?'true':'false'));
      }
    }
    return true;
  }
  function scheduleControlA11y(delay=0){clearTimeout(a11yTimer);a11yTimer=setTimeout(polishControlAccessibility,delay);}

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('#ng90-settings-btn,#ng90-control'))scheduleControlA11y(0);
  },true);
  document.addEventListener('keydown',event=>{if(event.altKey&&event.key===',')scheduleControlA11y(0);},true);
  document.addEventListener('niakgpt:settings-changed',()=>scheduleControlA11y(0));
  scheduleControlA11y(350);
})();
