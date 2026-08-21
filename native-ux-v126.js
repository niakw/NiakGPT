(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_UX_126__)return;
  window.__NIAKGPT_NATIVE_UX_126__=true;

  // 0.9.71 added two late repair layers. They were useful in synthetic labs but
  // could race the real sidebar owner and the old project-settings fallback could
  // navigate away instead of opening ChatGPT's settings popup. v126 replaces both.
  window.__NIAKGPT_NATIVE_UX_125__=true;
  window.__NIAKGPT_SIDEBAR_ROUTE_PLACEMENT_125__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption,#ng123-action-menu,#ng123-rename-dialog,#ng126-project-settings-error';
  const MENU_SEL='[role="menu"],[data-radix-menu-content],[data-slot*="menu" i]';
  const POPUP_SEL='[role="dialog"],[aria-modal="true"],[data-radix-dialog-content],[data-slot*="dialog" i]';
  const SETTINGS_RX=/^(?:param[eè]tres?(?:\s+du)?\s+projet|project\s+settings|edit\s+project|modifier\s+(?:le\s+)?projet|personnaliser\s+(?:le\s+)?projet|customi[sz]e\s+project|settings)(?:\b|…|\.\.\.)/i;
  const BROWSE_RX=/^(?:parcourir|browse|choisir\s+(?:des?\s+)?(?:fichiers?|images?)|choose\s+(?:files?|images?)|t[eé]l[eé]verser\s+depuis\s+(?:l['’]ordinateur|mon\s+ordinateur|cet\s+appareil)|upload\s+from\s+(?:computer|device)|from\s+(?:computer|device))(?:\b|…|\.\.\.)/i;
  let observer=null,placementEpoch=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.getClientRects().length>0;};
  const labelOf=el=>clean(`${el?.getAttribute?.('aria-label')||''} ${el?.getAttribute?.('title')||''} ${el?.textContent||''}`);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function customProjectMenu(menu){return menu instanceof HTMLElement&&menu.id==='ng123-action-menu'&&menu.dataset.kind==='project';}
  function ensureProjectSettings(menu){
    if(!customProjectMenu(menu))return null;
    const id=normalizePid(menu.dataset.id||'');if(!id)return null;
    let button=menu.querySelector('[data-ng126-project-settings],[data-ng125-project-settings]');
    if(!(button instanceof HTMLButtonElement)){
      button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;
      const rename=[...menu.querySelectorAll(':scope>button')].find(b=>/^renommer|^rename/i.test(clean(b.textContent)));
      rename?.insertAdjacentElement('afterend',button);if(!button.isConnected)menu.appendChild(button);
    }
    button.dataset.ng126ProjectSettings='1';button.textContent='Paramètres du projet';button.setAttribute('aria-label','Paramètres du projet');
    return button;
  }
  function scanProjectMenus(root=document){
    if(root instanceof Element&&customProjectMenu(root))ensureProjectSettings(root);
    for(const menu of root.querySelectorAll?.('#ng123-action-menu[data-kind="project"]')||[])ensureProjectSettings(menu);
  }

  function nativeRows(projectId){
    projectId=normalizePid(projectId);if(!projectId)return[];
    const anchors=[...document.querySelectorAll('a[href]')].filter(a=>outsideOwn(a)&&pidFromHref(a.getAttribute('href'))===projectId);
    const rows=[];
    for(const a of anchors){
      const row=a.closest('[data-sidebar-item="true"],[data-testid*="project" i],[class*="project-unfurl-row"],li')||a.parentElement||a;
      if(row&&!rows.includes(row))rows.push(row);
    }
    return rows.sort((a,b)=>{
      const score=row=>{let n=0;if(row.querySelector('button,[role="button"]'))n+=20;if(row.matches('[data-sidebar-item="true"],li'))n+=8;if(row.querySelector(`a[href*="${projectId}"]`))n+=5;return n;};
      return score(b)-score(a);
    });
  }
  function nativeMenuButton(row){
    if(!row)return null;
    const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);
    return buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis|overflow/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''}`))||buttons.find(b=>b.getAttribute('aria-haspopup')==='menu')||buttons.at(-1)||null;
  }
  function stageNativeRow(row){
    const staged=[];let node=row;
    while(node&&node!==document.body){
      const s=getComputedStyle(node),hidden=s.display==='none'||s.visibility==='hidden'||s.opacity==='0'||node.getAttribute?.('aria-hidden')==='true'||node.getAttribute?.('data-ng112-native-projects')==='1';
      if(hidden){node.classList.add('ng126-native-stage');staged.push(node);}
      node=node.parentElement;
    }
    if(row&&!staged.includes(row)){row.classList.add('ng126-native-stage-leaf');staged.push(row);}
    return()=>staged.forEach(el=>el.classList.remove('ng126-native-stage','ng126-native-stage-leaf'));
  }
  async function waitForNewVisible(selector,baseline,timeout=1700){
    const started=performance.now();
    while(performance.now()-started<timeout){
      const found=[...document.querySelectorAll(selector)].find(el=>!baseline.has(el)&&outsideOwn(el)&&visible(el));
      if(found)return found;await sleep(45);
    }
    return null;
  }
  function closeCustomMenu(){
    document.getElementById('ng123-action-menu')?.remove();
    document.querySelectorAll('#ng8-pins .ng113-native-actions[aria-expanded="true"]').forEach(b=>{b.setAttribute('aria-expanded','false');b.removeAttribute('aria-controls');b.classList.remove('ng123-action-open');});
  }
  function feedback(message){
    document.getElementById('ng126-project-settings-error')?.remove();const box=document.createElement('div');box.id='ng126-project-settings-error';box.setAttribute('role','status');box.textContent=message;document.body.appendChild(box);setTimeout(()=>box.remove(),4200);
  }
  async function openProjectSettings(projectId){
    projectId=normalizePid(projectId);if(!projectId)return false;
    closeCustomMenu();
    const rows=nativeRows(projectId);
    for(const row of rows){
      const restore=stageNativeRow(row);
      try{
        row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));row.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse'}));
        await sleep(70);
        const trigger=nativeMenuButton(row);if(!trigger)continue;
        const baselineMenus=new Set(document.querySelectorAll(MENU_SEL));
        trigger.click();
        const menu=await waitForNewVisible(MENU_SEL,baselineMenus,1900);if(!menu)continue;
        const item=[...menu.querySelectorAll('[role="menuitem"],button,a,[role="button"]')].find(el=>SETTINGS_RX.test(labelOf(el)));
        if(!item){try{trigger.click();}catch{}continue;}
        const baselinePopups=new Set(document.querySelectorAll(POPUP_SEL));
        item.click();
        const popup=await waitForNewVisible(POPUP_SEL,baselinePopups,2400);
        if(popup){
          popup.dataset.ng126ProjectSettings='1';
          window.__NIAKGPT_DIAGNOSTICS__?.set('project-settings-126',`OK · popup Paramètres du projet · ${projectId}`);
          return true;
        }
      }catch(error){window.__NIAKGPT_DIAGNOSTICS__?.set('project-settings-126',`ERREUR · ${String(error?.message||error).slice(0,100)}`);}finally{restore();}
    }
    // Important: never redirect to the Project page. This command means the native
    // settings popup, or a clear failure on the current page.
    feedback('Paramètres du projet indisponibles sur cette vue · aucune redirection effectuée.');
    window.__NIAKGPT_DIAGNOSTICS__?.set('project-settings-126',`INDISPONIBLE · popup native introuvable · ${projectId}`);
    return false;
  }
  window.__NIAKGPT_OPEN_PROJECT_SETTINGS_126__=openProjectSettings;

  function modifierChatAnchor(target){return target?.closest?.('#ng8-pins .ng96-chat-entry>a[data-chat]')||null;}
  function composerVisible(){
    const ed=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');if(!(ed instanceof HTMLElement)||!visible(ed))return false;
    return ![...document.querySelectorAll('[role="dialog"][aria-modal="true"],[aria-modal="true"]')].some(el=>outsideOwn(el)&&visible(el));
  }
  function browseControl(target){
    const control=target?.closest?.('[role="menuitem"],button,[role="button"],label,a');if(!control||!outsideOwn(control)||!composerVisible()||!BROWSE_RX.test(labelOf(control)))return null;
    const menu=control.closest(MENU_SEL+', [popover], [data-state="open"]');return menu||/parcourir|browse|upload|t[eé]l[eé]verser|choisir|choose/i.test(labelOf(control))?control:null;
  }
  function fileInputCandidate(){
    const inputs=[...document.querySelectorAll('input[type="file"]')].filter(i=>!i.disabled&&!i.closest(OWN));if(!inputs.length)return null;
    const composer=document.querySelector('[data-type="unified-composer"],form:has(#prompt-textarea),form:has([data-testid="prompt-textarea"])');
    const score=i=>(composer?.contains(i)?100:0)+(/image|video|pdf|text|application/i.test(i.accept||'')?20:0)+(i.multiple?5:0);
    return inputs.sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function openBrowsePicker(control,event){
    const input=fileInputCandidate();if(!input)return false;
    try{
      // Keep the call synchronous inside the trusted click. This preserves browser
      // user activation; the v125 microtask fallback could miss it on real Chromium.
      input.click();event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      window.__NIAKGPT_DIAGNOSTICS__?.set('file-picker-126','OK · sélecteur fichier déclenché pendant le clic utilisateur');return true;
    }catch{return false;}
  }

  function syncNativeModalState(){
    const modal=[...document.querySelectorAll('[role="dialog"][aria-modal="true"],[aria-modal="true"]')].find(el=>outsideOwn(el)&&visible(el));
    if(modal)document.documentElement.dataset.ng125NativeModal='1';else delete document.documentElement.dataset.ng125NativeModal;
  }
  function requestPlacement(source){document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile',{detail:{source:`native-ux-v126:${source}`}}));}
  function armPlacement(source='route'){
    const token=++placementEpoch;
    for(const delay of [0,70,180,420,900,1800,3200])setTimeout(()=>{if(token===placementEpoch)requestPlacement(source);},delay);
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    const settings=target?.closest?.('#ng123-action-menu[data-kind="project"] [data-ng126-project-settings],#ng123-action-menu[data-kind="project"] [data-ng125-project-settings]');
    if(settings){const menu=settings.closest('#ng123-action-menu'),id=normalizePid(menu?.dataset.id||'');event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openProjectSettings(id);return;}

    const chat=modifierChatAnchor(target);
    if(chat&&event.button===0&&(event.metaKey||event.ctrlKey)){
      // Preserve the browser's actual modified-anchor default instead of emulating it
      // with window.open. Stop extension handlers, but intentionally do NOT preventDefault.
      event.stopImmediatePropagation();return;
    }

    const browse=browseControl(target);if(browse)openBrowsePicker(browse,event);
  },true);
  document.addEventListener('auxclick',event=>{
    const target=event.target instanceof Element?event.target:null,chat=modifierChatAnchor(target);
    if(chat&&event.button===1)event.stopImmediatePropagation();
  },true);

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest?.('#ng8-pins .ng113-native-actions-project'))setTimeout(()=>scanProjectMenus(document),0);
  });
  document.addEventListener('niakgpt:pins-rendered',()=>armPlacement('pins-rendered'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){armPlacement('visible');syncNativeModalState();}});
  window.addEventListener('popstate',()=>armPlacement('popstate'));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>armPlacement('navigation'));
  window.addEventListener('pageshow',()=>armPlacement('pageshow'));

  observer=new MutationObserver(records=>{
    let sidebarChanged=false,modalChanged=false;
    for(const record of records){
      for(const node of [...record.addedNodes,...record.removedNodes]){
        if(!(node instanceof Element))continue;
        if(node.isConnected)scanProjectMenus(node);
        if(node.matches?.('#ng8-pins,[data-testid*="sidebar" i],aside,nav,a[href="/projects"],a[href*="/g/g-p-"]')||node.querySelector?.('#ng8-pins,a[href="/projects"],a[href*="/g/g-p-"]'))sidebarChanged=true;
        if(node.matches?.('[role="dialog"],[aria-modal="true"]')||node.querySelector?.('[role="dialog"],[aria-modal="true"]'))modalChanged=true;
      }
    }
    if(sidebarChanged)armPlacement('sidebar-remount');if(modalChanged)syncNativeModalState();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
  scanProjectMenus(document);syncNativeModalState();armPlacement('init');
})();