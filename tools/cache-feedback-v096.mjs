import fs from 'node:fs';
// One-shot 0.9.6 cache-feedback convergence; remove after final certification.
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};
s=s.replace('cacheWriteTimer:0, cacheWritePromise:null, cacheDirty:false,','cacheWriteTimer:0, cacheWritePromise:null, cacheDirty:false, lastCacheWriteAt:0,');
s=s.replace('S.cacheDirty=false;const payload=serialize();','S.cacheDirty=false;const payload=serialize();S.lastCacheWriteAt=payload.at||0;');
const old="if(changes[CACHE_KEY]&&!S.indexing){loadCache(changes[CACHE_KEY].newValue).then(()=>{decorateSidebar();if(S.panelOpen)renderPanel();});}";
const next="if(changes[CACHE_KEY]&&!S.indexing){const incoming=changes[CACHE_KEY].newValue;if(incoming?.at===S.lastCacheWriteAt)return;loadCache(incoming).then(()=>{decorateSidebar();if(S.panelOpen)renderPanel();});}";
if(s.includes(old))s=s.replace(old,next);must(s.includes('incoming?.at===S.lastCacheWriteAt'),'core cache write feedback guard missing');fs.writeFileSync(p,s);
const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');if(!c.includes('cache feedback guard'))c=c.replace('// Project indexing batches full storage writes and never flushes them during activity.',"// Core cache writes must notify consumers without causing the core to rebuild its own state.\nhas(app,'lastCacheWriteAt:0','cache feedback guard state missing');\nhas(app,'incoming?.at===S.lastCacheWriteAt','cache feedback guard missing');\n\n// Project indexing batches full storage writes and never flushes them during activity.");fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 core cache feedback loop removed');
