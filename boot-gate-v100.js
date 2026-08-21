(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BOOT_GATE_100__)return;
  window.__NIAKGPT_BOOT_GATE_100__=true;

  const captured=[];
  const CONTINUITY_PENDING_KEY='niakgpt-continuity-pending-v100';
  const CONTINUITY_STORE_KEY='niakgpt-continuity-pending-v124';
  const CONTINUITY_LOCK_KEY='niakgpt-continuity-project-lock-v124';
  const PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  let safeToMutate=false;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const message=value=>String(value?.message||value?.reason?.message||value?.reason||value||'Erreur inconnue').replace(/\s+/g,' ').slice(0,260);
  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();

  function remember(kind,value){
    const line=`${kind}: ${message(value)}`;
    if(!captured.includes(line))captured.unshift(line);
    captured.splice(10);
    try{sessionStorage.setItem('niakgpt-last-boot-errors-v100',JSON.stringify(captured));}catch{}
  }
  window.addEventListener('error',event=>remember('JS',event.error||event.message),true);
  window.addEventListener('unhandledrejection',event=>remember('PROMISE',event.reason),true);

  function waitDomInteractive(){
    if(document.readyState!=='loading')return Promise.resolve();
    return new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  }

  async function waitForChatShell(timeout=8000){
    const start=performance.now();
    while(performance.now()-start<timeout){
      if(document.body&&(document.querySelector('main')||document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||document.querySelector('nav,aside')))return;
      await sleep(80);
    }
  }

  function continuityEditor(){return document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));}
  function editorText(ed){return clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');}
  function setEditor(ed,text){
    if(!ed)return false;
    try{if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}else{ed.focus();ed.textContent=text;}ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));return true;}catch(error){remember('CONTINUITY-EDITOR',error);return false;}
  }
  function pendingFromSession(){
    try{const p=JSON.parse(sessionStorage.getItem(CONTINUITY_PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}
  }
  async function pendingContinuity(){
    const fast=pendingFromSession();if(fast)return fast;
    try{const p=(await chrome.storage.local.get(CONTINUITY_STORE_KEY))[CONTINUITY_STORE_KEY]||null;if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;try{sessionStorage.setItem(CONTINUITY_PENDING_KEY,JSON.stringify(p));}catch{}return p;}catch(error){remember('CONTINUITY-STORE',error);return null;}
  }
  async function consumePendingBeforeInjection(pending){
    if(!pending)return false;
    const lock={schema:1,chatId:pending.chatId||'',projectId:pending.projectId||'',projectName:pending.projectName||'',chatName:pending.chatName||'',exactProject:pending.exactProject!==false&&!!pending.projectId,createdAt:Number(pending.createdAt||Date.now()),consumedAt:Date.now(),sourceUrl:pending.sourceUrl||''};
    try{
      if(lock.projectId){await chrome.storage.local.set({[CONTINUITY_LOCK_KEY]:lock});try{sessionStorage.setItem(PIN_OPEN_KEY,lock.projectId);}catch{}}
      await chrome.storage.local.remove(CONTINUITY_STORE_KEY);
      try{sessionStorage.removeItem(CONTINUITY_PENDING_KEY);}catch{}
      return true;
    }catch(error){
      try{sessionStorage.setItem(CONTINUITY_PENDING_KEY,JSON.stringify(pending));}catch{}
      remember('CONTINUITY-CONSUME',error);
      return false;
    }
  }
  async function restorePendingContinuity(timeout=6500){
    const pending=await pendingContinuity();if(!pending?.capsule||pending.autoSend===true)return false;
    const started=performance.now();
    while(performance.now()-started<timeout){
      const ed=continuityEditor();
      if(ed){
        const current=editorText(ed);
        if(current.includes('CONTINUITÉ NIAKGPT')){if(await consumePendingBeforeInjection(pending))return true;}
        else{
          const text=current?`${pending.capsule}\n\nBROUILLON PRÉSERVÉ AVANT CONTINUITÉ\n${current}`:pending.capsule;
          if(await consumePendingBeforeInjection(pending)&&setEditor(ed,text))return true;
        }
      }
      await sleep(70);
    }
    return false;
  }

  async function guardUpdateOnboarding(){
    try{
      const INSTALL_META='niakgpt-install-meta-v100',KEY='niakgpt-onboarding-v100',version=chrome.runtime.getManifest().version;
      const raw=await chrome.storage.local.get([INSTALL_META,KEY]),lifecycle=raw[INSTALL_META];
      const isUpgrade=!!lifecycle?.previousVersion||lifecycle?.reason==='update';
      if(!raw[KEY]&&isUpgrade)await chrome.storage.local.set({[KEY]:{status:'upgrade-skipped',version,previousVersion:lifecycle.previousVersion||'',at:Date.now()}});
    }catch(error){remember('ONBOARDING-GUARD',error);}
  }

  function make(tag,text,className=''){
    const el=document.createElement(tag);
    if(text!=null)el.textContent=text;
    if(className)el.className=className;
    return el;
  }

  function showFallback(injectionErrors=[]){
    if(!safeToMutate||!document.body||document.body.classList.contains('ng8-ready'))return;
    const errors=[...injectionErrors,...captured];
    document.body.classList.add('ng8-ready');

    let rail=document.getElementById('ng8-rail');
    if(!rail){
      rail=make('aside');rail.id='ng8-rail';rail.setAttribute('aria-label','Outils NiakGPT · secours bootstrap');
      const explorer=make('button','▤');explorer.type='button';explorer.setAttribute('aria-label','Explorer');
      const toc=make('button','☷');toc.type='button';toc.setAttribute('aria-label','Sommaire');
      const diag=make('button','◉');diag.type='button';diag.setAttribute('aria-label','Diagnostic bootstrap');
      const quick=make('button','⌘');quick.type='button';quick.setAttribute('aria-label','Quick Open');
      rail.append(explorer,toc,diag,make('span'),quick);
      document.body.appendChild(rail);
      diag.addEventListener('click',()=>{
        let panel=document.getElementById('ng8-panel');
        if(!panel){panel=make('aside');panel.id='ng8-panel';document.body.appendChild(panel);}
        panel.replaceChildren(make('h3','NIAKGPT · BOOT DIAGNOSTIC'),make('p','Le runtime principal n’a pas terminé son bootstrap après l’hydratation de ChatGPT.'));
        for(const err of errors.length?errors:['Aucune exception capturée.'])panel.append(make('pre',err));
        Object.assign(panel.style,{display:'block',position:'fixed',right:'46px',top:'70px',zIndex:'2147483646',width:'440px',maxWidth:'calc(100vw - 70px)',maxHeight:'70vh',overflow:'auto',padding:'14px',background:'#091018',color:'#d7e3ee',border:'1px solid #c84b4b',fontFamily:'Consolas,monospace'});
      });
    }

    if(!document.getElementById('ng8-status')){
      const status=make('div');status.id='ng8-status';
      status.append(make('span',`NiakGPT ${chrome.runtime.getManifest().version}`,'ng8-version'),make('span','BOOT SECOURS','ng8-status-project'),make('strong','BY SKYNET'),make('span','RUNTIME INCOMPLET','ng8-core-state'));
      document.body.appendChild(status);
    }
  }

  async function injectRuntime(){
    let result={ok:false,errors:['runtime_message_failed']};
    for(const delay of [0,240,720]){
      if(delay)await sleep(delay);
      try{result=await chrome.runtime.sendMessage({type:'niakgpt:inject-runtime-v100'})||result;}
      catch(error){result={ok:false,errors:[`runtime_message:${message(error)}`]};}
      if(result.ok||document.body?.classList.contains('ng8-ready'))break;
    }
    return result;
  }

  async function start(){
    await waitDomInteractive();
    safeToMutate=!!document.body;
    await waitForChatShell();
    await restorePendingContinuity();
    await guardUpdateOnboarding();

    const result=await injectRuntime();
    const deadline=performance.now()+9000;
    while(performance.now()<deadline){
      if(document.body?.classList.contains('ng8-ready'))return;
      await sleep(120);
    }
    showFallback(result.errors||[]);
  }

  start().catch(error=>{
    remember('BOOT',error);
    if(safeToMutate)showFallback([`BOOT:${message(error)}`]);
  });
})();
