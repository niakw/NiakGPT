(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_ACTIONS_GUARD_120__)return;
  window.__NIAKGPT_NATIVE_ACTIONS_GUARD_120__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  let cache={projects:[],chats:[]},session=null,observer=null,closeTimer=0,epoch=0,focusLease=null,lastIntentAt=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
  const projectName=id=>clean(cache.projects?.find(p=>p?.id===id)?.name)||'';

  function nativeProjectRow(projectId){
    const link=[...document.querySelectorAll(`a[href*="/g/${CSS.escape(projectId)}/"]`)].find(outsideOwn);
    if(link)return link.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||link;
    const name=norm(projectName(projectId));if(!name)return null;
    for(const el of document.querySelectorAll('nav a,nav button,[data-testid*="sidebar" i] a,[data-testid*="sidebar" i] button'))if(outsideOwn(el)&&norm(el.textContent||el.getAttribute('aria-label'))===name)return el.closest('[data-sidebar-item="true"],li')||el;
    return null;
  }
  function nativeChatRow(chatId){
    const link=[...document.querySelectorAll(`a[href*="/c/${CSS.escape(chatId)}"]`)].find(outsideOwn);
    return link?.closest('[data-sidebar-item="true"],li')||link||null;
  }
  function currentConversationTrigger(){
    const root=document.querySelector('main')||document.body;
    return [...root.querySelectorAll('button,[role="button"]')].find(b=>outsideOwn(b)&&/more|options|menu|davantage|plus|actions?/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||null;
  }
  function menuButton(row){
    if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);
    return buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''}`))||buttons.find(b=>b.getAttribute('aria-haspopup')==='menu')||null;
  }
  function fireHover(el){for(const type of ['pointerover','mouseover','mouseenter'])try{el.dispatchEvent(new MouseEvent(type,{bubbles:true,clientX:2,clientY:2}));}catch{}}
  function stage(row){
    const staged=[];for(let node=row;node&&node!==document.body;node=node.parentElement){
      const s=getComputedStyle(node),hidden=node.matches?.('[data-ng112-native-projects="1"]')||s.display==='none'||s.visibility==='hidden';
      if(hidden||node===row){node.classList.add('ng120-actions-stage');staged.push(node);}
      if(node.matches?.('[data-testid*="sidebar" i],aside,nav')&&node!==row)break;
    }
    return()=>staged.forEach(el=>el.classList.remove('ng120-actions-stage'));
  }
  function menus(){return[...document.querySelectorAll(MENU_SEL)].filter(el=>outsideOwn(el)&&visible(el));}
  function controlledMenu(trigger){
    const ids=clean(trigger?.getAttribute?.('aria-controls')).split(/\s+/).filter(Boolean);
    for(const id of ids){const el=document.getElementById(id);if(outsideOwn(el)&&visible(el))return el;}return null;
  }
  function promoteNative(menu){
    if(!(menu instanceof HTMLElement))return false;
    try{
      if(typeof menu.showPopover!=='function')return false;
      if(!menu.hasAttribute('popover')){menu.setAttribute('popover','manual');menu.dataset.ng120PopoverOwned='1';}
      if(!menu.matches(':popover-open'))menu.showPopover();
      if(!menu.matches(':popover-open'))return false;
      menu.dataset.ng113TopLayer='1';menu.dataset.ng113Floated='1';return true;
    }catch{return false;}
  }
  function place(menu,index=0){
    if(!(menu instanceof HTMLElement)||!session?.source?.isConnected||!menu.isConnected)return false;
    const topLayer=promoteNative(menu);
    const sr=session.source.getBoundingClientRect(),side=session.source.closest('[data-testid*="sidebar" i],aside,nav')||document.querySelector('[data-testid*="sidebar" i],aside,nav'),rr=side?.getBoundingClientRect(),w=Math.min(330,Math.max(220,menu.getBoundingClientRect().width||250)),h=Math.min(innerHeight-16,Math.max(80,menu.getBoundingClientRect().height||250));
    let left=Math.max((rr?.right||sr.right)+8,8)+index*(w+8);if(left+w>innerWidth-8)left=Math.max(8,(rr?.right||sr.right)-w-8-index*(w+8));
    const top=Math.min(Math.max(8,sr.top-4+index*10),Math.max(8,innerHeight-h-8));
    menu.classList.add('ng120-native-menu');menu.style.setProperty('--ng120-menu-left',`${left}px`);menu.style.setProperty('--ng120-menu-top',`${top}px`);menu.dataset.ng120Native='1';session.menus.add(menu);return topLayer;
  }
  function queuePlace(menu,index=0,token=session?.token){
    for(const delay of [0,16,48,100,180,320,520])setTimeout(()=>{if(session?.token===token&&menu?.isConnected)place(menu,index);},delay);
  }
  function cleanupMenu(menu){
    if(!(menu instanceof HTMLElement))return;
    try{if(menu.matches?.(':popover-open'))menu.hidePopover();}catch{}
    if(menu.dataset.ng120PopoverOwned==='1'){menu.removeAttribute('popover');delete menu.dataset.ng120PopoverOwned;}
    menu.classList.remove('ng120-native-menu');menu.style.removeProperty('--ng120-menu-left');menu.style.removeProperty('--ng120-menu-top');delete menu.dataset.ng120Native;delete menu.dataset.ng113TopLayer;delete menu.dataset.ng113Floated;
  }
  function stopObserver(){observer?.disconnect();observer=null;clearTimeout(closeTimer);closeTimer=0;}
  function finishSession(){
    stopObserver();if(!session)return;for(const menu of session.menus)cleanupMenu(menu);session.restore?.();session=null;
  }
  async function closeSession(){
    if(!session)return;const old=session,token=++epoch;
    for(const menu of old.menus)try{menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
    try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));}catch{}
    await sleep(45);if(token!==epoch)return;
    if([...old.menus].some(visible))try{old.trigger?.click();}catch{}
    await sleep(35);if(session===old)finishSession();
  }
  function watchMenus(token){
    observer?.disconnect();observer=new MutationObserver(()=>{
      if(!session||session.token!==token)return;const all=menus().filter(m=>!session.baseline.has(m));all.forEach((m,i)=>queuePlace(m,i,token));
      clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(session?.token===token&&session.menus.size&&![...session.menus].some(visible))finishSession();},850);
    });observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','aria-hidden','data-state']});
  }
  async function openNative(source,kind,id){
    if(session?.source===source&&[...session.menus].some(visible)){await closeSession();return true;}
    if(session)await closeSession();const token=++epoch;
    let row=kind==='project'?nativeProjectRow(id):nativeChatRow(id),restore=()=>{};let trigger=null;
    if(row){restore=stage(row);fireHover(row);await sleep(70);trigger=menuButton(row);if(!trigger){fireHover(row);await sleep(120);trigger=menuButton(row);}}
    if(!trigger&&kind==='chat'&&id===currentCid())trigger=currentConversationTrigger();
    if(!trigger){restore();window.__NIAKGPT_DIAGNOSTICS__?.set(`actions-${kind}`,'ERREUR · déclencheur natif introuvable');return false;}
    const baseline=new Set(menus());session={token,source,trigger,restore,baseline,menus:new Set()};watchMenus(token);
    trigger.click();
    for(const delay of [35,80,160,300,520]){
      await sleep(delay);if(!session||session.token!==token)return false;
      const exact=controlledMenu(trigger),fresh=exact||menus().find(m=>!baseline.has(m));if(fresh){place(fresh,0);queuePlace(fresh,0,token);restore();session.restore=()=>{};window.__NIAKGPT_DIAGNOSTICS__?.set(`actions-${kind}`,'OK · menu natif');return true;}
    }
    finishSession();window.__NIAKGPT_DIAGNOSTICS__?.set(`actions-${kind}`,'ERREUR · menu natif non ouvert');return false;
  }
  function managedAction(el){return el instanceof Element?el.closest('#ng8-pins .ng113-native-actions'):null;}
  function armFocusLease(el){if(!(el instanceof HTMLElement)||session)return;focusLease={el,until:Date.now()+1300};}
  function releaseOrRestoreFocus(el){
    const lease=focusLease;if(!lease||lease.el!==el||session||Date.now()>lease.until){if(lease?.el===el)focusLease=null;return;}
    if(Date.now()-lastIntentAt<180){focusLease=null;return;}
    setTimeout(()=>{
      if(focusLease!==lease||session||Date.now()>lease.until||Date.now()-lastIntentAt<180||!el.isConnected)return;
      if(document.activeElement!==el)try{el.focus({preventScroll:true});}catch{el.focus();}
    },0);
  }

  document.addEventListener('click',event=>{
    if(event.button!==0)return;const target=event.target instanceof Element?event.target:null,button=target?.closest('#ng8-pins .ng113-native-actions');if(!(button instanceof HTMLButtonElement))return;
    const kind=button.dataset.ng113Actions,id=clean(button.dataset.ng113Id);if(!id||!['project','chat'].includes(kind))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();focusLease=null;
    button.setAttribute('aria-busy','true');openNative(button,kind,id).catch(()=>false).finally(()=>button.removeAttribute('aria-busy'));
  },true);
  document.addEventListener('pointerdown',event=>{
    lastIntentAt=Date.now();if(!session)return;const t=event.target instanceof Element?event.target:null;if(t?.closest('#ng8-pins .ng113-native-actions')||[...session.menus].some(m=>m.contains(t)))return;setTimeout(()=>{if(session&&![...session.menus].some(visible))finishSession();},80);
  },true);
  document.addEventListener('keydown',event=>{if(['Tab','Enter',' ','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))lastIntentAt=Date.now();},true);
  document.addEventListener('focusin',event=>{const action=managedAction(event.target);if(action)armFocusLease(action);else if(focusLease&&Date.now()-lastIntentAt<180)focusLease=null;},true);
  document.addEventListener('focusout',event=>{const action=managedAction(event.target);if(action)releaseOrRestoreFocus(action);},true);
  window.addEventListener('resize',()=>{if(session)[...session.menus].filter(visible).forEach((m,i)=>queuePlace(m,i,session.token));});
  window.addEventListener('popstate',()=>{focusLease=null;closeSession();});if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{focusLease=null;closeSession();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){focusLease=null;closeSession();}});
  window.addEventListener('pagehide',()=>{focusLease=null;finishSession();},{once:true});
  try{chrome.storage.local.get(CACHE_KEY).then(g=>{cache=g?.[CACHE_KEY]||cache;});chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c[CACHE_KEY])cache=c[CACHE_KEY].newValue||cache;});}catch{}
})();