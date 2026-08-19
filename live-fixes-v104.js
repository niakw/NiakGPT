(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LIVE_FIXES_104__)return;
  window.__NIAKGPT_LIVE_FIXES_104__=true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding,#ng97-loader';
  const LABEL_RX=/activit[eé]|activity|sources?|sorties?|outputs?|r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i;
  const PANEL_CLASSES=['ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection'];
  let globalObserver=null,timer=0,suspended=false,markedPanel=null;

  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.left<innerWidth&&r.top<innerHeight;};
  function panelText(el){return `${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('data-testid')||''} ${el.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent||''} ${(el.textContent||'').slice(0,1400)}`;}
  function panelKind(el){const t=panelText(el);if(/sources?/i.test(t))return'sources';if(/sortie|output/i.test(t))return'outputs';if(/r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i.test(t))return'reflection';return'activity';}
  function railOffset(){const rail=document.getElementById('ng8-rail');if(!visible(rail))return 46;const r=rail.getBoundingClientRect();return Math.max(0,Math.round(innerWidth-r.left));}
  function candidateOK(el,offset){
    if(!(el instanceof HTMLElement)||!visible(el)||el.closest(OWN))return false;
    if(el===document.body||el===document.documentElement||el.matches('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav'))return false;
    if(el.querySelector('main,[data-testid="conversation-sidebar"],[data-testid="sidebar"]'))return false;
    const r=el.getBoundingClientRect(),targetRight=innerWidth-offset;
    if(r.width<240||r.width>820||r.height<180)return false;
    if(r.left<Math.max(340,innerWidth*.42))return false;
    if(Math.abs(r.right-targetRight)>110&&r.right<innerWidth-25)return false;
    return LABEL_RX.test(panelText(el));
  }
  function addAncestors(set,node,offset){
    let el=node instanceof HTMLElement?node:null;
    for(let i=0;i<9&&el;i++,el=el.parentElement){if(candidateOK(el,offset))set.add(el);if(el===document.body)break;}
  }
  function detectPanel(){
    const offset=railOffset();document.documentElement.style.setProperty('--ng96-rail-offset',`${offset}px`);
    const candidates=new Set(),x=Math.max(0,Math.min(innerWidth-1,innerWidth-offset-8));
    for(const y of [70,160,300,Math.round(innerHeight*.5),Math.max(80,innerHeight-150)]){
      try{for(const el of document.elementsFromPoint(x,Math.min(innerHeight-1,y)))addAncestors(candidates,el,offset);}catch{}
    }
    for(const el of document.querySelectorAll('aside,[role="dialog"],[aria-modal="true"],[data-testid*="activity" i],[data-testid*="source" i],[data-testid*="output" i],[data-testid*="reason" i],[data-testid*="analysis" i]'))addAncestors(candidates,el,offset);
    for(const h of [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].slice(-160))if(visible(h)&&LABEL_RX.test(String(h.textContent||'').trim()))addAncestors(candidates,h,offset);
    let best=null,bestScore=-1;
    for(const el of candidates){const r=el.getBoundingClientRect(),targetRight=innerWidth-offset;const edgePenalty=Math.abs(r.right-targetRight)*1000;const score=r.width*r.height-edgePenalty;if(score>bestScore){best=el;bestScore=score;}}
    return best;
  }
  function markPanel(){
    const next=detectPanel();
    if(markedPanel&&markedPanel!==next){markedPanel.classList.remove('ng96-native-sidepanel',...PANEL_CLASSES);delete markedPanel.dataset.ng96Sidepanel;}
    markedPanel=next;
    if(!next){delete document.documentElement.dataset.ng96NativePanel;return;}
    next.classList.remove(...PANEL_CLASSES);const kind=panelKind(next);next.classList.add('ng96-native-sidepanel',`ng96-sidepanel-${kind}`);next.dataset.ng96Sidepanel=kind;document.documentElement.dataset.ng96NativePanel='1';
  }

  function repair(){if(suspended)return;markPanel();}
  function schedule(delay=45){if(suspended)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}
  function startObservers(){
    globalObserver?.disconnect();globalObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof HTMLElement)))schedule(35);});globalObserver.observe(document.documentElement,{childList:true,subtree:true});schedule(0);
  }
  function stopObservers(){globalObserver?.disconnect();globalObserver=null;clearTimeout(timer);timer=0;}

  window.addEventListener('resize',()=>schedule(70),{passive:true});
  document.addEventListener('click',()=>schedule(90),true);
  window.addEventListener('popstate',()=>schedule(90));
  window.addEventListener('pagehide',()=>{suspended=true;stopObservers();});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;startObservers();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObservers,{once:true});else startObservers();
})();