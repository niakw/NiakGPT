(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_IMAGE_VIEWER_101__)return;
  window.__NIAKGPT_IMAGE_VIEWER_101__=true;

  const root=document.documentElement;
  const CANDIDATE='[role="dialog"],[aria-modal="true"],[data-radix-dialog-content],[data-radix-portal] > div,div[class*="fixed"][class*="inset-0"]';
  let observer=null,stopTimer=0,scanTimer=0,current=null,closeButton=null;

  const visible=el=>!!(el instanceof HTMLElement&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const largeMedia=host=>{
    const media=[...host.querySelectorAll('img,video,canvas')].filter(visible);
    return media.find(el=>{
      const r=el.getBoundingClientRect();
      return r.width>=Math.min(420,innerWidth*.38)&&r.height>=Math.min(280,innerHeight*.34);
    })||null;
  };
  function candidateHost(){
    for(const el of document.querySelectorAll(CANDIDATE)){
      if(!visible(el))continue;
      const r=el.getBoundingClientRect();
      if(r.width<innerWidth*.55||r.height<innerHeight*.55)continue;
      if(largeMedia(el))return el;
    }
    return null;
  }
  function nativeClose(host){
    const selector='button[aria-label*="close" i],button[aria-label*="fermer" i],button[title*="close" i],button[title*="fermer" i],[data-testid*="close" i]';
    return [...host.querySelectorAll(selector),...document.querySelectorAll(selector)].find(visible)||null;
  }
  function cleanup(){
    if(current?.isConnected)current.classList.remove('ng101-image-viewer-host');
    current=null;
    closeButton?.remove();closeButton=null;
    delete root.dataset.ng101ImageViewer;
  }
  function requestNativeClose(){
    const btn=current&&nativeClose(current);
    if(btn){btn.click();setTimeout(scan,80);return;}
    for(const target of [document.activeElement,document.body,document,window]){
      try{target?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
    }
    setTimeout(scan,120);
  }
  function ensureClose(){
    if(closeButton?.isConnected)return;
    closeButton=document.createElement('button');
    closeButton.id='ng101-image-close';
    closeButton.type='button';
    closeButton.setAttribute('aria-label','Fermer le visualiseur d’image');
    closeButton.title='Fermer';
    closeButton.textContent='×';
    closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();requestNativeClose();});
    document.body.appendChild(closeButton);
  }
  function scan(){
    scanTimer=0;
    const host=candidateHost();
    if(!host){cleanup();return false;}
    if(current!==host){current?.classList.remove('ng101-image-viewer-host');current=host;current.classList.add('ng101-image-viewer-host');}
    root.dataset.ng101ImageViewer='1';
    ensureClose();
    return true;
  }
  function stop(){clearTimeout(stopTimer);observer?.disconnect();observer=null;if(!current)cleanup();}
  function arm(duration=2600){
    if(!document.body)return;
    clearTimeout(stopTimer);
    if(!observer){observer=new MutationObserver(()=>schedule(60));observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden','open']});}
    schedule(0);
    stopTimer=setTimeout(()=>{if(current?.isConnected){arm(2200);return;}stop();},duration);
  }
  function schedule(delay=50){clearTimeout(scanTimer);scanTimer=setTimeout(scan,delay);}

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('img,video,[data-testid*="image" i],[aria-label*="image" i],[aria-label*="photo" i]'))arm(3000);
    else if(current)arm(1200);
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&current)setTimeout(()=>{scan();if(!current)stop();},100);},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current)arm(1200);});
  window.addEventListener('popstate',()=>{cleanup();stop();});
  window.addEventListener('pagehide',()=>{cleanup();stop();clearTimeout(scanTimer);},{once:true});
})();
