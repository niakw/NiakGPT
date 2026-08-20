(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_NATIVE_NAME_SYNC_124__)return;
  window.__NIAKGPT_PROJECT_NATIVE_NAME_SYNC_124__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption,#ng123-action-menu,#ng123-rename-dialog';
  let timer=0,busy=false;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pid=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  function nativeNames(){
    const out=new Map();for(const a of document.querySelectorAll('a[href]')){if(a.closest?.(OWN))continue;const href=a.getAttribute('href')||'',id=pid(href);if(!id||!/\/g\/g-p-[^/]+\/project(?:$|[?#])/i.test(href))continue;const name=clean(a.textContent||a.getAttribute('aria-label'));if(name&&name.length<=160&&!/^projects?$|^projets?$/i.test(name))out.set(id,name);}return out;
  }
  async function sync(){
    timer=0;if(busy)return;const names=nativeNames();if(!names.size)return;busy=true;
    try{
      const merge=raw=>{raw=raw&&typeof raw==='object'?raw:{};let changed=false;const projects=(raw.projects||[]).map(p=>{const id=normalizePid(p?.id||''),name=names.get(id);if(!name||clean(p?.name)===name)return p;changed=true;return{...p,name};});return changed?{...raw,projects,at:Date.now()}:raw;};
      const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)await bus.update(merge);else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{},next=merge(raw);if(next!==raw)await chrome.storage.local.set({[CACHE_KEY]:next});}
      document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile'));
    }catch{}finally{busy=false;}
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(sync,delay);}
  document.addEventListener('niakgpt:force-server-index',()=>schedule(80));
  document.addEventListener('niakgpt:server-projects-ready',()=>schedule(0));
  document.addEventListener('niakgpt:pins-rendered',()=>schedule(120));
  window.addEventListener('pageshow',()=>schedule(150));
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
})();
