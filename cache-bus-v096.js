(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CACHE_BUS__) return;

  const KEY='niakgpt-v08-cache';
  let value=null,loaded=false,contextDead=false,suspended=false,writeChain=Promise.resolve(),resumeReady=null,hiddenExternal=null,writeEpoch=0,staleWriteDuringSuspend=false;
  const listeners=new Set(),ownWriteSignatures=new Set();
  const invalidated=e=>/extension context invalidated|context invalidated/i.test(String(e?.message||e||''));
  const contextAlive=()=>{if(contextDead)return false;try{return !!chrome?.runtime?.id;}catch{return false;}};
  const signature=raw=>{if(!raw||typeof raw!=='object')return '';try{return JSON.stringify(raw);}catch{return '';}};
  const rememberOwn=raw=>{const sig=signature(raw);if(!sig)return '';ownWriteSignatures.add(sig);setTimeout(()=>ownWriteSignatures.delete(sig),10000);return sig;};
  const isOwn=raw=>{const sig=signature(raw);return !!sig&&ownWriteSignatures.has(sig);};

  const publish=next=>{
    value=next&&typeof next==='object'?next:null;
    loaded=true;
    for(const fn of [...listeners]){try{fn(value);}catch(error){console.warn('[NiakGPT cache bus]',error);}}
    try{document.documentElement.dataset.ng96CacheBus=contextDead?'inactive':'ready';}catch{}
  };
  function markDead(){
    if(contextDead)return;contextDead=true;listeners.clear();resumeReady=null;hiddenExternal=null;
    try{document.documentElement.dataset.ng96CacheBus='inactive';}catch{}
  }
  async function storageGet(force=false){
    if(contextDead||(!force&&suspended))return value;
    if(!contextAlive()){markDead();return value;}
    try{return(await chrome.storage.local.get(KEY))?.[KEY]||null;}
    catch(error){if(invalidated(error)){markDead();return value;}throw error;}
  }
  async function storageSet(next,{allowSuspended=false}={}){
    if(contextDead||(!allowSuspended&&suspended))return false;
    if(!contextAlive()){markDead();return false;}
    rememberOwn(next);
    try{
      await chrome.storage.local.set({[KEY]:next});
      if(contextDead||(!allowSuspended&&suspended))return false;
      return true;
    }catch(error){
      if(invalidated(error)||!contextAlive()){markDead();return false;}
      if(!allowSuspended&&suspended)return false;
      console.warn('[NiakGPT cache bus write]',error);return false;
    }
  }

  let ready=storageGet().then(raw=>{publish(raw);return value;}).catch(()=>{publish(value);return value;});

  const api={
    key:KEY,
    ready,
    peek:()=>value,
    get:()=>resumeReady||(loaded?Promise.resolve(value):ready),
    update(mutator){
      const run=async()=>{
        if(contextDead||suspended)return value;
        const epoch=writeEpoch;
        const current=resumeReady?await resumeReady:(loaded?value:await ready);
        if(contextDead||suspended)return value;
        let next;
        try{next=typeof mutator==='function'?await mutator(current):mutator;}catch(error){console.warn('[NiakGPT cache bus update]',error);return current;}
        if(!next||typeof next!=='object'||contextDead||suspended)return current;
        const ok=await storageSet(next);
        if(epoch!==writeEpoch){staleWriteDuringSuspend=true;return value;}
        if(ok)publish(next);return ok?next:current;
      };
      writeChain=writeChain.then(run,run);return writeChain;
    },
    subscribe(fn){
      if(typeof fn!=='function'||contextDead||suspended)return()=>{};
      listeners.add(fn);
      const replay=()=>{if(!contextDead&&!suspended&&listeners.has(fn))fn(value);};
      if(resumeReady)resumeReady.then(()=>queueMicrotask(replay));
      else if(loaded)queueMicrotask(replay);
      return()=>listeners.delete(fn);
    },
    active:()=>!contextDead&&!suspended
  };
  window.__NIAKGPT_CACHE_BUS__=api;
  try{document.documentElement.dataset.ng96CacheBus='loading';}catch{}

  try{
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(contextDead)return;
      try{
        if(area!=='local'||!changes[KEY])return;
        const next=changes[KEY].newValue||null,own=isOwn(next);
        if(suspended){if(!own)hiddenExternal=next;return;}
        if(!own)publish(next);
      }catch(error){if(invalidated(error))markDead();}
    });
  }catch(error){if(invalidated(error))markDead();}

  window.addEventListener('pagehide',event=>{
    suspended=true;writeEpoch++;hiddenExternal=null;staleWriteDuringSuspend=false;
    if(!event.persisted)markDead();
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted||contextDead||!contextAlive())return;
    suspended=false;
    try{document.documentElement.dataset.ng96CacheBus='loading';}catch{}
    const task=(async()=>{
      try{await writeChain;}catch{}
      if(contextDead||suspended)return value;
      const deferred=hiddenExternal,restore=staleWriteDuringSuspend&&deferred&&typeof deferred==='object';
      hiddenExternal=null;staleWriteDuringSuspend=false;
      if(restore)await storageSet(deferred,{allowSuspended:true});
      if(contextDead||suspended)return value;
      const raw=restore?deferred:await storageGet(true);
      if(!contextDead&&!suspended)publish(raw);
      return value;
    })();
    const resumed=task.finally(()=>{if(resumeReady===resumed)resumeReady=null;});
    resumeReady=resumed;ready=resumed;api.ready=resumed;
  });
})();
