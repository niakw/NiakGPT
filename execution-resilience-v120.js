(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_EXECUTION_RESILIENCE_120__)return;
  window.__NIAKGPT_EXECUTION_RESILIENCE_120__=true;

  const DRAFT_PREFIX='niakgpt-draft-v120:';
  const VERIFY_RX=/(checking your browser|verify you are human|verification required|security check|unusual activity|v[ée]rification (?:du|de votre) navigateur|v[ée]rifiez que vous [êe]tes humain|v[ée]rification en cours)/i;
  const NETWORK_RX=/(connection lost|connexion perdue|network error|erreur r[ée]seau|reconnecting|reconnexion|connexion interrompue|failed to connect|probl[èe]me de connexion)/i;
  const LIMIT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|maximum\s+context\s+length|start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|conversation\s+trop\s+longue|limite.{0,30}(?:conversation|contexte)|ce\s+fil.{0,28}(?:plein|limite))/i;
  const RETRY_RX=/(retry|try again|r[ée]essayer|reconnect|reconnexion|continue generating|continuer la g[ée]n[ée]ration|reprendre)/i;
  let observer=null,timer=0,retryTimer=0,pendingReason='',pendingAt=0,lastAssistantLen=0,lastGrowthAt=0,retryEpoch=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const composer=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
  const composerText=el=>el?clean('value'in el?el.value:el.innerText||el.textContent):'';
  const draftKey=()=>`${DRAFT_PREFIX}${location.pathname}`;
  const visible=el=>{if(!(el instanceof HTMLElement))return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
  const alerts=()=>[...document.querySelectorAll('[role="alert"],[role="dialog"],[aria-live="assertive"],[aria-live="polite"],[data-testid*="error" i],[data-testid*="verification" i],[data-testid*="verify" i]')].filter(visible);
  const textOf=el=>clean(el?.textContent||el?.getAttribute?.('aria-label')||'');
  const assistantLength=()=>{const list=document.querySelectorAll('main [data-message-author-role="assistant"]'),last=list.item(list.length-1);return clean(last?.innerText||last?.textContent).length;};
  const nativeBusy=()=>['waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')||!!document.querySelector('button[data-testid*="stop" i],button[aria-label*="Stop" i],button[aria-label*="Arr[êe]ter" i]');

  function saveDraft(){const ed=composer();if(!ed)return;const text='value'in ed?ed.value:ed.innerText||ed.textContent;try{text?sessionStorage.setItem(draftKey(),text):sessionStorage.removeItem(draftKey());}catch{}}
  function restoreDraft(){const ed=composer();if(!ed||composerText(ed))return;let text='';try{text=sessionStorage.getItem(draftKey())||'';}catch{}if(!text)return;try{if('value'in ed)ed.value=text;else ed.textContent=text;ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}catch{}}
  function retryButton(){return[...document.querySelectorAll('button,[role="button"]')].find(b=>visible(b)&&RETRY_RX.test(`${b.textContent||''} ${b.getAttribute('aria-label')||''} ${b.title||''}`))||null;}
  function verificationPresent(){return alerts().some(el=>VERIFY_RX.test(textOf(el)));}
  function networkPresent(){return !navigator.onLine||alerts().some(el=>NETWORK_RX.test(textOf(el)));}
  function limitPresent(){return alerts().some(el=>LIMIT_RX.test(textOf(el)))||[...document.querySelectorAll('main [data-message-author-role="assistant"]')].slice(-3).some(el=>LIMIT_RX.test(textOf(el).slice(0,1800)));}
  function publishVerification(on){
    const root=document.documentElement;
    if(on){root.dataset.ng105Verification='1';root.dataset.ng120Verification='1';window.__NIAKGPT_DIAGNOSTICS__?.set('vérification','PAUSE · vérification native ChatGPT, trafic NiakGPT suspendu');}
    else{if(root.dataset.ng120Verification==='1')delete root.dataset.ng105Verification;delete root.dataset.ng120Verification;window.__NIAKGPT_DIAGNOSTICS__?.set('vérification','OK · aucune vérification active');}
  }
  function markInterruption(reason){
    if(!pendingReason){pendingReason=reason;pendingAt=Date.now();retryEpoch++;}
    saveDraft();window.__NIAKGPT_DIAGNOSTICS__?.set('résilience-exécution',`${reason==='verification'?'PAUSE':'ATTENTE'} · ${reason==='verification'?'vérification native':'connexion interrompue'} · état conservé`);
  }
  function clearInterruption(){pendingReason='';pendingAt=0;clearTimeout(retryTimer);retryTimer=0;}
  function maybeMarkLimit(){if(!limitPresent())return;window.__NIAKGPT_CONTINUITY__?.markCurrentOut?.('limit-detected');window.__NIAKGPT_DIAGNOSTICS__?.set('limite-conversation','OUT · continuité NiakGPT disponible');}
  function scheduleRetry(reason,epoch=retryEpoch){
    clearTimeout(retryTimer);retryTimer=setTimeout(()=>{
      if(epoch!==retryEpoch||pendingReason!==reason||verificationPresent()||networkPresent())return;
      const len=assistantLength();if(len>lastAssistantLen){lastAssistantLen=len;lastGrowthAt=Date.now();scheduleRetry(reason,epoch);return;}
      if(nativeBusy()||Date.now()-lastGrowthAt<2200){scheduleRetry(reason,epoch);return;}
      const button=retryButton();if(!button){restoreDraft();window.__NIAKGPT_DIAGNOSTICS__?.set('résilience-exécution','PRÊT · état restauré, aucun bouton natif de reprise');return;}
      clearInterruption();button.click();window.__NIAKGPT_DIAGNOSTICS__?.set('résilience-exécution','REPRISE · bouton natif ChatGPT déclenché une fois');
    },1400);
  }
  function scan(){
    timer=0;const verify=verificationPresent(),network=networkPresent();publishVerification(verify);maybeMarkLimit();
    const len=assistantLength();if(len>lastAssistantLen){lastAssistantLen=len;lastGrowthAt=Date.now();}
    if(verify){markInterruption('verification');return;}
    if(network){markInterruption('network');return;}
    if(pendingReason){const reason=pendingReason;scheduleRetry(reason);}
    else restoreDraft();
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(scan,delay);}
  function start(){
    lastAssistantLen=assistantLength();lastGrowthAt=Date.now();observer?.disconnect();observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length||r.type==='attributes'))schedule(120);});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','data-state','hidden']});schedule(0);restoreDraft();
  }

  document.addEventListener('input',event=>{const t=event.target instanceof Element?event.target:null;if(t&&(t===composer()||t.closest?.('[data-type="unified-composer"]')))saveDraft();},true);
  window.addEventListener('offline',()=>{markInterruption('network');schedule(0);});window.addEventListener('online',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(100);});
  window.addEventListener('popstate',()=>{clearInterruption();setTimeout(()=>{restoreDraft();schedule(0);},80);});if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{clearInterruption();setTimeout(()=>{restoreDraft();schedule(0);},80);});
  window.addEventListener('pagehide',()=>{saveDraft();observer?.disconnect();clearTimeout(timer);clearTimeout(retryTimer);},{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();