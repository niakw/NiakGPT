(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_086__) return;
  window.__NIAKGPT_ACTIVITY_086__ = true;

  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'0.9.5';}catch{return'0.9.5';}})();
  const CHANNEL='niakgpt-activity-v087';
  const CHAT_SEL='a[href*="/c/"]';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  const PRIORITY={ready:0,loading:1,waiting:2,thinking:3,executing:4,error:5};
  const bc=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null;
  const states=new Map(),remoteTimers=new Map();

  let localState='ready',localSince=Date.now(),lastAssistantLen=0,lastGrowthAt=0,lastSignalAt=Date.now();
  let activeObserver=null,activeRoot=null,sidebarObserver=null,sidebarRootNode=null,bootstrapObserver=null;
  let mutationTimer=0,settleTimer=0,deadlineTimer=0,heartbeatTimer=0,routeTimer=0,mountTimer=0;
  let pendingRecords=[],pendingRouteId='';

  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const currentChatId=()=>cidFromHref(location.pathname);
  const visible=el=>{if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};

  function sidebarRoot(){return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||document.querySelector('nav');}
  function mainRoot(){return document.querySelector('main')||document.body||document.documentElement;}
  function currentProjectId(){
    const fromPath=pidFromHref(location.pathname);if(fromPath)return fromPath;
    const cid=currentChatId(),root=sidebarRoot();if(!cid||!root)return'';
    const link=[...root.querySelectorAll(CHAT_SEL)].find(a=>cidFromHref(a.getAttribute('href'))===cid);
    return pidFromHref(link?.getAttribute('href'));
  }

  function remember(chatId,state,projectId='',at=Date.now()){
    if(!chatId)return;states.set(chatId,{state,projectId,at});
    clearTimeout(remoteTimers.get(chatId));remoteTimers.delete(chatId);
    if(ACTIVE.has(state)){
      const stamp=at;
      remoteTimers.set(chatId,setTimeout(()=>{
        const current=states.get(chatId);if(current?.at!==stamp||!ACTIVE.has(current.state))return;
        states.set(chatId,{...current,state:'ready',at:Date.now()});decorateChat(chatId);decorateProject(current.projectId);remoteTimers.delete(chatId);
      },50000));
    }
  }
  function broadcast(chatId,state,projectId='',at=Date.now()){if(chatId)bc?.postMessage({type:'activity',chatId,projectId,state,at});}
  function projectState(pid){
    if(!pid)return'ready';let best='ready';
    for(const info of states.values())if(info?.projectId===pid&&(PRIORITY[info.state]||0)>(PRIORITY[best]||0))best=info.state;
    const cid=currentChatId();if(pid===currentProjectId()&&cid&&(PRIORITY[localState]||0)>(PRIORITY[best]||0))best=localState;
    return best;
  }

  function matchingChatLinks(root,id){if(!root||!id)return[];return[...root.querySelectorAll(CHAT_SEL)].filter(a=>cidFromHref(a.getAttribute('href'))===id);}
  function decorateChat(id,root=sidebarRoot()){
    if(!root||!id)return;const info=states.get(id),state=info?.state||(id===currentChatId()?localState:'ready');
    for(const a of matchingChatLinks(root,id)){if(a.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;a.dataset.ng86Activity=state;a.classList.toggle('ng86-active-chat',state!=='ready');a.classList.toggle('ng86-current-chat',id===currentChatId());}
  }
  function decorateProject(pid,root=sidebarRoot()){
    if(!root||!pid)return;const state=projectState(pid);
    for(const a of root.querySelectorAll(PROJECT_SEL)){if(pidFromHref(a.getAttribute('href'))!==pid||a.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;a.dataset.ng86Activity=state;a.classList.toggle('ng86-active-project',state!=='ready');}
  }
  function decorateSidebar(root=sidebarRoot()){
    if(!root)return;
    for(const a of root.querySelectorAll(CHAT_SEL)){const id=cidFromHref(a.getAttribute('href'));if(id)decorateChat(id,root);}
    for(const a of root.querySelectorAll(PROJECT_SEL)){const pid=pidFromHref(a.getAttribute('href'));if(pid)decorateProject(pid,root);}
  }

  function renderStatus(){
    const bar=document.getElementById('ng8-status');if(!bar)return false;bar.dataset.ng86Activity=localState;
    const first=bar.firstElementChild;if(first&&/NiakGPT/i.test(first.textContent||''))first.innerHTML=`<b>NiakGPT</b> ${VERSION}`;
    let stateEl=bar.querySelector('.ng86-status-state');if(!stateEl){stateEl=document.createElement('span');stateEl.className='ng86-status-state';bar.appendChild(stateEl);}
    const labels={loading:'CHARGEMENT',waiting:'ATTENTE',thinking:'RÉFLEXION / ANALYSE',executing:'EXÉCUTION',error:'ERREUR',ready:'PRÊT'};
    stateEl.textContent=labels[localState]||'PRÊT';
    for(const child of [...bar.children]){if(child===stateEl)continue;if(/^(PRÊT|PRET|EXÉCUTION|EXECUTION|DIAGNOSTIC|ATTENTE|CHARGEMENT|RÉFLEXION|REFLEXION)$/i.test((child.textContent||'').trim()))child.classList.add('ng86-old-state');}
    return true;
  }

  function clearActiveTimers(){clearTimeout(mutationTimer);clearTimeout(settleTimer);clearTimeout(deadlineTimer);clearTimeout(heartbeatTimer);mutationTimer=settleTimer=deadlineTimer=heartbeatTimer=0;pendingRecords=[];}
  function disarmActiveObserver(){activeObserver?.disconnect();activeObserver=null;activeRoot=null;clearActiveTimers();}
  function scheduleHeartbeat(){
    clearTimeout(heartbeatTimer);if(!ACTIVE.has(localState))return;
    heartbeatTimer=setTimeout(()=>{const cid=currentChatId();if(cid)broadcast(cid,localState,currentProjectId(),Date.now());scheduleHeartbeat();},15000);
  }
  function scheduleDeadline(){
    clearTimeout(deadlineTimer);if(!ACTIVE.has(localState))return;
    const max=localState==='loading'?45000:localState==='waiting'?120000:20*60*1000;
    deadlineTimer=setTimeout(()=>{if(ACTIVE.has(localState))setState('error',{force:true});},max);
  }

  function setState(state,{force=false}={}){
    if(localState===state&&!force)return;
    localState=state;localSince=Date.now();lastSignalAt=Date.now();
    document.documentElement.dataset.ng86Activity=state;
    document.documentElement.dataset.ng8Running=ACTIVE.has(state)?'1':'0';
    const cid=currentChatId(),pid=currentProjectId();if(cid){remember(cid,state,pid,localSince);broadcast(cid,state,pid,localSince);decorateChat(cid);decorateProject(pid);}
    renderStatus();
    if(ACTIVE.has(state)){armActiveObserver();scheduleHeartbeat();scheduleDeadline();scheduleSettle(state==='loading'?700:1100);}else disarmActiveObserver();
  }
  function setRemoteState(chatId,state,projectId='',at=Date.now()){if(!chatId)return;remember(chatId,state,projectId,at);decorateChat(chatId);decorateProject(projectId);}

  function detectStopButton(){for(const selector of ['button[data-testid*="stop" i]','button[aria-label*="Stop" i]','button[aria-label*="Arrêter" i]','button[aria-label*="Arreter" i]']){const el=document.querySelector(selector);if(visible(el))return true;}return false;}
  function detectThinkingMarker(){
    const root=mainRoot(),el=root.querySelector('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]');if(!visible(el))return false;
    const txt=(el.getAttribute('aria-label')||el.textContent||'').trim().toLowerCase();return!txt||/thinking|réflexion|reflexion|analyse|analyzing|reasoning|raisonnement|working|travail/i.test(txt);
  }
  function detectErrorMarker(){
    const root=mainRoot();for(const el of root.querySelectorAll('[role="alert"],[data-testid*="error" i]')){if(!visible(el))continue;const txt=(el.textContent||el.getAttribute('aria-label')||'').trim();if(/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(txt))return true;}return false;
  }
  function latestAssistantLengthOnce(){const nodes=mainRoot().querySelectorAll('[data-message-author-role="assistant"]'),last=nodes.item(nodes.length-1);return(last?.innerText||last?.textContent||'').length;}
  function seedAssistantLength(){lastAssistantLen=latestAssistantLengthOnce();}

  function assistantFromNode(node){
    const el=node instanceof Element?node:node?.parentElement;if(!el)return null;
    if(el.matches?.('[data-message-author-role="assistant"]'))return el;
    const closest=el.closest?.('[data-message-author-role="assistant"]');if(closest)return closest;
    return el.querySelector?.('[data-message-author-role="assistant"]')||null;
  }
  function nodeSignals(node){
    const el=node instanceof Element?node:node?.parentElement;if(!el)return{error:false,thinking:false};
    const text=(el.textContent||el.getAttribute?.('aria-label')||'').slice(0,500);
    const error=(el.matches?.('[role="alert"],[data-testid*="error" i]')||el.querySelector?.('[role="alert"],[data-testid*="error" i]'))&&/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(text);
    const thinking=!!(el.matches?.('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]')||el.querySelector?.('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]'));
    return{error,thinking};
  }

  function processActiveMutations(){
    mutationTimer=0;if(!ACTIVE.has(localState))return;const records=pendingRecords.splice(0);let grew=false,sawThinking=false;
    for(const record of records){
      const nodes=[record.target,...record.addedNodes];
      for(const node of nodes){
        const sig=nodeSignals(node);if(sig.error){setState('error',{force:true});return;}if(sig.thinking)sawThinking=true;
        const assistant=assistantFromNode(node);if(assistant){const len=(assistant.innerText||assistant.textContent||'').length;if(len>lastAssistantLen){lastAssistantLen=len;lastGrowthAt=Date.now();lastSignalAt=Date.now();grew=true;}}
      }
    }
    if(grew&&localState!=='executing')setState('executing',{force:true});
    else if(sawThinking&&localState!=='thinking'&&localState!=='executing')setState('thinking',{force:true});
    scheduleSettle(grew?1500:900);
  }
  function onActiveMutations(records){pendingRecords.push(...records);clearTimeout(mutationTimer);mutationTimer=setTimeout(processActiveMutations,120);}
  function armActiveObserver(){
    const root=mainRoot();if(activeObserver&&activeRoot===root)return;activeObserver?.disconnect();activeRoot=root;seedAssistantLength();
    activeObserver=new MutationObserver(onActiveMutations);activeObserver.observe(root,{childList:true,subtree:true,characterData:true});
  }

  function conversationMounted(){
    const root=mainRoot();const composer=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');if(!composer)return false;
    const hasTurn=!!root.querySelector('[data-message-author-role],article[data-testid^="conversation-turn-"]');return hasTurn||Date.now()-localSince>1300;
  }
  function settle(){
    settleTimer=0;if(!ACTIVE.has(localState))return;
    if(detectErrorMarker()){setState('error',{force:true});return;}
    if(localState==='loading'){
      if(conversationMounted()&&Date.now()-lastSignalAt>500){setState('ready',{force:true});return;}
      scheduleSettle(500);return;
    }
    const stop=detectStopButton(),thinking=detectThinkingMarker(),quiet=Date.now()-Math.max(lastGrowthAt,lastSignalAt,localSince);
    if(stop||thinking){
      if(localState==='waiting'&&quiet>1100)setState('thinking',{force:true});
      else if(thinking&&localState!=='executing'&&localState!=='thinking')setState('thinking',{force:true});
      scheduleSettle(localState==='executing'?1200:900);return;
    }
    if((localState==='thinking'||localState==='executing')&&quiet>1800){setState('ready',{force:true});return;}
    if(localState==='waiting'){scheduleSettle(900);return;}
    scheduleSettle(700);
  }
  function scheduleSettle(delay=900){clearTimeout(settleTimer);if(ACTIVE.has(localState))settleTimer=setTimeout(settle,delay);}

  function markPendingFromComposer(event){
    const target=event.target instanceof Element?event.target:null,send=target?.closest('button');if(!send)return;
    const label=`${send.getAttribute('aria-label')||''} ${send.getAttribute('data-testid')||''} ${send.title||''}`;if(/send|envoyer|submit/i.test(label))setState('waiting',{force:true});
  }
  function markPendingFromKeyboard(event){
    const target=event.target,composer=target instanceof Element&&(target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||target.isContentEditable);
    if(composer&&event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing)setState('waiting',{force:true});
  }
  function checkPendingRoute(){
    routeTimer=0;const cid=currentChatId();if(pendingRouteId&&cid===pendingRouteId){pendingRouteId='';lastAssistantLen=0;lastGrowthAt=0;setState('loading',{force:true});return;}
    if(pendingRouteId)routeTimer=setTimeout(checkPendingRoute,180);
  }
  function markNavigationClick(event){
    const a=event.target instanceof Element?event.target.closest('a[href*="/c/"]'):null,id=cidFromHref(a?.getAttribute('href'));if(!id||id===currentChatId())return;
    const pid=pidFromHref(a.getAttribute('href'));remember(id,'loading',pid,Date.now());broadcast(id,'loading',pid);decorateChat(id);decorateProject(pid);pendingRouteId=id;clearTimeout(routeTimer);routeTimer=setTimeout(checkPendingRoute,60);
  }
  function routeChanged(){lastAssistantLen=0;lastGrowthAt=0;pendingRouteId='';setState(currentChatId()?'loading':'ready',{force:true});}

  function bindSidebar(){
    const root=sidebarRoot();if(!root||root===sidebarRootNode)return;sidebarObserver?.disconnect();sidebarRootNode=root;decorateSidebar(root);
    sidebarObserver=new MutationObserver(records=>{
      const ids=new Set(),pids=new Set();
      for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const anchors=[...(node.matches?.('a')?[node]:[]),...(node.querySelectorAll?.(`${CHAT_SEL},${PROJECT_SEL}`)||[])];for(const a of anchors){const id=cidFromHref(a.getAttribute('href')),pid=pidFromHref(a.getAttribute('href'));if(id)ids.add(id);if(pid)pids.add(pid);}}
      for(const id of ids)decorateChat(id,root);for(const pid of pids)decorateProject(pid,root);
    });
    sidebarObserver.observe(root,{childList:true,subtree:true});
  }

  function bootstrap(){
    bindSidebar();renderStatus();
    if(sidebarRootNode&&document.getElementById('ng8-status')){bootstrapObserver?.disconnect();bootstrapObserver=null;return;}
    if(bootstrapObserver)return;
    bootstrapObserver=new MutationObserver(()=>{bindSidebar();renderStatus();if(sidebarRootNode&&document.getElementById('ng8-status')){bootstrapObserver?.disconnect();bootstrapObserver=null;}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  function snapshot(){const rows=[];for(const[chatId,info]of states)rows.push({chatId,...info});const cid=currentChatId();if(cid&&!rows.some(x=>x.chatId===cid))rows.push({chatId:cid,state:localState,projectId:currentProjectId(),at:Date.now()});return rows.slice(-80);}
  bc?.addEventListener('message',event=>{
    const d=event.data;if(!d)return;
    if(d.type==='hello'){bc.postMessage({type:'snapshot',entries:snapshot(),at:Date.now()});return;}
    if(d.type==='snapshot'&&Array.isArray(d.entries)){for(const row of d.entries){if(!row?.chatId)continue;const old=states.get(row.chatId);if(!old||(row.at||0)>=(old.at||0))remember(row.chatId,row.state||'ready',row.projectId||'',row.at||Date.now());}decorateSidebar();return;}
    if(d.type==='activity'&&d.chatId)setRemoteState(d.chatId,d.state||'ready',d.projectId||'',d.at||Date.now());
  });

  document.addEventListener('niakgpt:activity-network',event=>{
    const d=event.detail||{},cid=d.chatId||currentChatId();
    if(d.phase==='request'){if(!d.chatId||d.chatId===currentChatId())setState('waiting',{force:true});else setRemoteState(cid,'waiting','',d.at||Date.now());return;}
    if(d.phase==='headers'){if(!d.chatId||d.chatId===currentChatId())setState('thinking',{force:true});else setRemoteState(cid,'thinking','',d.at||Date.now());return;}
    if(d.phase==='error'){if(!d.chatId||d.chatId===currentChatId())setState('error',{force:true});else setRemoteState(cid,'error','',d.at||Date.now());}
  });
  document.addEventListener('click',markPendingFromComposer,true);
  document.addEventListener('click',markNavigationClick,true);
  document.addEventListener('keydown',markPendingFromKeyboard,true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindSidebar();renderStatus();if(ACTIVE.has(localState))scheduleSettle(100);}});
  window.addEventListener('popstate',()=>setTimeout(routeChanged,0));
  window.addEventListener('pagehide',()=>{const cid=currentChatId();if(cid)broadcast(cid,'ready',currentProjectId(),Date.now());disarmActiveObserver();sidebarObserver?.disconnect();bootstrapObserver?.disconnect();}, {once:true});

  bootstrap();
  setState(currentChatId()?'loading':'ready',{force:true});
  bc?.postMessage({type:'hello',at:Date.now()});
})();
