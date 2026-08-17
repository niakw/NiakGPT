(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_ASSIGNMENT_SELFHEAL_103__)return;
  window.__NIAKGPT_PROJECT_ASSIGNMENT_SELFHEAL_103__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  let timer=0,running=false,lastSignature='';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const canonical=p=>!!p&&String(p.id||'').startsWith('g-p-')&&!p.domOnly&&clean(p.name);
  const local=p=>!!p&&!canonical(p)&&clean(p.name)&&!p.duplicateOf;

  async function repair(){
    clearTimeout(timer);timer=0;if(running)return;running=true;
    try{
      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];if(!raw||typeof raw!=='object')return;
      const projects=Array.isArray(raw.projects)?raw.projects:[],chats=Array.isArray(raw.chats)?raw.chats:[];
      const byName=new Map(projects.filter(canonical).map(p=>[norm(p.name),p]));
      if(!byName.size)return;
      const localToCanonical=new Map();
      for(const p of projects.filter(local)){const target=byName.get(norm(p.name));if(target)localToCanonical.set(p.id,target.id);}
      if(!localToCanonical.size)return;
      const signature=JSON.stringify([...localToCanonical]);if(signature===lastSignature&&!chats.some(c=>localToCanonical.has(c?.projectId)))return;lastSignature=signature;
      let changed=0;const nextChats=chats.map(c=>{const target=localToCanonical.get(c?.projectId);if(!target)return c;changed++;return{...c,projectId:target};});
      if(!changed)return;
      const counts={...(raw.counts||{})};
      for(const [oldId,newId] of localToCanonical){
        const oldCount=Number(counts[oldId]);if(Number.isFinite(oldCount)){const existing=Number(counts[newId]);counts[newId]=Math.max(Number.isFinite(existing)?existing:0,oldCount);}
      }
      // Recompute canonical counts from the repaired chat inventory when possible.
      for(const id of new Set(localToCanonical.values())){const n=nextChats.filter(c=>c?.projectId===id).length;if(n)counts[id]=Math.max(Number(counts[id])||0,n);}
      const next={...raw,chats:nextChats,counts,at:Date.now()};
      await chrome.storage.local.set({[CACHE_KEY]:next});
      window.__NIAKGPT_DIAGNOSTICS__?.set('project-links',`AUTO-RÉPARÉ · ${changed} chat(s) rattaché(s)`);
    }catch(error){
      if(!/extension context invalidated/i.test(String(error?.message||error||'')))window.__NIAKGPT_DIAGNOSTICS__?.set('project-links',`ATTENTE · ${String(error?.message||error).slice(0,60)}`);
    }finally{running=false;}
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(()=>repair(),delay);}

  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])schedule(60);});
  document.addEventListener('niakgpt:server-projects-ready',()=>schedule(40));
  document.addEventListener('niakgpt:pins-rendered',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(100);});
  schedule(100);
})();
