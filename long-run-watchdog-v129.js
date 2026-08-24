(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LONG_RUN_WATCHDOG_129__)return;
  window.__NIAKGPT_LONG_RUN_WATCHDOG_129__=true;

  const ACTIVE=new Set(['waiting','thinking','executing']);
  const DEFAULT_SEGMENT_MS=6*60*1000+30*1000;
  const RETRY_MS=3500;
  const PRIME_RETRY_MS=180;
  const MARKER='↻ Reprise NiakGPT';
  const LEGACY_MARKER='--- NIAKGPT LONG RUN — REPRISE AUTOMATIQUE ---';
  const LEGACY_PARALLEL_HEADER='--- CONTINUE — AJOUT EN PARALLÈLE ---';
  const AUTO_RX=/(?:↻\s*Reprise NiakGPT|---\s*NIAKGPT LONG RUN\s*[—–-]\s*REPRISE AUTOMATIQUE\s*---)/i;
  const MESSAGE=`${MARKER} — Continue exactement la tâche en cours au dernier point utile, jusqu’à finalisation et vérification, sans résumé ni confirmation intermédiaire.`;
  const LEGACY_MESSAGE=`${LEGACY_PARALLEL_HEADER}\n${LEGACY_MARKER}\nPoursuis exactement la tâche déjà en cours là où elle en est. Ne fais ni résumé intermédiaire ni demande de confirmation. Termine toutes les étapes de la demande initiale, vérifie le résultat et ne t'arrête qu'une fois le travail réellement terminé. Si le tour précédent vient d'être interrompu par une limite de durée, reprends immédiatement au dernier point utile.`;
  const CANCEL_RX=/^\s*(?:stop\b|stoppe\b|arr(?:ê|e)te\b|annule\b|cancel\b|abort\b|interromps\b|laisse\s+tomber\b|ne\s+continue\s+pas\b)/i;
  const SEND_RX=/(?:^|\b)(?:send|envoyer|submit)(?:\b|$)/i;
  let segmentTimer=0,retryTimer=0,guardTimer=0,primeTimer=0,segmentStartedAt=0,due=false,suppressed=false,lastAutoAt=0,forcedRunning=false,writing=false;

  const root=()=>document.documentElement;
  const activity=()=>String(root().dataset.ng86Activity||'').toLowerCase();
  const visible=el=>{if(!(el instanceof Element)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const nativeStop=()=>[
    'button[data-testid="stop-button"]','button[data-testid*="stop-generating" i]','button[aria-label*="Stop generating" i]','button[aria-label*="Arrêter la génération" i]','button[aria-label*="Arreter la generation" i]'
  ].map(s=>document.querySelector(s)).find(visible)||null;
  const busy=()=>ACTIVE.has(activity())||!!nativeStop();
  const segmentMs=()=>{const n=Number(root().dataset.ng129TestSegmentMs||0);return Number.isFinite(n)&&n>=120?n:DEFAULT_SEGMENT_MS;};
  const editors=()=>[...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(visible);
  const editor=()=>editors().at(-1)||null;
  const editorText=ed=>String(ed?('value'in ed?ed.value:ed.innerText||ed.textContent||''):'').trim();
  const normalized=v=>String(v||'').replace(/\r/g,'').trim();
  const knownAutoDraft=v=>{const text=normalized(v);return text===MESSAGE||text===LEGACY_MESSAGE;};

  function buttonScope(ed){return ed?.closest?.('form,[data-type*="composer" i],[class*="composer" i]')||document;}
  function sendCandidate(ed){
    const buttons=[...buttonScope(ed).querySelectorAll('button')];
    return buttons.find(b=>SEND_RX.test(`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''} ${b.title||''}`))||null;
  }
  function sendButton(ed){
    const button=sendCandidate(ed);
    return button&&visible(button)&&!button.disabled&&button.getAttribute('aria-disabled')!=='true'?button:null;
  }
  function setEditor(ed,text){
    if(!ed)return false;
    try{
      writing=true;
      if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):(ed.value=text);}
      else{ed.focus({preventScroll:true});ed.textContent=text;}
      ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:text?'insertText':'deleteContentBackward',data:text||null}));
      return text===''?!editorText(ed):knownAutoDraft(editorText(ed));
    }catch{return false;}finally{writing=false;}
  }
  function clearAutoDraft(ed){
    if(ed&&knownAutoDraft(editorText(ed))){setEditor(ed,'');root().dataset.ng129Watchdog='auto-draft-cleared';return true;}
    return false;
  }

  function syncNativeBusyGuard(){
    const stop=!!nativeStop(),state=activity();
    if(stop){root().dataset.ng129NativeBusy='1';if(root().dataset.ng8Running!=='1'){root().dataset.ng8Running='1';forcedRunning=true;}}
    else{delete root().dataset.ng129NativeBusy;if(forcedRunning&&!ACTIVE.has(state)){delete root().dataset.ng8Running;forcedRunning=false;}}
  }
  function clearTimers({keepDue=false}={}){clearTimeout(segmentTimer);clearTimeout(retryTimer);clearTimeout(primeTimer);segmentTimer=retryTimer=primeTimer=0;segmentStartedAt=0;if(!keepDue)due=false;}
  function scheduleGuard(){clearTimeout(guardTimer);guardTimer=setTimeout(()=>{guardTimer=0;syncNativeBusyGuard();if(busy()||due)scheduleGuard();},10000);}
  function armSegment(reset=false){
    if(suppressed)return;syncNativeBusyGuard();if(!busy())return;if(segmentTimer&&!reset)return;clearTimeout(segmentTimer);segmentStartedAt=Date.now();segmentTimer=setTimeout(()=>{segmentTimer=0;due=true;attemptResume('segment-deadline');},segmentMs());scheduleGuard();root().dataset.ng129Watchdog='armed';
  }
  function retryDue(delay=RETRY_MS){
    if(!due||suppressed)return;clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=0;attemptResume('retry');},delay);
  }
  function dispatchPrimed(source,ed){
    if(!due||suppressed||!ed?.isConnected)return false;
    const current=editorText(ed);
    if(!knownAutoDraft(current))return false;
    const button=sendButton(ed);
    if(!button){
      clearAutoDraft(ed);root().dataset.ng129Watchdog='waiting-send-control';retryDue();return false;
    }
    due=false;lastAutoAt=Date.now();root().dataset.ng129Watchdog='sending';
    document.dispatchEvent(new CustomEvent('niakgpt:long-run-resume',{detail:{source,at:lastAutoAt,elapsed:segmentStartedAt?lastAutoAt-segmentStartedAt:0}}));
    queueMicrotask(()=>{
      try{
        button.click();root().dataset.ng129Watchdog='sent';window.__NIAKGPT_DIAGNOSTICS__?.set('long-run-watchdog','REPRISE · tour automatique mis en file après fenêtre longue');
        // Clear only the exact generated protocol. If the user changed even one character after the click,
        // the watchdog no longer owns the draft and must leave it untouched.
        setTimeout(()=>{if(knownAutoDraft(editorText(ed)))clearAutoDraft(ed);},220);
      }catch{clearAutoDraft(ed);due=true;retryDue();}
      setTimeout(()=>armSegment(true),450);
    });
    return true;
  }
  function primeAndDispatch(source,ed){
    if(!due||suppressed||!ed?.isConnected)return false;
    if(!sendCandidate(ed)){root().dataset.ng129Watchdog='waiting-send-control';retryDue();return false;}
    if(!setEditor(ed,MESSAGE)){retryDue();return false;}
    root().dataset.ng129Watchdog='primed';
    clearTimeout(primeTimer);
    primeTimer=setTimeout(()=>{primeTimer=0;dispatchPrimed(source,ed);},PRIME_RETRY_MS);
    return true;
  }
  function attemptResume(source){
    syncNativeBusyGuard();if(!due||suppressed)return false;
    if(Date.now()-lastAutoAt<Math.min(segmentMs()*.7,60000)){retryDue();return false;}
    const ed=editor();if(!ed){retryDue();return false;}
    let draft=editorText(ed);
    if(draft&&!knownAutoDraft(draft)){root().dataset.ng129Watchdog='draft-protected';retryDue();return false;}

    // Clean only an exact stale automatic draft from a known NiakGPT build. Anything modified by the user is protected.
    if(draft&&knownAutoDraft(draft)){
      const button=sendButton(ed);
      if(button)return dispatchPrimed(source,ed);
      clearAutoDraft(ed);draft='';
    }

    return primeAndDispatch(source,ed);
  }

  function userTextForTarget(target){const b=target instanceof Element?target.closest('button'):null;if(b&&SEND_RX.test(`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''} ${b.title||''}`))return editorText(editor());return'';}
  function onUserSend(text){if(writing||!text||AUTO_RX.test(text))return;if(CANCEL_RX.test(text)){suppressed=true;clearTimers();root().dataset.ng129Watchdog='cancelled';return;}suppressed=false;}

  document.addEventListener('click',event=>{const text=userTextForTarget(event.target);if(text)onUserSend(text);setTimeout(()=>{syncNativeBusyGuard();armSegment();},80);},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;const target=event.target instanceof Element?event.target:null;if(!target?.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]'))return;onUserSend(editorText(target));setTimeout(()=>{syncNativeBusyGuard();armSegment();},80);},true);
  document.addEventListener('niakgpt:activity-changed',event=>{syncNativeBusyGuard();if(event.detail?.active===true||busy()){armSegment();return;}if(due){attemptResume('activity-ended');return;}clearTimers();root().dataset.ng129Watchdog='idle';});
  window.addEventListener('online',()=>{if(due)attemptResume('online');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncNativeBusyGuard();if(due)attemptResume('visible');else armSegment();}});
  window.addEventListener('pagehide',()=>{clearTimers();clearTimeout(guardTimer);},{once:true});
  setTimeout(()=>{syncNativeBusyGuard();const ed=editor();if(ed&&knownAutoDraft(editorText(ed)))clearAutoDraft(ed);armSegment();},250);
})();
