(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_DOM_INDEX_101__)return;
  window.__NIAKGPT_DOM_INDEX_101__=true;
  const KEY='niakgpt-v08-cache',CHAT='a[href*="/c/"]',PROJECT='a[href*="/g/g-p-"][href*="/project"]',OWN='#ng8-rail,#ng8-panel,#ng8-status,#ng8-pins,#ng8-quick,#ng90-control';
  let timer=0,observer=null,root=null,last='';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const nav=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(CHAT))||null;
  function localId(name){let h=0;for(const c of norm(name))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return`dom-p-${(h>>>0).toString(36)}`;}
  function titleOf(a,old){if(old?.title)return old.title;const c=a.cloneNode(true);c.querySelectorAll('small,.ng8-chat-project').forEach(x=>x.remove());return clean(a.getAttribute('aria-label')||c.textContent)||'Conversation';}
  function labelOf(a,title){const small=clean(a.querySelector('small')?.textContent);if(small&&norm(small)!==norm(title))return small;const leaves=[...a.querySelectorAll('span')].filter(x=>!x.querySelector('span')).map(x=>clean(x.textContent)).filter(x=>x&&norm(x)!==norm(title)&&x.length<60);return leaves.at(-1)||'';}
  async function scan(){
    timer=0;const side=nav();if(!side)return;
    let raw={};try{raw=(await chrome.storage.local.get(KEY))[KEY]||{};}catch{}
    const projects=new Map((raw.projects||[]).map(p=>[p.id,{...p}])),byName=new Map([...projects.values()].filter(p=>p.name).map(p=>[norm(p.name),p]));
    const chats=new Map((raw.chats||[]).map(c=>[c.id,{...c}])),counts={...(raw.counts||{})},visible=new Map();
    for(const a of side.querySelectorAll(PROJECT)){
      if(a.closest(OWN))continue;const id=pid(a.getAttribute('href')),name=clean(a.getAttribute('aria-label')||a.textContent);if(!id||!name)continue;
      const p={...(projects.get(id)||{}),id,name,href:a.getAttribute('href'),domOnly:false};projects.set(id,p);byName.set(norm(name),p);
    }
    for(const a of side.querySelectorAll(CHAT)){
      if(a.closest(OWN))continue;const href=a.getAttribute('href')||'',id=cid(href);if(!id)continue;
      const old=chats.get(id)||{},title=titleOf(a,old),label=labelOf(a,title);let projectId=pid(href)||old.projectId||'';
      if(label){let p=byName.get(norm(label));if(!p){const id=localId(label);p={id,name:label,href,domOnly:true};projects.set(id,p);byName.set(norm(label),p);}projectId=p.id;}
      chats.set(id,{...old,id,title,projectId,href:href||old.href||''});if(projectId)visible.set(projectId,(visible.get(projectId)||0)+1);
    }
    for(const [id,n] of visible)if(counts[id]==null||id.startsWith('dom-p-'))counts[id]=n;
    const next={schema:2,at:Date.now(),projects:[...projects.values()],chats:[...chats.values()],counts,indexedProjectIds:Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]};
    const sig=JSON.stringify([next.projects.map(p=>[p.id,p.name]),next.chats.map(c=>[c.id,c.projectId,c.title]),counts]);if(sig===last)return;last=sig;
    try{await chrome.storage.local.set({[KEY]:next});window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`OK · ${next.projects.length} Projects · ${next.chats.length} chats`);}catch(e){window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`ERREUR · ${String(e?.message||e).slice(0,60)}`);}
  }
  function schedule(ms=120){clearTimeout(timer);timer=setTimeout(scan,ms);}
  function watch(){const side=nav();if(side&&side!==root){observer?.disconnect();root=side;observer=new MutationObserver(()=>schedule(160));observer.observe(side,{childList:true,subtree:true,characterData:true});}schedule(40);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)watch();});window.addEventListener('popstate',()=>schedule());
  window.addEventListener('pagehide',()=>{clearTimeout(timer);observer?.disconnect();},{once:true});watch();
})();
