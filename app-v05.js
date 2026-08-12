(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_V05__) return;
  window.__NIAKGPT_V05__ = true;

  const VERSION = '0.5.0';
  const GENERIC = new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food']);
  const STOP = new Set('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi'.split(/\s+/));
  const PALETTE = ['#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955'];
  const state = {
    projects: [], chats: [], projectById: new Map(), profiles: new Map(),
    health: { bridge:'ATTENTE', projects:'ATTENTE', organizer:'ATTENTE', coach:'ATTENTE', toc:'ATTENTE', performance:'ATTENTE', pins:'ATTENTE', matrix:'ATTENTE', ui:'ATTENTE' },
    turns: [], generation:false, organizerRunning:false, nativePins:0,
    panelOpen:false, tab:'explorer', scanTimer:0, coachTimer:0, lastPath:location.pathname,
    observer:null, io:null, matrix:null, matrixRAF:0, lastFrame:0, prefetched:new Set()
  };

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  function colorFor(name){ let h=0; for(const c of String(name)) h=((h<<5)-h+c.charCodeAt(0))|0; return PALETTE[Math.abs(h)%PALETTE.length]; }
  function iconFor(name){ const s=norm(name); if(/code|dev|tech|web|api|github|program/.test(s))return '</>'; if(/legal|jurid|droit|prud|tribunal/.test(s))return '§'; if(/finance|argent|budget|banque|credit/.test(s))return '€'; if(/film|cinema|movie|serie|anime/.test(s))return '▶'; if(/design|logo|image|creative/.test(s))return '◇'; if(/shop|commerce|store|product|produit/.test(s))return '▣'; if(/ai|ia|gpt|elias/.test(s))return '✦'; if(/auto|car|voiture/.test(s))return '◈'; if(/health|sante/.test(s))return '+'; if(/game|gaming|jeu/.test(s))return '◆'; return '▤'; }
  function setHealth(k,v){ state.health[k]=v; renderStatus(); if(state.panelOpen&&state.tab==='diag') renderPanel(); }

  let rpcSeq=0;
  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng5-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'timeout'});},timeout);
      const handler=e=>{ if(e.detail?.id!==id)return; cleanup(); resolve(e.detail); };
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body}}));
    });
  }

  function extractProjects(payload){
    const out=new Map(), seen=new WeakSet();
    function walk(x){
      if(!x||typeof x!=='object'||seen.has(x))return; seen.add(x);
      for(const g of [x,x.gizmo,x.gizmo?.gizmo].filter(Boolean)){
        const id=String(g.id||''), name=String(g.display?.name||g.name||'').trim();
        if(id.startsWith('g-p-')&&name) out.set(id,{id,name,description:String(g.display?.description||''),instructions:String(g.instructions||''),color:colorFor(name),icon:iconFor(name)});
      }
      if(Array.isArray(x))x.forEach(walk); else Object.values(x).forEach(walk);
    }
    walk(payload); return [...out.values()];
  }
  function chatOf(x){ return {id:String(x?.id||x?.conversation_id||''),title:String(x?.title||x?.conversation_title||'Conversation sans titre'),projectId:String(x?.gizmo_id||x?.conversation_mode?.gizmo_id||''),snippet:String(x?.snippet||''),updated:Number(x?.update_time||x?.create_time||0)}; }

  async function loadData(){
    const p=await rpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0');
    if(!p.ok){ setHealth('bridge',`ERREUR ${p.status||''}`.trim()); return false; }
    setHealth('bridge','OK');
    state.projects=extractProjects(p.data); state.projectById=new Map(state.projects.map(x=>[x.id,x]));
    setHealth('projects',state.projects.length?`OK · ${state.projects.length}`:'ERREUR · 0');
    const all=[]; let offset=0;
    for(let page=0;page<20;page++){
      const r=await rpc(`/backend-api/conversations?offset=${offset}&limit=100&order=updated&expand=true`);
      if(!r.ok||!Array.isArray(r.data?.items)) break;
      all.push(...r.data.items.map(chatOf).filter(c=>c.id));
      offset+=r.data.items.length;
      if(!r.data.items.length||offset>=Number(r.data.total||offset))break;
    }
    state.chats=all;
    await buildProfiles();
    renderPinnedProjects(); decorateSidebar(); renderPanel(); renderStatus();
    return true;
  }

  async function buildProfiles(){
    const prof=new Map();
    for(const p of state.projects){
      const f=new Map();
      const add=(txt,w)=>{ for(const t of words(txt)) f.set(t,(f.get(t)||0)+w); };
      add(p.name,24); add(p.description,8); add(p.instructions,6); prof.set(p.id,f);
    }
    for(const c of state.chats){ const f=prof.get(c.projectId); if(!f)continue; for(const t of words(`${c.title} ${c.snippet}`)) f.set(t,(f.get(t)||0)+2); }
    for(const p of state.projects.filter(x=>!GENERIC.has(norm(x.name))).slice(0,32)){
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(p.id)}/conversations?cursor=0&limit=50`,{timeout:9000});
      if(r.ok&&Array.isArray(r.data?.items)){
        const f=prof.get(p.id); for(const item of r.data.items) for(const t of words(`${item?.title||''} ${item?.snippet||''}`)) f.set(t,(f.get(t)||0)+3);
      }
      await sleep(18);
    }
    state.profiles=prof;
  }

  function scoreText(text,p){
    const s=norm(text), pn=norm(p.name); let score=0;
    if(pn.length>=3&&s.includes(pn)) score+=180;
    const pt=words(p.name);
    for(const t of pt){ if(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(s)) score+=28; }
    const f=state.profiles.get(p.id)||new Map();
    for(const t of new Set(words(text))) score+=Math.min(14,f.get(t)||0);
    return score;
  }
  function targetFor(chat,textExtra=''){
    const txt=`${chat.title} ${chat.snippet} ${textExtra}`;
    const ranked=state.projects.filter(p=>!GENERIC.has(norm(p.name))).map(p=>({p,s:scoreText(txt,p)})).sort((a,b)=>b.s-a.s);
    const a=ranked[0],b=ranked[1]; if(!a)return null;
    return {project:a.p,score:a.s,margin:a.s-(b?.s||0)};
  }
  function conversationText(data){
    const out=[]; const mapping=data?.mapping||{};
    for(const node of Object.values(mapping)){
      const m=node?.message; if(!m||!['user','assistant'].includes(m?.author?.role))continue;
      const parts=m?.content?.parts; if(Array.isArray(parts)) for(const p of parts) if(typeof p==='string') out.push(p);
      if(out.join(' ').length>7000)break;
    }
    return out.join(' ').slice(0,7000);
  }
  async function moveChat(chat,project){
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{method:'PATCH',body:{gizmo_id:project.id}});
    if(!r.ok)return false;
    const v=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`);
    const got=String(v.data?.gizmo_id||v.data?.conversation_mode?.gizmo_id||'');
    if(got===project.id){chat.projectId=project.id;return true;} return false;
  }

  async function repairOrganization({manual=false}={}){
    if(state.organizerRunning)return;
    state.organizerRunning=true; setHealth('organizer','EN COURS');
    let moved=0, analysed=0, deep=0;
    const candidates=state.chats.filter(c=>!c.projectId||GENERIC.has(norm(state.projectById.get(c.projectId)?.name))).sort((a,b)=>b.updated-a.updated);
    for(const chat of candidates.slice(0,manual?140:80)){
      analysed++;
      const current=state.projectById.get(chat.projectId); const generic=!!current&&GENERIC.has(norm(current.name));
      let best=targetFor(chat); let threshold=generic?44:30, margin=generic?16:11;
      if(!best||best.score<threshold||best.margin<margin){
        if(deep<35){
          const d=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:9000}); deep++;
          if(d.ok){ best=targetFor(chat,conversationText(d.data)); threshold=generic?70:54; margin=generic?22:16; }
        }
      }
      if(!best||best.score<threshold||best.margin<margin)continue;
      if(await moveChat(chat,best.project)){moved++; await sleep(90);}
    }
    state.organizerRunning=false;
    await buildProfiles(); renderPinnedProjects(); decorateSidebar(); renderPanel();
    setHealth('organizer',`OK · ${moved} déplacé${moved>1?'s':''} / ${analysed}`);
  }

  function navRoot(){ return document.querySelector('nav')||[...document.querySelectorAll('aside')].find(x=>x.querySelector('a[href*="/c/"]'))||null; }
  function findPinnedHeading(root){ return [...root.querySelectorAll('div,span,h2,h3')].find(x=>/^épinglés$|^epingles$|^pinned$/i.test((x.textContent||'').trim())); }
  function renderPinnedProjects(){
    const root=navRoot(); if(!root||!state.projects.length)return;
    let box=document.getElementById('ng5-pinned-projects'); if(box)box.remove();
    box=document.createElement('div'); box.id='ng5-pinned-projects';
    box.innerHTML=`<div class="ng5-pinned-label">PROJETS · ${state.projects.length}</div>${state.projects.map(p=>`<a href="/g/${encodeURIComponent(p.id)}/project" data-ng5-project="1" style="--ng-project:${p.color}" title="${esc(p.name)}"><span class="ng5-proj-icon">${esc(p.icon)}</span><span>${esc(p.name)}</span></a>`).join('')}`;
    const heading=findPinnedHeading(root);
    if(heading){ const host=heading.parentElement||heading; host.insertAdjacentElement('afterend',box); }
    else root.prepend(box);
    setHealth('pins',`OK · ${state.projects.length}/${state.projects.length} visibles${state.nativePins?` · ${state.nativePins} natifs`:''}`);
  }

  async function tryNativePins(){
    const root=navRoot(); if(!root)return;
    let ok=0;
    const links=[...root.querySelectorAll('a[href*="/g/"]')].filter(a=>!a.closest('#ng5-pinned-projects'));
    for(const p of state.projects){
      const link=links.find(a=>(a.getAttribute('href')||'').includes(p.id)); if(!link)continue;
      let x=link, already=false;
      for(let i=0;i<5&&x;i++,x=x.parentElement){ if(/épinglés|epingles|pinned/i.test(x.parentElement?.innerText||'')){already=true;break;} }
      if(already){ok++;continue;}
      const row=link.closest('li,[data-testid]')||link.parentElement; if(!row)continue;
      row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); await sleep(70);
      const buttons=[...row.querySelectorAll('button')]; const menu=buttons.find(b=>/more|options|menu|davantage|plus/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);
      if(!menu)continue; menu.click(); await sleep(100);
      const item=[...document.querySelectorAll('[role="menuitem"],[role="option"]')].find(i=>/^(épingler|epingler|pin)\b/i.test((i.textContent||'').trim()));
      if(item){item.click();ok++;await sleep(120);} else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    }
    state.nativePins=ok; renderPinnedProjects();
  }

  function currentChatId(){return location.pathname.match(/\/c\/([^/?#]+)/)?.[1]||'';}
  function currentProject(){ const slug=location.pathname.match(/\/g\/(g-p-[^/?#]+)/)?.[1]||''; return state.projects.find(p=>slug.startsWith(p.id))||null; }
  function decorateSidebar(){
    const root=navRoot(); if(!root)return;
    const chats=[...root.querySelectorAll('a[href*="/c/"]')].filter(a=>!a.closest('#ng5-pinned-projects'));
    chats.forEach((a,i)=>{
      const id=(a.getAttribute('href')||'').match(/\/c\/([^/?#]+)/)?.[1]||''; const c=state.chats.find(x=>x.id===id); const p=c?state.projectById.get(c.projectId):null;
      a.dataset.ng5Chat='1'; a.dataset.ng5Zebra=String(i%2); a.style.setProperty('--ng-project',p?.color||'#607080'); a.classList.toggle('ng5-current',id===currentChatId());
    });
    [...root.querySelectorAll('a[href*="/g/"]')].filter(a=>!a.closest('#ng5-pinned-projects')).forEach(a=>{
      const p=state.projects.find(p=>(a.getAttribute('href')||'').includes(p.id)); if(!p)return;
      a.dataset.ng5Project='1'; a.dataset.ng5Icon=p.icon; a.style.setProperty('--ng-project',p.color);
    });
  }

  function turns(){ const set=new Set(); document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').forEach(x=>set.add(x)); return [...set].filter(x=>x instanceof HTMLElement&&x.textContent?.trim()); }
  function roleOf(t){return t.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';}
  function decorateTurns(){
    state.turns=turns();
    state.turns.forEach((t,i)=>{ const role=roleOf(t); t.dataset.ng5Turn=String(i); t.dataset.ng5Role=role||'unknown'; t.dataset.ng5Zebra=String(i%2); enhanceCode(t); });
    setHealth('toc',state.turns.length?`OK · ${state.turns.length}`:'ATTENTE'); applyPerformance(); if(state.panelOpen&&state.tab==='toc')renderPanel();
  }
  function enhanceCode(root){
    root.querySelectorAll('pre').forEach(pre=>{ if(pre.dataset.ng5Code)return; pre.dataset.ng5Code='1'; const code=pre.querySelector('code'); const cls=code?.className||''; const lang=(cls.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase(); const lines=(code?.innerText||pre.innerText||'').split('\n').length; const bar=document.createElement('div'); bar.className='ng5-codebar'; bar.innerHTML=`<span>${esc(lang)} · ${lines} lignes</span><button type="button">COPIER</button>`; bar.querySelector('button').onclick=async()=>{await navigator.clipboard.writeText(code?.innerText||pre.innerText||'');}; pre.prepend(bar); });
  }
  function applyPerformance(){
    state.io?.disconnect(); state.io=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('ng5-offscreen',!e.isIntersecting)),{rootMargin:'1000px 0px'});
    const cutoff=Math.max(0,state.turns.length-8); state.turns.forEach((t,i)=>{t.classList.add('ng5-perf'); if(i<cutoff)state.io.observe(t); t.querySelectorAll('img').forEach(img=>img.loading='lazy');});
    setHealth('performance','OK');
  }

  function findComposer(){ const ed=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea'); if(!ed)return null; const form=ed.closest('form')||ed.closest('[data-type="unified-composer"]'); return {ed,form:form||ed.parentElement}; }
  function editorText(ed){return ed instanceof HTMLTextAreaElement?ed.value:(ed.innerText||ed.textContent||'');}
  function recentContext(){ return state.turns.slice(-4).map(t=>t.innerText||t.textContent||'').join(' ').slice(-5000); }
  function suggestionSet(prompt){
    const s=norm(`${prompt} ${recentContext()}`), p=norm(prompt), out=[]; const add=(k,t,d)=>{if(!out.some(x=>x.t===t))out.push({k,t,d});};
    if(/bug|erreur|marche pas|fonctionne pas|chevauch|overlap|dom|extension|javascript|css|code/.test(s)){
      add('code','Cause racine','Inspecte d’abord le DOM réel et la cause racine avant de modifier le code.'); add('test','Tests UI','Teste le correctif avec long fil, pièces jointes, redimensionnement et navigation SPA.'); add('perf','Régression','Vérifie que le correctif ne crée ni observer en boucle, ni reflow, ni double injection.');
    }
    if(/image|photo|fichier|piece jointe|upload|attachment/.test(s)) add('ux','Pièces jointes','Fais en sorte que l’UI reste dans le flux et se redimensionne automatiquement avec les pièces jointes.');
    if(/design|da|couleur|fond|interface|ux|ui|styl/.test(s)){ add('design','DA complète','Traite couleurs, contrastes, états, densité, hover, actif et responsive comme un système cohérent.'); add('ux','Lisibilité','Privilégie la hiérarchie visuelle et la lisibilité avant les effets décoratifs.'); }
    if(/projet|project|class|rang|dossier|organis|epingle|pin/.test(s)){ add('organize','Organisation','Protège les vrais Projects et ne reclasse automatiquement que les chats non classés ou dans des catégories génériques.'); add('test','Vérification','Après chaque déplacement, vérifie via l’API que le Project cible est réellement appliqué.'); }
    if(/cherche|verifie|actuel|recent|prix|tarif|loi|regle/.test(s)){add('research','Sources','Vérifie les informations actuelles avec des sources primaires et date les éléments susceptibles d’évoluer.');}
    if(/compar| vs |versus/.test(` ${s} `)){add('table','Tableau','Compare dans un tableau dense : critères, avantages, limites, coût, risque et recommandation.');}
    if(/long|resume|synthese|trop long/.test(s)){add('summary','Synthèse','Commence par une synthèse courte puis garde uniquement les détails décisionnels.');}
    if(!out.length&&p.length>3){ add('focus','Objectif','Réponds d’abord à l’objectif exact, puis détaille uniquement ce qui change la décision.'); add('blind','Angles morts','Signale les hypothèses et angles morts qui pourraient rendre la conclusion fausse.'); }
    return out.slice(0,4);
  }
  function appendPrompt(ed,text){ ed.focus(); if(ed instanceof HTMLTextAreaElement){ const v=ed.value,sep=v.trim()?'\n\n':''; ed.value=v+sep+text; ed.dispatchEvent(new Event('input',{bubbles:true})); } else { const sel=getSelection(),r=document.createRange();r.selectNodeContents(ed);r.collapse(false);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,(editorText(ed).trim()?'\n\n':'')+text);ed.dispatchEvent(new InputEvent('input',{bubbles:true})); } }
  function ensureCoach(){
    const c=findComposer(); if(!c?.ed||!c.form){setHealth('coach','ATTENTE');return;}
    let box=document.getElementById('ng5-coach'); if(box&&box.parentElement!==c.form.parentElement)box.remove();
    if(!box){box=document.createElement('div');box.id='ng5-coach';c.form.parentElement?.insertBefore(box,c.form);}
    const txt=editorText(c.ed), items=suggestionSet(txt); const attachments=!!c.form.querySelector('img,[data-testid*="attachment"],[class*="attachment"]');
    box.classList.toggle('compact',attachments||c.form.getBoundingClientRect().height>150); box.hidden=txt.trim().length<4;
    box.innerHTML=items.map((x,i)=>`<button type="button" data-i="${i}" class="ng5-sug ng5-${x.k}"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></button>`).join('');
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>appendPrompt(c.ed,items[Number(b.dataset.i)].d)); setHealth('coach','OK');
  }

  function ensureMatrix(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setHealth('matrix','OFF');return;}
    if(state.matrix)return; const canvas=document.createElement('canvas');canvas.id='ng5-matrix';document.body.appendChild(canvas);state.matrix=canvas; const ctx=canvas.getContext('2d',{alpha:true}); let cols=[],w=0,h=0;
    const resize=()=>{const scale=.45;w=canvas.width=Math.floor(innerWidth*scale);h=canvas.height=Math.floor(innerHeight*scale);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';const cw=11;cols=Array(Math.ceil(w/cw)).fill(0).map(()=>Math.random()*h);}; resize(); addEventListener('resize',resize,{passive:true});
    const chars='01アイウエオカキクケコｱｲｳｴｵ<>[]{}▓░';
    const draw=t=>{state.matrixRAF=requestAnimationFrame(draw);if(document.hidden||t-state.lastFrame<55)return;state.lastFrame=t;ctx.fillStyle='rgba(7,12,16,.12)';ctx.fillRect(0,0,w,h);ctx.font='9px monospace';for(let i=0;i<cols.length;i++){ctx.fillStyle=Math.random()>.985?'rgba(190,255,210,.42)':'rgba(49,190,99,.24)';ctx.fillText(chars[(Math.random()*chars.length)|0],i*11,cols[i]);cols[i]+=8;if(cols[i]>h&&Math.random()>.975)cols[i]=0;}}; state.matrixRAF=requestAnimationFrame(draw);setHealth('matrix','OK');
  }
  function botSVG(){return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l8 11-3 25-9 8H22l-9-8-3-25z" fill="#87919b" stroke="#c4ccd2" stroke-width="2"/><path d="M18 19h28l4 7-5 10H19l-5-10z" fill="#20262d"/><circle cx="24" cy="28" r="4" fill="#ef4444"/><circle cx="40" cy="28" r="4" fill="#ef4444"/><path d="M24 41h16v10H24z" fill="#343b43"/><path d="M27 43v6m5-6v6m5-6v6" stroke="#aab1b8" stroke-width="2"/></svg>`;}
  function ensureBots(){ if(document.getElementById('ng5-bot-a'))return; const a=document.createElement('div');a.id='ng5-bot-a';a.className='ng5-bot';a.innerHTML=botSVG();a.title="I'll be back.";document.body.appendChild(a); const b=a.cloneNode(true);b.id='ng5-bot-b';b.title='Skynet online.';document.body.appendChild(b); }

  function brand(){ document.title=document.title.replace(/ChatGPT/g,'NiakGPT'); const els=[...document.querySelectorAll('header a,header button,header span,a,button,span')].filter(e=>{const r=e.getBoundingClientRect();return r.top<90&&r.left<330&&r.width&&/^chatgpt$/i.test((e.textContent||'').trim());}); if(els[0]){els[0].textContent='NiakGPT';els[0].dataset.ng5Brand='1';} }
  function isGenerating(){return [...document.querySelectorAll('button,[data-testid]')].some(x=>x.getBoundingClientRect().width&&/stop|arrêter|arreter/i.test(`${x.getAttribute('aria-label')||''} ${x.getAttribute('data-testid')||''}`));}
  function markRunning(){state.generation=isGenerating();document.documentElement.dataset.ng5Running=state.generation?'1':'0'; const cp=currentProject(); document.querySelectorAll('[data-ng5-project="1"],[data-ng5-project]').forEach(a=>a.classList.toggle('ng5-running',!!state.generation&&!!cp&&(a.getAttribute('href')||'').includes(cp.id))); const cid=currentChatId(); document.querySelectorAll('[data-ng5-chat="1"]').forEach(a=>a.classList.toggle('ng5-running',!!state.generation&&(a.getAttribute('href')||'').includes(cid))); renderStatus();}

  function ensureShell(){
    if(document.getElementById('ng5-rail'))return; const rail=document.createElement('aside');rail.id='ng5-rail';rail.innerHTML=`<button data-tab="explorer" title="Explorer">▤</button><button data-tab="toc" title="Sommaire">☷</button><button data-tab="diag" title="Diagnostic">◉</button><span></span><button data-action="quick" title="Quick Open · Alt+K">⌘</button>`;document.body.appendChild(rail); const panel=document.createElement('aside');panel.id='ng5-panel';document.body.appendChild(panel); const status=document.createElement('div');status.id='ng5-status';document.body.appendChild(status); rail.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const t=b.dataset.tab;state.panelOpen=state.panelOpen&&state.tab===t?false:true;state.tab=t;renderPanel();}); rail.querySelector('[data-action="quick"]').onclick=openQuick; setHealth('ui','OK');
  }
  function renderStatus(){const s=document.getElementById('ng5-status');if(!s)return; const cp=currentProject();s.classList.toggle('running',state.generation);s.innerHTML=`<span><b>NiakGPT</b> ${VERSION}</span><span>${esc(cp?.name||'Hors projet')}</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng5-health">${state.generation?'EXÉCUTION':Object.values(state.health).some(v=>String(v).startsWith('ERREUR'))?'DIAGNOSTIC':'PRÊT'}</span>`;s.querySelector('[data-q]').onclick=openQuick;}
  function renderPanel(){const p=document.getElementById('ng5-panel');if(!p)return;p.classList.toggle('open',state.panelOpen);document.querySelectorAll('#ng5-rail [data-tab]').forEach(b=>b.classList.toggle('active',state.panelOpen&&b.dataset.tab===state.tab));if(!state.panelOpen)return; if(state.tab==='diag')p.innerHTML=`<header><small>DIAGNOSTIC</small><b>État des modules</b><button>×</button></header><div class="ng5-diag">${Object.entries(state.health).map(([k,v])=>`<div><span>${esc(k)}</span><b class="${String(v).startsWith('OK')?'ok':String(v).startsWith('ERREUR')?'err':'wait'}">${esc(v)}</b></div>`).join('')}</div>`; else if(state.tab==='toc')p.innerHTML=`<header><small>SOMMAIRE</small><b>${state.turns.length} blocs</b><button>×</button></header><input id="ng5-toc-search" placeholder="Filtrer le fil…"><div class="ng5-toc">${state.turns.map((t,i)=>`<button data-turn="${i}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc((t.innerText||t.textContent||'').replace(/\s+/g,' ').slice(0,120))}</span></button>`).join('')}</div>`; else {const counts=new Map(state.projects.map(x=>[x.id,0]));state.chats.forEach(c=>counts.has(c.projectId)&&counts.set(c.projectId,counts.get(c.projectId)+1));p.innerHTML=`<header><small>EXPLORER</small><b>Projects</b><button>×</button></header><div class="ng5-actions"><button data-repair>Réparer le classement</button><button data-refresh>Rafraîchir</button></div><div class="ng5-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${state.projects.map(x=>`<a href="/g/${x.id}/project" style="--ng-project:${x.color}"><i>${esc(x.icon)}</i><span>${esc(x.name)}</span><b>${counts.get(x.id)||0}</b></a>`).join('')}</div>`;}
    p.querySelector('header button').onclick=()=>{state.panelOpen=false;renderPanel();};p.querySelector('[data-repair]')?.addEventListener('click',()=>repairOrganization({manual:true}));p.querySelector('[data-refresh]')?.addEventListener('click',async()=>{await loadData();});p.querySelectorAll('[data-turn]').forEach(b=>b.onclick=()=>state.turns[Number(b.dataset.turn)]?.scrollIntoView({behavior:'smooth',block:'center'}));const q=p.querySelector('#ng5-toc-search');if(q)q.oninput=()=>{const s=norm(q.value);p.querySelectorAll('[data-turn]').forEach(b=>b.hidden=s&&!norm(b.textContent).includes(s));};}

  function openQuick(){let m=document.getElementById('ng5-quick');if(m)m.remove();m=document.createElement('div');m.id='ng5-quick';m.innerHTML=`<div><input autofocus placeholder="Quick Open — conversations & Projects"><section></section><footer>Alt+K · ↑↓ · Entrée · Échap</footer></div>`;document.body.appendChild(m);const input=m.querySelector('input'),list=m.querySelector('section');let items=[],sel=0;const paint=()=>{const q=norm(input.value);items=state.chats.filter(c=>!q||norm(`${c.title} ${state.projectById.get(c.projectId)?.name||''}`).includes(q)).sort((a,b)=>b.updated-a.updated).slice(0,45);list.innerHTML=items.map((c,i)=>`<button class="${i===sel?'sel':''}" data-i="${i}"><i style="--ng-project:${state.projectById.get(c.projectId)?.color||'#607080'}"></i><span>${esc(c.title)}</span><small>${esc(state.projectById.get(c.projectId)?.name||'Hors projet')}</small></button>`).join('');list.querySelectorAll('button').forEach(b=>{const c=items[Number(b.dataset.i)];b.onmouseenter=()=>prefetch(c);b.onclick=()=>location.href=c.projectId?`/g/${c.projectId}/c/${c.id}`:`/c/${c.id}`;});};input.oninput=()=>{sel=0;paint();};input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,items.length-1);paint();}if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}if(e.key==='Enter'&&items[sel])location.href=items[sel].projectId?`/g/${items[sel].projectId}/c/${items[sel].id}`:`/c/${items[sel].id}`;if(e.key==='Escape')m.remove();};m.onmousedown=e=>{if(e.target===m)m.remove();};paint();setTimeout(()=>input.focus(),0);}
  async function prefetch(c){if(!c?.id||state.prefetched.has(c.id))return;state.prefetched.add(c.id);await rpc(`/backend-api/conversation/${encodeURIComponent(c.id)}`,{timeout:6000});}

  function scan(){brand();decorateTurns();decorateSidebar();renderPinnedProjects();ensureCoach();markRunning();renderStatus();}
  function scheduleScan(){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(scan,260);}
  async function init(){ensureShell();ensureMatrix();ensureBots();brand();decorateTurns();ensureCoach();const ok=await loadData();if(ok){setTimeout(()=>repairOrganization({manual:false}),1600);setTimeout(tryNativePins,3200);}state.observer=new MutationObserver(()=>{if(location.pathname!==state.lastPath){state.lastPath=location.pathname;scheduleScan();}else scheduleScan();});state.observer.observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('input',e=>{if(e.target?.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||e.target?.isContentEditable){clearTimeout(state.coachTimer);state.coachTimer=setTimeout(ensureCoach,100);}},true);document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();openQuick();}},true);addEventListener('resize',scheduleScan,{passive:true});}
  init();
})();
