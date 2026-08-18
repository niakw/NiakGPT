(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_OUT_CACHE_110__)return;
  window.__NIAKGPT_CONTINUITY_OUT_CACHE_110__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  let state={out:{}},timer=0,running=false,pending=false;

  function applyFlags(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    const out=state?.out||{};
    let changed=false;
    const patch=c=>{
      if(!c?.id||!out[c.id])return c;
      const e=out[c.id]||{};
      const updatedAt=Number(e.updatedAt||Date.now());
      if(c.out===true&&c.outUpdatedAt===updatedAt&&c.outReason===(e.reason||'limit-detected'))return c;
      changed=true;
      return {...c,out:true,outReason:e.reason||'limit-detected',outUpdatedAt:updatedAt,outTitle:e.title||c.title||''};
    };
    const chats=(raw.chats||[]).map(patch);
    const projectChats={...(raw.projectChats||{})};
    for(const [pid,list] of Object.entries(projectChats))projectChats[pid]=(list||[]).map(patch);
    return changed?{...raw,at:Date.now(),chats,projectChats}:raw;
  }
  async function sync(){
    if(running){pending=true;return;}running=true;
    try{
      const bus=window.__NIAKGPT_CACHE_BUS__;
      if(bus?.get&&bus?.update){const current=await bus.get(),next=applyFlags(current);if(next!==current)await bus.update(()=>next);}else{
        const got=await chrome.storage.local.get(CACHE_KEY),raw=got?.[CACHE_KEY]||{};
        const next=applyFlags(raw);if(next!==raw)await chrome.storage.local.set({[CACHE_KEY]:next});
      }
    }catch{}finally{running=false;if(pending){pending=false;schedule(20);}}
  }
  function schedule(delay=30){clearTimeout(timer);timer=setTimeout(sync,delay);}
  async function init(){try{const got=await chrome.storage.local.get(OUT_KEY);state=got?.[OUT_KEY]||state;state.out=state.out||{};}catch{}schedule(0);}
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes[OUT_KEY]){state=changes[OUT_KEY].newValue||{out:{}};state.out=state.out||{};schedule(0);return;}
    if(changes[CACHE_KEY]&&Object.keys(state.out||{}).length)schedule(40);
  });
  init();
})();
