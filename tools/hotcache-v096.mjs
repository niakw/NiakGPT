import fs from 'node:fs';
const p='hotcache-main-v084.js';
let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

// Synchronous localStorage parses are replaced by in-memory mirrors kept in sync.
const storageOld=`  function readMeta() { return parseJSON(localStorage.getItem(META_KEY), {}); }\n  function readDirty() { return parseJSON(localStorage.getItem(DIRTY_KEY), {}); }\n  function writeDirty(value) { try { localStorage.setItem(DIRTY_KEY, JSON.stringify(value)); } catch {} }\n  function readIndex() {\n    const list = parseJSON(localStorage.getItem(INDEX_KEY), []);\n    return Array.isArray(list) ? list : [];\n  }\n  function writeIndex(list) { try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); } catch {} }`;
const storageNew=`  let metaMirror = parseJSON(localStorage.getItem(META_KEY), {});\n  let dirtyMirror = parseJSON(localStorage.getItem(DIRTY_KEY), {});\n  let indexMirror = parseJSON(localStorage.getItem(INDEX_KEY), []);\n  if (!metaMirror || typeof metaMirror !== 'object' || Array.isArray(metaMirror)) metaMirror = {};\n  if (!dirtyMirror || typeof dirtyMirror !== 'object' || Array.isArray(dirtyMirror)) dirtyMirror = {};\n  if (!Array.isArray(indexMirror)) indexMirror = [];\n  function readMeta() { return metaMirror; }\n  function readDirty() { return dirtyMirror; }\n  function writeDirty(value) { dirtyMirror = value && typeof value === 'object' ? value : {}; try { localStorage.setItem(DIRTY_KEY, JSON.stringify(dirtyMirror)); } catch {} }\n  function readIndex() { return indexMirror; }\n  function writeIndex(list) { indexMirror = Array.isArray(list) ? list : []; try { localStorage.setItem(INDEX_KEY, JSON.stringify(indexMirror)); } catch {} }`;
if(s.includes(storageOld))s=s.replace(storageOld,storageNew);
must(s.includes('let metaMirror = parseJSON'),'hot-cache metadata mirror missing');

// navigator.locks queues contenders instead of timing out and duplicating a heavy GET.
s=s.replace("  const WAIT_OTHER_TAB_MS = 9000;\n",'');
s=s.replace("  const waiters = new Map();\n",'');
const waitRx=/\n  function waitForPeer\(id, afterFetchedAt = 0\) \{[\s\S]*?\n  \}\n\n  bc\?\.addEventListener\('message', event => \{[\s\S]*?\n  \}\);/;
if(waitRx.test(s))s=s.replace(waitRx,`\n  bc?.addEventListener('message', event => {\n    const m = event.data;\n    if (!m?.id) return;\n    if (m.type === 'invalidate') memory.delete(m.id);\n  });`);

const dedupeRx=/  async function fetchWithCrossTabDedupe\(self, input, init, id, staleEntry\) \{[\s\S]*?\n  \}\n\n  window\.fetch = async function niakgptHotCachedFetch/;
must(dedupeRx.test(s),'hot-cache dedupe function anchor missing');
s=s.replace(dedupeRx,`  async function fetchWithCrossTabDedupe(self, input, init, id, staleEntry) {\n    if (!navigator.locks?.request) return networkAndCache(self, input, init, id);\n    try {\n      return await navigator.locks.request(\`niakgpt-hotfetch:\${id}\`, { mode:'exclusive' }, async () => {\n        const latest = await getEntry(id);\n        if (latest && latest.fetchedAt > (staleEntry?.fetchedAt || 0) && entryFresh(latest, id)) {\n          deduped++;\n          hits++;\n          setStatus('HIT_AFTER_LOCK', id);\n          return responseFromEntry(latest);\n        }\n        return networkAndCache(self, input, init, id);\n      });\n    } catch {\n      return networkAndCache(self, input, init, id);\n    }\n  }\n\n  window.fetch = async function niakgptHotCachedFetch`);

// Same-tab isolated-world metadata sync + cross-tab storage sync.
const storageEventRx=/  window\.addEventListener\('storage', event => \{[\s\S]*?\n  \}\);/;
must(storageEventRx.test(s),'storage event anchor missing');
s=s.replace(storageEventRx,`  document.addEventListener('niakgpt:hotmeta-updated', () => {\n    const next = parseJSON(localStorage.getItem(META_KEY), {});\n    metaMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};\n  });\n\n  window.addEventListener('storage', event => {\n    if (event.key === META_KEY) {\n      const next = parseJSON(event.newValue, {});\n      metaMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};\n    }\n    if (event.key === DIRTY_KEY) {\n      const next = parseJSON(event.newValue, {});\n      dirtyMirror = next && typeof next === 'object' && !Array.isArray(next) ? next : {};\n      for (const id of Object.keys(dirtyMirror)) memory.delete(id);\n    }\n    if (event.key === INDEX_KEY) {\n      const next = parseJSON(event.newValue, []);\n      if (Array.isArray(next)) indexMirror = next;\n    }\n  });`);

must(!s.includes('WAIT_OTHER_TAB_MS'),'old peer timeout still present');
must(!s.includes('waitForPeer('),'old peer waiter still present');
must(!s.includes('ifAvailable:true'),'hot-fetch lock still non-queued');
must(s.includes("navigator.locks.request(`niakgpt-hotfetch:${id}`, { mode:'exclusive' }"),'queued hot-fetch lock missing');
fs.writeFileSync(p,s);
console.log('NiakGPT 0.9.6 hot cache memory + queued lock converged');
