import fs from 'node:fs';
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

s=s.replace('mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0,','mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, sidebarNeedsPins:false,');
s=s.replace('  function decorateSidebar(){','  function decorateSidebar(renderManaged=true){');
s=s.replace('    renderPins();\n  }\n  function currentProject(){','    if(renderManaged)renderPins();\n  }\n  function currentProject(){');

const old=`if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(()=>{if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;decorateSidebar();},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}`;
const next=`if(side&&side!==S.sidebarRoot){S.sidebarObserver?.disconnect();S.sidebarRoot=side;S.sidebarObserver=new MutationObserver(records=>{let relevant=false,projectTouched=false;for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const hasProject=node.matches?.(PROJECT_SEL)||node.querySelector?.(PROJECT_SEL);const hasChat=node.matches?.(CHAT_SEL)||node.querySelector?.(CHAT_SEL);if(hasProject){relevant=true;projectTouched=true;}else if(hasChat)relevant=true;}if(!relevant)return;S.sidebarNeedsPins=S.sidebarNeedsPins||projectTouched;if(S.sidebarTimer)return;S.sidebarTimer=setTimeout(()=>{S.sidebarTimer=0;const pins=S.sidebarNeedsPins;S.sidebarNeedsPins=false;decorateSidebar(pins);},activity()==='ready'?260:1300);});S.sidebarObserver.observe(side,{childList:true,subtree:true});}`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes('function decorateSidebar(renderManaged=true)'),'sidebar render flag missing');
must(s.includes('if(!relevant)return;S.sidebarNeedsPins'),'sidebar mutation relevance guard missing');
must(s.includes('decorateSidebar(pins);'),'sidebar pin rerender scope missing');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('sidebar mutation relevance'))c=c.replace('// Project indexing batches full storage writes and never flushes them during activity.',"// Sidebar mutations must ignore unrelated native DOM and avoid rebuilding managed Projects for chat-only additions.\nhas(app,'function decorateSidebar(renderManaged=true)','sidebar managed-render flag missing');\nhas(app,'if(!relevant)return;S.sidebarNeedsPins','sidebar mutation relevance guard missing');\nhas(app,'decorateSidebar(pins);','sidebar Project rerender scope missing');\n\n// Project indexing batches full storage writes and never flushes them during activity.");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 sidebar mutation hot path scoped');
