(() => {
  'use strict';

  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_V060__) return;
  window.__NIAKGPT_V060__ = true;
  document.documentElement.classList.add('ng6-boot');

  const VERSION = '0.6.0';
  const LEGACY_NAMES = new Set([
    'design','ai','ia','coding','code','development','web development','technology','tech',
    'social','social media','writing','general knowledge','general','e-commerce','ecommerce',
    'seo','marketing','business','creative','research','productivity','other','misc','work',
    'education','health','finance','home','cars','gaming','movies','food','personal development'
  ]);
  const STOP = new Set(
    ('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes ' +
     'son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on ' +
     'with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir ' +
     'etre être besoin voudrais veux faudrait faut').split(/\s+/)
  );
  const PALETTE = ['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955','#22D3EE','#A78BFA','#FB7185'];

  const state = {
    projects: [], chats: [], projectById: new Map(), chatById: new Map(), profiles: new Map(), projectItems: new Map(),
    health: { bridge:'ATTENTE', projects:'ATTENTE', organizer:'ATTENTE', coach:'ATTENTE', toc:'ATTENTE', performance:'ATTENTE', pins:'ATTENTE', matrix:'ATTENTE', ui:'ATTENTE' },
    turns: [], generation:false, wasGenerating:false, organizerRunning:false, refreshRunning:false,
    panelOpen:false, tab:'explorer', nativePins:0, scanTimer:0, coachTimer:0, routeTimer:0,
    lastPath:location.pathname, observer:null, io:null, matrix:null, matrixRAF:0, matrixResize:null,
    lastFrame:0, prefetched:new Set(), reviewed:new Set(), bootstrapLoops:0
  };

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const isLegacy = p => !!p && LEGACY_NAMES.has(norm(p.name));
  const primaryProjects = () => state.projects.filter(p=>!isLegacy(p));

  function colorFor(name){ let h=0; for(const c of String(name)) h=((h<<5)-h+c.charCodeAt(0))|0; return PALETTE[Math.abs(h)%PALETTE.length]; }
  function iconFor(name){
    const s=norm(name);
    if(/code|dev|tech|web|api|github|program|provider/.test(s))return '</>';
    if(/legal|jurid|droit|prud|tribunal|justice/.test(s))return '§';
    if(/finance|argent|budget|banque|credit|compta/.test(s))return '€';
    if(/film|cinema|movie|serie|anime|video/.test(s))return '▶';
    if(/design|logo|image|creative|graph/.test(s))return '◇';
    if(/shop|commerce|store|product|produit|vente/.test(s))return '▣';
    if(/(^|\s)(ai|ia|gpt)(\s|$)|intelligence artificielle/.test(s))return '✦';
    if(/auto|car|voiture|vehicule/.test(s))return '◈';
    if(/health|sante|medical/.test(s))return '+';
    if(/game|gaming|jeu/.test(s))return '◆';
    if(/food|cuisine|recette/.test(s))return '◌';
    if(/social|relation|perso/.test(s))return '◎';
    return '▤';
  }
  function setHealth(key,value){ state.health[key]=value; renderStatus(); if(state.panelOpen&&state.tab==='diag')renderPanel(); }

  let rpcSeq=0;
  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng6-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body}}));
    });
  }

  function extractProjects(payload){
    const out=new Map(),seen=new WeakSet();
    function walk(x){
      if(!x||typeof x!=='object'||seen.has(x))return; seen.add(x);
      for(const g of [x,x.gizmo,x.gizmo?.gizmo].filter(Boolean)){
        const id=String(g.id||''),name=String(g.display?.name||g.name||'').trim();
        if(id.startsWith('g-p-')&&name) out.set(id,{id,name,description:String(g.display?.description||''),instructions:String(g.instructions||''),color:colorFor(name),icon:iconFor(name)});
      }
      if(Array.isArray(x))x.forEach(walk);else Object.values(x).forEach(walk);
    }
    walk(payload);return [...out.values()];
  }
  function normalizeChat(x){return {id:String(x?.id||x?.conversation_id||''),title:String(x?.title||x?.conversation_title||'Conversation sans titre'),projectId:String(x?.gizmo_id||x?.conversation_mode?.gizmo_id||''),snippet:String(x?.snippet||''),updated:Number(x?.update_time||x?.create_time||0)};}

  async function mapPool(items,limit,worker){
    let cursor=0;
    async function run(){ while(cursor<items.length){const i=cursor++;try{await worker(items[i],i);}catch{}} }
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  }

  function seedProfiles(){
    const profiles=new Map();
    for(const p of state.projects){
      const f=new Map();
      const add=(txt,w)=>{for(const t of words(txt))f.set(t,(f.get(t)||0)+w);};
      add(p.name,28);add(p.description,10);add(p.instructions,8);profiles.set(p.id,f);
    }
    for(const c of state.chats){
      const f=profiles.get(c.projectId);if(!f)continue;
      for(const t of words(`${c.title} ${c.snippet}`))f.set(t,(f.get(t)||0)+2);
    }
    state.profiles=profiles;
  }

  async function hydrateMembershipAndProfiles(){
    const projects=state.projects;
    state.projectItems.clear();
    if(!projects.length)return;
    setHealth('organizer','INDEXATION');
    await mapPool(projects,6,async project=>{
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?cursor=0&limit=100`,{timeout:10000});
      const items=Array.isArray(r.data?.items)?r.data.items:[];
      state.projectItems.set(project.id,items);
      const profile=state.profiles.get(project.id);
      for(const item of items){
        const chat=normalizeChat(item);chat.projectId=project.id;
        if(chat.id){
          const existing=state.chatById.get(chat.id);
          if(existing)existing.projectId=project.id;
          else {state.chats.push(chat);state.chatById.set(chat.id,chat);}
        }
        if(profile)for(const t of words(`${item?.title||''} ${item?.snippet||''}`))profile.set(t,(profile.get(t)||0)+3);
      }
    });
    setHealth('organizer','PRÊT');
  }

  async function loadData({quiet=false}={}){
    if(state.refreshRunning)return false;state.refreshRunning=true;
    try{
      const p=await rpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0');
      if(!p.ok){setHealth('bridge',`ERREUR ${p.status||p.error||''}`.trim());return false;}
      setHealth('bridge','OK');
      state.projects=extractProjects(p.data);state.projectById=new Map(state.projects.map(p=>[p.id,p]));
      setHealth('projects',state.projects.length?`OK · ${state.projects.length}`:'ERREUR · 0');

      const chats=[];let offset=0;
      for(let page=0;page<25;page++){
        const r=await rpc(`/backend-api/conversations?offset=${offset}&limit=100&order=updated&expand=true`);
        if(!r.ok||!Array.isArray(r.data?.items))break;
        chats.push(...r.data.items.map(normalizeChat).filter(c=>c.id));
        offset+=r.data.items.length;if(!r.data.items.length||offset>=Number(r.data.total||offset))break;
      }
      state.chats=chats;state.chatById=new Map(chats.map(c=>[c.id,c]));
      seedProfiles();
      if(!quiet){renderPinnedProjects();decorateSidebar();renderPanel();renderStatus();applyCurrentProjectTheme();}
      await hydrateMembershipAndProfiles();
      if(!quiet){renderPinnedProjects();decorateSidebar();renderPanel();renderStatus();applyCurrentProjectTheme();}
      return true;
    }finally{state.refreshRunning=false;}
  }

  function escapeRegex(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function scoreText(text,p){
    const s=norm(text),pn=norm(p.name);let score=0;
    if(pn.length>=3&&s.includes(pn))score+=240;
    for(const t of words(p.name))if(new RegExp(`\\b${escapeRegex(t)}\\b`,'i').test(s))score+=36;
    const f=state.profiles.get(p.id)||new Map();
    for(const t of new Set(words(text)))score+=Math.min(16,f.get(t)||0);
    return score;
  }
  function bestTarget(chat,extra=''){
    const text=`${chat.title} ${chat.snippet} ${extra}`;
    const ranked=primaryProjects().map(p=>({p,s:scoreText(text,p)})).sort((a,b)=>b.s-a.s);
    const a=ranked[0],b=ranked[1];return a?{project:a.p,score:a.s,margin:a.s-(b?.s||0)}:null;
  }
  function conversationText(data){
    const out=[];for(const node of Object.values(data?.mapping||{})){
      const m=node?.message;if(!m||!['user','assistant'].includes(m?.author?.role))continue;
      const parts=m?.content?.parts;if(Array.isArray(parts))for(const p of parts)if(typeof p==='string')out.push(p);
      if(out.join(' ').length>10000)break;
    }return out.join(' ').slice(0,10000);
  }
  async function moveChat(chat,project){
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{method:'PATCH',body:{gizmo_id:project.id}});if(!r.ok)return false;
    const v=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`);const got=String(v.data?.gizmo_id||v.data?.conversation_mode?.gizmo_id||'');
    if(got===project.id){chat.projectId=project.id;return true;}return false;
  }

  async function repairOrganization({manual=false}={}){
    if(state.organizerRunning)return;state.organizerRunning=true;setHealth('organizer','EN COURS · 0%');
    let moved=0,analysed=0,failed=0,deep=0,ambiguous=0;
    try{
      const candidates=state.chats.filter(c=>!c.projectId||isLegacy(state.projectById.get(c.projectId))).sort((a,b)=>b.updated-a.updated);
      const batch=manual?candidates:candidates.slice(0,260);
      for(let i=0;i<batch.length;i++){
        const chat=batch[i];analysed++;
        const fromLegacy=isLegacy(state.projectById.get(chat.projectId));
        let best=bestTarget(chat),threshold=fromLegacy?56:38,margin=fromLegacy?20:13;
        if(!best||best.score<threshold||best.margin<margin){
          if(deep<(manual?120:70)){
            const d=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:9000});deep++;
            if(d.ok){best=bestTarget(chat,conversationText(d.data));threshold=fromLegacy?86:64;margin=fromLegacy?25:18;}
          }
        }
        if(!best||best.score<threshold||best.margin<margin){ambiguous++;}
        else if(await moveChat(chat,best.project)){moved++;}
        else failed++;
        if(i%8===0){setHealth('organizer',`EN COURS · ${Math.round(((i+1)/Math.max(1,batch.length))*100)}% · ${moved} déplacé${moved>1?'s':''}`);await sleep(0);}
      }
      seedProfiles();
      setHealth('organizer',`OK · ${moved} déplacé${moved>1?'s':''} / ${analysed} · ${ambiguous} à revoir${failed?` · ${failed} échec${failed>1?'s':''}`:''}`);
      renderPinnedProjects();decorateSidebar();renderPanel();
      if(!manual&&candidates.length>batch.length)setTimeout(()=>repairOrganization({manual:false}),30000);
    }catch(e){setHealth('organizer',`ERREUR · ${String(e?.message||e).slice(0,90)}`);}finally{state.organizerRunning=false;}
  }

  function currentChatId(){return location.pathname.match(/\/c\/([^/?#]+)/)?.[1]||'';}
  function currentProject(){
    const slug=location.pathname.match(/\/g\/(g-p-[^/?#]+)/)?.[1]||'';
    const direct=state.projects.find(p=>slug.startsWith(p.id));if(direct)return direct;
    const chat=state.chatById.get(currentChatId());return chat?state.projectById.get(chat.projectId)||null:null;
  }
  function applyCurrentProjectTheme(){const p=currentProject();document.documentElement.style.setProperty('--ng6-current-project',p?.color||'#3794ff');document.documentElement.dataset.ng6Project=p?.id||'';}

  function navRoot(){return document.querySelector('nav')||[...document.querySelectorAll('aside')].find(x=>x.querySelector('a[href*="/c/"]'))||null;}
  function findPinnedHeading(root){return [...root.querySelectorAll('div,span,h2,h3,p')].find(x=>/^(épinglés|epingles|pinned)$/i.test((x.textContent||'').trim()));}
  function compactRow(el,root,maxH=70){
    let n=el,last=el;
    for(let i=0;i<5&&n?.parentElement&&n.parentElement!==root;i++){
      const p=n.parentElement,r=p.getBoundingClientRect();if(r.height>maxH||r.width<120)break;last=p;n=p;
    }return last;
  }
  function projectCounts(){const m=new Map(state.projects.map(p=>[p.id,0]));for(const c of state.chats)if(m.has(c.projectId))m.set(c.projectId,m.get(c.projectId)+1);return m;}
  function projectRecency(id){let t=0;for(const c of state.chats)if(c.projectId===id)t=Math.max(t,c.updated||0);return t;}
  function sortedProjects(){
    const counts=projectCounts();return [...state.projects].sort((a,b)=>{
      const la=isLegacy(a),lb=isLegacy(b);if(la!==lb)return la?1:-1;
      const ca=counts.get(a.id)||0,cb=counts.get(b.id)||0;if((ca>0)!==(cb>0))return ca>0?-1:1;
      return projectRecency(b.id)-projectRecency(a.id)||a.name.localeCompare(b.name,'fr');
    });
  }
  function nativePinnedProjectIds(){
    const root=navRoot(),heading=root&&findPinnedHeading(root);if(!root||!heading)return new Set();const ids=new Set();
    let n=heading.parentElement;for(let i=0;i<5&&n;i++,n=n.parentElement){for(const a of n.querySelectorAll('a[href*="/g/"]')){const href=a.getAttribute('href')||'';const p=state.projects.find(x=>href.includes(x.id));if(p)ids.add(p.id);}if(ids.size)break;}return ids;
  }
  function renderPinnedProjects(){
    const root=navRoot(),projects=sortedProjects();if(!root||!projects.length)return;
    document.getElementById('ng6-pinned-projects')?.remove();const counts=projectCounts(),box=document.createElement('section');box.id='ng6-pinned-projects';
    box.innerHTML=`<div class="ng6-pin-head"><span>PROJETS ÉPINGLÉS</span><b>${projects.length}</b></div><div class="ng6-pin-list">${projects.map(p=>`<a href="/g/${encodeURIComponent(p.id)}/project" data-ng6-managed-project="1" data-legacy="${isLegacy(p)?'1':'0'}" style="--ng-project:${p.color}" title="${esc(p.name)}"><span class="ng6-proj-icon">${esc(p.icon)}</span><span class="ng6-pin-name">${esc(p.name)}</span><small>${counts.get(p.id)||0}</small></a>`).join('')}</div>`;
    const heading=findPinnedHeading(root);
    if(heading){const row=compactRow(heading,root,64);row.insertAdjacentElement('afterend',box);}else{const projectsLink=[...root.querySelectorAll('a')].find(a=>/projets|projects/i.test((a.textContent||'').trim()));(projectsLink?compactRow(projectsLink,root,70):root.firstElementChild)?.insertAdjacentElement?.('afterend',box)||root.prepend(box);}
    const native=nativePinnedProjectIds();setHealth('pins',`OK · ${projects.length}/${projects.length} NiakGPT · ${native.size}/${projects.length} natifs`);
  }

  function rowForLink(link,root){
    let best=link;let n=link;
    for(let i=0;i<5&&n?.parentElement&&n.parentElement!==root;i++){
      const p=n.parentElement,r=p.getBoundingClientRect();if(r.height>=26&&r.height<=54&&r.width>=180)best=p;if(r.height>70)break;n=p;
    }return best;
  }
  function decorateSidebar(){
    const root=navRoot();if(!root)return;const counts=projectCounts();
    const links=[...root.querySelectorAll('a[href*="/c/"]')].filter(a=>!a.closest('#ng6-pinned-projects'));
    links.forEach((link,i)=>{
      const id=(link.getAttribute('href')||'').match(/\/c\/([^/?#]+)/)?.[1]||'',chat=state.chatById.get(id),p=chat?state.projectById.get(chat.projectId):null,row=rowForLink(link,root);
      row.dataset.ng6ChatRow='1';row.dataset.ng6Zebra=String(i%2);row.style.setProperty('--ng-project',p?.color||'#607080');
      link.dataset.ng6Chat='1';link.classList.toggle('ng6-current',id===currentChatId());link.style.setProperty('--ng-project',p?.color||'#607080');
      let badge=link.querySelector(':scope > .ng6-chat-project');if(p&&!badge){badge=document.createElement('span');badge.className='ng6-chat-project';link.appendChild(badge);}if(badge){badge.textContent=p?.name||'';badge.style.setProperty('--ng-project',p?.color||'#607080');badge.hidden=!p;}
    });
    [...root.querySelectorAll('a[href*="/g/"]')].filter(a=>!a.closest('#ng6-pinned-projects')).forEach(link=>{
      const p=state.projects.find(x=>(link.getAttribute('href')||'').includes(x.id));if(!p)return;const row=rowForLink(link,root);row.dataset.ng6ProjectRow='1';row.style.setProperty('--ng-project',p.color);row.dataset.ng6Icon=p.icon;row.classList.toggle('ng6-legacy',isLegacy(p));row.classList.toggle('ng6-empty-legacy',isLegacy(p)&&(counts.get(p.id)||0)===0);link.dataset.ng6Project='1';link.style.setProperty('--ng-project',p.color);
    });
  }

  async function tryNativePins(){
    const projects=sortedProjects();if(!projects.length){setHealth('pins','OK · 0');return;}let ok=0;
    const root=navRoot();if(!root)return;
    for(const p of projects){
      const already=nativePinnedProjectIds();if(already.has(p.id)){ok++;continue;}
      const link=[...root.querySelectorAll('a[href*="/g/"]')].filter(a=>!a.closest('#ng6-pinned-projects')).find(a=>(a.getAttribute('href')||'').includes(p.id));if(!link)continue;
      const row=rowForLink(link,root);row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await sleep(75);
      const buttons=[...row.querySelectorAll('button')],menu=buttons.find(b=>/more|options|menu|davantage|plus/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);if(!menu)continue;
      menu.click();await sleep(110);const item=[...document.querySelectorAll('[role="menuitem"],[role="option"]')].find(x=>/^(épingler|epingler|pin)\b/i.test((x.textContent||'').trim()));
      if(item){item.click();ok++;await sleep(120);}else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    }
    state.nativePins=ok;renderPinnedProjects();const native=nativePinnedProjectIds();setHealth('pins',`OK · ${projects.length}/${projects.length} NiakGPT · ${Math.max(ok,native.size)}/${projects.length} natifs`);
  }

  function getTurns(){const set=new Set();document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').forEach(x=>set.add(x));return [...set].filter(x=>x instanceof HTMLElement&&x.textContent?.trim());}
  function roleOf(t){return t.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';}
  function enhanceCode(root){
    root.querySelectorAll('pre').forEach(pre=>{if(pre.dataset.ng6Code)return;pre.dataset.ng6Code='1';const code=pre.querySelector('code'),cls=code?.className||'',lang=(cls.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase(),lines=(code?.innerText||pre.innerText||'').split('\n').length;
      const bar=document.createElement('div');bar.className='ng6-codebar';bar.innerHTML=`<span><i>●</i> ${esc(lang)} · ${lines} lignes</span><button type="button">COPIER</button>`;bar.querySelector('button').onclick=async()=>navigator.clipboard.writeText(code?.innerText||pre.innerText||'');pre.prepend(bar);});
  }
  function decorateTurns(){
    state.turns=getTurns();state.turns.forEach((t,i)=>{t.dataset.ng6Turn=String(i);t.dataset.ng6Role=roleOf(t)||'unknown';t.dataset.ng6Zebra=String(i%2);enhanceCode(t);});
    setHealth('toc',state.turns.length?`OK · ${state.turns.length}`:'ATTENTE');applyPerformance();if(state.panelOpen&&state.tab==='toc')renderPanel();
  }
  function applyPerformance(){
    state.io?.disconnect();state.io=new IntersectionObserver(es=>{for(const e of es)e.target.classList.toggle('ng6-offscreen',!e.isIntersecting);},{rootMargin:'1250px 0px'});const cutoff=Math.max(0,state.turns.length-10);
    state.turns.forEach((t,i)=>{t.classList.add('ng6-perf');if(i<cutoff)state.io.observe(t);t.querySelectorAll('img').forEach(img=>img.loading='lazy');});setHealth('performance','OK');
  }

  function findComposer(){
    const editors=[...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>240&&r.height>18&&r.bottom>innerHeight*.45;});
    const editor=editors.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];if(!editor)return null;
    const form=editor.closest('form')||editor.closest('[data-type="unified-composer"]')||editor.closest('[class*="composer"]')||editor.parentElement;return {editor,form,shell:form?.parentElement||form};
  }
  function editorText(e){return e instanceof HTMLTextAreaElement?e.value:(e.innerText||e.textContent||'');}
  function recentContext(){return state.turns.slice(-5).map(t=>t.innerText||t.textContent||'').join(' ').slice(-6500);}
  function subjectFrom(prompt){const clean=String(prompt||'').replace(/\s+/g,' ').trim();if(!clean)return'ce point';const clauses=clean.split(/[.!?;\n]+/).map(x=>x.trim()).filter(Boolean);let c=clauses.at(-1)||clean;return c.length>78?c.slice(0,75)+'…':c;}
  function suggestionSet(prompt){
    const context=norm(`${prompt} ${recentContext()}`),pn=norm(prompt),subject=subjectFrom(prompt),project=currentProject(),scope=project?` dans « ${project.name} »`:'';const out=[];const add=(kind,title,text)=>{if(!out.some(x=>x.text===text))out.push({kind,title,text});};
    if(/bug|erreur|marche pas|fonctionne pas|chevauch|overlap|dom|extension|javascript|css|code/.test(context)){add('code','Cause racine',`Pour « ${subject} », identifie d’abord la cause racine${scope}, puis applique le correctif minimal robuste.`);add('test','Tests runtime',`Teste « ${subject} » avec navigation SPA, long fil, resize et pièces jointes avant de conclure.`);add('perf','Régression',`Vérifie que « ${subject} » n’ajoute ni double injection, ni boucle d’observer, ni reflow coûteux.`);}
    if(/image|photo|fichier|piece jointe|upload|attachment/.test(context))add('ux','Pièces jointes',`Pour « ${subject} », adapte l’UI aux previews sans recouvrir le composer ni les médias.`);
    if(/design|da|couleur|fond|interface|ux|ui|styl|icone/.test(context)){add('design','DA système',`Pour « ${subject} », harmonise couleurs, fonds, icônes, hover, actif et exécution comme un seul langage visuel.`);add('ux','Lisibilité',`Sur « ${subject} », garde contraste, densité et scan visuel prioritaires sur l’effet décoratif.`);}
    if(/projet|project|class|rang|dossier|organis|epingle|pin/.test(context)){add('organize','Organisation',`Pour « ${subject} », protège les Projects fiables, répare les catégories génériques et vérifie chaque déplacement.`);add('table','Audit',`Présente l’état de « ${subject} » avec compteurs : classés, déplacés, ambigus, natifs et accessibles.`);}
    if(/cherche|verifie|actuel|recent|prix|tarif|loi|regle|source/.test(context))add('research','Sources',`Pour « ${subject} », vérifie les informations actuelles avec des sources primaires et date les éléments instables.`);
    if(/compar| vs |versus/.test(` ${context} `))add('table','Comparaison',`Compare « ${subject} » dans un tableau dense : critères, avantages, limites, coût, risque et décision.`);
    if(/long|resume|synthese|trop long/.test(context))add('summary','Synthèse',`Pour « ${subject} », commence par la conclusion courte puis garde seulement les détails qui changent la décision.`);
    if(!out.length&&pn.length>3){add('focus','Objectif',`Traite précisément « ${subject} »${scope} et élimine tout ce qui n’aide pas la décision ou l’exécution.`);add('blind','Angles morts',`Sur « ${subject} », signale les hypothèses et angles morts capables de changer le résultat.`);add('action','Prochaine action',`Termine « ${subject} » par l’action concrète la plus utile à faire maintenant.`);}
    return out.slice(0,4);
  }
  function appendPrompt(editor,text){
    editor.focus();if(editor instanceof HTMLTextAreaElement){const sep=editor.value.trim()?'\n\n':'',s=editor.selectionStart??editor.value.length,e=editor.selectionEnd??editor.value.length;editor.setRangeText(`${sep}${text}`,s,e,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));return;}
    const sel=getSelection(),r=document.createRange();r.selectNodeContents(editor);r.collapse(false);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,`${editorText(editor).trim()?'\n\n':''}${text}`);editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
  }
  function ensureCoach(){
    const c=findComposer();if(!c?.editor||!c.form||!c.shell){setHealth('coach','ATTENTE');return;}
    let box=document.getElementById('ng6-coach');if(box&&box.parentElement!==c.shell){box.remove();box=null;}if(!box){box=document.createElement('div');box.id='ng6-coach';c.shell.insertBefore(box,c.form);}
    const prompt=editorText(c.editor),items=suggestionSet(prompt),attachments=c.form.querySelectorAll('img,[data-testid*="attachment"],[class*="attachment"],[data-testid*="file"],[class*="file"]:not(input)').length;
    box.classList.toggle('compact',attachments>0||c.form.getBoundingClientRect().height>185);box.dataset.attachments=String(attachments);box.hidden=prompt.trim().length<4||!items.length;
    box.innerHTML=`<div class="ng6-coach-label">✦ NIAKGPT · RECO${attachments?` · ${attachments} PJ`:''}</div><div class="ng6-sug-grid">${items.map((x,i)=>`<button type="button" data-i="${i}" class="ng6-sug ng6-${x.kind}"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>appendPrompt(c.editor,items[Number(b.dataset.i)].text));setHealth('coach','OK');
  }

  function ensureMatrix(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setHealth('matrix','OFF');return;}const host=document.querySelector('main')||document.body;if(!host)return;
    if(state.matrix?.isConnected&&state.matrix.parentElement===host)return;state.matrix?.remove();if(state.matrixRAF)cancelAnimationFrame(state.matrixRAF);
    const canvas=document.createElement('canvas');canvas.id='ng6-matrix';host.prepend(canvas);state.matrix=canvas;const ctx=canvas.getContext('2d',{alpha:true});let cols=[],w=0,h=0;
    const resize=()=>{const r=host.getBoundingClientRect(),scale=.52;w=canvas.width=Math.max(1,Math.floor(r.width*scale));h=canvas.height=Math.max(1,Math.floor(innerHeight*scale));canvas.style.width=`${Math.max(1,r.width)}px`;canvas.style.height=`${innerHeight}px`;cols=Array(Math.ceil(w/10)).fill(0).map(()=>Math.random()*h);};resize();state.matrixResize=resize;
    const chars='01アイウエオカキクケコｱｲｳｴｵ<>[]{}▓░λΣ∞';
    const draw=t=>{state.matrixRAF=requestAnimationFrame(draw);if(document.hidden||t-state.lastFrame<52)return;state.lastFrame=t;ctx.fillStyle='rgba(3,9,7,.11)';ctx.fillRect(0,0,w,h);ctx.font='10px ui-monospace,Consolas,monospace';
      for(let i=0;i<cols.length;i++){const bright=Math.random()>.978;ctx.fillStyle=bright?'rgba(190,255,205,.86)':'rgba(38,235,94,.48)';ctx.fillText(chars[(Math.random()*chars.length)|0],i*10,cols[i]);cols[i]+=8.2;if(cols[i]>h&&Math.random()>.965)cols[i]=0;}}
    state.matrixRAF=requestAnimationFrame(draw);setHealth('matrix','OK');
  }
  function botSVG(){return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l8 11-3 25-9 8H22l-9-8-3-25z" fill="#8b949e" stroke="#d0d7de" stroke-width="2"/><path d="M18 19h28l4 7-5 10H19l-5-10z" fill="#151b22"/><circle cx="24" cy="28" r="4" fill="#ff3b30"/><circle cx="40" cy="28" r="4" fill="#ff3b30"/><path d="M24 41h16v10H24z" fill="#343b43"/><path d="M27 43v6m5-6v6m5-6v6" stroke="#c7d0d9" stroke-width="2"/></svg>`;}
  function ensureBots(){if(!document.body||document.getElementById('ng6-bot-a'))return;for(const [id,title]of[['ng6-bot-a',"I'll be back."],['ng6-bot-b','Skynet online.'],['ng6-bot-c','T-800-ish.']]){const d=document.createElement('div');d.id=id;d.className='ng6-bot';d.innerHTML=botSVG();d.title=title;document.body.appendChild(d);}}

  function brand(){
    if(document.title.includes('ChatGPT'))document.title=document.title.replace(/ChatGPT/g,'NiakGPT');
    const candidates=[...document.querySelectorAll('header a,header button,header span,nav a,nav button,nav span')].filter(el=>{const r=el.getBoundingClientRect(),txt=(el.textContent||'').trim();return r.top<85&&r.left<330&&r.width&&r.height&&/^chatgpt(?:\s+(plus|pro|go|free))?$/i.test(txt);});
    const el=candidates.sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width)[0];if(el){el.textContent='NiakGPT';el.dataset.ng6Brand='1';}
  }

  function isGenerating(){return [...document.querySelectorAll('button,[data-testid]')].filter(el=>el.getBoundingClientRect().width).some(el=>/stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''}`));}
  function markRunning(){
    state.wasGenerating=state.generation;state.generation=isGenerating();document.documentElement.dataset.ng6Running=state.generation?'1':'0';const p=currentProject(),cid=currentChatId();
    document.querySelectorAll('[data-ng6-managed-project="1"],[data-ng6-project-row="1"]').forEach(x=>x.classList.toggle('ng6-running',!!state.generation&&!!p&&((x.getAttribute('href')||'').includes(p.id)||(x.querySelector?.(`a[href*="${p.id}"]`)))));document.querySelectorAll('[data-ng6-chat="1"],[data-ng6-chat-row="1"]').forEach(x=>x.classList.toggle('ng6-running',!!state.generation&&!!cid&&((x.getAttribute('href')||'').includes(cid)||x.querySelector?.(`a[href*="${cid}"]`))));
    if(state.wasGenerating&&!state.generation)setTimeout(async()=>{const ok=await loadData({quiet:true});if(ok)repairOrganization({manual:false});},1800);renderStatus();
  }

  function ensureShell(){
    if(!document.body||document.getElementById('ng6-rail'))return;const rail=document.createElement('aside');rail.id='ng6-rail';rail.innerHTML=`<button data-tab="explorer" title="Explorer / Projects">▤</button><button data-tab="toc" title="Sommaire">☷</button><button data-tab="diag" title="Diagnostic">◉</button><span></span><button data-action="quick" title="Quick Open · Alt+K">⌘</button>`;document.body.appendChild(rail);
    const panel=document.createElement('aside');panel.id='ng6-panel';document.body.appendChild(panel);const status=document.createElement('div');status.id='ng6-status';document.body.appendChild(status);document.body.classList.add('ng6-ready');
    rail.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const tab=b.dataset.tab;state.panelOpen=!(state.panelOpen&&state.tab===tab);state.tab=tab;renderPanel();});rail.querySelector('[data-action="quick"]').onclick=openQuick;setHealth('ui','OK');
  }
  function renderStatus(){
    const s=document.getElementById('ng6-status');if(!s)return;const p=currentProject(),err=Object.values(state.health).some(v=>String(v).startsWith('ERREUR'));s.classList.toggle('running',state.generation);s.innerHTML=`<span><b>NiakGPT</b> ${VERSION}</span><span class="ng6-status-project">${esc(p?.name||'Hors projet')}</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng6-health">${state.generation?'EXÉCUTION':err?'DIAGNOSTIC':'PRÊT'}</span>`;s.querySelector('[data-q]').onclick=openQuick;applyCurrentProjectTheme();
  }
  function renderPanel(){
    const panel=document.getElementById('ng6-panel');if(!panel)return;panel.classList.toggle('open',state.panelOpen);document.body.classList.toggle('ng6-panel-open',state.panelOpen);document.querySelectorAll('#ng6-rail [data-tab]').forEach(b=>b.classList.toggle('active',state.panelOpen&&b.dataset.tab===state.tab));if(!state.panelOpen)return;
    if(state.tab==='diag')panel.innerHTML=`<header><div><small>DIAGNOSTIC</small><b>État des modules</b></div><button>×</button></header><div class="ng6-diag">${Object.entries(state.health).map(([k,v])=>`<div><span>${esc(k)}</span><b class="${String(v).startsWith('OK')?'ok':String(v).startsWith('ERREUR')?'err':'wait'}">${esc(v)}</b></div>`).join('')}</div><div class="ng6-private-joke">☠ SYSTEM // SKYNET</div>`;
    else if(state.tab==='toc')panel.innerHTML=`<header><div><small>SOMMAIRE</small><b>${state.turns.length} blocs</b></div><button>×</button></header><input id="ng6-toc-search" placeholder="Filtrer le fil…"><div class="ng6-toc">${state.turns.map((t,i)=>`<button data-turn="${i}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc((t.innerText||t.textContent||'').replace(/\s+/g,' ').slice(0,125))}</span></button>`).join('')}</div>`;
    else{const counts=projectCounts(),primary=primaryProjects(),legacy=state.projects.filter(isLegacy),empty=legacy.filter(p=>(counts.get(p.id)||0)===0).length;panel.innerHTML=`<header><div><small>EXPLORER</small><b>Projects · ${state.projects.length}</b></div><button>×</button></header><div class="ng6-actions"><button data-repair>Réparer tout</button><button data-refresh>Rafraîchir</button></div><div class="ng6-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${primary.map(p=>`<a href="/g/${p.id}/project" style="--ng-project:${p.color}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><b>${counts.get(p.id)||0}</b></a>`).join('')}</div>${legacy.length?`<details class="ng6-legacy"><summary>LEGACY / À NETTOYER <b>${legacy.length}${empty?` · ${empty} vides`:''}</b></summary><div class="ng6-project-table">${legacy.map(p=>`<a href="/g/${p.id}/project" style="--ng-project:${p.color}" class="${(counts.get(p.id)||0)===0?'empty':''}"><i>${esc(p.icon)}</i><span>${esc(p.name)}</span><b>${counts.get(p.id)||0}</b></a>`).join('')}</div></details>`:''}`;}
    panel.querySelector('header button')?.addEventListener('click',()=>{state.panelOpen=false;renderPanel();});panel.querySelector('[data-repair]')?.addEventListener('click',()=>repairOrganization({manual:true}));panel.querySelector('[data-refresh]')?.addEventListener('click',async()=>{const ok=await loadData();if(ok){repairOrganization({manual:false});tryNativePins();}});panel.querySelectorAll('[data-turn]').forEach(b=>b.onclick=()=>state.turns[Number(b.dataset.turn)]?.scrollIntoView({behavior:'smooth',block:'center'}));const q=panel.querySelector('#ng6-toc-search');if(q)q.oninput=()=>{const n=norm(q.value);panel.querySelectorAll('[data-turn]').forEach(b=>b.hidden=!!n&&!norm(b.textContent).includes(n));};
  }

  function nativeConversationLink(id){return [...document.querySelectorAll(`a[href*="/c/${CSS.escape(id)}"]`)].find(a=>!a.closest('#ng6-quick,#ng6-panel,#ng6-pinned-projects'))||null;}
  function navigateChat(chat){const a=nativeConversationLink(chat.id);if(a){a.click();return;}location.href=chat.projectId?`/g/${chat.projectId}/c/${chat.id}`:`/c/${chat.id}`;}
  async function prefetch(chat){if(!chat?.id||state.prefetched.has(chat.id))return;state.prefetched.add(chat.id);await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:6000});}
  function openQuick(){
    document.getElementById('ng6-quick')?.remove();const modal=document.createElement('div');modal.id='ng6-quick';modal.innerHTML=`<div><input autofocus placeholder="Quick Open — conversations & Projects"><section></section><footer>Alt+K · ↑↓ · Entrée · Échap</footer></div>`;document.body.appendChild(modal);const input=modal.querySelector('input'),list=modal.querySelector('section');let items=[],sel=0;
    const paint=()=>{const q=norm(input.value);items=state.chats.filter(c=>!q||norm(`${c.title} ${state.projectById.get(c.projectId)?.name||''}`).includes(q)).sort((a,b)=>b.updated-a.updated).slice(0,60);sel=Math.min(sel,Math.max(0,items.length-1));list.innerHTML=items.map((c,i)=>{const p=state.projectById.get(c.projectId);return `<button class="${i===sel?'sel':''}" data-i="${i}"><i style="--ng-project:${p?.color||'#607080'}"></i><span>${esc(c.title)}</span><small>${esc(p?.name||'Hors projet')}</small></button>`;}).join('');list.querySelectorAll('button').forEach(b=>{const c=items[Number(b.dataset.i)];b.onmouseenter=()=>prefetch(c);b.onclick=()=>navigateChat(c);});};
    input.oninput=()=>{sel=0;paint();};input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,items.length-1);paint();}if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}if(e.key==='Enter'&&items[sel]){e.preventDefault();navigateChat(items[sel]);}if(e.key==='Escape')modal.remove();};modal.onmousedown=e=>{if(e.target===modal)modal.remove();};paint();setTimeout(()=>input.focus(),0);
  }

  function scan(){if(!document.body)return;ensureShell();brand();ensureMatrix();ensureBots();decorateTurns();decorateSidebar();renderPinnedProjects();ensureCoach();markRunning();renderStatus();applyCurrentProjectTheme();}
  function scheduleScan(delay=120){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(scan,delay);}
  function scheduleRouteRefresh(delay=2300){clearTimeout(state.routeTimer);state.routeTimer=setTimeout(async()=>{const ok=await loadData();if(ok){await repairOrganization({manual:false});setTimeout(tryNativePins,500);}},delay);}

  function bindRuntime(){
    if(state.observer)return;state.observer=new MutationObserver(()=>{if(location.pathname!==state.lastPath){state.lastPath=location.pathname;scheduleScan(40);scheduleRouteRefresh(1600);}else scheduleScan(100);});state.observer.observe(document.documentElement,{subtree:true,childList:true});
    document.addEventListener('input',e=>{if(e.target?.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||e.target?.isContentEditable){clearTimeout(state.coachTimer);state.coachTimer=setTimeout(ensureCoach,60);}},true);
    document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();openQuick();}},true);
    addEventListener('resize',()=>{state.matrixResize?.();scheduleScan(60);},{passive:true});setInterval(markRunning,600);setInterval(async()=>{const ok=await loadData({quiet:true});if(ok)repairOrganization({manual:false});},5*60*1000);
  }

  async function initAfterBody(){
    ensureShell();ensureMatrix();ensureBots();brand();bindRuntime();
    for(let i=0;i<12;i++)setTimeout(scan,i*180);
    const ok=await loadData();if(ok){repairOrganization({manual:false});setTimeout(tryNativePins,900);}
  }
  function bootstrap(){
    if(document.body){initAfterBody();return;}
    const mo=new MutationObserver(()=>{if(document.body){mo.disconnect();initAfterBody();}});mo.observe(document.documentElement,{childList:true,subtree:true});
  }
  bootstrap();
})();
