(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BREADCRUMB_113__)return;
  window.__NIAKGPT_BREADCRUMB_113__=true;

  const CACHE_KEY='niakgpt-v08-cache';
  let cache={projects:[],chats:[]},timer=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pidFromPath=()=>location.pathname.match(/^\/g\/(g-p-[^/?#]+)(?:[/?#]|$)/i)?.[1]||'';
  const cidFromPath=()=>location.pathname.match(/\/c\/([A-Za-z0-9_-]+)/i)?.[1]||'';
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const projectHref=id=>id?`/g/${id}/project`:'';
  const sanitizeProjectLabel=v=>clean(v).replace(/^(?:ouvrir|open)\s+(?:le\s+)?projet\s+/i,'').replace(/^(?:projet|project)\s*[:·-]\s*/i,'');
  const badProjectLabel=v=>/^(?:out|hors projet|outside project|project)$/i.test(clean(v));

  function titleContext(){
    const raw=clean(document.title).replace(/\s*[|·]\s*(?:ChatGPT|NiakGPT)\s*$/i,'');
    let m=raw.match(/^(.*?),\s*chat dans le projet\s+(.+)$/i);if(!m)m=raw.match(/^(.*?),\s*chat in (?:the )?project\s+(.+)$/i);
    return m?{chat:clean(m[1]),project:sanitizeProjectLabel(m[2])}:{chat:raw,project:''};
  }
  const cachedChat=id=>(cache.chats||[]).find(c=>c?.id===id)||null;
  const cachedProject=id=>(cache.projects||[]).find(p=>p?.id===id)||null;
  function canonicalChat(id){return window.__NIAKGPT_CHAT_STATE_113__?.get?.(id)||cachedChat(id)||null;}
  function effectiveProjectId(routePid,cid){
    if(routePid&&cachedProject(routePid))return routePid;
    const cp=clean(canonicalChat(cid)?.projectId||'');if(cp&&cachedProject(cp))return cp;
    return routePid||'';
  }
  function projectName(id){
    const cached=sanitizeProjectLabel(cachedProject(id)?.name);if(cached&&!badProjectLabel(cached))return cached;
    const fromTitle=sanitizeProjectLabel(titleContext().project);if(fromTitle&&!badProjectLabel(fromTitle))return fromTitle;
    const native=[...document.querySelectorAll('a[href*="/g/g-p-"]:not([href*="/c/"])')].find(a=>String(a.getAttribute('href')||'').includes(`/g/${id}`));
    const label=sanitizeProjectLabel(native?.textContent||native?.getAttribute('aria-label')||'');
    return label&&!badProjectLabel(label)?label:'Project';
  }
  function chatTitle(id,pName=''){
    const canonical=clean(canonicalChat(id)?.title);if(canonical&&!/^(conversation|new chat|nouveau chat)$/i.test(canonical))return canonical;
    const native=[...document.querySelectorAll('a[href*="/c/"]')].find(a=>(a.getAttribute('href')||'').includes(id));
    let fromDom='';if(native){const clone=native.cloneNode(true);clone.querySelectorAll('.ng8-chat-date,.ng8-chat-project,.ng85-manual-lock,.ng100-out-badge,.ng100-continue').forEach(x=>x.remove());fromDom=clean(clone.querySelector('.truncate span')?.textContent||clone.textContent||native.getAttribute('aria-label')||'');}
    if(fromDom&&!/^out$/i.test(fromDom))return fromDom;
    let title=clean(titleContext().chat);if(pName){const rx=new RegExp(`^${pName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*[-–—|·:]\\s*`,'i');title=title.replace(rx,'');}
    return title||'Conversation';
  }
  function route(event,href){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();event.stopPropagation();const native=[...document.querySelectorAll('a[href]')].find(a=>!a.closest('#ng100-breadcrumb')&&a.getAttribute('href')===href);if(native instanceof HTMLElement)native.click();else location.assign(href);
  }
  function render(){
    timer=0;const routePid=pidFromPath(),cid=cidFromPath(),pid=effectiveProjectId(routePid,cid);let bar=document.getElementById('ng100-breadcrumb');
    if(!pid&&!cid){bar?.remove();return;}
    if(!bar){bar=document.createElement('nav');bar.id='ng100-breadcrumb';bar.setAttribute('aria-label','Fil d’Ariane NiakGPT');document.body.appendChild(bar);}
    const pName=pid?projectName(pid):'',cTitle=cid?chatTitle(cid,pName):'',chatHref=location.pathname+location.search;
    const parts=[`<a class="ng100-bc-home" href="/">Accueil</a>`];
    if(pid)parts.push(`<span class="ng100-bc-sep">›</span><a class="ng100-bc-project" href="${esc(projectHref(pid))}">${esc(pName)}</a>`);
    if(cid)parts.push(`<span class="ng100-bc-sep">›</span><a class="ng100-bc-current" href="${esc(chatHref)}" title="${esc(cTitle)}">${esc(cTitle)}</a>`);
    bar.innerHTML=parts.join('');
    for(const a of bar.querySelectorAll('a[href]'))a.addEventListener('click',event=>route(event,a.getAttribute('href')));
    window.__NIAKGPT_DIAGNOSTICS__?.set('fil-ariane',pid&&cid?`Accueil › ${pName} › ${cTitle}`:cid?`Accueil › ${cTitle}`:`Accueil › ${pName}`);
  }
  function schedule(delay=60){clearTimeout(timer);timer=setTimeout(render,delay);}
  const bus=window.__NIAKGPT_CACHE_BUS__;
  if(bus){bus.subscribe(raw=>{if(raw&&typeof raw==='object')cache=raw;schedule(20);});bus.get().then(raw=>{if(raw&&typeof raw==='object')cache=raw;schedule(10);}).catch(()=>{});}else chrome.storage.local.get(CACHE_KEY).then(raw=>{cache=raw?.[CACHE_KEY]||cache;schedule(10);}).catch(()=>{});
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(20);}});}catch{}
  document.addEventListener('niakgpt:recovery-complete',()=>schedule(40));document.addEventListener('niakgpt:activity-changed',()=>schedule(40));
  window.addEventListener('popstate',()=>{schedule(0);setTimeout(render,260);});if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{schedule(0);setTimeout(render,260);});
  document.addEventListener('click',event=>{const a=event.target instanceof Element?event.target.closest('a[href]'):null;if(a&&/\/c\/|\/g\/g-p-/.test(a.getAttribute('href')||'')){schedule(40);setTimeout(render,320);}},true);
  schedule(0);setTimeout(render,500);
})();
