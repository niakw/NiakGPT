(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_112__)return;
  window.__NIAKGPT_CONTINUITY_112__=true;

  const CACHE_KEY='niakgpt-v08-cache',GOV_KEY='niakgpt-governance-v085',PENDING_KEY='niakgpt-continuity-pending-v100',PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  const STOP=new Set('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut'.split(/\s+/));
  let seq=0,patching=false,routeTimer=0;
  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=v=>norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const escLine=v=>clean(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  function rpc(path,{method='GET',body=null,timeout=15000}={}){const id=`ng112c-${Date.now()}-${++seq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});}
  async function cache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  function pending(){try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}}
  function savePending(p){try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}}
  function openProjectFolder(projectId){try{if(projectId)sessionStorage.setItem(PIN_OPEN_KEY,projectId);}catch{}}
  function recommendProject(raw,title,history){
    const projects=(raw?.projects||[]).filter(p=>String(p?.id||'').startsWith('g-p-')&&!p.domOnly);
    if(!projects.length)return null;
    const source=words(`${title}\n${String(history||'').slice(0,10000)}\n${String(history||'').slice(-12000)}`),freq=new Map();for(const w of source)freq.set(w,(freq.get(w)||0)+1);
    let best=null,bestScore=0;
    for(const p of projects){
      const nameWords=new Set(words(p.name)),descWords=new Set(words(p.description)),instructionWords=new Set(words(p.instructions));let score=0;
      for(const [w,count] of freq){const weight=Math.min(3,count);if(nameWords.has(w))score+=4*weight;if(descWords.has(w))score+=2*weight;if(instructionWords.has(w))score+=weight;}
      const pname=norm(p.name);if(pname&&norm(title).includes(pname))score+=12;
      if(score>bestScore){bestScore=score;best=p;}
    }
    return best&&bestScore>=3?{...best,score:bestScore}:null;
  }
  async function makeCapsule(chatId){
    const state=window.__NIAKGPT_CONTINUITY__?.getState?.()||{},entry=state.out?.[chatId]||{},raw=await cache(),chat=(raw.chats||[]).find(c=>c?.id===chatId)||{},originalProjectId=entry.projectId||chat.projectId||'',originalProject=(raw.projects||[]).find(p=>p?.id===originalProjectId)||{};
    const chatName=escLine(entry.title||chat.title)||'Conversation',history=clean(entry.history||''),recommended=!originalProjectId?recommendProject(raw,chatName,history):null;
    const projectId=originalProjectId||recommended?.id||'',project=originalProjectId?originalProject:(recommended||{}),projectName=escLine(project.name)||(projectId?'Project':'Hors projet'),exactProject=!!originalProjectId;
    const projectContext=[];if(clean(project.description))projectContext.push(`Description : ${clean(project.description)}`);if(clean(project.instructions))projectContext.push(`Instructions du Project : ${clean(project.instructions)}`);
    const projectRule=exactProject
      ?`PROJECT EXACT À CONSERVER : ${projectName}\nCe nouveau chat appartient obligatoirement au même Project que le fil précédent. Ne propose pas un autre Project pour ce chat.`
      :recommended
        ?`PROJECT RECOMMANDÉ PAR NIAKGPT : ${projectName}\nLe fil précédent était hors Project. NiakGPT recommande ce Project d’après le titre, l’historique et le contexte disponible ; utilise-le comme espace de continuité, sans prétendre qu’il s’agissait du Project d’origine.`
        :'PROJECT : aucun rattachement fiable détecté automatiquement. Conserve la continuité du fil sans inventer un Project d’origine.';
    const capsule=[
      `Reprends la conversation nommée « ${exactProject?projectName:'Hors projet'} > ${chatName} » exactement là où elle s’est arrêtée.`,
      'CONTINUITÉ NIAKGPT — FIL PRÉCÉDENT ARRIVÉ À SA LIMITE',
      projectRule,
      `CONVERSATION D’ORIGINE : ${chatName}`,
      `Source : ${entry.sourceUrl||`${location.origin}/c/${chatId}`}`,
      projectContext.length?`CONTEXTE DU PROJECT ${exactProject?'D’ORIGINE':'RECOMMANDÉ'}\n${projectContext.join('\n')}`:'',
      'RÈGLE DE CONTINUITÉ\nPoursuis le travail déjà engagé, conserve les décisions, contraintes, éléments validés et demandes encore inachevées. Ne recommence pas les étapes déjà terminées.',
      history?`CONTEXTE COMPLET DISPONIBLE DU FIL PRÉCÉDENT\n${history}`:'CONTEXTE DU FIL PRÉCÉDENT\nHistorique local indisponible ; utilise le nom du chat et le contexte disponible ci-dessus.'
    ].filter(Boolean).join('\n\n');
    return{projectId,projectName,chatName,capsule,sourceUrl:entry.sourceUrl||`${location.origin}/c/${chatId}`,exactProject,recommendedProjectId:recommended?.id||'',recommendedProjectName:recommended?.name||'',recommendationScore:recommended?.score||0};
  }
  async function interceptContinue(event){
    const b=event.target instanceof Element?event.target.closest('.ng100-continue'):null;if(!b)return;
    const link=b.closest('a[href*="/c/"]'),chatId=cid(link?.getAttribute('href'))||cid(location.pathname);if(!chatId)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const data=await makeCapsule(chatId),p={schema:3,chatId,projectId:data.projectId,projectName:data.projectName,chatName:data.chatName,capsule:data.capsule,createdAt:Date.now(),sourceUrl:data.sourceUrl,patched:false,exactProject:data.exactProject,recommendedProjectId:data.recommendedProjectId,recommendedProjectName:data.recommendedProjectName,recommendationScore:data.recommendationScore};savePending(p);openProjectFolder(data.projectId);
    document.documentElement.dataset.ng112ContinuityProject=data.projectId||'none';
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-112',data.exactProject?`PRÊT · ${data.projectName} > ${data.chatName} · Project verrouillé`:data.recommendedProjectId?`PRÊT · Project recommandé ${data.recommendedProjectName}`:'PRÊT · continuité hors Project');
    location.assign(data.projectId?`/g/${encodeURIComponent(data.projectId)}/project`:'/');
  }
  async function persistExactLock(p,newId){
    try{
      const got=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]),raw=got[CACHE_KEY]||{},gov=got[GOV_KEY]||{},now=Date.now();
      raw.chats=Array.isArray(raw.chats)?raw.chats:[];raw.projectChats=raw.projectChats&&typeof raw.projectChats==='object'?raw.projectChats:{};raw.counts=raw.counts&&typeof raw.counts==='object'?raw.counts:{};
      let row=raw.chats.find(c=>c?.id===newId);
      if(!row){row={id:newId,title:'Nouvelle conversation',projectId:p.projectId,href:`/g/${p.projectId}/c/${newId}`,updated:now};raw.chats.unshift(row);}else{row.projectId=p.projectId;row.href=row.href||`/g/${p.projectId}/c/${newId}`;row.updated=Math.max(Number(row.updated||0),now);}
      const list=Array.isArray(raw.projectChats[p.projectId])?raw.projectChats[p.projectId]:[];raw.projectChats[p.projectId]=[{...row},...list.filter(c=>c?.id!==newId)];raw.counts[p.projectId]=Math.max(Number(raw.counts[p.projectId]||0),raw.projectChats[p.projectId].length);
      raw.indexedProjectIds=Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[];if(!raw.indexedProjectIds.includes(p.projectId))raw.indexedProjectIds.push(p.projectId);raw.at=now;
      gov.locks={...(gov.locks||{}),[newId]:{projectId:p.projectId,at:now,source:'continuity-exact'}};
      await chrome.storage.local.set({[CACHE_KEY]:raw,[GOV_KEY]:gov});openProjectFolder(p.projectId);document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));
    }catch{}
    p.patched=true;p.lockedAt=Date.now();savePending(p);document.documentElement.dataset.ng112ContinuityProject=p.projectId;
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-112',`OK · nouveau chat visible et verrouillé sur ${p.projectName||p.projectId}`);
    setTimeout(()=>{try{sessionStorage.removeItem(PENDING_KEY);}catch{}delete document.documentElement.dataset.ng112ContinuityProject;},1800);
  }
  async function lockNewChat(attempt=0){
    if(patching)return;const p=pending(),newId=currentCid();if(!p?.exactProject||!p.projectId||!newId||newId===p.chatId)return;
    // continuity-v100 is injected just before this module and already owns the normal
    // Project PATCH. Give it one short chance to finish so v112 only adds the exact lock.
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