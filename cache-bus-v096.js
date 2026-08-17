(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CACHE_BUS__) return;

  const KEY='niakgpt-v08-cache';
  let value=null,loaded=false,contextDead=false,suspended=false,writeChain=Promise.resolve();
  const listeners=new Set();
  const invalidated=e=>/extension context invalidated|context invalidated/i.test(String(e?.message||e||''));
  const contextAlive=()=>{if(contextDead)return false;try{return !!chrome?.runtime?.id;}catch{return false;}};

  const publish=next=>{
    value=next&&typeof next==='object'?next:null;
    loaded=true;
    for(const fn of [...listeners]){try{fn(value);}catch(error){console.warn('[NiakGPT cache bus]',error);}}
    try{document.documentElement.dataset.ng96CacheBus=contextDead?'inactive':'ready';}catch{}
  };
  function markDead(){
    if(contextDead)return;contextDead=true;listeners.clear();
    try{document.documentElement.dataset.ng96CacheBus='inactive';}catch{}
  }
  async function storageGet(){
    if(contextDead||suspended)return value;
    if(!contextAlive()){markDead();return value;}
    try{return(await chrome.storage.local.get(KEY))?.[KEY]||null;}
    catch(error){if(invalidated(error)){markDead();return value;}throw error;}
  }
  async function storageSet(next){
    if(contextDead||suspended)return false;
    if(!contextAlive()){markDead();return false;}
    try{await chrome.storage.local.set({[KEY]:next});return true;}
    catch(error){if(suspended||invalidated(error)||!contextAlive()){markDead();return false;}console.warn('[NiakGPT cache bus write]',error);return false;}
  }

  const ready=storageGet().then(raw=>{publish(raw);return value;}).catch(()=>{publish(value);return value;});

  const api={
    key:KEY,
    ready,
    peek:()=>value,
    get:()=>loaded?Promise.resolve(value):ready,
    update(mutator){
      const run=async()=>{
        if(contextDead||suspended)return value;
        const current=loaded?value:await ready;
        let next;
        try{next=typeof mutator==='function'?await mutator(current):mutator;}catch(error){console.warn('[NiakGPT cache bus update]',error);return current;}
        if(!next||typeof next!=='object')return current;
        const ok=await storageSet(next);if(ok)publish(next);return ok?next:current;
      };
      writeChain=writeChain.then(run,run);return writeChain;
    },
    subscribe(fn){
      if(typeof fn!=='function'||contextDead||suspended)return()=>{};
      listeners.add(fn);
      if(loaded)queueMicrotask(()=>{if(!contextDead&&listeners.has(fn))fn(value);});
      return()=>listeners.delete(fn);
    },
    active:()=>!contextDead&&!suspended
  };
  window.__NIAKGPT_CACHE_BUS__=api;
  try{document.documentElement.dataset.ng96CacheBus='loading';}catch{}

  try{
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(contextDead||suspended)return;
      try{if(area==='local'&&changes[KEY])publish(changes[KEY].newValue||null);}catch(error){if(invalidated(error))markDead();}
    });
  }catch(error){if(invalidated(error))markDead();}

  window.addEventListener('pagehide',event=>{suspended=true;listeners.clear();if(!event.persisted)markDead();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&!contextDead&&contextAlive()){suspended=false;try{document.documentElement.dataset.ng96CacheBus='ready';}catch{}}});
})();
