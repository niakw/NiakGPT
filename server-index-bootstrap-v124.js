(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__)return;
  window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const MAX_ATTEMPTS=28;
  const RETRY_MS=550;
  let attempts=0,timer=0,stopped=false,writingInventory=false;

  const serverProjects=raw=>(raw?.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p?.domOnly);
  const expectedCount=raw=>Math.max(0,Number(raw?.projectInventoryCount||0)||0);
  const inventoryReady=raw=>{
    const expected=expectedCount(raw),actual=serverProjects(raw).length;
    return Number(raw?.projectInventoryAt||0)>0&&expected>0&&actual>=expected;
  };
  const stop=()=>{stopped=true;clearTimeout(timer);};
  const schedule=(delay=RETRY_MS)=>{if(stopped||attempts>=MAX_ATTEMPTS)return;clearTimeout(timer);timer=setTimeout(tick,delay);};

  async function read(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function update(mutator){
    const bus=window.__NIAKGPT_CACHE_BUS__;
    if(bus?.update){try{return await bus.update(mutator);}catch{}}
    try{const raw=await read(),next=mutator(raw);if(next&&next!==raw)await chrome.storage.local.set({[CACHE_KEY]:next});return next||raw;}catch{return{};}
  }
  async function invalidateUntrustedInventory(raw){
    const at=Number(raw?.projectInventoryAt||0),expected=expectedCount(raw),actual=serverProjects(raw).length;
    if(!at||(expected>0&&actual>=expected))return raw;
    return update(latest=>{
      const latestAt=Number(latest?.projectInventoryAt||0),latestExpected=expectedCount(latest),latestActual=serverProjects(latest).length;
      if(!latestAt||(latestExpected>0&&latestActual>=latestExpected))return latest;
      return{...latest,projectInventoryAt:0,at:Date.now()};
    });
  }

  async function tick(){
    if(stopped||attempts>=MAX_ATTEMPTS)return;
    if(writingInventory){schedule(80);return;}
    attempts++;
    let raw=await read();
    if(inventoryReady(raw)){stop();return;}
    raw=await invalidateUntrustedInventory(raw);
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index',{detail:{source:'bootstrap-v124',attempt:attempts,expected:expectedCount(raw),actual:serverProjects(raw).length}}));
    schedule();
  }

  async function rememberInventory(event){
    const count=Math.max(0,Number(event?.detail?.projects||0)||0);
    if(!count){schedule(80);return;}
    writingInventory=true;
    try{
      const next=await update(latest=>({...latest,projectInventoryCount:count,at:Date.now()}));
      if(inventoryReady(next)){stop();return;}
    }finally{writingInventory=false;}
    schedule(40);
  }
  async function verifyIndexed(){const raw=await read();if(inventoryReady(raw))stop();else schedule(40);}

  // Older 0.9.x caches did not persist an inventory count. A timestamp without the
  // count is therefore deliberately treated as untrusted once, forcing a canonical
  // server inventory refresh instead of accepting whatever native Project rows happen
  // to be visible during hydration.
  document.addEventListener('niakgpt:server-projects-ready',rememberInventory);
  document.addEventListener('niakgpt:server-indexed',verifyIndexed);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped)schedule(40);});
  window.addEventListener('pagehide',stop,{once:true});
  schedule(120);
})();
