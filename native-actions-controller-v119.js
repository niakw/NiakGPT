(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_ACTIONS_CONTROLLER_119__)return;
  window.__NIAKGPT_NATIVE_ACTIONS_CONTROLLER_119__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  let cache={projects:[],chats:[]},epoch=0,opening=null,session=null;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pid=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const projectName=id=>clean(cache.projects?.find(p=>normalizePid(p?.id)===normalizePid(id))?.name)||'';
  const keyFor=(kind,id)=>`${kind}:${kind==='project'?normalizePid(id):id}`;
  const isVisible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';};

  function menuButton(row){
    if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);
    return buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''} ${b.getAttribute('data-slot')||''}`))
      ||buttons.find(b=>b.getAttribute('aria-haspopup')==='menu')
      ||(buttons.filter(b=>!clean(b.textContent)&&!!b.querySelector('svg')).length===1?buttons.filter(b=>!clean(b.textContent)&&!!b.querySelector('svg'))[0]:null);
  }
  function directProjectRow(projectId,name){
    projectId=normalizePid(projectId);
    const links=[...document.querySelectorAll('a[href*="/g/g-p-"]')].filter(a=>outsideOwn(a)&&pid(a.getAttribute('href'))===projectId);
    if(links.length)return links[0].closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0];
    const target=norm(name);if(!target)return null;
    for(const el of document.querySelectorAll('nav a,nav button,nav [role="link"],nav [role="button"],aside a,aside button,[data-testid*="sidebar" i] a,[data-testid*="sidebar" i] button')){
      if(!outsideOwn(el))continue;if(norm(el.textContent||el.getAttribute('aria-label'))===target)return el.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||el;
    }
    return null;
  }
  function directChatRow(chatId){
    const links=[...document.querySelectorAll(`a[href*="/c/${CSS.escape(chatId)}"]`)].filter(outsideOwn);
    return links[0]?.closest('[data-sidebar-item="true"],li')||links[0]||null;
  }
  function currentConversationMenuButton(){
    const root=document.querySelector('main,[role="main"]')||document.body;
    return [...root.querySelectorAll('button,[role="button"]')].find(b=>outsideOwn(b)&&/more|options|menu|davantage|plus|actions?/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||null;
  }
  function stage(node){
    const staged=[];let current=node;
    while(current&&current!==document.body){
      if(current.getAttribute?.('data-ng112-native-projects')==='1'||getComputedStyle(current).display==='none'){
        current.classList.add('ng113-actions-staging');staged.push(current);
      }
      current=current.parentElement;
    }
    if(node&&!staged.includes(node)){node.classList.add('ng113-actions-staging-leaf');staged.push(node);}
    return()=>{for(const el of staged)el.classList.remove('ng113-actions-staging','ng113-actions-staging-leaf');};
  }
  function showMoreButton(scope){
    return [...scope.querySelectorAll('button,[role="button"],a')].find(el=>/^(afficher|voir) plus$|^show more$/i.test(clean(el.textContent||el.getAttribute('aria-label'))))||null;
  }
  async function resolveNativeProjectRow(projectId,name){
    projectId=normalizePid(projectId);let row=directProjectRow(projectId,name);if(row)return row;
    const surfaces=[...document.querySelectorAll('[data-ng112-native-projects="1"]')].filter(outsideOwn);
    if(!surfaces.length)return null;
    const restores=surfaces.map(stage);
    try{
      for(let attempt=0;attempt<7;attempt++){
        row=directProjectRow(projectId,name);if(row)return row;
        const more=surfaces.map(showMoreButton).find(Boolean);if(!more)break;
        more.click();await sleep(110+attempt*35);
      }
      return directProjectRow(projectId,name);
    }finally{for(const restore of restores.reverse())restore();}
  }
  function visibleMenus(){return [...document.querySelectorAll(MENU_SEL)].filter(el=>outsideOwn(el)&&isVisible(el));}
  function sidebarRight(source){
    const shells=[];let node=source;
    while(node&&node!==document.body&&node!==document.documentElement){if(node.matches?.('[data-testid*="sidebar" i],aside,nav'))shells.push(node);node=node.parentElement;}
    if(!shells.length)for(const el of document.querySelectorAll('[data-testid*="sidebar" i],aside,nav'))if(!el.closest('main,[role="main"]'))shells.push(el);
    let right=Math.max(0,source?.getBoundingClientRect?.().right||0);
    for(const shell of shells){const r=shell.getBoundingClientRect?.();if(!r||r.width<=80||r.left>=innerWidth*.5)continue;right=Math.max(right,r.right);}
    return right;
  }
  function snapshotSource(source){
    if(!(source instanceof HTMLElement))return null;const r=source.getBoundingClientRect?.();if(!r)return null;
    return{rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},sidebarRight:sidebarRight(source)};
  }
  function sourceGeometry(){
    if(!session)return null;const live=session.source instanceof HTMLElement&&session.source.isConnected;
    if(live){const snap=snapshotSource(session.source);if(snap){session.geometry=snap;return snap;}}
    return session.geometry||null;
  }
  function promote(menu,index=0){
    if(!(menu instanceof HTMLElement)||!session||session.baseline.has(menu))return false;
    session.menus.add(menu);
    try{
      if(typeof menu.showPopover==='function'&&!menu.matches(':popover-open')){
        if(!menu.hasAttribute('popover')){menu.setAttribute('popover','manual');menu.dataset.ng119PopoverOwned='1';}
        menu.showPopover();
      }
    }catch{}
    const geometry=sourceGeometry(),sr=geometry?.rect;if(!sr)return false;
    const raw=menu.getBoundingClientRect(),width=Math.min(320,Math.max(220,raw.width||240)),height=Math.min(innerHeight-16,Math.max(80,raw.height||260));
    const base=Math.max(sr.right,geometry?.sidebarRight||0)+8,left=Math.min(Math.max(8,innerWidth-width-8),Math.max(8,base+index*(width+8))),top=Math.min(Math.max(8,sr.top-4+index*10),Math.max(8,innerHeight-height-8));
    menu.classList.add('ng113-native-menu-floating');menu.style.setProperty('--ng113-menu-left',`${left}px`);menu.style.setProperty('--ng113-menu-top',`${top}px`);menu.dataset.ng113Floated='1';menu.dataset.ng113TopLayer=menu.matches?.(':popover-open')?'1':'0';menu.dataset.ng119Owned='1';
    return true;
  }
  function claimControlled(trigger){
    if(!session)return false;let found=false;
    for(const id of clean(trigger?.getAttribute?.('aria-controls')).split(/\s+/).filter(Boolean)){
      const menu=document.getElementById(id);if(menu&&outsideOwn(menu)){session.menus.add(menu);promote(menu,session.menus.size-1);found=true;}
    }
    return found;
  }
  function claimNewMenus(){
    if(!session)return;
    for(const menu of visibleMenus())if(!session.baseline.has(menu)&&!session.menus.has(menu))promote(menu,session.menus.size);
    [...session.menus].forEach((menu,index)=>{if(menu.isConnected&&isVisible(menu))promote(menu,index);});
  }
  function cleanupMenu(menu){
    if(!(menu instanceof HTMLElement))return;
    try{if(menu.dataset.ng119PopoverOwned==='1'&&menu.matches?.(':popover-open'))menu.hidePopover();}catch{}
    if(menu.dataset.ng119PopoverOwned==='1')menu.removeAttribute('popover');
    menu.classList.remove('ng113-native-menu-floating');
    menu.style.removeProperty('--ng113-menu-left');menu.style.removeProperty('--ng113-menu-top');
    delete menu.dataset.ng113Floated;delete menu.dataset.ng113TopLayer;delete menu.dataset.ng113FloatIndex;delete menu.dataset.ng119Owned;delete menu.dataset.ng119PopoverOwned;
  }
  function closeSession({toggleNative=true}={}){
    const s=session;if(!s)return false;session=null;s.observer?.disconnect();clearTimeout(s.timer);
    const hasOpen=[...s.menus].some(m=>m.isConnected&&isVisible(m));
    if(toggleNative&&hasOpen&&s.trigger?.isConnected){try{s.trigger.click();}catch{}}
    for(const menu of s.menus)cleanupMenu(menu);
    s.source?.removeAttribute('aria-expanded');s.source?.removeAttribute('aria-busy');
    window.__NIAKGPT_DIAGNOSTICS__?.set('actions-119','PRÊT · menu natif fermé');return true;
  }
  function armSession(key,source,trigger){
    closeSession({toggleNative:true});
    const baseline=new Set(visibleMenus()),s={key,source,trigger,geometry:snapshotSource(source),baseline,menus:new Set(),observer:null,timer:0};session=s;
    s.observer=new MutationObserver(()=>{if(session===s){claimControlled(trigger);claimNewMenus();}});s.observer.observe(document.body,{childList:true,subtree:true});
    return s;
  }
  async function openViaTrigger(kind,id,source,trigger,token){
    // Source button may be replaced by a sidebar reconcile after the user's click. The native
    // trigger/menu session remains valid, so continue from the captured geometry instead of
    // cancelling a real menu that has already opened.
    if(token!==epoch||!trigger?.isConnected)return false;
    const s=armSession(keyFor(kind,id),source,trigger);if(source?.isConnected)source.setAttribute('aria-expanded','true');
    trigger.click();claimControlled(trigger);
    for(const wait of [35,70,120,190,300]){
      await sleep(wait);if(token!==epoch||session!==s)return false;claimControlled(trigger);claimNewMenus();if(s.menus.size&&[...s.menus].some(isVisible))return true;
    }
    closeSession({toggleNative:false});return false;
  }
  async function openProject(source,id,token){
    id=normalizePid(id);const row=await resolveNativeProjectRow(id,projectName(id));if(token!==epoch)return false;
    if(!row){window.__NIAKGPT_DIAGNOSTICS__?.set('actions-project','INDISPONIBLE · ligne native Project non rendue');return false;}
    const restore=stage(row);
    try{
      row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(55);const trigger=menuButton(row);if(!trigger){window.__NIAKGPT_DIAGNOSTICS__?.set('actions-project','INDISPONIBLE · bouton natif Project non rendu');return false;}
      const ok=await openViaTrigger('project',id,source,trigger,token);window.__NIAKGPT_DIAGNOSTICS__?.set('actions-project',ok?'OK · menu ChatGPT natif':'INDISPONIBLE · menu natif Project');return ok;
    }finally{restore();}
  }
  async function openChat(source,id,token){
    let row=directChatRow(id),trigger=null,restore=()=>{};
    if(row){restore=stage(row);row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(55);trigger=menuButton(row);}
    if(!trigger&&id===currentCid()){restore();restore=()=>{};trigger=currentConversationMenuButton();}
    if(token!==epoch){restore();return false;}
    if(!trigger){restore();window.__NIAKGPT_DIAGNOSTICS__?.set('actions-chat','INDISPONIBLE · menu natif non rendu · aucun fallback custom');return false;}
    try{const ok=await openViaTrigger('chat',id,source,trigger,token);window.__NIAKGPT_DIAGNOSTICS__?.set('actions-chat',ok?'OK · menu ChatGPT natif':'INDISPONIBLE · menu natif chat');return ok;}finally{restore();}
  }
  function activate(button,kind,id){
    if(kind==='project')id=normalizePid(id);const key=keyFor(kind,id);
    if(session?.key===key){epoch++;opening=null;closeSession({toggleNative:true});return Promise.resolve(false);}
    if(opening?.key===key){epoch++;opening=null;closeSession({toggleNative:true});button.removeAttribute('aria-busy');window.__NIAKGPT_DIAGNOSTICS__?.set('actions-119','PRÊT · ouverture annulée');return Promise.resolve(false);}
    if(session)closeSession({toggleNative:true});
    const token=++epoch;button.setAttribute('aria-busy','true');const task=Promise.resolve(kind==='project'?openProject(button,id,token):openChat(button,id,token)).catch(error=>{console.warn('[NiakGPT native controller v119]',error);if(token===epoch)closeSession({toggleNative:false});return false;}).finally(()=>{button.removeAttribute('aria-busy');if(opening?.token===token)opening=null;});opening={key,token,promise:task};return task;
  }

  document.addEventListener('click',event=>{
    if(event.button!==0)return;const target=event.target instanceof Element?event.target:null,button=target?.closest('#ng8-pins .ng113-native-actions');if(!(button instanceof HTMLButtonElement))return;
    const kind=button.dataset.ng113Actions,id=clean(button.dataset.ng113Id);if(!id||!['project','chat'].includes(kind))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();activate(button,kind,id);
  },true);
  document.addEventListener('pointerdown',event=>{
    const s=session;if(!s)return;const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.closest('#ng8-pins .ng113-native-actions')||[...s.menus].some(m=>m.contains(target)))return;
    closeSession({toggleNative:true});
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&session){event.preventDefault();const source=session.source;closeSession({toggleNative:true});source?.focus();}},true);
  document.addEventListener('click',event=>{
    const s=session;if(!s)return;const target=event.target instanceof Element?event.target:null;
    if(target?.closest('[role="menuitem"][aria-haspopup="menu"],[data-radix-menu-sub-trigger]')){setTimeout(()=>{if(session===s)claimNewMenus();},0);setTimeout(()=>{if(session===s)claimNewMenus();},90);return;}
    if(target&&[...s.menus].some(m=>m.contains(target)))setTimeout(()=>{if(session===s&&![...s.menus].some(m=>m.isConnected&&isVisible(m)))closeSession({toggleNative:false});},180);
  },false);
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;});chrome.storage.local.get(CACHE_KEY).then(g=>{cache=g?.[CACHE_KEY]||cache;}).catch(()=>{});}catch{}
  window.addEventListener('popstate',()=>{epoch++;opening=null;closeSession({toggleNative:false});});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{epoch++;opening=null;closeSession({toggleNative:false});});
  window.addEventListener('pagehide',()=>{epoch++;opening=null;closeSession({toggleNative:false});});
})();