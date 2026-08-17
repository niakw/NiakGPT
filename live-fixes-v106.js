(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LIVE_FIXES_106__)return;
  window.__NIAKGPT_LIVE_FIXES_106__=true;

  const OWN='#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins,#ng90-control,#ng100-command,#ng100-onboarding,#ng97-loader,#ng100-breadcrumb';
  const PROJECT_ANY='a[href*="/g/g-p-"]';
  const CHAT_ANY='a[href*="/c/"]';
  const SUPPRESS=['ng8-native-project-link-suppressed','ng8-native-project-chat-suppressed'];
  let sidebarObserver=null,breadcrumbObserver=null,statusObserver=null,globalObserver=null;
  let sidebarNode=null,breadcrumbNode=null,statusNode=null,timer=0,suspended=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  const managedPins=()=>document.getElementById('ng8-pins');
  const managedReady=()=>{const p=managedPins();return !!(p&&p.isConnected&&!p.hidden&&p.querySelector('[data-ng8-pin],a[href*="/g/g-p-"]'));};
  const outsideOwn=el=>!!el&&!el.closest('#ng8-pins')&&!el.closest(OWN);
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';

  function managedNames(){
    const pins=managedPins();if(!pins)return new Set();
    const names=new Set();
    for(const row of pins.querySelectorAll('[data-ng8-pin],a')){
      const label=clean(row.querySelector?.('span')?.textContent||row.textContent||row.getAttribute?.('aria-label'));
      if(label)names.add(norm(label));
    }
    return names;
  }

  function nativeProjectRows(nav){
    const rows=new Set();
    for(const a of nav.querySelectorAll(PROJECT_ANY))if(outsideOwn(a))rows.add(a);

    // ChatGPT has changed the Project row markup more than once. If href semantics
    // disappear, use the managed Project names only when at least two matching native
    // rows are present; that avoids hiding an unrelated conversation sharing one title.
    const names=managedNames(),byName=[];
    if(names.size){
      for(const el of nav.querySelectorAll('a,button,[role="link"],[role="button"]')){
        if(!outsideOwn(el)||el.matches(CHAT_ANY))continue;
        const label=norm(el.textContent||el.getAttribute('aria-label'));
        if(label&&names.has(label))byName.push(el);
      }
    }
    if(byName.length>=2)for(const el of byName)rows.add(el);
    return [...rows];
  }

  function suppressNativeProjects(){
    const nav=sidebarRoot();
    if(!nav||!managedReady())return false;
    const rows=nativeProjectRows(nav);
    let touched=0;
    for(const row of rows){
      const href=String(row.getAttribute?.('href')||'');
      const cls=/\/c\//i.test(href)?SUPPRESS[1]:SUPPRESS[0];
      if(!row.classList.contains(cls)){row.classList.add(cls);touched++;}
    }

    for(const el of nav.querySelectorAll('h1,h2,h3,[role="heading"],div,span')){
      if(!outsideOwn(el))continue;
      const text=clean(el.textContent);
      if(text.length<=18&&/^(projets?|projects?)$/i.test(text)&&!el.classList.contains('ng8-native-project-label-suppressed')){
        el.classList.add('ng8-native-project-label-suppressed');touched++;
      }
    }

    for(const more of nav.querySelectorAll('button,a,[role="button"]')){
      if(!outsideOwn(more))continue;
      const text=clean(more.textContent||more.getAttribute('aria-label'));
      if(!/^(afficher plus|show more|voir plus)$/i.test(text))continue;
      let host=more.parentElement,match=false;
      for(let i=0;i<4&&host&&host!==nav;i++,host=host.parentElement){
        const projectCount=host.querySelectorAll?.('.ng8-native-project-link-suppressed,.ng8-native-project-chat-suppressed').length||0;
        const genericChats=[...(host.querySelectorAll?.(CHAT_ANY)||[])].filter(a=>outsideOwn(a)&&!/\/g\/g-p-/i.test(String(a.getAttribute('href')||''))).length;
        if(projectCount&&genericChats===0){match=true;break;}
      }
      if(match&&!more.classList.contains('ng8-native-project-more-suppressed')){
        more.classList.add('ng8-native-project-more-suppressed');touched++;
      }
    }

    window.__NIAKGPT_DIAGNOSTICS__?.set('projects-natifs',rows.length?`OK · ${rows.length} masqués · anti-race`:'ATTENTE · aucun doublon natif détecté');
    return touched>0;
  }

  function breadcrumbContext(){
    const crumb=document.querySelector('#ng100-breadcrumb .ng100-bc-project');
    if(!crumb)return null;
    const name=clean(crumb.textContent||crumb.getAttribute('aria-label'));
    if(!name||/^(hors projet|project)$/i.test(name))return null;
    return{name,pid:pidFromHref(crumb.getAttribute('href')||'')};
  }

  function syncStatusProject(){
    const ctx=breadcrumbContext(),status=document.querySelector('#ng8-status .ng8-status-project');
    if(!ctx||!status)return false;
    let changed=false;
    if(clean(status.textContent)!==ctx.name){status.textContent=ctx.name;changed=true;}

    let pin=null;
    if(ctx.pid)pin=document.querySelector(`#ng8-pins [data-ng8-pin][href*="/g/${CSS.escape(ctx.pid)}/"],#ng8-pins a[href*="/g/${CSS.escape(ctx.pid)}/"]`);
    if(!pin){
      const target=norm(ctx.name);
      pin=[...document.querySelectorAll('#ng8-pins [data-ng8-pin],#ng8-pins a')].find(x=>norm(x.querySelector?.('span')?.textContent||x.textContent)===target)||null;
    }
    if(pin){
      const color=pin.style.getPropertyValue('--ng-project')||getComputedStyle(pin).getPropertyValue('--ng-project');
      if(clean(color))document.documentElement.style.setProperty('--ng8-current-project',clean(color));
    }
    document.documentElement.dataset.ng106ProjectContext=ctx.name;
    window.__NIAKGPT_DIAGNOSTICS__?.set('contexte-project',`OK · ${ctx.name} · breadcrumb`);
    return changed;
  }

  function repair(){
    if(suspended)return;
    bindTargets();
    suppressNativeProjects();
    syncStatusProject();
  }
  function schedule(delay=24){if(suspended)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}

  function bindTargets(){
    const nav=sidebarRoot();
    if(nav&&nav!==sidebarNode){
      sidebarObserver?.disconnect();sidebarNode=nav;
      sidebarObserver=new MutationObserver(()=>schedule(18));
      sidebarObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','href','aria-label']});
    }
    const bc=document.getElementById('ng100-breadcrumb');
    if(bc&&bc!==breadcrumbNode){
      breadcrumbObserver?.disconnect();breadcrumbNode=bc;
      breadcrumbObserver=new MutationObserver(()=>schedule(12));
      breadcrumbObserver.observe(bc,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','class']});
    }
    const status=document.getElementById('ng8-status');
    if(status&&status!==statusNode){
      statusObserver?.disconnect();statusNode=status;
      statusObserver=new MutationObserver(()=>schedule(12));
      statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
    }
  }

  function start(){
    suspended=false;bindTargets();
    globalObserver?.disconnect();
    globalObserver=new MutationObserver(records=>{
      if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element)))schedule(30);
    });
    globalObserver.observe(document.documentElement,{childList:true,subtree:true});
    for(const delay of [0,120,450,1100,2400])setTimeout(()=>schedule(0),delay);
  }
  function stop(){
    suspended=true;clearTimeout(timer);timer=0;
    sidebarObserver?.disconnect();breadcrumbObserver?.disconnect();statusObserver?.disconnect();globalObserver?.disconnect();
    sidebarObserver=breadcrumbObserver=statusObserver=globalObserver=null;
    sidebarNode=breadcrumbNode=statusNode=null;
  }

  document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(30));
  document.addEventListener('click',()=>schedule(70),true);
  window.addEventListener('popstate',()=>schedule(20));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(20));
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
