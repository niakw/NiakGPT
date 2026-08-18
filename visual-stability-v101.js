(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_VISUAL_STABILITY_103__)return;
  window.__NIAKGPT_VISUAL_STABILITY_103__=true;

  const OWN='#ng8-rail,#ng8-panel,#ng8-status,#ng8-pins,#ng8-quick,#ng90-control,#ng85-governance,#ng911-auto,#ng100-onboarding,#ng100-command';
  const VIEWER_SEL='[role="dialog"],[aria-modal="true"],[data-radix-dialog-content],[data-radix-portal] > div,div[class*="fixed"][class*="inset-0"]';
  const CLOSE_ID='ng103-image-close';
  const VIEWER_PROBE_DELAYS=[70,140,260,480,800,1300,2100,3200];
  const MATRIX_PROBE_DELAYS=[80,180,360,700,1200,2200,4200];
  let detectorTimer=0,detectorProbe=0,viewerHost=null,closeButton=null,viewerObserver=null,viewerRootObserver=null;
  let matrixTimer=0,matrixProbe=0;

  const visible=el=>{
    if(!(el instanceof HTMLElement)||!el.isConnected||!el.getClientRects().length)return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
  };

  function rehomeMatrix(){
    const matrix=document.getElementById('ng8-matrix');
    if(!matrix||!document.body)return false;
    if(matrix.parentElement!==document.body)document.body.prepend(matrix);
    return true;
  }
  function armMatrixProbes(){
    clearTimeout(matrixTimer);matrixTimer=0;matrixProbe=0;
    const probe=()=>{
      matrixTimer=0;
      if(rehomeMatrix())return;
      if(matrixProbe>=MATRIX_PROBE_DELAYS.length)return;
      matrixTimer=setTimeout(probe,MATRIX_PROBE_DELAYS[matrixProbe++]);
    };
    probe();
  }

  function largeMedia(host){
    return [...host.querySelectorAll('img,video,canvas')].find(media=>{
      if(!visible(media)||media.closest(OWN)||media.id==='ng8-matrix')return false;
      const r=media.getBoundingClientRect();
      return r.width>=Math.min(360,innerWidth*.34)&&r.height>=Math.min(240,innerHeight*.30);
    })||null;
  }
  function overlayHostFromMedia(){
    for(const media of document.querySelectorAll('img,video,canvas')){
      if(!visible(media)||media.closest(OWN)||media.id==='ng8-matrix')continue;
      const mr=media.getBoundingClientRect();
      if(mr.width<Math.min(360,innerWidth*.34)||mr.height<Math.min(240,innerHeight*.30))continue;
      let node=media.parentElement;
      for(let depth=0;depth<10&&node&&node!==document.body;depth++,node=node.parentElement){
        if(!visible(node)||node.closest(OWN))continue;
        const r=node.getBoundingClientRect(),cs=getComputedStyle(node),modal=node.getAttribute('aria-modal')==='true'||node.getAttribute('role')==='dialog';
        if(r.width>=innerWidth*.68&&r.height>=innerHeight*.68&&(cs.position==='fixed'||modal))return node;
      }
    }
    return null;
  }
  function viewerCandidate(){
    for(const host of document.querySelectorAll(VIEWER_SEL)){
      if(!visible(host)||host.closest(OWN))continue;
      const r=host.getBoundingClientRect();
      if(r.width<innerWidth*.55||r.height<innerHeight*.55)continue;
      if(largeMedia(host))return host;
    }
    return overlayHostFromMedia();
  }
  function nativeClose(){
    if(!viewerHost)return null;
    const selector='button[aria-label*="close" i],button[aria-label*="fermer" i],button[title*="close" i],button[title*="fermer" i],[data-testid*="close" i]';
    const parent=viewerHost.parentElement;
    const siblingScope=parent&&parent!==document.body?parent:null;
    const candidates=[...viewerHost.querySelectorAll(selector),...(siblingScope?[...siblingScope.querySelectorAll(selector)]:[])];
    return candidates.find(el=>visible(el)&&el.id!==CLOSE_ID&&!el.closest(OWN))||null;
  }
  function cleanupViewer(){
    viewerHost?.classList.remove('ng103-image-viewer-host');viewerHost=null;
    closeButton?.remove();closeButton=null;
    document.documentElement.removeAttribute('data-ng103-image-viewer');
    viewerObserver?.disconnect();viewerObserver=null;
  }
  function scanViewer(){
    const host=viewerCandidate();
    if(host){activateViewer(host);return true;}
    if(viewerHost&&(!visible(viewerHost)||!largeMedia(viewerHost)))cleanupViewer();
    return false;
  }
  function requestClose(){
    const native=nativeClose();
    if(native){native.click();setTimeout(scanViewer,100);return;}
    const eventInit={key:'Escape',code:'Escape',bubbles:true,cancelable:true};
    const target=document.activeElement instanceof EventTarget?document.activeElement:document.body;
    try{target?.dispatchEvent(new KeyboardEvent('keydown',eventInit));}catch{}
    setTimeout(scanViewer,150);
  }
  function ensureCloseButton(){
    if(closeButton?.isConnected)return;
    closeButton=document.createElement('button');closeButton.id=CLOSE_ID;closeButton.type='button';
    closeButton.setAttribute('aria-label','Fermer le visualiseur d’image');closeButton.title='Fermer · Échap';closeButton.textContent='×';
    closeButton.addEventListener('click',event=>{
      event.preventDefault();event.stopImmediatePropagation();requestClose();
    },true);
    document.body.appendChild(closeButton);
  }
  function activateViewer(host){
    if(!host)return;
    if(viewerHost!==host||!viewerObserver){
      if(viewerHost!==host)viewerHost?.classList.remove('ng103-image-viewer-host');
      viewerObserver?.disconnect();
      viewerHost=host;host.classList.add('ng103-image-viewer-host');
      viewerObserver=new MutationObserver(()=>{
        if(!viewerHost?.isConnected||!visible(viewerHost)||!largeMedia(viewerHost))cleanupViewer();
      });
      const parent=viewerHost.parentElement||document.body;
      viewerObserver.observe(parent,{childList:true});
      viewerObserver.observe(viewerHost,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-state','aria-hidden','open']});
    }
    document.documentElement.dataset.ng103ImageViewer='1';ensureCloseButton();
  }
  function armDetector(){
    clearTimeout(detectorTimer);detectorTimer=0;detectorProbe=0;
    const probe=()=>{
      detectorTimer=0;
      if(scanViewer())return;
      if(detectorProbe>=VIEWER_PROBE_DELAYS.length){if(!viewerCandidate())cleanupViewer();return;}
      detectorTimer=setTimeout(probe,VIEWER_PROBE_DELAYS[detectorProbe++]);
    };
    probe();
  }
  function imageIntent(target){
    if(!(target instanceof Element)||target.closest(OWN))return false;
    if(target.closest('img,video,figure,[data-testid*="image" i],[data-testid*="media" i]')||target.closest('button,a')?.querySelector('img,video,canvas'))return true;
    const control=target.closest('button,a,[role="button"]'),label=`${control?.getAttribute?.('aria-label')||''} ${control?.getAttribute?.('title')||''}`;
    return /image|photo|preview|aper[cç]u|visualis/i.test(label);
  }
  function armViewerObserver(){
    viewerRootObserver?.disconnect();
    viewerRootObserver=new MutationObserver(records=>{
      if(viewerHost)return;
      const mediaAdded=records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&(n.matches?.('img,video,canvas,[role="dialog"],[aria-modal="true"]')||n.querySelector?.('img,video,canvas'))));
      if(mediaAdded)setTimeout(()=>scanViewer(),35);
    });
    viewerRootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest(`#${CLOSE_ID}`))return;
    if(imageIntent(target))armDetector();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&viewerHost){setTimeout(scanViewer,100);return;}
    if((event.key==='Enter'||event.key===' ')&&imageIntent(document.activeElement))armDetector();
  },true);
  document.addEventListener('niakgpt:settings-changed',armMatrixProbes);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){armMatrixProbes();if(viewerHost)scanViewer();}});
  window.addEventListener('popstate',()=>{cleanupViewer();armMatrixProbes();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{cleanupViewer();armMatrixProbes();});
  window.addEventListener('pageshow',event=>{if(event.persisted){armMatrixProbes();armViewerObserver();if(viewerHost)scanViewer();}});
  window.addEventListener('pagehide',()=>{
    clearTimeout(detectorTimer);clearTimeout(matrixTimer);viewerObserver?.disconnect();viewerRootObserver?.disconnect();viewerObserver=viewerRootObserver=null;
  });

  const start=()=>{armMatrixProbes();armViewerObserver();};
  if(document.body)start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
