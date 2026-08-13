import fs from 'node:fs';
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

s=s.replace("queueTimer:0, indexing:false, indexComplete:false, generalLoaded:false,","queueTimer:0, indexing:false, indexComplete:false, generalLoaded:false, cacheWriteTimer:0, cacheWritePromise:null, cacheDirty:false,");

const old="  async function saveCache(){ try{await chrome.storage.local.set({[CACHE_KEY]:serialize()});}catch{} }";
const next=`  async function saveCacheNow(){\n    clearTimeout(S.cacheWriteTimer);S.cacheWriteTimer=0;if(!S.cacheDirty&&S.cacheWritePromise)return S.cacheWritePromise;S.cacheDirty=false;const payload=serialize();\n    const write=chrome.storage.local.set({[CACHE_KEY]:payload}).catch(()=>{});S.cacheWritePromise=write;await write;if(S.cacheWritePromise===write)S.cacheWritePromise=null;\n  }\n  function saveCacheSoon(delay=1600){\n    S.cacheDirty=true;clearTimeout(S.cacheWriteTimer);S.cacheWriteTimer=setTimeout(()=>{S.cacheWriteTimer=0;if(activity()!=='ready'){saveCacheSoon(1800);return;}saveCacheNow();},delay);\n  }\n  async function saveCache(){S.cacheDirty=true;return saveCacheNow();}`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes('function saveCacheSoon(delay=1600)'),'cache batching primitive missing');

s=s.replace("health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);await saveCache();","health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);saveCacheSoon(1600);");
s=s.replace("S.counts.set(p.id,null);error(`project:${p.name}`,e);await saveCache();","S.counts.set(p.id,null);error(`project:${p.name}`,e);saveCacheSoon(500);");
must(s.includes("health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);saveCacheSoon(1600);"),'per-Project cache write still synchronous');

fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('cache write batching')){
  c=c.replace("// Project indexing must not redraw the full Project UI per Project.","// Project indexing batches full storage writes and never flushes them during activity.\nhas(app,'function saveCacheSoon(delay=1600)','cache write batching missing');\nhas(app,\"if(activity()!=='ready'){saveCacheSoon(1800);return;}\",'scheduled cache writes must yield to active generation');\nno(app,\"health('data',`INDEX IDLE · ${S.projects.length-S.queue.length}/${S.projects.length}`);await saveCache();\",'per-Project synchronous storage write reintroduced');\n\n// Project indexing must not redraw the full Project UI per Project.");
}
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 Project index cache writes batched');
