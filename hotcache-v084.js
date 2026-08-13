(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_HOTCACHE_084__) return;
  window.__NIAKGPT_HOTCACHE_084__ = true;

  const VERSION = '0.8.4';
  const CACHE_KEY = 'niakgpt-v08-cache';
  const META_KEY = 'niakgpt-hotmeta-v084';
  const DIRTY_KEY = 'niakgpt-hotdirty-v084';
  let lastStatus = { mode:'READY', hits:0, misses:0, network:0, deduped:0, entries:0 };
  let lastGenerating = false;
  let syncTimer = 0;

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

  function isGenerating() {
    return [...document.querySelectorAll('button,[data-testid]')]
      .filter(el => el instanceof HTMLElement && el.getBoundingClientRect().width > 0)
      .some(el => /stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`));
  }

  function composerTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
  }

  function patchVersion() {
    const cell = document.querySelector('#ng8-status > span:first-child');
    if (!cell) return;
    const nodes = [...cell.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
    for (const node of nodes) {
      if (/\b0\.8\.\d+\b/.test(node.nodeValue || '')) node.nodeValue = (node.nodeValue || '').replace(/\b0\.8\.\d+\b/g, VERSION);
    }
    cell.dataset.ng8RuntimeVersion = VERSION;
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
    setTimeout(() => document.documentElement.removeAttribute('data-ng8-hotdirty-id'), 1000);
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
    patchVersion();
    const diag = document.querySelector('#ng8-panel .ng8-diag');
    if (!diag) return;
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
    const hot = /^(HIT|HIT_PEER|HIT_AFTER_LOCK|STORED|READY)$/i.test(mode);
    row.innerHTML = `<span>hotcache</span><b class="${hot ? 'ok' : /ERROR/i.test(mode) ? 'err' : 'wait'}">${mode} · ${entries}/5 · ${hits} hit · ${net} net${dedupe ? ` · ${dedupe} partagé${dedupe > 1 ? 's' : ''}` : ''}</b>`;
    row.title = `Cache temporaire des conversations · NiakGPT ${VERSION}`;
  }

  document.addEventListener('niakgpt:hotcache-status', event => {
    lastStatus = { ...lastStatus, ...(event.detail || {}) };
    patchDiagnostic();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEY]) scheduleMeta(160);
  });

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`;
    if (/send|envoyer/i.test(label)) markDirty();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (composerTarget(event.target)) markDirty();
  }, true);

  setInterval(() => {
    const generating = isGenerating();
    if (generating && !lastGenerating) markDirty();
    lastGenerating = generating;
    patchDiagnostic();
  }, 1200);

  scheduleMeta(50);
  setTimeout(patchDiagnostic, 600);
})();
