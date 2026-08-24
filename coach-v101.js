(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_COACH_101__)return;
  window.__NIAKGPT_COACH_101__=true;
  const root=document.documentElement,CACHE_KEY='niakgpt-v08-cache';let timer=0,lastSig='',cache={},expanded=false;
  const clean=v=>String(v??'').replace(/\r/g,'').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>!['loading','waiting','thinking','executing'].includes(root.dataset.ng86Activity||'')&&root.dataset.ng8Running!=='1'&&root.dataset.ng90Safe!=='1';
  function editor(){return document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')||[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse().find(el=>!el.closest('#ng8-coach'));}
  function editorText(ed){if(!ed)return'';return 'value'in ed?ed.value:(ed.innerText||ed.textContent||'');}
  function setEditor(ed,text){
    if(!ed)return;if('value'in ed){const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ed),'value')?.set;setter?setter.call(ed,text):ed.value=text;}else{ed.focus();document.execCommand?.('selectAll',false);if(!document.execCommand?.('insertText',false,text))ed.textContent=text;}
    ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
  }
  function currentIds(){const path=location.pathname,id=path.match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'',pid=path.match(/\/g\/(g-p-[A-Za-z0-9_-]+)\/(?:project|c\/)/)?.[1]||cache.chats?.find?.(c=>c.id===id)?.projectId||'';return{id,pid};}
  function projectContext(){const {pid}=currentIds(),p=(cache.projects||[]).find(x=>x.id===pid);return p?{name:clean(p.name),description:clean(p.description),instructions:clean(p.instructions)}:{name:'',description:'',instructions:''};}
  function recentContext(){
    if(!ready())return'';const main=document.querySelector('main');if(!main)return'';
    const turns=[...main.querySelectorAll('[data-message-author-role]')].slice(-5);
    return turns.map(el=>{const role=el.getAttribute('data-message-author-role')==='user'?'Utilisateur':'Assistant';return`${role}: ${clean(el.innerText||el.textContent).replace(/\s+/g,' ').slice(0,650)}`;}).join('\n').slice(-3000);
  }
  function kind(text){const n=norm(text);if(/\b(code|bug|javascript|typescript|python|php|sql|api|github|docker|extension|chrome|css|html|test|runtime|fonction|fichier)\b/.test(n))return'dev';if(/\b(recherche|cherche|verifie|vérifie|source|sources|documentation|compare|actualité|latest|recent|récent)\b/.test(n))return'research';if(/\b(compare|comparatif|versus|vs\.?|avantage|inconvenient|inconvénient)\b/.test(n))return'comparison';if(/\b(plan|strategie|stratégie|roadmap|etapes|étapes|planning)\b/.test(n))return'plan';if(/\b(ecris|écris|redige|rédige|mail|message|article|texte|lettre|post|description)\b/.test(n))return'writing';return'general';}
  function constraints(text){
    const lines=clean(text).split(/\n|(?<=[.!?;])\s+/).map(clean).filter(Boolean);const rx=/\b(sans|ne\s+\w+\s+pas|pas de|doit|doivent|obligatoire|uniquement|seulement|conserve|conserver|garde|garder|exact|format|local|github|zip|maximum|minimum|aucun|jamais|toujours|n['’]oublie|n['’]oublier|évite|evite)\b/i;
    return [...new Set(lines.filter(x=>rx.test(x)))].slice(0,14);
  }
  function methodFor(k){return({
    dev:'Inspecte d’abord l’existant et les dépendances. Modifie le minimum nécessaire, traite les causes racines, exécute les tests pertinents et vérifie les régressions avant de conclure.',
    research:'Vérifie les faits avec des sources adaptées et récentes lorsque nécessaire. Distingue clairement faits, incertitudes et inférences, puis synthétise ce qui change réellement la décision.',
    comparison:'Compare sur des critères identiques, explicite les compromis et termine par un choix argumenté adapté aux contraintes de la demande.',
    plan:'Transforme l’objectif en étapes exécutables, ordonnées par dépendances, avec critères de réussite et risques à contrôler.',
    writing:'Respecte exactement la destination, le ton et les informations fournies. N’invente aucun fait manquant et livre directement un texte réutilisable.',
    general:'Réponds directement à l’objectif, utilise le contexte utile, conserve toutes les contraintes et vérifie que chaque élément demandé est traité.'
  })[k];}
  function optimize(raw){
    const original=clean(raw),k=kind(original),project=projectContext(),recent=recentContext(),cons=constraints(original);
    const follow=/^(et |puis |aussi |donc |ok|oui|non|continue|reprends|corrige|ajoute|enleve|enlève|fais |go\b)/i.test(original);
    if(original.length<170&&!cons.length){const prefix=follow&&project.name?`Dans la continuité du projet « ${project.name} », `:'';return`${prefix}${original}\n\n${methodFor(k)}`.trim();}
    const sections=[];sections.push(`OBJECTIF\n${original.split('\n')[0].slice(0,700)}`);
    if(project.name||recent){let ctx=[];if(project.name)ctx.push(`Projet : ${project.name}${project.description?` — ${project.description.slice(0,500)}`:''}`);if(project.instructions)ctx.push(`Instructions du projet : ${project.instructions.slice(0,1000)}`);if(recent)ctx.push(`Contexte récent :\n${recent}`);sections.push(`CONTEXTE UTILE\n${ctx.join('\n')}`);}
    if(cons.length)sections.push(`CONTRAINTES À RESPECTER\n- ${cons.join('\n- ')}`);sections.push(`MÉTHODE ATTENDUE\n${methodFor(k)}`);
    sections.push(`CRITÈRES DE RÉUSSITE\n- Traiter tous les éléments explicitement demandés.\n- Ne pas perdre les contraintes de la demande originale.\n- Vérifier le résultat avant de conclure.\n- Signaler précisément ce qui serait impossible plutôt que de l’inventer.`);
    sections.push(`DEMANDE ORIGINALE — À CONSERVER INTÉGRALEMENT\n${original}`);return sections.join('\n\n');
  }
  function status(text){root.dataset.ng100CoachStatus=text;window.__NIAKGPT_DIAGNOSTICS__?.set('coach',text);}
  function remove(){document.getElementById('ng8-coach')?.remove();lastSig='';expanded=false;}
  function setExpanded(box,value,focus=false){expanded=!!value;const detail=box?.querySelector('.ng131-coach-detail'),button=box?.querySelector('[data-toggle]');if(detail)detail.hidden=!expanded;if(button){button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'✦ Masquer':'✦ Optimiser';if(focus)button.focus({preventScroll:true});}box?.setAttribute('data-ng131-coach',expanded?'expanded':'collapsed');}
  function render(forceOpen=false){
    timer=0;if(!ready()){remove();return;}const ed=editor(),raw=editorText(ed).trim();if(!ed||!raw){remove();status('PRÊT · saisie vide');return;}
    if(raw.length<4&&!forceOpen){remove();return;}
    const out=optimize(raw),sig=`${raw}|${currentIds().pid}|${out.length}|${forceOpen}`;const previous=document.getElementById('ng8-coach');if(sig===lastSig&&previous){if(forceOpen)setExpanded(previous,true);return;}lastSig=sig;
    const wasExpanded=expanded||forceOpen;let box=previous;
    if(!box){box=document.createElement('section');box.id='ng8-coach';box.dataset.ng100Coach='1';box.setAttribute('aria-label','Optimisation locale du prompt');const form=ed.closest('form');(form||ed.parentElement)?.insertAdjacentElement('beforebegin',box);}
    box.innerHTML=`<div class="ng131-coach-bar"><span class="ng131-coach-kind">${esc(kind(raw).toUpperCase())} · LOCAL</span><button type="button" class="ng131-coach-toggle" data-toggle aria-controls="ng131-coach-detail" aria-expanded="false">✦ Optimiser</button></div><div id="ng131-coach-detail" class="ng131-coach-detail" hidden><pre class="ng100-prompt-preview">${esc(out)}</pre><div class="ng100-prompt-actions"><button type="button" data-copy>Copier</button><button type="button" data-replace>Remplacer</button></div></div>`;
    const toggle=box.querySelector('[data-toggle]');toggle?.addEventListener('click',()=>setExpanded(box,!expanded));
    box.querySelector('[data-copy]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(out);status('COPIÉ · local');}catch{status('COPIE IMPOSSIBLE');}});
    box.querySelector('[data-replace]')?.addEventListener('click',()=>{setEditor(ed,out);remove();status('REMPLACÉ · aucun envoi automatique');});
    setExpanded(box,wasExpanded);status(`PRÊT · discret · ${out.length} caractères · aucun réseau`);
  }
  function schedule(ms=140){clearTimeout(timer);timer=setTimeout(()=>render(false),ms);}
  chrome.storage.local.get(CACHE_KEY).then(x=>{cache=x[CACHE_KEY]||{};schedule(120);}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||{};schedule(160);}});
  document.addEventListener('input',e=>{if(e.target===editor()||e.target?.closest?.('#prompt-textarea,[data-testid="prompt-textarea"]'))schedule(150);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){const box=document.getElementById('ng8-coach');if(box){e.stopPropagation();setExpanded(box,false,true);}}else if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&String(e.key).toLowerCase()==='p'){const ed=editor();if(ed&&editorText(ed).trim()){e.preventDefault();render(true);}}},true);
  document.addEventListener('niakgpt:activity-changed',e=>{if(e.detail?.active===false)schedule(160);else remove();});
  window.addEventListener('popstate',()=>schedule(220));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(180);});
  window.__NIAKGPT_PROMPTER__={optimize,open:()=>render(true)};
})();
