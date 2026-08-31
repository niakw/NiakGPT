(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__)return;
  window.__NIAKGPT_SERVER_INDEX_BOOTSTRAP_124__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const MAX_ATTEMPTS=12;
  const RETRY_MS=10000;
  const BACKGROUND_QUIET_MS=2*60*1000;
  let attempts=0,timer=0,stopped=false,writingInventory=false,lastUserOrNativeAt=Date.now();

  const serverProjects=raw=>(raw?.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p?.domOnly);
  const expectedCount=raw=>Math.max(0,Number(raw?.projectInventoryCount||0)||0);
  const inventoryReady=raw=>{
    const expected=expectedCount(raw),actual=serverProjects(raw).length;
    return Number(raw?.projectInventoryAt||0)>0&&expected>0&&actual>=expected;
  };
  const conversationPage=()=>/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/.test(String(location.pathname||''));
  const quietFor=()=>Date.now()-lastUserOrNativeAt;
  const remainingQuiet=()=>Math.max(RETRY_MS,BACKGROUND_QUIET_MS-quietFor()+1000);
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
    if(conversationPage()||quietFor()<BACKGROUND_QUIET_MS){schedule(remainingQuiet());return;}
    if(writingInventory){schedule(RETRY_MS);return;}
    attempts++;
    let raw=await read();
    if(inventoryReady(raw)){stop();return;}
    raw=await invalidateUntrustedInventory(raw);
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index',{detail:{source:'bootstrap-v124',attempt:attempts,expected:expectedCount(raw),actual:serverProjects(raw).length}}));
    schedule();
  }

  async function rememberInventory(event){
    const count=Math.max(0,Number(event?.detail?.projects||0)||0);
    if(!count){schedule(RETRY_MS);return;}
    writingInventory=true;
    try{
      const next=await update(latest=>({...latest,projectInventoryCount:count,at:Date.now()}));
      if(inventoryReady(next)){stop();return;}
    }finally{writingInventory=false;}
    schedule(RETRY_MS);
  }
  async function verifyIndexed(){const raw=await read();if(inventoryReady(raw))stop();else schedule(RETRY_MS);}

  // Older 0.9.x caches did not persist an inventory count. A timestamp without the
  // count is therefore deliberately treated as untrusted once, forcing a canonical
  // server inventory refresh instead of accepting whatever native Project rows happen
  // to be visible during hydration.
  document.addEventListener('niakgpt:server-projects-ready',rememberInventory);
  document.addEventListener('niakgpt:server-indexed',verifyIndexed);
  const noteHuman=()=>{lastUserOrNativeAt=Date.now();if(!stopped)schedule(BACKGROUND_QUIET_MS+1000);};
  for(const type of ['pointerdown','keydown','touchstart','wheel'])document.addEventListener(type,noteHuman,{capture:true,passive:type==='touchstart'||type==='wheel'});
  document.addEventListener('niakgpt:activity-changed',event=>{if(event.detail?.active===true){lastUserOrNativeAt=Date.now();if(!stopped)schedule(BACKGROUND_QUIET_MS+1000);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped){lastUserOrNativeAt=Date.now();schedule(BACKGROUND_QUIET_MS+1000);}});
  window.addEventListener('popstate',()=>{lastUserOrNativeAt=Date.now();if(!stopped)schedule(BACKGROUND_QUIET_MS+1000);});
  window.addEventListener('pagehide',stop,{once:true});
  schedule(BACKGROUND_QUIET_MS+1000);
})();
