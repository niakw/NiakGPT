(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_LIMIT_125__)return;
  window.__NIAKGPT_CONTINUITY_LIMIT_125__=true;

  const LIMIT_RX=/(maximum\s+(?:conversation|context|length)|conversation\s+(?:is\s+)?too\s+long|conversation.{0,42}(?:limit|maximum)|maximum\s+context\s+length|context\s+window.{0,38}(?:limit|maximum)|you(?:'|’)ve\s+reached.{0,50}(?:limit|maximum)|conversation\s+trop\s+longue|limite.{0,38}(?:conversation|contexte)|ce\s+fil.{0,34}(?:plein|limite|maximum))/i;
  const CONTINUE_RX=/(start\s+(?:a\s+)?new\s+chat|continue\s+in\s+(?:a\s+)?new\s+chat|new\s+(?:chat|conversation)|(?:nouveau|nouvelle)\s+(?:chat|conversation)|continuer.{0,30}(?:nouveau|nouvelle)\s+(?:chat|conversation)|poursuivre.{0,30}(?:nouveau|nouvelle)\s+(?:chat|conversation))/i;
  const STRONG_SEL='[role="alert"],[role="status"],[data-testid*="limit" i],[data-testid*="error" i],[data-testid*="toast" i]';
  let observer=null,timer=0,handling=false,handledChat='';

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const visible=el=>{if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const currentCid=()=>String(location.pathname).match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const own=el=>!!el?.closest?.('#ng119-interruption,#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng90-control,#ng100-command');
  const text=el=>clean(`${el?.getAttribute?.('aria-label')||''} ${el?.getAttribute?.('title')||''} ${el?.innerText||el?.textContent||''}`).slice(0,2600);

  function interactiveLimitCard(){
    const main=document.querySelector('main,[role="main"]');if(!main)return null;
    for(const control of main.querySelectorAll('button,[role="button"],a[href]')){
      if(!visible(control)||own(control)||!CONTINUE_RX.test(text(control)))continue;
      let node=control;
      for(let depth=0;depth<6&&node&&node!==main;depth++,node=node.parentElement){
        if(!visible(node)||own(node))continue;const sample=text(node);if(!LIMIT_RX.test(sample))continue;
        const userTurn=node.closest('[data-message-author-role="user"]');if(userTurn)continue;
        return{node,control,sample};
      }
    }
    return null;
  }
  function strongLimitCard(){
    const main=document.querySelector('main,[role="main"]');if(!main)return null;
    for(const node of main.querySelectorAll(STRONG_SEL)){
      if(!visible(node)||own(node))continue;const sample=text(node);if(LIMIT_RX.test(sample)&&(CONTINUE_RX.test(sample)||node.matches('[data-testid*="limit" i]')))return{node,control:null,sample};
    }
    return null;
  }
  function signal(){return strongLimitCard()||interactiveLimitCard();}

  function mount(){
    let box=document.getElementById('ng119-interruption');if(!box){box=document.createElement('aside');box.id='ng119-interruption';document.body.appendChild(box);}
    box.dataset.type='limit';box.dataset.ng125Limit='1';box.setAttribute('role','status');
    box.innerHTML='<strong>FIL ARRIVÉ À SA LIMITE</strong><span>NiakGPT a préparé la continuité avec le contexte du fil.</span><button type="button" class="ng100-continue">CONTINUER LE FIL</button>';
    document.documentElement.dataset.ng119Interruption='limit';document.documentElement.dataset.ng125LimitReady='1';
    return box;
  }
  async function handle(found){
    const chatId=currentCid();if(!chatId||handling||handledChat===chatId)return false;handling=true;
    try{
      const ok=await window.__NIAKGPT_CONTINUITY__?.markCurrentOut?.('limit-detected-v125',{trusted:true,evidence:'native-limit-v120'});
      if(ok===false)return false;
      mount();handledChat=chatId;window.__NIAKGPT_DIAGNOSTICS__?.set('limit-125',`OUT · limite native moderne confirmée · ${clean(found?.sample).slice(0,80)}`);return true;
    }catch{return false;}finally{handling=false;}
  }
  function scan(){timer=0;const chatId=currentCid();if(!chatId){handledChat='';return;}if(handledChat===chatId&&document.getElementById('ng119-interruption'))return;const found=signal();if(found)handle(found);}
  function schedule(delay=90){clearTimeout(timer);timer=setTimeout(scan,delay);}
  function onRoute(){const next=currentCid();if(next!==handledChat){handledChat='';delete document.documentElement.dataset.ng125LimitReady;}schedule(120);}

  observer=new MutationObserver(records=>{
    const relevant=records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&(n.matches?.(`${STRONG_SEL},button,[role="button"],a`)||n.querySelector?.(`${STRONG_SEL},button,[role="button"],a`))));if(relevant)schedule(70);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('niakgpt:activity-changed',event=>{if(event.detail?.active===false)schedule(80);});
  window.addEventListener('popstate',onRoute);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',onRoute);
  window.addEventListener('pageshow',()=>schedule(100));window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(timer);},{once:true});
  schedule(120);
})();