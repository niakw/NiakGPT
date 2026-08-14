(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LOCALE_FR_101__)return;
  window.__NIAKGPT_LOCALE_FR_101__=true;

  const DICT=new Map([
    ['add to project','Ajouter au projet'],
    ['move to project','Déplacer vers un projet'],
    ['remove from project','Retirer du projet'],
    ['new project','Nouveau projet'],
    ['create project','Créer un projet'],
    ['delete project','Supprimer le projet'],
    ['project settings','Paramètres du projet'],
    ['project instructions','Instructions du projet'],
    ['manage projects','Gérer les projets'],
    ['project governance','Gouvernance des projets'],
    ['projects','Projets'],
    ['quick open','Ouverture rapide'],
    ['command palette','Palette de commandes'],
    ['control center','Centre de contrôle'],
    ['welcome to','Bienvenue dans'],
    ['workspace','Espace de travail'],
    ['workspace power-user local pour chatgpt','Espace de travail avancé local pour ChatGPT'],
    ['safe mode','Mode sûr'],
    ['off','Désactivé'],
    ['easter eggs','Clins d’œil'],
    ['local-first','Local uniquement'],
    ['hits','Succès cache'],
    ['high contrast','Contraste élevé'],
    ['focus / writing','Focus / Rédaction'],
    ['research','Recherche'],
    ['analyst','Analyse'],
    ['explorer','Explorateur'],
    ['outputs','Sorties'],
    ['activity','Activité'],
    ['sources','Sources'],
    ['pin','Épingler'],
    ['unpin','Désépingler'],
    ['rename','Renommer'],
    ['edit','Modifier'],
    ['archive','Archiver'],
    ['unarchive','Désarchiver'],
    ['share','Partager'],
    ['delete','Supprimer'],
    ['close','Fermer'],
    ['cancel','Annuler'],
    ['create','Créer'],
    ['continue','Continuer'],
    ['more options','Plus d’options'],
    ['project menu','Menu du projet'],
    ['project actions','Actions du projet'],
    ['search projects','Rechercher des projets'],
    ['search conversations','Rechercher des conversations']
  ]);
  const INTERACTIVE='button,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="option"],[role="dialog"],[data-radix-menu-content],[data-radix-popper-content-wrapper]';
  const OWN='#ng90-control,#ng85-governance,#ng911-auto,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-pins,#ng100-command,#ng100-onboarding';
  const SURFACE=`${OWN},[role="menu"],[role="dialog"],[data-radix-menu-content],[data-radix-popper-content-wrapper]`;
  const ATTRS=['aria-label','title','placeholder'];
  const INTERESTING=/\b(project|projet|options?|menu|archive|rename|renommer|delete|supprimer|share|partager|pin|éping|unpin|déséping|add to|move to|remove from)\b/i;
  let observer=null,stopTimer=0,scanTimer=0,total=0;

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const french=()=>/^fr(?:-|$)/i.test(document.documentElement.lang||'')||/^fr(?:-|$)/i.test(navigator.language||'');
  const translated=v=>DICT.get(clean(v))||'';
  function ownTranslated(value){
    let text=String(value||'');
    text=text.replace(/\bPROJECT GOVERNANCE\b/gi,'GOUVERNANCE DES PROJETS');
    text=text.replace(/\bProjects principaux\b/gi,'Projets principaux');
    text=text.replace(/\bProjects\b/g,'Projets');
    text=text.replace(/\bQuick Open\b/gi,'Ouverture rapide');
    text=text.replace(/\bControl Center\b/gi,'Centre de contrôle');
    text=text.replace(/\bSafe Mode\b/gi,'Mode sûr');
    text=text.replace(/\bCommand Palette\b/gi,'Palette de commandes');
    text=text.replace(/\bHigh Contrast\b/gi,'Contraste élevé');
    text=text.replace(/\bFocus \/ Writing\b/gi,'Focus / Rédaction');
    text=text.replace(/\bResearch\b/g,'Recherche');
    text=text.replace(/\bAnalyst\b/g,'Analyse');
    return text;
  }
  function nodeTranslation(node){
    const exact=translated(node?.nodeValue);if(exact)return exact;
    const parent=node?.parentElement;if(!parent?.closest?.(OWN))return'';
    const current=String(node.nodeValue||''),next=ownTranslated(current);return next!==current?next:'';
  }

  function replaceTextNode(node){
    const old=String(node.nodeValue||''),next=nodeTranslation(node);if(!next)return false;
    if(translated(old)){const lead=old.match(/^\s*/)?.[0]||'',trail=old.match(/\s*$/)?.[0]||'';node.nodeValue=`${lead}${next}${trail}`;}else node.nodeValue=next;
    return true;
  }
  function patchElement(el){
    if(!(el instanceof Element))return 0;let changed=0;
    for(const attr of ATTRS){const old=el.getAttribute(attr),exact=translated(old),next=exact||(el.closest(OWN)?ownTranslated(old):'');if(next&&next!==old){el.setAttribute(attr,next);changed++;}}
    const mayTranslateText=el.matches?.(INTERACTIVE)||!!el.closest?.(OWN);
    if(mayTranslateText){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>{
        const parent=node.parentElement;if(!parent||parent.closest('code,pre,[contenteditable="true"],textarea,input'))return NodeFilter.FILTER_REJECT;
        return nodeTranslation(node)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes)if(replaceTextNode(node))changed++;
    }
    return changed;
  }
  function scan(root=document){
    if(!french())return;let changed=0;
    if(root instanceof Element)changed+=patchElement(root);
    const scope=root instanceof Element||root instanceof Document||root instanceof DocumentFragment?root:document;
    for(const el of scope.querySelectorAll?.(`${INTERACTIVE},${OWN},${OWN} *,[aria-label],[title],[placeholder]`)||[])changed+=patchElement(el);
    if(changed){total+=changed;window.__NIAKGPT_DIAGNOSTICS__?.set('locale',`FR · ${total} libellé${total===1?'':'s'} traduit${total===1?'':'s'}`);}
  }
  function scanOpenSurfaces(){
    if(!french())return;
    for(const surface of document.querySelectorAll(SURFACE))if(surface instanceof Element&&surface.getClientRects().length)scan(surface);
  }
  function stop(){clearTimeout(stopTimer);observer?.disconnect();observer=null;}
  function arm(duration=1200,initialRoot=null){
    if(!french()||!document.body)return;stop();if(initialRoot)scan(initialRoot);scanOpenSurfaces();
    observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element||node instanceof DocumentFragment)scan(node);});
    observer.observe(document.body,{childList:true,subtree:true});stopTimer=setTimeout(stop,duration);
  }
  function relevantRoot(target){
    if(!(target instanceof Element))return null;
    const own=target.closest(OWN);if(own)return own;
    const surface=target.closest('[role="menu"],[role="dialog"],[data-radix-menu-content],[data-radix-popper-content-wrapper],nav,aside,header');if(surface)return surface;
    const interactive=target.closest(INTERACTIVE);if(!interactive)return null;
    const clue=`${interactive.getAttribute('aria-label')||''} ${interactive.getAttribute('title')||''} ${interactive.textContent||''}`;
    return translated(clue)||INTERESTING.test(clue)?interactive:null;
  }
  function schedule(delay=40,root=null){if(!root)return;clearTimeout(scanTimer);scanTimer=setTimeout(()=>{scanTimer=0;arm(1200,root);},delay);}

  document.addEventListener('pointerdown',event=>schedule(55,relevantRoot(event.target)),true);
  document.addEventListener('contextmenu',event=>schedule(45,relevantRoot(event.target)),true);
  document.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key))schedule(70,relevantRoot(document.activeElement));},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scanOpenSurfaces();});
  window.addEventListener('popstate',()=>setTimeout(scanOpenSurfaces,120));
  window.addEventListener('pagehide',()=>{clearTimeout(scanTimer);stop();},{once:true});
  setTimeout(scanOpenSurfaces,900);
})();
