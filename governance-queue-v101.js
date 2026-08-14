(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_GOV_QUEUE_101__)return;
  window.__NIAKGPT_GOV_QUEUE_101__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  let timer=0,busy=false,lastCache={},lastGov={},queueIds=new Set();
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const isQueue=p=>!!p&&QUEUE_NAMES.has(norm(p.name));
  const deriveQueueIds=cache=>new Set((cache?.projects||[]).filter(isQueue).map(p=>p.id));

  async function initialRead(){
    try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);lastCache=raw[CACHE_KEY]||{};lastGov=raw[GOV_KEY]||{};queueIds=deriveQueueIds(lastCache);}catch{lastCache={};lastGov={};queueIds=new Set();}
  }
  async function sanitize(govOverride=null){
    if(busy)return;busy=true;
    try{
      const gov=govOverride||lastGov||{};if(!queueIds.size){patchModal();return;}
      const before=Array.isArray(gov.coreProjectIds)?gov.coreProjectIds:[],after=before.filter(id=>!queueIds.has(id));
      if(after.length!==before.length){lastGov={...gov,coreProjectIds:after,seeded:true};await chrome.storage.local.set({[GOV_KEY]:lastGov});}
      patchModal();
    }finally{busy=false;}
  }
  function patchModal(){
    const modal=document.getElementById('ng85-governance');if(!modal)return;
    for(const id of queueIds){
      const input=modal.querySelector(`input[data-core="${CSS.escape(id)}"]`);if(!input)continue;
      input.checked=false;input.disabled=true;input.setAttribute('aria-disabled','true');
      const label=input.closest('label');if(label){label.dataset.ng101Queue='1';const em=label.querySelector('em');if(em)em.textContent='À CLASSER · FILE D’ATTENTE';}
    }
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(()=>{timer=0;sanitize();},delay);}

  document.addEventListener('click',event=>{const el=event.target instanceof Element?event.target:null;if(el?.closest('[data-repair],[data-ng90-governance],[data-ng90-locks],#ng85-governance'))schedule(60);},true);
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes[CACHE_KEY]){lastCache=changes[CACHE_KEY].newValue||{};queueIds=deriveQueueIds(lastCache);patchModal();}
    if(changes[GOV_KEY]){lastGov=changes[GOV_KEY].newValue||{};sanitize(lastGov);}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)patchModal();});
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
  initialRead().then(()=>sanitize());
})();
