(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_SMART__) return;
  window.__NIAKGPT_SMART__ = true;

  const VERSION = '0.4.0';
  const GENERIC = new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc']);
  const STOP = new Set('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut'.split(/\s+/));

  const state = {
    projects: [], chats: [], projectById: new Map(), profiles: new Map(),
    pinning: false, organizing: false, coachTimer: 0, decorateTimer: 0,
    generation: false, lastCoachKey: '', moved: 0
  };

  const n = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const words = v => n(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x => x.length > 2 && !STOP.has(x));
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function colorFor(name){ const colors=['#4EC9B0','#569CD6','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#F14C4C','#6A9955','#C8C8C8']; let h=0; for(const c of String(name)) h=((h<<5)-h+c.charCodeAt(0))|0; return colors[Math.abs(h)%colors.length]; }

  let rpcSeq = 0;
  function rpc(path,{method='GET',body=null,timeout=14000}={}){
    const id=`ng-smart-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'timeout'});},timeout);
      const handler=e=>{ if(e.detail?.id!==id)return; cleanup(); resolve(e.detail); };
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body}}));
    });
  }

  function currentProjectId(){ return location.pathname.match(/\/g\/(g-p-[^/?#]+)/)?.[1]?.split('-').slice(0,3).join('-') || location.pathname.match(/\/g\/(g-p-[^/?#]+)/)?.[1] || ''; }
  function currentChatId(){ return location.pathname.match(/\/c\/([^/?#]+)/)?.[1] || ''; }

  function extractProjects(payload){
    const out=new Map(), seen=new WeakSet();
    function walk(x){
      if(!x||typeof x!=='object'||seen.has(x))return; seen.add(x);
      for(const g of [x,x.gizmo,x.gizmo?.gizmo].filter(Boolean)){
        const id=String(g.id||''); const name=String(g.display?.name||g.name||'').trim();
        if(id.startsWith('g-p-')&&name) out.set(id,{id,name,description:String(g.display?.description||''),instructions:String(g.instructions||''),color:colorFor(name)});
      }
      if(Array.isArray(x))x.forEach(walk); else Object.values(x).forEach(walk);
    }
    walk(payload); return [...out.values()];
  }
  function normalizeChat(x){ return {id:String(x?.id||x?.conversation_id||''),title:String(x?.title||x?.conversation_title||'Conversation sans titre'),projectId:String(x?.gizmo_id||x?.conversation_mode?.gizmo_id||''),updated:Number(x?.update_time||x?.create_time||0)}; }

  async function loadData(){
    const pr=await rpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0');
    if(!pr.ok) return false;
    state.projects=extractProjects(pr.data); state.projectById=new Map(state.projects.map(p=>[p.id,p]));
    const chats=[]; let offset=0;
    for(let page=0;page<15;page++){
      const r=await rpc(`/backend-api/conversations?offset=${offset}&limit=100&order=updated&expand=true`);
      if(!r.ok||!Array.isArray(r.data?.items))break;
      chats.push(...r.data.items.map(normalizeChat).filter(c=>c.id));
      offset+=r.data.items.length;
      if(!r.data.items.length||offset>=Number(r.data.total||offset))break;
    }
    state.chats=chats;
    await buildProfiles();
    return state.projects.length>0;
  }

  async function buildProfiles(){
    const profiles=new Map();
    for(const p of state.projects){
      const f=new Map();
      const add=(txt,w)=>{for(const t of words(txt))f.set(t,(f.get(t)||0)+w);};
      add(p.name,20); add(p.description,7); add(p.instructions,5); profiles.set(p.id,f);
    }
    for(const c of state.chats){ const f=profiles.get(c.projectId); if(f) for(const t of words(c.title)) f.set(t,(f.get(t)||0)+2); }
    for(const p of state.projects.slice(0,30)){
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(p.id)}/conversations?cursor=0&limit=50`,{timeout:9000});
      if(r.ok&&Array.isArray(r.data?.items)){
        const f=profiles.get(p.id); for(const it of r.data.items) for(const t of words(it?.title||'')) f.set(t,(f.get(t)||0)+2);
      }
      await sleep(25);
    }
    state.profiles=profiles;
  }

  function score(chat,p){
    const title=n(chat.title), pname=n(p.name); let s=0;
    if(pname.length>=3&&title.includes(pname)) s+=140;
    const f=state.profiles.get(p.id)||new Map();
    for(const t of new Set(words(chat.title))) s+=Math.min(12,f.get(t)||0);
    return s;
  }
  function bestTarget(chat){
    const ranked=state.projects.filter(p=>!GENERIC.has(n(p.name))).map(p=>({p,s:score(chat,p)})).sort((a,b)=>b.s-a.s);
    const a=ranked[0],b=ranked[1]; if(!a)return null;
    return {project:a.p,score:a.s,margin:a.s-(b?.s||0)};
  }
  async function moveChat(chat,project){
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{method:'PATCH',body:{gizmo_id:project.id}});
    if(!r.ok)return false;
    const v=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`);
    const got=String(v.data?.gizmo_id||v.data?.conversation_mode?.gizmo_id||'');
    if(got===project.id){ chat.projectId=project.id; return true; }
    return false;
  }

  async function repairOrganization(){
    if(state.organizing||!state.projects.length)return;
    state.organizing=true; let moved=0;
    // Les chats non classés sont triés. Les chats déjà dans un vrai Project sont protégés.
    // Les dossiers génériques hérités (Design, AI, Code...) peuvent être réparés automatiquement avec un seuil fort.
    for(const chat of state.chats){
      if(moved>=40)break;
      const current=state.projectById.get(chat.projectId);
      const fromGeneric=current&&GENERIC.has(n(current.name));
      if(chat.projectId&&!fromGeneric)continue;
      const best=bestTarget(chat); if(!best)continue;
      const threshold=fromGeneric?24:14; const margin=fromGeneric?10:6;
      if(best.score<threshold||best.margin<margin)continue;
      if(await moveChat(chat,best.project)){ moved++; state.moved++; await sleep(120); }
    }
    state.organizing=false;
    if(moved){ buildProfiles(); decorateNativeSidebar(); }
    announceModuleState('organizer',moved?`OK · ${moved} réparées`:'OK');
  }

  function navRoot(){ return document.querySelector('nav') || [...document.querySelectorAll('aside')].find(x=>x.querySelector('a[href*="/c/"]')) || document.body; }
  function projectLinks(){ return [...navRoot().querySelectorAll('a[href*="/g/"]')].filter(a=>(a.getAttribute('href')||'').includes('g-p-')); }
  function chatLinks(){ return [...navRoot().querySelectorAll('a[href*="/c/"]')].filter(a=>!(a.closest('#ng-panel,#ng-quick'))); }
  function projectFromHref(href){ const id=String(href||'').match(/g-p-[A-Za-z0-9_-]+/)?.[0]||''; return state.projects.find(p=>id.startsWith(p.id)||p.id.startsWith(id))||null; }

  function expandProjectList(){
    const root=navRoot();
    [...root.querySelectorAll('button')].forEach(b=>{
      const t=n(`${b.innerText||''} ${b.getAttribute('aria-label')||''}`);
      if(/^(voir plus|afficher plus|show more|more)$/.test(t) && b.getBoundingClientRect().width) b.click();
    });
  }
  function isPinned(link){
    let x=link; for(let i=0;i<6&&x;i++,x=x.parentElement){ const t=n(x.parentElement?.innerText||''); if(/\b(epingles|pinned)\b/.test(t)&&t.length<1800)return true; }
    return false;
  }
  async function pinOne(project){
    expandProjectList(); await sleep(70);
    const link=projectLinks().find(a=>{const p=projectFromHref(a.getAttribute('href'));return p?.id===project.id;});
    if(!link)return false; if(isPinned(link))return true;
    const row=link.closest('li,[data-testid]')||link.parentElement||link;
    row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    await sleep(110);
    let buttons=[...row.querySelectorAll('button')];
    let menu=buttons.find(b=>/(more|options|menu|davantage|plus)/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`))||buttons.at(-1);
    if(!menu){ link.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true})); await sleep(120); }
    else { menu.click(); await sleep(140); }
    const items=[...document.querySelectorAll('[role="menuitem"],[role="option"]')].filter(x=>x.getBoundingClientRect().width);
    const pin=items.find(x=>/^(epingler|pin)(\b|\s)/i.test(n(x.textContent)));
    if(!pin){ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return false; }
    pin.click(); await sleep(180); return true;
  }
  async function pinAllProjects(){
    if(state.pinning||!state.projects.length)return; state.pinning=true;
    let ok=0;
    for(let pass=0;pass<3;pass++){
      expandProjectList();
      for(const p of state.projects){ if(await pinOne(p))ok++; await sleep(160); }
      if(ok>=state.projects.length)break;
      await sleep(500);
    }
    state.pinning=false;
    announceModuleState('pins',ok?`OK · ${Math.min(ok,state.projects.length)}/${state.projects.length}`:'ATTENTE');
  }

  function replaceLeafText(el,from,to){
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let node;
    while((node=walker.nextNode())){ if(n(node.nodeValue)===n(from)){ node.nodeValue=node.nodeValue.replace(/ChatGPT/i,to); return true; } }
    return false;
  }
  function brandNiakGPT(){
    if(document.title.includes('ChatGPT')) document.title=document.title.replace(/ChatGPT/g,'NiakGPT');
    const candidates=[...document.querySelectorAll('header button,header a,header span,button,a,span')].filter(el=>{
      const r=el.getBoundingClientRect(); return r.width&&r.height&&r.top<100&&r.left<420&&/^chatgpt$/i.test((el.textContent||'').trim());
    });
    if(candidates[0]){ replaceLeafText(candidates[0],'ChatGPT','NiakGPT') || (candidates[0].textContent='NiakGPT'); candidates[0].dataset.ngBrand='1'; }
  }

  function isGenerating(){
    const selectors=['button[data-testid="stop-button"]','button[aria-label*="Stop"]','button[aria-label*="Arrêter"]','[data-testid="stop-button"]'];
    return selectors.some(s=>[...document.querySelectorAll(s)].some(x=>x.getBoundingClientRect().width));
  }
  function decorateTurns(){
    const turns=[...document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]')];
    turns.forEach((turn,i)=>{
      const role=turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'';
      turn.dataset.ngInteraction=role||'unknown'; turn.dataset.ngParity=String(i%2);
      turn.classList.toggle('ng-user-turn',role==='user'); turn.classList.toggle('ng-assistant-turn',role==='assistant');
    });
  }
  function decorateNativeSidebar(){
    const chats=chatLinks(); chats.forEach((a,i)=>{
      a.dataset.ngNativeChat='1'; a.dataset.ngZebra=String(i%2);
      const href=a.getAttribute('href')||''; const id=href.match(/\/c\/([^/?#]+)/)?.[1]||'';
      const c=state.chats.find(x=>x.id===id); const p=c?state.projectById.get(c.projectId):null;
      a.style.setProperty('--ng-row-color',p?.color||'#858585');
      a.classList.toggle('ng-current-chat',id===currentChatId());
    });
    projectLinks().forEach(a=>{
      const p=projectFromHref(a.getAttribute('href')); if(!p)return;
      a.dataset.ngNativeProject='1'; a.style.setProperty('--ng-project-color',p.color); a.classList.toggle('ng-current-project',currentProjectId().startsWith(p.id));
      a.title=`${p.name} · NiakGPT`;
    });
    const gen=isGenerating(); state.generation=gen; document.documentElement.dataset.ngGenerating=gen?'1':'0';
    const cp=currentProjectId();
    projectLinks().forEach(a=>{ const p=projectFromHref(a.getAttribute('href')); a.classList.toggle('ng-project-running',!!gen&&!!p&&cp.startsWith(p.id)); });
    chatLinks().forEach(a=>{ const id=(a.getAttribute('href')||'').match(/\/c\/([^/?#]+)/)?.[1]||''; a.classList.toggle('ng-chat-running',!!gen&&id===currentChatId()); });
    brandNiakGPT(); decorateTurns(); replaceDisplayedVersion();
  }

  function replaceDisplayedVersion(){
    document.querySelectorAll('#ng-status,#ng-panel').forEach(root=>{
      root.querySelectorAll('*').forEach(el=>{ if(el.children.length===0&&/0\.3\.1/.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/0\.3\.1/g,VERSION); });
    });
  }
  function announceModuleState(module,text){
    const row=[...document.querySelectorAll('#ng-panel .ng-diag>div')].find(x=>n(x.querySelector('span')?.textContent)===n(module));
    if(row){ const b=row.querySelector('b'); if(b){b.className=text.startsWith('OK')?'ok':'warn';b.textContent=text;} }
  }

  function editor(){ return [...document.querySelectorAll('#prompt-textarea,textarea,[contenteditable="true"]')].filter(x=>{const r=x.getBoundingClientRect();return r.width>250&&r.height>20;}).sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0]||null; }
  function editorText(el){ return el instanceof HTMLTextAreaElement?el.value:(el?.innerText||el?.textContent||''); }
  function insert(el,text){
    if(!el)return; const addition=`${editorText(el).trim()?'\n\n':''}${text}`; el.focus();
    if(el instanceof HTMLTextAreaElement){const end=el.value.length;el.setRangeText(addition,end,end,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}
    else{const sel=getSelection(),range=document.createRange();range.selectNodeContents(el);range.collapse(false);sel.removeAllRanges();sel.addRange(range);document.execCommand('insertText',false,addition);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:addition}));}
  }
  function conversationContext(){
    const turns=[...document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]')];
    return turns.slice(-5).map(t=>({role:t.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')||'',text:(t.innerText||t.textContent||'').replace(/\s+/g,' ').trim().slice(0,700)}));
  }
  function topic(text,ctx){
    const all=[text,...ctx.map(x=>x.text)].join(' '); const freq=new Map(); for(const w of words(all))freq.set(w,(freq.get(w)||0)+1);
    return [...freq].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join(' · ');
  }
  function smartSuggestions(text){
    const ctx=conversationContext(); const s=n(text); const context=n(ctx.map(x=>x.text).join(' ')); const all=` ${s} ${context} `; const subject=topic(text,ctx); const out=[];
    const add=(title,body,kind='default')=>{if(!out.some(x=>x.body===body))out.push({title,body,kind});};
    if(/code|bug|erreur|javascript|typescript|python|php|sql|api|github|extension|manifest|css|html/.test(all)){
      add('Patch robuste','Identifie la cause racine puis donne directement le correctif exact, en conservant le comportement existant et en évitant les régressions.','code');
      add('Tester','Vérifie les cas limites, les erreurs silencieuses et ce qui peut casser après une mise à jour de l’interface.','test');
      add('Simplifier','Cherche aussi si une implémentation plus simple et plus performante permet le même résultat.','perf');
    }
    if(/design|da |interface|ui |ux |visuel|image|logo|couleur|font|typograph|maquette/.test(all)){
      add('DA cohérente','Pousse la direction artistique de façon cohérente sur les couleurs, contrastes, états, typographie, espacements et micro-interactions.','design');
      add('UX avant tout','Priorise la lisibilité et la vitesse d’usage : chaque différence visuelle doit aider à comprendre ou agir plus vite.','ux');
      add('Références','Respecte strictement les éléments existants et améliore-les sans créer de rupture visuelle inutile.','design');
    }
    if(/compar| vs |versus|choisir|meilleur|lequel/.test(` ${s} `)){
      add('Comparer','Fais un tableau court avec critères décisifs, avantages, défauts, coût et recommandation finale.','compare');
      add('Trancher','Ne reste pas neutre : choisis l’option la plus adaptée aux contraintes données et explique pourquoi.','decision');
    }
    if(/cherche|trouve|actuel|recent|aujourd|prix|tarif|loi|regle|version|2026/.test(all)){
      add('Vérifier','Vérifie les informations actuelles avec des sources récentes et privilégie les sources officielles ou primaires.','research');
      add('Date & écarts','Signale les dates, changements récents et divergences entre sources qui peuvent modifier la conclusion.','research');
    }
    if(/seo|shopify|e-?commerce|produit|conversion|marketplace|amazon|tiktok/.test(all)){
      add('Impact business','Classe les actions par impact attendu, effort, risque et priorité d’exécution.','business');
      add('Concret','Donne les changements exacts à appliquer et les métriques à surveiller ensuite.','business');
    }
    if(/jurid|tribunal|avocat|licenci|prud|contrat|droit/.test(all)){
      add('Séparer','Sépare strictement faits établis, droit applicable, hypothèses, preuves disponibles et points à confirmer.','legal');
      add('Stratégie','Termine par les prochaines actions dans l’ordre, avec risques et pièces utiles.','legal');
    }
    if(/classe|range|projet|dossier|organis|tri|historique/.test(all)){
      add('Nettoyer','Cherche les doublons, mauvais classements et catégories génériques, puis propose une structure plus nette et durable.','organize');
      add('Automatiser','Automatise ce qui est fiable et garde une validation manuelle uniquement pour les cas ambigus.','organize');
    }
    if(/resume|résume|synth|long|trop long|court/.test(all)) add('Synthèse','Commence par une synthèse exploitable en quelques lignes, puis garde uniquement les détails qui changent une décision.','summary');
    if(!s.trim()){
      const last=ctx.at(-1)?.text||'';
      if(last){
        add('Continuer','À partir de ta dernière réponse, donne les 3 prochaines actions les plus utiles et exécute directement celles que tu peux.','next');
        add('Challenger','Reprends ta dernière réponse et cherche ce qui peut être faux, incomplet, fragile ou améliorable.','challenge');
        add('Synthétiser','Résume l’état actuel du sujet, les décisions déjà prises et ce qu’il reste à faire.','summary');
      }
    }
    if(!out.length){
      add('Réponse directe',`Réponds d’abord directement à ma demande${subject?` sur ${subject}`:''}, puis détaille seulement ce qui apporte une vraie valeur.`,'direct');
      add('Angles morts','Cherche les hypothèses, limites ou risques qui pourraient changer la réponse.','challenge');
      add('Action','Termine par la prochaine action concrète la plus utile.','next');
    }
    return out.slice(0,4);
  }
  function renderSmartCoach(){
    const ed=editor(), box=document.getElementById('ng-coach'); if(!ed||!box)return;
    const text=editorText(ed); const items=smartSuggestions(text); const key=text+'|'+items.map(x=>x.title).join('|'); if(key===state.lastCoachKey)return; state.lastCoachKey=key;
    box.classList.add('ng-smart-coach');
    box.innerHTML=`<div class="ng-coach-title"><span>NiakGPT · recommandations contextuelles</span><kbd>adaptatif</kbd></div><div class="ng-coach-items">${items.map((x,i)=>`<button class="ng-smart-sug ng-kind-${x.kind}" data-smart-sug="${i}"><strong>${esc(x.title)}</strong><span>${esc(x.body)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('[data-smart-sug]').forEach(b=>b.addEventListener('click',()=>insert(ed,items[Number(b.dataset.smartSug)].body)));
  }

  function scheduleDecorate(){ clearTimeout(state.decorateTimer); state.decorateTimer=setTimeout(()=>{decorateNativeSidebar();renderSmartCoach();},90); }

  async function boot(){
    brandNiakGPT(); decorateNativeSidebar();
    const ok=await loadData();
    if(ok){ announceModuleState('bridge','OK'); announceModuleState('projects',`OK · ${state.projects.length}`); decorateNativeSidebar(); await repairOrganization(); setTimeout(pinAllProjects,900); }
    else announceModuleState('bridge','ERREUR');

    const obs=new MutationObserver(scheduleDecorate); obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    document.addEventListener('input',()=>{clearTimeout(state.coachTimer);state.coachTimer=setTimeout(renderSmartCoach,150);},true);
    setInterval(()=>{ const gen=isGenerating(); if(gen!==state.generation)decorateNativeSidebar(); brandNiakGPT(); },650);
  }
  boot();
})();
