(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_TURN_HEADERS_112__)return;
  window.__NIAKGPT_TURN_HEADERS_112__=true;

  const TURN='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  const LIVE_KEY='niakgpt-turn-live-times-v112';
  const FULL_TIME=/^\d{2}\/\d{2}\/\d{2} · \d{2}:\d{2}$/;
  let main=null,observer=null,timer=0,pendingUserAt=0,pendingAssistantAt=0,route=location.pathname;
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const mid=turn=>String(turn?.getAttribute?.('data-message-id')||turn?.querySelector?.('[data-message-id]')?.getAttribute('data-message-id')||'');
  const role=turn=>turn?.querySelector?.('[data-message-author-role]')?.getAttribute('data-message-author-role')||turn?.dataset?.ng8Role||'';
  const liveMap=()=>{try{return JSON.parse(sessionStorage.getItem(LIVE_KEY)||'{}')||{};}catch{return{};}};
  const writeLive=(id,at)=>{if(!id||!at)return;try{const map=liveMap();map[id]=at;const entries=Object.entries(map).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,40);sessionStorage.setItem(LIVE_KEY,JSON.stringify(Object.fromEntries(entries)));}catch{}};
  function nativeAt(turn){
    const nodes=[turn,...turn.querySelectorAll?.('time[datetime],[datetime],[data-message-timestamp],[data-timestamp],[data-create-time],[data-created-at]')||[]];
    for(const el of nodes){for(const key of['datetime','data-message-timestamp','data-timestamp','data-create-time','data-created-at']){const at=parseTime(el?.getAttribute?.(key));if(at)return at;}}
    return 0;
  }
  function label(at){if(!at)return'';const d=new Date(at);if(!Number.isFinite(d.getTime()))return'';const dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0'),yy=String(d.getFullYear()).slice(-2),hh=String(d.getHours()).padStart(2,'0'),mi=String(d.getMinutes()).padStart(2,'0');return`${dd}/${mm}/${yy} · ${hh}:${mi}`;}
  function decorate(turn,{allowLive=true}={}){
    if(!(turn instanceof HTMLElement)||!turn.isConnected)return;
    const r=role(turn);if(r!=='user'&&r!=='assistant')return;turn.dataset.ng8Role=r;turn.dataset.ng8Turn='1';
    const id=mid(turn),exact=nativeAt(turn),elementStored=Number(turn.dataset.ng112At||0),sessionStored=Number(liveMap()[id]||0);let at=exact||elementStored||sessionStored;
    if(!at&&allowLive){
      if(r==='user'&&pendingUserAt){at=pendingUserAt;pendingUserAt=0;pendingAssistantAt=Date.now();}
      else if(r==='assistant'&&pendingAssistantAt){at=Date.now();pendingAssistantAt=0;}
      if(at&&id)writeLive(id,at);
    }
    if(at){turn.dataset.ng112At=String(at);turn.dataset.ng8Time=label(at);turn.dataset.ng112TimeSource=exact?'native':(elementStored||sessionStored?'cached-live':'live');}
    else if(!/^(native|live|cached-live)$/.test(turn.dataset.ng112TimeSource||'')){delete turn.dataset.ng8Time;delete turn.dataset.ng112At;}
    const active=['waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')&&r==='assistant';
    if(active)turn.dataset.ng112Live='1';else delete turn.dataset.ng112Live;
    turn.dataset.ng112Header='1';
  }
  function scanRecent(){
    timer=0;const root=document.querySelector('main');if(!root)return;const turns=[...root.querySelectorAll(TURN)],start=Math.max(0,turns.length-(document.documentElement.dataset.ng112LongThread==='1'?54:140));for(let i=start;i<turns.length;i++)decorate(turns[i],{allowLive:i>=turns.length-4});
    window.__NIAKGPT_DIAGNOSTICS__?.set('entêtes','OK · TOI/CHATGPT · date/heure fiable prioritaire');
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(scanRecent,delay);}
  function composerTarget(target){return target instanceof Element&&!!target.closest('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');}
  function markSend(){pendingUserAt=Date.now();pendingAssistantAt=0;}
  function bind(){
    const root=document.querySelector('main');if(!root||root===main)return;observer?.disconnect();main=root;
    observer=new MutationObserver(records=>{
      let relevant=false;
      for(const r of records){
        if(r.type==='attributes'){
          const turn=r.target instanceof Element?r.target.closest(TURN):null;
          if(turn&&turn.dataset.ng112TimeSource&&!FULL_TIME.test(turn.dataset.ng8Time||'')){relevant=true;break;}
          continue;
        }
        for(const n of r.addedNodes){if(!(n instanceof Element))continue;if(n.matches?.(TURN)||n.querySelector?.(TURN)){relevant=true;break;}}
        if(relevant)break;
      }
      if(relevant)schedule(70);
    });
    observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['data-ng8-time']});schedule(60);
  }
  function routeCheck(){if(route!==location.pathname){route=location.pathname;pendingUserAt=0;pendingAssistantAt=0;}bind();schedule(80);}
  document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button'):null;if(!b)return;const label=`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`;if(/send|envoyer/i.test(label))markSend();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing&&composerTarget(e.target))markSend();},true);
  document.addEventListener('niakgpt:activity-changed',()=>schedule(50));window.addEventListener('popstate',()=>setTimeout(routeCheck,10));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>setTimeout(routeCheck,10));window.addEventListener('pagehide',()=>observer?.disconnect());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',routeCheck,{once:true});else routeCheck();
})();