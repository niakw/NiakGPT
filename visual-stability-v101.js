(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_VISUAL_STABILITY_101__)return;
  window.__NIAKGPT_VISUAL_STABILITY_101__=true;

  let detector=null,detectorTimer=0,viewerHost=null,closeButton=null,activeObserver=null;
  const OWN='#ng8-rail,#ng8-panel,#ng8-status,#ng8-pins,#ng8-quick,#ng90-control,#ng85-governance,#ng911-auto,#ng100-onboarding';
  const visible=el=>!!(el instanceof HTMLElement&&el.getClientRects().length);

  function viewerCandidate(){
    const images=[...document.querySelectorAll('img')].filter(img=>{
      if(!visible(img)||img.closest(OWN))return false;
      const r=img.getBoundingClientRect();return r.width>=280&&r.height>=220;
    });
    for(const img of images){
      let node=img.parentElement,fallback=null;
      for(let depth=0;node&&node!==document.body&&depth<12;depth++,node=node.parentElement){
        const style=getComputedStyle(node),r=node.getBoundingClientRect();
        const broad=r.width>=innerWidth*.72&&r.height>=innerHeight*.68;
        const modal=node.getAttribute('role')==='dialog'||node.dataset.state==='open';
        if(style.position==='fixed'&&broad)return node;
        if(!fallback&&modal)fallback=node;
      }
      if(fallback)return fallback;
    }
    return null;
  }
  function cleanupViewer(){
    viewerHost?.classList.remove('ng101-image-viewer-host');viewerHost=null;
    closeButton?.remove();closeButton=null;
    document.documentElement.removeAttribute('data-ng101-image-viewer');
    activeObserver?.disconnect();activeObserver=null;
  }
  function escapeViewer(){
    const native=viewerHost?.querySelector('button[aria-label*="close" i],button[aria-label*="fermer" i],button[title*="close" i],button[title*="fermer" i]');
    if(native&&visible(native)){native.click();setTimeout(cleanupViewer,80);return;}
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
    setTimeout(()=>{if(!viewerHost?.isConnected||!visible(viewerHost))cleanupViewer();},160);
  }
  function activateViewer(host){
    if(!host||host===viewerHost)return;
    cleanupViewer();viewerHost=host;host.classList.add('ng101-image-viewer-host');document.documentElement.dataset.ng101ImageViewer='1';
    closeButton=document.createElement('button');closeButton.id='ng101-image-close';closeButton.type='button';closeButton.setAttribute('aria-label','Fermer le visualiseur d’image');closeButton.title='Fermer · Échap';closeButton.textContent='×';closeButton.addEventListener('click',escapeViewer);document.body.appendChild(closeButton);
    activeObserver=new MutationObserver(()=>{if(!viewerHost?.isConnected||!visible(viewerHost))cleanupViewer();});activeObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-state','aria-hidden']});
  }
  function scanViewer(){const host=viewerCandidate();if(host)activateViewer(host);}
  function armDetector(duration=2600){
    clearTimeout(detectorTimer);detector?.disconnect();scanViewer();
    detector=new MutationObserver(scanViewer);detector.observe(document.body,{childList:true,subtree:true});
    detectorTimer=setTimeout(()=>{detector?.disconnect();detector=null;},duration);
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('#ng101-image-close'))return;
    if(target?.closest('img')&&!target.closest(OWN))armDetector();
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&viewerHost)setTimeout(()=>{if(!viewerHost?.isConnected||!visible(viewerHost))cleanupViewer();},100);},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&viewerHost&&!viewerHost.isConnected)cleanupViewer();});
  window.addEventListener('pagehide',()=>{clearTimeout(detectorTimer);detector?.disconnect();activeObserver?.disconnect();},{once:true});
})();
