import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(cond,msg)=>{if(!cond)throw new Error(msg);};

// app-v090.js — remove periodic route/index retries and wake from real state changes.
{
  const p='app-v090.js';let s=read(p);
  if(!s.includes('function bindNavigation()')){
    const stateOld="mainObserver:null, sidebarObserver:null, mainTimer:0, sidebarTimer:0, routeTimer:0, lastPath:location.pathname,";
    const stateNew="mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, lastPath:location.pathname, projectsRefreshed:false, refreshingProjects:false,";
    must(s.includes(stateOld),'app state anchor missing');s=s.replace(stateOld,stateNew);
    const indexRx=/  function scheduleIndex\(delay=1200\)\{[\s\S]*?\n  async function runOneIndex\(\)\{/;must(indexRx.test(s),'schedule/refresh block anchor missing');
    s=s.replace(indexRx,`  function scheduleIndex(delay=120){
    clearTimeout(S.queueTimer);S.queueTimer=0;if(!canBackground())return;
    S.queueTimer=setTimeout(()=>{S.queueTimer=0;if(!canBackground())return;if('requestIdleCallback'in window)requestIdleCallback(()=>runOneIndex(),{timeout:2600});else runOneIndex();},delay);
  }
  async function refreshProjects(){
    if(S.refreshingProjects||!canBackground())return;S.refreshingProjects=true;
    try{health('projects','INDEXATION · Projects');const list=await fetchProjects();for(const p of list)upsertProject(p);buildDuplicates();S.projectsRefreshed=true;S.indexComplete=false;S.queue=S.projects.filter(p=>!S.projectChats.has(p.id)||S.counts.get(p.id)==null);health('bridge','OK');health('projects',\`OK · \${S.projects.length} Projects\`);renderPins();decorateSidebar();renderPanel();await saveCache();scheduleIndex(60);}
    catch(e){if(String(e?.message)!=='paused'){error('projects',e);health('projects',\`ERREUR · \${String(e?.message||e).slice(0,80)}\`);}}
    finally{S.refreshingProjects=false;}
  }
  async function runOneIndex(){`);
    s=s.replace("if(S.indexing||!canBackground())return scheduleIndex(5000);","if(S.indexing||!canBackground())return;");
    s=s.replace("finally{S.indexing=false;scheduleIndex(S.queue.length?500:2200);}","finally{S.indexing=false;if(canBackground())scheduleIndex(S.queue.length?260:100);}");
    const mountRx=/  function mountObservers\(\)\{[\s\S]*?\n  function resetRouteVisuals\(\)\{/;must(mountRx.test(s),'mountObservers block anchor missing');
    s=s.replace(mountRx,`  function mountObservers(){
    const main=document.querySelector('main');if(main&&main!==S.mainRoot){S.mainObserver?.disconnect();S.mainRoot=main;S.mainObserver=new MutationObserver(queueMainNodes);S.mainObserver.observe(main,{childList:true,subtree:true});scanExistingMain();}
    const side=navRoot();if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(()=>{if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;decorateSidebar();},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}
  }
  function resetRouteVisuals(){`);
    const routeRx=/  function routeTick\(\)\{[\s\S]*?\n  function bindEvents\(\)\{/;must(routeRx.test(s),'routeTick block anchor missing');
    s=s.replace(routeRx,`  function wakeBackground(){if(!canBackground())return;if(!S.projectsRefreshed&&!S.refreshingProjects)refreshProjects();else scheduleIndex(40);}
  function handleRouteChange(){mountObservers();const next=location.pathname;if(next===S.lastPath)return;S.lastPath=next;resetRouteVisuals();mountObservers();wakeBackground();}
  function bindNavigation(){
    const later=()=>setTimeout(handleRouteChange,0);window.addEventListener('popstate',later);
    document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('a[href]'))later();},true);
    if(window.navigation?.addEventListener){window.navigation.addEventListener('navigatesuccess',handleRouteChange);window.navigation.addEventListener('currententrychange',later);}
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){mountObservers();handleRouteChange();wakeBackground();}});
    const runtimeObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe'].includes(r.attributeName)))wakeBackground();});
    runtimeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng8-tab-role','data-ng86-activity','data-ng8-running','data-ng8-heavy','data-ng90-safe']});
  }

  function bindEvents(){`);
    must(s.includes('bindEvents();routeTick();'),'boot routeTick call missing');s=s.replace('bindEvents();routeTick();','bindEvents();bindNavigation();');
    must(s.includes("setTimeout(()=>{if(canBackground())refreshProjects();else scheduleIndex(6000);},1600);"),'boot index retry anchor missing');s=s.replace("setTimeout(()=>{if(canBackground())refreshProjects();else scheduleIndex(6000);},1600);","setTimeout(()=>{if(canBackground())refreshProjects();},900);");
  }

  if(s.includes('function suggestionSet(prompt)')){
    const coachRx=/  function findComposer\(\)\{[\s\S]*?\n  function stopMatrix\(\)\{/;must(coachRx.test(s),'legacy coach block anchor missing');s=s.replace(coachRx,'  function stopMatrix(){');
  }
  s=s.replace("    if(enabled('ng90Coach')&&activity()==='ready')ensureCoach();\n",'');
  s=s.replace('renderStatusBase();decorateSidebar();setTimeout(scanExistingMain,500);ensureCoach();','renderStatusBase();decorateSidebar();setTimeout(scanExistingMain,500);');
  s=s.replace(/    document\.addEventListener\('input',[\s\S]*?\},true\);\n    document\.addEventListener\('keydown'/,"    document.addEventListener('keydown'");
  s=s.replace("    document.addEventListener('niakgpt:settings-changed',()=>{ensureCoach();ensureMatrix();ensureBots();renderPins();});","    document.addEventListener('niakgpt:settings-changed',()=>{ensureMatrix();ensureBots();renderPins();});");
  s=s.replace("    document.addEventListener('niakgpt:activity-network',e=>{if(e.detail?.phase==='request')document.getElementById('ng8-coach')?.setAttribute('hidden','');if(e.detail?.phase==='error')setTimeout(ensureCoach,900);});\n",'');
  s=s.replace('mountObservers();ensureMatrix();ensureBots();ensureCoach();bindEvents();bindNavigation();','mountObservers();ensureMatrix();ensureBots();bindEvents();bindNavigation();');

  const routeOld="function routeTo(href){ const root=navRoot(),native=root?[...root.querySelectorAll('a')].find(a=>a.getAttribute('href')===href):null;if(native){native.click();return;}location.href=href; }";
  const routeNew="function routeTo(href){ const root=navRoot(),chatId=cidFromHref(href),projectId=pidFromHref(href),links=root?[...root.querySelectorAll('a[href]')]:[],native=links.find(a=>a.getAttribute('href')===href)||(chatId?links.find(a=>cidFromHref(a.getAttribute('href'))===chatId):null)||(projectId?links.find(a=>pidFromHref(a.getAttribute('href'))===projectId&&/\\/project(?:$|\\?)/.test(a.getAttribute('href')||'')):null);if(native){native.click();return;}location.assign(href); }";
  if(s.includes(routeOld))s=s.replace(routeOld,routeNew);

  must(s.includes('function bindNavigation()'),'event-driven navigation missing after convergence');must(!s.includes('function routeTick()'),'routeTick still present');must(!s.includes('setTimeout(routeTick'),'routeTick timer still present');must(!s.includes('function suggestionSet(prompt)'),'legacy coach classifier still present');must(!s.includes('function ensureCoach()'),'legacy coach renderer still present');noHardReload(s);
  write(p,s);
}

function noHardReload(s){must(!s.includes('location.href=href'),'worker Quick Open hard reload still present');}

// multitab-v090.js — client Quick Open should prefer existing SPA links over hard reloads.
{
  const p='multitab-v090.js';let s=read(p);const anchor="function formatDate(ms){if(!ms)return'—';const d=new Date(ms);return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;}";must(s.includes(anchor),'multitab formatDate anchor missing');
  if(!s.includes('function routeTo(href)'))s=s.replace(anchor,`${anchor}\n  function routeTo(href){const native=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===href&&!a.closest('#ng8-quick,#ng8-panel,#ng90-control'));if(native instanceof HTMLElement){native.click();return;}location.assign(href);}`);
  s=s.replace("list.querySelectorAll('button').forEach(button=>button.onclick=()=>{location.href=items[Number(button.dataset.i)].href;});","list.querySelectorAll('button').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.i)];if(item)routeTo(item.href);});");s=s.replace("else if(event.key==='Enter'&&items[selected]){event.preventDefault();location.href=items[selected].href;}","else if(event.key==='Enter'&&items[selected]){event.preventDefault();routeTo(items[selected].href);}");must(!s.includes("location.href=items["),'client Quick Open still hard reloads');write(p,s);
}

// Control Center is the final Matrix source of truth.
{
  const p='control-center-v090.css';let s=read(p);if(!s.includes('html[data-ng90-matrix="subtle"] #ng8-matrix{opacity:.31')){const rx=/html\[data-ng90-matrix="normal"\] #ng8-matrix\{[^\n]+\}\nhtml\[data-ng90-matrix="subtle"\] #ng8-matrix\{[^\n]+\}/;must(rx.test(s),'Matrix preference block missing');s=s.replace(rx,`html[data-ng90-matrix="normal"] #ng8-matrix{opacity:.38!important;filter:saturate(1.24) brightness(1)!important}\nhtml[data-ng90-matrix="subtle"] #ng8-matrix{opacity:.31!important;filter:saturate(1.20) brightness(.98)!important}`);}const off='html[data-ng90-matrix="off"] #ng8-matrix,';must(s.includes(off),'Matrix off anchor missing');if(!s.includes('html[data-ng8-running="1"][data-ng90-matrix] #ng8-matrix'))s=s.replace(off,`html[data-ng8-running="1"][data-ng90-matrix] #ng8-matrix{opacity:.09!important;filter:none!important}\nhtml[data-ng8-running="1"][data-ng8-heavy="1"][data-ng90-matrix] #ng8-matrix{opacity:.035!important}\n${off}`);write(p,s);
}

// Contextual coach: explicit marker, status/diagnostic ownership, and activity wakeups.
{
  const p='coach-v100.js';let s=read(p);s=s.replace("box.dataset.ng100Coach='1';","box.setAttribute('data-ng100-coach','1');");
  if(!s.includes('function setCoachStatus(')){
    s=s.replace("  const enabled=()=>document.documentElement.dataset.ng90Coach!=='off'&&document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng86Activity==='ready';",`  const enabled=()=>document.documentElement.dataset.ng90Coach!=='off'&&document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng86Activity==='ready';
  let coachStatus='INACTIF · bootstrap';
  function patchDiagnostic(){
    const diag=document.querySelector('#ng8-panel .ng8-diag');if(!diag)return false;
    const row=[...diag.querySelectorAll(':scope > div')].find(x=>(x.querySelector('span')?.textContent||'').trim().toLowerCase()==='coach');if(!row)return false;
    const value=row.querySelector('b');if(!value)return false;value.textContent=coachStatus;value.className=/^(OK|PRÊT)/.test(coachStatus)?'ok':/^ERREUR/.test(coachStatus)?'err':'wait';return true;
  }
  function setCoachStatus(text){coachStatus=text;document.documentElement.dataset.ng100CoachStatus=text;patchDiagnostic();}`);
    s=s.replace("renderTimer=0;const c=composer(),old=document.getElementById('ng8-coach');if(!enabled()||!c?.editor||!c.form||!c.shell){if(old)old.hidden=true;return;}","renderTimer=0;const c=composer(),old=document.getElementById('ng8-coach'),root=document.documentElement;if(!enabled()||!c?.editor||!c.form||!c.shell){if(old)old.hidden=true;setCoachStatus(root.dataset.ng90Safe==='1'?'OFF · SAFE MODE':root.dataset.ng90Coach==='off'?'OFF · réglage':root.dataset.ng86Activity!=='ready'?`PAUSE · ${String(root.dataset.ng86Activity||'activité').toUpperCase()}`:'INACTIF · composer absent');return;}");
    s=s.replace("const prompt=editorText(c.editor).trim();if(prompt.length<5){if(old)old.hidden=true;return;}","const prompt=editorText(c.editor).trim();if(prompt.length<5){if(old)old.hidden=true;setCoachStatus('PRÊT · saisir 5 caractères');return;}");
    s=s.replace("if(sig===lastSig&&box.dataset.ng100Coach==='1'){box.hidden=false;return;}","if(sig===lastSig&&box.dataset.ng100Coach==='1'){box.hidden=false;setCoachStatus(`OK · ${model.kind.toUpperCase()} · ${model.items.length} suggestions`);return;}");
    s=s.replace("box.querySelectorAll('[data-ng100-i]').forEach(button=>button.addEventListener('click',()=>append(c.editor,model.items[Number(button.dataset.ng100I)].text)));","box.querySelectorAll('[data-ng100-i]').forEach(button=>button.addEventListener('click',()=>append(c.editor,model.items[Number(button.dataset.ng100I)].text)));setCoachStatus(`OK · ${model.kind.toUpperCase()} · ${model.items.length} suggestions`);");
    s=s.replace("  window.addEventListener('popstate',()=>{lastSig='';schedule(220);});",`  const stateObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng86-activity','data-ng90-safe','data-ng90-coach'].includes(r.attributeName))){lastSig='';schedule(80);patchDiagnostic();}});stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng86-activity','data-ng90-safe','data-ng90-coach']});
  document.addEventListener('click',event=>{const t=event.target instanceof Element?event.target:null;if(t?.closest('#ng8-rail [data-tab="diag"]'))setTimeout(patchDiagnostic,60);},true);
  window.addEventListener('popstate',()=>{lastSig='';schedule(220);});`);
  }
  must(s.includes("setAttribute('data-ng100-coach','1')"),'explicit coach marker missing');must(s.includes('function setCoachStatus('),'coach diagnostic owner missing');write(p,s);
}

console.log('NiakGPT 0.9.6 audited runtime convergence applied');
