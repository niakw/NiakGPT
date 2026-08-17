(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LIVE_FIXES_104__)return;
  window.__NIAKGPT_LIVE_FIXES_104__=true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding,#ng97-loader';
  const PROJECT_SEL='a[href^="/g/g-p-"]:not([href*="/c/"])';
  const PROJECT_CHAT_SEL='a[href^="/g/g-p-"][href*="/c/"]';
  const LABEL_RX=/activit[eé]|activity|sources?|sorties?|outputs?|r[eé]flexion|reflection|reasoning|raisonnement|analyse|analysis/i;
  const PANEL_CLASSES=['ng96-sidepanel-activity','ng96-sidepanel-sources','ng96-sidepanel-outputs','ng96-sidepanel-reflection'];
  let sidebarObserver=null,globalObserver=null,sidebarNode=null,timer=0,suspended=false,markedPanel=null;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.left<innerWidth&&r.top<innerHeight;};
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const managedProjectsReady=()=>{const pins=document.getElementById('ng8-pins');return !!(pins&&pins.isConnected&&!pins.hidden&&pins.querySelector('[data-ng8-pin],a[href*="/g/g-p-"]'));};
  function releaseNativeProjects(nav){
    nav.querySelectorAll('.ng8-native-projects-suppressed,.ng8-native-project-link-suppressed,.ng8-native-project-chat-suppressed,.ng8-native-project-label-suppressed,.ng8-native-project-more-suppressed').forEach(el=>el.classList.remove('ng8-native-projects-suppressed','ng8-native-project-link-suppressed','ng8-native-project-chat-suppressed','ng8-native-project-label-suppressed','ng8-native-project-more-suppressed'));
  }

  function suppressNativeProjects(){
    const nav=sidebarRoot();if(!nav)return;
    if(!managedProjectsReady()){releaseNativeProjects(nav);return;}
    for(const a of nav.querySelectorAll(PROJECT_SEL))if(!a.closest('#ng8-pins'))a.classList.add('ng8-native-project-link-suppressed');
    for(const a of nav.querySelectorAll(PROJECT_CHAT_SEL))if(!a.closest('#ng8-pins'))a.classList.add('ng8-native-project-chat-suppressed');
    for(const el of nav.querySelectorAll('h1,h2,h3,[role="heading"],div,span')){
      if(el.closest('#ng8-pins')||el.closest(OWN))continue;
      if(/^(projets?|projects?)$/i.test(clean(el.textContent)))el.classList.add('ng8-native-project-label-suppressed');
    }
    for(const more of nav.querySelectorAll('button,a,[role="button"]')){
      if(more.closest('#ng8-pins')||more.closest(OWN))continue;
      const text=clean(more.textContent||more.getAttribute('aria-label'));
      if(!/^(afficher plus|show more|voir plus)$/i.test(text))continue;
      let host=more.parentElement,found=false;
      for(let i=0;i<4&&host&&host!==nav;i++,host=host.parentElement){if(host.querySelector(PROJECT_SEL)||host.querySelector(PROJECT_CHAT_SEL)){found=true;break;}}
      if(found)more.classList.add('ng8-native-project-more-suppressed');
    }
  }

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
    for(const h of [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].slice(-160))if(visible(h)&&LABEL_RX.test(clean(h.textContent)))addAncestors(candidates,h,offset);
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

  function repair(){if(suspended)return;suppressNativeProjects();markPanel();}
  function schedule(delay=45){if(suspended)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}
  function bindSidebar(){
    const nav=sidebarRoot();if(!nav||nav===sidebarNode)return;sidebarObserver?.disconnect();sidebarNode=nav;
    sidebarObserver=new MutationObserver(()=>schedule(30));sidebarObserver.observe(nav,{childList:true,subtree:true});
  }
  function startObservers(){
    bindSidebar();globalObserver?.disconnect();globalObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof HTMLElement))){bindSidebar();schedule(35);}});globalObserver.observe(document.documentElement,{childList:true,subtree:true});schedule(0);
  }
  function stopObservers(){sidebarObserver?.disconnect();globalObserver?.disconnect();sidebarObserver=globalObserver=null;clearTimeout(timer);timer=0;}

  window.addEventListener('resize',()=>schedule(70),{passive:true});
  document.addEventListener('click',()=>schedule(90),true);
  window.addEventListener('popstate',()=>schedule(90));
  window.addEventListener('pagehide',()=>{suspended=true;stopObservers();});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;startObservers();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObservers,{once:true});else startObservers();
})();
