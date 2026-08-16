(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CACHE_BUS__)return;

  const KEY='niakgpt-v08-cache';
  let value=null,loaded=false,disposed=false,writeChain=Promise.resolve();
  const listeners=new Set();

  const invalidated=error=>/extension context invalidated|context invalidated|receiving end does not exist/i.test(String(error?.message||error||''));
  const markDisposed=()=>{
    if(disposed)return;disposed=true;listeners.clear();
    try{document.documentElement.dataset.ng96CacheBus='detached';}catch{}
    try{window.__NIAKGPT_DIAGNOSTICS__?.set('cache-bus','DÉTACHÉ · recharge onglet requise');}catch{}
  };
  const publish=next=>{
    if(disposed)return;
    value=next&&typeof next==='object'?next:null;
    loaded=true;
    for(const fn of [...listeners]){try{fn(value);}catch(error){console.warn('[NiakGPT cache bus]',error);}}
    document.documentElement.dataset.ng96CacheBus='ready';
  };
  const storageGet=async()=>{
    if(disposed)return value;
    try{return(await chrome.storage.local.get(KEY))?.[KEY]||null;}
    catch(error){if(invalidated(error)){markDisposed();return value;}throw error;}
  };
  const storageSet=async next=>{
    if(disposed)return false;
    try{await chrome.storage.local.set({[KEY]:next});return true;}
    catch(error){if(invalidated(error)){markDisposed();return false;}throw error;}
  };

  document.documentElement.dataset.ng96CacheBus='loading';
  const ready=storageGet().then(raw=>{if(!disposed)publish(raw);return value;}).catch(error=>{
    if(!invalidated(error))console.warn('[NiakGPT cache bus read]',error);
    if(!disposed)publish(null);return null;
  });

  const api={
    key:KEY,
    ready,
    peek:()=>value,
    get:()=>disposed?Promise.resolve(value):(loaded?Promise.resolve(value):ready),
    async update(mutator){
      if(typeof mutator!=='function'||disposed)return value;
      const job=writeChain.then(async()=>{
        if(disposed)return value;
        const latest=await storageGet();if(disposed)return value;
        let next;
        try{next=await mutator(latest&&typeof latest==='object'?latest:{});}catch(error){throw error;}
        if(next===undefined)return latest;
        const payload=next&&typeof next==='object'?{...next,at:Number(next.at)||Date.now()}:next;
        const ok=await storageSet(payload);if(ok)publish(payload);return ok?payload:value;
      });
      writeChain=job.catch(error=>{
        if(invalidated(error)){markDisposed();return value;}
        console.warn('[NiakGPT cache bus]',error);return value;
      });
      return writeChain;
    },
    subscribe(fn){
      if(typeof fn!=='function'||disposed)return()=>{};
      listeners.add(fn);
      if(loaded)queueMicrotask(()=>{if(!disposed&&listeners.has(fn))try{fn(value);}catch(error){console.warn('[NiakGPT cache bus]',error);}});
      return()=>listeners.delete(fn);
    },
    alive:()=>!disposed
  };
  window.__NIAKGPT_CACHE_BUS__=api;

  const onStorageChanged=(changes,area)=>{if(!disposed&&area==='local'&&changes[KEY])publish(changes[KEY].newValue||null);};
  try{chrome.storage.onChanged.addListener(onStorageChanged);}catch(error){if(invalidated(error))markDisposed();}

  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    markDisposed();
    try{chrome.storage.onChanged.removeListener(onStorageChanged);}catch{}
  },{once:true});
})();
