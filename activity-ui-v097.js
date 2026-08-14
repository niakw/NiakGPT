(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_UI_097__) return;
  window.__NIAKGPT_ACTIVITY_UI_097__=true;

  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'dev';}catch{return'dev';}})();
  const CHANNEL='niakgpt-activity-v087';
  const CHAT_SEL='a[href*="/c/"]';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const ACTIVE=new Set(['loading','waiting','thinking','executing']);
  const GENERATING=new Set(['waiting','thinking','executing']);
  const PRIORITY={ready:0,loading:1,waiting:2,thinking:3,executing:4,error:5};
  const LABEL={ready:'PRÊT',loading:'CHARGEMENT',waiting:'ATTENTE',thinking:'RÉFLEXION / ANALYSE',executing:'EXÉCUTION',error:'ERREUR'};
  const bc=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null;
  const states=new Map(),remoteExpiry=new Map();

  let started=false,localState='ready',localSince=Date.now(),lastSignalAt=Date.now(),lastGrowthAt=0,lastAssistantLen=0;
  let activeObserver=null,activeRoot=null,sidebarObserver=null,sidebarNode=null;
  let mutationTimer=0,settleTimer=0,deadlineTimer=0,heartbeatTimer=0,retryTimer=0;
  let pendingMutations=[];

  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const currentChatId=()=>cidFromHref(location.pathname);
  const visible=el=>{if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const sidebarRoot=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||document.querySelector('nav');
  const mainRoot=()=>document.querySelector('main')||document.body;

  function currentProjectId(){
    const fromPath=pidFromHref(location.pathname);if(fromPath)return fromPath;
    const id=currentChatId(),side=sidebarRoot();if(!id||!side)return'';
    const link=[...side.querySelectorAll(CHAT_SEL)].find(a=>cidFromHref(a.getAttribute('href'))===id);
    return pidFromHref(link?.getAttribute('href'));
  }

  function remember(chatId,state,projectId='',at=Date.now()){
    if(!chatId)return;states.set(chatId,{state,projectId,at});
    clearTimeout(remoteExpiry.get(chatId));remoteExpiry.delete(chatId);
    if(ACTIVE.has(state)){
      const stamp=at;
      remoteExpiry.set(chatId,setTimeout(()=>{
        const now=states.get(chatId);if(!now||now.at!==stamp||!ACTIVE.has(now.state))return;
        states.set(chatId,{...now,state:'ready',at:Date.now()});decorateChat(chatId);decorateProject(now.projectId);remoteExpiry.delete(chatId);
      },60000));
    }
  }
  function broadcast(chatId,state,projectId='',at=Date.now()){if(chatId)bc?.postMessage({type:'activity',chatId,projectId,state,at});}
  function projectState(pid){
    if(!pid)return'ready';let best='ready';
    for(const info of states.values())if(info?.projectId===pid&&(PRIORITY[info.state]||0)>(PRIORITY[best]||0))best=info.state;
    const id=currentChatId();if(id&&pid===currentProjectId()&&(PRIORITY[localState]||0)>(PRIORITY[best]||0))best=localState;
    return best;
  }

  function decorateChat(id,side=sidebarRoot()){
    if(!side||!id)return;const info=states.get(id),state=info?.state||(id===currentChatId()?localState:'ready');
    for(const link of side.querySelectorAll(CHAT_SEL)){
      if(cidFromHref(link.getAttribute('href'))!==id||link.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;
      link.dataset.ng86Activity=state;link.classList.toggle('ng86-active-chat',state!=='ready');link.classList.toggle('ng86-current-chat',id===currentChatId());
    }
  }
  function decorateProject(pid,side=sidebarRoot()){
    if(!side||!pid)return;const state=projectState(pid);
    for(const link of side.querySelectorAll(PROJECT_SEL)){
      if(pidFromHref(link.getAttribute('href'))!==pid||link.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;
      link.dataset.ng86Activity=state;link.classList.toggle('ng86-active-project',state!=='ready');
    }
  }
  function decorateSidebar(side=sidebarRoot()){
    if(!side)return;
    for(const link of side.querySelectorAll(CHAT_SEL)){const id=cidFromHref(link.getAttribute('href'));if(id)decorateChat(id,side);}
    for(const link of side.querySelectorAll(PROJECT_SEL)){const pid=pidFromHref(link.getAttribute('href'));if(pid)decorateProject(pid,side);}
  }

  function renderStatus(){
    const bar=document.getElementById('ng8-status');if(!bar)return false;
    bar.dataset.ng86Activity=localState;
    const first=bar.firstElementChild;if(first&&/NiakGPT/i.test(first.textContent||''))first.innerHTML=`<b>NiakGPT</b> ${VERSION}`;
    let state=bar.querySelector('.ng86-status-state');if(!state){state=document.createElement('span');state.className='ng86-status-state';bar.appendChild(state);}
    state.textContent=LABEL[localState]||LABEL.ready;
    for(const child of [...bar.children])if(child!==state&&/^(PRÊT|PRET|EXÉCUTION|EXECUTION|DIAGNOSTIC|ATTENTE|CHARGEMENT|RÉFLEXION|REFLEXION)$/i.test((child.textContent||'').trim()))child.classList.add('ng86-old-state');
    return true;
  }

  function clearActiveTimers(){
    clearTimeout(mutationTimer);clearTimeout(settleTimer);clearTimeout(deadlineTimer);clearTimeout(heartbeatTimer);
    mutationTimer=settleTimer=deadlineTimer=heartbeatTimer=0;pendingMutations=[];
  }
  function disarmActive(){activeObserver?.disconnect();activeObserver=null;activeRoot=null;clearActiveTimers();}
  function scheduleHeartbeat(){clearTimeout(heartbeatTimer);if(!GENERATING.has(localState))return;heartbeatTimer=setTimeout(()=>{const id=currentChatId();if(id)broadcast(id,localState,currentProjectId());scheduleHeartbeat();},15000);}
  function scheduleDeadline(){
    clearTimeout(deadlineTimer);if(!ACTIVE.has(localState))return;
    const max=localState==='loading'?45000:localState==='waiting'?120000:20*60*1000;
    deadlineTimer=setTimeout(()=>{if(ACTIVE.has(localState))setState('error',true);},max);
  }

  function setState(state,force=false){
    if(localState===state&&!force)return;localState=state;localSince=Date.now();lastSignalAt=Date.now();
    const root=document.documentElement;root.dataset.ng86Activity=state;root.dataset.ng8Running=ACTIVE.has(state)?'1':'0';
    const id=currentChatId(),pid=currentProjectId();if(id){remember(id,state,pid,localSince);broadcast(id,state,pid,localSince);decorateChat(id);decorateProject(pid);}
    renderStatus();
    if(state==='loading'){
      // Navigation hydration can mutate thousands of nodes on a giant thread. Do not observe all of <main> here.
      disarmActive();scheduleDeadline();scheduleSettle(650);
    }else if(GENERATING.has(state)){
      armActive();scheduleHeartbeat();scheduleDeadline();scheduleSettle(1000);
    }else disarmActive();
  }
  function remoteState(id,state,pid='',at=Date.now()){if(!id)return;remember(id,state,pid,at);decorateChat(id);decorateProject(pid);}

  function assistantFrom(node){
    const el=node instanceof Element?node:node?.parentElement;if(!el)return null;
    if(el.matches?.('[data-message-author-role="assistant"]'))return el;
    return el.closest?.('[data-message-author-role="assistant"]')||el.querySelector?.('[data-message-author-role="assistant"]')||null;
  }
  function seedAssistant(){const nodes=mainRoot()?.querySelectorAll?.('[data-message-author-role="assistant"]')||[];const last=nodes.item?.(nodes.length-1);lastAssistantLen=(last?.innerText||last?.textContent||'').length;}
  function nodeSignal(node){
    const el=node instanceof Element?node:node?.parentElement;if(!el)return{error:false,thinking:false};
    const text=(el.textContent||el.getAttribute?.('aria-label')||'').slice(0,500);
    return{
      error:!!(el.matches?.('[role="alert"],[data-testid*="error" i]')||el.querySelector?.('[role="alert"],[data-testid*="error" i]'))&&/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(text),
      thinking:!!(el.matches?.('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]')||el.querySelector?.('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]'))
    };
  }
  function processMutations(){
    mutationTimer=0;if(!GENERATING.has(localState))return;const records=pendingMutations.splice(0);let grew=false,sawThinking=false;
    for(const record of records)for(const node of [record.target,...record.addedNodes]){
      const sig=nodeSignal(node);if(sig.error){setState('error',true);return;}if(sig.thinking)sawThinking=true;
      const assistant=assistantFrom(node);if(assistant){const len=(assistant.innerText||assistant.textContent||'').length;if(len>lastAssistantLen){lastAssistantLen=len;lastGrowthAt=lastSignalAt=Date.now();grew=true;}}
    }
    if(grew&&localState!=='executing')setState('executing',true);else if(sawThinking&&localState!=='thinking'&&localState!=='executing')setState('thinking',true);
    scheduleSettle(grew?1400:850);
  }
  function armActive(){
    const root=mainRoot();if(!root||!GENERATING.has(localState))return;if(activeObserver&&activeRoot===root)return;activeObserver?.disconnect();activeRoot=root;seedAssistant();
    activeObserver=new MutationObserver(records=>{pendingMutations.push(...records);clearTimeout(mutationTimer);mutationTimer=setTimeout(processMutations,120);});
    activeObserver.observe(root,{childList:true,subtree:true,characterData:true});
  }

  function hasStop(){for(const selector of ['button[data-testid*="stop" i]','button[aria-label*="Stop" i]','button[aria-label*="Arrêter" i]','button[aria-label*="Arreter" i]']){const el=document.querySelector(selector);if(visible(el))return true;}return false;}
  function hasThinking(){const root=mainRoot(),el=root?.querySelector?.('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]');if(!visible(el))return false;const text=(el.getAttribute('aria-label')||el.textContent||'').toLowerCase();return!text||/thinking|réflexion|reflexion|analyse|analyzing|reasoning|raisonnement|working|travail/i.test(text);}
  function hasError(){const root=mainRoot();for(const el of root?.querySelectorAll?.('[role="alert"],[data-testid*="error" i]')||[]){if(visible(el)&&/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(el.textContent||el.getAttribute('aria-label')||''))return true;}return false;}
  function conversationMounted(){const composer=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');if(!composer)return false;return !!mainRoot()?.querySelector?.('[data-message-author-role],article[data-testid^="conversation-turn-"]')||Date.now()-localSince>1300;}
  function settle(){
    settleTimer=0;if(!ACTIVE.has(localState))return;if(hasError()){setState('error',true);return;}
    if(localState==='loading'){if(conversationMounted()&&Date.now()-lastSignalAt>500){setState('ready',true);return;}scheduleSettle(500);return;}
    const stop=hasStop(),thinking=hasThinking(),quiet=Date.now()-Math.max(lastGrowthAt,lastSignalAt,localSince);
    if(stop||thinking){if(localState==='waiting'&&quiet>1000)setState('thinking',true);else if(thinking&&localState!=='thinking'&&localState!=='executing')setState('thinking',true);scheduleSettle(localState==='executing'?1200:850);return;}
    if((localState==='thinking'||localState==='executing')&&quiet>1800){setState('ready',true);return;}
    scheduleSettle(localState==='waiting'?850:700);
  }
  function scheduleSettle(delay=850){clearTimeout(settleTimer);if(ACTIVE.has(localState))settleTimer=setTimeout(settle,delay);}

  function bindSidebar(){
    const side=sidebarRoot();if(!side||side===sidebarNode)return;sidebarObserver?.disconnect();sidebarNode=side;decorateSidebar(side);
    sidebarObserver=new MutationObserver(records=>{
      const ids=new Set(),pids=new Set();
      for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const anchors=[...(node.matches?.('a')?[node]:[]),...(node.querySelectorAll?.(`${CHAT_SEL},${PROJECT_SEL}`)||[])];for(const link of anchors){const id=cidFromHref(link.getAttribute('href')),pid=pidFromHref(link.getAttribute('href'));if(id)ids.add(id);if(pid)pids.add(pid);}}
      for(const id of ids)decorateChat(id,side);for(const pid of pids)decorateProject(pid,side);
    });
    sidebarObserver.observe(side,{childList:true,subtree:true});
  }
  function refreshMounted(){bindSidebar();renderStatus();}
  function retryMounted(){
    clearTimeout(retryTimer);let count=0;const run=()=>{refreshMounted();if(document.getElementById('ng8-status')&&sidebarRoot())return;if(++count<6)retryTimer=setTimeout(run,Math.min(1200,120+count*180));};run();
  }

  function routeChanged(){lastAssistantLen=lastGrowthAt=0;refreshMounted();setState(currentChatId()?'loading':'ready',true);}
  function clickNavigation(event){
    const link=event.target instanceof Element?event.target.closest('a[href*="/c/"]'):null,id=cidFromHref(link?.getAttribute('href'));if(!id||id===currentChatId())return;
    const pid=pidFromHref(link.getAttribute('href'));remember(id,'loading',pid);broadcast(id,'loading',pid);decorateChat(id);decorateProject(pid);
  }
  function pendingClick(event){const button=event.target instanceof Element?event.target.closest('button'):null;if(!button)return;const label=`${button.getAttribute('aria-label')||''} ${button.getAttribute('data-testid')||''} ${button.title||''}`;if(/send|envoyer|submit/i.test(label))setState('waiting',true);}
  function pendingKey(event){const target=event.target,composer=target instanceof Element&&(target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||target.isContentEditable);if(composer&&event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing)setState('waiting',true);}

  function snapshot(){const rows=[];for(const[chatId,info]of states)rows.push({chatId,...info});const id=currentChatId();if(id&&!rows.some(row=>row.chatId===id))rows.push({chatId:id,state:localState,projectId:currentProjectId(),at:Date.now()});return rows.slice(-80);}

  function start(){
    if(started)return;started=true;retryMounted();
    document.addEventListener('niakgpt:activity-network',event=>{
      const d=event.detail||{},id=d.chatId||currentChatId();
      if(d.phase==='request'){if(!d.chatId||d.chatId===currentChatId())setState('waiting',true);else remoteState(id,'waiting','',d.at||Date.now());return;}
      if(d.phase==='headers'){if(!d.chatId||d.chatId===currentChatId())setState('thinking',true);else remoteState(id,'thinking','',d.at||Date.now());return;}
      if(d.phase==='error'){if(!d.chatId||d.chatId===currentChatId())setState('error',true);else remoteState(id,'error','',d.at||Date.now());}
    });
    document.addEventListener('click',pendingClick,true);document.addEventListener('click',clickNavigation,true);document.addEventListener('keydown',pendingKey,true);
    window.addEventListener('popstate',()=>setTimeout(routeChanged,0));
    if(window.navigation?.addEventListener){window.navigation.addEventListener('navigatesuccess',routeChanged);window.navigation.addEventListener('currententrychange',()=>setTimeout(routeChanged,0));}
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshMounted();if(ACTIVE.has(localState))scheduleSettle(100);}});
    bc?.addEventListener('message',event=>{
      const d=event.data;if(!d)return;
      if(d.type==='hello'){bc.postMessage({type:'snapshot',entries:snapshot(),at:Date.now()});return;}
      if(d.type==='snapshot'&&Array.isArray(d.entries)){for(const row of d.entries){if(!row?.chatId)continue;const old=states.get(row.chatId);if(!old||(row.at||0)>=(old.at||0))remember(row.chatId,row.state||'ready',row.projectId||'',row.at||Date.now());}decorateSidebar();return;}
      if(d.type==='activity'&&d.chatId)remoteState(d.chatId,d.state||'ready',d.projectId||'',d.at||Date.now());
    });
    setState(currentChatId()?'loading':'ready',true);bc?.postMessage({type:'hello',at:Date.now()});
    window.addEventListener('pagehide',()=>{const id=currentChatId();if(id)broadcast(id,'ready',currentProjectId());disarmActive();sidebarObserver?.disconnect();clearTimeout(retryTimer);bc?.close?.();},{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else queueMicrotask(start);
})();
