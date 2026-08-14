(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CONTROL_CENTER_090__) return;
  window.__NIAKGPT_CONTROL_CENTER_090__ = true;

  const VERSION = (() => { try { return chrome.runtime.getManifest().version || 'dev'; } catch { return 'dev'; } })();
  const SETTINGS_KEY = 'niakgpt-settings-v090';
  const SETTINGS_MIRROR = 'niakgpt-settings-mirror-v090';
  const GOV_KEY = 'niakgpt-governance-v085';
  const CACHE_KEY = 'niakgpt-v08-cache';
  const HOT_DB = 'niakgpt-hotcache-v084';
  const HOT_KEYS = ['niakgpt-hotmeta-v084','niakgpt-hotdirty-v084','niakgpt-hotindex-v084'];
  const BOOL_KEYS = ['safeMode','coach','activityColors','motion','nativePins','autoResync','dates','projectBadges','statusBar','easterEggs'];

  const DEFAULTS = Object.freeze({
    safeMode:false,
    matrix:'subtle',
    coach:true,
    activityColors:true,
    motion:true,
    density:'compact',
    nativePins:true,
    autoResync:true,
    dates:true,
    projectBadges:true,
    statusBar:true,
    easterEggs:true
  });

  let settings = { ...DEFAULTS };
  let modalOpen = false;
  let railObserver = null;
  let railWatchdog = 0;
  let returnFocus = null;

  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const bool = v => v === true;
  function sanitize(raw={}) {
    const next={...DEFAULTS};
    for(const key of BOOL_KEYS) if(typeof raw?.[key]==='boolean') next[key]=raw[key];
    if(['normal','subtle','off'].includes(raw?.matrix)) next.matrix=raw.matrix;
    if(['compact','comfortable'].includes(raw?.density)) next.density=raw.density;
    return next;
  }

  function readMirror() {
    try { settings = sanitize(JSON.parse(localStorage.getItem(SETTINGS_MIRROR) || '{}')); } catch { settings={...DEFAULTS}; }
  }
  function writeMirror() { try { localStorage.setItem(SETTINGS_MIRROR, JSON.stringify(settings)); } catch {} }
  function effective() {
    if (!settings.safeMode) return settings;
    return { ...settings, matrix:'off', coach:false, motion:false, nativePins:false, autoResync:false, easterEggs:false };
  }
  function applySettings() {
    const e=effective(),root=document.documentElement;
    root.dataset.ng90Safe=settings.safeMode?'1':'0';root.dataset.ng90Matrix=e.matrix;root.dataset.ng90Coach=e.coach?'on':'off';root.dataset.ng90Activity=e.activityColors?'on':'off';root.dataset.ng90Motion=e.motion?'on':'off';root.dataset.ng90Density=e.density;root.dataset.ng90Dates=e.dates?'on':'off';root.dataset.ng90ProjectBadges=e.projectBadges?'on':'off';root.dataset.ng90Status=e.statusBar?'on':'off';root.dataset.ng90Eggs=e.easterEggs?'on':'off';root.dataset.ng90NativePins=e.nativePins?'on':'off';root.dataset.ng90AutoResync=e.autoResync?'on':'off';writeMirror();decorateStatus();
  }
  async function syncGovernanceAutomation() {
    try { const raw=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY]||{},wanted=effective().autoResync===true;if(raw.autoResync!==wanted)await chrome.storage.local.set({[GOV_KEY]:{...raw,autoResync:wanted}}); } catch {}
  }
  async function loadSettings() {
    try { const raw=(await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];if(raw&&typeof raw==='object')settings=sanitize(raw); } catch {}
    applySettings();await syncGovernanceAutomation();renderModalIfOpen();
  }
  async function saveSettings(next=settings) {
    settings=sanitize(next);applySettings();try{await chrome.storage.local.set({[SETTINGS_KEY]:settings});}catch{}await syncGovernanceAutomation();document.dispatchEvent(new CustomEvent('niakgpt:settings-changed',{detail:{settings:{...settings},effective:effective()}}));renderModalIfOpen();
  }

  function toast(text,kind='ok') {
    let node=document.getElementById('ng90-toast');if(!node){node=document.createElement('div');node.id='ng90-toast';document.body.appendChild(node);}node.dataset.kind=kind;node.textContent=text;node.classList.add('show');clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove('show'),2800);
  }
  function decorateStatus() {
    const status=document.getElementById('ng8-status');if(!status)return;let badge=status.querySelector('.ng90-safe-badge');if(settings.safeMode){if(!badge){badge=document.createElement('span');badge.className='ng90-safe-badge';badge.textContent='SÛR';status.appendChild(badge);}}else badge?.remove();
  }
  function ensureButton() {
    const rail=document.getElementById('ng8-rail');if(!rail)return false;
    if(!rail.querySelector('#ng90-settings-btn')){const button=document.createElement('button');button.id='ng90-settings-btn';button.type='button';button.setAttribute('aria-label','Ouvrir le Centre de contrôle NiakGPT');button.title='Centre de contrôle · Alt+,';button.textContent='⚙';const spacer=rail.querySelector(':scope > span');rail.insertBefore(button,spacer||null);button.addEventListener('click',openModal);}decorateStatus();return true;
  }
  function stopRailWatch(){clearTimeout(railWatchdog);railWatchdog=0;railObserver?.disconnect();railObserver=null;}
  function watchRail(){
    if(ensureButton())return;if(!document.body)return;
    stopRailWatch();railObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;if(node.id==='ng8-rail'||node.querySelector?.('#ng8-rail')){if(ensureButton())stopRailWatch();return;}}});
    railObserver.observe(document.body,{childList:true});railWatchdog=setTimeout(stopRailWatch,15000);
  }

  function hotCacheStats() {
    const root=document.documentElement;let index=[];try{index=JSON.parse(localStorage.getItem('niakgpt-hotindex-v084')||'[]');}catch{}const bytes=Array.isArray(index)?index.reduce((sum,x)=>sum+(Number(x?.bytes)||0),0):0;
    return{mode:root.dataset.ng8Hotcache||'—',entries:Number(root.dataset.ng8HotcacheEntries||(Array.isArray(index)?index.length:0)||0),hits:Number(root.dataset.ng8HotcacheHits||0),misses:Number(root.dataset.ng8HotcacheMisses||0),network:Number(root.dataset.ng8HotcacheNetwork||0),mb:bytes/1024/1024};
  }
  function pageKind(){const p=location.pathname;if(/\/c\//.test(p))return'conversation';if(/\/g\/g-p-[^/]+\/project/.test(p))return'projet';return'accueil';}
  function diagnosticSnapshot(){const h=hotCacheStats();return{product:'NiakGPT',version:VERSION,time:new Date().toISOString(),page:pageKind(),tabRole:document.documentElement.dataset.ng8TabRole||'unknown',activity:document.documentElement.dataset.ng86Activity||'unknown',heavy:document.documentElement.dataset.ng8Heavy==='1',safeMode:settings.safeMode,hotcache:h,settings:{...settings}};}
  async function copyDiagnostic(){try{await navigator.clipboard.writeText(JSON.stringify(diagnosticSnapshot(),null,2));toast('Diagnostic copié — sans contenu de conversation');}catch{toast('Impossible de copier le diagnostic','error');}}
  function downloadJSON(name,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportConfig(){try{const raw=await chrome.storage.local.get([SETTINGS_KEY,GOV_KEY]);const payload={kind:'NiakGPTConfig',schema:1,exportedAt:new Date().toISOString(),version:VERSION,settings:sanitize(raw[SETTINGS_KEY]||settings),governance:raw[GOV_KEY]||null};downloadJSON(`niakgpt-config-${new Date().toISOString().slice(0,10)}.json`,payload);toast('Configuration exportée');}catch{toast('Export impossible','error');}}
  function importConfig(){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.hidden=true;input.onchange=async()=>{const file=input.files?.[0];if(!file)return input.remove();try{const data=JSON.parse(await file.text());if(data?.kind!=='NiakGPTConfig'||data?.schema!==1||!data.settings)throw new Error('format');const writes={[SETTINGS_KEY]:sanitize(data.settings)};if(data.governance&&typeof data.governance==='object')writes[GOV_KEY]=data.governance;await chrome.storage.local.set(writes);toast('Configuration importée');await loadSettings();}catch{toast('Fichier de configuration invalide','error');}input.remove();};document.body.appendChild(input);input.click();}
  function deleteHotDatabase(){try{const req=indexedDB.deleteDatabase(HOT_DB);req.onerror=()=>{};req.onblocked=()=>{};}catch{}}
  async function purgeHotCache(){if(!confirm('Purger le cache chaud des conversations et recharger ChatGPT ?'))return;for(const key of HOT_KEYS){try{localStorage.removeItem(key);}catch{}}deleteHotDatabase();toast('Cache chaud purgé · rechargement…');setTimeout(()=>location.reload(),650);}
  async function rebuildIndex(){if(!confirm('Effacer uniquement l’index projets/conversations de NiakGPT et le reconstruire au prochain chargement ?'))return;try{await chrome.storage.local.remove(CACHE_KEY);}catch{}toast('Index supprimé · rechargement…');setTimeout(()=>location.reload(),500);}
  async function resetPreferences(){if(!confirm('Réinitialiser uniquement les préférences visuelles et de performance ?\n\nLa structure des projets et les verrous manuels seront conservés.'))return;settings={...DEFAULTS};try{await chrome.storage.local.remove(SETTINGS_KEY);}catch{}await saveSettings(settings);toast('Préférences réinitialisées');}
  async function wipeAllLocalData(){if(!confirm('EFFACEMENT COMPLET DES DONNÉES NIAKGPT LOCALES\n\nCela supprime préférences, index, verrous manuels et structure de gouvernance. Les conversations et projets ChatGPT eux-mêmes ne sont pas supprimés.\n\nContinuer ?'))return;if(!confirm('Dernière confirmation : effacer toutes les données locales NiakGPT ?'))return;try{const all=await chrome.storage.local.get(null),keys=Object.keys(all).filter(k=>k.startsWith('niakgpt-')||k.startsWith('__niakgpt_'));if(keys.length)await chrome.storage.local.remove(keys);}catch{}try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&(key.startsWith('niakgpt-')||key.startsWith('__niakgpt_')))localStorage.removeItem(key);}}catch{}deleteHotDatabase();toast('Données locales effacées · rechargement…');setTimeout(()=>location.reload(),700);}

  function toggleRow(key,label,help){return`<label class="ng90-toggle-row"><span><b>${esc(label)}</b><small>${esc(help)}</small></span><input type="checkbox" data-setting="${key}" ${bool(settings[key])?'checked':''}><i></i></label>`;}
  function renderModal() {
    const modal=document.getElementById('ng90-control');if(!modal)return;const h=hotCacheStats(),active=document.activeElement instanceof HTMLElement?document.activeElement:null,focusSetting=active?.dataset?.setting||'';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ng90-control-title');modal.tabIndex=-1;
    modal.innerHTML=`<div class="ng90-card">
      <header><div><small>CENTRE DE CONTRÔLE · ${esc(VERSION)}</small><b id="ng90-control-title">NiakGPT</b><span>Espace de travail avancé local pour ChatGPT</span></div><button data-close aria-label="Fermer le Centre de contrôle">×</button></header>
      <div class="ng90-safe ${settings.safeMode?'on':''}"><div><b>MODE SÛR</b><span>${settings.safeMode?'Actif — animations et automatisations suspendues':'Mode de secours ultra-léger pour les fils extrêmes'}</span></div><label><input type="checkbox" data-setting="safeMode" ${settings.safeMode?'checked':''}><i></i></label></div>
      <div class="ng90-grid">
        <section><h3>APPARENCE</h3><label class="ng90-select"><span><b>Matrix</b><small>Intensité du fond animé</small></span><select data-setting="matrix"><option value="normal" ${settings.matrix==='normal'?'selected':''}>Normal</option><option value="subtle" ${settings.matrix==='subtle'?'selected':''}>Subtil</option><option value="off" ${settings.matrix==='off'?'selected':''}>Désactivé</option></select></label><label class="ng90-select"><span><b>Densité</b><small>Barre latérale et métadonnées</small></span><select data-setting="density"><option value="compact" ${settings.density==='compact'?'selected':''}>Compacte</option><option value="comfortable" ${settings.density==='comfortable'?'selected':''}>Confortable</option></select></label>${toggleRow('motion','Animations','Pulsation d’activité et transitions')}${toggleRow('activityColors','Couleurs d’activité','Conversations / projets / barre basse')}${toggleRow('easterEggs','Clins d’œil','Robots et références SKYNET')}</section>
        <section><h3>ASSISTANCE</h3>${toggleRow('coach','Coach de prompts','Suggestions contextuelles dans le flux de saisie')}${toggleRow('dates','Dates des conversations','Dernier échange dans la barre latérale')}${toggleRow('projectBadges','Badges projets','Projet associé à chaque conversation')}${toggleRow('statusBar','Barre d’état','État, projet et BY SKYNET')}</section>
        <section><h3>AUTOMATISATION</h3>${toggleRow('autoResync','Resynchronisation automatique','Classe uniquement les conversations hors projet non verrouillées')}${toggleRow('nativePins','Pins natifs','Synchronise les projets principaux dans ChatGPT')}<div class="ng90-info"><b>Manuel &gt; automatique</b><span>Une conversation déplacée manuellement reste verrouillée et n’est jamais reclassée sans action explicite.</span></div></section>
        <section><h3>PERFORMANCE & CACHE</h3><div class="ng90-metrics"><div><b>${h.entries}</b><span>fils chauds</span></div><div><b>${h.hits}</b><span>succès cache</span></div><div><b>${h.network}</b><span>réseau</span></div><div><b>${h.mb.toFixed(1)}</b><span>Mo</span></div></div><div class="ng90-actions"><button data-purge-cache>Purger le cache chaud</button><button data-rebuild-index>Reconstruire l’index</button><button data-copy-diag>Copier le diagnostic</button></div><div class="ng90-info"><b>Local uniquement</b><span>Aucun serveur NiakGPT, aucune analytique, aucune API payante.</span></div></section>
      </div>
      <footer><div><button data-export>Exporter</button><button data-import>Importer</button></div><span></span><button data-reset>Réinitialiser les préférences</button><button class="danger" data-wipe>Effacer les données locales</button></footer>
    </div>`;
    modal.querySelector('[data-close]')?.addEventListener('click',closeModal);modal.onmousedown=e=>{if(e.target===modal)closeModal();};
    modal.querySelectorAll('[data-setting]').forEach(control=>control.addEventListener('change',async()=>{const key=control.dataset.setting,value=control instanceof HTMLInputElement&&control.type==='checkbox'?control.checked:control.value;await saveSettings({...settings,[key]:value});}));
    modal.querySelector('[data-purge-cache]')?.addEventListener('click',purgeHotCache);modal.querySelector('[data-rebuild-index]')?.addEventListener('click',rebuildIndex);modal.querySelector('[data-copy-diag]')?.addEventListener('click',copyDiagnostic);modal.querySelector('[data-export]')?.addEventListener('click',exportConfig);modal.querySelector('[data-import]')?.addEventListener('click',importConfig);modal.querySelector('[data-reset]')?.addEventListener('click',resetPreferences);modal.querySelector('[data-wipe]')?.addEventListener('click',wipeAllLocalData);
    if(focusSetting)queueMicrotask(()=>modal.querySelector(`[data-setting="${CSS.escape(focusSetting)}"]`)?.focus());
  }
  function renderModalIfOpen(){if(modalOpen)renderModal();}
  function focusables(){const modal=document.getElementById('ng90-control');return modal?[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x instanceof HTMLElement&&x.getClientRects().length):[];}
  function openModal(){let modal=document.getElementById('ng90-control');if(!modal){modal=document.createElement('div');modal.id='ng90-control';document.body.appendChild(modal);}returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:document.getElementById('ng90-settings-btn');modalOpen=true;renderModal();requestAnimationFrame(()=>{modal.classList.add('open');(modal.querySelector('[data-close]')||modal).focus();});}
  function closeModal(){const modal=document.getElementById('ng90-control');modalOpen=false;modal?.classList.remove('open');setTimeout(()=>{modal?.remove();if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;},150);}
  function trapTab(event){if(!modalOpen||event.key!=='Tab')return;const items=focusables();if(!items.length){event.preventDefault();return;}const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}

  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modalOpen){event.preventDefault();closeModal();return;}if(modalOpen)trapTab(event);if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key===','){event.preventDefault();modalOpen?closeModal():openModal();}},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[SETTINGS_KEY])loadSettings();});
  window.addEventListener('pagehide',stopRailWatch,{once:true});

  readMirror();applySettings();loadSettings();watchRail();
})();
