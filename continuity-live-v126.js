(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_CONTINUITY_LIVE_126__)return;
  window.__NIAKGPT_CONTINUITY_LIVE_126__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const PENDING_KEY='niakgpt-continuity-pending-v100';
  const PENDING_STORE_KEY='niakgpt-continuity-pending-v124';
  const PIN_OPEN_KEY='niakgpt-open-pin-folder-v096';
  let injectTimer=0,routeEpoch=0;

  const clean=v=>String(v??'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const cid=v=>String(v||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const normalizePid=v=>{const s=String(v||'').trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach,#ng119-interruption'));
  const editorText=ed=>clean(ed?('value'in ed?ed.value:ed.innerText||ed.textContent):'');
  const outsideOwn=el=>!!el&&!el.closest?.('#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng119-interruption');

  function setEditor(ed,text){
    if(!ed)return false;
    try{
      if('value'in ed){const proto=Object.getPrototypeOf(ed),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(ed,text):ed.value=text;}
      else{ed.focus();ed.textContent=text;}
      ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));ed.dispatchEvent(new Event('change',{bubbles:true}));return editorText(ed).includes('CONTINUITÉ NIAKGPT');
    }catch{return false;}
  }
  async function cache(){try{return(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{return{};}}
  async function storePending(p){
    try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}
    try{await chrome.storage.local.set({[PENDING_STORE_KEY]:p});}catch{}
    if(p.projectId)try{sessionStorage.setItem(PIN_OPEN_KEY,p.projectId);}catch{}
    return p;
  }
  async function pending(){
    try{const fast=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(fast?.capsule&&Date.now()-Number(fast.createdAt||0)<30*60*1000)return fast;}catch{}
    try{const p=(await chrome.storage.local.get(PENDING_STORE_KEY))[PENDING_STORE_KEY]||null;return p?.capsule&&Date.now()-Number(p.createdAt||0)<30*60*1000?p:null;}catch{return null;}
  }
  async function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}try{await chrome.storage.local.remove?.(PENDING_STORE_KEY);}catch{}}

  function nativeNavigate(projectId){
    const path=projectId?`/g/${encodeURIComponent(projectId)}/project`:'/';
    const links=[...document.querySelectorAll('a[href]')].filter(outsideOwn);
    const exact=links.find(a=>{try{return new URL(a.getAttribute('href')||a.href,location.href).pathname===path;}catch{return false;}});
    const project=projectId?links.find(a=>normalizePid(String(a.getAttribute('href')||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'')===projectId):null;
    const target=exact||project;
    if(target instanceof HTMLElement){target.click();return true;}
    location.assign(path);return false;
  }

  async function makePending(chatId){
    const raw=await cache(),state=window.__NIAKGPT_CONTINUITY__?.getState?.()||{},entry=state.out?.[chatId]||{},chat=(raw.chats||[]).find(c=>c?.id===chatId)||{};
    const projectId=normalizePid(entry.projectId||chat.projectId||'');
    const project=(raw.projects||[]).find(p=>normalizePid(p?.id)===projectId)||{};
    const capsule=window.__NIAKGPT_CONTINUITY__?.buildCapsule?.(chatId,projectId,entry.history||'');
    if(!capsule)return null;
    return{schema:4,chatId,projectId,projectName:clean(project.name)||'',chatName:clean(entry.title||chat.title)||'Conversation',capsule,createdAt:Date.now(),sourceUrl:entry.sourceUrl||`${location.origin}/c/${chatId}`,patched:false,exactProject:!!projectId,source:'continuity-live-v126'};
  }

  async function continueFromButton(button){
    const link=button.closest('a[href*="/c/"]'),chatId=cid(link?.getAttribute('href'))||cid(location.pathname);if(!chatId)return false;
    const p=await makePending(chatId);if(!p)return false;
    await storePending(p);
    document.documentElement.dataset.ng126Continuity='handoff';
    window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-126',p.projectId?`PRÊT · handoff SPA vers ${p.projectName||p.projectId}`:'PRÊT · handoff vers nouveau chat');
    nativeNavigate(p.projectId);armInjection('handoff');return true;
  }

  async function injectPending(attempt=0,epoch=routeEpoch){
    clearTimeout(injectTimer);if(epoch!==routeEpoch)return false;
    const p=await pending();if(!p?.capsule)return false;
    const ed=editor();
    if(ed){
      const current=editorText(ed);
      if(current.includes('CONTINUITÉ NIAKGPT')){document.documentElement.dataset.ng126Continuity='ready';return true;}
      const text=current?`${p.capsule}\n\nBROUILLON PRÉSERVÉ AVANT CONTINUITÉ\n${current}`:p.capsule;
      if(setEditor(ed,text)){
        // Consume only AFTER the editor actually contains the capsule. This is the
        // inverse of the old boot race that could delete pending state before a failed write.
        await clearPending();document.documentElement.dataset.ng126Continuity='ready';
        window.__NIAKGPT_DIAGNOSTICS__?.set('continuité-126',`OK · contexte injecté${p.projectId?` · ${p.projectName||p.projectId}`:''} · aucun envoi automatique`);return true;
      }
    }
    if(attempt<50)injectTimer=setTimeout(()=>injectPending(attempt+1,epoch),Math.min(900,100+attempt*18));
    return false;
  }
  function armInjection(source='route'){const epoch=++routeEpoch;setTimeout(()=>injectPending(0,epoch),source==='handoff'?80:140);}

  // Window capture runs before continuity-v112's document capture listener. We only
  // take ownership of the explicit limit CTA, and nothing is mounted before a real
  // limit detector creates that CTA.
  window.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('.ng100-continue'):null;if(!button)return;
    const interruption=button.closest('#ng119-interruption[data-type="limit"],[data-ng125-limit="1"]');
    const outLink=button.closest('a[data-ng100-out="1"]');if(!interruption&&!outLink)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();continueFromButton(button);
  },true);

  window.addEventListener('popstate',()=>armInjection('popstate'));
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>armInjection('navigation'));
  window.addEventListener('pageshow',()=>armInjection('pageshow'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)armInjection('visible');});
  armInjection('init');
})();