(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_COACH_101__)return;
  window.__NIAKGPT_COACH_101__=true;

  const root=document.documentElement;
  const TECH=['javascript','typescript','python','php','sql','css','html','react','vue','node','chrome','extension','api','github','shopify','prestashop','docker','rust','tauri','playwright','chromium','indexeddb','broadcastchannel','fetch','http','seo','sea','excel','xlsx'];
  let timer=0,lastSig='',mountedEditor=null;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const enabled=()=>root.dataset.ng90Coach!=='off'&&root.dataset.ng90Safe!=='1'&&root.dataset.ng86Activity==='ready';
  const editorText=e=>e instanceof HTMLTextAreaElement?e.value:(e?.innerText||e?.textContent||'');

  function editor(){
    const explicit=document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');
    if(explicit instanceof HTMLElement&&explicit.getClientRects().length)return explicit;
    const generic=[...document.querySelectorAll('textarea,[contenteditable="true"]')].reverse();
    return generic.find(el=>el instanceof HTMLElement&&el.getClientRects().length&&el.getBoundingClientRect().width>=220)||null;
  }
  function hostFor(ed){
    if(!(ed instanceof HTMLElement))return null;
    return ed.closest('form')||ed.closest('[data-type="unified-composer"]')||ed.closest('[class*="composer"]')||ed.parentElement;
  }
  function project(){return(document.querySelector('#ng8-status .ng8-status-project')?.textContent||'').trim();}
  function recent(){return[...document.querySelectorAll('main [data-message-author-role]')].slice(-5).map(el=>(el.innerText||el.textContent||'').replace(/\s+/g,' ').slice(0,700)).join(' ').slice(-2800);}
  function subject(prompt){
    const clean=String(prompt||'').replace(/\s+/g,' ').trim();if(!clean)return'cette demande';
    return(clean.split(/(?<=[.!?])\s+/)[0]||clean).slice(0,180);
  }
  function entities(prompt){
    const n=norm(prompt),found=[];
    for(const t of TECH)if(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(n))found.push(t==='node'?'Node.js':t.charAt(0).toUpperCase()+t.slice(1));
    return found.slice(0,5);
  }
  function classify(prompt){
    const p=norm(prompt),ctx=norm(recent()),both=`${p} ${ctx.slice(-700)}`;
    const scores={perf:0,design:0,code:0,research:0,organize:0,legal:0,data:0,writing:0,general:1};
    const add=(key,rx,weight)=>{if(rx.test(p))scores[key]+=weight;if(rx.test(ctx))scores[key]+=1;};
    add('perf',/\b(?:perf|performance|lent|lourd|lag|cache|cpu|memoire|reseau|optim|reflow|polling|timer|onglets?)\b/,12);
    add('design',/design|\bda\b|interface|\bui\b|\bux\b|visuel|couleur|layout|thème|theme|responsive|sidebar|barre|panel|panneau|chevauch|decalage/,10);
    add('code',/code|bug|erreur|script|javascript|typescript|python|php|sql|css|html|api|github|extension|chrome|fonction|endpoint|manifest/,9);
    add('research',/recherche|source|vérifie|verifie|actualité|recent|récent|documentation|prix|tarif/,8);
    add('organize',/tri|classe|classer|projet|project|dossier|structure|organis|réaffect|reaffect/,8);
    add('legal',/jurid|droit|avocat|contrat|licenci|tribunal|justice|plainte|prud|preuve/,11);
    add('data',/tableau|xlsx|excel|csv|données|donnees|métrique|metrique|stat|calcul/,9);
    add('writing',/rédige|redige|écris|ecris|mail|texte|description|article|meta|titre/,7);
    if(/playwright|chromium/.test(both)&&scores.perf>0)scores.perf+=2;
    return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  }

  function cards(prompt){
    const kind=classify(prompt),s=subject(prompt),ents=entities(prompt),p=project();
    const context=[p&&p!=='Hors projet'?`Project ${p}`:'',ents.length?ents.join(', '):''].filter(Boolean).join(' · ');
    const intro=`Sur « ${s} »${context?` — ${context}`:''}.`;
    const sets={
      perf:[
        ['Chemin chaud',`${intro} Repère d'abord tout travail répété inutile : scans DOM, timers, reflows, requêtes, sérialisation et doublons entre onglets. Classe-les par coût réel.`,'perf'],
        ['Mesure réelle',`${intro} Vérifie avant/après avec des métriques concrètes : requêtes, long tasks, mémoire, temps de switch, cache hit et stabilité sur fil lourd.`,'test'],
        ['Architecture cible',`${intro} Propose la version la plus event-driven et cache-first possible, avec un seul owner par responsabilité et un fallback sûr.`,'action']
      ],
      design:[
        ['Hiérarchie UX',`${intro} Analyse alignements, densité, zones cliquables, états actifs et micro-janks. Élimine les clics intermédiaires et déplacements visuels inutiles.`,'design'],
        ['États complets',`${intro} Vérifie PRÊT, CHARGEMENT, ATTENTE, ANALYSE, EXÉCUTION, ERREUR, Safe Mode, petit écran et panneaux ouverts/repliés.`,'ux'],
        ['Critère visuel',`${intro} Transforme les attentes en contrôles mesurables : positions stables, aucun overlap, focus visible, dimensions invariantes et responsive.`,'test']
      ],
      code:[
        ['Diagnostic + patch',`${intro} Pars du comportement observé, isole la cause, puis propose le correctif minimal sans réécrire les parties stables.`,'code'],
        ['Régressions',`${intro} Couvre navigation SPA, état vide, gros fil, plusieurs onglets, réseau lent et changement de DOM. Ajoute les tests qui doivent casser si le bug revient.`,'test'],
        ['Livrable vérifiable',`${intro} Termine par les fichiers/fonctions exacts à modifier, les critères runtime et ce qui reste hypothétique.`,'action']
      ],
      organize:[
        ['Règles de classement',`${intro} Définis les invariants, la confiance minimale, les cas ambigus et la priorité manuel > automatique.`,'organize'],
        ['Simulation avant mutation',`${intro} Produis le plan source → destination → raison → confiance → rollback avant toute modification.`,'test'],
        ['Structure finale',`${intro} Décris le résultat final attendu et les actions exactes sans réattribuer ce qui a été déplacé manuellement.`,'action']
      ],
      research:[
        ['Faits vérifiables',`${intro} Sépare faits, hypothèses et informations susceptibles d'avoir changé. Priorise les sources primaires récentes.`,'research'],
        ['Contradictions',`${intro} Cherche ce qui pourrait invalider la première réponse et garde visibles les zones d'incertitude.`,'blind'],
        ['Synthèse décisionnelle',`${intro} Termine par certain / probable / inconnu, puis ce que cela change concrètement.`,'action']
      ],
      legal:[
        ['Faits / règle / preuve',`${intro} Sépare faits établis, pièces, règle applicable et interprétation. N'invente aucune certitude.`,'research'],
        ['Angle adverse',`${intro} Construis l'argumentation opposée et les points faibles : preuve, délai, prescription, causalité.`,'blind'],
        ['Prochaine action',`${intro} Classe les actions par urgence et indique la preuve/document nécessaire pour chacune.`,'action']
      ],
      data:[
        ['Modèle de données',`${intro} Fixe colonnes, types, clés, unités et règles de calcul avant de produire le tableau.`,'table'],
        ['Contrôles qualité',`${intro} Vérifie doublons, valeurs manquantes, formats, bornes et cohérence des totaux.`,'test'],
        ['Sortie exploitable',`${intro} Fournis la structure de fichier réellement utilisable et les transformations nécessaires.`,'action']
      ],
      writing:[
        ['Audience + objectif',`${intro} Optimise d'abord pour le lecteur et le résultat attendu, puis le ton. Supprime le remplissage.`,'focus'],
        ['Crédibilité',`${intro} Remplace les formulations génériques par des informations concrètes et utiles.`,'blind'],
        ['Version livrable',`${intro} Fournis directement la version finale prête à publier ou envoyer.`,'action']
      ],
      general:[
        ['Réponse ciblée',`${intro} Réponds directement à l'objectif et distingue clairement établi / supposé.`,'focus'],
        ['Angle mort',`${intro} Cherche ce qui pourrait rendre la première réponse fausse, incomplète ou inutile.`,'blind'],
        ['Prochaine action',`${intro} Termine par une action concrète ou un livrable vérifiable.`,'action']
      ]
    };
    return sets[kind]||sets.general;
  }

  function setStatus(text){root.setAttribute('data-ng100-coach-status',text);window.__NIAKGPT_DIAGNOSTICS__?.set('coach',text);}
  function remove(){document.getElementById('ng8-coach')?.remove();lastSig='';}
  function appendPrompt(text){
    const ed=editor();if(!ed)return;
    const current=editorText(ed).trimEnd(),next=`${current}${current?'\n\n':''}${text}`;
    if(ed instanceof HTMLTextAreaElement){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;setter?setter.call(ed,next):ed.value=next;}else ed.textContent=next;
    ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));ed.focus();
  }
  function mount(ed){
    const host=hostFor(ed);if(!host?.parentElement)return null;
    let box=document.getElementById('ng8-coach');
    if(!box){box=document.createElement('section');box.id='ng8-coach';box.setAttribute('data-ng100-coach','1');host.insertAdjacentElement('beforebegin',box);}
    mountedEditor=ed;return box;
  }
  function render(){
    timer=0;if(!enabled()){remove();setStatus(root.dataset.ng90Safe==='1'?'PAUSE · SAFE MODE':'INACTIF · activité');return;}
    const ed=editor();if(!ed){remove();setStatus('INACTIF · composer absent');return;}
    const prompt=editorText(ed).trim();if(!prompt){remove();setStatus('PRÊT · saisie vide');return;}
    const set=cards(prompt),sig=`${prompt}|${set.map(x=>x[0]).join('|')}`;if(sig===lastSig&&document.getElementById('ng8-coach'))return;lastSig=sig;
    const box=mount(ed);if(!box)return;
    box.innerHTML=`<div class="ng8-coach-label"><span>COACH CONTEXTUEL</span><em>${esc(subject(prompt))}</em></div><div class="ng8-coach-grid">${set.map(([title,text,kind],i)=>`<button type="button" class="ng8-sug" data-i="${i}" data-kind="${kind}"><b>${esc(title)}</b><span>${esc(text)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('.ng8-sug').forEach(button=>button.addEventListener('click',()=>{const item=set[Number(button.dataset.i)];if(item)appendPrompt(item[1]);}));
    box.classList.toggle('compact',ed.scrollHeight>120);setStatus(`OK · ${set[0][0]} · 3 recos`);
  }
  function schedule(delay=70){clearTimeout(timer);timer=setTimeout(render,delay);}
  function inputBelongs(target){const ed=editor();return !!ed&&(target===ed||ed.contains?.(target));}
  function start(){
    schedule(50);
    document.addEventListener('input',event=>{if(inputBelongs(event.target))schedule(45);},true);
    document.addEventListener('focusin',event=>{if(inputBelongs(event.target))schedule(30);},true);
    const stateObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng86-activity','data-ng90-coach','data-ng90-safe'].includes(r.attributeName)))schedule(80);});
    stateObserver.observe(root,{attributes:true,attributeFilter:['data-ng86-activity','data-ng90-coach','data-ng90-safe']});
    window.addEventListener('popstate',()=>schedule(120));
    if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(100));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(100);});
    window.addEventListener('pagehide',()=>{clearTimeout(timer);stateObserver.disconnect();},{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();
