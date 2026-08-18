(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_112__)return;
  window.__NIAKGPT_CONTINUITY_112__=true;

  const CACHE_KEY='niakgpt-v08-cache',GOV_KEY='niakgpt-governance-v085',PENDING_KEY='niakgpt-continuity-pending-v100';
  let seq=0,patching=false,routeTimer=0;
  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const escLine=v=>clean(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  function rpc(path,{method='GET',body=null,timeout=15000}={}){const id=`ng112c-${Date.now()}-${++seq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});}
  async function cache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  function pending(){try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}}
  function savePending(p){try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}}
  async function makeCapsule(chatId){
    const state=window.__NIAKGPT_CONTINUITY__?.getState?.()||{},entry=state.out?.[chatId]||{},raw=await cache(),chat=(raw.chats||[]).find(c=>c?.id===chatId)||{},projectId=entry.projectId||chat.projectId||'',project=(raw.projects||[]).find(p=>p?.id===projectId)||{};
    const projectName=escLine(project.name)||'Hors projet',chatName=escLine(entry.title||chat.title)||'Conversation',history=clean(entry.history||'');
    const projectContext=[];if(clean(project.description))projectContext.push(`Description : ${clean(project.description)}`);if(clean(project.instructions))projectContext.push(`Instructions du Project : ${clean(project.instructions)}`);
    const capsule=[
      `Reprends la conversation nommée « ${projectName} > ${chatName} » exactement là où elle s’est arrêtée.`,
      'CONTINUITÉ NIAKGPT — FIL PRÉCÉDENT ARRIVÉ À SA LIMITE',
      `PROJECT EXACT À CONSERVER : ${projectName}`,
      `CONVERSATION D’ORIGINE : ${chatName}`,
      `Source : ${entry.sourceUrl||`${location.origin}/c/${chatId}`}`,
      projectContext.length?`CONTEXTE DU PROJECT\n${projectContext.join('\n')}`:'',
      'RÈGLE DE CONTINUITÉ\nCe nouveau chat appartient obligatoirement au même Project que le fil précédent. Ne propose pas un autre Project pour ce chat. Poursuis le travail déjà engagé, conserve les décisions, contraintes, éléments validés et demandes encore inachevées. Ne recommence pas les étapes déjà terminées.',
      history?`CONTEXTE COMPLET DISPONIBLE DU FIL PRÉCÉDENT\n${history}`:'CONTEXTE DU FIL PRÉCÉDENT\nHistorique local indisponible ; utilise le nom du Project, le nom du chat et le contexte du Project ci-dessus.'
    ].filter(Boolean).join('\n\n');
    return{projectId,projectName,chatName,capsule,sourceUrl:entry.sourceUrl||`${location.origin}/c/${chatId}`};
  }
  async function interceptContinue(event){
    const b=event.target instanceof Element?event.target.closest('.ng100-continue'):null;if(!b)return;
    const link=b.closest('a[href*="/c/"]'),chatId=cid(link?.getAttribute('href'))||cid(location.pathname);if(!chatId)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const data=await makeCapsule(chatId),p={schema:2,chatId,projectId:data.projectId,projectName:data.projectName,chatName:data.chatName,capsule:data.capsule,createdAt:Date.now(),sourceUrl:data.sourceUrl,patched:false,exactProject:true};savePending(p);
    document.documentElement.dataset.ng112ContinuityProject=data.projectId||'none';
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-112',`PRÊT · ${data.projectName} > ${data.chatName} · Project verrouillé`);
    location.assign(data.projectId?`/g/${encodeURIComponent(data.projectId)}/project`:'/');
  }
  async function persistExactLock(p,newId){
    try{
      const got=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]),raw=got[CACHE_KEY]||{},gov=got[GOV_KEY]||{};
      raw.chats=Array.isArray(raw.chats)?raw.chats:[];const row=raw.chats.find(c=>c?.id===newId);if(row)row.projectId=p.projectId;raw.at=Date.now();
      gov.locks={...(gov.locks||{}),[newId]:{projectId:p.projectId,at:Date.now(),source:'continuity-exact'}};
      await chrome.storage.local.set({[CACHE_KEY]:raw,[GOV_KEY]:gov});
    }catch{}
    p.patched=true;p.lockedAt=Date.now();savePending(p);document.documentElement.dataset.ng112ContinuityProject=p.projectId;
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-112',`OK · nouveau chat verrouillé sur ${p.projectName||p.projectId}`);
    setTimeout(()=>{try{sessionStorage.removeItem(PENDING_KEY);}catch{}delete document.documentElement.dataset.ng112ContinuityProject;},1200);
  }
  async function lockNewChat(attempt=0){
    if(patching)return;const p=pending(),newId=currentCid();if(!p?.exactProject||!p.projectId||!newId||newId===p.chatId)return;
    // continuity-v100 is injected just before this module and already owns the normal
    // Project PATCH. Give it one short chance to finish so 0.9.62 only adds the exact lock.
    if(!p.patched&&attempt<1){routeTimer=setTimeout(()=>lockNewChat(attempt+1),180);return;}
    patching=true;
    try{
      if(!p.patched){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(newId)}`,{method:'PATCH',body:{gizmo_id:p.projectId}});if(!r.ok)return;}
      await persistExactLock(p,newId);
    }finally{patching=false;}
  }
  function onRoute(){clearTimeout(routeTimer);routeTimer=setTimeout(()=>lockNewChat(0),120);}
  document.addEventListener('click',interceptContinue,true);window.addEventListener('popstate',onRoute);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);document.addEventListener('niakgpt:activity-changed',()=>{if((document.documentElement.dataset.ng86Activity||'ready')==='ready')onRoute();});onRoute();
})();