(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CACHE_BUS__) return;

  const KEY='niakgpt-v08-cache';
  let value=null,loaded=false;
  const listeners=new Set();

  const publish=next=>{
    value=next&&typeof next==='object'?next:null;
    loaded=true;
    for(const fn of [...listeners]){try{fn(value);}catch(error){console.warn('[NiakGPT cache bus]',error);}}
    document.documentElement.dataset.ng96CacheBus=loaded?'ready':'loading';
  };

  const ready=chrome.storage.local.get(KEY)
    .then(raw=>{publish(raw?.[KEY]||null);return value;})
    .catch(()=>{publish(null);return null;});

  const api={
    key:KEY,
    ready,
    peek:()=>value,
    get:()=>loaded?Promise.resolve(value):ready,
    subscribe(fn){
      if(typeof fn!=='function')return()=>{};
      listeners.add(fn);
      if(loaded)queueMicrotask(()=>{if(listeners.has(fn))fn(value);});
      return()=>listeners.delete(fn);
    }
  };
  window.__NIAKGPT_CACHE_BUS__=api;
  document.documentElement.dataset.ng96CacheBus='loading';

  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[KEY])publish(changes[KEY].newValue||null);
  });
})();
