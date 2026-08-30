/* NiakGPT — OUT conversations + local continuity capsule.
 * v120 hardening: normal conversation prose can never mark a chat OUT.
 */
(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CONTINUITY_100__) return;
  window.__NIAKGPT_CONTINUITY_100__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const STATE_KEY='niakgpt-continuity-v100';
  const PENDING_KEY='niakgpt-continuity-pending-v100';
  const PENDING_STORE_KEY='niakgpt-continuity-pending-v124';
  const CHAT_SEL='a[href*="/c/"]';
  const SIGNAL_SEL='[role="alert"],[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i]';
  const OUT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|conversation.{0,32}(?:limit|maximum)|maximum\s+context\s+length|context\s+window.{0,30}(?:limit|maximum)|start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|you(?:'|’)ve\s+reached.{0,40}(?:limit|maximum)|conversation\s+trop\s+longue|limite.{0,28}(?:conversation|contexte)|(?:nouveau|nouvelle)\s+(?:chat|conversation).{0,35}(?:continuer|poursuivre)|ce\s+fil.{0,24}(?:plein|limite))/i;
  const MAX_HISTORY=30000;
  const EVIDENCE='native-limit-v120';
  let cache={projects:[],chats:[]}, state={schema:2,out:{}}, scanTimer=0, sidebarObserver=null, mainObserver=null, composerObserver=null, rpcSeq=0;

  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[A-Za-z0-9_-]+)\/(?:project|c\/)/)?.[1]||'';
  const currentCid=()=>cid(location.pathname);
  const currentPid=()=>pid(location.pathname)||cache.chats?.find?.(c=>c.id===currentCid())?.projectId||'';
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(CHAT_SEL))||document.querySelector('nav');
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  const visible=el=>{if(!(el instanceof Element)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const ownNode=el=>el instanceof Element&&!!el.closest('#ng119-interruption,#ng8-pins,#ng8-panel,#ng90-control,#ng100-command,#ng8-coach');

  function setEditor(ed,text){
    if(!ed)return false;
    try{
      if('value' in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}
      else{ed.focus();ed.textContent=text;}
      ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
      return true;
    }catch{return false;}
  }
  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng100c-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});
  }
  function projectInfo(projectId){return (cache.projects||[]).find(p=>p.id===projectId)||{};}
  function chatInfo(chatId){return (cache.chats||[]).find(c=>c.id===chatId)||{};}
  function historyFromDOM(){
    const main=document.querySelector('main');if(!main)return'';
    const rows=[];
    for(const el of main.querySelectorAll('[data-message-author-role]')){
      const role=el.getAttribute('data-message-author-role');if(role!=='user'&&role!=='assistant')continue;
      const text=clean(el.innerText||el.textContent);if(!text)continue;
      rows.push(`${role==='user'?'UTILISATEUR':'ASSISTANT'}\n${text}`);
    }
    const full=rows.join('\n\n---\n\n');
    if(full.length<=MAX_HISTORY)return full;
    const head=Math.floor(MAX_HISTORY*.42),tail=MAX_HISTORY-head;
    return `${full.slice(0,head)}\n\n[… HISTORIQUE CENTRAL TRONQUÉ PAR NIAKGPT …]\n\n${full.slice(-tail)}`;
  }
  function currentTitle(chatId){const c=chatInfo(chatId);if(clean(c.title))return clean(c.title);const link=[...document.querySelectorAll(CHAT_SEL)].find(a=>cid(a.getAttribute('href'))===chatId);return clean(link?.textContent||document.title.replace(/\s*[|·-]\s*ChatGPT.*$/i,''))||'Conversation';}
  function buildCapsule(chatId=currentCid(), projectId=currentPid(), historyOverride=''){
    const p=projectInfo(projectId),title=currentTitle(chatId),history=historyOverride||historyFromDOM(),source=`${location.origin}/c/${chatId}`;
    const projectLines=[];
    if(clean(p.description))projectLines.push(`Description : ${clean(p.description)}`);
    if(clean(p.instructions))projectLines.push(`Instructions du Project : ${clean(p.instructions)}`);
    return [
      'CONTINUITÉ NIAKGPT — REPRENDRE LE FIL PRÉCÉDENT',
      `PROJECT > ${clean(p.name)||'Hors projet'} > ${title}`,
      `Source : ${source}`,
      projectLines.length?`CONTEXTE DU PROJECT\n${projectLines.join('\n')}`:'',
      'INSTRUCTION DE CONTINUITÉ\nPoursuis exactement le travail engagé dans l’ancien fil. Considère le contexte ci-dessous comme la continuité directe de la conversation précédente. Préserve les décisions, contraintes, demandes non terminées et éléments déjà validés. Ne recommence pas inutilement ce qui est déjà fait.',
      history?`HISTORIQUE DU FIL PRÉCÉDENT\n${history}`:'HISTORIQUE DU FIL PRÉCÉDENT\nIndisponible dans le DOM local ; utilise le titre, le Project et le contexte ci-dessus.'
    ].filter(Boolean).join('\n\n');
  }
  async function saveState(){try{await chrome.storage.local.set({[STATE_KEY]:state});}catch{}}
  function migrateState(){
    let changed=false;state=state&&typeof state==='object'?state:{schema:2,out:{}};state.out=state.out&&typeof state.out==='object'?state.out:{};
    if(Number(state.schema||0)<2){for(const [id,entry] of Object.entries(state.out)){if(entry?.evidence!==EVIDENCE){delete state.out[id];changed=true;}}state.schema=2;changed=true;}
    return changed;
  }
  function markStored(chatId,entry){if(!chatId)return;state.out[chatId]={...(state.out[chatId]||{}),...entry,out:true,evidence:EVIDENCE,updatedAt:Date.now()};}
  function trustedSignalNode(el){
    if(!(el instanceof Element)||!visible(el)||ownNode(el)||el.closest('[data-message-author-role],[data-testid^="conversation-turn"],article'))return false;
    if(!el.matches(SIGNAL_SEL))return false;
    const text=clean(`${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('title')||''} ${el.innerText||el.textContent||''}`).slice(0,1800);
    if(!text||!OUT_RX.test(text))return false;
    if(el.matches('[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i]'))return true;
    return el.matches('[role="alert"]');
  }
  function limitSignal(){
    const main=document.querySelector('main');if(!main)return null;const nodes=[...main.querySelectorAll(SIGNAL_SEL)];
    for(let i=nodes.length-1;i>=Math.max(0,nodes.length-12);i--)if(trustedSignalNode(nodes[i]))return nodes[i];
    return null;
  }
  async function markCurrentOut(reason='limit-detected-v120',meta={}){
    const trusted=meta?.trusted===true&&meta?.evidence===EVIDENCE,signal=limitSignal();
    if(!trusted&&!signal)return false;
    const chatId=currentCid();if(!chatId)return false;
    const projectId=currentPid(),history=historyFromDOM();
    markStored(chatId,{projectId,title:currentTitle(chatId),history,reason,sourceUrl:`${location.origin}/c/${chatId}`,signalText:clean(signal?.innerText||signal?.textContent||'').slice(0,240)});
    await saveState();decorateSidebar();document.documentElement.dataset.ng100Out='1';
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité',`OUT · ${currentTitle(chatId).slice(0,48)} · limite native confirmée`);return true;
  }
  function outSignal(){return !!limitSignal();}
  function decorateLink(link){
    if(!(link instanceof HTMLElement))return;const id=cid(link.getAttribute('href'));if(!id)return;
    const entry=state.out?.[id];
    if(!entry){link.removeAttribute('data-ng100-out');link.querySelector(':scope > .ng100-out-badge')?.remove();link.querySelector(':scope > .ng100-continue')?.remove();return;}
    link.dataset.ng100Out='1';
    if(!link.querySelector(':scope > .ng100-out-badge')){const badge=document.createElement('span');badge.className='ng100-out-badge';badge.textContent='OUT';badge.title='Conversation arrivée à sa limite — suite disponible';link.appendChild(badge);}
    if(!link.querySelector(':scope > .ng100-continue')){const b=document.createElement('button');b.type='button';b.className='ng100-continue';b.textContent='↗';b.title='Continuer dans un nouveau chat du même Project';b.setAttribute('aria-label','Continuer cette conversation');b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();continueFrom(id);});link.appendChild(b);}
  }
  function decorateSidebar(){const root=navRoot();if(root)for(const a of root.querySelectorAll(CHAT_SEL))decorateLink(a);}
  function pendingSession(){try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}}
  async function storePending(p){
    try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}
    try{await chrome.storage.local.set({[PENDING_STORE_KEY]:p});}catch{}
    return p;
  }
  async function readPending(){
    const fast=pendingSession();if(fast)return fast;
    try{const p=(await chrome.storage.local.get(PENDING_STORE_KEY))[PENDING_STORE_KEY]||null;if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000){if(p)await chrome.storage.local.remove?.(PENDING_STORE_KEY);return null;}try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}return p;}catch{return null;}
  }
  async function writePending(p){return storePending(p);}
  async function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}try{await chrome.storage.local.remove?.(PENDING_STORE_KEY);}catch{}}
  async function continueFrom(chatId){
    const entry=state.out?.[chatId]||{},projectId=entry.projectId||chatInfo(chatId).projectId||currentPid();
    const capsule=buildCapsule(chatId,projectId,entry.history||'');
    const pending={schema:1,chatId,projectId,capsule,createdAt:Date.now(),sourceUrl:entry.sourceUrl||`${location.origin}/c/${chatId}`,patched:false};
    await storePending(pending);
    if(projectId){location.assign(`/g/${encodeURIComponent(projectId)}/project`);return;}
    location.assign('/');
  }
  async function injectPending(attempt=0){
    const p=await readPending();if(!p)return;const ed=editor();
    if(ed){
      const current=clean('value'in ed?ed.value:ed.innerText||ed.textContent);
      if(current.includes('CONTINUITÉ NIAKGPT')){document.documentElement.dataset.ng100Continuity='ready';composerObserver?.disconnect();composerObserver=null;return;}
      const text=current?`${p.capsule}\n\nBROUILLON PRÉSERVÉ AVANT CONTINUITÉ\n${current}`:p.capsule;
      if(setEditor(ed,text)){document.documentElement.dataset.ng100Continuity='ready';composerObserver?.disconnect();composerObserver=null;window.__NIAKGPT_DIAGNOSTICS__?.set('continuité',current?'PRÊT · capsule injectée + brouillon préservé · aucun envoi automatique':'PRÊT · capsule injectée · aucun envoi automatique');return;}
    }
    if(attempt<12)setTimeout(()=>injectPending(attempt+1),Math.min(1200,180+attempt*90));
  }
  async function armComposerObserver(){
    const p=await readPending();if(!p){composerObserver?.disconnect();composerObserver=null;return false;}
    if(editor()){injectPending();return true;}
    if(composerObserver)return true;
    composerObserver=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes||[]){
        if(!(node instanceof Element))continue;
        if(node.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')||node.querySelector?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')){
          injectPending();return;
        }
      }
    });
    composerObserver.observe(document.documentElement,{childList:true,subtree:true});
    return true;
  }
  async function patchNewChat(attempt=0){
    const p=await readPending(),newId=currentCid();if(!p||!newId||newId===p.chatId||p.patched)return;
    const known=chatInfo(newId);if(p.projectId&&known?.projectId!==p.projectId){
      const r=await rpc(`/backend-api/conversation/${encodeURIComponent(newId)}`,{method:'PATCH',body:{gizmo_id:p.projectId}});
      if(!r.ok){if(attempt<5)setTimeout(()=>patchNewChat(attempt+1),700+attempt*500);return;}
      const row=(cache.chats||[]).find(c=>c.id===newId);if(row)row.projectId=p.projectId;
      try{const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)await bus.update(latest=>{latest=latest&&typeof latest==='object'?latest:{};const chats=(latest.chats||[]).map(c=>c.id===newId?{...c,projectId:p.projectId}:c);return{...latest,chats};});}catch{}
    }
    p.patched=true;await writePending(p);setTimeout(()=>clearPending(),1000);
  }
  function onRoute(){delete document.documentElement.dataset.ng100Out;armComposerObserver();setTimeout(()=>{decorateSidebar();if(outSignal())markCurrentOut('route-native-limit',{trusted:true,evidence:EVIDENCE});injectPending();patchNewChat();},180);}
  function scheduleScan(){clearTimeout(scanTimer);scanTimer=setTimeout(()=>{if(outSignal())markCurrentOut('scan-native-limit',{trusted:true,evidence:EVIDENCE});decorateSidebar();},220);}
  function bindObservers(){
    const side=navRoot();if(side){sidebarObserver?.disconnect();sidebarObserver=new MutationObserver(()=>decorateSidebar());sidebarObserver.observe(side,{childList:true,subtree:true});}
    const main=document.querySelector('main');if(main){
      mainObserver?.disconnect();
      mainObserver=new MutationObserver(records=>{
        for(const r of records)for(const n of r.addedNodes){
          if(!(n instanceof Element))continue;
          if((n.matches?.(SIGNAL_SEL)&&trustedSignalNode(n))||[...n.querySelectorAll?.(SIGNAL_SEL)||[]].some(trustedSignalNode)){scheduleScan();return;}
        }
      });
      mainObserver.observe(main,{childList:true,subtree:true});
    }
  }
  async function init(){
    try{const got=await chrome.storage.local.get([CACHE_KEY,STATE_KEY]);cache=got[CACHE_KEY]||cache;state=got[STATE_KEY]&&typeof got[STATE_KEY]==='object'?got[STATE_KEY]:state;if(migrateState())await saveState();}catch{}
    bindObservers();decorateSidebar();if(outSignal())markCurrentOut('init-native-limit',{trusted:true,evidence:EVIDENCE});armComposerObserver();injectPending();patchNewChat();
  }
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;if(changes[STATE_KEY]){state=changes[STATE_KEY].newValue||state;state.out=state.out||{};}decorateSidebar();});
  window.addEventListener('popstate',onRoute);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  document.addEventListener('click',e=>{const a=e.target instanceof Element?e.target.closest(CHAT_SEL):null;if(a)setTimeout(onRoute,120);},true);
  document.addEventListener('niakgpt:activity-changed',e=>{if(e.detail?.active===false||document.documentElement.dataset.ng86Activity==='ready')scheduleScan();});
  window.addEventListener('pagehide',()=>{sidebarObserver?.disconnect();mainObserver?.disconnect();composerObserver?.disconnect();composerObserver=null;},{once:true});
  window.__NIAKGPT_CONTINUITY__={buildCapsule,markCurrentOut,continueFrom,getState:()=>state};
  init();
})();