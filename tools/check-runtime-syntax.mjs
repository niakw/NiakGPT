import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const background=read('background-v100.js');
const files=new Set();

for(const entry of manifest.content_scripts||[])for(const file of entry.js||[])files.add(file);
if(manifest.background?.service_worker)files.add(manifest.background.service_worker);
for(const name of ['MAIN_RUNTIME','ISOLATED_RUNTIME']){
  const body=background.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1];
  if(!body)throw new Error(`Missing ${name} runtime declaration`);
  for(const hit of body.matchAll(/'([^']+)'/g))files.add(hit[1]);
}

for(const file of files){
  if(!fs.existsSync(file))throw new Error(`Missing runtime JavaScript: ${file}`);
  if(!file.endsWith('.js')&&!file.endsWith('.mjs'))continue;
  const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(checked.status!==0){
    const detail=String(checked.stderr||checked.stdout||'').trim();
    throw new Error(`JavaScript syntax failed for ${file}${detail?`\n${detail}`:''}`);
  }
}

console.log(`RUNTIME_SYNTAX_PASS files=${files.size}`);
