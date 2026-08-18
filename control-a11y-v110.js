(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTROL_A11Y_110__)return;
  window.__NIAKGPT_CONTROL_A11Y_110__=true;

  let timer=0;
  const labelFor=input=>{
    if(input.dataset.setting==='safeMode')return'Activer le Safe Mode';
    const row=input.closest('label'),title=row?.querySelector('b')?.textContent?.trim();
    return title?`Activer ${title}`:'Activer ou désactiver cette option';
  };
  function sync(){
    timer=0;
    const modal=document.getElementById('ng90-control');if(!modal)return;
    for(const input of modal.querySelectorAll('input[type="checkbox"][data-setting]')){
      input.setAttribute('role','switch');
      input.setAttribute('aria-checked',input.checked?'true':'false');
      if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',labelFor(input));
    }
  }
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(sync,delay);}
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('#ng90-settings-btn,#ng90-control'))schedule(0);
  },true);
  document.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='checkbox'||!input.matches('#ng90-control [data-setting]'))return;
    input.setAttribute('role','switch');input.setAttribute('aria-checked',input.checked?'true':'false');
    if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',labelFor(input));
    schedule(40);
  },true);
  document.addEventListener('niakgpt:settings-changed',()=>schedule(0));
  window.addEventListener('pageshow',()=>schedule(40));
})();
