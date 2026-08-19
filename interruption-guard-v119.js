(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_INTERRUPTION_GUARD_119__)return;
  window.__NIAKGPT_INTERRUPTION_GUARD_119__=true;

  const KEY='niakgpt-interruption-v119';
  const LIMIT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|conversation.{0,36}(?:limit|maximum)|maximum\s+context\s+length|context\s+window.{0,32}(?:limit|maximum)|start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|you(?:'|’)ve\s+reached.{0,44}(?:limit|maximum)|conversation\s+trop\s+longue|limite.{0,32}(?:conversation|contexte)|(?:nouveau|nouvelle)\s+(?:chat|conversation).{0,40}(?:continuer|poursuivre)|ce\s+fil.{0,28}(?:plein|limite))/i;
  const VERIFY_RX=/(vérification\s+en\s+cours|verification\s+in\s+progress|checking\s+your\s+browser|verify\s+(?:you|that\s+you)\s+are\s+human|vérifiez\s+que\s+vous\s+êtes\s+humain|cloudflare\s+(?:verification|challenge)|challenge\s+in\s+progress)/i;
  const NETWORK_RX=/(connexion\s+(?:perdue|interrompue)|connection\s+(?:lost|interrupted)|network\s+error|erreur\s+réseau|disconnected|déconnecté|websocket.{0,24}(?:error|closed|failed)|reconnecting|reconnexion\s+en\s+cours)/i;
  const RETRY_RX=/(réessayer|reessayer|retry|régénérer|regenerer|regenerate|continuer\s+la\s+génération|continue\s+generating|resume\s+generating)/i;
  let observer=null,timer=0,incident=readIncident(),marking=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof Element)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  function setEditor(ed,text){
    if(!ed)return false;try{if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}else{ed.focus();ed.textContent=text;}ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));return true;}catch{return false;}
  }
  function readIncident(){try{const data=JSON.parse(sessionStorage.getItem(KEY)||'null');return data&&Date.now()-Number(data.at||0)<20*60*1000?data:null;}catch{return null;}}
  function saveIncident(data){incident=data;try{data?sessionStorage.setItem(KEY,JSON.stringify(data)):sessionStorage.removeItem(KEY);}catch{}}
  function candidateText(el){return clean(el?.innerText||el?.textContent).slice(0,2200);}
  function classifyText(text){if(!text)return'';if(LIMIT_RX.test(text))return'limit';if(VERIFY_RX.test(text))return'verify';if(NETWORK_RX.test(text))return'network';return'';}
  function currentSignal(type=''){
    const nodes=[...document.querySelectorAll('[role="alert"],[role="status"],[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i],[data-testid*="challenge" i],iframe[src*="challenge" i],iframe[src*="cloudflare" i]')].filter(visible);
    for(const node of nodes){const kind=classifyText(candidateText(node)||node.getAttribute?.('title')||node.getAttribute?.('src')||'');if(kind&&(!type||kind===type))return{kind,node};}
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
  function resumePrompt(){
    const text='Reprends exactement là où le travail ou la réponse s’est interrompu avant l’incident. Ne recommence pas les étapes déjà terminées ; poursuis directement la tâche en cours et vérifie ce qui restait inachevé.';
    const ed=editor();if(!ed)return false;const current=clean('value'in ed?ed.value:ed.innerText||ed.textContent);if(current)return false;return setEditor(ed,text);
  }
  function mount(type,{ready=false}={}){
    let box=bar();if(!box){box=document.createElement('aside');box.id='ng119-interruption';box.setAttribute('role','status');document.body.appendChild(box);}
    box.dataset.type=type;document.documentElement.dataset.ng119Interruption=type;
    if(type==='limit'){
      box.innerHTML='<strong>FIL ARRIVÉ À SA LIMITE</strong><span>NiakGPT a préparé la continuité avec le contexte du fil.</span><button type="button" class="ng100-continue">CONTINUER LE FIL</button>';
      const b=box.querySelector('.ng100-continue');b.disabled=marking;return box;
    }
    const label=type==='verify'?'VÉRIFICATION CHATGPT':'CONNEXION INTERROMPUE';
    const msg=type==='verify'?'NiakGPT ne contourne pas la vérification. Il reprend dès que ChatGPT la libère.':'NiakGPT attend le retour de la connexion et utilise le bouton natif de reprise s’il apparaît.';
    box.innerHTML=`<strong>${label}</strong><span>${msg}</span><button type="button" data-ng119-resume>${ready?'REPRENDRE':'EN ATTENTE'}</button>`;
    const b=box.querySelector('[data-ng119-resume]');b.disabled=!ready;b.addEventListener('click',()=>{if(resumePrompt()){box.querySelector('span').textContent='Message de reprise préparé dans le champ. Aucun envoi automatique.';b.disabled=true;b.textContent='PRÊT À ENVOYER';}else{box.querySelector('span').textContent='Le champ contient déjà du texte ou n’est pas disponible : rien n’a été écrasé.';}});return box;
  }
  async function handleLimit(reason='dom-limit'){
    const cid=String(location.pathname).match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';if(!cid)return;
    if(!incident||incident.type!=='limit'||incident.chatId!==cid)saveIncident({type:'limit',chatId:cid,at:Date.now(),reason,retried:false});
    marking=true;mount('limit');
    try{await window.__NIAKGPT_CONTINUITY__?.markCurrentOut?.('limit-detected-v119');}catch{}
    marking=false;const b=mount('limit').querySelector('.ng100-continue');if(b)b.disabled=false;
    window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','OUT · limite serveur · continuité prête');
  }
  function begin(type,text=''){
    if(type==='limit'){handleLimit('signal');return;}
    if(!incident||incident.type!==type)saveIncident({type,at:Date.now(),retried:false,recovered:false,sample:clean(text).slice(0,240)});
    mount(type,{ready:false});window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119',type==='verify'?'PAUSE · vérification native':'PAUSE · connexion');scheduleRecovery(500);
  }
  function tryNativeRecovery(){
    if(!incident||!['verify','network'].includes(incident.type))return false;
    if(currentSignal(incident.type))return false;
    const retry=nativeRetry();
    if(retry&&!incident.retried){incident={...incident,retried:true,recoveredAt:Date.now()};saveIncident(incident);retry.click();mount(incident.type,{ready:false});window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','REPRISE · bouton ChatGPT natif déclenché une fois');setTimeout(()=>{if(incident&&!currentSignal(incident.type))mount(incident.type,{ready:true});},900);return true;}
    mount(incident.type,{ready:true});window.__NIAKGPT_DIAGNOSTICS__?.set('interruption-119','PRÊT · reprise manuelle préparée');return false;
  }
  function scheduleRecovery(delay=240){clearTimeout(timer);timer=setTimeout(()=>{timer=0;tryNativeRecovery();},delay);}
  function inspectNode(node){
    if(!(node instanceof Element))return;
    const text=candidateText(node);let type=classifyText(text);
    if(!type){for(const el of node.querySelectorAll?.('[role="alert"],[role="status"],[data-testid*="error" i],[data-testid*="limit" i],[data-testid*="toast" i],[data-testid*="challenge" i]')||[]){type=classifyText(candidateText(el));if(type)break;}}
    if(type)begin(type,text);
  }
  function scan(){const signal=currentSignal();if(signal)begin(signal.kind,candidateText(signal.node));else if(incident&&['verify','network'].includes(incident.type))scheduleRecovery(120);}
  function bind(){
    observer?.disconnect();observer=new MutationObserver(records=>{
      let structural=false;
      for(const r of records){if(r.type!=='childList')continue;structural=true;for(const node of r.addedNodes)inspectNode(node);}
      if(structural&&incident&&['verify','network'].includes(incident.type))scheduleRecovery(180);
    });observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  function onRoute(){clearBar();const p=String(location.pathname);if(!/\/c\//.test(p)&&incident?.type==='limit')saveIncident(null);setTimeout(scan,160);}

  document.addEventListener('click',event=>{
    const b=event.target instanceof Element?event.target.closest('#ng119-interruption .ng100-continue'):null;if(!b)return;
    // continuity-v112 owns the capture handler. This observer only removes the local
    // interruption chrome after the continuity action has been accepted.
    setTimeout(()=>clearBar(),0);
  },false);
  window.addEventListener('online',()=>{if(incident?.type==='network')scheduleRecovery(80);});
  window.addEventListener('offline',()=>begin('network','connection lost'));
  window.addEventListener('popstate',onRoute);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  window.addEventListener('pageshow',()=>{bind();if(incident&&['verify','network'].includes(incident.type))mount(incident.type,{ready:true});setTimeout(scan,120);});
  const start=()=>{bind();if(incident){if(incident.type==='limit'&&/\/c\//.test(location.pathname))mount('limit');else if(['verify','network'].includes(incident.type))mount(incident.type,{ready:true});}scan();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();