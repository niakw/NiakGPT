(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_COMMANDS_100__) return;
  window.__NIAKGPT_COMMANDS_100__ = true;

  const SETTINGS_KEY='niakgpt-settings-v090';
  let modal=null,items=[],selected=0,returnFocus=null;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function patchSettings(patch){
    try{const raw=(await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]||{};await chrome.storage.local.set({[SETTINGS_KEY]:{...raw,...patch}});}catch{}
  }
  function click(selector){const el=document.querySelector(selector);if(el instanceof HTMLElement){el.click();return true;}return false;}
  function openTab(tab){if(click(`#ng8-rail [data-tab="${tab}"]`))return;}
  function commandList(){return[
    {id:'quick',icon:'⌘',title:'Quick Open',hint:'Alt+K',keys:'quick chats conversations projects recherche',run:()=>{close();click('#ng8-rail [data-q],#ng8-status [data-q]');}},
    {id:'settings',icon:'⚙',title:'Centre de contrôle',hint:'Alt+,',keys:'settings paramètres preferences configuration',run:()=>{close();click('#ng90-settings-btn');}},
    {id:'safe',icon:'◈',title:'Basculer Safe Mode',hint:'Performance',keys:'safe performance lourd secours',run:async()=>{const on=document.documentElement.dataset.ng90Safe==='1';close();await patchSettings({safeMode:!on});}},
    {id:'explorer',icon:'▤',title:'Ouvrir Explorer',hint:'Projects',keys:'explorer projets projects',run:()=>{close();openTab('explorer');}},
    {id:'toc',icon:'☷',title:'Ouvrir le sommaire',hint:'Conversation',keys:'toc sommaire conversation sections',run:()=>{close();openTab('toc');}},
    {id:'diag',icon:'◉',title:'Ouvrir le diagnostic',hint:'Runtime',keys:'diagnostic debug runtime état status',run:()=>{close();openTab('diag');}},
    {id:'governance',icon:'§',title:'Project Governance',hint:'Nettoyer & reconstruire',keys:'governance projets tri classement nettoyage',run:()=>{close();openTab('explorer');setTimeout(()=>click('#ng8-panel [data-repair]'),120);}},
    {id:'matrix',icon:'⌁',title:'Basculer Matrix',hint:'Visuel',keys:'matrix fond animation',run:async()=>{const off=document.documentElement.dataset.ng90Matrix==='off';close();await patchSettings({matrix:off?'subtle':'off'});}},
    {id:'power',icon:'◆',title:'Profil : Power',hint:'Workspace',keys:'profile profil power',run:()=>setProfile('power')},
    {id:'code',icon:'</>',title:'Profil : Code / IDE',hint:'Workspace',keys:'profile profil code ide dev',run:()=>setProfile('code')},
    {id:'research',icon:'▧',title:'Profil : Research',hint:'Workspace',keys:'profile profil research recherche lecture',run:()=>setProfile('research')},
    {id:'focus',icon:'○',title:'Profil : Focus / Writing',hint:'Workspace',keys:'profile profil focus writing ecriture calme',run:()=>setProfile('focus')},
    {id:'analyst',icon:'▦',title:'Profil : Analyst',hint:'Workspace',keys:'profile profil analyst data tableau',run:()=>setProfile('analyst')},
    {id:'contrast',icon:'◐',title:'Profil : High Contrast',hint:'Accessibilité',keys:'profile profil contrast contraste accessibility accessibilite',run:()=>setProfile('contrast')}
  ];}
  function setProfile(profile){close();document.dispatchEvent(new CustomEvent('niakgpt:set-profile',{detail:{profile}}));}

  function filtered(q){const n=norm(q).replace(/^>/,'').trim();const all=commandList();if(!n)return all;const terms=n.split(/\s+/).filter(Boolean);return all.filter(c=>{const hay=norm(`${c.title} ${c.hint} ${c.keys}`);return terms.every(t=>hay.includes(t));});}
  function paint(){
    if(!modal)return;const input=modal.querySelector('input'),list=modal.querySelector('section');items=filtered(input.value);selected=Math.min(selected,Math.max(0,items.length-1));list.innerHTML=items.length?items.map((c,i)=>`<button type="button" class="${i===selected?'sel':''}" data-i="${i}"><i>${esc(c.icon)}</i><span>${esc(c.title)}</span><small>${esc(c.hint)}</small></button>`).join(''):'<div class="ng100-command-empty">Aucune commande</div>';list.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>run(Number(b.dataset.i))));
  }
  function run(index){const cmd=items[index];if(cmd)Promise.resolve(cmd.run()).catch(()=>{});}
  function focusables(){return modal?[...modal.querySelectorAll('input,button:not([disabled])')].filter(x=>x instanceof HTMLElement&&x.getClientRects().length):[];}
  function trap(event){const f=focusables();if(!f.length)return;const first=f[0],last=f.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  function open(){
    if(modal){modal.querySelector('input')?.focus();return;}
    returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;modal=document.createElement('div');modal.id='ng100-command';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Palette de commandes NiakGPT');modal.innerHTML='<div><header><span>⌘</span><input aria-label="Rechercher une commande" placeholder="> Command Palette"><kbd>Ctrl ⇧ P</kbd></header><section></section><footer><span>↑↓ naviguer</span><span>Entrée exécuter</span><span>Échap fermer</span></footer></div>';document.body.appendChild(modal);const input=modal.querySelector('input');input.addEventListener('input',()=>{selected=0;paint();});input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();selected=Math.min(selected+1,items.length-1);paint();}else if(event.key==='ArrowUp'){event.preventDefault();selected=Math.max(0,selected-1);paint();}else if(event.key==='Enter'){event.preventDefault();run(selected);}else if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab')trap(event);});modal.addEventListener('mousedown',event=>{if(event.target===modal)close();});paint();requestAnimationFrame(()=>{modal.classList.add('open');input.focus();});
  }
  function close(){const old=modal;if(!old)return;modal=null;old.classList.remove('open');setTimeout(()=>old.remove(),120);if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}

  document.addEventListener('keydown',event=>{
    const shortcut=(event.ctrlKey||event.metaKey)&&event.shiftKey&&String(event.key).toLowerCase()==='p';
    if(shortcut){event.preventDefault();event.stopImmediatePropagation();modal?close():open();return;}
    if(event.key==='Escape'&&modal){event.preventDefault();close();}
  },true);
})();
