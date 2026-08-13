import fs from 'node:fs';
// One-shot 0.9.6 cache-bus convergence; remove after final certification.
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(c,m)=>{if(!c)throw new Error(m);};

{
  const p='tools/check-runtime.mjs';let s=read(p);
  s=s.replace("'control-center-v090.js','commands-v100.js'","'control-center-v090.js','cache-bus-v096.js','commands-v100.js'");
  if(!s.includes("const cacheBusText=read('cache-bus-v096.js')")){
    const marker='// Core / performance invariants.';must(s.includes(marker),'checker bus marker missing');
    s=s.replace(marker,`// Shared cache bus: one chrome.storage read of the large index per tab.\nconst cacheBusText=read('cache-bus-v096.js');\nhas(cacheBusText,"chrome.storage.local.get(KEY)");\nhas(cacheBusText,'__NIAKGPT_CACHE_BUS__');\nhas(cacheBusText,'subscribe(fn)');\nfor(const file of ['app-v090.js','chronology-v090.js','pin-folders-v096.js','hotcache-v084.js','project-governance-v090.js','multitab-v090.js'])has(texts[file],'__NIAKGPT_CACHE_BUS__',\`Cache bus missing from \${file}\`);\nfor(const file of ['chronology-v090.js','pin-folders-v096.js','hotcache-v084.js','project-governance-v090.js','multitab-v090.js'])no(texts[file],'chrome.storage.local.get(CACHE_KEY)',\`Direct large cache read reintroduced in \${file}\`);\n\n${marker}`);
  }
  write(p,s);
}

{
  const p='app-v090.js';let s=read(p);
  s=s.replace('  async function loadCache(){\n    try{\n      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];',`  async function loadCache(rawOverride){\n    try{\n      const bus=window.__NIAKGPT_CACHE_BUS__;\n      const raw=rawOverride!==undefined?rawOverride:(bus?await bus.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]);`);
  s=s.replace("if(changes[CACHE_KEY]&&!S.indexing){loadCache().then(()=>{renderPins();decorateSidebar();renderPanel();});}","if(changes[CACHE_KEY]&&!S.indexing){loadCache(changes[CACHE_KEY].newValue).then(()=>{decorateSidebar();if(S.panelOpen)renderPanel();});}");
  must(s.includes('window.__NIAKGPT_CACHE_BUS__'),'app cache bus missing');
  write(p,s);
}

{
  const p='chronology-v090.js';let s=read(p);
  s=s.replace('  async function readCache(){\n    try{\n      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};chats=new Map();counts=new Map(Object.entries(raw.counts||{}));latestByProject=new Map();',`  async function readCache(rawOverride){\n    try{\n      const bus=window.__NIAKGPT_CACHE_BUS__,raw=rawOverride!==undefined?(rawOverride||{}):(bus?(await bus.get()||{}):{});chats=new Map();counts=new Map(Object.entries(raw.counts||{}));latestByProject=new Map();`);
  s=s.replace("  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])readCache();});",`  const cacheBus=window.__NIAKGPT_CACHE_BUS__;\n  if(cacheBus)cacheBus.subscribe(raw=>readCache(raw));else chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])readCache(changes[CACHE_KEY].newValue);});`);
  s=s.replace('  readCache();bindSidebar();','  if(!cacheBus)readCache({});bindSidebar();');
  must(s.includes('__NIAKGPT_CACHE_BUS__'),'chronology cache bus missing');must(!s.includes('chrome.storage.local.get(CACHE_KEY)'),'chronology direct cache read remains');write(p,s);
}

{
  const p='pin-folders-v096.js';let s=read(p);
  if(!s.includes('function projectSnapshotSignature(')){
    const marker='  function setOpen(pid){';must(s.includes(marker),'pin folder signature marker missing');
    s=s.replace(marker,`  function projectSnapshotSignature(raw,pid){\n    if(!pid)return'';const chats=(raw?.chats||[]).filter(c=>c?.projectId===pid).map(c=>[c.id,c.updated||c.update_time||0,c.title||'']);return JSON.stringify([raw?.counts?.[pid]??null,chats]);\n  }\n  function acceptCache(next){\n    const before=projectSnapshotSignature(cache,openPid);cache=next&&typeof next==='object'?next:cache;const after=projectSnapshotSignature(cache,openPid);if(!observedBox)bindBox();if(openPid&&before!==after)schedule(40);else if(!openPid)schedule(80);\n  }\n${marker}`);
  }
  const tail=`  async function loadCache(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||cache;}catch{}schedule(0);}\n\n  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY]){cache=changes[CACHE_KEY].newValue||cache;schedule(40);}});`;
  const replacement=`  const cacheBus=window.__NIAKGPT_CACHE_BUS__;\n  if(cacheBus)cacheBus.subscribe(acceptCache);else chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])acceptCache(changes[CACHE_KEY].newValue);});`;
  if(s.includes(tail))s=s.replace(tail,replacement);
  s=s.replace('  loadCache();bootstrap();','  bootstrap();');
  must(s.includes('__NIAKGPT_CACHE_BUS__'),'pin folder cache bus missing');must(!s.includes('chrome.storage.local.get(CACHE_KEY)'),'pin folder direct cache read remains');write(p,s);
}

{
  const p='hotcache-v084.js';let s=read(p);
  if(!s.includes('let pendingCache = null;'))s=s.replace('  let syncTimer = 0;','  let syncTimer = 0;\n  let pendingCache = null;');
  s=s.replace('  async function syncMeta() {\n    clearTimeout(syncTimer);\n    syncTimer = 0;\n    try {\n      const raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};',`  async function syncMeta(rawOverride) {\n    clearTimeout(syncTimer);syncTimer=0;\n    try {const raw=rawOverride&&typeof rawOverride==='object'?rawOverride:{};`);
  s=s.replace('  function scheduleMeta(delay = 300) {\n    clearTimeout(syncTimer);\n    syncTimer = setTimeout(syncMeta, delay);\n  }',`  function scheduleMeta(raw,delay = 300) {if(raw&&typeof raw==='object')pendingCache=raw;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{const next=pendingCache;pendingCache=null;syncMeta(next);},delay);}`);
  s=s.replace("  chrome.storage.onChanged.addListener((changes, area) => {\n    if (area === 'local' && changes[CACHE_KEY]) scheduleMeta(160);\n  });",`  const cacheBus=window.__NIAKGPT_CACHE_BUS__;\n  if(cacheBus)cacheBus.subscribe(raw=>scheduleMeta(raw,160));else chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])scheduleMeta(changes[CACHE_KEY].newValue,160);});`);
  s=s.replace('  scheduleMeta(50);','  if(!cacheBus)scheduleMeta({},50);');
  must(s.includes('__NIAKGPT_CACHE_BUS__'),'hotcache metadata cache bus missing');must(!s.includes('chrome.storage.local.get(CACHE_KEY)'),'hotcache isolated direct cache read remains');write(p,s);
}

{
  const p='project-governance-v090.js';let s=read(p);
  const old="  async function loadCache(){try{cache=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{projects:[],chats:[],counts:{},projectChats:{}};}catch{cache={projects:[],chats:[],counts:{},projectChats:{}};}return cache;}";
  const next=`  function cloneCache(raw){const fallback={schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[]};if(!raw||typeof raw!=='object')return fallback;try{return structuredClone(raw);}catch{try{return JSON.parse(JSON.stringify(raw));}catch{return fallback;}}}\n  async function loadCache(){try{const bus=window.__NIAKGPT_CACHE_BUS__,raw=bus?await bus.get():null;cache=cloneCache(raw);return cache;}catch{cache={schema:2,projects:[],chats:[],counts:{},indexedProjectIds:[]};return cache;}}`;
  if(s.includes(old))s=s.replace(old,next);
  s=s.replace("if(from&&Number.isFinite(Number(cache.counts[from])))cache.counts[from]=Math.max(0,Number(cache.counts[from])-1);","if(from&&cache.counts[from]!=null&&Number.isFinite(Number(cache.counts[from])))cache.counts[from]=Math.max(0,Number(cache.counts[from])-1);");
  s=s.replace("if(target&&target!==from&&Number.isFinite(Number(cache.counts[target])))cache.counts[target]=Number(cache.counts[target])+1;","if(target&&target!==from&&cache.counts[target]!=null&&Number.isFinite(Number(cache.counts[target])))cache.counts[target]=Number(cache.counts[target])+1;");
  must(s.includes('__NIAKGPT_CACHE_BUS__'),'Governance cache bus missing');must(!s.includes('chrome.storage.local.get(CACHE_KEY)'),'Governance direct cache read remains');must(s.includes('cache.counts[from]!=null'),'Governance unknown source count can be corrupted');write(p,s);
}

{
  const p='multitab-v090.js';let s=read(p);
  s=s.replace("    let raw={};try{raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{}","    let raw={};try{raw=(await window.__NIAKGPT_CACHE_BUS__?.get())||{};}catch{}");
  must(s.includes('__NIAKGPT_CACHE_BUS__'),'CLIENT Quick Open cache bus missing');must(!s.includes('chrome.storage.local.get(CACHE_KEY)'),'CLIENT Quick Open direct cache read remains');write(p,s);
}

console.log('NiakGPT 0.9.6 cache consumers converged on one shared read');
