(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_086__) return;
  window.__NIAKGPT_ACTIVITY_086__ = true;

  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'dev';}catch{return'dev';}})();
  const CHANNEL='niakgpt-activity-v087';
  const CHAT_SEL='a[href*="/c/"]';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  const PRIORITY={ready:0,loading:1,waiting:2,thinking:3,executing:4,error:5};
  const labels={loading:'CHARGEMENT',waiting:'ATTENTE',thinking:'RÉFLEXION / ANALYSE',executing:'EXÉCUTION',error:'ERREUR',ready:'PRÊT'};
  const bc=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null;
  const states=new Map(),projectByChat=new Map(),expiry=new Map();

  let started=false,localState='ready',localAt=Date.now(),lastGrowthAt=0,lastAssistantLen=0;
  let activeObserver=null,sidebarObserver=null,bootObserver=null,settleTimer=0,routeTimer=0;

  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const currentChat=()=>cid(location.pathname);
  const sidebar=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||document.querySelector('nav');
  const main=()=>document.querySelector('main')||document.body;

  function projectForChat(id=currentChat()){
    if(!id)return'';
    const pathProject=pid(location.pathname);if(pathProject)return pathProject;
    if(projectByChat.has(id))return projectByChat.get(id)||'';
    const root=sidebar(),link=root?[...root.querySelectorAll(CHAT_SEL)].find(a=>cid(a.getAttribute('href'))===id):null;
    return pid(link?.getAttribute('href'));
  }

  function remember(id,state,projectId='',at=Date.now()){
    if(!id)return;
    states.set(id,{state,projectId:projectId||projectForChat(id),at});
    clearTimeout(expiry.get(id));expiry.delete(id);
    if(ACTIVE.has(state))expiry.set(id,setTimeout(()=>{
      const cur=states.get(id);if(!cur||cur.at!==at||!ACTIVE.has(cur.state))return;
      // A current chat that is still natively busy must never age out merely because
      // the response/tool call is long. Refresh the stale-state guard instead.
      if(id===currentChat()&&ACTIVE.has(localState)){remember(id,localState,cur.projectId,localAt);return;}
      states.set(id,{...cur,state:'ready',at:Date.now()});decorateChat(id);decorateProject(cur.projectId);expiry.delete(id);
    },60000));
  }

  function projectState(projectId){
    if(!projectId)return'ready';let best='ready';
    for(const info of states.values())if(info.projectId===projectId&&(PRIORITY[info.state]||0)>(PRIORITY[best]||0))best=info.state;
    return best;
  }

  function decorateChat(id,root=sidebar()){
    if(!root||!id)return;const state=states.get(id)?.state||(id===currentChat()?localState:'ready');
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(cid(a.getAttribute('href'))!==id||a.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;
      a.dataset.ng86Activity=state;a.classList.toggle('ng86-active-chat',state!=='ready');a.classList.toggle('ng86-current-chat',id===currentChat());
    }
  }
  function decorateProject(projectId,root=sidebar()){
    if(!root||!projectId)return;const state=projectState(projectId);
    for(const a of root.querySelectorAll(PROJECT_SEL)){
      if(pid(a.getAttribute('href'))!==projectId||a.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;
      a.dataset.ng86Activity=state;a.classList.toggle('ng86-active-project',state!=='ready');
    }
  }
  function decorateSidebar(root=sidebar()){
    if(!root)return;
    for(const a of root.querySelectorAll(CHAT_SEL)){const id=cid(a.getAttribute('href'));if(id)decorateChat(id,root);}
    for(const a of root.querySelectorAll(PROJECT_SEL)){const projectId=pid(a.getAttribute('href'));if(projectId)decorateProject(projectId,root);}
  }

  function renderStatus(){
    const bar=document.getElementById('ng8-status');if(!bar)return false;
    bar.dataset.ng86Activity=localState;
    const version=bar.querySelector('.ng8-version')||bar.firstElementChild;
    if(version&&/NiakGPT/i.test(version.textContent||''))version.innerHTML=`<b>NiakGPT</b> ${VERSION}`;
    let stateEl=bar.querySelector('.ng86-status-state');
    if(!stateEl){stateEl=document.createElement('span');stateEl.className='ng86-status-state';bar.appendChild(stateEl);}
    stateEl.textContent=labels[localState]||labels.ready;
    for(const child of [...bar.children])if(child!==stateEl&&/^(PRÊT|PRET|EXÉCUTION|EXECUTION|DIAGNOSTIC|ATTENTE|CHARGEMENT|RÉFLEXION|REFLEXION)$/i.test((child.textContent||'').trim()))child.classList.add('ng86-old-state');
    window.__NIAKGPT_DIAGNOSTICS__?.set('activity',`${labels[localState]||labels.ready} · ${currentChat()?'conversation':'hors conversation'}`);
    return true;
  }

  function stopObserver(){activeObserver?.disconnect();activeObserver=null;clearTimeout(settleTimer);settleTimer=0;}
  function assistantLength(){const root=main();if(!root)return 0;const nodes=root.querySelectorAll('[data-message-author-role="assistant"]'),last=nodes.item(nodes.length-1);return(last?.innerText||last?.textContent||'').length;}
  function hasThinking(){const root=main();return!!root?.querySelector('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]');}
  function hasStop(){return!!document.querySelector('button[data-testid*="stop" i],button[aria-label*="Stop" i],button[aria-label*="Arrêter" i],button[aria-label*="Arreter" i]');}
  function hasError(){const root=main();if(!root)return false;return[...root.querySelectorAll('[role="alert"],[data-testid*="error" i]')].some(el=>/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(el.textContent||el.getAttribute('aria-label')||''));}

  function scheduleSettle(delay=900){clearTimeout(settleTimer);if(ACTIVE.has(localState))settleTimer=setTimeout(settle,delay);}
  function settle(){
    settleTimer=0;if(!ACTIVE.has(localState))return;
    if(hasError()){setState('error',{force:true});return;}
    if(localState==='loading'){
      const mounted=!!document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')&&!!main()?.querySelector('[data-message-author-role],article[data-testid^="conversation-turn-"]');
      if(mounted&&Date.now()-localAt>450){setState('ready',{force:true});return;}scheduleSettle(350);return;
    }
    const len=assistantLength();
    if(len>lastAssistantLen){lastAssistantLen=len;lastGrowthAt=Date.now();if(localState!=='executing')setState('executing',{force:true});scheduleSettle(900);return;}
    const nativeBusy=hasThinking()||hasStop();
    if(nativeBusy){if(localState==='waiting'){setState('thinking',{force:true});return;}scheduleSettle(900);return;}
    const quiet=Date.now()-Math.max(lastGrowthAt,localAt);
    if(localState==='waiting'){scheduleSettle(700);return;}
    if((localState==='thinking'||localState==='executing')&&quiet>3200){setState('ready',{force:true});return;}
    scheduleSettle(700);
  }
  function armObserver(){
    const root=main();if(!root||activeObserver)return;lastAssistantLen=assistantLength();
    activeObserver=new MutationObserver(()=>{if(ACTIVE.has(localState))scheduleSettle(120);});
    activeObserver.observe(root,{childList:true,subtree:true,characterData:true});
  }

  function setState(state,{force=false,remote=false}={}){
    if(!started&&!remote)return;
    if(localState===state&&!force&&!remote)return;
    if(!remote){
      localState=state;localAt=Date.now();
      document.documentElement.dataset.ng86Activity=state;
      document.documentElement.dataset.ng8Running=ACTIVE.has(state)?'1':'0';
      const id=currentChat(),projectId=projectForChat(id);if(id){remember(id,state,projectId,localAt);bc?.postMessage({type:'activity',chatId:id,projectId,state,at:localAt});decorateChat(id);decorateProject(projectId);}
      renderStatus();
      if(ACTIVE.has(state)){armObserver();scheduleSettle(state==='loading'?500:700);}else stopObserver();
    }
  }

  function applyRemote(d){
    if(!d?.chatId)return;remember(d.chatId,d.state||'ready',d.projectId||'',d.at||Date.now());decorateChat(d.chatId);decorateProject(d.projectId||'');
  }

  function bindSidebar(){
    const root=sidebar();if(!root||root.dataset.ng86Bound==='1')return !!root;
    root.dataset.ng86Bound='1';decorateSidebar(root);
    sidebarObserver?.disconnect();sidebarObserver=new MutationObserver(records=>{
      const ids=new Set(),projects=new Set();
      for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;for(const a of [...(node.matches?.('a')?[node]:[]),...(node.querySelectorAll?.(`${CHAT_SEL},${PROJECT_SEL}`)||[])]){const id=cid(a.getAttribute('href')),projectId=pid(a.getAttribute('href'));if(id)ids.add(id);if(projectId)projects.add(projectId);}}
      for(const id of ids)decorateChat(id,root);for(const projectId of projects)decorateProject(projectId,root);
    });sidebarObserver.observe(root,{childList:true,subtree:true});return true;
  }

  function bindCache(){
    window.__NIAKGPT_CACHE_BUS__?.subscribe(raw=>{
      projectByChat.clear();
      for(const chat of raw?.chats||[])if(chat?.id)projectByChat.set(chat.id,chat.projectId||chat.gizmo_id||'');
      for(const [projectId,list] of Object.entries(raw?.projectChats||{}))for(const chat of list||[])if(chat?.id)projectByChat.set(chat.id,chat.projectId||projectId);
      decorateSidebar();
    });
  }

  function markNavigation(event){
    const a=event.target instanceof Element?event.target.closest('a[href*="/c/"]'):null,id=cid(a?.getAttribute('href'));if(!id||id===currentChat())return;
    const projectId=projectForChat(id);remember(id,'loading',projectId,Date.now());bc?.postMessage({type:'activity',chatId:id,projectId,state:'loading',at:Date.now()});decorateChat(id);decorateProject(projectId);
    clearTimeout(routeTimer);routeTimer=setTimeout(()=>setState(currentChat()?'loading':'ready',{force:true}),80);
  }

  function start(){
    if(started)return;started=true;
    bindCache();bindSidebar();renderStatus();
    if(!document.getElementById('ng8-status')||!sidebar()){
      bootObserver=new MutationObserver(()=>{bindSidebar();renderStatus();if(document.getElementById('ng8-status')&&sidebar()){bootObserver?.disconnect();bootObserver=null;}});
      bootObserver.observe(document.body||document.documentElement,{childList:true,subtree:true});setTimeout(()=>{bootObserver?.disconnect();bootObserver=null;},10000);
    }
    bc?.addEventListener('message',event=>{const d=event.data;if(d?.type==='activity')applyRemote(d);});
    document.addEventListener('niakgpt:activity-network',event=>{
      const d=event.detail||{};
      if(d.chatId&&d.chatId!==currentChat()){applyRemote({type:'activity',chatId:d.chatId,state:d.phase==='error'?'error':d.phase==='headers'?'thinking':'waiting',at:d.at||Date.now()});return;}
      if(d.phase==='request')setState('waiting',{force:true});
      else if(d.phase==='headers')setState('thinking',{force:true});
      else if(d.phase==='error')setState('error',{force:true});
    });
    document.addEventListener('click',event=>{
      const button=event.target instanceof Element?event.target.closest('button'):null;
      if(button&&/send|envoyer|submit/i.test(`${button.getAttribute('aria-label')||''} ${button.getAttribute('data-testid')||''} ${button.title||''}`))setState('waiting',{force:true});
      markNavigation(event);
    },true);
    document.addEventListener('keydown',event=>{
      const target=event.target instanceof Element?event.target:null,composer=target&&(target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||target.isContentEditable);
      if(composer&&event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing)setState('waiting',{force:true});
    },true);
    window.addEventListener('popstate',()=>setTimeout(()=>setState(currentChat()?'loading':'ready',{force:true}),0));
    window.addEventListener('pagehide',()=>{const id=currentChat(),projectId=projectForChat(id);if(id)bc?.postMessage({type:'activity',chatId:id,projectId,state:'ready',at:Date.now()});stopObserver();sidebarObserver?.disconnect();bootObserver?.disconnect();},{once:true});
    setState(currentChat()?'loading':'ready',{force:true});bc?.postMessage({type:'hello',at:Date.now()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else queueMicrotask(start);
})();
