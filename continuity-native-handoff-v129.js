(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_NATIVE_HANDOFF_129__)return;
  window.__NIAKGPT_NATIVE_HANDOFF_129__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PENDING_KEY='niakgpt-native-handoff-v129';
  const PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  const LIMIT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|conversation.{0,42}(?:limit|maximum)|maximum\s+context\s+length|context\s+window.{0,38}(?:limit|maximum)|you(?:'|’)ve\s+reached.{0,50}(?:limit|maximum)|conversation\s+trop\s+longue|limite.{0,38}(?:conversation|contexte)|ce\s+fil.{0,34}(?:plein|limite|maximum))/i;
  const CONTINUE_RX=/(start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|new\s+(?:chat|conversation)|(?:nouveau|nouvelle)\s+(?:chat|conversation)|continuer.{0,30}(?:nouveau|nouvelle)\s+(?:chat|conversation)|poursuivre.{0,30}(?:nouveau|nouvelle)\s+(?:chat|conversation))/i;
  const SEND_RX=/(?:^|\b)(?:send|envoyer|submit)(?:\b|$)/i;
  const MAX_AGE=30*60*1000;
  let timer=0,rpcSeq=0,busy=false;

  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const pid=v=>normalizePid(String(v||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const currentCid=()=>cid(location.pathname);
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const text=el=>clean(`${el?.getAttribute?.('aria-label')||''} ${el?.getAttribute?.('title')||''} ${el?.innerText||el?.textContent||''}`).slice(0,3200);
  const own=el=>!!el?.closest?.('#ng119-interruption,#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng90-control,#ng100-command,#ng8-coach');
  const editor=()=>[...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(visible).at(-1)||null;
  const editorText=ed=>clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');

  function nativeLimitControl(target){
    const control=target instanceof Element?target.closest('button,[role="button"],a[href]'):null;
    if(!(control instanceof HTMLElement)||!visible(control)||own(control)||!CONTINUE_RX.test(text(control)))return null;
    const main=control.closest('main,[role="main"]');if(!main)return null;
    // The real ChatGPT limit CTA currently lives inside the final assistant turn.
    // v129 excluded every conversation turn, so the native handler won and only carried
    // ChatGPT's default last-message context. Require explicit limit wording instead.
    let node=control;
    for(let depth=0;depth<10&&node&&node!==main.parentElement;depth++,node=node.parentElement){
      if(node instanceof HTMLElement&&visible(node)&&!own(node)&&LIMIT_RX.test(text(node)))return control;
      if(node===main)break;
    }
    return null;
  }
  function setEditor(ed,value){
    try{if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,value):(ed.value=value);}else{ed.focus({preventScroll:true});ed.textContent=value;}ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));return editorText(ed).includes('CONTINUITÉ NIAKGPT');}catch{return false;}
  }
  function sendButton(ed){
    const scope=ed?.closest?.('form,[data-type*="composer" i],[class*="composer" i]')||document;
    return [...scope.querySelectorAll('button')].find(b=>visible(b)&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&SEND_RX.test(`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''} ${b.title||''}`))||null;
  }
  function rpc(path,{method='GET',body=null,timeout=14000}={}){
    const id=`ng129-cont-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true,continuity:true}}));});
  }
  async function cache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function readPending(){try{const p=(await chrome.storage.local.get(PENDING_KEY))[PENDING_KEY]||null;if(p&&Date.now()-Number(p.createdAt||0)<MAX_AGE)return p;if(p)await chrome.storage.local.remove(PENDING_KEY);}catch{}return null;}
  async function writePending(p){try{await chrome.storage.local.set({[PENDING_KEY]:p});}catch{}return p;}
  async function clearPending(){try{await chrome.storage.local.remove(PENDING_KEY);}catch{}}

  function routeProject(projectId){
    const path=projectId?`/g/${encodeURIComponent(projectId)}/project`:'/';
    const native=[...document.querySelectorAll('a[href]')].find(a=>!own(a)&&pid(a.getAttribute('href'))===projectId&&/\/project(?:$|[?#])/.test(a.getAttribute('href')||''));
    if(native instanceof HTMLElement){native.click();return;}location.assign(path);
  }
  async function buildPending(){
    const chatId=currentCid();if(!chatId)return null;
    const raw=await cache(),chat=(raw.chats||[]).find(c=>c?.id===chatId)||{},projectId=normalizePid(pid(location.pathname)||chat.projectId||''),project=(raw.projects||[]).find(p=>normalizePid(p?.id)===projectId)||{};
    try{await window.__NIAKGPT_CONTINUITY__?.markCurrentOut?.('native-limit-handoff-v129',{trusted:true,evidence:'native-limit-v120'});}catch{}
    const state=window.__NIAKGPT_CONTINUITY__?.getState?.()||{},entry=state.out?.[chatId]||{};
    const title=clean(entry.title||chat.title)||'Conversation',projectName=clean(project.name)||(projectId?'Project':'Hors projet');
    const history=clean(entry.history||'');
    const base=window.__NIAKGPT_CONTINUITY__?.buildCapsule?.(chatId,projectId,history);if(!base)return null;
    const capsule=[
      `Reprends la conversation nommée « ${projectName} > ${title} » exactement là où elle s’est arrêtée.`,
      'CONTINUITÉ NIAKGPT — FIL PRÉCÉDENT ARRIVÉ À SA LIMITE',
      projectId?`PROJECT EXACT À CONSERVER : ${projectName}\nCe nouveau chat appartient obligatoirement au même Project que le fil précédent.`:'PROJECT : hors projet confirmé par le contexte local.',
      base,
      'RÈGLE D’EXÉCUTION\nPoursuis immédiatement le travail restant. Ne demande pas de confirmation intermédiaire et ne t’arrête pas après un simple plan ou une étape partielle.'
    ].join('\n\n');
    return{schema:2,chatId,projectId,projectName,chatName:title,capsule,historyBytes:history.length,createdAt:Date.now(),sourceUrl:`${location.origin}${location.pathname}`,sendAttemptAt:0,sentAt:0};
  }
  async function intercept(event){
    const control=nativeLimitControl(event.target);if(!control||busy)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();busy=true;
    try{
      const p=await buildPending();if(!p)return;
      await writePending(p);if(p.projectId)try{sessionStorage.setItem(PIN_OPEN_KEY,p.projectId);}catch{}
      window.__NIAKGPT_DIAGNOSTICS__?.set('native-handoff-129',`PRÊT · ${p.projectName} > ${p.chatName} · ${p.historyBytes} caractères de contexte`);
      routeProject(p.projectId);schedule(120);
    }finally{busy=false;}
  }
  async function finishProjectLock(p,newId){
    if(!p.projectId)return true;const out=await rpc(`/backend-api/conversation/${encodeURIComponent(newId)}`,{method:'PATCH',body:{gizmo_id:p.projectId}});if(out.ok){try{sessionStorage.setItem(PIN_OPEN_KEY,p.projectId);}catch{}document.dispatchEvent(new CustomEvent('niakgpt:force-server-index',{detail:{source:'native-handoff-v129'}}));return true;}return false;
  }
  async function resumePending(){
    if(busy)return;const p=await readPending();if(!p?.capsule)return;const newId=currentCid();
    if(p.sentAt&&newId&&newId!==p.chatId){busy=true;try{if(await finishProjectLock(p,newId)){await clearPending();window.__NIAKGPT_DIAGNOSTICS__?.set('native-handoff-129',`OK · suite envoyée${p.projectId?` · ${p.projectName}`:''}`);}else schedule(700);}finally{busy=false;}return;}
    if(p.sentAt){if(Date.now()-p.sentAt>18000){p.sentAt=0;p.sendAttemptAt=0;await writePending(p);}else{schedule(500);return;}}
    const ed=editor();if(!ed){schedule(240);return;}const current=editorText(ed),textToSend=current?`${p.capsule}\n\nBROUILLON PRÉSERVÉ AVANT CONTINUITÉ\n${current}`:p.capsule;
    if(!current.includes('CONTINUITÉ NIAKGPT')&&!setEditor(ed,textToSend)){schedule(300);return;}
    const button=sendButton(ed);if(!button){schedule(180);return;}
    busy=true;try{p.sendAttemptAt=Date.now();p.sentAt=p.sendAttemptAt;await writePending(p);button.click();window.__NIAKGPT_DIAGNOSTICS__?.set('native-handoff-129',`ENVOI · capsule complète transmise · ${p.historyBytes||0} caractères d'historique`);schedule(500);}catch{p.sentAt=0;await writePending(p);schedule(500);}finally{busy=false;}
  }
  function schedule(delay=180){clearTimeout(timer);timer=setTimeout(()=>{timer=0;resumePending();},delay);}

  window.addEventListener('click',intercept,true);
  window.addEventListener('popstate',()=>schedule(80));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(80));window.addEventListener('pageshow',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(80);});document.addEventListener('niakgpt:activity-changed',()=>schedule(120));
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});schedule(80);
})();
