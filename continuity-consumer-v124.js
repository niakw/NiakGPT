(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_CONSUMER_124__)return;
  window.__NIAKGPT_CONTINUITY_CONSUMER_124__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const PENDING_KEY='niakgpt-continuity-pending-v100';
  const PENDING_STORE_KEY='niakgpt-continuity-pending-v124';
  const LOCK_KEY='niakgpt-continuity-project-lock-v124';
  const PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  const MAX_AGE=30*60*1000;
  let seq=0,consumeBusy=false,lockBusy=false,timer=0;

  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  const editorText=ed=>clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');
  const fresh=p=>!!p&&Date.now()-Number(p.createdAt||0)<MAX_AGE;

  function rpc(path,{method='GET',body=null,timeout=15000}={}){
    const id=`ng124cc-${Date.now()}-${++seq}`;
    return new Promise(resolve=>{
      const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};
      document.addEventListener('niakgpt:rpc-response',h);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }
  async function pending(){
    try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(fresh(p))return p;}catch{}
    try{const p=(await chrome.storage.local.get(PENDING_STORE_KEY))[PENDING_STORE_KEY]||null;if(fresh(p))return p;if(p)await chrome.storage.local.remove(PENDING_STORE_KEY);}catch{}
    return null;
  }
  async function clearPending(){
    try{sessionStorage.removeItem(PENDING_KEY);}catch{}
    try{await chrome.storage.local.remove(PENDING_STORE_KEY);}catch{}
  }
  async function readLock(){
    try{const p=(await chrome.storage.local.get(LOCK_KEY))[LOCK_KEY]||null;if(fresh(p))return p;if(p)await chrome.storage.local.remove(LOCK_KEY);}catch{}
    return null;
  }
  async function consumeIfInjected(){
    if(consumeBusy)return false;
    const ed=editor();if(!ed||!editorText(ed).includes('CONTINUITÉ NIAKGPT'))return false;
    consumeBusy=true;
    try{
      const p=await pending();if(!p?.capsule)return false;
      const lock={schema:1,chatId:p.chatId||'',projectId:p.projectId||'',projectName:p.projectName||'',chatName:p.chatName||'',exactProject:p.exactProject!==false&&!!p.projectId,createdAt:Number(p.createdAt||Date.now()),consumedAt:Date.now(),sourceUrl:p.sourceUrl||''};
      if(lock.projectId){
        try{await chrome.storage.local.set({[LOCK_KEY]:lock});}catch{}
        try{sessionStorage.setItem(PIN_OPEN_KEY,lock.projectId);}catch{}
      }
      await clearPending();
      document.documentElement.dataset.ng124ContinuityConsumed='1';
      window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-consommation',lock.projectId?`OK · capsule consommée une fois · verrou ${lock.projectName||lock.projectId} conservé`:'OK · capsule consommée une fois');
      return true;
    }finally{consumeBusy=false;}
  }
  async function persistLock(lock,newId){
    try{
      const got=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]),raw=got[CACHE_KEY]||{},gov=got[GOV_KEY]||{},now=Date.now();
      raw.chats=Array.isArray(raw.chats)?raw.chats:[];
      let row=raw.chats.find(c=>c?.id===newId);
      if(!row){row={id:newId,title:lock.chatName?`Suite · ${lock.chatName}`:'Nouvelle conversation',projectId:lock.projectId,href:`/g/${lock.projectId}/c/${newId}`,updated:now};raw.chats.unshift(row);}
      else{row.projectId=lock.projectId;row.href=row.href||`/g/${lock.projectId}/c/${newId}`;row.updated=Math.max(Number(row.updated||0),now);}
      raw.projectChats=raw.projectChats&&typeof raw.projectChats==='object'?raw.projectChats:{};
      const list=Array.isArray(raw.projectChats[lock.projectId])?raw.projectChats[lock.projectId]:[];
      raw.projectChats[lock.projectId]=[{...row},...list.filter(c=>c?.id!==newId)];
      raw.counts=raw.counts&&typeof raw.counts==='object'?raw.counts:{};raw.counts[lock.projectId]=Math.max(Number(raw.counts[lock.projectId]||0),raw.projectChats[lock.projectId].length);raw.at=now;
      gov.locks={...(gov.locks||{}),[newId]:{projectId:lock.projectId,at:now,source:'continuity-consumer-v124'}};
      await chrome.storage.local.set({[CACHE_KEY]:raw,[GOV_KEY]:gov});
      try{sessionStorage.setItem(PIN_OPEN_KEY,lock.projectId);}catch{}
      document.dispatchEvent(new CustomEvent('niakgpt:force-server-index',{detail:{source:'continuity-consumer-v124'}}));
    }catch{}
  }
  async function lockNewChat(){
    if(lockBusy)return;
    const newId=currentCid();if(!newId)return;
    lockBusy=true;
    try{
      const lock=await readLock();if(!lock?.projectId||!lock.chatId||newId===lock.chatId)return;
      const r=await rpc(`/backend-api/conversation/${encodeURIComponent(newId)}`,{method:'PATCH',body:{gizmo_id:lock.projectId}});
      if(!r.ok)return;
      await persistLock(lock,newId);
      try{await chrome.storage.local.remove(LOCK_KEY);}catch{}
      delete document.documentElement.dataset.ng124ContinuityConsumed;
      window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-consommation',`OK · nouveau chat verrouillé sur ${lock.projectName||lock.projectId}`);
    }finally{lockBusy=false;}
  }
  function schedule(delay=40){clearTimeout(timer);timer=setTimeout(()=>{consumeIfInjected().finally(()=>lockNewChat());},delay);}

  document.addEventListener('input',event=>{if(event.target instanceof Element&&event.target.matches('#prompt-textarea,[data-testid="prompt-textarea"]'))schedule(0);},true);
  window.addEventListener('popstate',()=>schedule(50));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(50));
  window.addEventListener('pageshow',()=>schedule(80));
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
  schedule(0);
})();
