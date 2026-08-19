(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_LIVE_AUTHORITY_121__)return;
  window.__NIAKGPT_SIDEBAR_LIVE_AUTHORITY_121__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const OPEN_KEY='niakgpt-open-pin-folder-v096';
  const QUEUE=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  let cache={projects:[],chats:[],counts:{}},gov={coreProjectIds:[],hiddenProjectIds:[]};
  let observer=null,root=null,scheduled=false,internal=false;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const isProject=p=>!!p&&String(p.id||'').startsWith('g-p-')&&!p.domOnly&&!p.duplicateOf&&!QUEUE.has(norm(p.name));

  function navRoot(){
    const candidates=[...document.querySelectorAll('[data-testid="conversation-sidebar"],[data-testid*="sidebar" i],aside,nav')].filter(el=>!el.closest('main,[role="main"]'));
    let best=null,score=-1;
    for(const el of candidates){
      const r=el.getBoundingClientRect(),s=(el.matches('[data-testid="conversation-sidebar"]')?50:0)+(el.matches('[data-testid*="sidebar" i]')?25:0)+(el.querySelector('#ng8-pins')?25:0)+(r.width>150&&r.width<520&&r.left<innerWidth*.35?10:0);
      if(s>score){score=s;best=el;}
    }
    return best;
  }
  function top(root,node){if(!root||!node)return null;let n=node;while(n.parentElement&&n.parentElement!==root)n=n.parentElement;return n.parentElement===root?n:null;}
  function primaryTail(root){
    if(!root)return null;
    const direct=[...root.children].filter(el=>el.id!=='ng8-pins'&&el.getAttribute('data-ng112-native-projects')!=='1');
    let best=null,bestIndex=-1;
    direct.forEach((child,index)=>{
      const text=clean(`${child.getAttribute('aria-label')||''} ${child.textContent||''}`);
      const links=[...child.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')||'');
      const looksPrimary=links.some(h=>/^\/(?:$|new(?:\/|$)|search(?:\/|$)|library(?:\/|$)|images?(?:\/|$)|apps?(?:\/|$)|codex(?:\/|$)|projects(?:\/|$))/i.test(h))||/(nouveau chat|new chat|bibliothèque|library|planification|planning|plugins?|plus|more)/i.test(text);
      if(looksPrimary&&index>bestIndex){best=child;bestIndex=index;}
    });
    return best;
  }
  function stablePlace(box){
    const r=navRoot();if(!r||!box)return false;root=r;
    const tail=primaryTail(r);
    if(tail){
      if(box.parentElement!==r||tail.nextElementSibling!==box)tail.insertAdjacentElement('afterend',box);
      box.dataset.ng119Placement='projects-slot';box.dataset.ng121Placement='after-primary';
    }else if(box.parentElement!==r){
      // Never jump to the top when ChatGPT temporarily virtualizes all anchors.
      r.appendChild(box);box.dataset.ng121Placement='sidebar-tail';
    }
    box.hidden=false;box.removeAttribute('aria-hidden');
    document.documentElement.dataset.ng121PinsReady='1';
    return true;
  }
  function recency(projectId){let t=0;for(const c of cache.chats||[])if(c?.projectId===projectId)t=Math.max(t,parseTime(c.updated||c.update_time||c.create_time));return t;}
  function count(projectId){const n=Number(cache.counts?.[projectId]);return Number.isFinite(n)?n:(cache.chats||[]).filter(c=>c?.projectId===projectId).length;}
  function date(ms){if(!ms)return'—';const d=new Date(ms),now=new Date();if(Number.isNaN(d.getTime()))return'—';const dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0');return d.getFullYear()===now.getFullYear()?`${dd}/${mm}`:`${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;}
  function projects(){
    const hidden=new Set(gov.hiddenProjectIds||[]),core=new Set(gov.coreProjectIds||[]);
    return (cache.projects||[]).filter(isProject).filter(p=>!hidden.has(p.id)).sort((a,b)=>(core.has(b.id)?1:0)-(core.has(a.id)?1:0)||recency(b.id)-recency(a.id)||clean(a.name).localeCompare(clean(b.name),'fr'));
  }
  function row(p){const latest=recency(p.id),meta=`${date(latest)}  [${count(p.id)}]`,href=p.href||`/g/${p.id}/project`,color=p.color||'#4fc1ff',icon=p.icon||'▤';return `<a data-ng8-pin="1" href="${esc(href)}" style="--ng-project:${esc(color)}"><i>${esc(icon)}</i><span>${esc(p.name||'Project')}</span><small class="ng8-project-meta">${esc(meta)}</small></a>`;}
  function sameProjectSet(box,list){const ids=[...box.querySelectorAll('.ng8-pin-list a[data-ng8-pin="1"]')].map(a=>pid(a.getAttribute('href')));return ids.length===list.length&&ids.every((id,i)=>id===list[i].id);}
  function render(){
    scheduled=false;if(internal)return;
    const box=document.getElementById('ng8-pins');if(!box){delete document.documentElement.dataset.ng121PinsReady;return;}
    internal=true;
    try{
      stablePlace(box);
      const list=projects();
      if(!sameProjectSet(box,list)){
        const previousOpen=(()=>{try{return sessionStorage.getItem(OPEN_KEY)||'';}catch{return'';}})();
        box.innerHTML=`<div class="ng8-pin-head"><span>PROJECTS</span><b>${list.length}</b></div><div class="ng8-pin-list">${list.map(row).join('')}</div>`;
        box.dataset.ng8Rendered=String(list.length);box.dataset.ng121Rendered=String(list.length);
        if(previousOpen)try{sessionStorage.setItem(OPEN_KEY,previousOpen);}catch{}
        document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:list.length,shown:list.length,source:'sidebar-live-authority-v121'}}));
      }else{
        const head=box.querySelector('.ng8-pin-head b');if(head)head.textContent=String(list.length);
      }
      window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-live-121',`OK · ${list.length}/${list.length} Projects · placement stable · drawers actifs`);
      window.__NIAKGPT_DIAGNOSTICS__?.set('pins-ui',list.length?`OK · ${list.length} Projects NiakGPT · tous affichés`:'ATTENTE · aucun Project à afficher');
    }finally{queueMicrotask(()=>{internal=false;});}
    bind();
  }
  function schedule(){if(scheduled||internal)return;scheduled=true;queueMicrotask(render);}
  function bind(){
    const r=navRoot();if(!r)return;
    if(observer&&root===r)return;
    observer?.disconnect();root=r;
    observer=new MutationObserver(records=>{
      if(internal)return;
      const box=document.getElementById('ng8-pins');
      let boxMoved=false,boxChanged=false;
      for(const rec of records){
        for(const n of [...rec.addedNodes,...rec.removedNodes]){
          if(!(n instanceof Element))continue;
          if(n.id==='ng8-pins'||n.querySelector?.('#ng8-pins'))boxMoved=true;
          if(n.closest?.('#ng8-pins')||n.querySelector?.('[data-ng8-pin="1"],.ng8-pin-list'))boxChanged=true;
        }
      }
      // Reposition in the observer microtask, before the next paint, to neutralize the old app mover.
      if(box&&boxMoved)stablePlace(box);
      if(boxMoved||boxChanged)schedule();
    });
    observer.observe(r,{childList:true,subtree:true});
    if(r.parentElement)observer.observe(r.parentElement,{childList:true,subtree:false});
  }
  async function load(){try{const raw=await chrome.storage.local.get([CACHE_KEY,GOV_KEY]);cache=raw[CACHE_KEY]||cache;gov=raw[GOV_KEY]||gov;}catch{}render();}
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[CACHE_KEY])cache=changes[CACHE_KEY].newValue||cache;if(changes[GOV_KEY])gov=changes[GOV_KEY].newValue||gov;schedule();});}catch{}
  document.addEventListener('niakgpt:pins-rendered',event=>{if(event.detail?.source==='sidebar-live-authority-v121')return;schedule();});
  document.addEventListener('niakgpt:recovery-complete',schedule);
  window.addEventListener('popstate',schedule);if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',schedule);
  window.addEventListener('pageshow',()=>{bind();schedule();});
  load();
})();
