(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDE_PANELS_096__)return;
  window.__NIAKGPT_SIDE_PANELS_096__=true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding,#ng97-loader';
  const FAST_SEL='aside,[role="dialog"],[aria-modal="true"],[data-testid*="activity" i],[data-testid*="source" i],[data-testid*="output" i],[data-testid*="reason" i],[data-testid*="analysis" i]';
  const TRIGGER_SEL='button,[role="button"],a';
  const LABEL_RX=/activit[eé]|activity|source|sources|sortie|sorties|output|outputs|r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i;
  const tracked=new Set(),triggers=new Set();
  let timer=0,disposed=false;

  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.left<innerWidth&&r.top<innerHeight;};
  const textOf=el=>`${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('title')||''} ${el.getAttribute?.('data-testid')||''} ${el.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent||''} ${(el.textContent||'').slice(0,320)}`;
  function kind(el){const t=textOf(el);if(/source/i.test(t))return'sources';if(/sortie|output/i.test(t))return'outputs';if(/r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i.test(t))return'reflection';return'activity';}
  function insideManagedPanel(el){return !!el.parentElement?.closest?.('.ng96-native-sidepanel');}
  function geometryOK(el){
    if(!(el instanceof HTMLElement)||el.closest(OWN)||insideManagedPanel(el)||!visible(el))return false;
    if(el===document.body||el===document.documentElement||el.matches('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))return false;
    const r=el.getBoundingClientRect();
    if(r.width<260||r.width>760||r.height<220)return false;
    if(r.right<innerWidth-90||r.left<Math.max(360,innerWidth*.48))return false;
    if(el.querySelector('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))return false;
    return LABEL_RX.test(textOf(el));
  }
  function triggerOK(el){
    if(!(el instanceof HTMLElement)||el.closest(OWN)||el.closest('.ng96-native-sidepanel')||!visible(el))return false;
    const r=el.getBoundingClientRect();
    if(r.width<18||r.width>190||r.height<18||r.height>100)return false;
    if(r.right<innerWidth-190)return false;
    return LABEL_RX.test(textOf(el).slice(0,180));
  }
  function climbFromHeading(heading){
    let el=heading;
    for(let i=0;i<7&&el?.parentElement;i++,el=el.parentElement){if(geometryOK(el))return el;if(el.parentElement===document.body)break;}
    return null;
  }
  function ensureClose(el){
    let close=el.querySelector(':scope > .ng96-side-close');if(close)return close;
    close=document.createElement('button');close.type='button';close.className='ng96-side-close';close.setAttribute('aria-label','Fermer le panneau');close.textContent='×';
    close.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const native=[...el.querySelectorAll('button,[role="button"]')].find(b=>b!==close&&/fermer|close/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`));
      if(native){native.click();return;}
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
    });
    el.prepend(close);return close;
  }
  function mark(el){
    if(!geometryOK(el))return false;const type=kind(el);
    for(const cls of ['ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection'])el.classList.remove(cls);
    el.classList.add('ng96-native-sidepanel',`ng96-sidepanel-${type}`);el.dataset.ng96Sidepanel=type;ensureClose(el);tracked.add(el);return true;
  }
  function markTrigger(el){
    if(!triggerOK(el))return false;const type=kind(el);
    for(const cls of ['ng96-side-trigger-activity','ng96-side-trigger-sources','ng96-side-trigger-outputs','ng96-side-trigger-reflection'])el.classList.remove(cls);
    el.classList.add('ng96-native-side-trigger','ng96-side-trigger-static',`ng96-side-trigger-${type}`);el.dataset.ng96SideTrigger=type;triggers.add(el);return true;
  }
  function discover(root=document){
    const candidates=new Set();
    if(root instanceof HTMLElement){if(root.matches?.(FAST_SEL))candidates.add(root);for(const el of root.querySelectorAll?.(FAST_SEL)||[])candidates.add(el);}
    else for(const el of document.querySelectorAll(FAST_SEL))candidates.add(el);
    const scope=root instanceof HTMLElement?root:document;
    for(const h of [...scope.querySelectorAll?.('h1,h2,h3,[role="heading"]')||[]].slice(-120)){
      if(!visible(h)||!LABEL_RX.test(String(h.textContent||'')))continue;const panel=climbFromHeading(h);if(panel)candidates.add(panel);
    }
    for(const el of candidates)mark(el);

    // Handles can exist outside the subtree that just mutated (typical: click a handle,
    // then ChatGPT mounts a panel elsewhere). Always rescan a bounded tail of global
    // controls so the panel mount cannot cancel/loss the handle classification.
    const triggerCandidates=[...document.querySelectorAll(TRIGGER_SEL)].slice(-260);
    for(const el of triggerCandidates)markTrigger(el);
  }
  function cleanTracked(){
    let active=false;
    for(const el of [...tracked]){
      if(!visible(el)||!geometryOK(el)){
        el.classList.remove('ng96-native-sidepanel','ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection');delete el.dataset.ng96Sidepanel;el.querySelector(':scope > .ng96-side-close')?.remove();tracked.delete(el);
      }else active=true;
    }
    for(const el of [...triggers]){
      if(!visible(el)||!triggerOK(el)){
        el.classList.remove('ng96-native-side-trigger','ng96-side-trigger-static','ng96-side-trigger-activity','ng96-side-trigger-sources','ng96-side-trigger-outputs','ng96-side-trigger-reflection');delete el.dataset.ng96SideTrigger;triggers.delete(el);
      }
    }
    return active;
  }
  function scan(root=document){
    if(disposed)return;discover(root);const active=cleanTracked();
    if(active)document.documentElement.dataset.ng96NativePanel='1';else delete document.documentElement.dataset.ng96NativePanel;
    window.__NIAKGPT_DIAGNOSTICS__?.set('panneau-natif',active?`OK · ${tracked.size} panneau(x) · overlay stable`:`PRÊT · panneau fermé · ${triggers.size} poignée(s)`);
  }
  function schedule(root=document,delay=70){if(disposed)return;clearTimeout(timer);timer=setTimeout(()=>scan(root),delay);}
  const observer=new MutationObserver(records=>{
    if(disposed)return;let root=null;for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement){root=n;break;}schedule(root||document,root?40:100);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',()=>schedule(document,80),{passive:true});
  document.addEventListener('click',()=>schedule(document,100),true);
  window.addEventListener('popstate',()=>schedule(document,100));
  window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);observer.disconnect();tracked.clear();triggers.clear();},{once:true});
  schedule(document,0);
})();
