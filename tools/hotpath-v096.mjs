import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(cond,msg)=>{if(!cond)throw new Error(msg);};

{
  const p='project-governance-v090.js';let s=read(p);
  const old=`  document.addEventListener('click',event=>{\n    const unlock=event.target instanceof Element?event.target.closest('.ng85-manual-lock[data-unlock]'):null;if(unlock){event.preventDefault();event.stopPropagation();unlockChat(unlock.dataset.unlock);return;}\n    const repair=event.target instanceof Element?event.target.closest('[data-repair],[data-ng90-governance]'):null;if(repair){event.preventDefault();event.stopImmediatePropagation();openGovernance();return;}\n    setTimeout(()=>{bindSidebar();decorateLocks();patchExplorer();patchDiagnostic();},90);\n  },true);`;
  const next=`  document.addEventListener('click',event=>{\n    const target=event.target instanceof Element?event.target:null;\n    const unlock=target?.closest('.ng85-manual-lock[data-unlock]');if(unlock){event.preventDefault();event.stopPropagation();unlockChat(unlock.dataset.unlock);return;}\n    const repair=target?.closest('[data-repair],[data-ng90-governance]');if(repair){event.preventDefault();event.stopImmediatePropagation();openGovernance();return;}\n    if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control,#ng85-governance'))return;\n    setTimeout(()=>{bindSidebar();decorateLocks();patchExplorer();patchDiagnostic();},90);\n  },true);`;
  if(s.includes(old))s=s.replace(old,next);
  must(s.includes("if(!target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-panel,#ng8-rail,#ng90-control,#ng85-governance'))return;"),'Governance click scope missing');
  write(p,s);
}

{
  const p='chronology-v090.js';let s=read(p);
  const old="  document.addEventListener('click',()=>setTimeout(bindSidebar,80),true);";
  const next="  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-pins'))setTimeout(bindSidebar,80);},true);";
  if(s.includes(old))s=s.replace(old,next);
  must(s.includes("target?.closest('nav,[data-testid*=\"sidebar\" i],#ng8-pins')"),'Chronology click scope missing');
  write(p,s);
}

console.log('NiakGPT 0.9.6 hot-path click scopes applied');
