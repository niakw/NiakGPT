(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_PROJECTS_121__)return;
  window.__NIAKGPT_SIDEBAR_PROJECTS_121__=true;
  // v121 owns Projects placement. The legacy v119 file stays packaged for rollback/static
  // compatibility but is intentionally prevented from registering a second authority.
  // Static rollback markers retained deliberately: data-ng121-catalog · projects.map(row).join
  // The live implementation below is incremental instead of using the old destructive map/join.
  window.__NIAKGPT_SIDEBAR_UX_119__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const PROJECT_RX=/\/g\/(g-p-[^/?#]+)(?:\/|$)/i;
  const QUEUE=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  const PRIMARY_PATH=/^(?:\/?$|\/new(?:\/|$)|\/search(?:\/|$)|\/library(?:\/|$)|\/images?(?:\/|$)|\/apps?(?:\/|$)|\/codex(?:\/|$))/i;
  let cache={projects:[],chats:[],counts:{}},governance={hiddenProjectIds:[],coreProjectIds:[]};
  let observer=null,observedRoot=null,internal=false,timer=0,renderEpoch=0,lastPinFocus=null,lastPinFocusAt=0,bootstrapObserver=null,projectScrollMemory=0;
  let pendingProjectScroll=null,pendingScrollSeq=0,userScrollIntentAt=0,userScrollEpoch=0;
  const sessionOrder=new Map();let sessionSeq=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const normalizePid=v=>{const s=clean(v),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const pidFromHref=h=>normalizePid(String(h||'').match(PROJECT_RX)?.[1]||'');
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const colorFor=name=>{const colors=['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185','#38BDF8','#34D399','#F59E0B'];let h=0;for(const c of String(name))h=((h<<5)-h+c.charCodeAt(0))|0;return colors[Math.abs(h)%colors.length];};
  const iconFor=name=>{const s=norm(name);if(/code|dev|tech|web|api|github|program|provider/.test(s))return'</>';if(/legal|jurid|droit|prud|tribunal|justice/.test(s))return'§';if(/finance|argent|budget|banque|credit|compta/.test(s))return'€';if(/film|cinema|movie|serie|anime|video/.test(s))return'▶';if(/design|logo|image|creative|graph/.test(s))return'◇';if(/shop|commerce|store|product|produit|vente/.test(s))return'▣';if(/(^|\s)(ai|ia|gpt)(\s|$)/.test(s))return'✦';if(/auto|car|voiture|vehicule/.test(s))return'◈';if(/health|sante|medical/.test(s))return'+';if(/game|gaming|jeu/.test(s))return'◆';return'▤';};
  const isOwn=el=>!!el?.closest?.(OWN);
  const projectLabel=v=>/^(projets?|projects?)$/i.test(clean(v));
  function managedHref(raw,id){
    const fallback=`/g/${id}/project`;
    try{
      const u=new URL(String(raw||fallback),location.origin);
      const path=/^\/g\/g-p-[^/]+\/project\/?$/i.test(u.pathname)?`${u.pathname}${u.search}${u.hash}`:fallback;
      // Absolute href is deliberate: app-v090's legacy observer watches only
      // a[href^="/g/g-p-"]; managed v121 writes must not re-trigger that renderer.
      return new URL(path,location.origin).href;
    }catch{return `${location.origin}${fallback}`;}
  }

  function navRoot(){
    const guarded=window.__NIAKGPT_FIND_SIDEBAR_V131__?.();if(guarded?.isConnected)return guarded;
    const candidates=[...document.querySelectorAll('[data-testid="conversation-sidebar"],[data-testid*="sidebar" i],aside,nav')].filter(el=>!el.closest('main,[role="main"]'));
    const score=el=>{let n=0;if(el.matches('[data-testid="conversation-sidebar"]'))n+=40;if(el.querySelector('#ng8-pins'))n+=30;if(el.querySelector('a[href*="/g/g-p-"]'))n+=20;if(el.querySelector('a[href*="/c/"]'))n+=10;const r=el.getBoundingClientRect();if(r.left<innerWidth*.35&&r.width>150&&r.width<520)n+=8;return n;};
    return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function projectLinks(scope){return [...scope.querySelectorAll?.('a[href*="/g/g-p-"]')||[]].filter(a=>!isOwn(a));}
  function hasPrimary(scope){return [...scope.querySelectorAll?.('a[href]')||[]].some(a=>PRIMARY_PATH.test(a.getAttribute('href')||''));}
  function nativeProjectSection(){
    const root=navRoot();if(!root)return null;
    const box=document.getElementById('ng8-pins');
    const marked=[...root.querySelectorAll('[data-ng112-native-projects="1"]')].filter(el=>!el.contains(box));
    const labels=[...root.querySelectorAll('h1,h2,h3,[role="heading"],span,div,button,a')].filter(el=>!isOwn(el)&&projectLabel(el.getAttribute?.('aria-label')||el.textContent));
    for(const seed of [...labels,...marked]){
      let node=seed;
      for(let depth=0;depth<7&&node&&node!==root&&node!==document.body;depth++,node=node.parentElement){
        const links=projectLinks(node);if(!links.length&&node.getAttribute?.('data-ng112-native-projects')!=='1')continue;
        if(hasPrimary(node))continue;
        return node;
      }
    }
    const link=projectLinks(root)[0];
    if(link){let node=link;for(let depth=0;depth<7&&node?.parentElement&&node.parentElement!==root;depth++,node=node.parentElement){const parent=node.parentElement;if(projectLinks(parent).length>=1&&!hasPrimary(parent))return parent;}}
    return null;
  }
  function primaryTail(){
    const root=navRoot();if(!root)return null;let best=null,bestTop=-Infinity;
    for(const a of root.querySelectorAll('a[href]')){
      if(isOwn(a)||!PRIMARY_PATH.test(a.getAttribute('href')||''))continue;const r=a.getBoundingClientRect();if(r.bottom>bestTop){best=a;bestTop=r.bottom;}
    }
    if(!best)return null;let node=best;while(node.parentElement&&node.parentElement!==root&&node.parentElement.getBoundingClientRect().width<520)node=node.parentElement;return node;
  }
  function restoreFocusedPin(box,moved){
    if(!moved||!(lastPinFocus instanceof HTMLElement)||!lastPinFocus.isConnected||!box.contains(lastPinFocus))return;
    if(performance.now()-lastPinFocusAt>1600||document.activeElement===lastPinFocus)return;
    try{lastPinFocus.focus({preventScroll:true});}catch{try{lastPinFocus.focus();}catch{}}
  }
  function restoreProjectScroll(list,value){
    if(!list||!Number.isFinite(value))return;
    const max=Math.max(0,list.scrollHeight-list.clientHeight),wanted=Math.min(Math.max(0,value),max);
    if(Math.abs(list.scrollTop-wanted)>1)list.scrollTop=wanted;
    projectScrollMemory=list.scrollTop;
  }
  function activePendingScroll(){
    const p=pendingProjectScroll;
    if(!p||performance.now()>p.until){pendingProjectScroll=null;return null;}
    return p;
  }
  function noteUserScrollIntent(){
    userScrollIntentAt=performance.now();userScrollEpoch++;pendingProjectScroll=null;pendingScrollSeq++;
    document.documentElement.dataset.ng121ScrollGuard='user-input';
  }
  function captureProjectScroll(reason='cache'){
    const list=document.querySelector('#ng8-pins>.ng8-pin-list');if(!(list instanceof HTMLElement))return null;
    const max=Math.max(0,list.scrollHeight-list.clientHeight);if(max<=0)return null;
    const top=Math.min(max,Math.max(0,list.scrollTop));projectScrollMemory=top;
    const now=performance.now(),recentUser=now-userScrollIntentAt<600;
    if(recentUser){
      // A reconcile may arrive in the same task as wheel/touch/key input, before the browser has
      // applied the user's new scroll position. Never arm the pre-input top. Bind a deferred
      // snapshot to the user-intent epoch and read the live position after layout instead.
      const intentEpoch=userScrollEpoch,seq=++pendingScrollSeq;
      document.documentElement.dataset.ng121ScrollGuard=`user-priority-pending:${Math.round(top)}`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(intentEpoch!==userScrollEpoch||seq!==pendingScrollSeq)return;
        const live=document.querySelector('#ng8-pins>.ng8-pin-list');if(!(live instanceof HTMLElement))return;
        const liveMax=Math.max(0,live.scrollHeight-live.clientHeight);if(liveMax<=0)return;
        const liveTop=Math.min(liveMax,Math.max(0,live.scrollTop)),armedAt=performance.now();
        projectScrollMemory=liveTop;
        pendingProjectScroll={
          top:liveTop,max:liveMax,
          reason:'user-priority:'+reason,
          seq,at:armedAt,until:armedAt+900,
          userIntentAt:userScrollIntentAt,userIntentEpoch:intentEpoch
        };
        document.documentElement.dataset.ng121ScrollGuard=`user-priority-armed:${Math.round(liveTop)}`;
        settlePendingScroll('user-priority');
      }));
      return null;
    }
    const seq=++pendingScrollSeq;
    pendingProjectScroll={
      top,max,reason,seq,at:now,until:now+1200,
      userIntentAt:userScrollIntentAt,userIntentEpoch:userScrollEpoch
    };
    document.documentElement.dataset.ng121ScrollGuard=`armed:${Math.round(top)}`;
    return pendingProjectScroll;
  }

  function restorePendingScroll(source='reconcile'){
    const p=activePendingScroll(),list=document.querySelector('#ng8-pins>.ng8-pin-list');if(!p||!(list instanceof HTMLElement))return false;
    if(userScrollIntentAt>p.userIntentAt||userScrollEpoch!==p.userIntentEpoch){pendingProjectScroll=null;return false;}
    restoreProjectScroll(list,p.top);document.documentElement.dataset.ng121ScrollGuard=`${source}:${Math.round(list.scrollTop)}`;return true;
  }
  function settlePendingScroll(source='reconcile'){
    const p=activePendingScroll();if(!p)return;
    const seq=p.seq;
    const apply=()=>{const current=activePendingScroll();if(!current||current.seq!==seq)return;restorePendingScroll(source);};
    apply();requestAnimationFrame(()=>{apply();requestAnimationFrame(apply);});
    for(const delay of[40,120,260,520,900])setTimeout(apply,delay);
  }
  function place(box){
    const root=navRoot();if(!root||!box)return false;let moved=false;
    const list=box.querySelector(':scope>.ng8-pin-list'),pending=activePendingScroll(),scrollBefore=pending?.top??(list?list.scrollTop:projectScrollMemory);
    const section=nativeProjectSection();
    if(section?.parentElement){
      if(box.parentElement!==section.parentElement||box.nextElementSibling!==section){section.parentElement.insertBefore(box,section);moved=true;}
      box.dataset.ng121Placement='native-projects';box.dataset.ng119Placement='projects-slot-v121';
    }else{
      const tail=primaryTail();
      if(tail?.parentElement){if(box.parentElement!==tail.parentElement||tail.nextElementSibling!==box){tail.insertAdjacentElement('afterend',box);moved=true;}box.dataset.ng121Placement='after-primary';box.dataset.ng119Placement='after-primary-v121';}
      else if(box.parentElement!==root){root.appendChild(box);moved=true;box.dataset.ng121Placement='sidebar-tail';box.dataset.ng119Placement='sidebar-tail-v121';}
    }
    if(list&&(moved||pending)){restoreProjectScroll(list,scrollBefore);requestAnimationFrame(()=>{if(box.isConnected&&list.isConnected)restoreProjectScroll(list,scrollBefore);});}
    box.hidden=false;box.removeAttribute('aria-hidden');box.dataset.ng121PlacementReady='1';document.documentElement.dataset.ng121PinsReady='1';document.documentElement.dataset.ng119PinsReady='1';restoreFocusedPin(box,moved);return true;
  }

  function canonicalProjects(){
    const hidden=new Set((governance.hiddenProjectIds||[]).map(normalizePid)),core=new Set((governance.coreProjectIds||[]).map(normalizePid)),map=new Map();
    for(const raw of cache.projects||[]){
      const id=normalizePid(raw?.id),name=clean(raw?.name);if(!id.startsWith('g-p-')||!name||QUEUE.has(norm(name))||hidden.has(id))continue;
      const old=map.get(id)||{},href=managedHref(raw?.href||old.href,id);
      map.set(id,{...old,...raw,id,name,href,color:raw.color||old.color||colorFor(name),icon:raw.icon||old.icon||iconFor(name)});
    }
    const coreOrder=new Map((governance.coreProjectIds||[]).map((id,index)=>[normalizePid(id),index]));
    for(const id of map.keys())if(!sessionOrder.has(id))sessionOrder.set(id,++sessionSeq);
    return [...map.values()].sort((a,b)=>{
      const ac=core.has(a.id),bc=core.has(b.id);if(ac!==bc)return ac?-1:1;
      if(ac&&bc)return (coreOrder.get(a.id)??9999)-(coreOrder.get(b.id)??9999)||a.name.localeCompare(b.name,'fr');
      return (sessionOrder.get(a.id)||0)-(sessionOrder.get(b.id)||0)||a.name.localeCompare(b.name,'fr');
    });
  }
  function projectMeta(id){
    let latest=0,count=0;for(const c of cache.chats||[])if(normalizePid(c?.projectId)===id){count++;latest=Math.max(latest,parseTime(c.updated||c.update_time||c.create_time));}
    const direct=Object.entries(cache.counts||{}).find(([key])=>normalizePid(key)===id)?.[1];if(Number.isFinite(Number(direct)))count=Math.max(count,Number(direct));
    const date=latest?`${String(new Date(latest).getDate()).padStart(2,'0')}/${String(new Date(latest).getMonth()+1).padStart(2,'0')}`:'—';return{text:`${date}  [${count}]`};
  }
  function catalogSignature(projects){return JSON.stringify(projects.map(p=>[p.id,p.name,p.href,p.color,p.icon]));}
  function anchorPid(a){return normalizePid(a?.dataset?.ng121Pid||pidFromHref(a?.getAttribute?.('href')));}
  function hostFor(a){const row=a?.closest?.('.ng96-pin-entry');return row&&row.closest('#ng8-pins')?row:a;}
  function drawerFor(host,pid){const next=host?.nextElementSibling;return next?.classList?.contains('ng96-pin-drawer')&&normalizePid(next.dataset.pid)===pid?next:null;}
  function makeAnchor(p){
    const a=document.createElement('a');a.dataset.ng8Pin='1';a.dataset.ng121Pid=p.id;a.href=p.href;a.style.setProperty('--ng-project',p.color);
    const icon=document.createElement('i');icon.textContent=p.icon;const label=document.createElement('span');label.textContent=p.name;const meta=document.createElement('small');meta.className='ng8-project-meta';meta.textContent=projectMeta(p.id).text;
    a.append(icon,label,meta);return a;
  }
  function updateAnchor(a,p){
    a.dataset.ng8Pin='1';a.dataset.ng121Pid=p.id;if(a.getAttribute('href')!==p.href)a.setAttribute('href',p.href);a.style.setProperty('--ng-project',p.color);
    let icon=a.querySelector(':scope>i');if(!icon){icon=document.createElement('i');a.prepend(icon);}if(icon.textContent!==p.icon)icon.textContent=p.icon;
    let label=a.querySelector(':scope>span:not(.ng113-dots)');if(!label){label=document.createElement('span');icon.insertAdjacentElement('afterend',label);}if(label.textContent!==p.name)label.textContent=p.name;
    let meta=a.querySelector(':scope>small.ng8-project-meta');if(!meta){meta=document.createElement('small');meta.className='ng8-project-meta';a.appendChild(meta);}const text=projectMeta(p.id).text;if(meta.textContent!==text)meta.textContent=text;
  }
  function ensureStructure(box){
    let head=box.querySelector(':scope>.ng8-pin-head');if(!head){head=document.createElement('div');head.className='ng8-pin-head';head.dataset.ng121Catalog='1';head.innerHTML='<span>PROJECTS</span><b>0</b>';box.prepend(head);}else{head.dataset.ng121Catalog='1';if(!head.querySelector(':scope>b')){const b=document.createElement('b');head.appendChild(b);}}
    let list=box.querySelector(':scope>.ng8-pin-list');if(!list){list=document.createElement('div');list.className='ng8-pin-list';head.insertAdjacentElement('afterend',list);}
    for(const extra of box.querySelectorAll(':scope>.ng90-project-extras'))extra.remove();
    return{head,list};
  }
  function renderCatalog(box){
    const projects=canonicalProjects(),wanted=new Set(projects.map(p=>p.id)),sig=catalogSignature(projects);let structural=false;
    const listBefore=box.querySelector(':scope>.ng8-pin-list'),pending=activePendingScroll(),projectScroll=pending?.top??(listBefore?listBefore.scrollTop:projectScrollMemory);
    const drawerScroll=new Map([...box.querySelectorAll('.ng96-pin-drawer')].map(d=>[normalizePid(d.dataset.pid),d.querySelector('.ng96-folder-list')?.scrollTop||0]));
    internal=true;const epoch=++renderEpoch;
    try{
      const {head,list}=ensureStructure(box),existing=new Map();
      for(const a of box.querySelectorAll('a[data-ng8-pin="1"]')){const id=anchorPid(a);if(id&&!existing.has(id))existing.set(id,a);}
      const pairs=[];
      for(const p of projects){
        let a=existing.get(p.id);if(!a){a=makeAnchor(p);structural=true;}else updateAnchor(a,p);
        const host=hostFor(a),drawer=host?.isConnected?drawerFor(host,p.id):null;pairs.push({p,a,host,drawer});
      }
      for(const [id,a] of existing){
        if(wanted.has(id))continue;const host=hostFor(a),drawer=drawerFor(host,id);drawer?.remove();host?.remove();structural=true;
      }
      let cursor=null;
      for(const pair of pairs){
        let host=pair.host;
        if(!host?.isConnected||host.closest('#ng8-pins')!==box)host=pair.a;
        const desired=cursor?cursor.nextSibling:list.firstChild;
        if(host.parentElement!==list||host!==desired){list.insertBefore(host,desired);structural=true;}
        if(pair.drawer?.isConnected){if(pair.drawer.parentElement!==list||host.nextSibling!==pair.drawer){list.insertBefore(pair.drawer,host.nextSibling);structural=true;}cursor=pair.drawer;}else cursor=host;
      }
      const count=head.querySelector(':scope>b');if(count&&count.textContent!==String(projects.length))count.textContent=String(projects.length);
      box.dataset.ng121CatalogSig=sig;box.dataset.ng121CatalogCount=String(projects.length);box.dataset.ng121IdentityStable='1';
      restoreProjectScroll(list,projectScroll);
      for(const d of box.querySelectorAll('.ng96-pin-drawer')){const sc=d.querySelector('.ng96-folder-list'),old=drawerScroll.get(normalizePid(d.dataset.pid));if(sc&&Number.isFinite(old)&&sc.scrollTop!==old)sc.scrollTop=old;}
      // Do not clear app-v090's data-ng8-signature. Clearing it caused repeated destructive
      // legacy rebuilds and disconnected action buttons during user clicks.
    }finally{queueMicrotask(()=>{if(renderEpoch===epoch)internal=false;});}
    if(structural)document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:projects.length,shown:projects.length,source:'sidebar-projects-v121'}}));
    if(pending)settlePendingScroll('catalog');
    window.__NIAKGPT_DIAGNOSTICS__?.set('pins-ui',`OK · ${projects.length}/${projects.length} Projects NiakGPT · catalogue complet · nœuds stables · boucle legacy cassée`);
    return projects.length;
  }
  function ensureBox(){const root=navRoot();if(!root)return null;let box=document.getElementById('ng8-pins');if(!box){box=document.createElement('section');box.id='ng8-pins';box.hidden=true;root.appendChild(box);}return box;}
  function hideWelcome(){
    const main=document.querySelector('main,[role="main"]');if(!main||main.querySelector('[data-message-author-role]'))return;
    const rx=/^(?:bonjour|bonsoir|salut|hello|hi)(?:\s+[\p{L}\p{N}._'-]{1,40})?[!,.? ]*$|^(?:par quoi commençons-nous|comment puis-je vous aider|que puis-je faire pour vous|qu[’']est-ce qu[’']on fait|how can i help|what can i help with|what(?:'|’)s on your mind)[?!. ]*$/iu;
    for(const el of main.querySelectorAll('h1,h2,[role="heading"],[data-testid*="welcome" i]')){const text=clean(el.textContent);if(text&&text.length<=140&&rx.test(text))el.classList.add('ng119-native-home-greeting');}
  }
  function reconcile(){clearTimeout(timer);timer=0;if(internal)return;const box=ensureBox();if(!box){bind();return;}renderCatalog(box);place(box);restorePendingScroll('reconcile');bind();hideWelcome();window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-ux-119',`OK · Projects ${box.dataset.ng121Placement||'stable'} · autorité v121 unique`);}
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(reconcile,delay);}
  function relevant(records){for(const r of records){for(const n of [...r.addedNodes,...r.removedNodes]){if(!(n instanceof Element))continue;if(n.id==='ng8-pins'||n.querySelector?.('#ng8-pins')||n.matches?.('a[href*="/g/g-p-"],[data-ng112-native-projects]')||n.querySelector?.('a[href*="/g/g-p-"],[data-ng112-native-projects]'))return true;}}return false;}
  function bind(){
    const root=navRoot();if(!root){armBootstrap();return;}if(root===observedRoot&&observer)return;
    observer?.disconnect();observedRoot=root;observer=new MutationObserver(records=>{if(internal)return;if(relevant(records))reconcile();});observer.observe(root,{childList:true,subtree:true});
    if(root.parentElement)observer.observe(root.parentElement,{childList:true,subtree:false});
    bootstrapObserver?.disconnect();bootstrapObserver=null;
  }
  function armBootstrap(){
    if(bootstrapObserver)return;bootstrapObserver=new MutationObserver(()=>{if(navRoot()){bootstrapObserver?.disconnect();bootstrapObserver=null;reconcile();}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;if(!navRoot())window.__NIAKGPT_DIAGNOSTICS__?.set('pins-ui','ATTENTE · sidebar ChatGPT non montée');},30000);
  }
  async function load(){
    try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);cache=raw[CACHE_KEY]||cache;governance={...governance,...(raw[GOV_KEY]||{})};}catch{}
    const bus=window.__NIAKGPT_CACHE_BUS__;if(bus){try{const raw=await bus.get();if(raw)cache=raw;}catch{}try{bus.subscribe(raw=>{if(raw&&typeof raw==='object'){captureProjectScroll('cache-bus');cache=raw;schedule(0);}});}catch{}}
    reconcile();
  }

  document.addEventListener('wheel',event=>{if(event.target instanceof Element&&event.target.closest('#ng8-pins>.ng8-pin-list'))noteUserScrollIntent();},{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{if(event.target instanceof Element&&event.target.closest('#ng8-pins>.ng8-pin-list'))noteUserScrollIntent();},{capture:true,passive:true});
  document.addEventListener('keydown',event=>{if(event.target instanceof Element&&event.target.closest('#ng8-pins>.ng8-pin-list')&&/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key))noteUserScrollIntent();},true);
  document.addEventListener('scroll',event=>{const target=event.target instanceof Element?event.target:null;if(target?.matches?.('#ng8-pins>.ng8-pin-list')){projectScrollMemory=target.scrollTop;const p=activePendingScroll(),recentIntent=performance.now()-userScrollIntentAt<500;if(p&&(userScrollEpoch!==p.userIntentEpoch||userScrollIntentAt>p.userIntentAt||(recentIntent&&Math.abs(target.scrollTop-p.top)>2)))pendingProjectScroll=null;}},true);
  document.addEventListener('focusin',event=>{const target=event.target instanceof HTMLElement?event.target:null;if(target?.closest('#ng8-pins')){lastPinFocus=target;lastPinFocusAt=performance.now();}else if(target&&target!==document.body&&target!==document.documentElement){lastPinFocus=null;lastPinFocusAt=0;}},true);
  document.addEventListener('focusout',event=>{const target=event.target instanceof HTMLElement?event.target:null;if(target?.closest('#ng8-pins')&&(!event.relatedTarget||event.relatedTarget===document.body||event.relatedTarget===document.documentElement)){lastPinFocus=target;lastPinFocusAt=performance.now();}},true);
  document.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const a=event.target instanceof Element?event.target.closest('#ng8-pins a[data-ng8-pin="1"]'):null;if(a)event.preventDefault();},true);
  document.addEventListener('auxclick',event=>{const a=event.target instanceof Element?event.target.closest('#ng8-pins a[data-ng8-pin="1"]'):null;if(a)event.preventDefault();},true);
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[CACHE_KEY]||changes[GOV_KEY])captureProjectScroll('storage');if(changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;if(changes[GOV_KEY])governance={...governance,...(changes[GOV_KEY].newValue||{})};if(changes[CACHE_KEY]||changes[GOV_KEY]){schedule(0);settlePendingScroll('storage');}});}catch{}
  document.addEventListener('niakgpt:server-projects-ready',()=>{captureProjectScroll('server-projects');schedule(0);});document.addEventListener('niakgpt:server-indexed',()=>{captureProjectScroll('server-index');schedule(0);});document.addEventListener('niakgpt:recovery-complete',()=>{captureProjectScroll('recovery');schedule(0);});document.addEventListener('niakgpt:sidebar-projects-reconcile',()=>{captureProjectScroll('reconcile-event');schedule(0);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();schedule(0);}});window.addEventListener('popstate',()=>schedule(0));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));
  window.addEventListener('pageshow',()=>{bind();schedule(0);});
  window.addEventListener('pagehide',()=>{observer?.disconnect();observer=null;observedRoot=null;bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(timer);pendingProjectScroll=null;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
