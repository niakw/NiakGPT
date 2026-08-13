(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BOOT_GATE_100__)return;
  window.__NIAKGPT_BOOT_GATE_100__=true;

  const captured=[];
  let safeToMutate=false;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const message=value=>String(value?.message||value?.reason?.message||value?.reason||value||'Erreur inconnue').replace(/\s+/g,' ').slice(0,260);

  function remember(kind,value){
    const line=`${kind}: ${message(value)}`;
    if(!captured.includes(line))captured.unshift(line);
    captured.splice(10);
    try{sessionStorage.setItem('niakgpt-last-boot-errors-v100',JSON.stringify(captured));}catch{}
  }
  window.addEventListener('error',event=>remember('JS',event.error||event.message),true);
  window.addEventListener('unhandledrejection',event=>remember('PROMISE',event.reason),true);

  function waitLoad(){
    if(document.readyState==='complete')return Promise.resolve();
    return new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
  }

  async function waitForChatShell(timeout=10000){
    const start=performance.now();
    while(performance.now()-start<timeout){
      if(document.body&&(document.querySelector('main')||document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||document.querySelector('nav,aside')))return;
      await sleep(100);
    }
  }

  function waitForQuiet(quietMs=700,maxWait=3500){
    return new Promise(resolve=>{
      if(!document.documentElement){resolve();return;}
      let done=false,last=performance.now();
      const observer=new MutationObserver(()=>{last=performance.now();});
      observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
      const start=performance.now();
      const tick=()=>{
        if(done)return;
        const now=performance.now();
        if(now-last>=quietMs||now-start>=maxWait){
          done=true;observer.disconnect();resolve();return;
        }
        setTimeout(tick,100);
      };
      setTimeout(tick,100);
    });
  }

  function nextFrames(){
    return new Promise(resolve=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if('requestIdleCallback'in window){
          try{requestIdleCallback(()=>resolve(),{timeout:1200});return;}catch{}
        }
        setTimeout(resolve,80);
      }));
    });
  }

  async function guardUpdateOnboarding(){
    try{
      const INSTALL_META='niakgpt-install-meta-v100',KEY='niakgpt-onboarding-v100',version=chrome.runtime.getManifest().version;
      const raw=await chrome.storage.local.get([INSTALL_META,KEY]),lifecycle=raw[INSTALL_META];
      if(!raw[KEY]&&lifecycle?.reason==='update')await chrome.storage.local.set({[KEY]:{status:'upgrade-skipped',version,previousVersion:lifecycle.previousVersion||'',at:Date.now()}});
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

  async function start(){
    await waitLoad();
    await waitForChatShell();
    await sleep(2500);
    await waitForQuiet();
    await nextFrames();
    safeToMutate=true;
    await guardUpdateOnboarding();

    let result={ok:false,errors:['runtime_message_failed']};
    try{result=await chrome.runtime.sendMessage({type:'niakgpt:inject-runtime-v100'})||result;}
    catch(error){result={ok:false,errors:[`runtime_message:${message(error)}`]};}

    const deadline=performance.now()+8000;
    while(performance.now()<deadline){
      if(document.body?.classList.contains('ng8-ready'))return;
      await sleep(150);
    }
    showFallback(result.errors||[]);
  }

  start().catch(error=>{
    remember('BOOT',error);
    if(safeToMutate)showFallback([`BOOT:${message(error)}`]);
  });
})();
