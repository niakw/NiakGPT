(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_GOVERNANCE_090__) return;
  window.__NIAKGPT_GOVERNANCE_090__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const LOCK_MIRROR_KEY='niakgpt-manual-locks-v085';
  const CHANNEL='niakgpt-governance-v085';
  const LEGACY=new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development']);
  const SUSPECT=/^(test|tests|demo|sandbox|temp|temporary|tmp|untitled|nouveau projet|new project)(\b|\s|[-_])/i;
  const STOP=new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut').split(/\s+/));
  const bc=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null;

  let config={seeded:false,coreProjectIds:[],hiddenProjectIds:[],locks:{},lastCleanup:null,autoResync:true};
  let cache={projects:[],chats:[],counts:{},projectChats:{}};
  let lastPlan=null,rpcSeq=0,running=false,autoTimer=0,sidebarObserver=null,sidebarRoot=null,sidebarTimer=0,modalReturnFocus=null;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const words=v=>norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const normalizePid=v=>{if(!v||typeof v!=='string')return'';const s=v.trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const role=()=>document.documentElement.dataset.ng8TabRole||'unknown';
  const runningChat=()=>document.documentElement.dataset.ng8Running==='1';
  const heavy=()=>document.documentElement.dataset.ng8Heavy==='1';
  const safeMode=()=>document.documentElement.dataset.ng90Safe==='1';
  const canAutomate=()=>role()==='worker'&&!document.hidden&&!runningChat()&&!heavy()&&!safeMode();

  function rpc(path,{method='GET',body=null,timeout=16000,governance=false}={}){
    const id=`ng90-gov-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance}}));
    });
  }

  async function loadConfig(){try{const raw=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY];if(raw&&typeof raw==='object')config={...config,...raw,locks:raw.locks||{}};}catch{}mirrorLocks();}
  function cloneCache(raw){const fallback={schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[]};if(!raw||typeof raw!=='object')return fallback;try{return structuredClone(raw);}catch{try{return JSON.parse(JSON.stringify(raw));}catch{return fallback;}}}
  async function loadCache(){try{const bus=window.__NIAKGPT_CACHE_BUS__,raw=bus?await bus.get():null;cache=cloneCache(raw);return cache;}catch{cache={schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[]};return cache;}}
  async function saveCache(){cache.at=Date.now();try{await chrome.storage.local.set({[CACHE_KEY]:cache});}catch{}}
  async function saveConfig(){mirrorLocks();try{await chrome.storage.local.set({[GOV_KEY]:config});}catch{}applyHiddenProjects();decorateLocks();patchExplorer();patchDiagnostic();bc?.postMessage({type:'config',at:Date.now()});}
  function mirrorLocks(){try{localStorage.setItem(LOCK_MIRROR_KEY,JSON.stringify(config.locks||{}));}catch{}}

  function projectRecency(id){let t=0;for(const c of uniqueChats())if(c.projectId===id)t=Math.max(t,c.updated||0);return t;}
  function uniqueChats(){
    const map=new Map();
    const ingest=(c,pid='')=>{if(!c?.id)return;const old=map.get(c.id)||{},updated=Math.max(parseTime(old.updated),parseTime(c.updated||c.update_time||c.create_time));map.set(c.id,{...old,...c,projectId:normalizePid(pid||c.projectId||old.projectId||''),updated});};
    for(const c of cache.chats||[])ingest(c);
    for(const [pid,list] of Object.entries(cache.projectChats||{}))for(const c of list||[])ingest(c,pid);
    return[...map.values()];
  }
  function canonicalMap(){
    const groups=new Map();for(const p of cache.projects||[]){const k=norm(p.name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}const canonical=new Map(),duplicateOf=new Map();
    for(const [key,group] of groups){group.sort((a,b)=>(Number(cache.counts?.[b.id])||0)-(Number(cache.counts?.[a.id])||0)||projectRecency(b.id)-projectRecency(a.id));const keep=group[0];if(keep)canonical.set(key,keep.id);for(const p of group.slice(1))duplicateOf.set(p.id,keep.id);}return{canonical,duplicateOf};
  }
  const isLegacyProject=p=>!!p&&LEGACY.has(norm(p.name));
  const isSuspectProject=p=>!!p&&SUSPECT.test(norm(p.name));

  function seedCore(){
    if(config.seeded)return false;const{duplicateOf}=canonicalMap(),ids=[];for(const p of cache.projects||[]){if(duplicateOf.has(p.id)||isLegacyProject(p)||isSuspectProject(p))continue;ids.push(p.id);}config.coreProjectIds=ids;config.seeded=true;return true;
  }

  function buildProfiles(coreIds){
    const projects=new Map((cache.projects||[]).map(p=>[p.id,p])),profiles=new Map();
    const add=(map,text,w)=>{for(const t of words(text))map.set(t,(map.get(t)||0)+w);};
    for(const id of coreIds){const p=projects.get(id);if(!p)continue;const profile=new Map();add(profile,p.name,40);add(profile,p.description,12);add(profile,p.instructions,10);profiles.set(id,profile);}
    for(const c of uniqueChats()){const profile=profiles.get(c.projectId);if(profile)add(profile,`${c.title||''} ${c.snippet||''}`,3);}
    return{projects,profiles};
  }
  function scoreChat(chat,project,profile){
    const text=norm(`${chat.title||''} ${chat.snippet||''}`),pn=norm(project.name);let score=0;if(pn.length>=3&&text.includes(pn))score+=300;const tokens=new Set(words(text));for(const t of words(project.name))if(tokens.has(t))score+=54;for(const t of tokens)score+=Math.min(24,profile?.get(t)||0);return score;
  }
  function bestTarget(chat,coreIds,blockedIds,model){
    const ranked=[];for(const id of coreIds){const p=model.projects.get(id);if(!p||blockedIds.has(id))continue;ranked.push({project:p,score:scoreChat(chat,p,model.profiles.get(id))});}ranked.sort((a,b)=>b.score-a.score);const first=ranked[0],second=ranked[1];return first?{...first,margin:first.score-(second?.score||0)}:null;
  }

  function buildCleanupPlan(){
    seedCore();const projects=new Map((cache.projects||[]).map(p=>[p.id,p])),{duplicateOf}=canonicalMap(),coreIds=new Set((config.coreProjectIds||[]).filter(id=>projects.has(id))),relics=new Map();
    for(const p of cache.projects||[]){if(duplicateOf.has(p.id))relics.set(p.id,{project:p,type:'DOUBLON',targetId:duplicateOf.get(p.id)});else if(!coreIds.has(p.id)&&isLegacyProject(p))relics.set(p.id,{project:p,type:'RELIQUAT',targetId:''});else if(!coreIds.has(p.id)&&isSuspectProject(p))relics.set(p.id,{project:p,type:'TEST/TEMP',targetId:''});}
    const model=buildProfiles([...coreIds]),blocked=new Set(relics.keys()),operations=[],preserved=[],unassigned=[];
    for(const chat of uniqueChats()){
      if(config.locks?.[chat.id]){preserved.push({chat,reason:'MANUEL',projectId:chat.projectId});continue;}
      const relic=relics.get(chat.projectId);
      if(relic){
        if(relic.type==='DOUBLON'&&relic.targetId){operations.push({chat,fromId:chat.projectId,toId:relic.targetId,reason:'DOUBLON',confidence:999});continue;}
        const best=bestTarget(chat,[...coreIds],blocked,model);if(best&&best.score>=58&&best.margin>=16)operations.push({chat,fromId:chat.projectId,toId:best.project.id,reason:'CLASSÉ',confidence:best.score});else operations.push({chat,fromId:chat.projectId,toId:'',reason:'À CLASSER',confidence:best?.score||0});continue;
      }
      if(!chat.projectId){const best=bestTarget(chat,[...coreIds],blocked,model);if(best&&best.score>=70&&best.margin>=20)operations.push({chat,fromId:'',toId:best.project.id,reason:'RESYNC',confidence:best.score});else unassigned.push(chat);}
    }
    const lockedByRelic=new Map();for(const x of preserved)if(relics.has(x.projectId))lockedByRelic.set(x.projectId,(lockedByRelic.get(x.projectId)||0)+1);
    return{at:Date.now(),coreIds:[...coreIds],relics:[...relics.values()],operations,preserved,unassigned,lockedByRelic,duplicateOf};
  }

  async function verifyDestination(chatId,targetId,{attempts=3}={}){
    const expected=normalizePid(targetId);for(let i=0;i<attempts;i++){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{timeout:12000,governance:true});if(r.ok){const got=normalizePid(r.data?.gizmo_id||r.data?.conversation_mode?.gizmo_id||'');if(got===expected)return{ok:true,got,data:r.data};if(i===attempts-1)return{ok:false,got,error:'destination_mismatch'};}else if(i===attempts-1)return{ok:false,error:r.error||`HTTP ${r.status||0}`};await sleep(280*(i+1));}return{ok:false,error:'verify_failed'};
  }
  async function moveConversation(chatId,targetId){
    const path=`/backend-api/conversation/${encodeURIComponent(chatId)}`;await rpc(path,{method:'PATCH',body:{gizmo_id:targetId||null},timeout:14000,governance:true});return verifyDestination(chatId,targetId,{attempts:3});
  }
  function applyMoveToCache(chatId,targetId){
    const target=normalizePid(targetId),chat=(cache.chats||[]).find(c=>c.id===chatId),from=normalizePid(chat?.projectId||'');
    if(chat)chat.projectId=target;
    // Legacy cache compatibility only: update projectChats if an old schema is still loaded.
    if(cache.projectChats&&typeof cache.projectChats==='object'){
      let found=chat?{...chat}:null;
      for(const [pid,list] of Object.entries(cache.projectChats)){const idx=(list||[]).findIndex(c=>c.id===chatId);if(idx>=0){found={...list[idx],projectId:target};list.splice(idx,1);}cache.counts??={};cache.counts[pid]=(list||[]).length;}
      if(found&&target){cache.projectChats[target]??=[];const idx=cache.projectChats[target].findIndex(c=>c.id===chatId);if(idx>=0)cache.projectChats[target][idx]={...found,projectId:target};else cache.projectChats[target].push({...found,projectId:target});cache.counts[target]=cache.projectChats[target].length;}
    }else{
      cache.counts??={};
      if(from&&cache.counts[from]!=null&&Number.isFinite(Number(cache.counts[from])))cache.counts[from]=Math.max(0,Number(cache.counts[from])-1);
      if(target&&target!==from&&cache.counts[target]!=null&&Number.isFinite(Number(cache.counts[target])))cache.counts[target]=Number(cache.counts[target])+1;
    }
  }

  function hiddenStyle(){let style=document.getElementById('ng90-hidden-projects');if(!style){style=document.createElement('style');style.id='ng90-hidden-projects';document.documentElement.appendChild(style);}return style;}
  function applyHiddenProjects(){const rules=[];for(const raw of config.hiddenProjectIds||[]){const id=normalizePid(raw).replace(/[^A-Za-z0-9_-]/g,'');if(!id)continue;rules.push(`a[href*="/g/${id}/project"],a[href*="/g/${id}/c/"],#ng8-pins a[href*="/g/${id}/"],.ng8-project-table a[href*="/g/${id}/"]{display:none!important}`);}hiddenStyle().textContent=rules.join('\n');}
  function navRoot(){return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector('a[href*="/c/"]'))||document.querySelector('nav');}
  function decorateLocks(root=navRoot()||document){
    const locks=config.locks||{};for(const a of root.querySelectorAll?.('a[href*="/c/"]')||[]){if(a.closest('#ng8-quick,#ng85-governance,#ng90-control'))continue;const id=cidFromHref(a.getAttribute('href'));if(!id)continue;const locked=!!locks[id];a.dataset.ng85Manual=locked?'1':'0';let badge=a.querySelector(':scope>.ng85-manual-lock');if(locked&&!badge){badge=document.createElement('button');badge.type='button';badge.className='ng85-manual-lock';badge.dataset.unlock=id;badge.title='Placement manuel · cliquer pour autoriser à nouveau le classement automatique';badge.setAttribute('aria-label','Déverrouiller le classement automatique de cette conversation');badge.textContent='🔒';a.appendChild(badge);}else if(!locked)badge?.remove();}
  }
  function bindSidebar(){const root=navRoot();if(!root||root===sidebarRoot)return;sidebarObserver?.disconnect();sidebarRoot=root;sidebarObserver=new MutationObserver(records=>{clearTimeout(sidebarTimer);const nodes=[];for(const r of records)for(const n of r.addedNodes)if(n instanceof Element)nodes.push(n);sidebarTimer=setTimeout(()=>{for(const n of nodes)decorateLocks(n);applyHiddenProjects();},document.documentElement.dataset.ng8Running==='1'?900:180);});sidebarObserver.observe(root,{childList:true,subtree:true});decorateLocks(root);}

  function patchExplorer(){
    const panel=document.getElementById('ng8-panel');if(!panel)return;const repair=panel.querySelector('[data-repair]');if(repair){repair.textContent='Nettoyer & reconstruire';repair.dataset.ng90Governance='1';repair.title='Analyser les reliquats, doublons et conversations à reclasser';}
    const actions=panel.querySelector('.ng8-actions');if(actions&&!actions.querySelector('[data-ng90-locks]')){const b=document.createElement('button');b.dataset.ng90Locks='1';b.textContent=`🔒 ${Object.keys(config.locks||{}).length}`;b.title='Placements manuels protégés';b.addEventListener('click',openGovernance);actions.appendChild(b);}
  }
  function patchDiagnostic(){const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return;let row=diag.querySelector(':scope>.ng85-governance-diagnostic');if(!row){row=document.createElement('div');row.className='ng85-governance-diagnostic';diag.prepend(row);}row.innerHTML=`<span>governance</span><b class="ok">OK · ${(config.coreProjectIds||[]).length} principaux · ${Object.keys(config.locks||{}).length} manuels · ${(config.hiddenProjectIds||[]).length} masqués</b>`;}
  function toast(text){let t=document.getElementById('ng85-toast');if(!t){t=document.createElement('div');t.id='ng85-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600);}

  async function unlockChat(chatId){if(!config.locks?.[chatId])return;const next={...(config.locks||{})};delete next[chatId];config.locks=next;await saveConfig();toast('Conversation rendue au classement automatique');renderGovernanceModal();}
  async function verifyAndLockManualMove(detail){
    const id=String(detail?.id||'');if(!id)return;
    if(detail?.ok===false)return;
    const expected=detail?.detached?'':normalizePid(detail?.projectId||'');
    const nativeAccepted=detail?.ok===true&&Number(detail?.status||0)>=200&&Number(detail?.status||0)<300;
    const trustedMenuIntent=detail?.source==='trusted-project-menu';
    // A successful native PATCH OR an exact trusted Project-menu selection is sufficient user
    // authority to protect the intended placement immediately. The lightweight inventory lookup
    // reconciles afterwards; it must not gate the visible lock behind a background quiet window.
    if(nativeAccepted||trustedMenuIntent){
      config.locks={...(config.locks||{}),[id]:{projectId:expected,at:Date.now(),source:nativeAccepted?'manual-native-ack':'manual-menu-intent'}};
      applyMoveToCache(id,expected);await saveCache();await saveConfig();toast('Placement manuel protégé 🔒');
      const verify=await verifyDestination(id,expected,{attempts:3});
      if(verify.ok&&verify.got!==expected){
        config.locks={...(config.locks||{}),[id]:{projectId:verify.got||'',at:Date.now(),source:'manual-reconciled'}};
        applyMoveToCache(id,verify.got||'');await saveCache();await saveConfig();
      }
      return;
    }
    const verify=await verifyDestination(id,expected,{attempts:3});if(!verify.ok)return;
    config.locks={...(config.locks||{}),[id]:{projectId:verify.got||'',at:Date.now(),source:'manual'}};
    applyMoveToCache(id,verify.got||'');await saveCache();await saveConfig();toast('Placement manuel protégé 🔒');
  }

  function projectType(p,plan){if(plan.duplicateOf.has(p.id))return'DOUBLON';if(plan.coreIds.includes(p.id))return'PRINCIPAL';if(isSuspectProject(p))return'TEST/TEMP';if(isLegacyProject(p))return'RELIQUAT';return'AUTRE';}
  function modalFocusable(modal){return[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x instanceof HTMLElement&&x.getClientRects().length);}
  function closeGovernance(){const modal=document.getElementById('ng85-governance');modal?.remove();if(modalReturnFocus?.isConnected)modalReturnFocus.focus();modalReturnFocus=null;}
  function renderGovernanceModal(mode='idle',result=null){
    const modal=document.getElementById('ng85-governance');if(!modal)return;const plan=lastPlan||buildCleanupPlan(),projects=cache.projects||[],hidden=new Set(config.hiddenProjectIds||[]),locks=Object.entries(config.locks||{}),core=new Set(config.coreProjectIds||[]);
    const opsByRelic=new Map();for(const op of plan.operations)if(op.fromId)opsByRelic.set(op.fromId,(opsByRelic.get(op.fromId)||0)+1);
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ng90-gov-title');
    modal.innerHTML=`<div class="ng85-governance-card">
      <header><div><small>PROJECT GOVERNANCE · 0.9</small><b id="ng90-gov-title">Nettoyer & reconstruire</b></div><button data-close aria-label="Fermer">×</button></header>
      <div class="ng85-summary"><div><b>${plan.coreIds.length}</b><span>Projects principaux</span></div><div><b>${plan.relics.length}</b><span>reliquats / doublons</span></div><div><b>${plan.preserved.length}</b><span>placements manuels</span></div><div><b>${plan.operations.length}</b><span>actions proposées</span></div></div>
      <div class="ng85-note"><b>Règle absolue :</b> un déplacement manuel est prioritaire. Les chats ambigus d’un reliquat sont laissés Hors projet / À classer.</div>
      ${result?`<div class="ng85-result"><b>Nettoyage terminé</b><span>${result.moved} réaffectés · ${result.detached} à classer · ${result.failed} échecs</span></div>`:''}
      <div class="ng85-progress" ${mode==='running'?'':'hidden'}><i></i><span>Préparation…</span></div>
      <div class="ng85-columns">
        <section><h3>Structure principale</h3><p>Choisis les contextes durables. Les catégories génériques ne sont pas sélectionnées automatiquement.</p><div class="ng85-project-choice">${projects.map(p=>{const type=projectType(p,plan),cls=`type-${norm(type).replace(/[^a-z0-9]+/g,'-')}`;return`<label class="${cls}"><input type="checkbox" data-core="${esc(p.id)}" ${core.has(p.id)?'checked':''}><span>${esc(p.icon||'▤')} ${esc(p.name)}</span><em>${esc(hidden.has(p.id)?'MASQUÉ':type)}</em></label>`;}).join('')}</div></section>
        <section><h3>Plan de nettoyage</h3><p>Aucune suppression serveur automatique. Les Projects vidés sont masqués localement.</p><div class="ng85-plan-list">${plan.relics.length?plan.relics.map(r=>`<div><b>${esc(r.project.name)}</b><span>${esc(r.type)}</span><em>${opsByRelic.get(r.project.id)||0} chat(s)</em></div>`).join(''):'<div class="empty">Aucun reliquat détecté.</div>'}</div></section>
      </div>
      <div class="ng85-plan-stats"><span>→ ${plan.operations.filter(x=>x.toId).length} réaffectations</span><span>○ ${plan.operations.filter(x=>!x.toId&&x.fromId).length} vers Hors projet</span><span>🔒 ${plan.preserved.length} préservés</span><span>… ${plan.unassigned.length} non classés</span></div>
      <section class="ng85-lock-list"><h3>Placements manuels</h3><p>Ces conversations ne seront jamais déplacées automatiquement tant que le verrou reste actif.</p>${locks.length?locks.slice(0,80).map(([id,l])=>`<div><code>${esc(id.slice(0,8))}…</code><span>${esc(l.projectId||'Hors projet')}</span><button data-unlock="${esc(id)}">Déverrouiller</button></div>`).join(''):'<div><span>Aucun placement manuel protégé.</span></div>'}</section>
      <footer><button data-unhide ${hidden.size?'':'disabled'}>Réafficher ${hidden.size||''}</button><span></span><button data-recalc>Recalculer</button><button class="primary" data-execute ${running||!plan.operations.length?'disabled':''}>Exécuter ${plan.operations.length||''}</button></footer>
    </div>`;
    modal.querySelector('[data-close]')?.addEventListener('click',closeGovernance);modal.onmousedown=e=>{if(e.target===modal)closeGovernance();};
    modal.querySelectorAll('[data-core]').forEach(input=>input.addEventListener('change',async()=>{const set=new Set(config.coreProjectIds||[]),id=input.dataset.core;if(input.checked)set.add(id);else set.delete(id);config.coreProjectIds=[...set];config.seeded=true;await saveConfig();lastPlan=buildCleanupPlan();renderGovernanceModal();}));
    modal.querySelectorAll('[data-unlock]').forEach(b=>b.addEventListener('click',()=>unlockChat(b.dataset.unlock)));
    modal.querySelector('[data-unhide]')?.addEventListener('click',async()=>{config.hiddenProjectIds=[];await saveConfig();lastPlan=buildCleanupPlan();renderGovernanceModal();});
    modal.querySelector('[data-recalc]')?.addEventListener('click',async()=>{await loadCache();lastPlan=buildCleanupPlan();renderGovernanceModal();});
    modal.querySelector('[data-execute]')?.addEventListener('click',()=>executePlan(lastPlan||buildCleanupPlan()));
  }
  async function openGovernance(){modalReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;await loadCache();if(seedCore())await saveConfig();lastPlan=buildCleanupPlan();let modal=document.getElementById('ng85-governance');if(!modal){modal=document.createElement('div');modal.id='ng85-governance';document.body.appendChild(modal);}renderGovernanceModal();requestAnimationFrame(()=>modal.querySelector('[data-close]')?.focus());}
  function updateGovernanceProgress(done,total,moved,detached,failed){const p=document.querySelector('#ng85-governance .ng85-progress');if(!p)return;p.hidden=false;const pct=total?Math.round(done/total*100):100;p.querySelector('i').style.width=`${pct}%`;p.querySelector('span').textContent=`${done}/${total} · ${moved} réaffectés · ${detached} à classer · ${failed} échecs`;}

  async function executePlan(plan){
    if(running||!plan?.operations?.length)return;if(!confirm(`Traiter ${plan.operations.length} conversation(s) ?\n\n${plan.preserved.length} placement(s) manuel(s) resteront protégés.`))return;
    const run=async()=>{
      running=true;renderGovernanceModal('running');let moved=0,detached=0,failed=0;const failedIds=new Set();
      for(let i=0;i<plan.operations.length;i++){
        while(runningChat())await sleep(700);const op=plan.operations[i],r=await moveConversation(op.chat.id,op.toId);if(r.ok){applyMoveToCache(op.chat.id,op.toId);op.toId?moved++:detached++;}else{failed++;failedIds.add(op.chat.id);}updateGovernanceProgress(i+1,plan.operations.length,moved,detached,failed);await sleep(100);
      }
      const hidden=new Set(config.hiddenProjectIds||[]);for(const relic of plan.relics){const locked=plan.lockedByRelic.get(relic.project.id)||0,unresolved=plan.operations.some(op=>op.fromId===relic.project.id&&failedIds.has(op.chat.id));if(!locked&&!unresolved)hidden.add(relic.project.id);}config.hiddenProjectIds=[...hidden];config.lastCleanup={at:Date.now(),moved,detached,failed,relics:plan.relics.length};await saveCache();await saveConfig();lastPlan=buildCleanupPlan();running=false;renderGovernanceModal('result',{moved,detached,failed});toast(`Nettoyage terminé · ${moved+detached} traités`);
    };
    if(navigator.locks?.request){let acquired=false;await navigator.locks.request('niakgpt-governance-cleanup-v090',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await run();});if(!acquired)toast('Un autre onglet exécute déjà le nettoyage');}else await run();
  }

  function scheduleAutoResync(delay=18000){clearTimeout(autoTimer);if(!config.autoResync||safeMode())return;autoTimer=setTimeout(autoResync,delay);}
  async function autoResync(){
    autoTimer=0;if(!config.autoResync||!canAutomate())return;await loadCache();const plan=buildCleanupPlan(),ops=plan.operations.filter(op=>!op.fromId&&op.toId&&op.reason==='RESYNC').slice(0,3);if(!ops.length)return;
    let changed=false;for(const op of ops){if(!canAutomate())break;const r=await moveConversation(op.chat.id,op.toId);if(r.ok){applyMoveToCache(op.chat.id,op.toId);changed=true;}await sleep(120);}if(changed)await saveCache();
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    const unlock=target?.closest('.ng85-manual-lock[data-unlock]');if(unlock){event.preventDefault();event.stopPropagation();unlockChat(unlock.dataset.unlock);return;}
    const repair=target?.closest('[data-repair],[data-ng90-governance]');if(repair){event.preventDefault();event.stopImmediatePropagation();openGovernance();return;}
    if(!target?.closest('nav,[data-testid*="sidebar" i],#ng8-panel,#ng8-rail,#ng90-control,#ng85-governance'))return;
    setTimeout(()=>{bindSidebar();decorateLocks();patchExplorer();patchDiagnostic();},90);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.getElementById('ng85-governance')){event.preventDefault();closeGovernance();return;}
    if(event.key==='Tab'&&document.getElementById('ng85-governance')){const modal=document.getElementById('ng85-governance'),items=modalFocusable(modal);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  },true);
  document.addEventListener('niakgpt:manual-project-move',event=>verifyAndLockManualMove(event.detail));
  document.addEventListener('niakgpt:settings-changed',()=>{if(config.autoResync&&!safeMode())scheduleAutoResync(12000);patchDiagnostic();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindSidebar();decorateLocks();if(config.autoResync)scheduleAutoResync(12000);}});
  window.addEventListener('popstate',()=>setTimeout(()=>{bindSidebar();decorateLocks();applyHiddenProjects();},80));
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes[GOV_KEY]){config={...config,...(changes[GOV_KEY].newValue||{}),locks:changes[GOV_KEY].newValue?.locks||{}};mirrorLocks();applyHiddenProjects();decorateLocks();patchExplorer();patchDiagnostic();renderGovernanceModal();}
    if(changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;lastPlan=null;patchExplorer();if(config.autoResync)scheduleAutoResync(18000);}
  });
  bc?.addEventListener('message',event=>{if(event.data?.type==='config')loadConfig().then(()=>{applyHiddenProjects();decorateLocks();patchExplorer();patchDiagnostic();});});

  Promise.all([loadConfig(),loadCache()]).then(async()=>{if(seedCore())await saveConfig();applyHiddenProjects();bindSidebar();decorateLocks();patchExplorer();patchDiagnostic();if(config.autoResync)scheduleAutoResync(20000);});
})();
