(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_VISUAL_STABILITY_101__)return;
  window.__NIAKGPT_VISUAL_STABILITY_101__=true;

  const OWN='#ng8-rail,#ng8-panel,#ng8-status,#ng8-pins,#ng8-quick,#ng90-control,#ng85-governance,#ng911-auto,#ng100-onboarding';
  const VIEWER_SEL='[role="dialog"],[aria-modal="true"],[data-radix-dialog-content],[data-radix-portal] > div,div[class*="fixed"][class*="inset-0"]';
  let detector=null,detectorTimer=0,viewerHost=null,closeButton=null,activeObserver=null,matrixTimer=0;

  const visible=el=>!!(el instanceof HTMLElement&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  function largeMedia(host){
    return [...host.querySelectorAll('img,video,canvas')].find(media=>{
      if(!visible(media)||media.closest(OWN))return false;
      const r=media.getBoundingClientRect();
      return r.width>=Math.min(360,innerWidth*.34)&&r.height>=Math.min(240,innerHeight*.30);
    })||null;
  }
  function viewerCandidate(){
    for(const host of document.querySelectorAll(VIEWER_SEL)){
      if(!visible(host)||host.closest(OWN))continue;
      const r=host.getBoundingClientRect();
      if(r.width<innerWidth*.55||r.height<innerHeight*.55)continue;
      if(largeMedia(host))return host;
    }
    return null;
  }
  function stabilizeMatrix(){
    clearTimeout(matrixTimer);matrixTimer=0;
    const matrix=document.getElementById('ng8-matrix');
    if(matrix&&document.body&&matrix.parentElement!==document.body)document.body.prepend(matrix);
  }
  function scheduleMatrix(delay=80){clearTimeout(matrixTimer);matrixTimer=setTimeout(stabilizeMatrix,delay);}
  function cleanupViewer(){
    viewerHost?.classList.remove('ng101-image-viewer-host');viewerHost=null;
    closeButton?.remove();closeButton=null;
    document.documentElement.removeAttribute('data-ng101-image-viewer');
    activeObserver?.disconnect();activeObserver=null;
  }
  function nativeClose(){
    if(!viewerHost)return null;
    const selector='button[aria-label*="close" i],button[aria-label*="fermer" i],button[title*="close" i],button[title*="fermer" i],[data-testid*="close" i]';
    return [...viewerHost.querySelectorAll(selector),...document.querySelectorAll(selector)].find(visible)||null;
  }
  function escapeViewer(){
    const native=nativeClose();
    if(native){native.click();setTimeout(scanViewer,90);return;}
    for(const target of [document.activeElement,document.body,document,window]){
      try{target?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
    }
    setTimeout(scanViewer,140);
  }
  function ensureCloseButton(){
    if(closeButton?.isConnected)return;
    closeButton=document.createElement('button');closeButton.id='ng101-image-close';closeButton.type='button';closeButton.setAttribute('aria-label','Fermer le visualiseur d’image');closeButton.title='Fermer · Échap';closeButton.textContent='×';closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();escapeViewer();});document.body.appendChild(closeButton);
  }
  function activateViewer(host){
    if(!host)return;
    if(viewerHost!==host){
      viewerHost?.classList.remove('ng101-image-viewer-host');activeObserver?.disconnect();
      viewerHost=host;host.classList.add('ng101-image-viewer-host');
      activeObserver=new MutationObserver(()=>{if(!viewerHost?.isConnected||!visible(viewerHost))cleanupViewer();});
      const parent=viewerHost.parentElement||document.body;activeObserver.observe(parent,{childList:true});activeObserver.observe(viewerHost,{attributes:true,attributeFilter:['class','style','data-state','aria-hidden','open']});
    }
    document.documentElement.dataset.ng101ImageViewer='1';ensureCloseButton();
  }
  function scanViewer(){
    const host=viewerCandidate();
    if(host){activateViewer(host);return true;}
    if(viewerHost&&!viewerHost.isConnected)cleanupViewer();
    return false;
  }
  function armDetector(duration=2800){
    clearTimeout(detectorTimer);detector?.disconnect();scanViewer();
    if(!document.body)return;
    detector=new MutationObserver(()=>scanViewer());detector.observe(document.body,{childList:true,subtree:true});
    detectorTimer=setTimeout(()=>{detector?.disconnect();detector=null;if(!viewerCandidate())cleanupViewer();},duration);
  }
  function imageIntent(target){
    if(!(target instanceof Element)||target.closest(OWN))return false;
    return !!(target.closest('img,video')||target.closest('button,a')?.querySelector('img,video'));
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('#ng101-image-close'))return;
    if(imageIntent(target))armDetector();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&viewerHost){setTimeout(scanViewer,100);return;}
    if((event.key==='Enter'||event.key===' ')&&imageIntent(document.activeElement))armDetector();
  },true);
  document.addEventListener('niakgpt:settings-changed',()=>scheduleMatrix(140));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleMatrix(80);if(viewerHost)scanViewer();}});
  window.addEventListener('popstate',()=>{cleanupViewer();scheduleMatrix(180);});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>scheduleMatrix(160));
  window.addEventListener('pagehide',()=>{clearTimeout(detectorTimer);clearTimeout(matrixTimer);detector?.disconnect();activeObserver?.disconnect();},{once:true});

  scheduleMatrix(0);
})();
