(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_ACTIONS_113__)return;
  window.__NIAKGPT_NATIVE_ACTIONS_113__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  const HIDDEN_RX=/^(ng112-native-projects-authoritative|ng111-native-projects-authoritative|ng110-native-projects-authoritative|ng109-native-projects-authoritative|ng8-native-projects-suppressed|ng8-native-project-link-suppressed|ng8-native-project-chat-suppressed)$/;
  let cache={projects:[],chats:[]},box=null,observer=null,boot=null,timer=0,rpcSeq=0,menuObserver=null,submenuObserver=null,menuSource=null,menuArmTimer=0;
  let fallbackOutsideHandler=null,fallbackEscapeHandler=null,actionOpening=null,actionButtonRef=null,actionEpoch=0,menuStrict=false;
  const promotedMenus=new Set(),menuBaseline=new Set(),menuSession=new Set();

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const projectName=id=>clean(cache.projects?.find(p=>p?.id===id)?.name)||'';
  const chatTitle=id=>clean(cache.chats?.find(c=>c?.id===id)?.title)||'Conversation';
  const projectIdForChat=id=>clean(cache.chats?.find(c=>c?.id===id)?.projectId)||'';

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng113a-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);};
      const off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  function nativeProjectRow(projectId,name){
    const links=[...document.querySelectorAll(`a[href*="/g/${CSS.escape(projectId)}/"]`)].filter(outsideOwn);
    if(links.length)return links[0].closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0];
    const target=norm(name);if(!target)return null;
    for(const el of document.querySelectorAll('nav a,nav button,nav [role="link"],nav [role="button"],[data-testid*="sidebar" i] a,[data-testid*="sidebar" i] button')){
      if(!outsideOwn(el))continue;
      if(norm(el.textContent||el.getAttribute('aria-label'))===target)return el.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||el;
    }
    return null;
  }
  function nativeChatRow(chatId){
    const links=[...document.querySelectorAll(`a[href*="/c/${CSS.escape(chatId)}"]`)].filter(outsideOwn);
    return links[0]?.closest('[data-sidebar-item="true"],li')||links[0]||null;
  }
  function currentConversationMenuButton(){
    const root=document.querySelector('main')||document.body;
    const buttons=[...root.querySelectorAll('button,[role="button"]')];
    return buttons.find(b=>/more|options|menu|davantage|plus|actions?/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`)&&!b.closest(OWN))||null;
  }
  function stageHidden(row){
    const staged=[];let node=row;
    while(node&&node!==document.body){
      const hidden=[...(node.classList||[])].some(c=>HIDDEN_RX.test(c))||node.getAttribute?.('data-ng112-native-projects')==='1';
      if(hidden){node.classList.add('ng113-actions-staging');staged.push(node);}node=node.parentElement;
    }
    if(row&&!staged.includes(row)){row.classList.add('ng113-actions-staging-leaf');staged.push(row);}
    return()=>{for(const el of staged)el.classList.remove('ng113-actions-staging','ng113-actions-staging-leaf');};
  }
  function fireHover(el){
    for(const type of ['pointerover','pointerenter','mouseover','mouseenter']){
      try{const C=type.startsWith('pointer')&&typeof PointerEvent==='function'?PointerEvent:MouseEvent;el.dispatchEvent(new C(type,{bubbles:true,clientX:2,clientY:2,pointerType:'mouse'}));}catch{}
    }
  }
  function menuButton(row){
    if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);
    const named=buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''} ${b.getAttribute('data-slot')||''}`));
    if(named)return named;
    const semantic=buttons.find(b=>b.getAttribute('aria-haspopup')==='menu');if(semantic)return semantic;
    const iconOnly=buttons.filter(b=>!clean(b.textContent)&&!!b.querySelector('svg'));
    return iconOnly.length===1?iconOnly[0]:null;
  }
  function visibleMenus(){
    return [...document.querySelectorAll(MENU_SEL)].filter(el=>{
      if(!outsideOwn(el)||!el.isConnected)return false;
      const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';
    });
  }
  function sessionVisibleMenus(){
    const visible=visibleMenus();
    if(!menuStrict)for(const menu of visible)if(!menuBaseline.has(menu))menuSession.add(menu);
    for(const menu of [...menuSession])if(!menu.isConnected)menuSession.delete(menu);
    return visible.filter(menu=>menuSession.has(menu));
  }
  function visibleMenu(){return sessionVisibleMenus()[0]||null;}
  function claimTriggerMenu(trigger){
    const ids=clean(trigger?.getAttribute?.('aria-controls')).split(/\s+/).filter(Boolean);if(!ids.length)return false;
    menuStrict=true;let found=false;
    for(const id of ids){const menu=document.getElementById(id);if(menu&&outsideOwn(menu)){menuSession.add(menu);found=true;}}
    return found;
  }
  function sidebarRight(source){
    const sidebar=source?.closest?.('[data-testid*="sidebar" i],aside,nav')||document.querySelector('[data-testid*="sidebar" i],aside');
    const r=sidebar?.getBoundingClientRect?.();return r&&r.width>80?r.right:Math.max(0,source?.getBoundingClientRect?.().right||0);
  }
  function resetFloatingMenu(menu){
    if(!(menu instanceof HTMLElement))return;
    menu.classList.remove('ng113-native-menu-floating');
    menu.style.removeProperty('--ng113-menu-left');
    menu.style.removeProperty('--ng113-menu-top');
    delete menu.dataset.ng113Floated;
    delete menu.dataset.ng113FloatIndex;
    delete menu.dataset.ng113TopLayer;
  }
  function cleanupPromotedMenus(force=false){
    for(const menu of [...promotedMenus]){
      const s=menu.isConnected?getComputedStyle(menu):null;
      const stale=force||!menu.isConnected||s?.display==='none'||s?.visibility==='hidden';
      if(!stale)continue;
      try{if(menu.matches?.(':popover-open'))menu.hidePopover();}catch{}
      if(menu.dataset.ng113PopoverOwned==='1'){
        menu.removeAttribute('popover');
        delete menu.dataset.ng113PopoverOwned;
      }
      resetFloatingMenu(menu);
      promotedMenus.delete(menu);menuSession.delete(menu);
    }
  }
  function promoteMenu(menu){
    if(!(menu instanceof HTMLElement))return false;
    try{
      if(typeof menu.showPopover!=='function')return false;
      if(!menu.hasAttribute('popover')){
        menu.setAttribute('popover','manual');
        menu.dataset.ng113PopoverOwned='1';
      }
      if(!menu.matches(':popover-open'))menu.showPopover();
      if(!menu.matches(':popover-open'))return false;
      menu.dataset.ng113TopLayer='1';
      promotedMenus.add(menu);menuSession.add(menu);
      return true;
    }catch{return false;}
  }
  function placeFloatingMenu(menu,source,index=0){
    if(!(menu instanceof HTMLElement)||!(source instanceof HTMLElement)||!source.isConnected||menuBaseline.has(menu))return;
    menuSession.add(menu);promoteMenu(menu);
    const sr=source.getBoundingClientRect(),rawWidth=menu.getBoundingClientRect().width||240,width=Math.min(320,Math.max(220,rawWidth)),base=sidebarRight(source)+8,preferredLeft=base+index*(width+8),maxLeft=Math.max(8,innerWidth-width-8),left=Math.min(maxLeft,Math.max(8,preferredLeft));
    const menuHeight=Math.min(innerHeight-16,Math.max(80,menu.getBoundingClientRect().height||260)),top=Math.min(Math.max(8,sr.top-4+index*10),Math.max(8,innerHeight-menuHeight-8));
    menu.classList.add('ng113-native-menu-floating');menu.style.setProperty('--ng113-menu-left',`${left}px`);menu.style.setProperty('--ng113-menu-top',`${top}px`);menu.dataset.ng113Floated='1';menu.dataset.ng113FloatIndex=String(index);
  }
  function stopMenuFloat(){
    clearTimeout(menuArmTimer);menuArmTimer=0;menuObserver?.disconnect();submenuObserver?.disconnect();menuObserver=submenuObserver=null;cleanupPromotedMenus(true);menuSource=null;menuStrict=false;menuBaseline.clear();menuSession.clear();
  }
  function floatVisibleMenus(){
    cleanupPromotedMenus();
    if(!menuSource||!menuSource.isConnected){if(menuSource)stopMenuFloat();return;}
    const menus=sessionVisibleMenus();
    clearTimeout(menuArmTimer);
    if(!menus.length){menuArmTimer=setTimeout(()=>{if(!sessionVisibleMenus().length)stopMenuFloat();},900);return;}
    menus.forEach((menu,index)=>placeFloatingMenu(menu,menuSource,index));
  }
  function menuNodesFrom(node){
    if(!(node instanceof Element))return[];
    const out=[];if(node.matches?.(MENU_SEL))out.push(node);for(const menu of node.querySelectorAll?.(MENU_SEL)||[])out.push(menu);return out;
  }
  function hasMenuMutation(records){
    for(const record of records||[])for(const node of [...(record.addedNodes||[]),...(record.removedNodes||[])])if(menuNodesFrom(node).length)return true;
    return false;
  }
  function queueMenuFloat(){
    if(!menuSource)return;
    for(const delay of [0,32,90,180,360,700])setTimeout(()=>{if(menuSource)floatVisibleMenus();},delay);
  }
  function armSubmenuPromotion(source){
    if(!(source instanceof HTMLElement)||!source.isConnected)return;
    submenuObserver?.disconnect();
    const known=new Set(document.querySelectorAll(MENU_SEL));
    const promoteExact=menu=>{
      if(!(menu instanceof HTMLElement)||known.has(menu)||menuBaseline.has(menu)||!outsideOwn(menu))return false;
      menuSession.add(menu);
      const retry=()=>{if(menu.isConnected&&menuSource?.isConnected)placeFloatingMenu(menu,menuSource,Math.max(1,sessionVisibleMenus().filter(m=>m!==menu).length));};
      for(const delay of [0,16,48,100,200,420,800,1400])setTimeout(retry,delay);
      return true;
    };
    submenuObserver=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes||[])for(const menu of menuNodesFrom(node))if(promoteExact(menu)){submenuObserver?.disconnect();submenuObserver=null;return;}
    });
    submenuObserver.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{submenuObserver?.disconnect();submenuObserver=null;},2400);
  }
  function armMenuFloat(source){
    if(!(source instanceof HTMLElement)||!source.isConnected)return false;stopMenuFloat();menuSource=source;for(const menu of visibleMenus())menuBaseline.add(menu);
    menuObserver=new MutationObserver(records=>{if(hasMenuMutation(records))queueMenuFloat();});menuObserver.observe(document.body,{childList:true,subtree:true});
    queueMenuFloat();return true;
  }
  const actionCurrent=(token,source)=>token===actionEpoch&&!!source?.isConnected;
  async function invokeNativeMenu(row,source,token){
    if(!row||!actionCurrent(token,source)){stopMenuFloat();return false;}const restore=stageHidden(row);
    try{
      fireHover(row);await sleep(90);if(!actionCurrent(token,source)){stopMenuFloat();return false;}
      let b=menuButton(row);if(!b){fireHover(row);await sleep(180);if(!actionCurrent(token,source)){stopMenuFloat();return false;}b=menuButton(row);}if(!b){stopMenuFloat();return false;}
      if(!armMenuFloat(source)||!actionCurrent(token,source)){stopMenuFloat();return false;}
      b.click();claimTriggerMenu(b);queueMenuFloat();await sleep(150);if(!actionCurrent(token,source)){stopMenuFloat();return false;}claimTriggerMenu(b);if(!visibleMenu())await sleep(180);if(!actionCurrent(token,source)){stopMenuFloat();return false;}claimTriggerMenu(b);queueMenuFloat();
      const ok=!!visibleMenu();if(!ok)stopMenuFloat();return ok;
    }finally{restore();}
  }

  function clearFallbackDismiss(){
    if(fallbackOutsideHandler){document.removeEventListener('pointerdown',fallbackOutsideHandler,true);fallbackOutsideHandler=null;}
    if(fallbackEscapeHandler){document.removeEventListener('keydown',fallbackEscapeHandler,true);fallbackEscapeHandler=null;}
  }
  function closeFallback(){
    clearFallbackDismiss();const menu=document.getElementById('ng113-actions-fallback');
    if(!menu){stopMenuFloat();return;}
    try{if(menu.matches?.(':popover-open'))menu.hidePopover();}catch{}
    if(menu.dataset.ng113PopoverOwned==='1')menu.removeAttribute('popover');
    resetFloatingMenu(menu);promotedMenus.delete(menu);menuSession.delete(menu);menu.remove();stopMenuFloat();
  }
  async function fallbackRename(chatId){
    const old=chatTitle(chatId),next=clean(window.prompt('Renommer la conversation',old));if(!next||next===old)return;
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{title:next}});
    if(r.ok)document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));
  }
  async function fallbackMove(chatId,projectId){
    if(!projectId)return;const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{gizmo_id:projectId}});
    if(r.ok){
      try{const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)await bus.update(raw=>({...raw,at:Date.now(),chats:(raw?.chats||[]).map(c=>c?.id===chatId?{...c,projectId}:c)}));}catch{}
      document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));
    }
  }
  function fallbackChatMenu(button,chatId){
    if(!(button instanceof HTMLElement)||!button.isConnected)return;
    closeFallback();armMenuFloat(button);const menu=document.createElement('div');menu.id='ng113-actions-fallback';menu.setAttribute('role','menu');
    const title=document.createElement('strong');title.textContent=chatTitle(chatId);menu.appendChild(title);
    const rename=document.createElement('button');rename.type='button';rename.setAttribute('role','menuitem');rename.textContent='Renommer';rename.addEventListener('click',()=>{closeFallback();fallbackRename(chatId);});menu.appendChild(rename);
    const label=document.createElement('small');label.textContent='Déplacer vers';menu.appendChild(label);
    for(const p of (cache.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly)){
      const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent=p.name||p.id;if(p.id===projectIdForChat(chatId))item.disabled=true;
      item.addEventListener('click',()=>{closeFallback();fallbackMove(chatId,p.id);});menu.appendChild(item);
    }
    document.body.appendChild(menu);placeFloatingMenu(menu,button,0);
    fallbackOutsideHandler=e=>{const target=e.target instanceof Node?e.target:null;if(target&&!menu.contains(target))closeFallback();};
    fallbackEscapeHandler=e=>{if(e.key==='Escape'){e.preventDefault();closeFallback();button.focus();}};
    setTimeout(()=>{if(menu.isConnected){document.addEventListener('pointerdown',fallbackOutsideHandler,true);document.addEventListener('keydown',fallbackEscapeHandler,true);}},0);
  }

  async function openProjectActions(button,projectId,token){
    const ok=await invokeNativeMenu(nativeProjectRow(projectId,projectName(projectId)),button,token);if(!actionCurrent(token,button))return;
    window.__NIAKGPT_DIAGNOSTICS__?.set('actions-project',ok?'OK · menu natif complet':'ERREUR · menu natif Project introuvable');
  }
  async function openChatActions(button,chatId,token){
    let row=nativeChatRow(chatId),ok=await invokeNativeMenu(row,button,token);if(!actionCurrent(token,button))return;
    if(!ok&&chatId===currentCid()){
      const current=currentConversationMenuButton();if(current){if(!armMenuFloat(button)||!actionCurrent(token,button)){stopMenuFloat();return;}current.click();claimTriggerMenu(current);queueMenuFloat();await sleep(150);if(!actionCurrent(token,button)){stopMenuFloat();return;}claimTriggerMenu(current);queueMenuFloat();ok=!!visibleMenu();if(!ok)stopMenuFloat();}
    }
    if(!actionCurrent(token,button))return;if(!ok)fallbackChatMenu(button,chatId);
    window.__NIAKGPT_DIAGNOSTICS__?.set('actions-chat',ok?'OK · menu natif complet':'FALLBACK · actions sûres locales');
  }
  function icon(){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');
    for(const x of [4,10,16]){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',String(x));c.setAttribute('cy','10');c.setAttribute('r','1.45');svg.appendChild(c);}return svg;
  }
  function normalizeButton(button,kind,id){
    if(!(button instanceof HTMLButtonElement))return null;button.type='button';button.classList.add('ng113-native-actions',`ng113-native-actions-${kind}`);button.dataset.ng113Actions=kind;button.dataset.ng113Id=id;if(button!==actionButtonRef)button.removeAttribute('aria-busy');
    const title=kind==='project'?'Actions du Project (menu ChatGPT)':'Actions de la conversation (menu ChatGPT)';button.title=title;button.setAttribute('aria-label',title);return button;
  }
  function actionButton(kind,id){const b=document.createElement('button');normalizeButton(b,kind,id);b.appendChild(icon());return b;}
  function ensureChatEntry(a){
    let entry=a.closest('.ng96-chat-entry');if(entry)return entry;
    entry=document.createElement('div');entry.className='ng96-chat-entry';entry.dataset.chatEntry=a.dataset.chat||cid(a.getAttribute('href'))||'';a.parentElement?.insertBefore(entry,a);entry.appendChild(a);return entry;
  }
  function decorate(){
    timer=0;const pins=document.getElementById('ng8-pins');if(!pins)return;
    pins.querySelectorAll('.ng96-project-open').forEach(button=>button.remove());
    for(const entry of pins.querySelectorAll('.ng96-pin-entry')){
      const a=entry.querySelector(':scope>a[data-ng8-pin]'),id=pid(a?.getAttribute('href'));if(!id)continue;
      let b=entry.querySelector(':scope>.ng113-native-actions-project');if(!b){b=actionButton('project',id);entry.appendChild(b);}else normalizeButton(b,'project',id);
    }
    for(const a of pins.querySelectorAll('.ng96-folder-list a[data-chat]')){
      const id=a.dataset.chat||cid(a.getAttribute('href'));if(!id)continue;const entry=ensureChatEntry(a);entry.dataset.chatEntry=id;
      const nested=a.querySelector(':scope>.ng113-native-actions-chat');if(nested)entry.appendChild(nested);
      let b=entry.querySelector(':scope>.ng113-native-actions-chat');if(!b){b=actionButton('chat',id);entry.appendChild(b);}else normalizeButton(b,'chat',id);
      for(const extra of entry.querySelectorAll(':scope>.ng113-native-actions-chat'))if(extra!==b)extra.remove();
    }
  }
  function schedule(delay=15){clearTimeout(timer);timer=setTimeout(decorate,delay);}
  function bind(){const next=document.getElementById('ng8-pins');if(!next||next===box)return false;observer?.disconnect();box=next;observer=new MutationObserver(()=>schedule(12));observer.observe(box,{childList:true,subtree:true});schedule(0);return true;}
  async function start(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;}catch{}if(bind())return;boot?.disconnect();boot=new MutationObserver(()=>{if(bind()){boot.disconnect();boot=null;}});boot.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>boot?.disconnect(),15000);}
  function discardDetachedAction(){
    if(!actionOpening||actionButtonRef?.isConnected)return false;
    actionEpoch++;actionButtonRef?.removeAttribute('aria-busy');actionButtonRef=null;actionOpening=null;closeFallback();
    return true;
  }
  function runAction(button,kind,id){
    discardDetachedAction();
    if(actionOpening)return actionOpening;
    const token=++actionEpoch;actionButtonRef=button;button.setAttribute('aria-busy','true');
    actionOpening=Promise.resolve(kind==='project'?openProjectActions(button,id,token):openChatActions(button,id,token)).catch(error=>{
      console.warn('[NiakGPT native actions]',error);if(token===actionEpoch)stopMenuFloat();
    }).finally(()=>{
      button.removeAttribute('aria-busy');
      if(token===actionEpoch){actionButtonRef=null;actionOpening=null;}
    });
    return actionOpening;
  }

  document.addEventListener('click',event=>{
    if(event.button!==0)return;const target=event.target instanceof Element?event.target:null,button=target?.closest('#ng8-pins .ng113-native-actions');if(!(button instanceof HTMLButtonElement))return;
    const kind=button.dataset.ng113Actions,id=clean(button.dataset.ng113Id);if(!id||!['project','chat'].includes(kind))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();runAction(button,kind,id);
  },true);
  document.addEventListener('pointerdown',event=>{
    if(!menuSource)return;const target=event.target instanceof Element?event.target:null;
    if(target?.closest('[role="menuitem"][aria-haspopup="menu"],[data-radix-menu-sub-trigger]'))armSubmenuPromotion(menuSource);
    queueMenuFloat();
  },true);
  document.addEventListener('click',event=>{
    if(!menuSource)return;const target=event.target instanceof Element?event.target:null;
    if(target?.closest('[role="menuitem"][aria-haspopup="menu"],[data-radix-menu-sub-trigger]'))armSubmenuPromotion(menuSource);
    queueMenuFloat();
  },true);
  document.addEventListener('keydown',event=>{if(menuSource&&(event.key==='Escape'||event.key==='Enter'||event.key===' ')){const target=event.target instanceof Element?event.target:null;if(target?.closest('[role="menuitem"][aria-haspopup="menu"],[data-radix-menu-sub-trigger]'))armSubmenuPromotion(menuSource);queueMenuFloat();}},true);
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(0);}});}catch{}
  document.addEventListener('niakgpt:folder-rendered',()=>{bind();decorate();});
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();decorate();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();decorate();}});
  window.addEventListener('popstate',()=>{bind();decorate();});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bind();decorate();});
  window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();observer=boot=null;box=null;actionEpoch++;actionButtonRef?.removeAttribute('aria-busy');actionButtonRef=null;actionOpening=null;stopMenuFloat();closeFallback();});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();