(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_GOV_QUEUE_101__)return;
  window.__NIAKGPT_GOV_QUEUE_101__=true;
  const CACHE='niakgpt-v08-cache',GOV='niakgpt-governance-v085';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const isQueue=p=>['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify'].includes(norm(p?.name));
  let busy=false,timer=0;
  async function sanitize(){if(busy)return;busy=true;try{const raw=await chrome.storage.local.get([CACHE,GOV]),cache=raw[CACHE]||{},gov=raw[GOV]||{},queue=new Set((cache.projects||[]).filter(isQueue).map(p=>p.id));if(!queue.size)return;const ids=(gov.coreProjectIds||[]).filter(id=>!queue.has(id));if(ids.length!==(gov.coreProjectIds||[]).length)await chrome.storage.local.set({[GOV]:{...gov,coreProjectIds:ids}});document.documentElement.dataset.ng101QueueIds=[...queue].join(',');window.__NIAKGPT_DIAGNOSTICS__?.set('file-attente',`À CLASSER · FILE D’ATTENTE · ${queue.size} Project${queue.size>1?'s':''}`);}catch{}finally{busy=false;}}
  function schedule(delay=120){clearTimeout(timer);timer=setTimeout(sanitize,delay);}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE]||changes[GOV]))schedule();});
  document.addEventListener('niakgpt:settings-changed',()=>schedule());window.addEventListener('popstate',()=>schedule(220));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(180);});
  setTimeout(sanitize,1000);
})();
