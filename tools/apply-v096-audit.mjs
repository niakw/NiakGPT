import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(cond,msg)=>{if(!cond)throw new Error(msg);};

// app-v090.js — remove periodic route/index retries and wake from real state changes.
{
  const p='app-v090.js';
  let s=read(p);
  if(!s.includes('function bindNavigation()')){
    const stateOld="mainObserver:null, sidebarObserver:null, mainTimer:0, sidebarTimer:0, routeTimer:0, lastPath:location.pathname,";
    const stateNew="mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, lastPath:location.pathname, projectsRefreshed:false, refreshingProjects:false,";
    must(s.includes(stateOld),'app state anchor missing');
    s=s.replace(stateOld,stateNew);

    const indexRx=/  function scheduleIndex\(delay=1200\)\{[\s\S]*?\n  async function runOneIndex\(\)\{/;
    must(indexRx.test(s),'schedule/refresh block anchor missing');
    s=s.replace(indexRx,`  function scheduleIndex(delay=120){
    clearTimeout(S.queueTimer);S.queueTimer=0;
    if(!canBackground())return;
    S.queueTimer=setTimeout(()=>{
      S.queueTimer=0;if(!canBackground())return;
      if('requestIdleCallback'in window)requestIdleCallback(()=>runOneIndex(),{timeout:2600});else runOneIndex();
    },delay);
  }
  async function refreshProjects(){
    if(S.refreshingProjects||!canBackground())return;
    S.refreshingProjects=true;
    try{
      health('projects','INDEXATION · Projects');
      const list=await fetchProjects();for(const p of list)upsertProject(p);buildDuplicates();
      S.projectsRefreshed=true;S.indexComplete=false;
      S.queue=S.projects.filter(p=>!S.projectChats.has(p.id)||S.counts.get(p.id)==null);
      health('bridge','OK');health('projects',\`OK · \${S.projects.length} Projects\`);renderPins();decorateSidebar();renderPanel();await saveCache();scheduleIndex(60);
    }catch(e){if(String(e?.message)!=='paused'){error('projects',e);health('projects',\`ERREUR · \${String(e?.message||e).slice(0,80)}\`);}}
    finally{S.refreshingProjects=false;}
  }
  async function runOneIndex(){`);

    s=s.replace("if(S.indexing||!canBackground())return scheduleIndex(5000);","if(S.indexing||!canBackground())return;");
    s=s.replace("finally{S.indexing=false;scheduleIndex(S.queue.length?500:2200);}","finally{S.indexing=false;if(canBackground())scheduleIndex(S.queue.length?260:100);}");

    const mountRx=/  function mountObservers\(\)\{[\s\S]*?\n  function resetRouteVisuals\(\)\{/;
    must(mountRx.test(s),'mountObservers block anchor missing');
    s=s.replace(mountRx,`  function mountObservers(){
    const main=document.querySelector('main');
    if(main&&main!==S.mainRoot){S.mainObserver?.disconnect();S.mainRoot=main;S.mainObserver=new MutationObserver(queueMainNodes);S.mainObserver.observe(main,{childList:true,subtree:true});scanExistingMain();}
    const side=navRoot();
    if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(()=>{if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;decorateSidebar();},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}
  }
  function resetRouteVisuals(){`);

    const routeRx=/  function routeTick\(\)\{[\s\S]*?\n  function bindEvents\(\)\{/;
    must(routeRx.test(s),'routeTick block anchor missing');
    s=s.replace(routeRx,`  function wakeBackground(){
    if(!canBackground())return;
    if(!S.projectsRefreshed&&!S.refreshingProjects)refreshProjects();else scheduleIndex(40);
  }
  function handleRouteChange(){
    mountObservers();const next=location.pathname;if(next===S.lastPath)return;
    S.lastPath=next;resetRouteVisuals();mountObservers();wakeBackground();
  }
  function bindNavigation(){
    const later=()=>setTimeout(handleRouteChange,0);
    window.addEventListener('popstate',later);
    document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('a[href]'))later();},true);
    if(window.navigation?.addEventListener){window.navigation.addEventListener('navigatesuccess',handleRouteChange);window.navigation.addEventListener('currententrychange',later);}
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){mountObservers();handleRouteChange();wakeBackground();}});
    const runtimeObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe'].includes(r.attributeName)))wakeBackground();});
    runtimeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe']});
  }

  function bindEvents(){`);

    must(s.includes('bindEvents();routeTick();'),'boot routeTick call missing');
    s=s.replace('bindEvents();routeTick();','bindEvents();bindNavigation();');
    must(s.includes("setTimeout(()=>{if(canBackground())refreshProjects();else scheduleIndex(6000);},1600);"),'boot index retry anchor missing');
    s=s.replace("setTimeout(()=>{if(canBackground())refreshProjects();else scheduleIndex(6000);},1600);","setTimeout(()=>{if(canBackground())refreshProjects();},900);");
  }
  must(s.includes('function bindNavigation()'),'event-driven navigation missing after convergence');
  must(!s.includes('function routeTick()'),'routeTick still present');
  must(!s.includes('setTimeout(routeTick'),'routeTick timer still present');
  write(p,s);
}

// multitab-v090.js — client Quick Open should prefer existing SPA links over hard reloads.
{
  const p='multitab-v090.js';let s=read(p);
  const anchor="function formatDate(ms){if(!ms)return'—';const d=new Date(ms);return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;}";
  must(s.includes(anchor),'multitab formatDate anchor missing');
  if(!s.includes('function routeTo(href)'))s=s.replace(anchor,`${anchor}\n  function routeTo(href){const native=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===href&&!a.closest('#ng8-quick,#ng8-panel,#ng90-control'));if(native instanceof HTMLElement){native.click();return;}location.assign(href);}`);
  s=s.replace("list.querySelectorAll('button').forEach(button=>button.onclick=()=>{location.href=items[Number(button.dataset.i)].href;});","list.querySelectorAll('button').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.i)];if(item)routeTo(item.href);});");
  s=s.replace("else if(event.key==='Enter'&&items[selected]){event.preventDefault();location.href=items[selected].href;}","else if(event.key==='Enter'&&items[selected]){event.preventDefault();routeTo(items[selected].href);}");
  must(!s.includes("location.href=items["),'client Quick Open still hard reloads');
  write(p,s);
}

// Control Center is loaded after polish-v081.css, so it is the final Matrix source of truth.
{
  const p='control-center-v090.css';let s=read(p);
  if(!s.includes('html[data-ng90-matrix="subtle"] #ng8-matrix{opacity:.31')){
    const rx=/html\[data-ng90-matrix="normal"\] #ng8-matrix\{[^\n]+\}\nhtml\[data-ng90-matrix="subtle"\] #ng8-matrix\{[^\n]+\}/;
    must(rx.test(s),'Matrix preference block missing');
    s=s.replace(rx,`html[data-ng90-matrix="normal"] #ng8-matrix{opacity:.38!important;filter:saturate(1.24) brightness(1)!important}\nhtml[data-ng90-matrix="subtle"] #ng8-matrix{opacity:.31!important;filter:saturate(1.20) brightness(.98)!important}`);
  }
  const off='html[data-ng90-matrix="off"] #ng8-matrix,';must(s.includes(off),'Matrix off anchor missing');
  if(!s.includes('html[data-ng8-running="1"][data-ng90-matrix] #ng8-matrix'))s=s.replace(off,`html[data-ng8-running="1"][data-ng90-matrix] #ng8-matrix{opacity:.09!important;filter:none!important}\nhtml[data-ng8-running="1"][data-ng8-heavy="1"][data-ng90-matrix] #ng8-matrix{opacity:.035!important}\n${off}`);
  write(p,s);
}

// Coach marker is explicit in the DOM for QA/debugging.
{
  const p='coach-v100.js';let s=read(p);
  s=s.replace("box.dataset.ng100Coach='1';","box.setAttribute('data-ng100-coach','1');");
  must(s.includes("setAttribute('data-ng100-coach','1')"),'explicit coach marker missing');
  write(p,s);
}

console.log('NiakGPT 0.9.6 audited runtime convergence applied');
