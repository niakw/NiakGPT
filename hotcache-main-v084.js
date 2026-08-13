(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_HOTCACHE_MAIN_084__) return;
  window.__NIAKGPT_HOTCACHE_MAIN_084__ = true;

  const VERSION = '0.8.4';
  const DB_NAME = 'niakgpt-hotcache-v084';
  const DB_VERSION = 1;
  const STORE = 'conversations';
  const META_KEY = 'niakgpt-hotmeta-v084';
  const DIRTY_KEY = 'niakgpt-hotdirty-v084';
  const INDEX_KEY = 'niakgpt-hotindex-v084';
  const CHANNEL = 'niakgpt-hotcache-v084';
  const MAX_ENTRIES = 5;
  const MAX_TOTAL_BYTES = 96 * 1024 * 1024;
  const MAX_ENTRY_BYTES = 40 * 1024 * 1024;
  const MAX_MEMORY_ENTRIES = 2;
  const MAX_MEMORY_BYTES = 48 * 1024 * 1024;
  const UNKNOWN_META_TTL = 2 * 60 * 1000;
  const KNOWN_META_TTL = 15 * 60 * 1000;
  const HARD_TTL = 6 * 60 * 60 * 1000;

  const nativeFetch = window.fetch.bind(window);
  const memory = new Map();
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  let dbPromise = null;
  let hits = 0;
  let misses = 0;
  let network = 0;
  let deduped = 0;
  let writes = 0;

  function setStatus(mode, id = '') {
    const root = document.documentElement;
    root.dataset.ng8Hotcache = mode;
    root.dataset.ng8HotcacheId = id ? id.slice(0, 8) : '';
    root.dataset.ng8HotcacheHits = String(hits);
    root.dataset.ng8HotcacheMisses = String(misses);
    root.dataset.ng8HotcacheNetwork = String(network);
    root.dataset.ng8HotcacheDeduped = String(deduped);
    root.dataset.ng8HotcacheEntries = String(readIndex().length);
    document.dispatchEvent(new CustomEvent('niakgpt:hotcache-status', { detail:{ mode,id,hits,misses,network,deduped,writes,entries:readIndex().length,version:VERSION } }));
  }

  function parseJSON(raw, fallback) {
    try { return JSON.parse(raw || '') ?? fallback; } catch { return fallback; }
  }

  let metaMirror = parseJSON(localStorage.getItem(META_KEY), {});
  let dirtyMirror = parseJSON(localStorage.getItem(DIRTY_KEY), {});
  let indexMirror = parseJSON(localStorage.getItem(INDEX_KEY), []);
  if (!metaMirror || typeof metaMirror !== 'object' || Array.isArray(metaMirror)) metaMirror = {};
  if (!dirtyMirror || typeof dirtyMirror !== 'object' || Array.isArray(dirtyMirror)) dirtyMirror = {};
  if (!Array.isArray(indexMirror)) indexMirror = [];
  function readMeta() { return metaMirror; }
  function readDirty() { return dirtyMirror; }
  function writeDirty(value) { dirtyMirror = value && typeof value === 'object' ? value : {}; try { localStorage.setItem(DIRTY_KEY, JSON.stringify(dirtyMirror)); } catch {} }
  function readIndex() { return indexMirror; }
  function writeIndex(list) { indexMirror = Array.isArray(list) ? list : []; try { localStorage.setItem(INDEX_KEY, JSON.stringify(indexMirror)); } catch {} }

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

  function getConversationId(url) {
    try {
      const u = new URL(url, location.origin);
      if (u.origin !== location.origin) return '';
      return u.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i)?.[1] || '';
    } catch { return ''; }
  }

  function requestInfo(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    return { url, method, id:getConversationId(url) };
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath:'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('indexeddb_open_failed'));
    }).catch(error => {
      console.warn('[NiakGPT hotcache] IndexedDB unavailable', error);
      dbPromise = null;
      return null;
    });
    return dbPromise;
  }

  async function idbGet(id) {
    const db = await openDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async function idbPut(entry) {
    const db = await openDB();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  }

  async function idbDelete(id) {
    const db = await openDB();
    if (!db) return;
    await new Promise(resolve => {
      try {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
        req.onsuccess = req.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  function touchMemory(entry) {
    memory.delete(entry.id);
    memory.set(entry.id, entry);
    let total = [...memory.values()].reduce((sum,item) => sum + (Number(item?.bytes) || 0), 0);
    while (memory.size > MAX_MEMORY_ENTRIES || total > MAX_MEMORY_BYTES) {
      const oldestId = memory.keys().next().value;
      if (!oldestId) break;
      const oldest = memory.get(oldestId);
      total -= Number(oldest?.bytes) || 0;
      memory.delete(oldestId);
    }
  }

  function touchIndex(entry) {
    let list = readIndex().filter(x => x?.id && x.id !== entry.id);
    list.push({ id:entry.id, fetchedAt:entry.fetchedAt, bytes:entry.bytes || 0, updateTime:entry.updateTime || 0 });
    list.sort((a,b) => (a.fetchedAt || 0) - (b.fetchedAt || 0));
    writeIndex(list);
    return list;
  }

  async function evictIfNeeded() {
    let list = readIndex().filter(x => x?.id);
    const now = Date.now();
    for (const item of [...list]) {
      if (!item.fetchedAt || now - item.fetchedAt > HARD_TTL) {
        list = list.filter(x => x.id !== item.id);
        memory.delete(item.id);
        await idbDelete(item.id);
      }
    }
    let total = list.reduce((n,x) => n + (Number(x.bytes) || 0), 0);
    while (list.length > MAX_ENTRIES || total > MAX_TOTAL_BYTES) {
      const oldest = list.shift();
      if (!oldest) break;
      total -= Number(oldest.bytes) || 0;
      memory.delete(oldest.id);
      await idbDelete(oldest.id);
    }
    writeIndex(list);
    setStatus(document.documentElement.dataset.ng8Hotcache || 'READY');
  }

  async function getEntry(id, forceDisk = false) {
    if (!forceDisk) {
      const mem = memory.get(id);
      if (mem) {
        touchMemory(mem);
        return mem;
      }
    }
    const entry = await idbGet(id);
    if (entry) touchMemory(entry);
    return entry;
  }

  function latestKnownUpdate(id) {
    const meta = readMeta();
    return parseTime(meta?.[id]?.updated || meta?.[id] || 0);
  }

  function isDirty(id) {
    const dirty = readDirty();
    return !!dirty[id];
  }

  function clearDirty(id) {
    const dirty = readDirty();
    if (!dirty[id]) return;
    delete dirty[id];
    writeDirty(dirty);
  }

  function entryFresh(entry, id) {
    if (!entry?.body || !entry.fetchedAt) return false;
    const age = Date.now() - entry.fetchedAt;
    if (age < 0 || age > HARD_TTL || isDirty(id)) return false;
    const latest = latestKnownUpdate(id);
    if (latest && entry.updateTime) return latest <= entry.updateTime && age <= KNOWN_META_TTL;
    if (latest && !entry.updateTime) return false;
    return age <= UNKNOWN_META_TTL;
  }

  function headersFrom(responseOrArray) {
    const h = new Headers(Array.isArray(responseOrArray) ? responseOrArray : responseOrArray?.headers || undefined);
    h.set('content-type', 'application/json; charset=utf-8');
    h.delete('content-length');
    h.delete('content-encoding');
    return h;
  }

  function responseFromEntry(entry) {
    const res = new Response(entry.body, {
      status: entry.status || 200,
      statusText: entry.statusText || 'OK',
      headers: headersFrom(entry.headers || [])
    });
    try { Object.defineProperty(res, 'url', { value:entry.url || `${location.origin}/backend-api/conversation/${entry.id}` }); } catch {}
    return res;
  }

  function extractResponseMeta(text) {
    let updateTime = 0;
    let currentNode = '';
    try {
      // Top-level metadata is normally outside the huge mapping. Limit scanning so a
      // multi-megabyte conversation is not regex-walked a second time after download.
      const head = text.slice(0, 65536);
      const tail = text.length > 65536 ? text.slice(-65536) : head;
      const timeMatch = head.match(/\"update_time\"\s*:\s*(\"[^\"]+\"|\d+(?:\.\d+)?)/);
      if (timeMatch) updateTime = parseTime(String(timeMatch[1] || '').replace(/^\"|\"$/g, ''));
      const nodeMatch = tail.match(/\"current_node\"\s*:\s*\"([^\"]+)\"/) || head.match(/\"current_node\"\s*:\s*\"([^\"]+)\"/);
      if (nodeMatch) currentNode = nodeMatch[1];
    } catch {}
    return { updateTime, currentNode };
  }

  async function storeResponse(id, response) {
    try {
      const text = await response.text();
      const bytes = new Blob([text]).size;
      if (!text || bytes > MAX_ENTRY_BYTES) {
        setStatus('TOO_LARGE', id);
        return;
      }
      const parsed = extractResponseMeta(text);
      const known = latestKnownUpdate(id);
      const entry = {
        id,
        body:text,
        bytes,
        fetchedAt:Date.now(),
        updateTime:Math.max(parsed.updateTime || 0, known || 0) || Date.now(),
        currentNode:parsed.currentNode || '',
        status:response.status,
        statusText:response.statusText,
        headers:[...response.headers.entries()],
        url:response.url || `${location.origin}/backend-api/conversation/${id}`
      };
      touchMemory(entry);
      touchIndex(entry);
      if (await idbPut(entry)) {
        writes++;
        clearDirty(id);
        bc?.postMessage({ type:'updated', id, fetchedAt:entry.fetchedAt, updateTime:entry.updateTime, currentNode:entry.currentNode });
        setStatus('STORED', id);
        await evictIfNeeded();
      }
    } catch (error) {
      console.warn('[NiakGPT hotcache] store failed', error);
      setStatus('STORE_ERROR', id);
    }
  }

  function scheduleStore(id, response) {
    let clone;
    try { clone = response.clone(); } catch { return; }
    const run = () => storeResponse(id, clone);
    if ('requestIdleCallback' in window) {
      try { window.requestIdleCallback(run, { timeout:12000 }); return; } catch {}
    }
    setTimeout(run, 2500);
  }

  function storeResponseAfterRender(id, clone) {
    return new Promise(resolve => {
      const run = async () => { try { await storeResponse(id, clone); } finally { resolve(); } };
      if ('requestIdleCallback' in window) {
        try { window.requestIdleCallback(run, { timeout:3000 }); return; } catch {}
      }
      setTimeout(run, 900);
    });
  }

  bc?.addEventListener('message', event => {
    const m = event.data;
    if (!m?.id) return;
    if (m.type === 'invalidate' || m.type === 'updated') memory.delete(m.id);
  });

  async function networkAndCache(self, input, init, id) {
    network++;
    setStatus('NETWORK', id);
    const response = await nativeFetch.call(self, input, init);
    if (response.ok) scheduleStore(id, response);
    return response;
  }

  function fetchWithCrossTabDedupe(self, input, init, id, staleEntry) {
    if (!navigator.locks?.request) return networkAndCache(self, input, init, id);
    return new Promise((resolve, reject) => {
      let exposed = false;
      const expose = value => { if (!exposed) { exposed = true; resolve(value); } };
      navigator.locks.request(`niakgpt-hotfetch:${id}`, { mode:'exclusive' }, async () => {
        // Force a disk read after acquiring the lock. Another tab may have persisted a
        // fresher copy while this tab was waiting, even if this tab had a stale RAM entry.
        const latest = await getEntry(id, true);
        if (latest && latest.fetchedAt > (staleEntry?.fetchedAt || 0) && entryFresh(latest, id)) {
          deduped++;
          hits++;
          setStatus('HIT_AFTER_LOCK', id);
          expose(responseFromEntry(latest));
          return;
        }
        network++;
        setStatus('NETWORK', id);
        let response;
        try { response = await nativeFetch.call(self, input, init); }
        catch (error) { if (!exposed) { exposed = true; reject(error); } return; }
        let clone = null;
        if (response.ok) { try { clone = response.clone(); } catch {} }
        expose(response);
        // The caller receives the real response immediately. The lock intentionally
        // stays held until the cloned body is persisted, so the next tab cannot
        // slip into a duplicate full GET between headers and IndexedDB commit.
        if (clone) await storeResponseAfterRender(id, clone);
      }).catch(error => {
        if (exposed) return;
        networkAndCache(self, input, init, id).then(expose, reject);
      });
    });
  }

  window.fetch = async function niakgptHotCachedFetch(input, init) {
    const info = requestInfo(input, init);
    if (info.method !== 'GET' || !info.id) return nativeFetch.call(this, input, init);

    const cached = await getEntry(info.id);
    if (cached && entryFresh(cached, info.id)) {
      hits++;
      setStatus('HIT', info.id);
      return responseFromEntry(cached);
    }

    misses++;
    setStatus(cached ? 'STALE' : 'MISS', info.id);
    return fetchWithCrossTabDedupe(this, input, init, info.id, cached);
  };

  document.addEventListener('niakgpt:hotcache-dirty', event => {
    const id = String(event.detail?.id || document.documentElement.getAttribute('data-ng8-hotdirty-id') || '');
    if (!id) return;
    const dirty = readDirty();
    dirty[id] = Date.now();
    writeDirty(dirty);
    memory.delete(id);
    bc?.postMessage({ type:'invalidate', id });
    setStatus('DIRTY', id);
  });

  document.addEventListener('niakgpt:hotmeta-updated', () => {
    const next = parseJSON(localStorage.getItem(META_KEY), {});
    metaMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
  });

  window.addEventListener('storage', event => {
    if (event.key === META_KEY) {
      const next = parseJSON(event.newValue, {});
      metaMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
    }
    if (event.key === DIRTY_KEY) {
      const next = parseJSON(event.newValue, {});
      dirtyMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
      for (const id of Object.keys(dirtyMirror)) memory.delete(id);
    }
    if (event.key === INDEX_KEY) {
      const next = parseJSON(event.newValue, []);
      if (Array.isArray(next)) indexMirror = next;
    }
  });

  setTimeout(evictIfNeeded, 1800);
  setStatus('READY');
})();
