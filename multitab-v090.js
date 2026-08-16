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
  let tabId='';
  try{tabId=sessionStorage.getItem('__niakgpt_tab_v090')||crypto.randomUUID();sessionStorage.setItem('__niakgpt_tab_v090',tabId);}catch{tabId=crypto.randomUUID();}

  const nativeRIC=window.requestIdleCallback?.bind(window)||null;
  const nativeCIC=window.cancelIdleCallback?.bind(window)||null;
  let bc=null,bcOpen=false,suspended=false,contextDead=false;
  const idleTasks=new Map(),peers=new Map();
  let idleSeq=0,idleRunning=0,idleWakeTimer=0,pulseTimer=0,leaseTimer=0,heavyTimer=0,diagTimer=0,retryTimer=0;
  let role='CLIENT',releaseLock=null,acquiring=false,fallbackLease=false,settings={safeMode:false},startedAt=performance.now();

  const root=()=>document.documentElement;
  const visible=()=>!document.hidden;
  const heavy=()=>root().dataset.ng8Heavy==='1';
  const running=()=>root().dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(root().dataset.ng86Activity||'')||root().dataset.ng105Verification==='1';
  const safe=()=>settings.safeMode===true||root().dataset.ng90Safe==='1';
  const state=()=>({visible:visible(),heavy:heavy(),running:running(),safeMode:safe()});
  const invalidated=e=>/extension context invalidated|context invalidated/i.test(String(e?.message||e||''));
  function contextAlive(){if(contextDead)return false;try{return !!chrome?.runtime?.id;}catch{return false;}}
  function clearTimers(){for(const id of [idleWakeTimer,pulseTimer,leaseTimer,heavyTimer,diagTimer,retryTimer])if(id)clearTimeout(id);idleWakeTimer=pulseTimer=leaseTimer=heavyTimer=diagTimer=retryTimer=0;}

  function onChannelMessage(event){
    if(suspended||contextDead)return;
    const m=event.data;if(!m||m.id===tabId)return;
    if(m.type==='heartbeat'){
      peers.set(m.id,m);
      if(role==='WORKER'&&heavy())scheduleHeavyYield();
      if(role!=='WORKER'&&m.role==='WORKER'&&m.heavy&&!safe())broadcast('eligible-peer');
      if(role!=='WORKER'&&m.role!=='WORKER'&&!safe())setTimeout(()=>{if(!suspended&&!contextDead)tryAcquire('peer-no-worker');},80+Math.random()*220);
    }
  }
  function openChannel(){
    if(suspended||contextDead||bcOpen||typeof BroadcastChannel!=='function')return;
    try{bc=new BroadcastChannel(CHANNEL_NAME);bc.addEventListener('message',onChannelMessage);bcOpen=true;}catch{bc=null;bcOpen=false;}
  }
  function closeChannel(){
    if(!bc)return;try{bc.removeEventListener('message',onChannelMessage);}catch{}try{bc.close();}catch{}bc=null;bcOpen=false;
  }
  function broadcast(reason='heartbeat'){
    if(suspended||contextDead)return false;openChannel();if(!bcOpen||!bc)return false;
    try{bc.postMessage({type:'heartbeat',id:tabId,role,...state(),ts:Date.now(),reason});return true;}
    catch(error){if(error?.name==='InvalidStateError'){closeChannel();return false;}return false;}
  }

  function setRole(next,reason=''){
    if(contextDead)return;
    if(role===next&&root().dataset.ng8TabRole===next.toLowerCase())return;
    role=next;root().dataset.ng8TabRole=next.toLowerCase();root().dataset.ng8TabReason=reason;
    document.dispatchEvent(new CustomEvent('niakgpt:tab-role-changed',{detail:{role:next.toLowerCase(),reason,tabId}}));
    broadcast('role');patchDiagnostic();
    if(role==='WORKER'){scheduleStartupWake();pumpIdle();}
  }
  function patchDiagnostic(){
    clearTimeout(diagTimer);if(contextDead)return;
    diagTimer=setTimeout(()=>{
      diagTimer=0;if(contextDead)return;const s=state(),text=`${role} · ${s.heavy?'LOURD':'LÉGER'}${s.running?' · ACTIF':''}${s.safeMode?' · SAFE':''}`;
      window.__NIAKGPT_DIAGNOSTICS__?.set('onglet',text);
      const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;
      let row=diag.querySelector(':scope > .ng8-tab-diagnostic');if(!row){row=document.createElement('div');row.className='ng8-tab-diagnostic';diag.prepend(row);}row.innerHTML=`<span>onglet</span><b class="${role==='WORKER'?'ok':'wait'}">${text}</b>`;
    },30);
  }
  function purgePeers(){const now=Date.now();for(const[id,p]of peers)if(now-(p.ts||0)>30000)peers.delete(id);}

  function canRunWorkerIdle(){
    return !suspended&&!contextDead&&role==='WORKER'&&!safe()&&!heavy()&&!running()&&performance.now()-startedAt>=2800;
  }
  function scheduleStartupWake(){
    clearTimeout(idleWakeTimer);idleWakeTimer=0;if(suspended||contextDead||role!=='WORKER'||safe())return;
    const wait=Math.max(0,2850-(performance.now()-startedAt));
    idleWakeTimer=setTimeout(()=>{idleWakeTimer=0;if(suspended||contextDead)return;pumpIdle();broadcast('startup-ready');},wait+20);
  }
  function makeDeadline(timeout=1000){const start=performance.now();return{didTimeout:false,timeRemaining:()=>Math.max(0,Math.min(12,timeout-(performance.now()-start)))};}
  function pumpIdle(){
    if(suspended||contextDead||idleRunning||!idleTasks.size)return;
    if(!canRunWorkerIdle()){if(role==='WORKER'&&!safe())scheduleStartupWake();return;}
    const [id,task]=idleTasks.entries().next().value||[];if(!id||!task)return;idleTasks.delete(id);idleRunning=id;
    const run=deadline=>{try{if(!suspended&&!contextDead)task.cb(deadline||makeDeadline(task.timeout));}catch(e){if(!contextDead)console.warn('[NiakGPT multitab] idle task',e);}finally{idleRunning=0;if(idleTasks.size&&!suspended&&!contextDead)setTimeout(pumpIdle,20);}};
    if(nativeRIC)nativeRIC(run,{timeout:task.timeout});else setTimeout(()=>run(makeDeadline(task.timeout)),30);
  }
  window.requestIdleCallback=function niakgptCoordinatedIdle(cb,opts={}){
    const id=++idleSeq;if(contextDead)return id;idleTasks.set(id,{cb,timeout:Number(opts.timeout)||1400});pumpIdle();return id;
  };
  window.cancelIdleCallback=function niakgptCancelIdle(id){if(id===idleRunning&&nativeCIC)try{nativeCIC(id);}catch{}idleTasks.delete(id);};

  function readLease(){try{return JSON.parse(localStorage.getItem(LEASE_KEY)||'null');}catch{return null;}}
  function writeLease(){try{localStorage.setItem(LEASE_KEY,JSON.stringify({id:tabId,until:Date.now()+8000}));}catch{}}
  function releaseFallback(){if(!fallbackLease)return;const lease=readLease();if(lease?.id===tabId)try{localStorage.removeItem(LEASE_KEY);}catch{}fallbackLease=false;clearTimeout(leaseTimer);leaseTimer=0;}
  function renewFallbackLease(){
    clearTimeout(leaseTimer);leaseTimer=0;if(suspended||contextDead||role!=='WORKER'||!fallbackLease||safe())return;writeLease();leaseTimer=setTimeout(renewFallbackLease,3500);
  }
  function tryFallback(force=false){
    if(suspended||contextDead||safe()||acquiring||role==='WORKER')return;
    if(navigator.locks?.request&&!force)return;
    if(heavy()&&eligiblePeer()){setRole('CLIENT','heavy-peer-preferred');return;}
    const lease=readLease(),now=Date.now();if(lease?.id&&lease.id!==tabId&&(lease.until||0)>now){setRole('CLIENT','lease-held');return;}
    fallbackLease=true;writeLease();setRole('WORKER',force?'lease-after-lock-error':'lease');renewFallbackLease();
  }
  function scheduleRetry(reason='retry',delay=900){
    clearTimeout(retryTimer);retryTimer=0;if(suspended||contextDead||role==='WORKER'||safe())return;
    retryTimer=setTimeout(()=>{retryTimer=0;if(!suspended&&!contextDead)tryAcquire(reason);},delay);
  }
  async function tryAcquire(reason='election'){
    if(suspended||contextDead||safe()||role==='WORKER'||acquiring)return;
    if(!contextAlive()){deactivate('context-invalidated');return;}
    if(heavy()&&eligiblePeer()){setRole('CLIENT','heavy-peer-preferred');return;}
    if(!navigator.locks?.request){tryFallback();return;}
    acquiring=true;
    try{
      await navigator.locks.request(WORKER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(suspended||contextDead)return;
        if(!lock){setRole('CLIENT','lock-held');return;}
        setRole('WORKER',reason);
        await new Promise(resolve=>{releaseLock=resolve;});
        releaseLock=null;if(!suspended&&!contextDead)setRole('CLIENT','released');
      });
    }catch(e){
      if(invalidated(e)||!contextAlive()){deactivate('context-invalidated');return;}
      // navigator.locks can throw DOMException while a document is being frozen/navigated.
      // This is an expected lifecycle edge, not an extension error. Use the lease fallback
      // only while the page is still active and never log the noisy DOMException.
      if(!suspended&&!document.hidden)tryFallback(true);
    }
    finally{acquiring=false;if(role!=='WORKER'&&!safe()&&!suspended&&!contextDead)scheduleRetry('retry',900);}
  }
  function releaseWorker(reason='yield'){
    if(role!=='WORKER')return;
    if(fallbackLease){releaseFallback();if(!suspended&&!contextDead)setRole('CLIENT',reason);scheduleRetry('post-yield',1200);return;}
    if(releaseLock){const fn=releaseLock;releaseLock=null;try{fn();}catch{}}
  }
  function releaseWorkerForSafeMode(){if(safe()&&role==='WORKER')releaseWorker('safe-mode');}

  function eligiblePeer(){purgePeers();return[...peers.values()].find(p=>p.role!=='WORKER'&&!p.safeMode&&!p.heavy);}
  function scheduleHeavyYield(){
    if(suspended||contextDead||heavyTimer||role!=='WORKER'||!heavy()||safe())return;
    broadcast('heavy-request');
    heavyTimer=setTimeout(()=>{heavyTimer=0;if(!suspended&&!contextDead&&role==='WORKER'&&heavy()&&eligiblePeer())releaseWorker('heavy-handoff');},500);
  }
  function schedulePulse(delay=12000){
    clearTimeout(pulseTimer);pulseTimer=0;if(suspended||contextDead)return;
    pulseTimer=setTimeout(()=>{
      pulseTimer=0;if(suspended||contextDead)return;purgePeers();broadcast('pulse');
      if(role==='WORKER'){if(heavy())scheduleHeavyYield();pumpIdle();}
      else if(!safe())tryAcquire('pulse');
      schedulePulse(12000);
    },delay);
  }

  async function loadPublicSettings(){
    if(contextDead)return;
    try{if(!contextAlive()){deactivate('context-invalidated');return;}const raw=(await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]||{};settings={safeMode:raw.safeMode===true};}
    catch(error){if(invalidated(error)||!contextAlive()){deactivate('context-invalidated');return;}settings={safeMode:false};}
    if(contextDead)return;releaseWorkerForSafeMode();if(!safe())tryAcquire('settings');patchDiagnostic();
  }
  function onRuntimeStateChanged(){
    if(suspended||contextDead)return;broadcast('runtime-state');patchDiagnostic();
    if(role==='WORKER'){if(heavy())scheduleHeavyYield();else pumpIdle();}
    else if(!safe())tryAcquire('state-change');
  }
  const stateObserver=new MutationObserver(records=>{
    if(suspended||contextDead)return;if(records.some(r=>['data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity'].includes(r.attributeName)))onRuntimeStateChanged();
  });
  stateObserver.observe(root(),{attributes:true,attributeFilter:['data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity']});
  document.addEventListener('visibilitychange',()=>{if(suspended||contextDead)return;broadcast('visibility');if(!document.hidden){pumpIdle();if(role!=='WORKER'&&!safe())tryAcquire('visible');}});
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(suspended||contextDead)return;if(area==='local'&&changes[SETTINGS_KEY])loadPublicSettings();});}catch(error){if(invalidated(error))contextDead=true;}

  // Cache-only Quick Open fallback remains available on CLIENT tabs.
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function routeTo(href){
    const id=String(href||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1],nav=document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav');
    const native=id&&nav?[...nav.querySelectorAll('a[href*="/c/"]')].find(a=>(a.getAttribute('href')||'').includes(id)):null;
    if(native){native.click();return;}location.assign(href);
  }
  async function quickCache(){const bus=window.__NIAKGPT_CACHE_BUS__;return bus?await bus.get():null;}
  async function openClientQuick(){
    if(contextDead||role==='WORKER'||document.getElementById('ng8-quick'))return false;const raw=await quickCache();if(!raw)return false;
    const modal=document.createElement('div');modal.id='ng8-quick';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML='<div><input autofocus placeholder="Quick Open — cache local"><section></section><footer>CLIENT · cache local · ↑↓ · Entrée · Échap</footer></div>';document.body.appendChild(modal);
    const input=modal.querySelector('input'),list=modal.querySelector('section');let items=[],sel=0;
    const projectNames=new Map((raw.projects||[]).map(p=>[p.id,p.name]));
    const paint=()=>{const q=norm(input.value);items=(raw.chats||[]).filter(c=>!q||norm(`${c.title||''} ${c.snippet||''} ${projectNames.get(c.projectId)||''}`).includes(q)).sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,100).map(c=>({title:c.title||'Conversation',sub:projectNames.get(c.projectId)||'Hors projet',href:c.href||(c.projectId?`/g/${c.projectId}/c/${c.id}`:`/c/${c.id}`)}));sel=Math.min(sel,Math.max(0,items.length-1));list.innerHTML=items.map((x,i)=>`<button class="${i===sel?'sel':''}" data-i="${i}"><span>${x.title.replace(/[&<>]/g,'')}</span><small>${x.sub.replace(/[&<>]/g,'')}</small><em>CHAT</em></button>`).join('');list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>routeTo(items[Number(b.dataset.i)].href)));};
    input.addEventListener('input',()=>{sel=0;paint();});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,items.length-1);paint();}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}else if(e.key==='Enter'&&items[sel]){e.preventDefault();routeTo(items[sel].href);}else if(e.key==='Escape')modal.remove();});modal.addEventListener('mousedown',e=>{if(e.target===modal)modal.remove();});paint();setTimeout(()=>input.focus(),0);return true;
  }
  document.addEventListener('keydown',event=>{if(contextDead)return;if(event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&String(event.key).toLowerCase()==='k'&&role!=='WORKER'){event.preventDefault();event.stopImmediatePropagation();openClientQuick();}},true);

  function suspend(){
    if(suspended)return;suspended=true;clearTimers();idleTasks.clear();releaseFallback();if(releaseLock){const fn=releaseLock;releaseLock=null;try{fn();}catch{}}closeChannel();
  }
  function resume(){
    if(contextDead||!contextAlive()){deactivate('context-invalidated');return;}suspended=false;startedAt=performance.now();openChannel();root().dataset.ng8TabRole='client';role='CLIENT';patchDiagnostic();broadcast('resume');loadPublicSettings();scheduleStartupWake();schedulePulse(1200);scheduleRetry('resume',120);
  }
  function deactivate(reason='context-invalidated'){
    if(contextDead)return;contextDead=true;suspended=true;clearTimers();idleTasks.clear();releaseFallback();if(releaseLock){const fn=releaseLock;releaseLock=null;try{fn();}catch{}}closeChannel();stateObserver.disconnect();try{root().dataset.ng8TabRole='inactive';root().dataset.ng8TabReason=reason;}catch{}
  }
  window.addEventListener('pagehide',event=>{suspend();if(!event.persisted)contextDead=true;});
  window.addEventListener('pageshow',event=>{if(event.persisted)resume();});

  root().dataset.ng8TabRole='client';openChannel();patchDiagnostic();broadcast('hello');loadPublicSettings();scheduleStartupWake();schedulePulse(2500);scheduleRetry('startup',120);setTimeout(()=>{if(!suspended&&!contextDead)pumpIdle();},3000);
})();
