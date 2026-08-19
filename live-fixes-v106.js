(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LIVE_FIXES_106__)return;
  window.__NIAKGPT_LIVE_FIXES_106__=true;

  let breadcrumbObserver=null,statusObserver=null,globalObserver=null;
  let breadcrumbNode=null,statusNode=null,timer=0,suspended=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';

  function clearLegacyProjectMarks(){
    for(const el of document.querySelectorAll('.ng8-native-projects-suppressed,.ng8-native-project-link-suppressed,.ng8-native-project-chat-suppressed,.ng8-native-project-label-suppressed,.ng8-native-project-more-suppressed')){
      el.classList.remove('ng8-native-projects-suppressed','ng8-native-project-link-suppressed','ng8-native-project-chat-suppressed','ng8-native-project-label-suppressed','ng8-native-project-more-suppressed');
    }
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
    syncStatusProject();
  }
  function schedule(delay=24){if(suspended)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}

  function bindTargets(){
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
    suspended=false;clearLegacyProjectMarks();bindTargets();
    globalObserver?.disconnect();
    globalObserver=new MutationObserver(records=>{
      if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element)))schedule(30);
    });
    globalObserver.observe(document.documentElement,{childList:true,subtree:true});
    for(const delay of [0,120,450,1100,2400])setTimeout(()=>schedule(0),delay);
  }
  function stop(){
    suspended=true;clearTimeout(timer);timer=0;
    breadcrumbObserver?.disconnect();statusObserver?.disconnect();globalObserver?.disconnect();
    breadcrumbObserver=statusObserver=globalObserver=null;
    breadcrumbNode=statusNode=null;
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