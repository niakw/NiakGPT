import fs from 'node:fs';
// One-shot 0.9.6 helper; remove after the final certified build.
const p='multitab-v090.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace("  const nativeRAF=window.requestAnimationFrame.bind(window);\n  const nativeCAF=window.cancelAnimationFrame.bind(window);\n",'');
s=s.replace("  let taskSeq=0,activeIdle=false,virtualRafSeq=2000000,safeMode=false;","  let taskSeq=0,activeIdle=false,safeMode=false;");
s=s.replace("  const idleTasks=new Map(),rafTasks=new Map(),peers=new Map();","  const idleTasks=new Map(),peers=new Map();");
const rx=/\n  window\.requestAnimationFrame=function niakgptCoordinatedRAF\(cb\)\{[\s\S]*?\n  window\.cancelAnimationFrame=function niakgptCancelCoordinatedRAF\(id\)\{[^\n]*\};\n/;
if(rx.test(s))s=s.replace(rx,'\n');
if(s.includes('window.requestAnimationFrame=function niakgptCoordinatedRAF'))throw new Error('NiakGPT RAF override still present');
if(s.includes('rafTasks'))throw new Error('RAF task registry still present');
if(s.includes('virtualRafSeq'))throw new Error('RAF virtual sequence still present');
fs.writeFileSync(p,s);
console.log('NiakGPT 0.9.6 UI RAF remains native');
