(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDE_PANELS_096__)return;
  window.__NIAKGPT_SIDE_PANELS_096__=true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding,#ng97-loader';
  const FAST_SEL='aside,[role="dialog"],[aria-modal="true"],[data-testid*="activity" i],[data-testid*="source" i],[data-testid*="output" i],[data-testid*="reason" i],[data-testid*="analysis" i]';
  const LABEL_RX=/activit[eé]|activity|source|sources|sortie|sorties|output|outputs|r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i;
  const tracked=new Set();
  let timer=0;

  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.left<innerWidth&&r.top<innerHeight;};
  const textOf=el=>`${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('data-testid')||''} ${el.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent||''} ${(el.textContent||'').slice(0,320)}`;
  function kind(el){const t=textOf(el);if(/source/i.test(t))return'sources';if(/sortie|output/i.test(t))return'outputs';if(/r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i.test(t))return'reflection';return'activity';}
  function geometryOK(el){
    if(!(el instanceof HTMLElement)||el.closest(OWN)||!visible(el))return false;
    if(el===document.body||el===document.documentElement||el.matches('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))return false;
    const r=el.getBoundingClientRect();
    if(r.width<260||r.width>760||r.height<220)return false;
    if(r.right<innerWidth-90||r.left<Math.max(360,innerWidth*.48))return false;
    if(el.querySelector('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))return false;
    return LABEL_RX.test(textOf(el));
  }
  function climbFromHeading(heading){
    let el=heading;
    for(let i=0;i<7&&el?.parentElement;i++,el=el.parentElement){
      if(geometryOK(el))return el;
      if(el.parentElement===document.body)break;
    }
    return null;
  }
  function mark(el){
    if(!geometryOK(el))return false;
    const type=kind(el);
    for(const cls of ['ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection'])el.classList.remove(cls);
    el.classList.add('ng96-native-sidepanel',`ng96-sidepanel-${type}`);
    el.dataset.ng96Sidepanel=type;tracked.add(el);return true;
  }
  function discover(root=document){
    const candidates=new Set();
    if(root instanceof HTMLElement){if(root.matches?.(FAST_SEL))candidates.add(root);for(const el of root.querySelectorAll?.(FAST_SEL)||[])candidates.add(el);}
    else for(const el of document.querySelectorAll(FAST_SEL))candidates.add(el);
    // OpenAI sometimes wraps Activity/Reflection/Sources in anonymous divs. Headings +
    // geometry are more stable than tag names, so climb from matching visible headings.
    const scope=root instanceof HTMLElement?root:document;
    for(const h of [...scope.querySelectorAll?.('h1,h2,h3,[role="heading"]')||[]].slice(-120)){
      if(!visible(h)||!LABEL_RX.test(String(h.textContent||'')))continue;
      const panel=climbFromHeading(h);if(panel)candidates.add(panel);
    }
    for(const el of candidates)mark(el);
  }
  function cleanTracked(){
    let active=false;
    for(const el of [...tracked]){
      if(!visible(el)||!geometryOK(el)){
        el.classList.remove('ng96-native-sidepanel','ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection');
        delete el.dataset.ng96Sidepanel;tracked.delete(el);
      }else active=true;
    }
    return active;
  }
  function scan(root=document){
    discover(root);const active=cleanTracked();
    if(active)document.documentElement.dataset.ng96NativePanel='1';else delete document.documentElement.dataset.ng96NativePanel;
    window.__NIAKGPT_DIAGNOSTICS__?.set('panneau-natif',active?`OK · ${tracked.size} panneau(x) · overlay stable`:'PRÊT · panneau natif fermé');
  }
  function schedule(root=document,delay=70){clearTimeout(timer);timer=setTimeout(()=>scan(root),delay);}
  const observer=new MutationObserver(records=>{
    let root=null;for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement){root=n;break;}
    schedule(root||document,root?40:100);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',()=>schedule(document,80),{passive:true});
  document.addEventListener('click',()=>schedule(document,100),true);
  window.addEventListener('popstate',()=>schedule(document,100));
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  schedule(document,0);
})();
