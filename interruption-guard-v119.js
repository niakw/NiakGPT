(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_INTERRUPTION_GUARD_119__)return;
  window.__NIAKGPT_INTERRUPTION_GUARD_119__=true;

  const KEY='niakgpt-interruption-v120';
  const LEGACY_KEY='niakgpt-interruption-v119';
  const SIGNAL_SEL='[role="alert"],[role="status"],[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i],[data-testid*="challenge" i],iframe[src*="challenge" i],iframe[src*="cloudflare" i]';
  const LIMIT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|conversation.{0,36}(?:limit|maximum)|maximum\s+context\s+length|context\s+window.{0,32}(?:limit|maximum)|start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|you(?:'|’)ve\s+reached.{0,44}(?:limit|maximum)|conversation\s+trop\s+longue|limite.{0,32}(?:conversation|contexte)|(?:nouveau|nouvelle)\s+(?:chat|conversation).{0,40}(?:continuer|poursuivre)|ce\s+fil.{0,28}(?:plein|limite))/i;
  const VERIFY_RX=/(vérification\s+en\s+cours|verification\s+in\s+progress|checking\s+your\s+browser|verify\s+(?:you|that\s+you)\s+are\s+human|vérifiez\s+que\s+vous\s+êtes\s+humain|cloudflare\s+(?:verification|challenge)|challenge\s+in\s+progress)/i;
  const NETWORK_RX=/(connexion\s+(?:perdue|interrompue)|connection\s+(?:lost|interrupted)|network\s+error|erreur\s+réseau|disconnected|déconnecté|websocket.{0,24}(?:error|closed|failed)|reconnecting|reconnexion\s+en\s+cours|failed\s+to\s+fetch|fetch\s+failed|something\s+went\s+wrong|there\s+was\s+an\s+error\s+(?:generating|processing)|une\s+erreur\s+est\s+survenue|erreur\s+lors\s+de\s+la\s+(?:génération|generation)|impossible\s+de\s+générer|unable\s+to\s+generate)/i;
  const RETRY_RX=/(réessayer|reessayer|retry|régénérer|regenerer|regenerate|continuer\s+la\s+génération|continue\s+generating|resume\s+generating)/i;
  let observer=null,timer=0,incident=readIncident(),marking=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof Element)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const ownRecoveryNode=el=>el instanceof Element&&(el.id==='ng119-interruption'||!!el.closest('#ng119-interruption'));
  const inConversationProse=el=>el instanceof Element&&!!el.closest('[data-message-author-role],[data-testid^="conversation-turn"],article');
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  const editorText=ed=>clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');
  function setEditor(ed,text){
    if(!ed)return false;try{if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}else{ed.focus();ed.textContent=text;}ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));return true;}catch{return false;}
  }
  function setVerificationPause(on){
    const root=document.documentElement;
    if(on){
      if(root.dataset.ng119Verification!=='1'&&root.dataset.ng105Verification!=='1')root.dataset.ng119VerificationOwn='1';
      root.dataset.ng119Verification='1';root.dataset.ng105Verification='1';
      window.__NIAKGPT_DIAGNOSTICS__?.set('vérification','PAUSE · bridge NiakGPT suspendu pendant la vérification native');
      return;
    }
    if(root.dataset.ng119VerificationOwn==='1')delete root.dataset.ng105Verification;
    delete root.dataset.ng119Verification;delete root.dataset.ng119VerificationOwn;
    window.__NIAKGPT_DIAGNOSTICS__?.set('vérification','OK · vérification native absente');
  }
  const ENC_V=1;
  const ENC_SALT='niakgpt-interruption-v119-salt';
  const ENC_PASS='niakgpt-interruption-v119-passphrase';
  let keyPromise=0;
  function b64FromBytes(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);}
  function bytesFromB64(b64){const s=atob(b64);const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
  function cryptoReady(){return !!(window.crypto&&window.crypto.subtle&&window.TextEncoder&&window.TextDecoder);}
  function getKey(){
    if(keyPromise)return keyPromise;
    keyPromise=(async()=>{
      const enc=new TextEncoder();
      const base=await crypto.subtle.importKey('raw',enc.encode(ENC_PASS),{name:'PBKDF2'},false,['deriveKey']);
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:enc.encode(ENC_SALT),iterations:120000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    })();
    return keyPromise;
  }
  async function encryptText(text){
    if(!cryptoReady())return null;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await getKey();
    const enc=new TextEncoder().encode(text);
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc);
    return JSON.stringify({v:ENC_V,iv:b64FromBytes(iv),ct:b64FromBytes(new Uint8Array(ct))});
  }
  async function decryptText(payload){
    if(!cryptoReady())return null;
    const box=JSON.parse(payload||'null');
    if(!box||box.v!==ENC_V||!box.iv||!box.ct)return null;
    const key=await getKey();
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytesFromB64(box.iv)},key,bytesFromB64(box.ct));
    return new TextDecoder().decode(pt);
  }
  async function readIncident(){
    try{sessionStorage.removeItem(LEGACY_KEY);}catch{}
    try{
      const raw=sessionStorage.getItem(KEY)||'';
      if(!raw)return null;
      const plain=await decryptText(raw);
      if(!plain)return null;
      const data=JSON.parse(plain||'null');
      return data&&Date.now()-Number(data.at||0)<20*60*1000?data:null;
    }catch{return null;}
  }
  function persistedIncident(data){
    if(!data)return null;
    const allowedType = data.type==='limit'||data.type==='verify'||data.type==='network' ? data.type : '';
    return {
      type:allowedType,
      at:Number(data.at||0),
      retried:!!data.retried,
      recovered:!!data.recovered,
      recoveredAt:data.recoveredAt?Number(data.recoveredAt):undefined
    };
  }
  function saveIncident(data){
    incident=data;
    try{
      const safe=persistedIncident(data);
      if(!safe){sessionStorage.removeItem(KEY);return;}
      encryptText(JSON.stringify(safe)).then(payload=>{if(payload)sessionStorage.setItem(KEY,payload);else sessionStorage.removeItem(KEY);}).catch(()=>{try{sessionStorage.removeItem(KEY);}catch{}});
    }catch{}
  }
  function candidateText(el){return clean(`${el?.getAttribute?.('aria-label')||''} ${el?.getAttribute?.('title')||''} ${el?.getAttribute?.('src')||''} ${el?.innerText||el?.textContent||''}`).slice(0,2200);}
  function classifyText(text){if(!text)return'';if(LIMIT_RX.test(text))return'limit';if(VERIFY_RX.test(text))return'verify';if(NETWORK_RX.test(text))return'network';return'';}
  function trustedSignal(el){
    if(!(el instanceof Element)||!visible(el)||ownRecoveryNode(el)||inConversationProse(el))return'';
    if(!el.matches(SIGNAL_SEL))return'';
    const kind=classifyText(candidateText(el));if(!kind)return'';
    const strong=el.matches('[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i],[data-testid*="challenge" i],iframe[src*="challenge" i],iframe[src*="cloudflare" i]');
    if(strong)return kind;
    return el.matches('[role="alert"],[role="status"]')?kind:'';
  }
  function currentSignal(type=''){
    const nodes=[...document.querySelectorAll(SIGNAL_SEL)];
    for(const node of nodes){const kind=trustedSignal(node);if(kind&&(!type||kind===type))return{kind,node};}
    return null;
  }
  function nativeRetry(){
    const roots=[document.querySelector('main,[role="main"]'),document.body].filter(Boolean);
    for(const root of roots)for(const b of root.querySelectorAll('button,[role="button"]')){
      if(b.closest('#ng119-interruption,#ng8-pins,#ng8-panel,#ng90-control,#ng100-command')||b.disabled||!visible(b))continue;
      const label=clean(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.textContent||''}`);if(RETRY_RX.test(label))return b;
    }
    return null;
  }
  function bar(){return document.getElementById('ng119-interruption');}
  function clearBar(){bar()?.remove();delete document.documentElement.dataset.ng119Interruption;}
  function finishRecovery(){saveIncident(null);clearBar();window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','OK · incident natif terminé');}
  function rememberDraft(data){const text=editorText(editor());return text&&!data?.draft?{...data,draft:text}:data;}
  function restoreDraft(){const text=clean(incident?.draft);if(!text)return false;const ed=editor();if(!ed||editorText(ed))return false;return setEditor(ed,text);}
  function resumePrompt(){
    const text='Reprends exactement là où le travail ou la réponse s’est interrompu avant l’incident. Ne recommence pas les étapes déjà terminées ; poursuis directement la tâche en cours et vérifie ce qui restait inachevé.';
    const ed=editor();if(!ed)return false;const current=editorText(ed);if(current)return false;return setEditor(ed,text);
  }
  function mount(type,{ready=false}={}){
    let box=bar();if(!box){box=document.createElement('aside');box.id='ng119-interruption';box.setAttribute('role','status');document.body.appendChild(box);}
    box.dataset.type=type;document.documentElement.dataset.ng119Interruption=type;
    if(type==='limit'){
      box.innerHTML='<strong>FIL ARRIVÉ À SA LIMITE</strong><span>NiakGPT a préparé la continuité avec le contexte du fil.</span><button type="button" class="ng100-continue">CONTINUER LE FIL</button>';
      const b=box.querySelector('.ng100-continue');b.disabled=marking;return box;
    }
    const label=type==='verify'?'VÉRIFICATION CHATGPT':'CONNEXION INTERROMPUE';
    const msg=type==='verify'?'NiakGPT ne contourne pas la vérification et suspend ses propres requêtes. Il reprend dès que ChatGPT la libère.':'NiakGPT attend le retour de la connexion et conserve le brouillon sans modifier la conversation.';
    box.innerHTML=`<strong>${label}</strong><span>${msg}</span>${ready?'<button type="button" data-ng119-resume>REPRENDRE</button>':''}`;
    const b=box.querySelector('[data-ng119-resume]');if(b)b.addEventListener('click',()=>{if(restoreDraft()){finishRecovery();}else if(resumePrompt()){box.querySelector('span').textContent='Message de reprise préparé dans le champ. Aucun envoi automatique.';b.disabled=true;b.textContent='PRÊT À ENVOYER';}else finishRecovery();});return box;
  }
  async function handleLimit(reason='dom-limit'){
    setVerificationPause(false);
    const cid=String(location.pathname).match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';if(!cid)return;
    if(!incident||incident.type!=='limit'||incident.chatId!==cid)saveIncident({type:'limit',chatId:cid,at:Date.now(),reason,retried:false});
    marking=true;mount('limit');
    try{await window.__NIAKGPT_CONTINUITY__?.markCurrentOut?.('limit-detected-v120',{trusted:true,evidence:'native-limit-v120'});}catch{}
    marking=false;const b=mount('limit').querySelector('.ng100-continue');if(b)b.disabled=false;
    window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','OUT · limite serveur native · continuité prête');
  }
  function begin(type,text=''){
    if(type==='limit'){handleLimit('native-signal');return;}
    if(type==='verify')setVerificationPause(true);else if(!currentSignal('verify'))setVerificationPause(false);
    if(!incident||incident.type!==type)saveIncident(rememberDraft({type,at:Date.now(),retried:false,recovered:false,sample:clean(text).slice(0,240)}));
    else if(!incident.draft){const next=rememberDraft(incident);if(next!==incident)saveIncident(next);}
    mount(type,{ready:false});window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119',type==='verify'?'PAUSE · vérification native + bridge':'PAUSE · connexion native + brouillon conservé');scheduleRecovery(500);
  }
  function tryNativeRecovery(){
    if(!incident||!['verify','network'].includes(incident.type))return false;
    if(currentSignal(incident.type))return false;
    if(incident.type==='verify')setVerificationPause(false);
    restoreDraft();
    const retry=nativeRetry();
    if(retry&&!incident.retried){incident={...incident,retried:true,recoveredAt:Date.now()};saveIncident(incident);retry.click();window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','REPRISE · bouton ChatGPT natif déclenché une fois');setTimeout(()=>{if(incident&&!currentSignal(incident.type))finishRecovery();},900);return true;}
    finishRecovery();return false;
  }
  function scheduleRecovery(delay=240){clearTimeout(timer);timer=setTimeout(()=>{timer=0;tryNativeRecovery();},delay);}
  function inspectNode(node){
    if(!(node instanceof Element)||ownRecoveryNode(node))return;
    const candidates=[];if(node.matches?.(SIGNAL_SEL))candidates.push(node);for(const el of node.querySelectorAll?.(SIGNAL_SEL)||[])candidates.push(el);
    for(const el of candidates){const type=trustedSignal(el);if(type){begin(type,candidateText(el));return;}}
  }
  function scan(){const signal=currentSignal();if(signal)begin(signal.kind,candidateText(signal.node));else if(incident&&['verify','network'].includes(incident.type))scheduleRecovery(120);else setVerificationPause(false);}
  function bind(){
    observer?.disconnect();observer=new MutationObserver(records=>{
      let structural=false;
      for(const r of records){if(r.type!=='childList')continue;const external=[...r.addedNodes,...r.removedNodes].some(node=>!(node instanceof Element)||!ownRecoveryNode(node));if(!external)continue;structural=true;for(const node of r.addedNodes)inspectNode(node);}
      if(structural&&incident&&['verify','network'].includes(incident.type))scheduleRecovery(180);
    });observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  function onRoute(){clearBar();const p=String(location.pathname);if(!/\/c\//.test(p)&&incident?.type==='limit')saveIncident(null);setTimeout(scan,160);}

  document.addEventListener('click',event=>{
    const b=event.target instanceof Element?event.target.closest('#ng119-interruption .ng100-continue'):null;if(!b)return;
    event.preventDefault();const chatId=incident?.chatId||String(location.pathname).match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
    if(chatId)window.__NIAKGPT_CONTINUITY__?.continueFrom?.(chatId);setTimeout(()=>clearBar(),0);
  },false);
  window.addEventListener('online',()=>{if(incident?.type==='network')scheduleRecovery(80);});
  window.addEventListener('offline',()=>begin('network','browser offline'));
  window.addEventListener('popstate',onRoute);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  window.addEventListener('pageshow',()=>{bind();setTimeout(scan,120);});
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(timer);},{once:true});
  const start=()=>{bind();scan();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
