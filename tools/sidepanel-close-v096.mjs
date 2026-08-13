import fs from 'node:fs';
const p='side-panels-v096.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

const old=`    const head=panel.querySelector('header,[role="heading"]')?.closest('header,div')||panel.querySelector('header');if(head instanceof HTMLElement)head.classList.add('ng96-sidepanel-head');\n    if(type==='activity')panel.classList.add('ng8-native-activity');\n    let close=panel.querySelector(':scope > .ng96-side-close,:scope > .ng8-activity-close');\n    if(!close){close=document.createElement('button');close.type='button';close.className='ng96-side-close';close.setAttribute('aria-label',\`Fermer \${type==='activity'?'Activité':type==='sources'?'Sources':'Sorties'}\`);close.textContent='×';close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closePanel(panel);});panel.appendChild(close);}`;
const next=`    const head=panel.querySelector('header,[role="heading"]')?.closest('header,div')||panel.querySelector('header');if(head instanceof HTMLElement){head.classList.add('ng96-sidepanel-head');if(getComputedStyle(head).position==='static')head.style.position='relative';}\n    if(type==='activity')panel.classList.add('ng8-native-activity');\n    const closeHost=head instanceof HTMLElement?head:panel;\n    let close=closeHost.querySelector(':scope > .ng96-side-close,:scope > .ng8-activity-close')||panel.querySelector(':scope > .ng96-side-close,:scope > .ng8-activity-close');\n    if(close&&close.parentElement!==closeHost)closeHost.appendChild(close);\n    if(!close){close=document.createElement('button');close.type='button';close.className='ng96-side-close';close.setAttribute('aria-label',\`Fermer \${type==='activity'?'Activité':type==='sources'?'Sources':'Sorties'}\`);close.textContent='×';close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closePanel(panel);});closeHost.appendChild(close);}`;
if(s.includes(old))s=s.replace(old,next);
must(s.includes('const closeHost=head instanceof HTMLElement?head:panel;'),'sticky close host missing');
must(s.includes('if(close&&close.parentElement!==closeHost)closeHost.appendChild(close);'),'legacy close migration missing');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('sticky side-panel close'))c=c.replace("has(panels,'if(!relevant)return;arm();scheduleScan(80','Side-panel interaction scoping missing');","has(panels,'if(!relevant)return;arm();scheduleScan(80','Side-panel interaction scoping missing');\nhas(panels,'const closeHost=head instanceof HTMLElement?head:panel;','sticky side-panel close missing');");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 side-panel close anchored to sticky header');
