(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_SIDEBAR_HOST_090__) return;
  window.__NIAKGPT_SIDEBAR_HOST_090__ = true;

  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const CHAT_SEL='a[href*="/c/"]';
  const CACHE_KEY='niakgpt-v08-cache';
  let bootstrapObserver=null,bootstrapTimer=0,repairTimer=0,dataTimer=0,dataObserver=null,dataRoot=null,lastDataSignature='';

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  function localPid(name){let h=0;for(const c of norm(name))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return`dom-p-${(h>>>0).toString(36)}`;}

  function navRoot(){
    return document.querySelector('[data-testid="conversation-sidebar"]') ||
      document.querySelector('[data-testid="sidebar"]') ||
      [...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL)||x.querySelector(CHAT_SEL)) ||
      document.querySelector('nav');
  }

  function topChild(root,node){
    if(!root||!node)return null;
    let current=node;
    while(current.parentElement&&current.parentElement!==root)current=current.parentElement;
    return current.parentElement===root?current:null;
  }

  function chatTitle(anchor,old){
    if(old?.title)return old.title;
    const clone=anchor.cloneNode(true);clone.querySelectorAll('small,.ng8-chat-project').forEach(x=>x.remove());
    return clean(anchor.getAttribute('aria-label')||clone.textContent)||'Conversation';
  }
  function projectLabel(anchor,title){
    const small=clean(anchor.querySelector('small')?.textContent);if(small&&norm(small)!==norm(title))return small;
    const leaves=[...anchor.querySelectorAll('span')].filter(x=>!x.querySelector('span')).map(x=>clean(x.textContent)).filter(x=>x&&norm(x)!==norm(title)&&x.length<60);
    return leaves.at(-1)||'';
  }
  async function indexVisible(root){
    dataTimer=0;if(!root?.isConnected)return;
    let raw={};try{raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{}
    const projects=new Map((raw.projects||[]).map(p=>[p.id,{...p}]));
    const byName=new Map([...projects.values()].filter(p=>p.name).map(p=>[norm(p.name),p]));
    const chats=new Map((raw.chats||[]).map(c=>[c.id,{...c}]));
    const counts={...(raw.counts||{})},visible=new Map();

    for(const a of root.querySelectorAll(PROJECT_SEL)){
      if(a.closest('#ng8-pins'))continue;const id=pid(a.getAttribute('href')),name=clean(a.getAttribute('aria-label')||a.textContent);if(!id||!name)continue;
      const p={...(projects.get(id)||{}),id,name,href:a.getAttribute('href')||`/g/${id}/project`,domOnly:false};projects.set(id,p);byName.set(norm(name),p);
    }
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(a.closest('#ng8-pins,#ng8-quick'))continue;const href=a.getAttribute('href')||'',id=cid(href);if(!id)continue;
      const old=chats.get(id)||{},title=chatTitle(a,old),label=projectLabel(a,title);let projectId=pid(href)||old.projectId||'';
      if(label){let p=byName.get(norm(label));if(!p){const id=localPid(label);p={id,name:label,href,domOnly:true};projects.set(id,p);byName.set(norm(label),p);}projectId=p.id;}
      chats.set(id,{...old,id,title,projectId,href:href||old.href||''});if(projectId)visible.set(projectId,(visible.get(projectId)||0)+1);
    }
    for(const [id,n] of visible)if(counts[id]==null||id.startsWith('dom-p-'))counts[id]=n;
    const next={schema:2,at:Date.now(),projects:[...projects.values()],chats:[...chats.values()],counts,indexedProjectIds:Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]};
    const signature=JSON.stringify([next.projects.map(p=>[p.id,p.name]),next.chats.map(c=>[c.id,c.projectId,c.title]),counts]);if(signature===lastDataSignature)return;lastDataSignature=signature;
    try{await chrome.storage.local.set({[CACHE_KEY]:next});window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`OK · ${next.projects.length} Projects · ${next.chats.length} chats`);}catch(e){window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`ERREUR · ${String(e?.message||e).slice(0,60)}`);}
  }
  function scheduleData(root,delay=100){clearTimeout(dataTimer);dataTimer=setTimeout(()=>indexVisible(root),delay);}
  function watchData(root){if(root===dataRoot)return;dataObserver?.disconnect();dataRoot=root;if(!root)return;dataObserver=new MutationObserver(()=>scheduleData(root,160));dataObserver.observe(root,{childList:true,subtree:true,characterData:true});scheduleData(root,0);}

  function repair(){
    clearTimeout(repairTimer);repairTimer=0;
    const root=navRoot();if(!root)return false;watchData(root);
    const boxes=[...document.querySelectorAll('#ng8-pins')];
    let host=boxes.find(box=>root.contains(box))||boxes[0]||null;
    if(!host){host=document.createElement('section');host.id='ng8-pins';}
    if(!root.contains(host)){
      const firstProject=root.querySelector(PROJECT_SEL),anchor=topChild(root,firstProject);
      root.insertBefore(host,anchor||root.firstElementChild||null);
    }
    for(const box of boxes){if(box!==host)box.remove();}
    host.dataset.ng90SidebarHost='1';document.documentElement.dataset.ng90ProjectHosts='1';scheduleData(root,40);return true;
  }

  function schedule(delay=60){clearTimeout(repairTimer);repairTimer=setTimeout(repair,delay);}
  function bootstrap(){
    if(repair()){bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);return;}
    if(!document.documentElement)return;
    bootstrapObserver=new MutationObserver(()=>{if(repair()){bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});bootstrapTimer=setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('nav,[data-testid*="sidebar"]'))schedule(80);},true);
  window.addEventListener('popstate',()=>schedule(100));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(120);});
  window.addEventListener('pagehide',()=>{clearTimeout(dataTimer);dataObserver?.disconnect();},{once:true});bootstrap();
})();
