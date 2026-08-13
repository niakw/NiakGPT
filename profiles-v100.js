(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROFILES_100__) return;
  window.__NIAKGPT_PROFILES_100__ = true;

  const KEY='niakgpt-profile-v100';
  const ALLOWED=new Set(['power','code','research','focus','analyst','contrast']);
  const LABELS={power:'Power',code:'Code / IDE',research:'Research',focus:'Focus / Writing',analyst:'Analyst',contrast:'High Contrast'};
  let profile='power',decorateTimer=0;

  function apply(next,{persist=false}={}){
    profile=ALLOWED.has(next)?next:'power';
    document.documentElement.dataset.ng100Profile=profile;
    try{localStorage.setItem(KEY,profile);}catch{}
    if(persist)chrome.storage.local.set({[KEY]:profile}).catch?.(()=>{});
    document.dispatchEvent(new CustomEvent('niakgpt:profile-changed',{detail:{profile,label:LABELS[profile]}}));
    decorateControl();
  }

  async function load(){
    let mirrored='';try{mirrored=localStorage.getItem(KEY)||'';}catch{}
    if(ALLOWED.has(mirrored))apply(mirrored);
    try{const stored=(await chrome.storage.local.get(KEY))[KEY];if(ALLOWED.has(stored))apply(stored);}catch{}
  }

  function cards(){
    return [...ALLOWED].map(id=>`<button type="button" data-ng100-profile="${id}" class="${profile===id?'active':''}"><i></i><span><b>${LABELS[id]}</b><small>${id==='power'?'Dense et complet':id==='code'?'IDE, code et contraste technique':id==='research'?'Lecture longue et sources':id==='focus'?'Écriture, calme et concentration':id==='analyst'?'Tableaux, métriques et métadonnées':'Contraste maximal et mouvement réduit'}</small></span></button>`).join('');
  }

  function decorateControl(){
    const modal=document.getElementById('ng90-control'),card=modal?.querySelector('.ng90-card');if(!card)return false;
    let section=card.querySelector('.ng100-profile-section');
    if(!section){section=document.createElement('section');section.className='ng100-profile-section';const safe=card.querySelector('.ng90-safe');safe?.insertAdjacentElement('afterend',section);}
    section.innerHTML=`<header><b>PROFIL DE WORKSPACE</b><span>${LABELS[profile]}</span></header><div>${cards()}</div>`;
    section.querySelectorAll('[data-ng100-profile]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.ng100Profile,{persist:true})));
    return true;
  }
  function scheduleDecorate(delay=0){clearTimeout(decorateTimer);decorateTimer=setTimeout(decorateControl,delay);}

  document.addEventListener('niakgpt:set-profile',event=>apply(event.detail?.profile,{persist:true}));
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng90-settings-btn,#ng90-control'))scheduleDecorate(0);},true);
  document.addEventListener('keydown',event=>{if(event.altKey&&event.key===',')scheduleDecorate(0);},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[KEY]&&ALLOWED.has(changes[KEY].newValue))apply(changes[KEY].newValue);});

  load();
})();
