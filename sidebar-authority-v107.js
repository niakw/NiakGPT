(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_AUTHORITY_107__)return;
  window.__NIAKGPT_SIDEBAR_AUTHORITY_107__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  const PROJECT_HREF='a[href*="/g/"]';
  const CHAT_HREF='a[href*="/c/"]';
  const CLASSES=['ng107-native-project-row','ng107-native-project-cluster','ng107-native-project-label','ng107-native-project-more'];
  let sidebarObserver=null,sidebarNode=null,bootstrapObserver=null,timer=0,stopped=false,sanitizing=false,cacheUnsub=null;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i)?.[1]||'';
  const isChatHref=h=>/\/c\//i.test(String(h||''));
  // Direct href semantics are deliberately restricted to Project IDs. Generic /g/... links
  // can be custom GPTs and must never be hidden merely because they share the /g/ prefix.
  const isProjectHref=h=>/\/g\/g-p-[^/?#]+(?:\/project)?(?:[/?#]|$)/i.test(String(h||''))&&!isChatHref(h);
  const isProjectChildHref=h=>/\/g\/g-p-[^/?#]+\/c\//i.test(String(h||''));
  const isDateLike=v=>{
    const s=norm(v).replace(/^dernier(?:e)?\s+(?:echange|activité|activite)\s*:?\s*/,'');
    return /^(?:aujourd'hui|aujourdhui|hier|today|yesterday|\d{1,2}:\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?(?:\s+[·-]?\s*\d{1,2}:\d{2})?)$/.test(s);
  };
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const outsideOwn=el=>!!el&&!el.closest(OWN);
  const managedPins=()=>document.getElementById('ng8-pins');
  const managedReady=()=>{const box=managedPins();return !!(box&&box.isConnected&&!box.hidden&&box.querySelector('a[data-ng8-pin="1"],a[href*="/g/g-p-"]'));};

  function managedNames(){
    const names=new Set(),box=managedPins();if(!box)return names;
    for(const el of box.querySelectorAll('a[data-ng8-pin="1"],a[href*="/g/g-p-"]')){
      const label=norm(el.querySelector('span')?.textContent||el.getAttribute('aria-label')||el.textContent);
      if(label&&!isDateLike(label))names.add(label.replace(/\s+\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\s*(?:\[[^\]]*\])?$/,''));
    }
    return names;
  }
  const cleanVariant=value=>norm(value).replace(/^(?:ouvrir|open)\s+(?:le\s+)?(?:projet|project)\s+/,'').replace(/\s+\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\s*(?:\[[^\]]*\])?$/,'').trim();
  function labelVariants(el){
    const out=[];
    for(const raw of [el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.textContent]){const s=cleanVariant(raw);if(s)out.push(s);}
    // ChatGPT Project rows often wrap the actual label next to an icon/SVG. Leaf spans are
    // a safer exact-name signal than treating the whole row text (icon + label) as a name.
    for(const leaf of el?.querySelectorAll?.('span')||[]){if(leaf.querySelector('span'))continue;const s=cleanVariant(leaf.textContent);if(s)out.push(s);}
    return [...new Set(out)];
  }
  function matchesManaged(el,names){
    if(!names.size||!outsideOwn(el))return false;
    const href=String(el.getAttribute?.('href')||'');if(isChatHref(href))return false;
    for(const label of labelVariants(el))for(const name of names){
      if(label===name)return true;
      if(label.startsWith(name+' ')&&label.length<=name.length+24)return true;
    }
    return false;
  }
  function genericChatCount(host){
    return [...(host?.querySelectorAll?.(CHAT_HREF)||[])].filter(a=>outsideOwn(a)&&!/\/g\//i.test(String(a.getAttribute('href')||''))).length;
  }
  function projectChildCount(host){
    return [...(host?.querySelectorAll?.(CHAT_HREF)||[])].filter(a=>outsideOwn(a)&&isProjectChildHref(a.getAttribute('href'))).length;
  }
  function hasProjectHeading(host){
    return [...(host?.querySelectorAll?.('h1,h2,h3,[role="heading"],div,span')||[])].some(el=>outsideOwn(el)&&/^(projets?|projects?)$/.test(norm(el.textContent)));
  }
  function hasLocalMore(host){
    return [...(host?.querySelectorAll?.('button,a,[role="button"]')||[])].some(el=>outsideOwn(el)&&/^(afficher plus|show more|voir plus)$/.test(norm(el.textContent||el.getAttribute('aria-label'))));
  }
  function rowHost(el,names){
    if(!(el instanceof Element))return null;
    let host=el.closest('li,[role="listitem"],[data-sidebar-item="true"]')||el;
    if(host.contains(managedPins()))host=el;
    for(let i=0;i<3;i++){
      const parent=host.parentElement;if(!parent||parent===sidebarRoot()||parent.contains(managedPins()))break;
      const interactive=parent.querySelectorAll('a,button,[role="link"],[role="button"]').length;
      const matches=[...parent.querySelectorAll('a,button,[role="link"],[role="button"]')].filter(x=>matchesManaged(x,names)||isProjectHref(x.getAttribute?.('href'))).length;
      if(matches===1&&genericChatCount(parent)===0&&interactive<=4)host=parent;else break;
    }
    return host;
  }
  function plainRowHost(el){
    if(!(el instanceof Element))return null;
    const host=el.closest('li,[role="listitem"],[data-sidebar-item="true"]');
    return host&&!host.contains(managedPins())?host:el;
  }

  function release(nav){
    for(const el of nav?.querySelectorAll?.('.'+CLASSES.join(',.'))||[])el.classList.remove(...CLASSES);
    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-natifs','FALLBACK · liste NiakGPT indisponible');
  }

  function suppressNativeProjects(){
    const nav=sidebarRoot();if(!nav)return false;
    if(!managedReady()){release(nav);return false;}
    const names=managedNames(),projectCandidates=new Set(),childCandidates=new Set();

    for(const a of nav.querySelectorAll(PROJECT_HREF)){
      if(!outsideOwn(a))continue;
      const href=String(a.getAttribute('href')||'');
      if(isProjectHref(href))projectCandidates.add(a);
      else if(isProjectChildHref(href))childCandidates.add(a);
    }
    // New ChatGPT markup may use opaque Project links. In that case only exact names that
    // already exist in the managed NiakGPT list are accepted as Project rows.
    for(const el of nav.querySelectorAll('a,button,[role="link"],[role="button"]'))if(matchesManaged(el,names))projectCandidates.add(el);

    const projectRows=[...new Set([...projectCandidates].map(el=>rowHost(el,names)).filter(Boolean))];
    const childRows=[...new Set([...childCandidates].map(plainRowHost).filter(Boolean))];
    const rows=[...new Set([...projectRows,...childRows])];
    for(const row of rows)row.classList.add('ng107-native-project-row');

    const clusters=new Set();
    for(const row of projectRows){
      let node=row.parentElement;
      for(let depth=0;depth<7&&node&&node!==nav;depth++,node=node.parentElement){
        if(node.contains(managedPins()))continue;
        const contained=projectRows.filter(r=>node.contains(r)).length;
        if(!contained||genericChatCount(node)!==0)continue;
        // One Project is enough when the container also exposes its child chats, heading or
        // local “Afficher plus”. Two+ Project rows are intrinsically a native Project cluster.
        if(contained>=2||projectChildCount(node)>0||hasProjectHeading(node)||hasLocalMore(node))clusters.add(node);
      }
    }
    // Keep the outermost safe cluster(s); child chat rows and local “Afficher plus” vanish
    // with the Project area rather than being hidden by unrelated generic sidebar rules.
    const clusterList=[...clusters].filter(node=>![...clusters].some(other=>other!==node&&other.contains(node)&&genericChatCount(other)===0));
    for(const cluster of clusterList)cluster.classList.add('ng107-native-project-cluster');

    for(const label of nav.querySelectorAll('h1,h2,h3,[role="heading"],div,span')){
      if(!outsideOwn(label))continue;
      const t=norm(label.textContent);if(/^(projets?|projects?)$/.test(t))label.classList.add('ng107-native-project-label');
    }
    for(const more of nav.querySelectorAll('button,a,[role="button"]')){
      if(!outsideOwn(more)||!/^(afficher plus|show more|voir plus)$/.test(norm(more.textContent||more.getAttribute('aria-label'))))continue;
      if(more.closest('.ng107-native-project-cluster')){more.classList.add('ng107-native-project-more');continue;}
      let host=more.parentElement,projectContext=false;
      for(let depth=0;depth<5&&host&&host!==nav;depth++,host=host.parentElement){
        if(host.contains(managedPins()))break;
        const hasRow=projectRows.some(r=>host.contains(r));
        const hasManaged=[...host.querySelectorAll('a,button,[role="link"],[role="button"]')].some(x=>matchesManaged(x,names)||isProjectHref(x.getAttribute?.('href')));
        if((hasRow||hasManaged)&&genericChatCount(host)===0){projectContext=true;break;}
      }
      if(projectContext)more.classList.add('ng107-native-project-more');
    }

    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-natifs',`OK · ${projectRows.length} Projects · ${childRows.length} chats enfants · ${clusterList.length} bloc(s) masqué(s)`);
    return rows.length>0||clusterList.length>0;
  }

  function replaceDateNode(node){
    if(!(node instanceof HTMLElement)||node.tagName==='TIME')return node;
    const time=document.createElement('time');
    for(const attr of [...node.attributes])time.setAttribute(attr.name,attr.value);
    time.textContent=node.textContent||'';
    node.replaceWith(time);return time;
  }
  function normalizeChatMetadata(){
    const nav=sidebarRoot();if(!nav)return;
    for(const link of nav.querySelectorAll(CHAT_HREF)){
      if(!outsideOwn(link))continue;
      for(const date of link.querySelectorAll(':scope > .ng8-chat-date'))if(isDateLike(date.textContent))replaceDateNode(date);
      for(const badge of link.querySelectorAll(':scope > .ng8-chat-project')){
        if(!isDateLike(badge.textContent))continue;
        badge.dataset.ng107InvalidProject='1';badge.remove();
      }
    }
  }

  function cleanCache(raw){
    if(!raw||typeof raw!=='object')return null;
    const projects=Array.isArray(raw.projects)?raw.projects:[],badIds=new Set(projects.filter(p=>p?.domOnly&&isDateLike(p?.name)).map(p=>String(p.id||'')).filter(Boolean));
    if(!badIds.size)return null;
    const cleanedProjects=projects.filter(p=>!badIds.has(String(p?.id||'')));
    const cleanedChats=(Array.isArray(raw.chats)?raw.chats:[]).map(c=>{
      if(!badIds.has(String(c?.projectId||'')))return c;
      const recovered=pidFromHref(c?.href||'');return{...c,projectId:recovered||''};
    });
    const counts={...(raw.counts||{})};for(const id of badIds)delete counts[id];
    const projectChats={...(raw.projectChats||{})};for(const id of badIds)delete projectChats[id];
    const indexed=(Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]).filter(id=>!badIds.has(String(id)));
    return{...raw,at:Date.now(),projects:cleanedProjects,chats:cleanedChats,counts,projectChats,indexedProjectIds:indexed};
  }
  const cleanRead=raw=>cleanCache(raw)||raw;
  function wrapCacheBus(){
    const bus=window.__NIAKGPT_CACHE_BUS__;if(!bus||bus.__ng107Sanitized)return bus;
    const originalGet=typeof bus.get==='function'?bus.get.bind(bus):null;
    const originalPeek=typeof bus.peek==='function'?bus.peek.bind(bus):null;
    const originalSubscribe=typeof bus.subscribe==='function'?bus.subscribe.bind(bus):null;
    try{
      Object.defineProperties(bus,{
        __ng107RawGet:{value:originalGet,configurable:true},
        __ng107RawPeek:{value:originalPeek,configurable:true},
        __ng107RawSubscribe:{value:originalSubscribe,configurable:true},
        __ng107Sanitized:{value:true,configurable:true}
      });
      if(originalGet)bus.get=async()=>cleanRead(await originalGet());
      if(originalPeek)bus.peek=()=>cleanRead(originalPeek());
      if(originalSubscribe)bus.subscribe=fn=>originalSubscribe(raw=>fn(cleanRead(raw)));
      if(bus.ready&&typeof bus.ready.then==='function')bus.ready=Promise.resolve(bus.ready).then(cleanRead);
    }catch{}
    return bus;
  }
  async function sanitizeCache(rawOverride){
    if(stopped||sanitizing)return;
    try{
      const bus=wrapCacheBus()||window.__NIAKGPT_CACHE_BUS__;
      const raw=rawOverride!==undefined?rawOverride:(bus?.__ng107RawGet?await bus.__ng107RawGet():bus?.get?await bus.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]);
      const cleaned=cleanCache(raw);if(!cleaned)return;
      sanitizing=true;
      if(bus?.update)await bus.update(latest=>cleanCache(latest)||latest);
      else await chrome.storage.local.set({[CACHE_KEY]:cleaned});
      window.__NIAKGPT_DIAGNOSTICS__?.set('metadata-sidebar','RÉPARÉ · faux Project/date supprimé');
    }catch(error){
      const msg=String(error?.message||error||'');
      if(/Extension context invalidated|context invalidated/i.test(msg))stop();
    }finally{sanitizing=false;}
  }

  function repair(){if(stopped)return;bindSidebar();normalizeChatMetadata();suppressNativeProjects();sanitizeCache();}
  function schedule(delay=24){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}
  function bindSidebar(){
    const nav=sidebarRoot();if(!nav||nav===sidebarNode)return !!nav;
    sidebarObserver?.disconnect();sidebarNode=nav;
    sidebarObserver=new MutationObserver(()=>schedule(18));
    sidebarObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','href','aria-label']});
    return true;
  }
  function bootstrap(){
    if(bindSidebar())return;
    bootstrapObserver?.disconnect();bootstrapObserver=new MutationObserver(()=>{if(bindSidebar()){bootstrapObserver?.disconnect();bootstrapObserver=null;schedule(0);}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }
  function stop(){
    stopped=true;clearTimeout(timer);timer=0;sidebarObserver?.disconnect();bootstrapObserver?.disconnect();sidebarObserver=bootstrapObserver=null;sidebarNode=null;
    try{cacheUnsub?.();}catch{}cacheUnsub=null;
  }
  function start(){
    stopped=false;const bus=wrapCacheBus();bootstrap();
    // Normalise any DOM left by the previous unpacked-extension context synchronously,
    // before sidebar-host/app are injected next in the production sequence.
    normalizeChatMetadata();suppressNativeProjects();
    const rawSubscribe=bus?.__ng107RawSubscribe||null;
    if(rawSubscribe&&!cacheUnsub)cacheUnsub=rawSubscribe(raw=>{sanitizeCache(raw);schedule(8);});
    else if(bus?.subscribe&&!cacheUnsub)cacheUnsub=bus.subscribe(raw=>{sanitizeCache(raw);schedule(8);});
    sanitizeCache();schedule(0);
  }

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(20));
  document.addEventListener('click',event=>{const t=event.target instanceof Element?event.target:null;if(t?.closest('nav,[data-testid*="sidebar" i],#ng8-pins'))schedule(45);},true);
  window.addEventListener('popstate',()=>schedule(20));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(20));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
