(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com')return;
  const init=()=>{
    if(window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__)return;
    window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__=true;

  let gesture=null,clearTimer=0;
  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const root=()=>document.documentElement;
  const dist=(a,b)=>Math.hypot(Number(a?.clientX||0)-Number(b?.clientX||0),Number(a?.clientY||0)-Number(b?.clientY||0));
  const clean=v=>String(v||'').trim();
  function clear(){gesture=null;clearTimeout(clearTimer);clearTimer=0;delete root().dataset.ng129PinInteraction;}
  function armClear(){clearTimeout(clearTimer);clearTimer=setTimeout(clear,1400);}
  function navigate(href){
    const chatId=cid(href),projectId=pid(href),links=[...document.querySelectorAll('a[href]')].filter(a=>!a.closest('#ng8-pins'));
    const native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cid(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pid(a.getAttribute('href'))===projectId):null);
    if(native instanceof HTMLElement)native.click();else location.assign(href);
  }
  function replacementAction(kind,id){
    return [...document.querySelectorAll('#ng8-pins .ng113-native-actions')].find(b=>clean(b.dataset.ng123Action||b.dataset.ng113Actions)===kind&&clean(b.dataset.ng123Id||b.dataset.ng113Id)===id)||null;
  }
  function menuMatches(g){const menu=document.getElementById('ng123-action-menu');return !!menu&&menu.dataset.kind===g.kind&&menu.dataset.id===g.id;}
  function fallback(g){
    if(!g||g.clickSeen||Date.now()-g.at>1500)return;
    if(g.type==='chat'){
      if(location.pathname===g.pathAt)navigate(g.href);
      return;
    }
    if(g.type==='action'){
      const open=menuMatches(g);
      // Fallback must complete the state transition that the original gesture intended,
      // not blindly click again. A missed click-observation used to reopen a menu that
      // had just closed (or close one that had just opened) on Firefox/WebKit.
      if(g.wasOpen?!open:open)return;
      const b=replacementAction(g.kind,g.id);if(b instanceof HTMLElement)b.click();
    }
  }

  document.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;const target=event.target instanceof Element?event.target:null;
    const action=target?.closest('#ng8-pins .ng113-native-actions');
    const chat=target?.closest('#ng8-pins .ng96-chat-entry>a[data-chat]');
    if(!(action||chat))return;
    root().dataset.ng129PinInteraction='1';
    if(chat){gesture={type:'chat',href:chat.getAttribute('href')||chat.href||'',chatId:clean(chat.dataset.chat)||cid(chat.getAttribute('href')),at:Date.now(),point:event,pathAt:location.pathname,clickSeen:false};}
    else{
      const kind=clean(action.dataset.ng123Action||action.dataset.ng113Actions)||(/project/.test(action.className)?'project':'chat'),id=clean(action.dataset.ng123Id||action.dataset.ng113Id),menu=document.getElementById('ng123-action-menu');
      gesture={type:'action',kind,id,wasOpen:!!menu&&menu.dataset.kind===kind&&menu.dataset.id===id,at:Date.now(),point:event,pathAt:location.pathname,clickSeen:false};
    }
    armClear();
  },true);
  document.addEventListener('click',event=>{
    if(!gesture)return;const target=event.target instanceof Element?event.target:null;
    if(gesture.type==='chat'&&target?.closest('#ng8-pins .ng96-chat-entry>a[data-chat]'))gesture.clickSeen=true;
    if(gesture.type==='action'&&target?.closest('#ng8-pins .ng113-native-actions'))gesture.clickSeen=true;
    setTimeout(clear,120);
  },true);
  document.addEventListener('pointerup',event=>{
    const g=gesture;if(!g||event.button!==0)return;if(dist(g.point,event)>10||Date.now()-g.at>1300){clear();return;}
    setTimeout(()=>fallback(g),90);setTimeout(clear,220);
  },true);
  document.addEventListener('pointercancel',clear,true);window.addEventListener('blur',clear);window.addEventListener('pagehide',clear);
  };
  if(window.__NIAKGPT_HOST_HYDRATED_100__)init();
  else window.addEventListener('niakgpt:host-hydrated-v100',init,{once:true});
})();
