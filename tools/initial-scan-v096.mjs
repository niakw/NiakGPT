import fs from 'node:fs';
// One-shot 0.9.6 heavy-thread convergence; remove after final certification.
const p='app-v090.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

s=s.replace('mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0,','mainObserver:null, sidebarObserver:null, mainRoot:null, sidebarRoot:null, mainTimer:0, sidebarTimer:0, scanTimer:0, scanToken:0,');

const old=`  function scanExistingMain(){\n    const main=document.querySelector('main');if(!main)return;\n    for(const t of main.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]'))decorateTurn(t);\n    main.querySelectorAll('pre').forEach(decorateCode);\n  }`;
const next=`  function scanExistingMain(){\n    clearTimeout(S.scanTimer);const token=++S.scanToken,main=document.querySelector('main');if(!main)return;\n    S.scanTimer=setTimeout(()=>{\n      S.scanTimer=0;if(token!==S.scanToken||!main.isConnected)return;\n      const nodes=[...main.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]')];\n      if(nodes.length>=65)document.documentElement.dataset.ng8Heavy='1';\n      let index=0;\n      const chunk=()=>{\n        if(token!==S.scanToken||!main.isConnected)return;\n        if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}\n        const end=Math.min(index+20,nodes.length);for(;index<end;index++)decorateTurn(nodes[index]);\n        if(index<nodes.length)S.scanTimer=setTimeout(chunk,24);\n        else{S.scanTimer=0;health('performance',\`OK · \${S.turns.length}\${nodes.length>=65?' · LOURD':''}\`);}\n      };\n      chunk();\n    },180);\n  }`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes('const end=Math.min(index+20,nodes.length)'),'chunked initial turn scan missing');
must(!s.includes("main.querySelectorAll('pre').forEach(decorateCode)"),'duplicate full code scan remains');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('chunked initial conversation scan'))c=c.replace('// Project indexing batches full storage writes and never flushes them during activity.',"// Initial heavy-thread decoration must yield between small chunks.\nhas(app,'const end=Math.min(index+20,nodes.length)','chunked initial conversation scan missing');\nhas(app,\"if(activity()!=='ready'){S.scanTimer=setTimeout(chunk,700);return;}\",'initial scan must pause during activity');\nno(app,\"main.querySelectorAll('pre').forEach(decorateCode)\",'duplicate synchronous full code scan reintroduced');\n\n// Project indexing batches full storage writes and never flushes them during activity.");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 initial heavy-thread scan chunked');
