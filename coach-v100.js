(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_COACH_100__) return;
  window.__NIAKGPT_COACH_100__ = true;

  const TECH=['javascript','typescript','python','php','sql','css','html','react','vue','node','nodejs','chrome','extension','api','github','shopify','prestashop','docker','rust','tauri','playwright','chromium','indexeddb','broadcastchannel','websocket','fetch','http','seo','sea','excel','xlsx'];
  const STOP=new Set(('avec dans pour sans sous entre vers chez depuis cette cela ceci faire fais peux peut faut faudrait veux voudrais besoin donne donner explique analyser analyse ajoute ajouter regarde regarder vérifie verifier optimise optimiser améliore ameliorer le la les un une des de du et ou en sur au aux ce cet ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project').split(/\s+/));
  let renderTimer=0,boxObserver=null,observedBox=null,lastSig='';

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const enabled=()=>document.documentElement.dataset.ng90Coach!=='off'&&document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng86Activity==='ready';

  function composer(){
    const els=[...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')];
    for(let i=els.length-1;i>=0;i--){const editor=els[i];if(!(editor instanceof HTMLElement))continue;const r=editor.getBoundingClientRect();if(r.width<220||r.height<16||r.bottom<innerHeight*.40)continue;const form=editor.closest('form')||editor.closest('[data-type="unified-composer"]')||editor.closest('[class*="composer"]')||editor.parentElement;return{editor,form,shell:form?.parentElement||form};}
    return null;
  }
  const editorText=e=>e instanceof HTMLTextAreaElement?e.value:(e?.innerText||e?.textContent||'');
  function turns(){return[...document.querySelectorAll('main [data-message-author-role]')].filter(el=>!el.closest('#ng8-coach,#ng100-coach')).slice(-8);}
  function recent(){return turns().slice(-5).map(el=>`${el.getAttribute('data-message-author-role')||''}: ${(el.innerText||el.textContent||'').replace(/\s+/g,' ').slice(0,1200)}`).join('\n').slice(-5200);}
  function project(){return(document.querySelector('#ng8-status .ng8-status-project')?.textContent||'').trim();}
  function chatTitle(){
    const current=document.querySelector('a.ng8-current[href*="/c/"],a.ng86-current-chat[href*="/c/"],a[aria-current="page"][href*="/c/"]');
    const text=(current?.querySelector('.truncate span')?.textContent||current?.textContent||'').replace(/\d{2}\/\d{2}(?:\/\d{2})?/g,'').trim();
    if(text)return text.slice(0,120);return document.title.replace(/\s*[-–—|]\s*(ChatGPT|NiakGPT).*$/i,'').replace(/ChatGPT|NiakGPT/gi,'').trim().slice(0,120);
  }
  function subject(prompt){const clean=String(prompt||'').replace(/\s+/g,' ').trim();const first=(clean.split(/(?<=[.!?])\s+|\n+/)[0]||clean).trim();return first.slice(0,180)||'cette demande';}
  function constraints(prompt){
    const parts=String(prompt||'').replace(/\s+/g,' ').match(/(?:sans|avec|uniquement|seulement|au moins|maximum|max|min|gratuit(?:e)?|moins de|plus de|ne .*? pas|pas de|\b\d+(?:[.,]\d+)?\s*(?:€|%|ms|s|mo|go|px|mots?|jours?|heures?|onglets?|chats?)\b)[^.;!?]{0,90}/gi)||[];
    return [...new Set(parts.map(x=>x.trim()))].slice(0,3);
  }
  function entities(prompt){
    const raw=String(prompt||''),n=norm(raw),found=[];
    for(const t of TECH)if(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(n))found.push(t==='nodejs'?'Node.js':t.charAt(0).toUpperCase()+t.slice(1));
    const caps=raw.match(/\b[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ0-9._+-]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ0-9._+-]{2,})?\b/g)||[];
    for(const x of caps){if(!STOP.has(norm(x))&&!found.some(y=>norm(y)===norm(x)))found.push(x);}
    return found.slice(0,5);
  }
  function classify(prompt,context){
    const p=norm(prompt),c=norm(context),score={code:0,perf:0,design:0,research:0,legal:0,compare:0,organize:0,writing:0,data:0,general:1};
    const add=(k,rx,w)=>{if(rx.test(p))score[k]+=w;if(rx.test(c))score[k]+=Math.max(1,Math.floor(w*.22));};
    add('code',/\b(code|bug|erreur|script|javascript|typescript|python|php|sql|css|html|api|github|extension|chrome|fonction|classe|endpoint|manifest)\b/,8);
    add('perf',/\b(perf|performance|lent|lourd|lag|cache|cpu|memoire|mémoire|reseau|réseau|optim|reflow|polling|timer|onglets?)\b/,9);
    add('design',/\b(design|da|interface|ui|ux|visuel|couleur|layout|theme|thème|responsive|sidebar|barre|panel|panneau)\b/,8);
    add('research',/\b(recherche|source|sources|verifie|vérifie|actualité|recent|récent|étude|etude|documentation|prix|tarif)\b/,7);
    add('legal',/\b(jurid|droit|avocat|contrat|licenci|tribunal|justice|plainte|prud|preuve)\b/,10);
    add('compare',/\b(compare|comparaison|versus|vs|alternative|meilleur|choisir|différence|difference)\b/,9);
    add('organize',/\b(tri|classe|classer|projet|project|dossier|structure|organis|réaffect|reaffect)\b/,7);
    add('writing',/\b(rédige|redige|écris|ecris|mail|texte|description|article|seo|meta|titre)\b/,7);
    add('data',/\b(tableau|xlsx|excel|csv|données|donnees|métrique|metrique|stat|calcul)\b/,8);
    return Object.entries(score).sort((a,b)=>b[1]-a[1])[0][0];
  }
  function whyIntent(prompt){const p=norm(prompt);if(/\b(pourquoi|cause|raison|explique pourquoi)\b/.test(p))return'cause';if(/\b(comment|mettre en place|implément|implement|faire pour)\b/.test(p))return'how';if(/\b(est[- ]ce|peut[- ]on|possible|faut[- ]il|dois[- ]je)\b/.test(p))return'decide';return'execute';}
  function cards(prompt){
    const ctx=recent(),kind=classify(prompt,ctx),intent=whyIntent(prompt),s=subject(prompt),cons=constraints(prompt),ents=entities(prompt),p=project(),title=chatTitle();
    const scope=[p&&p!=='Hors projet'?`Project « ${p} »`:null,title?`fil « ${title} »`:null,ents.length?`éléments détectés : ${ents.join(', ')}`:null].filter(Boolean).join(' · ');
    const constraintText=cons.length?` Respecte explicitement ces contraintes : ${cons.join(' ; ')}.`:'';
    const base=`Sur « ${s} »${scope?` (${scope})`:''}.`;
    const byKind={
      code:[
        ['Diagnostic + patch',`${base} Pars du comportement observé, identifie la cause la plus probable, puis propose le correctif minimal directement applicable. Ne réécris pas ce qui fonctionne.${constraintText}`,'code'],
        ['Régression / cas limites',`${base} Cherche les régressions possibles : état vide, fil lourd, navigation SPA, plusieurs onglets, erreurs réseau et DOM ChatGPT changeant. Donne les tests qui doivent casser si le bug revient.`,'test'],
        ['Livrable vérifiable',`${base} Termine par un diff ou une liste exacte de fichiers/fonctions à modifier, puis les critères de validation runtime et visuels. Signale clairement ce qui reste une hypothèse.`,'action']
      ],
      perf:[
        ['Chemin chaud',`${base} Identifie tout travail répété inutile : scans DOM, timers, reflows, requêtes, sérialisation et travail dupliqué entre onglets. Priorise ce qui touche le chemin chaud.${constraintText}`,'perf'],
        ['Mesure réelle',`${base} Définis des métriques avant/après : requêtes réseau, long tasks, nombre de scans, mémoire/cache, temps de switch et stabilité sur conversation lourde. N'optimise pas à l'intuition.`,'test'],
        ['Architecture cible',`${base} Propose la version la plus event-driven/cache-first possible, avec fallback sûr. Distingue ce qui doit être instantané, idle, partagé entre onglets ou complètement supprimé.`,'action']
      ],
      design:[
        ['Hiérarchie UX',`${base} Analyse la hiérarchie visuelle, densité, alignements, zones cliquables et états. Cherche surtout les micro-janks, chevauchements et clics intermédiaires inutiles.${constraintText}`,'design'],
        ['États complets',`${base} Vérifie le rendu en PRÊT, CHARGEMENT, ATTENTE, ANALYSE, EXÉCUTION, ERREUR, Safe Mode, petit écran et panneau latéral ouvert/fermé.`,'ux'],
        ['Critère visuel',`${base} Donne des contrôles Playwright mesurables : positions stables, aucun overlap, overflow maîtrisé, focus visible et dimensions invariantes entre états.`,'test']
      ],
      legal:[
        ['Faits / règle / preuve',`${base} Sépare strictement faits établis, pièces disponibles, règle applicable et interprétation. N'invente aucune preuve ni certitude juridique.${constraintText}`,'research'],
        ['Angle adverse',`${base} Construis aussi l'argumentation opposée et identifie les points faibles, prescriptions, délais ou preuves manquantes qui peuvent changer l'issue.`,'blind'],
        ['Prochaine action',`${base} Termine par les actions concrètes dans l'ordre, avec niveau d'urgence et document/preuve nécessaire pour chacune.`,'action']
      ],
      compare:[
        ['Comparaison homogène',`${base} Compare les options sur exactement les mêmes critères, en donnant plus de poids aux contraintes réellement importantes ici.${constraintText}`,'table'],
        ['Inconnues / actualité',`${base} Sépare les différences établies des éléments susceptibles d'avoir changé. Indique ce qui nécessite une vérification récente avant décision.`,'research'],
        ['Choix final',`${base} Donne un choix principal, les compromis acceptés, puis le cas précis où l'alternative devient meilleure.`,'action']
      ],
      research:[
        ['Question vérifiable',`${base} Décompose la demande en faits vérifiables et hypothèses. Cherche d'abord les sources primaires/récentes qui changent réellement la réponse.${constraintText}`,'research'],
        ['Contradictions',`${base} Recherche les sources qui pourraient contredire la première réponse et indique les zones d'incertitude au lieu de lisser les divergences.`,'blind'],
        ['Synthèse décisionnelle',`${base} Termine par une synthèse courte : ce qui est certain, probable, inconnu, puis ce que cela change concrètement pour la décision.`,'action']
      ],
      organize:[
        ['Règles de classement',`${base} Définis d'abord les invariants : manuel > automatique, confiance minimale, cas ambigus et comportement des reliquats/doublons.${constraintText}`,'organize'],
        ['Simulation avant mutation',`${base} Produis un plan de migration avant toute modification : source, destination, raison, confiance, éléments protégés et rollback.`,'test'],
        ['Résultat opérationnel',`${base} Donne la structure finale attendue puis les actions exactes pour y arriver sans réattribuer derrière ce qui a été déplacé manuellement.`,'action']
      ],
      data:[
        ['Modèle de données',`${base} Définis colonnes, types, clés, unités et règles de calcul avant de produire le tableau. Évite les métriques ambiguës.${constraintText}`,'table'],
        ['Contrôles qualité',`${base} Ajoute les validations : valeurs manquantes, doublons, formats, bornes, cohérence des totaux et cas extrêmes.`,'test'],
        ['Sortie exploitable',`${base} Termine avec la structure de fichier/tableau réellement utilisable et les formules ou transformations nécessaires.`,'action']
      ],
      writing:[
        ['Audience + objectif',`${base} Réécris en fonction de l'audience et du résultat attendu, pas seulement du ton. Garde les informations concrètes et supprime le remplissage.${constraintText}`,'focus'],
        ['Crédibilité',`${base} Repère les formulations génériques, répétitives ou artificielles et remplace-les par des détails vérifiables ou utiles au lecteur.`,'blind'],
        ['Version livrable',`${base} Fournis directement la version finale prête à publier/envoyer, avec la structure et la longueur adaptées au support.`,'action']
      ],
      general:[
        [intent==='cause'?'Chaîne causale':intent==='decide'?'Décision cadrée':'Réponse ciblée',`${base} Réponds directement à l'objectif implicite, en distinguant ce qui est établi de ce qui est supposé.${constraintText}`,'focus'],
        ['Angle mort',`${base} Cherche ce qui pourrait rendre la première réponse fausse, incomplète ou inutile dans le contexte actuel.`,'blind'],
        ['Suite concrète',`${base} Termine par le prochain geste réellement utile, avec un critère simple permettant de savoir si le résultat est bon.`,'action']
      ]
    };
    const chosen=byKind[kind]||byKind.general;
    return{kind,scope,items:chosen.map(([title,text,key])=>({title,text,key}))};
  }

  function append(editor,text){
    editor.focus();if(editor instanceof HTMLTextAreaElement){const sep=editor.value.trim()?'\n\n':'',start=editor.selectionStart??editor.value.length,end=editor.selectionEnd??editor.value.length;editor.setRangeText(`${sep}${text}`,start,end,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));return;}
    const sel=getSelection(),range=document.createRange();range.selectNodeContents(editor);range.collapse(false);sel.removeAllRanges();sel.addRange(range);document.execCommand('insertText',false,`${editorText(editor).trim()?'\n\n':''}${text}`);editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
  }
  function observeBox(box){if(box===observedBox)return;boxObserver?.disconnect();observedBox=box;if(!box)return;boxObserver=new MutationObserver(()=>schedule(40));boxObserver.observe(box,{childList:true,subtree:true});}
  function render(){
    renderTimer=0;const c=composer(),old=document.getElementById('ng8-coach');if(!enabled()||!c?.editor||!c.form||!c.shell){if(old)old.hidden=true;return;}
    const prompt=editorText(c.editor).trim();if(prompt.length<5){if(old)old.hidden=true;return;}
    let box=old;if(!box){box=document.createElement('div');box.id='ng8-coach';c.shell.insertBefore(box,c.form);}else if(box.parentElement!==c.shell){box.remove();c.shell.insertBefore(box,c.form);}
    observeBox(box);const model=cards(prompt),sig=JSON.stringify([prompt,model.kind,model.scope,model.items.map(x=>x.text)]);if(sig===lastSig&&box.dataset.ng100Coach==='1'){box.hidden=false;return;}lastSig=sig;
    box.setAttribute('data-ng100-coach','1');box.hidden=false;const attachments=c.form.querySelectorAll('[data-testid*="attachment"],[data-testid*="file"],img').length;box.classList.toggle('compact',attachments>0||c.form.getBoundingClientRect().height>180);
    box.innerHTML=`<div class="ng8-coach-label"><span>✦ NIAKGPT · COACH</span><em>${esc(model.kind.toUpperCase())}${model.scope?` · ${esc(model.scope.slice(0,90))}`:''}</em></div><div class="ng8-sug-grid">${model.items.map((x,i)=>`<button type="button" data-ng100-i="${i}" class="ng8-sug ng8-${x.key}"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('[data-ng100-i]').forEach(button=>button.addEventListener('click',()=>append(c.editor,model.items[Number(button.dataset.ng100I)].text)));
  }
  function schedule(delay=190){clearTimeout(renderTimer);renderTimer=setTimeout(render,delay);}

  document.addEventListener('input',event=>{const t=event.target;if(!(t instanceof Element))return;if(t.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea')||t.isContentEditable)schedule(190);},true);
  document.addEventListener('niakgpt:settings-changed',()=>schedule(20));
  document.addEventListener('niakgpt:activity-network',event=>{if(event.detail?.phase==='request')document.getElementById('ng8-coach')?.setAttribute('hidden','');else if(event.detail?.phase==='error')schedule(700);},true);
  window.addEventListener('popstate',()=>{lastSig='';schedule(220);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(120);});
  schedule(500);
})();
