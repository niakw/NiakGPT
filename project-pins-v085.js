(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_PINS_085__) return;
  window.__NIAKGPT_PROJECT_PINS_085__ = true;

  const GOV_KEY='niakgpt-governance-v085';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  let config={coreProjectIds:[],hiddenProjectIds:[]};
  let reconciling=false;
  let timer=0;

  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([a-f0-9]+)(?:-.+)?$/i);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>{const m=String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i);return m?normalizePid(m[1]):'';};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const role=()=>document.documentElement.dataset.ng8TabRole||'unknown';
  const generating=()=>document.documentElement.dataset.ng8Running==='1';

  function navRoot(){return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL))||document.querySelector('nav');}
  function heading(root,rx){return root?[...root.querySelectorAll('div,span,h2,h3,p')].find(x=>rx.test((x.textContent||'').trim())):null;}
  function pinnedRegion(root){
    const h=heading(root,/^(épinglés|epingles|pinned)$/i),recent=heading(root,/^(récents|recents|recent)$/i);return{h,recent};
  }
  function isBetween(node,start,end){
    if(!node||!start)return false;
    const after=!!(start.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING);
    const before=!end||!!(node.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING);
    return after&&before;
  }
  function pinnedLinks(){
    const root=navRoot();if(!root)return[];const{h,recent}=pinnedRegion(root);if(!h)return[];
    return[...root.querySelectorAll(PROJECT_SEL)].filter(a=>!a.closest('#ng8-pins')&&isBetween(a,h,recent));
  }
  function nativePinnedIds(){return new Set(pinnedLinks().map(a=>pidFromHref(a.getAttribute('href'))).filter(Boolean));}
  function anyProjectLink(id,{pinned=false}={}){
    const root=navRoot();if(!root)return null;
    const pool=pinned?pinnedLinks():[...root.querySelectorAll(PROJECT_SEL)].filter(a=>!a.closest('#ng8-pins'));
    return pool.find(a=>pidFromHref(a.getAttribute('href'))===id)||null;
  }
  async function menuAction(link,rx){
    if(!link)return false;const row=link.closest('li')||link.parentElement;if(!row)return false;
    link.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));await sleep(80);
    const buttons=[...row.querySelectorAll('button')];const menu=buttons.find(b=>/more|options|menu|davantage|plus/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);if(!menu)return false;
    menu.click();await sleep(120);
    const item=[...document.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="option"]')].find(x=>rx.test((x.textContent||'').trim()));
    if(!item){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return false;}
    item.click();await sleep(180);return true;
  }
  async function loadConfig(){
    try{const raw=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY];if(raw)config={...config,...raw};}catch{}
  }
  function patchDiagnostic(){
    const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;
    const row=[...diag.querySelectorAll(':scope>div')].find(x=>(x.querySelector('span')?.textContent||'').trim().toLowerCase()==='pins');if(!row)return;
    const value=row.querySelector('b');if(!value)return;const current=nativePinnedIds(),desired=new Set((config.coreProjectIds||[]).filter(id=>!(config.hiddenProjectIds||[]).includes(id)));
    value.textContent=`CORE · ${[...desired].filter(id=>current.has(id)).length}/${desired.size} natifs · ${(config.hiddenProjectIds||[]).length} masqués`;value.className='ok';
  }
  async function reconcile(){
    clearTimeout(timer);timer=0;
    if(reconciling||document.hidden||generating()||role()!=='worker')return schedule(90000);
    reconciling=true;
    try{
      await loadConfig();const hidden=new Set(config.hiddenProjectIds||[]),desired=new Set((config.coreProjectIds||[]).filter(id=>!hidden.has(id)));let current=nativePinnedIds();
      for(const id of [...current]){
        if(desired.has(id))continue;
        if(generating())break;
        const link=anyProjectLink(id,{pinned:true});if(await menuAction(link,/^(désépingler|desepingler|unpin)\b/i)){current.delete(id);await sleep(220);}
      }
      for(const id of desired){
        if(current.has(id))continue;
        if(generating())break;
        const link=anyProjectLink(id);if(await menuAction(link,/^(épingler|epingler|pin)\b/i)){current.add(id);await sleep(220);}
      }
      document.documentElement.dataset.ng85NativePins=String(current.size);patchDiagnostic();
    }finally{reconciling=false;schedule(10*60*1000);}
  }
  function schedule(delay=5000){clearTimeout(timer);timer=setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>reconcile(),{timeout:5000});else reconcile();},delay);}

  // The v0.8 legacy engine attempted to pin every Project. Governance owns pins now.
  const previousRIC=typeof window.requestIdleCallback==='function'?window.requestIdleCallback.bind(window):null;
  if(previousRIC){
    window.requestIdleCallback=function niakgptGovernedPinsIdle(callback,options){
      let source='';try{source=Function.prototype.toString.call(callback);}catch{}
      if(/tryNativePins\s*\(/.test(source))return previousRIC(()=>{},options||{timeout:2500});
      return previousRIC(callback,options);
    };
  }

  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[GOV_KEY]){config={...config,...(changes[GOV_KEY].newValue||{})};schedule(1200);}});
  setInterval(patchDiagnostic,2400);
  loadConfig().then(()=>schedule(6500));
})();
