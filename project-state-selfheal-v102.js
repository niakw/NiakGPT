(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_STATE_SELFHEAL_102__) return;
  window.__NIAKGPT_PROJECT_STATE_SELFHEAL_102__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const PROJECT_SEL='a[href^="/g/g-p-"]:not([href*="/c/"])';
  const PROJECT_CHAT_SEL='a[href^="/g/g-p-"][href*="/c/"]';
  const OWN='#ng8-pins,#ng8-panel,#ng8-quick,#ng90-control,#ng100-command';
  const COLORS=['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185','#38BDF8','#34D399','#F59E0B'];
  const QUEUE=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  const LEGACY=new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development']);
  let cache={projects:[],chats:[],counts:{}},governance={coreProjectIds:[],hiddenProjectIds:[],locks:{}},timer=0,observer=null,root=null,lastForceAt=0,internal=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const pidFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)(?:\/(?:project|c\/)|[/?#]|$)/i)?.[1]||'';
  const cidFromHref=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const colorFor=name=>{let h=0;for(const c of String(name))h=((h<<5)-h+c.charCodeAt(0))|0;return COLORS[Math.abs(h)%COLORS.length];};
  const iconFor=name=>{const s=norm(name);if(/code|dev|tech|web|api|github|program|provider/.test(s))return'</>';if(/legal|jurid|droit|prud|tribunal|justice/.test(s))return'§';if(/finance|argent|budget|banque|credit|compta/.test(s))return'€';if(/film|cinema|movie|serie|anime|video/.test(s))return'▶';if(/design|logo|image|creative|graph/.test(s))return'◇';if(/shop|commerce|store|product|produit|vente/.test(s))return'▣';if(/(^|\s)(ai|ia|gpt)(\s|$)/.test(s))return'✦';return'▤';};
  const isQueue=p=>QUEUE.has(norm(p?.name));
  const isCanonical=p=>!!p&&String(p.id||'').startsWith('g-p-')&&!p.domOnly&&clean(p.name)&&!isQueue(p);
  const isLocal=p=>!!p&&clean(p.name)&&!isQueue(p)&&!p.duplicateOf;
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL)||x.querySelector('a[href*="/c/"]'))||document.querySelector('nav');
  const diag=(key,text)=>window.__NIAKGPT_DIAGNOSTICS__?.set(key,text);

  function projectDate(id){let at=0;for(const c of cache.chats||[])if(c?.projectId===id)at=Math.max(at,parseTime(c.updated||c.update_time||c.create_time));if(!at)return'—';const d=new Date(at);return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;}
  function countFor(id){const direct=cache.counts?.[id];if(direct!=null&&Number.isFinite(Number(direct)))return Number(direct);return(cache.chats||[]).filter(c=>c?.projectId===id).length;}
  function projectChats(id){return(cache.chats||[]).filter(c=>c?.projectId===id&&c?.id).sort((a,b)=>parseTime(b.updated)-parseTime(a.updated));}

  function nativeProjects(){
    const nav=navRoot();if(!nav)return[];const map=new Map();
    for(const a of nav.querySelectorAll(PROJECT_SEL)){
      if(a.closest(OWN))continue;const id=pidFromHref(a.getAttribute('href'));if(!id)continue;
      const name=clean(a.getAttribute('aria-label')||a.querySelector('.truncate span')?.textContent||a.textContent);if(!name)continue;
      map.set(id,{id,name,href:`/g/${id}/project`,domOnly:false,color:colorFor(name),icon:iconFor(name)});
    }
    return[...map.values()];
  }

  async function readState(){
    try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);cache=raw[CACHE_KEY]&&typeof raw[CACHE_KEY]==='object'?raw[CACHE_KEY]:cache;governance=raw[GOV_KEY]&&typeof raw[GOV_KEY]==='object'?{...governance,...raw[GOV_KEY]}:governance;}catch{}
  }

  async function mergeNativeCanonical(found){
    if(!found.length)return false;
    const byId=new Map((cache.projects||[]).filter(p=>p?.id).map(p=>[p.id,{...p}]));let changed=false;
    for(const p of found){const old=byId.get(p.id)||{};const next={...old,...p,domOnly:false,href:`/g/${p.id}/project`};if(JSON.stringify(old)!==JSON.stringify(next)){byId.set(p.id,next);changed=true;}}
    if(!changed)return false;
    const next={...cache,schema:2,projects:[...byId.values()],projectInventoryAt:Date.now(),at:Date.now()};
    try{await chrome.storage.local.set({[CACHE_KEY]:next});cache=next;diag('project-repair',`AUTO · ${found.length} Projects canoniques récupérés du DOM`);return true;}catch{return false;}
  }

  async function repairGovernance(){
    const canonical=(cache.projects||[]).filter(isCanonical);if(!canonical.length)return false;
    const valid=new Set(canonical.map(p=>p.id));
    const current=[...new Set((governance.coreProjectIds||[]).filter(id=>valid.has(id)))];
    const hidden=[...new Set((governance.hiddenProjectIds||[]).filter(id=>valid.has(id)))];
    let changed=false,next={...governance};
    // A persisted seeded=true + zero valid core IDs is a broken state, not an intentional
    // empty workspace: NiakGPT cannot render or classify anything from it. Rebuild from the
    // canonical inventory while preserving locks and valid hidden choices.
    if(current.length===0){
      const preferred=canonical.filter(p=>!LEGACY.has(norm(p.name))).map(p=>p.id);
      next.coreProjectIds=preferred.length?preferred:canonical.map(p=>p.id);next.seeded=true;changed=true;
    }else if(current.length!==(governance.coreProjectIds||[]).length){next.coreProjectIds=current;changed=true;}
    if(hidden.length!==(governance.hiddenProjectIds||[]).length){next.hiddenProjectIds=hidden;changed=true;}
    if(!changed)return false;
    try{await chrome.storage.local.set({[GOV_KEY]:next});governance=next;diag('organizer',`AUTO-RÉPARÉ · ${(next.coreProjectIds||[]).length} principaux · ${Object.keys(next.locks||{}).length} manuels · ${(next.hiddenProjectIds||[]).length} masqués`);return true;}catch{return false;}
  }

  function unsuppressNative(){const nav=navRoot();if(!nav)return;nav.querySelectorAll('.ng8-native-projects-suppressed,.ng8-native-project-link-suppressed,.ng8-native-project-chat-suppressed,.ng8-native-project-label-suppressed,.ng8-native-project-more-suppressed').forEach(el=>el.classList.remove('ng8-native-projects-suppressed','ng8-native-project-link-suppressed','ng8-native-project-chat-suppressed','ng8-native-project-label-suppressed','ng8-native-project-more-suppressed'));}
  function suppressNative(){
    const nav=navRoot();if(!nav)return;
    for(const a of nav.querySelectorAll(PROJECT_SEL))if(!a.closest('#ng8-pins'))a.classList.add('ng8-native-project-link-suppressed');
    for(const a of nav.querySelectorAll(PROJECT_CHAT_SEL))if(!a.closest('#ng8-pins'))a.classList.add('ng8-native-project-chat-suppressed');
    for(const el of nav.querySelectorAll('h1,h2,h3,[role="heading"],div,span')){if(el.closest('#ng8-pins'))continue;const t=clean(el.textContent);if(/^(projets?|projects?)$/i.test(t))el.classList.add('ng8-native-project-label-suppressed');}
  }
  function place(box){const nav=navRoot();if(!nav)return false;const first=[...nav.querySelectorAll(PROJECT_SEL)].find(a=>!a.closest('#ng8-pins'))||[...nav.querySelectorAll('a[href*="/c/"]')].find(a=>!a.closest('#ng8-pins'));let top=first;while(top?.parentElement&&top.parentElement!==nav)top=top.parentElement;if(box.parentElement!==nav||box.nextElementSibling!==top)nav.insertBefore(box,top||nav.firstElementChild||null);return true;}
  function closeFallbackDrawers(box){box?.querySelectorAll('.ng102-fallback-drawer').forEach(x=>x.remove());box?.querySelectorAll('[data-ng102-project]').forEach(x=>x.setAttribute('aria-expanded','false'));}
  function openFallback(pid,anchor,box){
    closeFallbackDrawers(box);const chats=projectChats(pid);anchor.setAttribute('aria-expanded','true');const d=document.createElement('div');d.className='ng96-pin-drawer ng102-fallback-drawer';d.dataset.pid=pid;d.innerHTML=chats.length?chats.slice(0,160).map(c=>`<button type="button" data-chat="${esc(c.id)}"><span>${esc(c.title||'Conversation sans titre')}</span><time>${esc(projectDate(pid))}</time></button>`).join(''):'<div class="ng96-folder-empty">Aucune conversation indexée</div>';anchor.closest('.ng102-fallback-entry')?.insertAdjacentElement('afterend',d);d.querySelectorAll('[data-chat]').forEach(btn=>btn.addEventListener('click',()=>{const c=chats.find(x=>x.id===btn.dataset.chat);if(!c)return;const href=c.href||`/c/${c.id}`;location.assign(href);}));
  }
  function renderFallback(){
    const canonical=(cache.projects||[]).filter(isCanonical);if(canonical.length){const box=document.getElementById('ng8-pins');if(box?.dataset.ng102Fallback==='1'){box.removeAttribute('data-ng102-fallback');box.removeAttribute('data-ng102-signature');}diag('project-repair',`OK · ${canonical.length} Projects canoniques`);return false;}
    const hidden=new Set(governance.hiddenProjectIds||[]),locals=(cache.projects||[]).filter(p=>isLocal(p)&&!hidden.has(p.id));
    if(!locals.length){unsuppressNative();diag('project-repair','ATTENTE · aucun Project exploitable');return false;}
    const nav=navRoot();if(!nav)return false;let box=document.getElementById('ng8-pins');if(!box){box=document.createElement('section');box.id='ng8-pins';}
    if(!place(box))return false;
    const signature=JSON.stringify(locals.map(p=>[p.id,p.name,countFor(p.id),projectDate(p.id)]));
    if(box.dataset.ng102Signature!==signature||box.dataset.ng102Fallback!=='1'){
      internal=true;closeFallbackDrawers(box);
      box.dataset.ng102Fallback='1';box.dataset.ng102Signature=signature;
      box.innerHTML=`<div class="ng8-pin-head"><span>PROJECTS</span><b>${locals.length}</b></div><div class="ng8-pin-list">${locals.map(p=>`<div class="ng102-fallback-entry"><a href="#" data-ng8-pin="1" data-ng102-project="${esc(p.id)}" aria-expanded="false" style="--ng-project:${esc(p.color||colorFor(p.name))}"><i>${esc(p.icon||iconFor(p.name))}</i><span>${esc(p.name)}</span><small class="ng8-project-meta">${esc(projectDate(p.id))}  [${countFor(p.id)}]</small></a></div>`).join('')}</div>`;
      box.querySelectorAll('[data-ng102-project]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const pid=a.dataset.ng102Project;if(a.getAttribute('aria-expanded')==='true'){closeFallbackDrawers(box);return;}openFallback(pid,a,box);}));
      queueMicrotask(()=>{internal=false;});
    }
    box.hidden=false;box.removeAttribute('aria-hidden');suppressNative();diag('pins-ui',`RÉCUPÉRATION · ${locals.length} Projects cache local`);diag('project-repair',`RÉCUPÉRATION · ${locals.length} Projects locaux · index serveur demandé`);
    if(Date.now()-lastForceAt>12000){lastForceAt=Date.now();document.dispatchEvent(new CustomEvent('niakgpt:force-server-index'));}
    return true;
  }

  async function reconcile(){
    clearTimeout(timer);timer=0;if(internal)return;await readState();
    const dom=nativeProjects();if(dom.length)await mergeNativeCanonical(dom);
    await readState();await repairGovernance();renderFallback();
  }
  function schedule(delay=120){clearTimeout(timer);timer=setTimeout(()=>reconcile().catch(()=>{}),delay);}
  function bind(){const next=navRoot();if(!next||next===root)return;observer?.disconnect();root=next;observer=new MutationObserver(records=>{if(internal)return;let relevant=false;for(const r of records)for(const n of r.addedNodes){if(!(n instanceof Element))continue;if(n.matches?.(PROJECT_SEL)||n.querySelector?.(PROJECT_SEL)||n.matches?.('a[href*="/c/"]')||n.querySelector?.('a[href*="/c/"]')){relevant=true;break;}}if(relevant)schedule(180);});observer.observe(root,{childList:true,subtree:true});}

  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[CACHE_KEY]||changes[GOV_KEY])schedule(80);});
  document.addEventListener('niakgpt:server-projects-ready',()=>schedule(40));
  document.addEventListener('niakgpt:pins-rendered',event=>{if(Number(event.detail?.shown||0)>0){const box=document.getElementById('ng8-pins');if(box)box.removeAttribute('data-ng102-fallback');schedule(80);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(120);}});
  window.addEventListener('popstate',()=>setTimeout(()=>{bind();schedule(120);},80));

  bind();schedule(40);
})();
