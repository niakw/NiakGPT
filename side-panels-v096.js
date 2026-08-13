(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_SIDE_PANELS_096__) return;
  window.__NIAKGPT_SIDE_PANELS_096__ = true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding';
  const PANEL_SEL='aside,[role="dialog"],[data-testid*="activity" i],[data-testid*="progress" i],[data-testid*="source" i],[data-testid*="output" i],[class*="fixed"]';
  const LABEL_RX=/\b(activité|activite|activity|progression|progress|progressing|sources?|sorties?|outputs?)\b/i;
  const TYPES=['activity','progress','sources','outputs'];
  let observer=null,observerTimer=0,scanTimer=0;

  const visible=el=>{if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0;};
  function panelType(text){
    const s=String(text||'');
    if(/\b(activité|activite|activity)\b/i.test(s))return'activity';
    if(/\b(progression|progress|progressing)\b/i.test(s))return'progress';
    if(/\b(sources?)\b/i.test(s))return'sources';
    if(/\b(sorties?|outputs?)\b/i.test(s))return'outputs';
    return'';
  }
  function labelOf(el){if(!(el instanceof Element))return'';const heading=el.querySelector('h1,h2,h3,[role="heading"],header');return `${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''} ${heading?.textContent||''}`.trim();}
  function looksLikePanel(el){
    if(!(el instanceof HTMLElement)||el.closest(OWN)||!visible(el))return'';
    const r=el.getBoundingClientRect();if(r.width<250||r.width>900||r.right<innerWidth-150)return'';
    return panelType(labelOf(el));
  }
  function findPanel(root=document){
    if(root instanceof Element){const type=looksLikePanel(root);if(type)return{panel:root,type};}
    const list=[...(root.querySelectorAll?.(PANEL_SEL)||[])];
    for(let i=Math.max(0,list.length-60);i<list.length;i++){const type=looksLikePanel(list[i]);if(type)return{panel:list[i],type};}
    return null;
  }
  function nativeClose(panel){return[...panel.querySelectorAll('button')].find(b=>/fermer|close|masquer|hide|réduire|reduire/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`));}
  function closePanel(panel){
    const close=nativeClose(panel);if(close){close.click();return;}
    const id=panel.id;if(id){const trigger=[...document.querySelectorAll('button[aria-expanded="true"],button[aria-controls]')].find(b=>b.getAttribute('aria-controls')===id);if(trigger){trigger.click();return;}}
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
  }
  function decoratePanel(panel,type){
    if(!(panel instanceof HTMLElement))return;
    for(const t of TYPES)panel.classList.remove(`ng96-sidepanel-${t}`);
    panel.classList.add('ng96-native-sidepanel',`ng96-sidepanel-${type}`,'ng96-activity-geometry');
    panel.dataset.ng96Sidepanel=type;
    if(getComputedStyle(panel).position==='static')panel.style.position='relative';
    const head=panel.querySelector('header,[role="heading"]')?.closest('header,div')||panel.querySelector('header');
    if(head instanceof HTMLElement){head.classList.add('ng96-sidepanel-head');if(getComputedStyle(head).position==='static')head.style.position='relative';}
    panel.classList.toggle('ng8-native-activity',type==='activity');
    const closeHost=head instanceof HTMLElement?head:panel;
    let close=closeHost.querySelector(':scope > .ng96-side-close,:scope > .ng8-activity-close')||panel.querySelector(':scope > .ng96-side-close,:scope > .ng8-activity-close');
    if(close&&close.parentElement!==closeHost)closeHost.appendChild(close);
    if(!close){
      close=document.createElement('button');close.type='button';close.className='ng96-side-close';
      const name=type==='activity'?'Activité':type==='progress'?'Progression':type==='sources'?'Sources':'Sorties';
      close.setAttribute('aria-label',`Fermer ${name}`);close.textContent='×';
      close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closePanel(panel);});closeHost.appendChild(close);
    }
  }
  function decorateTriggers(root=document){
    const candidates=[...(root.querySelectorAll?.('button,[role="button"],a')||[])];
    for(const el of candidates){
      if(!(el instanceof HTMLElement)||el.closest(OWN)||!visible(el))continue;
      const text=`${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''} ${el.title||''} ${(el.textContent||'').trim().slice(0,80)}`;
      if(!LABEL_RX.test(text))continue;
      const r=el.getBoundingClientRect();if(r.right<innerWidth-115||r.width>180||r.height>100)continue;
      const type=panelType(text);if(!type)continue;
      for(const t of TYPES)el.classList.remove(`ng96-side-trigger-${t}`);
      el.classList.add('ng96-native-side-trigger',`ng96-side-trigger-${type}`);el.dataset.ng96SideTrigger=type;
      const position=getComputedStyle(el).position;el.classList.toggle('ng96-side-trigger-static',position==='static');
    }
  }
  function scan(root=document){
    clearTimeout(scanTimer);decorateTriggers(root);const found=findPanel(root)||findPanel(document);if(found)decoratePanel(found.panel,found.type);decorateTriggers(document);return !!found;
  }
  function scheduleScan(delay=100,root=document){clearTimeout(scanTimer);scanTimer=setTimeout(()=>scan(root),delay);}
  function disarm(){observer?.disconnect();observer=null;clearTimeout(observerTimer);observerTimer=0;}
  function arm(duration=5000){
    disarm();if(!document.body)return;
    observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;decorateTriggers(node);const found=findPanel(node);if(found)decoratePanel(found.panel,found.type);}});
    observer.observe(document.body,{childList:true,subtree:true});observerTimer=setTimeout(disarm,duration);
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null,control=target?.closest('button,[role="button"],a');if(!(control instanceof HTMLElement)||control.closest(OWN))return;
    const text=`${control.getAttribute('aria-label')||''} ${control.getAttribute('data-testid')||''} ${control.title||''} ${(control.textContent||'').trim().slice(0,80)}`,r=control.getBoundingClientRect();
    const relevant=LABEL_RX.test(text)||(r.right>innerWidth-125&&r.width<=170&&r.height<=100);
    if(!relevant)return;arm();scheduleScan(80,control.closest('header,main,aside')||document);
  },true);
  window.addEventListener('popstate',()=>scheduleScan(100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleScan(120);});

  const stateObserver=new MutationObserver(records=>{if(records.some(r=>r.attributeName==='data-ng86-activity')&&document.documentElement.dataset.ng86Activity==='ready')scheduleScan(120);});
  stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng86-activity']});

  scheduleScan(180);setTimeout(()=>scheduleScan(600),600);setTimeout(()=>scheduleScan(1500),1500);
})();