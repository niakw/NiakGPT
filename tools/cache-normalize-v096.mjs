import fs from 'node:fs';
// One-shot 0.9.6 cache-schema convergence; remove after final certification.
const must=(c,m)=>{if(!c)throw new Error(m);};

{
  const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
  const oldSerialize="  function serialize(){ return{at:Date.now(),projects:S.projects,chats:S.chats,counts:Object.fromEntries(S.counts),projectChats:Object.fromEntries([...S.projectChats].map(([k,m])=>[k,[...m.values()]]))}; }";
  const newSerialize="  function serialize(){ return{schema:2,at:Date.now(),projects:S.projects,chats:S.chats,counts:Object.fromEntries(S.counts),indexedProjectIds:[...S.projectChats.keys()]}; }";
  if(s.includes(oldSerialize))s=s.replace(oldSerialize,newSerialize);
  must(s.includes('indexedProjectIds:[...S.projectChats.keys()]'),'normalized cache serializer missing');

  const oldLoad=`        S.projects=[];S.projectById.clear();for(const p of raw.projects||[])upsertProject(p);\n        S.chats=[];S.chatById.clear();for(const c of raw.chats||[])upsertChat(c);\n        S.counts=new Map(Object.entries(raw.counts||{}));\n        S.projectChats.clear();for(const [pid,list] of Object.entries(raw.projectChats||{})){const m=new Map();for(const c of list||[]){m.set(c.id,c);upsertChat(c);}S.projectChats.set(pid,m);}`;
  const newLoad=`        S.projects=[];S.projectById.clear();for(const p of raw.projects||[])upsertProject(p);\n        S.chats=[];S.chatById.clear();for(const c of raw.chats||[])upsertChat(c);\n        const legacyProjectIds=Object.keys(raw.projectChats||{});\n        for(const [pid,list] of Object.entries(raw.projectChats||{}))for(const c of list||[])upsertChat({...c,projectId:c.projectId||pid});\n        S.counts=new Map(Object.entries(raw.counts||{}));\n        const indexed=new Set([...(Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]),...legacyProjectIds]);\n        S.projectChats.clear();for(const pid of indexed)S.projectChats.set(pid,new Map());\n        for(const c of S.chats){const m=S.projectChats.get(c.projectId);if(m)m.set(c.id,c);}`;
  if(s.includes(oldLoad))s=s.replace(oldLoad,newLoad);
  must(s.includes('const indexed=new Set(['),'normalized cache loader missing');
  fs.writeFileSync(p,s);
}

// Governance must update normalized caches without recreating projectChats duplication.
{
  const p='project-governance-v090.js';let s=fs.readFileSync(p,'utf8');
  const rx=/  function applyMoveToCache\(chatId,targetId\)\{[\s\S]*?\n  \}\n\n  function hiddenStyle/;
  if(!s.includes('Legacy cache compatibility only')){
    must(rx.test(s),'Governance cache move anchor missing');
    s=s.replace(rx,`  function applyMoveToCache(chatId,targetId){\n    const target=normalizePid(targetId),chat=(cache.chats||[]).find(c=>c.id===chatId),from=normalizePid(chat?.projectId||'');\n    if(chat)chat.projectId=target;\n    // Legacy cache compatibility only: update projectChats if an old schema is still loaded.\n    if(cache.projectChats&&typeof cache.projectChats==='object'){\n      let found=chat?{...chat}:null;\n      for(const [pid,list] of Object.entries(cache.projectChats)){const idx=(list||[]).findIndex(c=>c.id===chatId);if(idx>=0){found={...list[idx],projectId:target};list.splice(idx,1);}cache.counts??={};cache.counts[pid]=(list||[]).length;}\n      if(found&&target){cache.projectChats[target]??=[];const idx=cache.projectChats[target].findIndex(c=>c.id===chatId);if(idx>=0)cache.projectChats[target][idx]={...found,projectId:target};else cache.projectChats[target].push({...found,projectId:target});cache.counts[target]=cache.projectChats[target].length;}\n    }else{\n      cache.counts??={};\n      if(from&&Number.isFinite(Number(cache.counts[from])))cache.counts[from]=Math.max(0,Number(cache.counts[from])-1);\n      if(target&&target!==from&&Number.isFinite(Number(cache.counts[target])))cache.counts[target]=Number(cache.counts[target])+1;\n    }\n  }\n\n  function hiddenStyle`);
  }
  must(s.includes('Legacy cache compatibility only'),'Governance normalized cache compatibility missing');
  fs.writeFileSync(p,s);
}

const cp='tools/check-runtime.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('indexedProjectIds:[...S.projectChats.keys()]')){
  const marker="// Project pagination: never invent cursors.";
  must(c.includes(marker),'checker cache insertion anchor missing');
  c=c.replace(marker,`// Normalized index cache: chat metadata is serialized once.\nhas(texts['app-v090.js'],'indexedProjectIds:[...S.projectChats.keys()]');\nhas(texts['app-v090.js'],'const indexed=new Set([');\nno(texts['app-v090.js'],'projectChats:Object.fromEntries','Duplicate serialized Project chat metadata reintroduced');\nhas(texts['project-governance-v090.js'],'Legacy cache compatibility only');\n\n${marker}`);
}
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 cache schema normalized');
