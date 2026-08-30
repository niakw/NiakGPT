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
  const OWN='#ng8-pins,[data-ng121-retired="1"],#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb,#ng119-interruption';
  const PROJECT_RX=/\/g\/(g-p-[^/?#]+)(?:\/|$)/i;
  const QUEUE=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  const PRIMARY_PATH=/^(?:\/?$|\/new(?:\/|$)|\/search(?:\/|$)|\/library(?:\/|$)|\/images?(?:\/|$)|\/apps?(?:\/|$)|\/codex(?:\/|$))/i;
  const PRIMARY_LABEL=/^(?:chatgpt|nouveau chat|new chat|rechercher|search|bibliotheque|library|images?|apps?|codex)$/i;
  let cache={projects:[],chats:[],counts:{}},governance={hiddenProjectIds:[],coreProjectIds:[]};
  let observer=null,observedRoot=null,internal=false,timer=0,renderEpoch=0,lastPinFocus=null,lastPinFocusAt=0,bootstrapObserver=null,projectScrollMemory=0;
  let pendingProjectScroll=null,pendingScrollSeq=0,userScrollIntentAt=0,userScrollEpoch=0,retiredSeq=0;
  const sessionOrder=new Map(),mountParentByBox=new WeakMap(),mountTargetByBox=new WeakMap();let sessionSeq=0;

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
    const score=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(r.width<140||r.height<220||s.display==='none'||s.visibility==='hidden'||el.closest('[hidden],[inert],[aria-hidden="true"]'))return-Infinity;let n=0;if(el.matches('[data-testid="conversation-sidebar"]'))n+=50;if(el.querySelector('a[href*="/g/g-p-"]'))n+=20;if(el.querySelector('a[href*="/c/"]'))n+=10;if(r.left<innerWidth*.35&&r.width>150&&r.width<520)n+=10;const hit=document.elementFromPoint(Math.max(1,Math.min(innerWidth-2,r.left+Math.min(24,r.width/2))),Math.max(1,Math.min(innerHeight-2,r.top+Math.min(120,r.height/3))));if(hit&&el.contains(hit))n+=35;return n;};
    return candidates.map(el=>[el,score(el)]).filter(([,n])=>Number.isFinite(n)).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }
  function projectLinks(scope){return [...scope.querySelectorAll?.('a[href*="/g/g-p-"]')||[]].filter(a=>!isOwn(a));}
  function primaryControl(el){
    if(!(el instanceof Element)||isOwn(el)||!visiblePlacementNode(el))return false;
    const href=el.getAttribute?.('href')||'';
    if(href){
      let path=href;
      try{path=new URL(href,location.origin).pathname;}catch{}
      // An anchor's route is authoritative. Never reinterpret /c/... or /g/... as a primary
      // command merely because its visible title happens to be "Nouveau chat" / "ChatGPT".
      return PRIMARY_PATH.test(path);
    }
    const label=norm(el.getAttribute?.('aria-label')||el.getAttribute?.('data-testid')||el.textContent);
    return PRIMARY_LABEL.test(label)||/(?:^|[-_\s])(?:new[-_\s]?chat|nouveau[-_\s]?chat|sidebar[-_\s]?new)(?:$|[-_\s])/i.test(label);
  }
  function primaryControls(scope){return [...scope.querySelectorAll?.('a[href],button,[role="button"]')||[]].filter(primaryControl);}
  function hasPrimary(scope){return primaryControls(scope).length>0;}
  function nativeProjectSection(root=navRoot()){
    if(!root)return null;
    const box=document.getElementById('ng8-pins');
    const marked=[...root.querySelectorAll('[data-ng112-native-projects="1"]')].filter(el=>!box||!el.contains(box));
    const labels=[...root.querySelectorAll('h1,h2,h3,[role="heading"],span,div,button,a')].filter(el=>!isOwn(el)&&projectLabel(el.getAttribute?.('aria-label')||el.textContent));
    for(const seed of [...labels,...marked]){
      let node=seed,labelCandidate=null;
      const seedIsLabel=projectLabel(seed.getAttribute?.('aria-label')||seed.textContent);
      for(let depth=0;depth<7&&node&&node!==root&&node!==document.body;depth++,node=node.parentElement){
        const links=projectLinks(node),markedNode=node.getAttribute?.('data-ng112-native-projects')==='1';
        if(hasPrimary(node))continue;
        if(links.length||markedNode)return node;
        if(seedIsLabel&&!labelCandidate&&depth>0&&visiblePlacementNode(node)){
          const r=node.getBoundingClientRect();
          if(r.width>=120&&r.height>=18&&r.height<=260)labelCandidate=node;
        }
      }
      if(labelCandidate)return labelCandidate;
    }
    const link=projectLinks(root)[0];
    if(link){let node=link;for(let depth=0;depth<7&&node?.parentElement&&node.parentElement!==root;depth++,node=node.parentElement){const parent=node.parentElement;if(projectLinks(parent).length>=1&&!hasPrimary(parent))return parent;}}
    return null;
  }
  function primaryTail(root=navRoot()){
    if(!root)return null;let best=null,bestTop=-Infinity;
    for(const a of primaryControls(root)){
      const r=a.getBoundingClientRect();if(r.bottom>bestTop){best=a;bestTop=r.bottom;}
    }
    if(!best)return null;
    let node=best;
    while(node.parentElement&&node.parentElement!==root&&node.parentElement.getBoundingClientRect().width<520){
      const parent=node.parentElement;
      if(projectLinks(parent).length||[...parent.querySelectorAll?.('a[href*="/c/"]')||[]].some(a=>!isOwn(a)))break;
      node=parent;
    }
    return node;
  }
  function visiblePlacementNode(node){
    if(!(node instanceof Element)||!node.isConnected||node.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
    const s=getComputedStyle(node),r=node.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
  }
  function nativeSectionAfterPrimary(root,section,tail){
    if(!section?.parentElement||!visiblePlacementNode(section))return false;
    if(!tail||!visiblePlacementNode(tail))return true;
    const order=tail.compareDocumentPosition(section);
    if(!(order&Node.DOCUMENT_POSITION_FOLLOWING))return false;
    const sr=section.getBoundingClientRect(),tr=tail.getBoundingClientRect();
    return sr.top>=tr.bottom-4;
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
    const now=performance.now(),existing=activePendingScroll();
    // Coalesce a burst of cache/index events onto the first stable scroll anchor. Layout can move
    // scrollTop transiently while rows/drawers update; recapturing that transient value on every
    // event turns a few pixels of layout drift into a visible jump. Real user input clears the
    // pending anchor through noteUserScrollIntent(), so human scrolling always wins immediately.
    if(existing&&existing.userIntentEpoch===userScrollEpoch&&userScrollIntentAt<=existing.userIntentAt){
      document.documentElement.dataset.ng121ScrollGuard=`coalesced:${reason}:${Math.round(existing.top)}`;
      return existing;
    }
    const top=Math.min(max,Math.max(0,list.scrollTop));projectScrollMemory=top;
    const recentUser=now-userScrollIntentAt<600;
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
  function safeInsert(parent,node,before=null){
    if(!(parent instanceof Element)||!(node instanceof Element)||!parent.isConnected)return false;
    if(parent===node||node.contains(parent))return false;
    if(before){
      if(!(before instanceof Node)||before.parentNode!==parent||before===node||node.contains(before))return false;
    }
    try{parent.insertBefore(node,before);return true;}catch{return false;}
  }
  function placementTarget(root=navRoot(),box=null){
    if(!root||!root.isConnected||root.closest('[hidden],[inert],[aria-hidden="true"]')||box?.contains(root))return null;
    const tail=primaryTail(root),section=nativeProjectSection(root);
    if(nativeSectionAfterPrimary(root,section,tail)&&(!box||(!section.contains(box)&&!box.contains(section.parentElement)))){
      return{parent:section.parentElement,before:section,mode:'native-projects',legacy:'projects-slot-v121'};
    }
    if(tail?.parentElement&&(!box||(!tail.contains(box)&&!box.contains(tail.parentElement)))){
      return{parent:tail.parentElement,before:tail.nextSibling,mode:'after-primary',legacy:'after-primary-v121'};
    }
    // Never mount at a generic sidebar tail while ChatGPT is still hydrating. That fallback
    // can become the visual top of the sidebar once native controls are inserted later.
    return null;
  }
  function placementSatisfied(box,target){
    if(!box?.isConnected||!target||box.parentElement!==target.parent)return false;
    if(target.before===box)return true; // already immediately after the selected primary tail
    return box.nextSibling===target.before;
  }
  function originalPlacementStillSafe(root,box,ideal=null){
    const original=mountTargetByBox.get(box);
    if(!root||!box?.isConnected||!original||box.parentElement!==original.parent)return false;
    // A genuine late native Projects section is an authority upgrade, not an equivalent
    // reclassification: a catalogue originally mounted after primary controls must remount once
    // before that newly arrived native section.
    if(original.mode==='after-primary'&&ideal?.mode==='native-projects'&&ideal.before!==original.before)return false;
    const anchorIntact=original.before?original.before.isConnected&&original.before.parentElement===original.parent&&box.nextSibling===original.before:box.nextSibling===null;
    if(!anchorIntact)return false;
    const tail=primaryTail(root);
    if(!tail?.isConnected)return false;
    const order=tail.compareDocumentPosition(box);
    if(!(order&Node.DOCUMENT_POSITION_FOLLOWING))return false;
    const tr=tail.getBoundingClientRect(),br=box.getBoundingClientRect();
    return br.top>=tr.bottom-4;
  }
  function retireStaleBox(box){
    if(!box||!box.isConnected||box.dataset.ng121Retired==='1')return;
    // Capture the live scroll synchronously before retirement. A React/sidebar remount can land
    // between a human wheel gesture and the browser's later scroll event; relying only on that
    // event loses the position and makes the fresh catalogue jump back to the top.
    const liveList=box.querySelector(':scope>.ng8-pin-list');
    if(liveList instanceof HTMLElement){
      const max=Math.max(0,liveList.scrollHeight-liveList.clientHeight);
      if(max>0)projectScrollMemory=Math.min(max,Math.max(0,liveList.scrollTop));
    }
    box.dataset.ng121Retired='1';box.hidden=true;box.setAttribute('aria-hidden','true');box.style.setProperty('pointer-events','none','important');
    box.id='ng8-pins-retired-'+(++retiredSeq);
  }
  function place(box){
    const root=navRoot();if(!root||!box||!box.isConnected||!root.contains(box))return false;
    const target=placementTarget(root,box);
    if(target&&box.parentElement===target.parent&&box.nextSibling===target.before){
      box.dataset.ng121Placement=target.mode;box.dataset.ng119Placement=target.legacy;
    }else if(!box.dataset.ng121Placement){
      box.dataset.ng121Placement='stable-once';box.dataset.ng119Placement='stable-once-v121';
    }
    const list=box.querySelector(':scope>.ng8-pin-list'),pending=activePendingScroll();
    if(list&&pending){
      const scrollBefore=pending.top,placeIntentEpoch=userScrollEpoch,pendingSeq=pending.seq;
      restoreProjectScroll(list,scrollBefore);
      requestAnimationFrame(()=>{
        if(!box.isConnected||!list.isConnected||userScrollEpoch!==placeIntentEpoch)return;
        const current=activePendingScroll();if(!current||current.seq!==pendingSeq)return;
        restoreProjectScroll(list,scrollBefore);
      });
    }
    box.hidden=false;box.removeAttribute('aria-hidden');box.dataset.ng121PlacementReady='1';box.dataset.ng121MountPolicy='direct-once';document.documentElement.dataset.ng121PinsReady='1';document.documentElement.dataset.ng119PinsReady='1';restoreFocusedPin(box,false);return true;
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
        if(host.parentElement!==list||host!==desired){if(safeInsert(list,host,desired))structural=true;}
        if(pair.drawer?.isConnected){if(pair.drawer.parentElement!==list||host.nextSibling!==pair.drawer){if(safeInsert(list,pair.drawer,host.nextSibling))structural=true;}cursor=pair.drawer;}else cursor=host;
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
  function ensureBox(){
    const root=navRoot();if(!root)return null;
    let box=document.getElementById('ng8-pins');
    const mountedParent=box?mountParentByBox.get(box):null;
    if(box?.isConnected&&(!root.contains(box)||(mountedParent&&box.parentElement!==mountedParent))){
      retireStaleBox(box);box=null;
    }
    if(box?.dataset.ng121Retired==='1')box=null;
    if(box?.isConnected){
      const ideal=placementTarget(root,box);
      if(ideal&&!placementSatisfied(box,ideal)&&!originalPlacementStillSafe(root,box,ideal)){
        // Preserve the direct-once invariant: never reparent the same React-adjacent node.
        // Retire only for a genuinely new/invalid slot. Equivalent authority reclassification
        // must not rebuild a stable catalogue whose original anchor is still intact below primary nav.
        retireStaleBox(box);box=null;
      }
    }
    if(!box){
      const target=placementTarget(root,null);if(!target)return null;
      box=document.createElement('section');box.id='ng8-pins';box.hidden=true;box.dataset.ng121MountPolicy='direct-once';
      if(!safeInsert(target.parent,box,target.before))return null;
      mountParentByBox.set(box,target.parent);mountTargetByBox.set(box,{parent:target.parent,before:target.before,mode:target.mode});
      box.dataset.ng121Placement=target.mode;box.dataset.ng119Placement=target.legacy;box.dataset.ng121MountCount='1';
    }else if(!mountedParent&&box.parentElement){
      mountParentByBox.set(box,box.parentElement);
      mountTargetByBox.set(box,{parent:box.parentElement,before:box.nextSibling,mode:box.dataset.ng121Placement||'stable-once'});
    }
    return box;
  }
  function hideWelcome(){
    const main=document.querySelector('main,[role="main"]');if(!main||main.querySelector('[data-message-author-role]'))return;
    const rx=/^(?:bonjour|bonsoir|salut|hello|hi)(?:\s+[\p{L}\p{N}._'-]{1,40})?[!,.? ]*$|^(?:par quoi commençons-nous|comment puis-je vous aider|que puis-je faire pour vous|qu[’']est-ce qu[’']on fait|how can i help|what can i help with|what(?:'|’)s on your mind)[?!. ]*$/iu;
    for(const el of main.querySelectorAll('h1,h2,[role="heading"],[data-testid*="welcome" i]')){const text=clean(el.textContent);if(text&&text.length<=140&&rx.test(text))el.classList.add('ng119-native-home-greeting');}
  }
  function reconcile(){clearTimeout(timer);timer=0;if(internal)return;const box=ensureBox();if(!box){bind();return;}renderCatalog(box);place(box);restorePendingScroll('reconcile');bind();hideWelcome();window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-ux-119',`OK · Projects ${box.dataset.ng121Placement||'stable'} · autorité v121 unique`);}
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(reconcile,delay);}
  function placementSignal(node){
    if(!(node instanceof Element))return false;
    if(node.matches?.('a[href*="/g/g-p-"],[data-ng112-native-projects]'))return true;
    if(primaryControl(node))return true;
    if([...node.querySelectorAll?.('a[href],button,[role="button"]')||[]].some(primaryControl))return true;
    return !!node.querySelector?.('a[href*="/g/g-p-"],[data-ng112-native-projects]');
  }
  function relevant(records){for(const r of records){for(const n of [...r.addedNodes,...r.removedNodes]){if(!(n instanceof Element))continue;if(n.id==='ng8-pins'||n.querySelector?.('#ng8-pins')||placementSignal(n))return true;}}return false;}
  function bind(){
    const root=navRoot();if(!root){armBootstrap();return;}if(root===observedRoot&&observer)return;
    observer?.disconnect();observedRoot=root;observer=new MutationObserver(records=>{
      if(internal||!relevant(records))return;
      // Let React/ChatGPT finish the current mutation batch before reconciling. Chromium usually
      // settles in the same turn, while Firefox/WebKit can expose a transient parent/slot for a
      // few frames. A bounded verification pass repairs external displacement without polling.
      // Repair in the MutationObserver microtask, before the next paint, so an externally
      // displaced catalogue never produces a visible bad frame. Keep the bounded delayed check
      // as a second chance for React/browser trees that expose a transient slot in this microtask.
      reconcile();
      setTimeout(()=>{
        const liveRoot=navRoot(),box=document.getElementById('ng8-pins');
        if(!liveRoot)return;
        const target=box?.isConnected&&liveRoot.contains(box)?placementTarget(liveRoot,box):null;
        if(!box||!liveRoot.contains(box)||(target&&!placementSatisfied(box,target)))schedule(0);
      },180);
    });observer.observe(root,{childList:true,subtree:true});
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
