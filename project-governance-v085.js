(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_GOVERNANCE_085__) return;
  window.__NIAKGPT_GOVERNANCE_085__ = true;

  const VERSION = '0.8.5';
  const CACHE_KEY = 'niakgpt-v08-cache';
  const GOV_KEY = 'niakgpt-governance-v085';
  const LOCK_MIRROR_KEY = 'niakgpt-manual-locks-v085';
  const CHANNEL = 'niakgpt-governance-v085';
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  const LEGACY = new Set([
    'design','ai','ia','coding','code','development','web development','technology','tech','social','social media',
    'writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research',
    'productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development'
  ]);
  const SUSPECT = /^(test|tests|demo|sandbox|temp|temporary|tmp|untitled|nouveau projet|new project)(\b|\s|[-_])/i;
  const STOP = new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut').split(/\s+/));

  let config = { seeded:false, coreProjectIds:[], hiddenProjectIds:[], locks:{}, lastCleanup:null, autoResync:true };
  let lastPlan = null;
  let rpcSeq = 0;
  let running = false;
  let autoTimer = 0;

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const parseTime = v => { if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000; if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;} return 0; };
  const normalizePid = v => { if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([a-f0-9]+)(?:-.+)?$/i);return m?`g-p-${m[1]}`:s; };
  const cidFromHref = h => String(h || '').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  function currentRole(){ return document.documentElement.dataset.ng8TabRole || 'unknown'; }
  function isGenerating(){ return document.documentElement.dataset.ng8Running === '1'; }
  function isHeavy(){ return document.documentElement.dataset.ng8Heavy === '1'; }

  function rpc(path,{method='GET',body=null,timeout=16000,governance=false}={}){
    const id=`ng85-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance}}));
    });
  }

  async function loadConfig(){
    try {
      const raw=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY];
      if(raw&&typeof raw==='object') config={...config,...raw,locks:raw.locks||{}};
    } catch {}
    mirrorLocks();
  }
  async function saveConfig(){
    mirrorLocks();
    try{await chrome.storage.local.set({[GOV_KEY]:config});}catch{}
    applyHiddenProjects();
    decorateLocks();
    patchDiagnostic();
    bc?.postMessage({type:'config',at:Date.now()});
  }
  function mirrorLocks(){
    try{localStorage.setItem(LOCK_MIRROR_KEY,JSON.stringify(config.locks||{}));}catch{}
  }
  async function loadCache(){
    try{return (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{projects:[],chats:[],counts:{},projectChats:{}};}catch{return{projects:[],chats:[],counts:{},projectChats:{}};}
  }
  async function saveCache(cache){
    cache.at=Date.now();
    try{await chrome.storage.local.set({[CACHE_KEY]:cache});}catch{}
  }

  function projectRecency(cache,id){
    let t=0;
    const all=[...(cache.chats||[]),...((cache.projectChats||{})[id]||[])];
    for(const c of all)if(c.projectId===id||((cache.projectChats||{})[id]||[]).some(x=>x.id===c.id))t=Math.max(t,parseTime(c.updated||c.update_time));
    return t;
  }
  function canonicalMap(cache){
    const groups=new Map();
    for(const p of cache.projects||[]){const k=norm(p.name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
    const canonical=new Map(),duplicateOf=new Map();
    for(const [key,group] of groups){
      group.sort((a,b)=>(Number(cache.counts?.[b.id])||0)-(Number(cache.counts?.[a.id])||0)||projectRecency(cache,b.id)-projectRecency(cache,a.id));
      const keep=group[0];if(keep)canonical.set(key,keep.id);
      for(const p of group.slice(1))duplicateOf.set(p.id,keep.id);
    }
    return{canonical,duplicateOf};
  }
  function isLegacyProject(p){return !!p&&LEGACY.has(norm(p.name));}
  function isSuspectProject(p){return !!p&&SUSPECT.test(norm(p.name));}
  function uniqueChats(cache){
    const map=new Map();
    const ingest=(c,pid='')=>{if(!c?.id)return;const old=map.get(c.id)||{};map.set(c.id,{...old,...c,projectId:normalizePid(pid||c.projectId||old.projectId||''),updated:Math.max(parseTime(old.updated),parseTime(c.updated||c.update_time))});};
    for(const c of cache.chats||[])ingest(c);
    for(const [pid,list] of Object.entries(cache.projectChats||{}))for(const c of list||[])ingest(c,pid);
    return[...map.values()];
  }

  function seedCore(cache){
    if(config.seeded)return;
    const{duplicateOf}=canonicalMap(cache);
    const ids=[];
    for(const p of cache.projects||[]){
      if(duplicateOf.has(p.id)||isLegacyProject(p)||isSuspectProject(p))continue;
      ids.push(p.id);
    }
    config.coreProjectIds=ids;
    config.seeded=true;
  }

  function buildProfiles(cache,coreIds){
    const projects=new Map((cache.projects||[]).map(p=>[p.id,p]));
    const profiles=new Map();
    const add=(map,text,w)=>{for(const t of words(text))map.set(t,(map.get(t)||0)+w);};
    for(const id of coreIds){const p=projects.get(id);if(!p)continue;const f=new Map();add(f,p.name,40);add(f,p.description,12);add(f,p.instructions,10);profiles.set(id,f);}
    for(const c of uniqueChats(cache)){
      if(!profiles.has(c.projectId))continue;
      const f=profiles.get(c.projectId);add(f,`${c.title||''} ${c.snippet||''}`,3);
    }
    return profiles;
  }
  function scoreChat(chat,p,profile){
    const text=norm(`${chat.title||''} ${chat.snippet||''}`),pn=norm(p.name);let score=0;
    if(pn.length>=3&&text.includes(pn))score+=300;
    const tokens=new Set(words(text));
    for(const t of words(p.name))if(tokens.has(t))score+=54;
    for(const t of tokens)score+=Math.min(24,profile?.get(t)||0);
    return score;
  }
  function bestTarget(cache,chat,coreIds,blockedIds=new Set()){
    const projects=new Map((cache.projects||[]).map(p=>[p.id,p])),profiles=buildProfiles(cache,coreIds);
    const ranked=[];
    for(const id of coreIds){
      const p=projects.get(id);if(!p||blockedIds.has(id))continue;
      ranked.push({project:p,score:scoreChat(chat,p,profiles.get(id))});
    }
    ranked.sort((a,b)=>b.score-a.score);
    const first=ranked[0],second=ranked[1];
    if(!first)return null;
    return{...first,margin:first.score-(second?.score||0)};
  }

  function buildCleanupPlan(cache){
    seedCore(cache);
    const projects=new Map((cache.projects||[]).map(p=>[p.id,p]));
    const{duplicateOf}=canonicalMap(cache);
    const coreIds=new Set(config.coreProjectIds.filter(id=>projects.has(id)));
    const relics=new Map();
    for(const p of cache.projects||[]){
      if(duplicateOf.has(p.id))relics.set(p.id,{project:p,type:'DOUBLON',targetId:duplicateOf.get(p.id)});
      else if(!coreIds.has(p.id)&&isLegacyProject(p))relics.set(p.id,{project:p,type:'RELIQUAT',targetId:''});
      else if(!coreIds.has(p.id)&&isSuspectProject(p))relics.set(p.id,{project:p,type:'TEST/TEMP',targetId:''});
    }
    const operations=[],preserved=[],unassigned=[];
    for(const chat of uniqueChats(cache)){
      const lock=config.locks?.[chat.id];
      if(lock){preserved.push({chat,reason:'MANUEL',projectId:chat.projectId});continue;}
      const relic=relics.get(chat.projectId);
      if(relic){
        if(relic.type==='DOUBLON'&&relic.targetId){operations.push({chat,fromId:chat.projectId,toId:relic.targetId,reason:'DOUBLON',confidence:999});continue;}
        const best=bestTarget(cache,chat,[...coreIds],new Set(relics.keys()));
        if(best&&best.score>=58&&best.margin>=16)operations.push({chat,fromId:chat.projectId,toId:best.project.id,reason:'CLASSÉ',confidence:best.score});
        else operations.push({chat,fromId:chat.projectId,toId:'',reason:'À CLASSER',confidence:best?.score||0});
        continue;
      }
      if(!chat.projectId){
        const best=bestTarget(cache,chat,[...coreIds],new Set(relics.keys()));
        if(best&&best.score>=70&&best.margin>=20)operations.push({chat,fromId:'',toId:best.project.id,reason:'RESYNC',confidence:best.score});
        else unassigned.push(chat);
      }
    }
    const lockedByRelic=new Map();
    for(const x of preserved)if(relics.has(x.projectId))lockedByRelic.set(x.projectId,(lockedByRelic.get(x.projectId)||0)+1);
    return{at:Date.now(),coreIds:[...coreIds],relics:[...relics.values()],operations,preserved,unassigned,lockedByRelic,duplicateOf};
  }

  async function moveConversation(chatId,targetId){
    const path=`/backend-api/conversation/${encodeURIComponent(chatId)}`;
    await rpc(path,{method:'PATCH',body:{gizmo_id:targetId||null},timeout:14000,governance:true});
    const verify=await rpc(path,{timeout:12000,governance:true});
    if(!verify.ok)return{ok:false,error:verify.error||`HTTP ${verify.status||0}`};
    const got=normalizePid(verify.data?.gizmo_id||verify.data?.conversation_mode?.gizmo_id||'');
    return{ok:got===normalizePid(targetId),got};
  }
  function applyMoveToCache(cache,chatId,targetId){
    const target=normalizePid(targetId);
    let found=null;
    for(const c of cache.chats||[])if(c.id===chatId){c.projectId=target;found=c;}
    for(const [pid,list] of Object.entries(cache.projectChats||{})){
      const idx=(list||[]).findIndex(c=>c.id===chatId);
      if(idx>=0){found={...list[idx],projectId:target};list.splice(idx,1);}
      cache.counts[pid]=(list||[]).length;
    }
    if(found&&target){
      if(!cache.projectChats[target])cache.projectChats[target]=[];
      const idx=cache.projectChats[target].findIndex(c=>c.id===chatId);
      if(idx>=0)cache.projectChats[target][idx]={...found,projectId:target};else cache.projectChats[target].push({...found,projectId:target});
      cache.counts[target]=cache.projectChats[target].length;
    }
  }

  async function executePlan(plan){
    if(running)return;
    const confirmed=confirm(`NiakGPT va traiter ${plan.operations.length} conversation(s).\n\nLes placements manuels (${plan.preserved.length}) seront protégés.\nLes conversations ambiguës provenant des reliquats seront sorties de leur Project et laissées « Hors projet / À classer ».\n\nContinuer ?`);
    if(!confirmed)return;

    const run=async()=>{
      running=true;renderGovernanceModal('running');
      const cache=await loadCache();let moved=0,detached=0,failed=0;
      const failedIds=new Set();
      for(let i=0;i<plan.operations.length;i++){
        if(isGenerating()){await sleep(900);i--;continue;}
        const op=plan.operations[i];
        const r=await moveConversation(op.chat.id,op.toId);
        if(r.ok){applyMoveToCache(cache,op.chat.id,op.toId);if(op.toId)moved++;else detached++;}
        else{failed++;failedIds.add(op.chat.id);}
        updateGovernanceProgress(i+1,plan.operations.length,moved,detached,failed);
        await sleep(120);
      }

      const hidden=new Set(config.hiddenProjectIds||[]);
      for(const relic of plan.relics){
        const locked=plan.lockedByRelic.get(relic.project.id)||0;
        const unresolved=plan.operations.some(op=>op.fromId===relic.project.id&&failedIds.has(op.chat.id));
        if(!locked&&!unresolved)hidden.add(relic.project.id);
      }
      config.hiddenProjectIds=[...hidden];
      config.lastCleanup={at:Date.now(),moved,detached,failed,relics:plan.relics.length};
      await saveCache(cache);await saveConfig();
      lastPlan=buildCleanupPlan(cache);
      running=false;renderGovernanceModal('result',{moved,detached,failed});
      setTimeout(()=>document.querySelector('#ng8-panel [data-refresh]')?.click(),700);
    };

    if(navigator.locks?.request){
      let acquired=false;
      await navigator.locks.request('niakgpt-governance-cleanup-v085',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await run();});
      if(!acquired)alert('Un nettoyage NiakGPT est déjà en cours dans un autre onglet.');
    }else await run();
  }

  async function verifyAndLockManualMove(detail){
    const id=String(detail?.id||'');if(!id)return;
    await sleep(350);
    const verify=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{timeout:9000,governance:true});
    let projectId=normalizePid(detail.projectId||'');
    if(verify.ok)projectId=normalizePid(verify.data?.gizmo_id||verify.data?.conversation_mode?.gizmo_id||'');
    else if(!detail.ok&&Number(detail.status)<200)return;
    config.locks[id]={projectId,at:Date.now(),source:'manual'};
    await saveConfig();
    toast(`Placement manuel verrouillé${projectId?'':' · Hors projet'}`);
  }
  async function unlockChat(id){
    if(!config.locks?.[id])return;
    if(!confirm('Retirer le verrou manuel ? NiakGPT pourra à nouveau reclasser cette conversation.'))return;
    delete config.locks[id];await saveConfig();scheduleAutoResync(500);
  }

  function applyHiddenProjects(){
    let style=document.getElementById('ng85-hidden-projects-style');
    if(!style){style=document.createElement('style');style.id='ng85-hidden-projects-style';document.documentElement.appendChild(style);}
    const rules=[];
    for(const id of config.hiddenProjectIds||[]){
      const safe=CSS.escape(id);
      rules.push(`a[href*="/g/${safe}/project"],a[href*="/g/${safe}/c/"],#ng8-pins a[href*="/g/${safe}/"],.ng8-project-table a[href*="/g/${safe}/"]{display:none!important}`);
    }
    style.textContent=rules.join('\n');
  }
  function decorateLocks(){
    const locks=config.locks||{};
    for(const a of document.querySelectorAll('a[href*="/c/"]')){
      if(a.closest('#ng8-quick,#ng85-governance'))continue;
      const id=cidFromHref(a.getAttribute('href'));if(!id)continue;
      let badge=a.querySelector(':scope>.ng85-manual-lock');
      if(locks[id]){
        a.dataset.ng85Manual='1';
        if(!badge){badge=document.createElement('button');badge.type='button';badge.className='ng85-manual-lock';badge.textContent='🔒';badge.title='Placement manuel verrouillé · cliquer pour déverrouiller';badge.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();unlockChat(id);});a.appendChild(badge);}
      }else{delete a.dataset.ng85Manual;badge?.remove();}
    }
  }

  function patchExplorer(){
    const actions=document.querySelector('#ng8-panel .ng8-actions');if(!actions)return;
    const old=actions.querySelector('[data-repair]');if(old){old.textContent='Nettoyer & reconstruire';old.dataset.ng85Governance='1';}
    if(!actions.querySelector('[data-ng85-locks]')){
      const b=document.createElement('button');b.type='button';b.dataset.ng85Locks='1';b.textContent=`🔒 ${Object.keys(config.locks||{}).length} manuels`;b.onclick=()=>openGovernance('locks');actions.appendChild(b);
    }else actions.querySelector('[data-ng85-locks]').textContent=`🔒 ${Object.keys(config.locks||{}).length} manuels`;
  }

  function projectTypeLabel(p,duplicateOf,core){
    if(duplicateOf.has(p.id))return'DOUBLON';
    if(core.has(p.id))return'PRINCIPAL';
    if(isLegacyProject(p))return'RELIQUAT';
    if(isSuspectProject(p))return'TEST/TEMP';
    return'SECONDAIRE';
  }
  async function openGovernance(tab='cleanup'){
    const cache=await loadCache();seedCore(cache);await saveConfig();lastPlan=buildCleanupPlan(cache);renderGovernanceModal(tab);
  }
  function renderGovernanceModal(mode='cleanup',result=null){
    document.getElementById('ng85-governance')?.remove();
    const modal=document.createElement('div');modal.id='ng85-governance';
    const cachePromise=loadCache();
    modal.innerHTML='<div class="ng85-governance-card"><div class="ng85-loading">Chargement de la gouvernance…</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('mousedown',e=>{if(e.target===modal&&!running)modal.remove();});
    cachePromise.then(cache=>{
      const plan=lastPlan||buildCleanupPlan(cache),core=new Set(config.coreProjectIds),{duplicateOf}=canonicalMap(cache),projects=cache.projects||[];
      const lockedCount=Object.keys(config.locks||{}).length;
      const card=modal.querySelector('.ng85-governance-card');
      card.innerHTML=`
        <header><div><small>PROJECT GOVERNANCE · ${VERSION}</small><b>Nettoyer & reconstruire</b></div><button data-close ${running?'disabled':''}>×</button></header>
        <div class="ng85-summary">
          <div><b>${core.size}</b><span>Projects principaux</span></div><div><b>${plan.relics.length}</b><span>reliquats / doublons</span></div><div><b>${lockedCount}</b><span>placements manuels</span></div><div><b>${plan.operations.length}</b><span>actions proposées</span></div>
        </div>
        <section class="ng85-note"><b>Règle absolue :</b> un chat déplacé manuellement est verrouillé et l’automatisation ne le réaffecte plus.</section>
        <div class="ng85-columns">
          <section><h3>Structure principale</h3><p>Stockée localement par ID. Aucun nom personnel n’est codé dans l’extension.</p><div class="ng85-project-choice">${projects.map(p=>`<label class="type-${projectTypeLabel(p,duplicateOf,core).toLowerCase().replace(/[^a-z]+/g,'-')}"><input type="checkbox" data-core="${esc(p.id)}" ${core.has(p.id)?'checked':''}><span>${esc(p.icon||'▤')} ${esc(p.name)}</span><em>${projectTypeLabel(p,duplicateOf,core)}</em></label>`).join('')}</div></section>
          <section><h3>Plan de nettoyage</h3><p>Les cas ambigus provenant d’un reliquat sont sortis du Project et laissés à classer.</p><div class="ng85-plan-list">
            ${plan.relics.map(r=>`<div><b>${esc(r.project.name)}</b><span>${esc(r.type)}</span><em>${plan.lockedByRelic.get(r.project.id)||0} verrouillé(s)</em></div>`).join('')||'<div class="empty">Aucun reliquat détecté.</div>'}
          </div></section>
        </div>
        <section class="ng85-plan-stats"><span>→ ${plan.operations.filter(x=>x.toId).length} réaffectations</span><span>○ ${plan.operations.filter(x=>!x.toId).length} vers Hors projet</span><span>🔒 ${plan.preserved.length} préservés</span><span>… ${plan.unassigned.length} déjà en attente</span></section>
        <div class="ng85-progress" ${running?'':'hidden'}><i></i><span>Préparation…</span></div>
        ${result?`<div class="ng85-result"><b>Nettoyage terminé</b><span>${result.moved} réaffectés · ${result.detached} hors projet · ${result.failed} échecs</span></div>`:''}
        <footer><button data-unhide>Réafficher les Projects masqués</button><button data-export-locks>Voir les verrouillages</button><span></span><button data-analyse>Recalculer</button><button class="primary" data-execute ${running?'disabled':''}>Exécuter le nettoyage</button></footer>`;
      card.querySelector('[data-close]')?.addEventListener('click',()=>modal.remove());
      card.querySelectorAll('[data-core]').forEach(input=>input.addEventListener('change',async()=>{
        const id=input.dataset.core,set=new Set(config.coreProjectIds);if(input.checked)set.add(id);else set.delete(id);config.coreProjectIds=[...set];config.seeded=true;await saveConfig();lastPlan=buildCleanupPlan(await loadCache());renderGovernanceModal('cleanup');
      }));
      card.querySelector('[data-analyse]')?.addEventListener('click',async()=>{lastPlan=buildCleanupPlan(await loadCache());renderGovernanceModal('cleanup');});
      card.querySelector('[data-execute]')?.addEventListener('click',()=>executePlan(lastPlan||plan));
      card.querySelector('[data-unhide]')?.addEventListener('click',async()=>{config.hiddenProjectIds=[];await saveConfig();toast('Projects masqués réaffichés');});
      card.querySelector('[data-export-locks]')?.addEventListener('click',()=>renderLocksList(card));
    });
  }
  function renderLocksList(card){
    let box=card.querySelector('.ng85-lock-list');box?.remove();box=document.createElement('section');box.className='ng85-lock-list';
    const ids=Object.keys(config.locks||{});box.innerHTML=`<h3>Placements manuels verrouillés</h3>${ids.length?ids.map(id=>`<div><code>${esc(id.slice(0,8))}…</code><span>${config.locks[id].projectId?'Project manuel':'Hors projet manuel'}</span><button data-unlock="${esc(id)}">Déverrouiller</button></div>`).join(''):'<p>Aucun verrou manuel.</p>'}`;card.querySelector('footer').before(box);box.querySelectorAll('[data-unlock]').forEach(b=>b.onclick=()=>unlockChat(b.dataset.unlock));
  }
  function updateGovernanceProgress(done,total,moved,detached,failed){
    const bar=document.querySelector('#ng85-governance .ng85-progress');if(!bar)return;bar.hidden=false;bar.querySelector('i').style.width=`${total?Math.round(done/total*100):100}%`;bar.querySelector('span').textContent=`${done}/${total} · ${moved} réaffectés · ${detached} hors projet · ${failed} échecs`;
  }

  function patchDiagnostic(){
    const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;
    let row=diag.querySelector(':scope>.ng85-governance-diagnostic');if(!row){row=document.createElement('div');row.className='ng85-governance-diagnostic';diag.prepend(row);}
    row.innerHTML=`<span>governance</span><b class="ok">OK · ${config.coreProjectIds.length} principaux · ${Object.keys(config.locks||{}).length} manuels · ${(config.hiddenProjectIds||[]).length} masqués</b>`;
  }
  function patchVersion(){
    const status=document.getElementById('ng8-status');if(!status)return;
    const first=status.firstElementChild;if(first)first.innerHTML=first.innerHTML.replace(/(NiakGPT<\/b>\s*)0\.8\.0/,'$1'+VERSION);
  }
  function toast(text){
    let t=document.getElementById('ng85-toast');if(!t){t=document.createElement('div');t.id='ng85-toast';document.body.appendChild(t);}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  async function autoResync(){
    clearTimeout(autoTimer);autoTimer=0;
    if(!config.autoResync||running||isGenerating()||isHeavy()||document.hidden||currentRole()!=='worker')return scheduleAutoResync(120000);
    const cache=await loadCache();seedCore(cache);const core=config.coreProjectIds.filter(id=>(cache.projects||[]).some(p=>p.id===id));if(!core.length)return scheduleAutoResync(120000);
    const candidates=uniqueChats(cache).filter(c=>!c.projectId&&!config.locks?.[c.id]).sort((a,b)=>b.updated-a.updated).slice(0,12);let changed=0;
    for(const chat of candidates){
      const best=bestTarget(cache,chat,core);if(!best||best.score<76||best.margin<22)continue;
      const r=await moveConversation(chat.id,best.project.id);if(r.ok){applyMoveToCache(cache,chat.id,best.project.id);changed++;await sleep(140);}
      if(isGenerating())break;
    }
    if(changed){await saveCache(cache);toast(`${changed} conversation(s) resynchronisée(s)`);}
    scheduleAutoResync(10*60*1000);
  }
  function scheduleAutoResync(delay=60000){clearTimeout(autoTimer);autoTimer=setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>autoResync(),{timeout:5000});else autoResync();},delay);}

  // Disable the legacy organizer's automatic idle callback. Project Governance replaces it.
  const previousRIC=typeof window.requestIdleCallback==='function'?window.requestIdleCallback.bind(window):null;
  if(previousRIC){
    window.requestIdleCallback=function niakgptGovernedIdle(callback,options){
      let source='';try{source=Function.prototype.toString.call(callback);}catch{}
      if(/repairOrganization\s*\(\s*false\s*\)/.test(source))return previousRIC(()=>{},options||{timeout:2500});
      return previousRIC(callback,options);
    };
  }

  // Replace the old explicit organizer button before its bubble listener can run.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('[data-repair],[data-ng85-governance]'):null;
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();openGovernance();
  },true);

  document.addEventListener('niakgpt:manual-project-move',event=>verifyAndLockManualMove(event.detail));
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[GOV_KEY]){config={...config,...(changes[GOV_KEY].newValue||{}),locks:changes[GOV_KEY].newValue?.locks||{}};mirrorLocks();applyHiddenProjects();decorateLocks();patchExplorer();patchDiagnostic();}
    if(area==='local'&&changes[CACHE_KEY]){patchExplorer();scheduleAutoResync(45000);}
  });
  bc?.addEventListener('message',event=>{if(event.data?.type==='config')loadConfig().then(()=>{applyHiddenProjects();decorateLocks();patchExplorer();});});

  const visualTick=()=>{patchExplorer();decorateLocks();applyHiddenProjects();patchDiagnostic();patchVersion();};
  loadConfig().then(async()=>{const cache=await loadCache();seedCore(cache);await saveConfig();visualTick();scheduleAutoResync(45000);});
  setInterval(visualTick,2200);
})();
