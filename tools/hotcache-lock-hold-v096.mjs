import fs from 'node:fs';
// One-shot 0.9.6 helper; remove after final certification.
const p='hotcache-main-v084.js';
let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

if(!s.includes('function storeResponseAfterRender(')){
  const anchor=`  function scheduleStore(id, response) {\n    let clone;\n    try { clone = response.clone(); } catch { return; }\n    const run = () => storeResponse(id, clone);\n    if ('requestIdleCallback' in window) {\n      try { window.requestIdleCallback(run, { timeout:12000 }); return; } catch {}\n    }\n    setTimeout(run, 2500);\n  }`;
  must(s.includes(anchor),'scheduleStore anchor missing');
  s=s.replace(anchor,`${anchor}\n\n  function storeResponseAfterRender(id, clone) {\n    return new Promise(resolve => {\n      const run = async () => { try { await storeResponse(id, clone); } finally { resolve(); } };\n      if ('requestIdleCallback' in window) {\n        try { window.requestIdleCallback(run, { timeout:3000 }); return; } catch {}\n      }\n      setTimeout(run, 900);\n    });\n  }`);
}

const old=`  async function fetchWithCrossTabDedupe(self, input, init, id, staleEntry) {\n    if (!navigator.locks?.request) return networkAndCache(self, input, init, id);\n    try {\n      return await navigator.locks.request(\`niakgpt-hotfetch:\${id}\`, { mode:'exclusive' }, async () => {\n        const latest = await getEntry(id);\n        if (latest && latest.fetchedAt > (staleEntry?.fetchedAt || 0) && entryFresh(latest, id)) {\n          deduped++;\n          hits++;\n          setStatus('HIT_AFTER_LOCK', id);\n          return responseFromEntry(latest);\n        }\n        return networkAndCache(self, input, init, id);\n      });\n    } catch {\n      return networkAndCache(self, input, init, id);\n    }\n  }`;
const next=`  function fetchWithCrossTabDedupe(self, input, init, id, staleEntry) {\n    if (!navigator.locks?.request) return networkAndCache(self, input, init, id);\n    return new Promise((resolve, reject) => {\n      let exposed = false;\n      const expose = value => { if (!exposed) { exposed = true; resolve(value); } };\n      navigator.locks.request(\`niakgpt-hotfetch:\${id}\`, { mode:'exclusive' }, async () => {\n        const latest = await getEntry(id);\n        if (latest && latest.fetchedAt > (staleEntry?.fetchedAt || 0) && entryFresh(latest, id)) {\n          deduped++;\n          hits++;\n          setStatus('HIT_AFTER_LOCK', id);\n          expose(responseFromEntry(latest));\n          return;\n        }\n        network++;\n        setStatus('NETWORK', id);\n        let response;\n        try { response = await nativeFetch.call(self, input, init); }\n        catch (error) { if (!exposed) { exposed = true; reject(error); } return; }\n        let clone = null;\n        if (response.ok) { try { clone = response.clone(); } catch {} }\n        expose(response);\n        // The caller receives the real response immediately. The lock intentionally\n        // stays held until the cloned body is persisted, so the next tab cannot\n        // slip into a duplicate full GET between headers and IndexedDB commit.\n        if (clone) await storeResponseAfterRender(id, clone);\n      }).catch(error => {\n        if (exposed) return;\n        networkAndCache(self, input, init, id).then(expose, reject);\n      });\n    });\n  }`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes('The caller receives the real response immediately'),'lock-hold dedupe design missing');
must(s.includes('if (clone) await storeResponseAfterRender(id, clone);'),'lock not held through cache store');
fs.writeFileSync(p,s);

const cp='tools/check-runtime.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('storeResponseAfterRender')){
  const marker="has(texts['hotcache-main-v084.js'],\"navigator.locks.request(`niakgpt-hotfetch:${id}`, { mode:'exclusive' }\");";
  must(c.includes(marker),'hot-cache checker anchor missing');
  c=c.replace(marker,`${marker}\nhas(texts['hotcache-main-v084.js'],'storeResponseAfterRender');\nhas(texts['hotcache-main-v084.js'],'if (clone) await storeResponseAfterRender(id, clone);');`);
}
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 hot-cache lock remains held through cache persistence');
