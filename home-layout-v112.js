(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_HOME_LAYOUT_112__)return;
  window.__NIAKGPT_HOME_LAYOUT_112__=true;
  let timer=0,observer=null,lastHeading=null;
  const visible=el=>{if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const home=()=>location.pathname==='/'||location.pathname==='';
  const composer=()=>{const ed=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');if(!visible(ed))return null;return ed.closest('form,[data-type="unified-composer"]')||ed.parentElement;};
  function heading(main){
    if(!main)return null;
    const candidates=[...main.querySelectorAll('h1,h2')].filter(visible).filter(h=>!h.closest('#ng8-panel,#ng8-coach,#ng100-onboarding,#ng100-command'));
    return candidates.sort((a,b)=>Math.abs(a.getBoundingClientRect().left-innerWidth/2)-Math.abs(b.getBoundingClientRect().left-innerWidth/2))[0]||null;
  }
  function clear(){if(lastHeading){lastHeading.classList.remove('ng112-home-heading-repaired');lastHeading.style.removeProperty('--ng112-home-lift');lastHeading=null;}document.documentElement.removeAttribute('data-ng112-home-overlap');}
  function repair(){
    timer=0;if(!home()){clear();return false;}const main=document.querySelector('main'),c=composer(),h=heading(main);if(!main||!c||!h){clear();return false;}
    if(lastHeading&&lastHeading!==h)clear();lastHeading=h;h.classList.remove('ng112-home-heading-repaired');h.style.removeProperty('--ng112-home-lift');
    const hr=h.getBoundingClientRect(),cr=c.getBoundingClientRect();const horizontal=hr.right>cr.left+20&&hr.left<cr.right-20;const overlap=horizontal&&hr.bottom>cr.top-12&&hr.top<cr.bottom+12;
    if(!overlap){document.documentElement.removeAttribute('data-ng112-home-overlap');return false;}
    const lift=Math.max(32,Math.ceil(hr.bottom-cr.top+34));h.style.setProperty('--ng112-home-lift',`${lift}px`);h.classList.add('ng112-home-heading-repaired');document.documentElement.dataset.ng112HomeOverlap='repaired';
    requestAnimationFrame(()=>{const next=h.getBoundingClientRect(),box=c.getBoundingClientRect();if(next.bottom>box.top-18){const extra=Math.ceil(next.bottom-(box.top-18));h.style.setProperty('--ng112-home-lift',`${lift+extra}px`);}});
    window.__NIAKGPT_DIAGNOSTICS__?.set('home-layout',`OK · titre dégagé de ${lift}px`);return true;
  }
  function schedule(delay=30){clearTimeout(timer);timer=setTimeout(repair,delay);}
  function start(){observer?.disconnect();observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule(40);});observer.observe(document.documentElement,{childList:true,subtree:true});for(const d of [0,120,400,1000,2200])setTimeout(()=>schedule(0),d);}
  window.addEventListener('resize',()=>schedule(50));window.addEventListener('popstate',()=>schedule(20));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(20));document.addEventListener('niakgpt:recovery-complete',()=>schedule(40));window.addEventListener('pagehide',()=>observer?.disconnect());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();