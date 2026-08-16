(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BREADCRUMB_100__)return;
  window.__NIAKGPT_BREADCRUMB_100__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  let cache={projects:[],chats:[]},timer=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pidFromPath=()=>location.pathname.match(/^\/g\/(g-p-[^/?#]+)(?:[/?#]|$)/i)?.[1]||'';
  const cidFromPath=()=>location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const projectHref=id=>id?`/g/${id}/project`:'';
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sanitizeProjectLabel=v=>clean(v).replace(/^(?:ouvrir|open)\s+(?:le\s+)?projet\s+/i,'').replace(/^(?:projet|project)\s*[:·-]\s*/i,'');
  function titleContext(){
    const raw=clean(document.title).replace(/\s*[|·]\s*(?:ChatGPT|NiakGPT)\s*$/i,'');
    let m=raw.match(/^(.*?),\s*chat dans le projet\s+(.+)$/i);if(!m)m=raw.match(/^(.*?),\s*chat in (?:the )?project\s+(.+)$/i);
    return m?{chat:clean(m[1]),project:sanitizeProjectLabel(m[2])}:{chat:raw,project:''};
  }
  function cachedChat(id){return (cache.chats||[]).find(c=>c?.id===id)||null;}
  function cachedProject(id){return (cache.projects||[]).find(p=>p?.id===id)||null;}
  function effectiveProjectId(routePid,cid){
    const c=cid?cachedChat(cid):null,cp=clean(c?.projectId||'');
    if(cp&&cachedProject(cp))return cp;
    return routePid;
  }
  function projectName(id){
    const cached=sanitizeProjectLabel(cachedProject(id)?.name);if(cached&&norm(cached)!=='project')return cached;
    const fromTitle=sanitizeProjectLabel(titleContext().project);if(fromTitle)return fromTitle;
    const native=[...document.querySelectorAll('a[href*="/g/g-p-"]:not([href*="/c/"])')].find(a=>String(a.getAttribute('href')||'').includes(`/g/${id}`));
    const label=sanitizeProjectLabel(native?.textContent||native?.getAttribute('aria-label')||'');
    return label||'Project';
  }
  function chatTitle(id,pName=''){
    const cached=clean(cachedChat(id)?.title);if(cached){let m=cached.match(/^(.*?),\s*chat dans le projet\s+.+$/i);if(!m)m=cached.match(/^(.*?),\s*chat in (?:the )?project\s+.+$/i);if(m)return clean(m[1]);return cached;}
    const native=[...document.querySelectorAll('a[href*="/c/"]')].find(a=>(a.getAttribute('href')||'').includes(id));
    let fromDom='';if(native){const clone=native.cloneNode(true);clone.querySelectorAll('.ng8-chat-date,.ng8-chat-project,.ng85-manual-lock').forEach(x=>x.remove());fromDom=clean(clone.querySelector('.truncate span')?.textContent||clone.textContent||native.getAttribute('aria-label')||'');}
    if(fromDom)return fromDom;
    let title=clean(titleContext().chat);
    if(pName){const prefix=new RegExp(`^${pName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*[-–—|·:]\\s*`,'i');title=title.replace(prefix,'');}
    return title||'Conversation';
  }
  function routeProject(event,id){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();event.stopPropagation();const href=projectHref(id),native=[...document.querySelectorAll('a[href]')].find(a=>!a.closest('#ng100-breadcrumb')&&a.getAttribute('href')===href);
    if(native instanceof HTMLElement)native.click();else location.assign(href);
  }
  function render(){
    timer=0;const routePid=pidFromPath(),cid=cidFromPath(),pid=effectiveProjectId(routePid,cid);let bar=document.getElementById('ng100-breadcrumb');
    if(!pid&&!cid){bar?.remove();return;}
    if(!bar){bar=document.createElement('nav');bar.id='ng100-breadcrumb';bar.setAttribute('aria-label','Fil d’Ariane NiakGPT');document.body.appendChild(bar);}
    const pName=pid?projectName(pid):'Hors projet',cTitle=cid?chatTitle(cid,pName):'';
    bar.innerHTML=`<a class="ng100-bc-home" href="/" aria-label="Accueil NiakGPT">NiakGPT</a><span class="ng100-bc-sep">›</span>${pid?`<a class="ng100-bc-project" href="${esc(projectHref(pid))}">${esc(pName)}</a>`:'<span class="ng100-bc-project">Hors projet</span>'}${cid?`<span class="ng100-bc-sep">›</span><span class="ng100-bc-current" title="${esc(cTitle)}">${esc(cTitle)}</span>`:''}`;
    const project=bar.querySelector('.ng100-bc-project[href]');if(project)project.addEventListener('click',event=>routeProject(event,pid));
    window.__NIAKGPT_DIAGNOSTICS__?.set('fil-ariane',cid?`${pName} › ${cTitle}`:pName);
  }
  function schedule(delay=80){clearTimeout(timer);timer=setTimeout(render,delay);}
  const bus=window.__NIAKGPT_CACHE_BUS__;
  if(bus){bus.subscribe(raw=>{if(raw&&typeof raw==='object')cache=raw;schedule(30);});bus.get().then(raw=>{if(raw&&typeof raw==='object')cache=raw;schedule(20);}).catch(()=>{});}
  else chrome.storage.local.get(CACHE_KEY).then(raw=>{cache=raw?.[CACHE_KEY]||cache;schedule(20);}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(30);}});
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(50));
  window.addEventListener('popstate',()=>{schedule(0);setTimeout(render,350);});
  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigate',()=>{schedule(0);setTimeout(render,350);});
  document.addEventListener('click',event=>{const a=event.target instanceof Element?event.target.closest('a[href]'):null;if(!a)return;const h=a.getAttribute('href')||'';if(/\/c\/|\/g\/g-p-/.test(h)){schedule(60);setTimeout(render,500);}},true);
  schedule(0);setTimeout(render,700);
})();
