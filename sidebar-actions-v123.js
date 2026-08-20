(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_ACTIONS_123__)return;
  window.__NIAKGPT_SIDEBAR_ACTIONS_123__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption,#ng123-action-menu,#ng123-rename-dialog';
  const MENU_SEL='[role="menu"],[data-radix-menu-content]';
  let cache={projects:[],chats:[]},box=null,observer=null,boot=null,timer=0,rpcSeq=0,state=null;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pid=h=>normalizePid(String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'');
  const cid=h=>String(h||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const outsideOwn=el=>!!el&&!el.closest?.(OWN);
  const projectInfo=id=>(cache.projects||[]).find(p=>normalizePid(p?.id)===normalizePid(id))||{};
  const chatInfo=id=>(cache.chats||[]).find(c=>c?.id===id)||{};
  const projectName=id=>clean(projectInfo(id).name)||'Project';
  const chatTitle=id=>clean(chatInfo(id).title)||'Conversation';

  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng123-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});
  }
  function routeTo(href){
    const id=cid(href),projectId=pid(href),links=[...document.querySelectorAll('a[href]')].filter(outsideOwn);
    const native=links.find(a=>a.getAttribute('href')===href)||(id?links.find(a=>cid(a.getAttribute('href'))===id):null)||(projectId?links.find(a=>pid(a.getAttribute('href'))===projectId&&/\/project(?:$|[?#])/.test(a.getAttribute('href')||'')):null);
    if(native instanceof HTMLElement){native.click();return;}location.assign(href);
  }
  function updateCache(mutator){
    try{const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)return Promise.resolve(bus.update(mutator)).then(next=>{if(next)cache=next;return next;});}catch{}
    return chrome.storage.local.get(CACHE_KEY).then(raw=>{const next=mutator(raw[CACHE_KEY]||cache);return chrome.storage.local.set({[CACHE_KEY]:next}).then(()=>{cache=next;return next;});}).catch(()=>null);
  }

  function closeMenu({focus=false}={}){
    const old=state;state=null;document.getElementById('ng123-action-menu')?.remove();
    document.querySelectorAll('#ng8-pins .ng123-action-open').forEach(b=>{b.classList.remove('ng123-action-open');b.setAttribute('aria-expanded','false');});
    if(focus&&old?.button?.isConnected)old.button.focus({preventScroll:true});
  }
  function positionMenu(menu,button){
    if(!(menu instanceof HTMLElement)||!(button instanceof HTMLElement))return;const r=button.getBoundingClientRect(),w=Math.min(310,Math.max(238,menu.offsetWidth||260)),h=Math.min(innerHeight-16,Math.max(90,menu.offsetHeight||220)),sidebar=document.querySelector('[data-testid="conversation-sidebar"]'),sideRight=sidebar?.getBoundingClientRect?.().right||0,safeLeft=Math.max(8,sideRight+8);
    let left=Math.max(r.right+8,safeLeft);if(left+w>innerWidth-8)left=Math.max(safeLeft,innerWidth-w-8);const top=Math.min(Math.max(8,r.top-5),Math.max(8,innerHeight-h-8));
    menu.style.left=`${left}px`;menu.style.top=`${top}px`;menu.style.maxWidth=`${Math.max(180,innerWidth-left-8)}px`;menu.style.maxHeight=`${Math.max(120,innerHeight-top-8)}px`;
  }
  function makeButton(text,action,{danger=false}={}){const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=text;if(danger)b.dataset.danger='1';b.addEventListener('click',action);return b;}

  async function renameChat(id,next){
    const old=chatTitle(id);next=clean(next);if(!next||next===old)return true;
    const out=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{method:'PATCH',body:{title:next}});if(!out.ok)return false;
    await updateCache(raw=>({...raw,at:Date.now(),chats:(raw?.chats||[]).map(c=>c?.id===id?{...c,title:next}:c),projectChats:Object.fromEntries(Object.entries(raw?.projectChats||{}).map(([p,list])=>[p,(list||[]).map(c=>c?.id===id?{...c,title:next}:c)]))}));
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));return true;
  }
  async function moveChat(id,projectId){
    const target=normalizePid(projectId||'');const out=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{method:'PATCH',body:{gizmo_id:target||null}});if(!out.ok)return false;
    await updateCache(raw=>{const before=(raw?.chats||[]).find(c=>c?.id===id),from=normalizePid(before?.projectId||''),chats=(raw?.chats||[]).map(c=>c?.id===id?{...c,projectId:target}:c),projectChats={};for(const [p,list] of Object.entries(raw?.projectChats||{}))projectChats[p]=(list||[]).filter(c=>c?.id!==id);const moved=chats.find(c=>c?.id===id);if(target&&moved)(projectChats[target]??=[]).unshift({...moved,projectId:target});const counts={...(raw?.counts||{})};if(from&&from!==target&&Number.isFinite(Number(counts[from])))counts[from]=Math.max(0,Number(counts[from])-1);if(target&&from!==target&&Number.isFinite(Number(counts[target])))counts[target]=Number(counts[target])+1;return{...raw,at:Date.now(),chats,projectChats,counts};});
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));return true;
  }

  function visible(el){if(!(el instanceof HTMLElement)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}
  function exactProjectRow(projectId){
    projectId=normalizePid(projectId);const links=[...document.querySelectorAll('a[href]')].filter(a=>outsideOwn(a)&&pid(a.getAttribute('href'))===projectId&&/\/g\/g-p-[^/]+\/project(?:$|[?#])/i.test(a.getAttribute('href')||''));
    return links[0]?.closest('[data-sidebar-item="true"],[class*="project-unfurl-row"],li')||links[0]||null;
  }
  function menuButton(row){
    if(!row)return null;const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(b=>!b.disabled);return buttons.find(b=>/more|options|menu|davantage|plus|actions?|ellipsis/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''} ${b.getAttribute('data-testid')||''}`))||buttons.find(b=>b.getAttribute('aria-haspopup')==='menu')||null;
  }
  function stage(row){const staged=[];let n=row;while(n&&n!==document.body){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||n.getAttribute?.('data-ng112-native-projects')==='1'){n.classList.add('ng123-native-stage');staged.push(n);}n=n.parentElement;}if(row&&!staged.includes(row)){row.classList.add('ng123-native-stage-leaf');staged.push(row);}return()=>staged.forEach(x=>x.classList.remove('ng123-native-stage','ng123-native-stage-leaf'));}
  function setNativeInput(input,value){try{const proto=Object.getPrototypeOf(input),setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?setter.call(input,value):input.value=value;input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;}catch{return false;}}
  async function nativeProjectRename(projectId,next){
    const row=exactProjectRow(projectId);if(!row)return false;const restore=stage(row),baselineMenus=new Set(document.querySelectorAll(MENU_SEL)),baselineDialogs=new Set(document.querySelectorAll('[role="dialog"]'));
    try{
      row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(70);const trigger=menuButton(row);if(!trigger)return false;trigger.click();let menu=null;
      for(const delay of [40,80,140,240]){await sleep(delay);menu=[...document.querySelectorAll(MENU_SEL)].find(m=>!baselineMenus.has(m)&&outsideOwn(m)&&visible(m));if(menu)break;}if(!menu)return false;
      const rename=[...menu.querySelectorAll('[role="menuitem"],button')].find(x=>/^(renommer|rename)(\b|…|\.\.\.)/i.test(clean(x.textContent||x.getAttribute('aria-label'))));if(!rename)return false;menu.style.visibility='hidden';rename.click();
      let dialog=null;for(const delay of [50,90,150,260,420]){await sleep(delay);dialog=[...document.querySelectorAll('[role="dialog"]')].find(d=>!baselineDialogs.has(d)&&outsideOwn(d)&&visible(d));if(dialog)break;}if(!dialog)return false;
      const input=[...dialog.querySelectorAll('input,textarea')].find(i=>!i.disabled)||null;if(!input||!setNativeInput(input,next))return false;
      const save=[...dialog.querySelectorAll('button')].find(b=>!b.disabled&&/^(enregistrer|save|renommer|rename|valider|confirm)$/i.test(clean(b.textContent||b.getAttribute('aria-label'))));if(!save)return false;save.click();setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:force-server-index')),500);return true;
    }catch{return false;}finally{restore();}
  }

  function renameDialog(kind,id){
    document.getElementById('ng123-rename-dialog')?.remove();const current=kind==='project'?projectName(id):chatTitle(id),overlay=document.createElement('div');overlay.id='ng123-rename-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.innerHTML=`<form><strong>Renommer ${kind==='project'?'le Project':'la conversation'}</strong><input maxlength="160" autocomplete="off"><div><button type="button" data-cancel>ANNULER</button><button type="submit" data-save>ENREGISTRER</button></div><small aria-live="polite"></small></form>`;document.body.appendChild(overlay);const input=overlay.querySelector('input'),status=overlay.querySelector('small'),form=overlay.querySelector('form');input.value=current;input.select();
    const close=()=>{overlay.remove();};overlay.querySelector('[data-cancel]').addEventListener('click',close);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close();});overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
    form.addEventListener('submit',async e=>{e.preventDefault();const next=clean(input.value);if(!next||next===current){close();return;}const save=overlay.querySelector('[data-save]');save.disabled=true;status.textContent='Enregistrement…';const ok=kind==='project'?await nativeProjectRename(id,next):await renameChat(id,next);if(ok){close();return;}save.disabled=false;status.textContent=kind==='project'?'Renommage ChatGPT indisponible sur cette page. Réessaie après ouverture du Project.':'Échec du renommage · vérifie la connexion.';});
  }

  function projectMenu(menu,id){
    const title=document.createElement('strong');title.textContent=projectName(id);menu.append(title);
    menu.append(makeButton('Renommer…',()=>{closeMenu();renameDialog('project',id);}));
    menu.append(makeButton('Actualiser les conversations',()=>{closeMenu();document.dispatchEvent(new CustomEvent('niakgpt:hydrate-project',{detail:{projectId:normalizePid(id),force:true}}));document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));}));
  }
  function chatMenu(menu,id){
    const title=document.createElement('strong');title.textContent=chatTitle(id);menu.append(title);
    menu.append(makeButton('Renommer…',()=>{closeMenu();renameDialog('chat',id);}));
    const move=makeButton('Déplacer vers…',()=>{const sub=menu.querySelector('.ng123-move-list');const open=!sub.hidden;sub.hidden=open;move.setAttribute('aria-expanded',open?'false':'true');requestAnimationFrame(()=>positionMenu(menu,state?.button));});move.setAttribute('aria-haspopup','true');move.setAttribute('aria-expanded','false');menu.append(move);
    const sub=document.createElement('div');sub.className='ng123-move-list';sub.hidden=true;const current=normalizePid(chatInfo(id).projectId||'');
    const add=(label,target)=>{const b=makeButton(label,async()=>{b.disabled=true;const ok=await moveChat(id,target);if(ok)closeMenu();else{b.disabled=false;menu.querySelector('small').textContent='Déplacement impossible · vérifie la connexion.';}});if(normalizePid(target)===current)b.dataset.current='1';sub.appendChild(b);};
    add('Hors projet','');for(const p of (cache.projects||[]).filter(p=>normalizePid(p?.id).startsWith('g-p-')).sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'fr')))add(clean(p.name)||'Project',p.id);menu.append(sub);const status=document.createElement('small');status.setAttribute('aria-live','polite');menu.append(status);
  }
  function openMenu(button,kind,id){
    if(state?.button===button&&document.getElementById('ng123-action-menu')){closeMenu({focus:true});return;}
    closeMenu();const menu=document.createElement('div');menu.id='ng123-action-menu';menu.dataset.kind=kind;menu.dataset.id=id;menu.setAttribute('role','menu');menu.tabIndex=-1;document.body.appendChild(menu);state={button,kind,id,menu};button.classList.add('ng123-action-open');button.setAttribute('aria-expanded','true');if(kind==='project')projectMenu(menu,id);else chatMenu(menu,id);positionMenu(menu,button);requestAnimationFrame(()=>positionMenu(menu,button));
  }

  function icon(){const s=document.createElement('span');s.className='ng113-dots';s.setAttribute('aria-hidden','true');s.textContent='•••';return s;}
  function normalizeAction(button,kind,id){if(!(button instanceof HTMLButtonElement))return null;button.type='button';button.classList.add('ng113-native-actions',`ng113-native-actions-${kind}`);button.dataset.ng123Action=kind;button.dataset.ng123Id=id;button.removeAttribute('data-ng113-actions');button.removeAttribute('data-ng113-id');button.title=kind==='project'?'Actions du Project':'Actions de la conversation';button.setAttribute('aria-label',button.title);button.setAttribute('aria-haspopup','menu');if(!button.hasAttribute('aria-expanded'))button.setAttribute('aria-expanded','false');if(!button.querySelector('.ng113-dots')){button.replaceChildren(icon());}return button;}
  function decorate(){
    timer=0;const pins=document.getElementById('ng8-pins');if(!pins)return;
    for(const entry of pins.querySelectorAll('.ng96-pin-entry')){const a=entry.querySelector(':scope>a[data-ng8-pin]'),id=normalizePid(a?.dataset.ng121Pid||pid(a?.getAttribute('href')));if(!id)continue;let b=entry.querySelector(':scope>.ng113-native-actions-project');if(!b){b=document.createElement('button');entry.appendChild(b);}normalizeAction(b,'project',id);}
    for(const entry of pins.querySelectorAll('.ng96-chat-entry')){const a=entry.querySelector(':scope>a[data-chat]'),id=a?.dataset.chat||cid(a?.getAttribute('href'));if(!id)continue;let b=entry.querySelector(':scope>.ng113-native-actions-chat');if(!b){b=document.createElement('button');entry.appendChild(b);}normalizeAction(b,'chat',id);for(const extra of entry.querySelectorAll(':scope>.ng113-native-actions-chat'))if(extra!==b)extra.remove();}
  }
  function schedule(delay=12){clearTimeout(timer);timer=setTimeout(decorate,delay);}
  function bind(){const next=document.getElementById('ng8-pins');if(!next||next===box)return false;observer?.disconnect();box=next;observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&!n.closest?.('#ng123-action-menu,#ng123-rename-dialog'))))schedule();});observer.observe(box,{childList:true,subtree:true});schedule(0);return true;}
  async function start(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;}catch{}if(bind())return;boot?.disconnect();boot=new MutationObserver(()=>{if(bind()){boot.disconnect();boot=null;}});boot.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>boot?.disconnect(),20000);}

  document.addEventListener('click',event=>{if(event.button!==0)return;const target=event.target instanceof Element?event.target:null,button=target?.closest('#ng8-pins .ng113-native-actions');if(!(button instanceof HTMLButtonElement))return;const kind=button.dataset.ng123Action,id=clean(button.dataset.ng123Id);if(!id||!['project','chat'].includes(kind))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openMenu(button,kind,id);},true);
  document.addEventListener('pointerdown',event=>{if(!state)return;const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng123-action-menu,#ng123-rename-dialog,#ng8-pins .ng113-native-actions'))return;closeMenu();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state){event.preventDefault();closeMenu({focus:true});}},true);
  window.addEventListener('resize',()=>{if(state?.menu?.isConnected)positionMenu(state.menu,state.button);},{passive:true});
  document.addEventListener('scroll',()=>{if(state?.menu?.isConnected)positionMenu(state.menu,state.button);},true);
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(0);}});}catch{}
  document.addEventListener('niakgpt:folder-rendered',()=>{bind();decorate();});document.addEventListener('niakgpt:pins-rendered',()=>{bind();decorate();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeMenu();else{bind();decorate();}});window.addEventListener('popstate',()=>{closeMenu();bind();decorate();});if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{closeMenu();bind();decorate();});
  window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();closeMenu();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();