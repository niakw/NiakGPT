(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_LIVE_126__)return;
  window.__NIAKGPT_CONTINUITY_LIVE_126__=true;
  // This module is the runtime handoff owner. The older v112 module remains in the
  // repository for regression labs, but must not register a competing click handler.
  window.__NIAKGPT_CONTINUITY_112__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PENDING_KEY='niakgpt-continuity-pending-v100';
  const PENDING_STORE_KEY='niakgpt-continuity-pending-v124';
  const PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  let injectTimer=0,routeEpoch=0,rpcSeq=0;

  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const normalizePid=v=>{const s=String(v||'').trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  const editorText=ed=>clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');
  const outsideOwn=el=>!!el&&!el.closest?.('#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng119-interruption');

  function setEditor(ed,text){
    if(!ed)return false;
    try{
      if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}
      else{ed.focus();ed.textContent=text;}
      ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));ed.dispatchEvent(new Event('change',{bubbles:true}));return editorText(ed).includes('CONTINUITÉ NIAKGPT');
    }catch{return false;}
  }
  function rpc(path,{timeout=7000}={}){
    const id=`ng126-cont-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=event=>{if(event.detail?.id!==id)return;off();resolve(event.detail);};
      const off=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method:'GET',governance:true}}));
    });
  }
  async function cache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function storePending(p){
    try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}
    try{await chrome.storage.local.set({[PENDING_STORE_KEY]:p});}catch{}
    if(p.projectId)try{sessionStorage.setItem(PIN_OPEN_KEY,p.projectId);}catch{}
    return p;
  }
  async function pending(){
    try{const fast=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(fast?.capsule&&Date.now()-Number(fast.createdAt||0)<30*60*1000)return fast;}catch{}
    try{const p=(await chrome.storage.local.get(PENDING_STORE_KEY))[PENDING_STORE_KEY]||null;return p?.capsule&&Date.now()-Number(p.createdAt||0)<30*60*1000?p:null;}catch{return null;}
  }
  async function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}try{await chrome.storage.local.remove?.(PENDING_STORE_KEY);}catch{}}

  function projectFromRenderedChat(chatId){
    const links=[...document.querySelectorAll('#ng8-pins a[data-chat],#ng8-pins a[href*="/c/"]')];
    const link=links.find(a=>(a.dataset.chat||cid(a.getAttribute('href')))==chatId);if(!link)return'';
    const row=link.closest('.ng96-pin-entry,[data-pid],[data-project-id]');
    const direct=normalizePid(row?.dataset?.pid||row?.dataset?.projectId||'');if(direct)return direct;
    const projectLink=row?.querySelector?.('a[data-ng8-pin],a[href*="/g/g-p-"]');
    return normalizePid(String(projectLink?.getAttribute('href')||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  }
  function projectFromProjectChats(raw,chatId){
    for(const [projectId,list] of Object.entries(raw?.projectChats||{}))if((list||[]).some(c=>c?.id===chatId))return normalizePid(projectId);
    return'';
  }
  const rowsFrom=data=>Array.isArray(data?.items)?data.items:Array.isArray(data?.conversations)?data.conversations:[];
  const cursorFrom=data=>data?.cursor??data?.next_cursor??data?.nextCursor??null;
  async function projectFromServer(raw,chatId){
    const projects=(raw?.projects||[]).filter(p=>normalizePid(p?.id).startsWith('g-p-')&&!p?.domOnly);
    if(!projects.length)return{projectId:'',complete:false};
    const started=performance.now(),budget=7800,seenCursors=new Set();let complete=true;
    for(const project of projects){
      const projectId=normalizePid(project.id);let cursor=null;
      for(let page=0;page<80&&performance.now()-started<budget;page++){
        const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
        const result=await rpc(`/backend-api/gizmos/${encodeURIComponent(projectId)}/conversations?${qs}`,{timeout:Math.max(1200,Math.min(7000,budget-(performance.now()-started)+300))});
        if(!result?.ok){complete=false;break;}
        const rows=rowsFrom(result.data);if(rows.some(row=>clean(row?.id||row?.conversation_id)===chatId))return{projectId,complete:true};
        const next=cursorFrom(result.data);if(!rows.length||next==null||next==='')break;
        const key=`${projectId}:${String(next)}`;if(seenCursors.has(key))break;seenCursors.add(key);cursor=next;
      }
      if(performance.now()-started>=budget){complete=false;break;}
    }
    return{projectId:'',complete};
  }
  async function resolveProject(raw,chatId,entry,chat){
    const local=normalizePid(entry.projectId||chat.projectId||chat.gizmo_id||projectFromProjectChats(raw,chatId)||projectFromRenderedChat(chatId)||'');
    if(local)return{projectId:local,source:'local'};
    // At a hard conversation limit there is no generation left to protect. A bounded,
    // one-shot lookup is preferable to silently losing the exact Project relation.
    const remote=await projectFromServer(raw,chatId);
    if(remote.projectId)return{projectId:remote.projectId,source:'project-list'};
    return{projectId:'',source:remote.complete?'confirmed-outside-project':'unresolved'};
  }

  function nativeNavigate(projectId){
    const path=projectId?`/g/${encodeURIComponent(projectId)}/project`:'/';
    const links=[...document.querySelectorAll('a[href]')].filter(outsideOwn);
    const exact=links.find(a=>{try{return new URL(a.getAttribute('href')||a.href,location.href).pathname===path;}catch{return false;}});
    const project=projectId?links.find(a=>normalizePid(String(a.getAttribute('href')||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'')===projectId):null;
    const target=exact||project;
    if(target instanceof HTMLElement){target.click();return true;}
    location.assign(path);return false;
  }

  async function makePending(chatId){
    const raw=await cache(),state=window.__NIAKGPT_CONTINUITY__?.getState?.()||{},entry=state.out?.[chatId]||{},chat=(raw.chats||[]).find(c=>c?.id===chatId)||{};
    const relation=await resolveProject(raw,chatId,entry,chat),projectId=relation.projectId;
    if(relation.source==='unresolved'){
      window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-126','ATTENTE · relation Project non résolue, aucun changement de page');
      return{unresolved:true,chatId};
    }
    const project=(raw.projects||[]).find(p=>normalizePid(p?.id)===projectId)||{};
    const baseCapsule=window.__NIAKGPT_CONTINUITY__?.buildCapsule?.(chatId,projectId,entry.history||'');
    if(!baseCapsule)return null;
    const projectName=clean(project.name)||'';
    const capsule=projectId
      ?`CONTINUITÉ NIAKGPT — FIL PRÉCÉDENT ARRIVÉ À SA LIMITE\n\nPROJECT EXACT À CONSERVER : ${projectName||projectId}\nCe nouveau chat appartient obligatoirement au même Project que le fil précédent.\n\n${baseCapsule}`
      :baseCapsule;
    return{schema:4,chatId,projectId,projectName,chatName:clean(entry.title||chat.title)||'Conversation',capsule,createdAt:Date.now(),sourceUrl:entry.sourceUrl||`${location.origin}/c/${chatId}`,patched:false,exactProject:!!projectId,relationSource:relation.source,source:'continuity-live-v126'};
  }

  async function continueFromButton(button){
    const link=button.closest('a[href*="/c/"]'),chatId=cid(link?.getAttribute('href'))||cid(location.pathname);if(!chatId)return false;
    button.disabled=true;button.textContent='PRÉPARATION…';
    const p=await makePending(chatId);
    if(p?.unresolved){button.disabled=false;button.textContent='RÉESSAYER LA CONTINUITÉ';return false;}
    if(!p){button.disabled=false;button.textContent='CONTINUER LE FIL';return false;}
    await storePending(p);
    document.documentElement.dataset.ng126Continuity='handoff';
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-126',p.projectId?`PRÊT · handoff vers ${p.projectName||p.projectId} · ${p.relationSource}`:'PRÊT · chat confirmé hors Project');
    nativeNavigate(p.projectId);armInjection('handoff');return true;
  }

  async function injectPending(attempt=0,epoch=routeEpoch){
    clearTimeout(injectTimer);if(epoch!==routeEpoch)return false;
    const p=await pending();if(!p?.capsule)return false;
    const ed=editor();
    if(ed){
      const current=editorText(ed);
      if(current.includes('CONTINUITÉ NIAKGPT')){document.documentElement.dataset.ng126Continuity='ready';return true;}
      const text=current?`${p.capsule}\n\nBROUILLON PRÉSERVÉ AVANT CONTINUITÉ\n${current}`:p.capsule;
      if(setEditor(ed,text)){
        await clearPending();document.documentElement.dataset.ng126Continuity='ready';
        window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-126',`OK · contexte injecté${p.projectId?` · ${p.projectName||p.projectId}`:''} · aucun envoi automatique`);return true;
      }
    }
    if(attempt<50)injectTimer=setTimeout(()=>injectPending(attempt+1,epoch),Math.min(900,100+attempt*18));
    return false;
  }
  function armInjection(source='route'){const epoch=++routeEpoch;setTimeout(()=>injectPending(0,epoch),source==='handoff'?80:140);}

  window.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('.ng100-continue'):null;if(!button)return;
    const interruption=button.closest('#ng119-interruption[data-type="limit"],[data-ng125-limit="1"]');
    const outLink=button.closest('a[data-ng100-out="1"]');if(!interruption&&!outLink)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();continueFromButton(button);
  },true);

  window.addEventListener('popstate',()=>armInjection('popstate'));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>armInjection('navigation'));
  window.addEventListener('pageshow',()=>armInjection('pageshow'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)armInjection('visible');});
  armInjection('init');
})();