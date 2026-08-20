(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__)return;
  window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const MAX_ATTEMPTS=20;
  const RETRY_MS=600;
  let attempts=0,timer=0,stopped=false;

  const serverProjects=raw=>(raw?.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p?.domOnly);
  const inventoryReady=raw=>Number(raw?.projectInventoryAt||0)>0&&serverProjects(raw).length>0;
  const stop=()=>{stopped=true;clearTimeout(timer);};
  const schedule=(delay=RETRY_MS)=>{if(stopped||attempts>=MAX_ATTEMPTS)return;clearTimeout(timer);timer=setTimeout(tick,delay);};

  async function tick(){
    if(stopped||attempts>=MAX_ATTEMPTS)return;
    attempts++;
    try{
      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};
      if(inventoryReady(raw)){stop();return;}
    }catch{}
    // server-index-v100 owns all network work and safety gates. This module only
    // re-emits its existing force event during the short startup window so a
    // transient hidden/busy/cache-guard state cannot permanently lose indexing.
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index',{detail:{source:'bootstrap-v124',attempt:attempts}}));
    schedule();
  }

  document.addEventListener('niakgpt:server-projects-ready',stop,{once:true});
  document.addEventListener('niakgpt:server-indexed',stop,{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped)schedule(40);});
  window.addEventListener('pagehide',stop,{once:true});
  schedule(120);
})();
