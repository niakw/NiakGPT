(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_MULTITAB_090__)return;
  window.__NIAKGPT_MULTITAB_090__=true;

  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'dev';}catch{return'dev';}})();
  const CHANNEL_NAME='niakgpt-v090';
  const WORKER_LOCK='niakgpt-worker-v090';
  const LEASE_KEY='niakgpt-worker-lease-v090';
  const SETTINGS_KEY='niakgpt-settings-v090';
  const CACHE_KEY='niakgpt-v08-cache';
  const tabId=sessionStorage.getItem('__niakgpt_tab_v090')||crypto.randomUUID();
  sessionStorage.setItem('__niakgpt_tab_v090',tabId);

  const nativeRIC=window.requestIdleCallback?.bind(window)||null;
  const nativeCIC=window.cancelIdleCallback?.bind(window)||null;
  const bc=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL_NAME):null;
  const idleTasks=new Map(),peers=new Map();
  let idleSeq=0,idleRunning=0,idleWakeTimer=0,pulseTimer=0,leaseTimer=0,heavyTimer=0,diagTimer=0;
  let role='CLIENT',releaseLock=null,acquiring=false,lockTask=null,fallbackLease=false,settings={safeMode:false},startedAt=performance.now();

  const root=()=>document.documentElement;
  const visible=()=>!document.hidden;
  const heavy=()=>root().dataset.ng8Heavy==='1';
  const running=()=>root().dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(root().dataset.ng86Activity||'');
  const safe=()=>settings.safeMode===true||root().dataset.ng90Safe==='1';
  const state=()=>({visible:visible(),heavy:heavy(),running:running(),safeMode:safe()});

  function setRole(next,reason=''){
    if(role===next&&root().dataset.ng8TabRole===next.toLowerCase())return;
    role=next;root().dataset.ng8TabRole=next.toLowerCase();root().dataset.ng8TabReason=reason;
    document.dispatchEvent(new CustomEvent('niakgpt:tab-role-changed',{detail:{role:next.toLowerCase(),reason,tabId}}));
    broadcast('role');patchDiagnostic();
    if(role==='WORKER'){scheduleStartupWake();pumpIdle();}
  }
  function patchDiagnostic(){
    clearTimeout(diagTimer);diagTimer=setTimeout(()=>{
      const s=state(),text=`${role} · ${s.heavy?'LOURD':'LÉGER'}${s.running?' · ACTIF':''}${s.safeMode?' · SAFE':''}`;
      window.__NIAKGPT_DIAGNOSTICS__?.set('onglet',text);
      const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;
      let row=diag.querySelector(':scope > .ng8-tab-diagnostic');if(!row){row=document.createElement('div');row.className='ng8-tab-diagnostic';diag.prepend(row);}row.innerHTML=`<span>onglet</span><b class="${role==='WORKER'?'ok':'wait'}">${text}</b>`;
    },30);
  }
  function broadcast(reason='heartbeat'){
    bc?.postMessage({type:'heartbeat',id:tabId,role,...state(),ts:Date.now(),reason});
  }
  function purgePeers(){const now=Date.now();for(const[id,p]of peers)if(now-(p.ts||0)>30000)peers.delete(id);}

  function canRunWorkerIdle(){
    return role==='WORKER'&&!safe()&&!heavy()&&!running()&&performance.now()-startedAt>=2800;
  }
  function scheduleStartupWake(){
    clearTimeout(idleWakeTimer);if(role!=='WORKER'||safe())return;
    const wait=Math.max(0,2850-(performance.now()-startedAt));
    idleWakeTimer=setTimeout(()=>{idleWakeTimer=0;pumpIdle();broadcast('startup-ready');},wait+20);
  }
  function makeDeadline(timeout=1000){const start=performance.now();return{didTimeout:false,timeRemaining:()=>Math.max(0,Math.min(12,timeout-(performance.now()-start)))};}
  function pumpIdle(){
    if(idleRunning||!idleTasks.size)return;
    if(!canRunWorkerIdle()){if(role==='WORKER'&&!safe())scheduleStartupWake();return;}
    const [id,task]=idleTasks.entries().next().value||[];if(!id||!task)return;idleTasks.delete(id);idleRunning=id;
    const run=deadline=>{try{task.cb(deadline||makeDeadline(task.timeout));}catch(e){console.warn('[NiakGPT multitab] idle task',e);}finally{idleRunning=0;if(idleTasks.size)setTimeout(pumpIdle,20);}};
    if(nativeRIC)nativeRIC(run,{timeout:task.timeout});else setTimeout(()=>run(makeDeadline(task.timeout)),30);
  }
  window.requestIdleCallback=function niakgptCoordinatedIdle(cb,opts={}){
    const id=++idleSeq;idleTasks.set(id,{cb,timeout:Number(opts.timeout)||1400});pumpIdle();return id;
  };
  window.cancelIdleCallback=function niakgptCancelIdle(id){if(id===idleRunning&&nativeCIC)try{nativeCIC(id);}catch{}idleTasks.delete(id);};

  function readLease(){try{return JSON.parse(localStorage.getItem(LEASE_KEY)||'null');}catch{return null;}}
  function writeLease(){try{localStorage.setItem(LEASE_KEY,JSON.stringify({id:tabId,until:Date.now()+8000}));}catch{}}
  function releaseFallback(){if(!fallbackLease)return;const lease=readLease();if(lease?.id===tabId)try{localStorage.removeItem(LEASE_KEY);}catch{}fallbackLease=false;clearTimeout(leaseTimer);}
  function renewFallbackLease(){
    clearTimeout(leaseTimer);if(role!=='WORKER'||!fallbackLease||safe())return;writeLease();leaseTimer=setTimeout(renewFallbackLease,3500);
  }
  function tryFallback(){
    if(navigator.locks?.request||safe()||acquiring||role==='WORKER')return;
    const lease=readLease(),now=Date.now();if(lease?.id&&lease.id!==tabId&&(lease.until||0)>now){setRole('CLIENT','lease-held');return;}
    fallbackLease=true;writeLease();setRole('WORKER','lease');renewFallbackLease();
  }

  async function tryAcquire(reason='election'){
    if(safe()||role==='WORKER'||acquiring)return;
    if(!navigator.locks?.request){tryFallback();return;}
    acquiring=true;
    try{
      await navigator.locks.request(WORKER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock){setRole('CLIENT','lock-held');return;}
        setRole('WORKER',reason);
        await new Promise(resolve=>{releaseLock=resolve;});
        releaseLock=null;setRole('CLIENT','released');
      });
    }catch(e){console.warn('[NiakGPT multitab] lock',e);tryFallback();}
    finally{acquiring=false;if(role!=='WORKER'&&!safe())setTimeout(()=>tryAcquire('retry'),900);}
  }
  function releaseWorker(reason='yield'){
    if(role!=='WORKER')return;
    if(fallbackLease){releaseFallback();setRole('CLIENT',reason);setTimeout(()=>tryAcquire('post-yield'),1200);return;}
    if(releaseLock){const fn=releaseLock;releaseLock=null;fn();}
  }
  function releaseWorkerForSafeMode(){if(safe()&&role==='WORKER')releaseWorker('safe-mode');}

  function eligiblePeer(){purgePeers();return[...peers.values()].find(p=>p.role!=='WORKER'&&!p.safeMode&&!p.heavy);}
  function scheduleHeavyYield(){
    if(role!=='WORKER'||!heavy()||safe()){clearTimeout(heavyTimer);heavyTimer=0;return;}
    if(heavyTimer)return;
    broadcast('heavy-request');
    heavyTimer=setTimeout(()=>{heavyTimer=0;if(role==='WORKER'&&heavy()&&eligiblePeer())releaseWorker('heavy-handoff');},500);
  }

  function schedulePulse(delay=12000){
    clearTimeout(pulseTimer);pulseTimer=setTimeout(()=>{
      purgePeers();broadcast('pulse');
      if(role==='WORKER'){if(heavy())scheduleHeavyYield();pumpIdle();}
      else if(!safe())tryAcquire('pulse');
      schedulePulse(12000);
    },delay);
  }

  bc?.addEventListener('message',event=>{
    const m=event.data;if(!m||m.id===tabId)return;
    if(m.type==='heartbeat'){
      peers.set(m.id,m);
      if(role==='WORKER'&&heavy())scheduleHeavyYield();
      if(role!=='WORKER'&&m.role==='WORKER'&&m.heavy&&!safe())broadcast('eligible-peer');
      if(role!=='WORKER'&&m.role!=='WORKER'&&!safe())setTimeout(()=>tryAcquire('peer-no-worker'),80+Math.random()*220);
    }
  });

  async function loadPublicSettings(){
    try{const raw=(await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]||{};settings={safeMode:raw.safeMode===true};}
    catch{settings={safeMode:false};}
    releaseWorkerForSafeMode();if(!safe())tryAcquire('settings');patchDiagnostic();
  }
  function onRuntimeStateChanged(){
    broadcast('runtime-state');patchDiagnostic();
    if(role==='WORKER'){if(heavy())scheduleHeavyYield();else pumpIdle();}
    else if(!safe())tryAcquire('state-change');
  }
  const stateObserver=new MutationObserver(records=>{
    if(records.some(r=>['data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity'].includes(r.attributeName)))onRuntimeStateChanged();
  });
  stateObserver.observe(root(),{attributes:true,attributeFilter:['data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity']});
  document.addEventListener('visibilitychange',()=>{broadcast('visibility');if(!document.hidden){pumpIdle();if(role!=='WORKER'&&!safe())tryAcquire('visible');}});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[SETTINGS_KEY])loadPublicSettings();});

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function routeTo(href){
    const id=String(href||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1],root=document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav');
    const native=id&&root?[...root.querySelectorAll('a[href*="/c/"]')].find(a=>(a.getAttribute('href')||'').includes(id)):null;
    if(native){native.click();return;}location.assign(href);
  }
  async function quickCache(){const bus=window.__NIAKGPT_CACHE_BUS__;return bus?await bus.get():null;}
  async function openClientQuick(){
    if(role==='WORKER'||document.getElementById('ng8-quick'))return false;const raw=await quickCache();if(!raw)return false;
    const modal=document.createElement('div');modal.id='ng8-quick';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML='<div><input autofocus placeholder="Quick Open — cache local"><section></section><footer>CLIENT · cache local · ↑↓ · Entrée · Échap</footer></div>';document.body.appendChild(modal);
    const input=modal.querySelector('input'),list=modal.querySelector('section');let items=[],sel=0;
    const projectNames=new Map((raw.projects||[]).map(p=>[p.id,p.name]));
    const paint=()=>{const q=norm(input.value);items=(raw.chats||[]).filter(c=>!q||norm(`${c.title||''} ${c.snippet||''} ${projectNames.get(c.projectId)||''}`).includes(q)).sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,100).map(c=>({title:c.title||'Conversation',sub:projectNames.get(c.projectId)||'Hors projet',href:c.href||(c.projectId?`/g/${c.projectId}/c/${c.id}`:`/c/${c.id}`)}));sel=Math.min(sel,Math.max(0,items.length-1));list.innerHTML=items.map((x,i)=>`<button class="${i===sel?'sel':''}" data-i="${i}"><span>${x.title.replace(/[&<>]/g,'')}</span><small>${x.sub.replace(/[&<>]/g,'')}</small><em>CHAT</em></button>`).join('');list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>routeTo(items[Number(b.dataset.i)].href)));};
    input.addEventListener('input',()=>{sel=0;paint();});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,items.length-1);paint();}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}else if(e.key==='Enter'&&items[sel]){e.preventDefault();routeTo(items[sel].href);}else if(e.key==='Escape')modal.remove();});modal.addEventListener('mousedown',e=>{if(e.target===modal)modal.remove();});paint();setTimeout(()=>input.focus(),0);return true;
  }
  document.addEventListener('keydown',event=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&String(event.key).toLowerCase()==='k'&&role!=='WORKER'){event.preventDefault();event.stopImmediatePropagation();openClientQuick();}},true);

  window.addEventListener('pagehide',()=>{
    clearTimeout(idleWakeTimer);clearTimeout(pulseTimer);clearTimeout(leaseTimer);clearTimeout(heavyTimer);clearTimeout(diagTimer);releaseFallback();if(releaseLock){const fn=releaseLock;releaseLock=null;fn();}stateObserver.disconnect();bc?.close?.();
  },{once:true});

  root().dataset.ng8TabRole='client';patchDiagnostic();broadcast('hello');loadPublicSettings();scheduleStartupWake();schedulePulse(2500);setTimeout(()=>tryAcquire('startup'),120);setTimeout(pumpIdle,3000);
})();
