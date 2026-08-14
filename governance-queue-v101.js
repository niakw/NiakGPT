(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_GOV_QUEUE_101__)return;
  window.__NIAKGPT_GOV_QUEUE_101__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  let timer=0,busy=false;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const isQueue=p=>!!p&&QUEUE_NAMES.has(norm(p.name));

  async function read(){
    try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);return{cache:raw[CACHE_KEY]||{},gov:raw[GOV_KEY]||{}};}catch{return{cache:{},gov:{}};}
  }
  async function sanitize(){
    if(busy)return;busy=true;
    try{
      const{cache,gov}=await read(),queueIds=new Set((cache.projects||[]).filter(isQueue).map(p=>p.id));if(!queueIds.size)return;
      const before=Array.isArray(gov.coreProjectIds)?gov.coreProjectIds:[],after=before.filter(id=>!queueIds.has(id));
      if(after.length!==before.length)await chrome.storage.local.set({[GOV_KEY]:{...gov,coreProjectIds:after,seeded:true}});
      patchModal(cache,queueIds);
    }finally{busy=false;}
  }
  function patchModal(cache,knownQueueIds=null){
    const modal=document.getElementById('ng85-governance');if(!modal)return;
    const queueIds=knownQueueIds||new Set((cache?.projects||[]).filter(isQueue).map(p=>p.id));
    for(const id of queueIds){
      const input=modal.querySelector(`input[data-core="${CSS.escape(id)}"]`);if(!input)continue;
      input.checked=false;input.disabled=true;input.setAttribute('aria-disabled','true');
      const label=input.closest('label');if(label){label.dataset.ng101Queue='1';const em=label.querySelector('em');if(em)em.textContent='À CLASSER · FILE D’ATTENTE';}
    }
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(()=>{timer=0;sanitize();},delay);}

  document.addEventListener('click',event=>{const el=event.target instanceof Element?event.target:null;if(el?.closest('[data-repair],[data-ng90-governance],[data-ng90-locks],#ng85-governance'))schedule(60);},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE_KEY]||changes[GOV_KEY]))schedule(100);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(160);});
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
  schedule(1200);
})();
