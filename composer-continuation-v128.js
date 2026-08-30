(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com')return;
  const init=()=>{
    if(window.__NIAKGPT_PARALLEL_CONTINUE_128__)return;
    window.__NIAKGPT_PARALLEL_CONTINUE_128__=true;

  const COMPOSER_SEL='#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]';
  const ACTIVE_STATES=new Set(['waiting','thinking','executing']);
  const HEADER='↳ Suite en parallèle';
  const LEGACY_HEADER='--- CONTINUE — AJOUT EN PARALLÈLE ---';
  const LEGACY_INSTRUCTION='Poursuis le travail déjà en cours';
  const INSTRUCTION="Continue la tâche en cours jusqu’au bout et intègre cet ajout sans interrompre le travail déjà lancé.";
  const PREFIX=`${HEADER} — ${INSTRUCTION}\n\n`;
  const MARKER_RX=/^\s*(?:↳\s*Suite en parallèle|---\s*CONTINUE(?:\s*[—–-]\s*AJOUT EN PARALLÈLE)?\s*---)/i;
  const CANCEL_RX=/^\s*(?:stop\b|stoppe\b|arr(?:ê|e)te\b|annule\b|cancel\b|abort\b|interromps\b|laisse\s+tomber\b|ne\s+continue\s+pas\b)/i;
  const SEND_RX=/(?:^|\b)(?:send|envoyer|submit)(?:\b|$)/i;
  let idleTriggerUntil=0,cleanupToken=0;

  const visible=el=>{
    if(!(el instanceof Element)||!el.isConnected)return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;
  };
  const activityState=()=>String(document.documentElement.dataset.ng86Activity||'').toLowerCase();
  const nativeGenerationBusy=()=>[
    'button[data-testid="stop-button"]',
    'button[data-testid*="stop-generating" i]',
    'button[aria-label*="Stop generating" i]',
    'button[aria-label*="Arrêter la génération" i]',
    'button[aria-label*="Arreter la generation" i]'
  ].some(selector=>visible(document.querySelector(selector)));
  const preexistingActivity=()=>ACTIVE_STATES.has(activityState())||nativeGenerationBusy();
  const editorText=editor=>String(editor?('value'in editor?editor.value:editor.innerText||editor.textContent||''):'');
  const compact=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
  const userTurns=()=>[...document.querySelectorAll('[data-message-author-role="user"]')];

  function visibleEditor(scope=document){
    const editors=[...scope.querySelectorAll(COMPOSER_SEL)].filter(visible);
    return editors.at(-1)||null;
  }
  function editorForTarget(target){
    if(!(target instanceof Element))return null;
    return target.matches(COMPOSER_SEL)?target:target.closest(COMPOSER_SEL);
  }
  function editorForButton(button){
    const scope=button?.closest?.('form,[data-type*="composer" i],[class*="composer" i]');
    return visibleEditor(scope||document);
  }
  function sendButton(target){
    const button=target instanceof Element?target.closest('button'):null;
    if(!button)return null;
    const label=`${button.getAttribute('aria-label')||''} ${button.getAttribute('data-testid')||''} ${button.title||''}`;
    return SEND_RX.test(label)?button:null;
  }

  function setEditorText(editor,value){
    if(!editor)return false;
    try{
      if('value'in editor){
        const proto=Object.getPrototypeOf(editor);
        const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
        setter?setter.call(editor,value):(editor.value=value);
        editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:value?'insertText':'deleteContentBackward',data:value||null}));
        return value===''?!editorText(editor).trim():MARKER_RX.test(editorText(editor));
      }
      if(editor.isContentEditable){
        editor.focus({preventScroll:true});
        const selection=getSelection(),range=document.createRange();
        range.selectNodeContents(editor);selection?.removeAllRanges();selection?.addRange(range);
        let inserted=false;
        try{inserted=!!document.execCommand?.('insertText',false,value);}catch{}
        if(!inserted||(value&&!MARKER_RX.test(editorText(editor)))){
          editor.textContent=value;
          editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:value?'insertText':'deleteContentBackward',data:value||null}));
        }
        return value===''?!editorText(editor).trim():MARKER_RX.test(editorText(editor));
      }
    }catch{}
    return false;
  }

  function sentTurnExists(raw,payload,baselineUserCount){
    const rawNeedle=compact(raw).slice(0,180),payloadNeedle=compact(payload).slice(0,180);
    if(!rawNeedle&&!payloadNeedle)return false;
    const turns=userTurns();
    if(turns.length<=baselineUserCount)return false;
    return turns.slice(baselineUserCount).some(turn=>{
      const value=compact(turn.innerText||turn.textContent||'');
      return !!value&&((rawNeedle&&value.includes(rawNeedle))||(payloadNeedle&&value.includes(payloadNeedle)));
    });
  }

  function cleanupAfterNativeSend(editor,raw,payload,baselineUserCount){
    const token=++cleanupToken,rawTrim=raw.trim(),payloadTrim=payload.trim();
    let attempts=0;
    const check=()=>{
      if(token!==cleanupToken||!editor?.isConnected)return;
      const current=editorText(editor).trim();
      if(!current)return;
      if(current!==payloadTrim&&current!==rawTrim)return; // Never erase text the user changed after clicking Send.
      if(sentTurnExists(raw,payload,baselineUserCount)){
        setEditorText(editor,'');
        document.documentElement.dataset.ng128ComposerCleanup='confirmed-clear';
        return;
      }
      // The host occasionally accepts the click but leaves our capture-phase prefix in its controlled draft.
      // Strip only NiakGPT's protocol immediately; preserve the user's exact text until a new sent turn is observable.
      if(current===payloadTrim){
        setEditorText(editor,raw);
        document.documentElement.dataset.ng128ComposerCleanup='prefix-stripped';
      }
      attempts++;
      if(attempts<18)setTimeout(check,120);
    };
    setTimeout(check,80);
  }

  function prepareParallelContinuation(editor,source){
    if(!editor||!visible(editor))return false;
    const now=performance.now();
    if(now<idleTriggerUntil)return false;
    if(!preexistingActivity()){
      idleTriggerUntil=now+450;
      return false;
    }
    const raw=editorText(editor);
    if(!raw.trim()||MARKER_RX.test(raw)||CANCEL_RX.test(raw))return false;
    const payload=`${PREFIX}${raw}`,baselineUserCount=userTurns().length;
    const applied=setEditorText(editor,payload);
    if(applied){
      cleanupAfterNativeSend(editor,raw,payload,baselineUserCount);
      document.dispatchEvent(new CustomEvent('niakgpt:parallel-continue',{detail:{state:activityState(),source,at:Date.now()}}));
      window.__NIAKGPT_DIAGNOSTICS__?.set('parallel-continue',`CONTINUE · ${activityState()||'native-busy'} · ${source}`);
    }
    return applied;
  }

  document.addEventListener('click',event=>{
    const button=sendButton(event.target);if(!button)return;
    prepareParallelContinuation(editorForButton(button),'click');
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    const editor=editorForTarget(event.target);if(!editor)return;
    prepareParallelContinuation(editor,'enter');
  },true);
  };
  if(window.__NIAKGPT_HOST_HYDRATED_100__)init();
  else window.addEventListener('niakgpt:host-hydrated-v100',init,{once:true});
})();
