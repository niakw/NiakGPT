(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_HOME_LAYOUT_112__)return;
  window.__NIAKGPT_HOME_LAYOUT_112__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const KNOWN=/par quoi commen[cç]ons[- ]?nous|what can i help|how can i help|where (?:should|do) we start|bonjour.{0,40}(?:commence|commen)/i;
  let observer=null,mainNode=null,timer=0,stopped=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
  const isConversation=()=>/\/c\//.test(location.pathname)||/\/g\/g-p-[^/]+\/c\//i.test(location.pathname)||!!document.querySelector('[data-testid^="conversation-turn-"]');
  const mainRoot=()=>document.querySelector('main');

  function composer(){
    const direct=[...document.querySelectorAll('[data-type="unified-composer"]')].find(visible);if(direct)return direct;
    for(const prompt of document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"]')){
      if(!visible(prompt))continue;
      const host=prompt.closest('[data-type="unified-composer"],form');if(host&&visible(host))return host;
    }
    return null;
  }

  function greeting(main,box){
    const headings=[...main.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(el=>visible(el)&&!el.closest(OWN)&&!el.contains(box));
    const known=headings.find(el=>KNOWN.test(clean(el.textContent||el.getAttribute('aria-label'))));
    if(known)return known;
    const candidates=headings.filter(el=>{const t=clean(el.textContent);if(!t||t.length>140)return false;const r=el.getBoundingClientRect();return Math.abs((r.left+r.width/2)-innerWidth/2)<innerWidth*.28&&r.top<box.getBoundingClientRect().bottom;});
    if(candidates.length)return candidates.sort((a,b)=>Math.abs(a.getBoundingClientRect().bottom-box.getBoundingClientRect().top)-Math.abs(b.getBoundingClientRect().bottom-box.getBoundingClientRect().top))[0];
    for(const el of [...main.querySelectorAll('div,p')].slice(0,320)){
      if(!visible(el)||el.closest(OWN)||el.contains(box)||el.querySelector('form,[data-type="unified-composer"]'))continue;
      const t=clean(el.textContent);if(!t||t.length>100||!KNOWN.test(t))continue;
      return el;
    }
    return null;
  }

  function clear(){
    for(const el of document.querySelectorAll('.ng112-home-composer-shift')){
      el.classList.remove('ng112-home-composer-shift');el.style.removeProperty('--ng112-home-shift');delete el.dataset.ng112HomeShift;
    }
    delete document.documentElement.dataset.ng112HomeProtected;
  }

  function apply(){
    timer=0;if(stopped)return false;
    if(isConversation()){clear();return false;}
    const main=mainRoot(),box=composer();if(!main||!box){clear();return false;}
    if(main!==mainNode)bind(main);
    box.classList.remove('ng112-home-composer-shift');box.style.removeProperty('--ng112-home-shift');delete box.dataset.ng112HomeShift;
    const title=greeting(main,box);if(!title){delete document.documentElement.dataset.ng112HomeProtected;return false;}
    const br=box.getBoundingClientRect(),tr=title.getBoundingClientRect();
    const desiredGap=Math.max(26,Math.min(42,innerHeight*.035));
    const needed=Math.ceil(tr.bottom+desiredGap-br.top);
    if(needed<=0){document.documentElement.dataset.ng112HomeProtected='1';window.__NIAKGPT_DIAGNOSTICS__?.set('home-layout','OK · accueil sans collision');return true;}
    const shift=Math.min(Math.max(needed,0),Math.max(80,Math.min(180,innerHeight*.22)));
    box.style.setProperty('--ng112-home-shift',`${shift}px`);box.classList.add('ng112-home-composer-shift');box.dataset.ng112HomeShift=String(shift);
    document.documentElement.dataset.ng112HomeProtected='1';
    window.__NIAKGPT_DIAGNOSTICS__?.set('home-layout',`OK · composer décalé de ${shift}px · titre protégé`);
    return true;
  }

  function schedule(delay=20){if(stopped)return;clearTimeout(timer);timer=setTimeout(apply,delay);}
  function bind(main=mainRoot()){
    if(!main)return false;
    if(main===mainNode&&observer)return true;
    observer?.disconnect();mainNode=main;observer=new MutationObserver(()=>schedule(18));
    observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style','data-type']});
    return true;
  }
  function start(){stopped=false;bind();for(const d of [0,80,260,700])setTimeout(()=>schedule(0),d);}
  function stop(){stopped=true;clearTimeout(timer);timer=0;observer?.disconnect();observer=null;mainNode=null;}

  window.addEventListener('resize',()=>schedule(60),{passive:true});
  window.addEventListener('popstate',()=>schedule(10));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(10));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',e=>{if(e.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
