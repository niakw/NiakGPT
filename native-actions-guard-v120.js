(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_ACTIONS_GUARD_120__)return;
  window.__NIAKGPT_NATIVE_ACTIONS_GUARD_120__=true;

  const FLOAT='.ng113-native-menu-floating';
  const FALLBACK='#ng113-actions-fallback';
  let observer=null,focusLease=null,lastIntentAt=0;

  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
  const actionOf=target=>target instanceof Element?target.closest('#ng8-pins .ng113-native-actions'):null;
  const openMenus=()=>[...document.querySelectorAll(FLOAT)].filter(visible);

  function closeNativeMenus(){
    const menus=openMenus();
    if(!menus.length)return false;
    for(const menu of menus){
      try{menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
      try{if(menu.matches?.(':popover-open'))menu.hidePopover();}catch{}
    }
    try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
    return true;
  }
  function removeFallback(root=document){
    const menu=root.querySelector?.(FALLBACK);if(!menu)return false;menu.remove();window.__NIAKGPT_DIAGNOSTICS__?.set('actions-chat','ERREUR · menu natif indisponible · fallback custom refusé');return true;
  }
  function enforceFocus(lease){
    if(focusLease!==lease||Date.now()>lease.until||Date.now()-lastIntentAt<180||!lease.el.isConnected||openMenus().length)return;
    if(document.activeElement!==lease.el)try{lease.el.focus({preventScroll:true});}catch{lease.el.focus();}
  }
  function armFocus(el){
    if(!(el instanceof HTMLElement)||openMenus().length)return;
    const lease={el,until:Date.now()+1200};focusLease=lease;
    for(const delay of [0,30,90,180,360,650,1000])setTimeout(()=>enforceFocus(lease),delay);
  }

  // Capture only the "second click closes" case. First click deliberately falls through
  // to native-actions-v113, the cross-engine proven owner of native row staging + Popover promotion.
  document.addEventListener('click',event=>{
    if(event.button!==0)return;const button=actionOf(event.target);if(!(button instanceof HTMLButtonElement))return;
    if(openMenus().length){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();closeNativeMenus();button.removeAttribute('aria-busy');setTimeout(()=>armFocus(button),40);}
  },true);

  document.addEventListener('pointerdown',event=>{lastIntentAt=Date.now();const target=event.target instanceof Element?event.target:null;if(target&&!actionOf(target)&&!target.closest(FLOAT))focusLease=null;},true);
  document.addEventListener('keydown',event=>{if(['Tab','Enter',' ','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){lastIntentAt=Date.now();focusLease=null;}},true);
  document.addEventListener('focusin',event=>{const action=actionOf(event.target);if(action&&!openMenus().length)armFocus(action);},true);
  document.addEventListener('focusout',event=>{const action=actionOf(event.target);if(action&&!openMenus().length)armFocus(action);},true);

  observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes){
      if(!(node instanceof Element))continue;
      if(node.matches?.(FALLBACK)){node.remove();continue;}
      const fallback=node.querySelector?.(FALLBACK);if(fallback)fallback.remove();
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  removeFallback();

  window.addEventListener('popstate',()=>{focusLease=null;closeNativeMenus();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{focusLease=null;closeNativeMenus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){focusLease=null;closeNativeMenus();}});
  window.addEventListener('pagehide',()=>{observer?.disconnect();focusLease=null;closeNativeMenus();},{once:true});
})();