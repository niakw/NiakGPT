(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_HOTCACHE_084__) return;
  window.__NIAKGPT_HOTCACHE_084__ = true;

  const VERSION=(()=>{try{return chrome.runtime.getManifest().version||'dev';}catch{return'dev';}})();
  const CACHE_KEY = 'niakgpt-v08-cache';
  const META_KEY = 'niakgpt-hotmeta-v084';
  const DIRTY_KEY = 'niakgpt-hotdirty-v084';
  let lastStatus = { mode:'READY', hits:0, misses:0, network:0, deduped:0, entries:0 };
  let syncTimer = 0;
  let diagTimer = 0;

  function parseTime(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
    if (typeof value === 'string') {
      const n = Number(value);
      if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
      const d = Date.parse(value);
      return Number.isFinite(d) ? d : 0;
    }
    return 0;
  }

  function cidFromPath() {
    return location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  }

  function composerTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
  }

  function markDirty(id = cidFromPath()) {
    if (!id) return;
    try {
      const dirty = JSON.parse(localStorage.getItem(DIRTY_KEY) || '{}');
      dirty[id] = Date.now();
      localStorage.setItem(DIRTY_KEY, JSON.stringify(dirty));
    } catch {}
    document.documentElement.setAttribute('data-ng8-hotdirty-id', id);
    document.dispatchEvent(new CustomEvent('niakgpt:hotcache-dirty', { detail:{ id } }));
    setTimeout(() => {
      if(document.documentElement.getAttribute('data-ng8-hotdirty-id')===id)document.documentElement.removeAttribute('data-ng8-hotdirty-id');
    }, 1000);
  }

  async function syncMeta() {
    clearTimeout(syncTimer);
    syncTimer = 0;
    try {
      const raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
      const meta = {};
      const ingest = (chat, forcedProject = '') => {
        if (!chat?.id) return;
        const updated = parseTime(chat.updated || chat.update_time || chat.create_time);
        if (!updated) return;
        const old = meta[chat.id];
        if (!old || updated > old.updated) meta[chat.id] = { updated, projectId:chat.projectId || forcedProject || '' };
      };
      for (const chat of raw.chats || []) ingest(chat);
      for (const [pid, list] of Object.entries(raw.projectChats || {})) for (const chat of list || []) ingest(chat, pid);
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      document.dispatchEvent(new CustomEvent('niakgpt:hotmeta-updated'));
      document.documentElement.dataset.ng8Hotmeta = String(Object.keys(meta).length);
      patchDiagnostic();
    } catch (error) {
      console.warn('[NiakGPT hotcache] metadata sync failed', error);
    }
  }

  function scheduleMeta(delay = 300) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncMeta, delay);
  }

  function patchDiagnostic() {
    clearTimeout(diagTimer);
    diagTimer=0;
    const diag = document.querySelector('#ng8-panel .ng8-diag');
    if (!diag) return false;
    let row = diag.querySelector(':scope > .ng8-hotcache-diagnostic');
    if (!row) {
      row = document.createElement('div');
      row.className = 'ng8-hotcache-diagnostic';
      const roleRow = diag.querySelector(':scope > .ng8-tab-diagnostic');
      if (roleRow) roleRow.insertAdjacentElement('afterend', row); else diag.prepend(row);
    }
    const mode = document.documentElement.dataset.ng8Hotcache || lastStatus.mode || 'READY';
    const hits = Number(document.documentElement.dataset.ng8HotcacheHits || lastStatus.hits || 0);
    const net = Number(document.documentElement.dataset.ng8HotcacheNetwork || lastStatus.network || 0);
    const dedupe = Number(document.documentElement.dataset.ng8HotcacheDeduped || lastStatus.deduped || 0);
    const entries = Number(document.documentElement.dataset.ng8HotcacheEntries || lastStatus.entries || 0);
    const hot = /^(HIT|HIT_AFTER_LOCK|STORED|READY)$/i.test(mode);
    row.innerHTML = `<span>hotcache</span><b class="${hot ? 'ok' : /ERROR/i.test(mode) ? 'err' : 'wait'}">${mode} · ${entries}/5 · ${hits} hit · ${net} net${dedupe ? ` · ${dedupe} partagé${dedupe > 1 ? 's' : ''}` : ''}</b>`;
    row.title = `Cache temporaire des conversations · NiakGPT ${VERSION}`;
    return true;
  }

  function scheduleDiagnostic(delay=0){
    clearTimeout(diagTimer);
    diagTimer=setTimeout(patchDiagnostic,delay);
  }

  document.addEventListener('niakgpt:hotcache-status', event => {
    lastStatus = { ...lastStatus, ...(event.detail || {}) };
    patchDiagnostic();
  });

  document.addEventListener('niakgpt:activity-network', event => {
    if(event.detail?.phase==='request')markDirty(String(event.detail?.chatId||cidFromPath()));
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEY]) scheduleMeta(160);
  });

  document.addEventListener('click', event => {
    const target=event.target instanceof Element?event.target:null;
    const button = target?.closest('button');
    if (button) {
      const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`;
      if (/send|envoyer/i.test(label)) markDirty();
    }
    if(target?.closest('#ng8-rail [data-tab="diag"],#ng8-panel [data-tab="diag"]'))scheduleDiagnostic(80);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing && composerTarget(event.target)) markDirty();
    if(event.altKey&&String(event.key).toLowerCase()==='d')scheduleDiagnostic(80);
  }, true);

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleDiagnostic(100);});

  scheduleMeta(50);
  scheduleDiagnostic(600);
})();
