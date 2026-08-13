(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_PINS_090__) return;
  window.__NIAKGPT_PROJECT_PINS_090__ = true;

  const GOV_KEY='niakgpt-governance-v085';
  const SETTINGS_KEY='niakgpt-settings-v090';
  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  let config={coreProjectIds:[],hiddenProjectIds:[]};
  let settings={nativePins:true,safeMode:false};
  let reconciling=false,timer=0,lastRunAt=0,sidebarObserver=null,sidebarRoot=null,mutationTimer=0;

  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>{const m=String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i);return m?normalizePid(m[1]):'';};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const role=()=>document.documentElement.dataset.ng8TabRole||'unknown';
  const generating=()=>document.documentElement.dataset.ng8Running==='1';
  const syncEnabled=()=>settings.nativePins!==false&&settings.safeMode!==true&&document.documentElement.dataset.ng90Safe!=='1';
  const canSync=()=>syncEnabled()&&role()==='worker'&&!document.hidden&&!generating();

  function navRoot(){return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL))||document.querySelector('nav');}
  function visible(el){if(!(el instanceof HTMLElement))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
  function heading(root,rx){if(!root)return null;const nodes=root.querySelectorAll('h2,h3,[role="heading"],div,span,p');for(const node of nodes){if(!visible(node)||node.children.length>3)continue;const text=(node.textContent||'').trim();if(text.length<36&&rx.test(text))return node;}return null;}
  function pinnedRegion(root){return{start:heading(root,/^(épinglés|epingles|pinned)$/i),end:heading(root,/^(récents|recents|recent)$/i)};}
  function isBetween(node,start,end){if(!node||!start)return false;const after=!!(start.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING);const before=!end||!!(node.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING);return after&&before;}
  function pinnedLinks(){const root=navRoot();if(!root)return[];const{start,end}=pinnedRegion(root);if(!start)return[];return[...root.querySelectorAll(PROJECT_SEL)].filter(a=>!a.closest('#ng8-pins')&&isBetween(a,start,end));}
  function nativePinnedIds(){return new Set(pinnedLinks().map(a=>pidFromHref(a.getAttribute('href'))).filter(Boolean));}
  function anyProjectLink(id,{pinned=false}={}){const root=navRoot();if(!root)return null;const pool=pinned?pinnedLinks():[...root.querySelectorAll(PROJECT_SEL)].filter(a=>!a.closest('#ng8-pins'));return pool.find(a=>pidFromHref(a.getAttribute('href'))===id)||null;}

  async function loadState(){try{const raw=await chrome.storage.local.get([GOV_KEY,SETTINGS_KEY]);if(raw[GOV_KEY])config={...config,...raw[GOV_KEY]};if(raw[SETTINGS_KEY])settings={...settings,...raw[SETTINGS_KEY]};}catch{}}

  async function openMenu(row,link){
    link.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));await sleep(90);
    const buttons=[...row.querySelectorAll('button')].filter(visible);const menu=buttons.find(b=>/more|options|menu|davantage|plus|actions?/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);if(!menu)return false;menu.click();await sleep(140);return true;
  }
  function menuItem(rx){return[...document.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="option"]')].find(x=>visible(x)&&rx.test((x.textContent||'').trim()));}
  async function menuAction(link,rx){
    if(!link)return false;const row=link.closest('li,[data-sidebar-item="true"]')||link.parentElement;if(!row)return false;if(!await openMenu(row,link))return false;const item=menuItem(rx);if(!item){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return false;}item.click();await sleep(260);return true;
  }

  async function verifyPinned(id,wanted){
    for(let i=0;i<3;i++){await sleep(i?220:80);const has=nativePinnedIds().has(id);if(has===wanted)return true;}return false;
  }
  async function setNativePin(id,wanted){
    let current=nativePinnedIds();if(current.has(id)===wanted)return true;const link=anyProjectLink(id,{pinned:!wanted});if(!link)return false;
    const rx=wanted?/^(épingler|epingler|pin)\b/i:/^(désépingler|desepingler|unpin)\b/i;
    if(!await menuAction(link,rx))return false;return verifyPinned(id,wanted);
  }

  function desiredIds(){const hidden=new Set((config.hiddenProjectIds||[]).map(normalizePid));return new Set((config.coreProjectIds||[]).map(normalizePid).filter(id=>id&&!hidden.has(id)));}
  function patchDiagnostic(result=null){
    const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;let row=diag.querySelector(':scope>.ng90-pins-diagnostic');if(!row){row=document.createElement('div');row.className='ng90-pins-diagnostic';diag.prepend(row);}const value=document.createElement('b'),label=document.createElement('span');label.textContent='pins';
    if(!syncEnabled()){value.textContent=settings.safeMode||document.documentElement.dataset.ng90Safe==='1'?'PAUSE · SAFE MODE':'OFF · synchro native désactivée';value.className='wait';}
    else if(result){value.textContent=`CORE · ${result.ok}/${result.desired} natifs${result.failed?` · ${result.failed} échec(s)`:''}`;value.className=result.failed?'wait':'ok';}
    else{const desired=desiredIds(),current=nativePinnedIds(),ok=[...desired].filter(id=>current.has(id)).length;value.textContent=`CORE · ${ok}/${desired.size} natifs`;value.className=ok===desired.size?'ok':'wait';}
    row.replaceChildren(label,value);
  }

  async function reconcile(){
    clearTimeout(timer);timer=0;if(reconciling)return;if(!canSync()){patchDiagnostic();return;}
    if(Date.now()-lastRunAt<2500){schedule(2600);return;}reconciling=true;lastRunAt=Date.now();
    try{
      await loadState();if(!canSync()){patchDiagnostic();return;}const desired=desiredIds(),before=nativePinnedIds();let failed=0;
      for(const id of [...before]){if(desired.has(id))continue;if(generating())break;if(!await setNativePin(id,false))failed++;}
      for(const id of desired){if(generating())break;if(nativePinnedIds().has(id))continue;if(!await setNativePin(id,true))failed++;}
      const current=nativePinnedIds(),ok=[...desired].filter(id=>current.has(id)).length;document.documentElement.dataset.ng90NativePins=String(ok);patchDiagnostic({ok,desired:desired.size,failed});
    }finally{reconciling=false;}
  }
  function schedule(delay=1800){clearTimeout(timer);timer=setTimeout(()=>{if(!canSync()){patchDiagnostic();return;}if('requestIdleCallback'in window)requestIdleCallback(()=>reconcile(),{timeout:4500});else reconcile();},delay);}

  function bindSidebar(){
    const root=navRoot();if(!root||root===sidebarRoot)return;sidebarObserver?.disconnect();sidebarRoot=root;sidebarObserver=new MutationObserver(records=>{if(reconciling)return;let relevant=false;for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.matches?.(PROJECT_SEL)||node.querySelector?.(PROJECT_SEL)||/épinglés|epingles|pinned/i.test(node.textContent?.slice(0,80)||'')){relevant=true;break;}}if(!relevant)return;clearTimeout(mutationTimer);mutationTimer=setTimeout(()=>schedule(1200),900);});sidebarObserver.observe(root,{childList:true,subtree:true});
  }

  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[GOV_KEY])config={...config,...(changes[GOV_KEY].newValue||{})};if(changes[SETTINGS_KEY])settings={...settings,...(changes[SETTINGS_KEY].newValue||{})};if(changes[GOV_KEY]||changes[SETTINGS_KEY])schedule(800);});
  document.addEventListener('niakgpt:settings-changed',()=>schedule(700));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindSidebar();schedule(1100);}});
  document.addEventListener('click',()=>{setTimeout(()=>{bindSidebar();patchDiagnostic();},120);},true);
  window.addEventListener('popstate',()=>setTimeout(()=>{bindSidebar();schedule(1200);},100));

  loadState().then(()=>{bindSidebar();schedule(4200);});
})();
