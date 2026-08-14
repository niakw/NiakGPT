(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ONBOARDING_101__) return;
  window.__NIAKGPT_ONBOARDING_101__ = true;

  const KEY='niakgpt-onboarding-v100';
  const PROFILE_KEY='niakgpt-profile-v100';
  const INSTALL_META='niakgpt-install-meta-v100';
  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'dev';}catch{return'dev';}})();
  const LEGACY_STORAGE_KEYS=['niakgpt-v08-cache','niakgpt-governance-v085','niakgpt-settings-v090','niakgpt-profile-v100'];
  let modal=null,step=0,selectedProfile='power',returnFocus=null;
  const profiles=[['power','Complet','Dense et complet'],['code','Code / IDE','Code et outils techniques'],['research','Recherche','Lecture longue et sources'],['focus','Focus / Rédaction','Calme et écriture'],['analyst','Analyse','Métadonnées et tableaux'],['contrast','Contraste élevé','Accessibilité renforcée']];

  async function shouldShow(){
    try{
      // Fast path on every normal page load: only two tiny keys, never the chat/index cache.
      const known=await chrome.storage.local.get([KEY,INSTALL_META]);
      if(known[KEY])return false;
      const lifecycle=known[INSTALL_META];
      if(lifecycle?.reason==='install')return true;
      if(lifecycle?.reason==='update'){
        await chrome.storage.local.set({[KEY]:{status:'upgrade-skipped',version:VERSION,previousVersion:lifecycle.previousVersion||'',at:Date.now()}});
        return false;
      }
      // Defensive legacy fallback for installations predating lifecycle metadata.
      const legacy=await chrome.storage.local.get(LEGACY_STORAGE_KEYS);
      if(LEGACY_STORAGE_KEYS.some(key=>legacy[key]!=null)){
        await chrome.storage.local.set({[KEY]:{status:'legacy-skipped',version:VERSION,at:Date.now()}});
        return false;
      }
      return true;
    }catch{return false;}
  }
  function close(){const old=modal;modal=null;old?.remove();if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
  async function mark(status){try{await chrome.storage.local.set({[KEY]:{status,version:VERSION,at:Date.now()}});}catch{}}
  async function skip(){await mark('skipped');close();}
  async function finish(){
    try{await chrome.storage.local.set({[KEY]:{status:'done',version:VERSION,at:Date.now()},[PROFILE_KEY]:selectedProfile});}catch{}
    document.dispatchEvent(new CustomEvent('niakgpt:set-profile',{detail:{profile:selectedProfile}}));close();
  }
  function focusables(){return modal?[...modal.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x instanceof HTMLElement&&x.getClientRects().length):[];}
  function trap(event){const f=focusables();if(!f.length)return;const first=f[0],last=f.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  function profileCards(){return profiles.map(([id,name,sub])=>`<button type="button" data-profile="${id}" class="${selectedProfile===id?'active':''}"><i></i><span><b>${name}</b><small>${sub}</small></span></button>`).join('');}
  function render(){
    if(!modal)return;
    const pages=[
      `<div class="ng100-onboard-hero"><i>⌘</i><div><small>BIENVENUE DANS</small><b>NiakGPT</b><span>ChatGPT, mais pensé comme un véritable espace de travail avancé.</span></div></div><div class="ng100-onboard-points"><div><b>⚡ Piloté par événements</b><span>Moins de scans, un seul onglet de travail entre les onglets ouverts et un cache chaud.</span></div><div><b>▤ Projets gouvernés</b><span>Le manuel gagne toujours sur l’automatisation.</span></div><div><b>◉ États visibles</b><span>Chargement, attente, analyse, exécution et erreur directement dans la barre latérale.</span></div></div>`,
      `<header class="ng100-step-title"><small>02 · ESPACE DE TRAVAIL</small><b>Choisis ton profil de départ</b><span>Tu pourras le changer à tout moment dans le Centre de contrôle.</span></header><div class="ng100-onboard-profiles">${profileCards()}</div>`,
      `<header class="ng100-step-title"><small>03 · RACCOURCIS</small><b>Tout reste à portée de clavier</b></header><div class="ng100-shortcuts"><div><kbd>Alt K</kbd><span><b>Ouverture rapide</b><small>Projets et conversations</small></span></div><div><kbd>Ctrl ⇧ P</kbd><span><b>Palette de commandes</b><small>Commandes et profils</small></span></div><div><kbd>Alt ,</kbd><span><b>Centre de contrôle</b><small>Mode sûr, cache, apparence</small></span></div></div><div class="ng100-onboard-note"><b>MODE SÛR</b><span>Sur un fil extrême, le mode sûr coupe tout ce qui n’est pas essentiel et fait céder le rôle de travail à un onglet plus léger.</span></div>`,
      `<header class="ng100-step-title"><small>04 · GOUVERNANCE DES PROJETS</small><b>NiakGPT n’écrase pas tes décisions</b></header><div class="ng100-governance-rule"><b>MANUEL &gt; AUTOMATIQUE</b><span>Si tu déplaces une conversation toi-même, son projet est vérifié puis verrouillé. L’auto-classement n’y touche plus tant que tu ne retires pas le cadenas.</span></div><div class="ng100-governance-rule"><b>AMBIGU = AUCUN PARI</b><span>Les chats sans correspondance suffisamment fiable restent dans Hors projet / À classer au lieu d’être rangés au hasard.</span></div><div class="ng100-onboard-ready">Prêt. NiakGPT travaille autour de ChatGPT — sans imposer son organisation à la tienne.</div>`
    ];
    modal.innerHTML=`<div class="ng100-onboard-card"><div class="ng100-onboard-progress">${pages.map((_,i)=>`<i class="${i<=step?'on':''}"></i>`).join('')}</div><main>${pages[step]}</main><footer><div>${step?'<button data-prev>Retour</button>':'<button data-skip>Passer</button>'}</div><em>${step+1} / ${pages.length}</em><button class="primary" data-next>${step===pages.length-1?'Commencer':'Continuer'}</button></footer></div>`;
    modal.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>{selectedProfile=b.dataset.profile;render();}));modal.querySelector('[data-prev]')?.addEventListener('click',()=>{step=Math.max(0,step-1);render();});modal.querySelector('[data-skip]')?.addEventListener('click',skip);modal.querySelector('[data-next]')?.addEventListener('click',()=>{if(step<pages.length-1){step++;render();}else finish();});requestAnimationFrame(()=>modal.querySelector('[data-next]')?.focus());
  }
  function open(){if(modal)return;returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;modal=document.createElement('div');modal.id='ng100-onboarding';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Bienvenue dans NiakGPT');document.body.appendChild(modal);render();}

  document.addEventListener('keydown',event=>{if(!modal)return;if(event.key==='Tab')trap(event);if(event.key==='Escape'){event.preventDefault();skip();}},true);

  shouldShow().then(show=>{if(!show)return;const launch=()=>{if(document.body)open();else setTimeout(launch,200);};setTimeout(launch,1250);});
})();
