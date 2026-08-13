(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_POLISH_090__) return;
  window.__NIAKGPT_POLISH_090__ = true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control';
  let observer=null,observerTimer=0,scanTimer=0,a11yTimer=0;

  function visible(el){if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0;}
  function looksLikeActivity(panel){
    if(!(panel instanceof HTMLElement)||panel.closest(OWN)||!visible(panel))return false;const r=panel.getBoundingClientRect();if(r.width<280||r.width>760||r.right<innerWidth-70)return false;
    const title=panel.querySelector('h1,h2,h3,[role="heading"],header');const text=(title?.textContent||panel.getAttribute('aria-label')||'').trim();return /^(activité|activite|activity)(\s|·|$)/i.test(text)||/\b(activité|activite|activity)\b/i.test(text.slice(0,80));
  }
  function findActivity(root=document){
    const selector='aside,[role="dialog"],[data-testid*="activity" i],[class*="fixed"]';
    if(root instanceof Element&&root.matches(selector)&&looksLikeActivity(root))return root;
    const list=[...(root.querySelectorAll?.(selector)||[])];for(let i=Math.max(0,list.length-24);i<list.length;i++)if(looksLikeActivity(list[i]))return list[i];return null;
  }
  function closeActivity(panel){
    const native=[...panel.querySelectorAll('button')].find(b=>/fermer|close|masquer|hide|réduire|reduire/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`));if(native){native.click();return;}
    const id=panel.id;if(id){const trigger=[...document.querySelectorAll('button[aria-expanded="true"],button[aria-controls]')].find(b=>b.getAttribute('aria-controls')===id);if(trigger){trigger.click();return;}}
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
  }
  function decorate(panel){
    if(!panel||panel.classList.contains('ng8-native-activity'))return false;panel.classList.add('ng8-native-activity');if(getComputedStyle(panel).position==='static')panel.style.position='relative';
    const head=panel.querySelector('header,[role="heading"]')?.closest('header,div')||panel.querySelector('header');if(head instanceof HTMLElement)head.classList.add('ng8-activity-head');
    let close=panel.querySelector(':scope > .ng8-activity-close');if(!close){close=document.createElement('button');close.type='button';close.className='ng8-activity-close';close.setAttribute('aria-label','Fermer le panneau Activité');close.title='Fermer Activité';close.textContent='×';close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeActivity(panel);});panel.appendChild(close);}return true;
  }
  function polishControlAccessibility(){
    const modal=document.getElementById('ng90-control');if(!modal)return false;
    const safe=modal.querySelector('[data-setting="safeMode"]');if(safe instanceof HTMLInputElement){safe.setAttribute('aria-label','Activer le Safe Mode');safe.setAttribute('role','switch');safe.setAttribute('aria-checked',safe.checked?'true':'false');if(!safe.dataset.ng90A11yBound){safe.dataset.ng90A11yBound='1';safe.addEventListener('change',()=>safe.setAttribute('aria-checked',safe.checked?'true':'false'));}}
    return true;
  }
  function scheduleControlA11y(delay=0){clearTimeout(a11yTimer);a11yTimer=setTimeout(polishControlAccessibility,delay);}
  function scan(root=document){clearTimeout(scanTimer);const panel=findActivity(root)||findActivity(document);if(panel){decorate(panel);disarm();return true;}return false;}
  function scheduleScan(delay=120,root=document){clearTimeout(scanTimer);scanTimer=setTimeout(()=>scan(root),delay);}
  function arm(duration=16000){
    disarm();if(!document.body)return;observer=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.id==='ng90-control'||node.querySelector?.('#ng90-control'))scheduleControlA11y(0);const panel=findActivity(node);if(panel){decorate(panel);disarm();return;}}}});observer.observe(document.body,{childList:true,subtree:true});observerTimer=setTimeout(disarm,duration);
  }
  function disarm(){observer?.disconnect();observer=null;clearTimeout(observerTimer);observerTimer=0;}

  document.addEventListener('niakgpt:activity-network',event=>{if(event.detail?.phase==='request'||event.detail?.phase==='headers'){arm();scheduleScan(300);}},true);
  document.addEventListener('click',()=>{scheduleScan(150);scheduleControlA11y(0);},true);
  document.addEventListener('keydown',event=>{if(event.altKey&&event.key===',')scheduleControlA11y(0);},true);
  window.addEventListener('popstate',()=>scheduleScan(120));
  scheduleScan(300);
})();
