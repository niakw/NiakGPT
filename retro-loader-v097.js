(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_RETRO_LOADER_097__) return;
  window.__NIAKGPT_RETRO_LOADER_097__ = true;

  const ACTIVE = new Set(['loading','waiting','thinking','executing']);
  const LABELS = {
    loading:['CHARGEMENT','LOAD'],
    waiting:['ATTENTE','WAIT'],
    thinking:['ANALYSE','THINK'],
    executing:['EXÉCUTION','RUN'],
    error:['ERREUR','FAIL'],
    cache:['CACHE','CACHE'],
    index:['INDEXATION','INDEX'],
    done:['TERMINÉ','OK']
  };
  const PRIORITY = { index:1, cache:2, loading:3, waiting:4, thinking:5, executing:6, error:9 };
  const root = document.documentElement;
  const sources = new Map();
  let timer = 0;
  let phase = 2;
  let hideTimer = 0;

  function ensure() {
    let host = document.getElementById('ng97-loader');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'ng97-loader';
    host.setAttribute('aria-hidden','true');
    host.innerHTML = `<span class="ng97-label">NIAKGPT</span><span class="ng97-track"><span class="ng97-cells">${'<i class="ng97-cell"></i>'.repeat(16)}</span></span><span class="ng97-state">LOAD</span>`;
    (document.documentElement || document).appendChild(host);
    return host;
  }

  function current() {
    let best = null;
    for (const value of sources.values()) {
      if (!value) continue;
      if (!best || (PRIORITY[value.state] || 0) > (PRIORITY[best.state] || 0)) best = value;
    }
    return best;
  }

  function paintCells(count) {
    const host = ensure();
    const cells = host.querySelectorAll('.ng97-cell');
    cells.forEach((cell,index) => cell.dataset.on = index < count ? '1' : '0');
  }

  function stopTicker() {
    if (timer) clearInterval(timer);
    timer = 0;
  }

  function startTicker() {
    if (timer) return;
    timer = setInterval(() => {
      const value = current();
      if (!value || value.state === 'error') return;
      phase += 1;
      if (phase > 15) phase = 3;
      paintCells(phase);
    }, 155);
  }

  function render() {
    clearTimeout(hideTimer);
    const host = ensure();
    const value = current();
    if (!value) {
      stopTicker();
      paintCells(16);
      host.dataset.state = 'done';
      host.querySelector('.ng97-state').textContent = 'OK';
      hideTimer = setTimeout(() => { host.dataset.active = '0'; paintCells(0); }, 260);
      return;
    }
    const pair = LABELS[value.state] || LABELS.loading;
    host.dataset.active = '1';
    host.dataset.state = value.state;
    host.dataset.background = value.background ? '1' : '0';
    host.querySelector('.ng97-label').textContent = value.label || pair[0];
    host.querySelector('.ng97-state').textContent = pair[1];
    if (value.state === 'error') {
      stopTicker();
      paintCells(16);
    } else {
      if (phase < 2 || phase > 15) phase = 2;
      paintCells(phase);
      startTicker();
    }
  }

  function setSource(name,state,label='',background=false) {
    if (!state) sources.delete(name);
    else sources.set(name,{state,label,background});
    render();
  }

  function syncActivity() {
    const state = root.dataset.ng86Activity || 'ready';
    if (ACTIVE.has(state) || state === 'error') setSource('activity',state);
    else setSource('activity','');
  }

  const activityObserver = new MutationObserver(syncActivity);
  activityObserver.observe(root,{attributes:true,attributeFilter:['data-ng86-activity']});
  syncActivity();

  document.addEventListener('niakgpt:hotcache-status', event => {
    const mode = String(event.detail?.mode || '').toUpperCase();
    if (/NETWORK|MISS|STALE/.test(mode)) setSource('cache','cache','CACHE CHAUD',true);
    else if (/STORE|STORED/.test(mode)) setSource('cache','cache','MISE EN CACHE',true);
    else if (/ERROR|TOO_LARGE/.test(mode)) setSource('cache','');
    else if (/HIT|READY|DIRTY/.test(mode)) setSource('cache','');
  },{passive:true});

  document.addEventListener('niakgpt:diagnostic-changed', event => {
    const key = String(event.detail?.key || '').toLowerCase();
    if (!['projects','data','quick','governance'].includes(key)) return;
    const text = String(event.detail?.text || '');
    const busy = /index|indexation|réindex|reindex|sync|chargement|en cours|queue/i.test(text) && !/^ok|^prêt|^pret|^cache/i.test(text);
    if (busy) setSource(`diag:${key}`,'index',key === 'projects' ? 'PROJECTS' : key.toUpperCase(),true);
    else setSource(`diag:${key}`,'');
  },{passive:true});

  document.addEventListener('visibilitychange',() => {
    if (document.hidden) stopTicker();
    else if (current()) startTicker();
  },{passive:true});

  window.addEventListener('pagehide',stopTicker,{once:true});
})();
