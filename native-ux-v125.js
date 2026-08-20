(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_UX_125__)return;
  window.__NIAKGPT_NATIVE_UX_125__=true;

  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption,#ng123-action-menu,#ng123-rename-dialog';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  const SETTINGS_RX=/^(?:param[eè]tres?\s+(?:du\s+)?projet|project\s+settings|settings|modifier\s+(?:le\s+)?projet|edit\s+project|customi[sz]e\s+project)(?:\b|…|\.\.\.)/i;
  const BROWSE_RX=/^(?:parcourir|browse|t[eé]l[eé]verser\s+depuis\s+(?:l['’]ordinateur|mon\s+ordinateur)|upload\s+from\s+(?:computer|device)|choose\s+(?:files?|images?)|choisir\s+(?:des?\s+)?(?:fichiers?|images?))(?:\b|…|\.\.\.)/i;
  let observer=null,routeEpoch=0,lastFileInputClick=-Infinity;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pid=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.pointerEvents!=='none'&&el.getClientRects().length>0;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function nativeSidebar(){
    const box=document.getElementById('ng8-pins');
    return box?.closest('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="conversation-sidebar"]')||[...document.querySelectorAll('aside,nav,[data-testid*="sidebar" i]')].find(el=>!el.closest('main,[role="main"]')&&(el.contains(box)||el.querySelector('a[href="/projects"],a[href*="/g/g-p-"]')))||null;
  }
  function projectSection(side,box){
    if(!side)return null;
    const marked=[...side.querySelectorAll('[data-ng112-native-projects="1"]')].filter(el=>el!==box&&!el.contains(box));
    const rich=marked.find(el=>el.querySelector('a[href*="/g/g-p-"]')||/^(?:projets?|projects?)$/i.test(clean(el.textContent)));
    if(rich)return rich;
    const links=[...side.querySelectorAll('a[href*="/g/g-p-"]')].filter(a=>outsideOwn(a));
    if(!links.length)return null;
    let node=links[0];
    for(let depth=0;depth<7&&node&&node!==side&&node!==document.body;depth++,node=node.parentElement){
      const projectLinks=[...node.querySelectorAll?.('a[href*="/g/g-p-"]')||[]].filter(outsideOwn);
      const genericChats=[...node.querySelectorAll?.('a[href*="/c/"]')||[]].filter(a=>outsideOwn(a)&&!String(a.getAttribute('href')||'').includes('/g/g-p-'));
      if(projectLinks.length>=2&&!genericChats.length)return node;
    }
    return links[0].closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0];
  }
  function placementHealthy(){
    const box=document.getElementById('ng8-pins'),side=nativeSidebar();if(!box||!side||!side.contains(box))return false;
    const section=projectSection(side,box);
    if(section?.parentElement)return box.parentElement===section.parentElement&&box.nextElementSibling===section;
    const home=[...side.querySelectorAll('a[href]')].find(a=>outsideOwn(a)&&/^\/projects\/?(?:[?#].*)?$/.test(a.getAttribute('href')||''));
    if(home){const parent=home.parentElement;return box.getBoundingClientRect().top>=parent.getBoundingClientRect().bottom-4;}
    const brand=side.querySelector('[data-testid*="logo" i],a[aria-label*="ChatGPT" i],button[aria-label*="ChatGPT" i],.brand');
    return !brand||box.getBoundingClientRect().top>=brand.getBoundingClientRect().bottom-4;
  }
  function requestPlacementRepair(source='route'){
    document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile',{detail:{source:`native-ux-v125:${source}`}}));
  }
  function armPlacementProbes(source='route'){
    const epoch=++routeEpoch;
    for(const delay of [0,60,180,420,900,1800,3200])setTimeout(()=>{
      if(epoch!==routeEpoch)return;
      requestPlacementRepair(source);
      requestAnimationFrame(()=>{
        if(epoch!==routeEpoch)return;
        const box=document.getElementById('ng8-pins');
        if(box)box.dataset.ng125Placement=placementHealthy()?'stable':'settling';
      });
    },delay);
  }

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
    while(node&&node!==document.body){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||node.getAttribute?.('data-ng112-native-projects')==='1'){node.classList.add('ng125-native-stage');staged.push(node);}node=node.parentElement;}
    if(row&&!staged.includes(row)){row.classList.add('ng125-native-stage-leaf');staged.push(row);}
    return()=>staged.forEach(el=>el.classList.remove('ng125-native-stage','ng125-native-stage-leaf'));
  }
  async function openProjectSettings(projectId){
    projectId=normalizePid(projectId);const row=exactProjectRow(projectId);
    if(!row){location.assign(`/g/${encodeURIComponent(projectId)}/project`);return false;}
    const restore=stage(row),baseline=new Set(document.querySelectorAll(MENU_SEL));
    try{
      row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(55);const trigger=nativeMenuButton(row);if(!trigger){location.assign(`/g/${encodeURIComponent(projectId)}/project`);return false;}
      trigger.click();let menu=null;
      for(const delay of [35,70,120,200,320]){await sleep(delay);menu=[...document.querySelectorAll(MENU_SEL)].find(m=>!baseline.has(m)&&outsideOwn(m)&&visible(m));if(menu)break;}
      if(!menu){location.assign(`/g/${encodeURIComponent(projectId)}/project`);return false;}
      const item=[...menu.querySelectorAll('[role="menuitem"],button,a')].find(el=>SETTINGS_RX.test(clean(el.textContent||el.getAttribute('aria-label')||el.title)));
      if(!item){try{trigger.click();}catch{}location.assign(`/g/${encodeURIComponent(projectId)}/project`);return false;}
      item.click();window.__NIAKGPT_DIAGNOSTICS__?.set('project-settings-125',`OK · Paramètres du projet · ${projectId}`);return true;
    }catch{location.assign(`/g/${encodeURIComponent(projectId)}/project`);return false;}finally{restore();}
  }
  function closeCustomActionMenu(){
    document.getElementById('ng123-action-menu')?.remove();
    document.querySelectorAll('#ng8-pins .ng113-native-actions[aria-expanded="true"]').forEach(b=>{b.setAttribute('aria-expanded','false');b.removeAttribute('aria-controls');b.classList.remove('ng123-action-open');});
  }
  function augmentProjectMenu(menu){
    if(!(menu instanceof HTMLElement)||menu.dataset.kind!=='project'||menu.querySelector('[data-ng125-project-settings]'))return;
    const id=normalizePid(menu.dataset.id||'');if(!id)return;
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.dataset.ng125ProjectSettings='1';button.textContent='Paramètres du projet';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeCustomActionMenu();openProjectSettings(id);});
    const first=menu.querySelector(':scope>button');if(first)first.insertAdjacentElement('afterend',button);else menu.appendChild(button);
  }
  function scanProjectMenus(root=document){
    if(root instanceof Element&&root.matches?.('#ng123-action-menu'))augmentProjectMenu(root);
    for(const menu of root.querySelectorAll?.('#ng123-action-menu[data-kind="project"]')||[])augmentProjectMenu(menu);
  }

  function absoluteHref(link){try{return new URL(link.getAttribute('href')||link.href,location.href).href;}catch{return link.href||'';}}
  function openCustomChatInNewTab(event){
    const target=event.target instanceof Element?event.target:null,link=target?.closest('#ng8-pins .ng96-chat-entry>a[data-chat]');if(!(link instanceof HTMLAnchorElement))return false;
    const modifier=event.metaKey||event.ctrlKey,middle=event.type==='auxclick'&&event.button===1;
    if((event.type==='click'&&(event.button!==0||!modifier))||(event.type==='auxclick'&&!middle))return false;
    const href=absoluteHref(link);if(!href)return false;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();window.open(href,'_blank','noopener');return true;
  }

  function composerVisible(){
    const ed=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');if(!(ed instanceof HTMLElement)||!visible(ed))return false;
    const modal=[...document.querySelectorAll('[role="dialog"][aria-modal="true"],[aria-modal="true"]')].find(visible);
    return !modal;
  }
  function labelOf(el){return clean(`${el?.getAttribute?.('aria-label')||''} ${el?.getAttribute?.('title')||''} ${el?.textContent||''}`);}
  function browseControl(target){
    const control=target?.closest?.('[role="menuitem"],button,[role="button"],label,a');if(!control||!outsideOwn(control)||!composerVisible())return null;
    return BROWSE_RX.test(labelOf(control))?control:null;
  }
  function fileInputCandidate(){
    const inputs=[...document.querySelectorAll('input[type="file"]')].filter(i=>!i.disabled&&!i.closest(OWN));if(!inputs.length)return null;
    const composer=document.querySelector('[data-type="unified-composer"],form:has(#prompt-textarea),form:has([data-testid="prompt-textarea"])');
    return inputs.sort((a,b)=>{
      const score=i=>(composer?.contains(i)?100:0)+(/image|video|pdf|text|application/i.test(i.accept||'')?20:0)+(i.multiple?5:0);
      return score(b)-score(a);
    })[0]||null;
  }
  function guardBrowse(control){
    const started=performance.now();
    const fallback=()=>{
      if(lastFileInputClick>=started)return;const input=fileInputCandidate();if(!input)return;
      try{input.click();window.__NIAKGPT_DIAGNOSTICS__?.set('file-picker-125','OK · sélecteur natif restauré');}catch{}
    };
    queueMicrotask(fallback);setTimeout(fallback,0);
  }

  function syncNativeModalState(){
    const modal=[...document.querySelectorAll('[role="dialog"][aria-modal="true"],[aria-modal="true"]')].find(el=>visible(el)&&outsideOwn(el));
    if(modal)document.documentElement.dataset.ng125NativeModal='1';else delete document.documentElement.dataset.ng125NativeModal;
  }

  document.addEventListener('click',event=>{
    if(event.target instanceof HTMLInputElement&&event.target.type==='file'){lastFileInputClick=performance.now();return;}
    if(openCustomChatInNewTab(event))return;
    const control=browseControl(event.target instanceof Element?event.target:null);if(control)guardBrowse(control);
  },true);
  document.addEventListener('auxclick',event=>openCustomChatInNewTab(event),true);
  document.addEventListener('niakgpt:pins-rendered',()=>armPlacementProbes('pins-rendered'));
  document.addEventListener('niakgpt:folder-rendered',()=>scanProjectMenus(document));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){armPlacementProbes('visible');syncNativeModalState();}});
  window.addEventListener('popstate',()=>armPlacementProbes('popstate'));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>armPlacementProbes('navigation'));
  window.addEventListener('pageshow',()=>armPlacementProbes('pageshow'));

  observer=new MutationObserver(records=>{
    let placement=false,modal=false;
    for(const r of records)for(const n of r.addedNodes){if(!(n instanceof Element))continue;scanProjectMenus(n);if(n.matches?.('a[href*="/g/g-p-"],a[href="/projects"],[data-ng112-native-projects]')||n.querySelector?.('a[href*="/g/g-p-"],a[href="/projects"],[data-ng112-native-projects]'))placement=true;if(n.matches?.('[role="dialog"],[aria-modal="true"]')||n.querySelector?.('[role="dialog"],[aria-modal="true"]'))modal=true;}
    if(placement)armPlacementProbes('sidebar-remount');if(modal)syncNativeModalState();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
  scanProjectMenus(document);syncNativeModalState();armPlacementProbes('init');
})();