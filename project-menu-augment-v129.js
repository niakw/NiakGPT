(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__)return;
  window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption,#ng123-action-menu,#ng123-rename-dialog';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  const SETTINGS_RX=/^(?:param[eè]tres?\s+(?:du\s+)?projet|project\s+settings|settings|modifier\s+(?:le\s+)?projet|edit\s+project|customi[sz]e\s+project)(?:\b|…|\.\.\.)/i;
  let cache={projects:[]},observer=null,pendingSettings='';

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pid=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const project=id=>(cache.projects||[]).find(p=>normalizePid(p?.id)===normalizePid(id))||{};

  function exactProjectRow(projectId){
    projectId=normalizePid(projectId);
    const links=[...document.querySelectorAll('a[href]')].filter(a=>outsideOwn(a)&&pid(a.getAttribute('href'))===projectId&&/\/g\/g-p-[^/]+\/project(?:$|[?#])/i.test(a.getAttribute('href')||''));
    return links[0]?.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0]||null;
  }
  function nativeMenuButton(row){
    if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);
    return buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''}`))||buttons.find(b=>b.getAttribute('aria-haspopup')==='menu')||null;
  }
  function stage(row){
    const staged=[];let node=row;
    while(node&&node!==document.body){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||node.getAttribute?.('data-ng112-native-projects')==='1'){node.classList.add('ng129-native-stage');staged.push(node);}node=node.parentElement;}
    if(row&&!staged.includes(row)){row.classList.add('ng129-native-stage-leaf');staged.push(row);}
    return()=>staged.forEach(el=>el.classList.remove('ng129-native-stage','ng129-native-stage-leaf'));
  }
  function closeCustomMenu(){
    document.getElementById('ng123-action-menu')?.remove();
    document.querySelectorAll('#ng8-pins .ng113-native-actions[aria-expanded="true"]').forEach(b=>{b.setAttribute('aria-expanded','false');b.removeAttribute('aria-controls');b.classList.remove('ng123-action-open');});
  }
  function routeProject(projectId){
    const href=`/g/${encodeURIComponent(normalizePid(projectId))}/project`;
    const native=[...document.querySelectorAll('a[href]')].filter(outsideOwn).find(a=>pid(a.getAttribute('href'))===normalizePid(projectId)&&/\/project(?:$|[?#])/.test(a.getAttribute('href')||''));
    if(native instanceof HTMLElement)native.click();else location.assign(href);
  }
  async function openProjectSettings(projectId,attempt=0){
    projectId=normalizePid(projectId);const row=exactProjectRow(projectId);
    if(!row){
      if(attempt===0){pendingSettings=projectId;routeProject(projectId);return false;}
      return false;
    }
    const restore=stage(row),baseline=new Set(document.querySelectorAll(MENU_SEL));
    try{
      row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(55);const trigger=nativeMenuButton(row);if(!trigger)return false;
      trigger.click();let menu=null;
      for(const delay of [35,70,120,210,360]){await sleep(delay);menu=[...document.querySelectorAll(MENU_SEL)].find(m=>!baseline.has(m)&&outsideOwn(m)&&visible(m));if(menu)break;}
      if(!menu)return false;
      const item=[...menu.querySelectorAll('[role="menuitem"],button,a')].find(el=>SETTINGS_RX.test(clean(el.textContent||el.getAttribute('aria-label')||el.title)));
      if(!item){try{trigger.click();}catch{}return false;}
      item.click();pendingSettings='';window.__NIAKGPT_DIAGNOSTICS__?.set('project-settings-129',`OK · personnalisation native · ${projectId}`);return true;
    }catch{return false;}finally{restore();}
  }

  function action(text,handler,marker){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.textContent=text;if(marker)button.dataset[marker]='1';button.addEventListener('click',handler);return button;
  }
  function contextBlock(id){
    const p=project(id),box=document.createElement('div');box.className='ng129-project-context';box.setAttribute('aria-label','Contexte et instructions du Project');
    const desc=document.createElement('span');desc.textContent=clean(p.description)?`Description · ${clean(p.description)}`:'Description · non renseignée';
    const instructions=document.createElement('span');instructions.textContent=clean(p.instructions)?`Instructions · ${clean(p.instructions)}`:'Instructions · non configurées';
    box.append(desc,instructions);return box;
  }
  function augment(menu){
    if(!(menu instanceof HTMLElement)||menu.dataset.kind!=='project'||menu.dataset.ng129Augmented==='1')return;
    const id=normalizePid(menu.dataset.id||'');if(!id)return;menu.dataset.ng129Augmented='1';
    const title=menu.querySelector(':scope>strong');const context=contextBlock(id);title?.insertAdjacentElement('afterend',context);
    const personalize=action('Personnaliser le Project…',async event=>{event.preventDefault();event.stopPropagation();closeCustomMenu();const ok=await openProjectSettings(id);if(!ok&&location.pathname.includes(`/g/${id}/`)){pendingSettings=id;setTimeout(()=>openProjectSettings(id,1),500);}},'ng129Personalize');
    const newChat=action('Nouveau chat dans ce Project',event=>{event.preventDefault();event.stopPropagation();closeCustomMenu();routeProject(id);},'ng129NewChat');
    const first=menu.querySelector(':scope>button');if(first){first.insertAdjacentElement('beforebegin',personalize);personalize.insertAdjacentElement('afterend',newChat);}else menu.append(personalize,newChat);
  }
  function scan(root=document){
    if(root instanceof HTMLElement&&root.matches?.('#ng123-action-menu[data-kind="project"]'))augment(root);
    for(const menu of root.querySelectorAll?.('#ng123-action-menu[data-kind="project"]')||[])augment(menu);
  }
  function retryPendingSettings(){if(!pendingSettings)return;setTimeout(()=>openProjectSettings(pendingSettings,1),420);}

  try{chrome.storage.local.get(CACHE_KEY).then(g=>{cache=g?.[CACHE_KEY]||cache;scan();}).catch(()=>{});chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;});}catch{}
  observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)scan(node);});observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',retryPendingSettings);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',retryPendingSettings);window.addEventListener('pageshow',retryPendingSettings);
  window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});scan();
})();
