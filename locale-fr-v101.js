(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_LOCALE_FR_101__)return;
  window.__NIAKGPT_LOCALE_FR_101__=true;
  const OWN='#ng8-pins,#ng8-panel,#ng8-quick,#ng8-rail,#ng8-status,#ng8-coach,#ng90-control,#ng100-onboarding,#ng911-auto';
  const exact=new Map([
    ['Add to project','Ajouter au projet'],['Move to project','Déplacer vers un projet'],['Remove from project','Retirer du projet'],['New project','Nouveau projet'],['Create project','Créer un projet'],['Delete project','Supprimer le projet'],['Project settings','Paramètres du projet'],['Project instructions','Instructions du projet'],['Manage projects','Gérer les projets'],['More options','Plus d’options'],['Project menu','Menu du projet'],['Project actions','Actions du projet'],['Quick Open','Ouverture rapide'],['Control Center','Centre de contrôle'],['Safe Mode','Mode sûr'],['Outputs','Sorties'],['Activity','Activité'],['Sources','Sources'],['Pin','Épingler'],['Unpin','Désépingler'],['Rename','Renommer'],['Archive','Archiver']
  ]);
  const attrs=['aria-label','title','placeholder'];
  function translateValue(value){return exact.get(String(value||'').trim())||'';}
  function translateNode(root){if(!(root instanceof Element||root instanceof Document))return;const list=[];if(root instanceof Element)list.push(root);for(const el of root.querySelectorAll?.('button,[role="button"],[role="menuitem"],[role="option"],input,textarea,[aria-label],[title]')||[])list.push(el);for(const el of list){if(el.closest?.(OWN))continue;for(const a of attrs){const v=el.getAttribute?.(a),t=translateValue(v);if(t&&t!==v)el.setAttribute(a,t);}if(el.children.length===0){const raw=(el.textContent||'').trim(),t=translateValue(raw);if(t)el.textContent=t;}}}
  function scanOpenSurfaces(){for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper],[data-radix-portal],header,nav,aside'))translateNode(root);}
  let observer=null,timer=0;
  function arm(duration=1400,root=null){observer?.disconnect();clearTimeout(timer);const host=root||document.body;if(!host)return;translateNode(host);observer=new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes)if(n instanceof Element)translateNode(n);}});observer.observe(host,{childList:true,subtree:true});timer=setTimeout(()=>{observer?.disconnect();observer=null;},duration);}
  function relevantRoot(target){const el=target instanceof Element?target:null;if(!el)return null;const own=el.closest(OWN);if(own)return own;const shell=el.closest('header,nav,aside');if(shell)return shell;const interactive=el.closest('button,[role="button"],[role="menuitem"],[aria-label],[title]');if(!interactive)return null;const hint=`${interactive.textContent||''} ${interactive.getAttribute('aria-label')||''} ${interactive.getAttribute('title')||''} ${interactive.getAttribute('placeholder')||''}`;return /(project|projet|menu|option|more|plus|add|move|remove|ajout|déplac|retir|source|activity|output)/i.test(hint)?(interactive.closest('header,main,aside,nav')||interactive):null;}
  const intent=event=>{const initialRoot=relevantRoot(event.target);if(initialRoot)arm(1400,initialRoot);};
  document.addEventListener('pointerdown',intent,true);document.addEventListener('contextmenu',intent,true);document.addEventListener('keydown',event=>{if(['Enter',' ','ContextMenu'].includes(event.key))intent(event);},true);
  window.addEventListener('popstate',()=>setTimeout(scanOpenSurfaces,180));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(scanOpenSurfaces,120);});
  setTimeout(()=>{scanOpenSurfaces();const shell=document.querySelector('header,nav,aside');if(shell)arm(1600,shell);},900);
})();
