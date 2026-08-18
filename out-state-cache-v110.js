(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_OUT_CACHE_110__)return;
  window.__NIAKGPT_OUT_CACHE_110__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OUT_KEY='niakgpt-continuity-v100';
  let syncing=false,pending=null;

  function patchChat(chat,out){
    if(!chat?.id)return chat;
    const entry=out?.[chat.id];
    const nextOut=!!entry;
    const nextAt=Number(entry?.updatedAt||entry?.outAt||0)||0;
    const nextReason=String(entry?.reason||'');
    if(!!chat.out===nextOut&&Number(chat.outAt||0)===nextAt&&String(chat.outReason||'')===nextReason)return chat;
    const next={...chat,out:nextOut};
    if(nextOut){next.outAt=nextAt;next.outReason=nextReason;}
    else{delete next.outAt;delete next.outReason;}
    return next;
  }

  async function sync(state){
    pending=state&&typeof state==='object'?state:{out:{}};
    if(syncing)return;
    syncing=true;
    try{
      while(pending){
        const current=pending;pending=null;const out=current.out&&typeof current.out==='object'?current.out:{};
        const update=raw=>{
          raw=raw&&typeof raw==='object'?raw:{};let changed=false;
          const chats=(raw.chats||[]).map(chat=>{const next=patchChat(chat,out);if(next!==chat)changed=true;return next;});
          const projectChats={...(raw.projectChats||{})};
          for(const [pid,list] of Object.entries(projectChats))projectChats[pid]=(list||[]).map(chat=>{const next=patchChat(chat,out);if(next!==chat)changed=true;return next;});
          return changed?{...raw,at:Date.now(),chats,projectChats}:raw;
        };
        try{
          const bus=window.__NIAKGPT_CACHE_BUS__;
          if(bus?.update)await bus.update(update);
          else{const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];const next=update(raw);if(next!==raw)await chrome.storage.local.set({[CACHE_KEY]:next});}
        }catch{}
      }
    }finally{syncing=false;}
  }

  try{chrome.storage.local.get(OUT_KEY).then(g=>sync(g?.[OUT_KEY]||{out:{}})).catch(()=>{});}catch{}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[OUT_KEY])sync(changes[OUT_KEY].newValue||{out:{}});});
})();
