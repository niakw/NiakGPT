import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd(),m=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const dist=path.join(root,'dist'),build=path.join(dist,'niakgpt'),zip=path.join(dist,`niakgpt-${m.version}.zip`);
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(build,{recursive:true});

const files=new Set(['manifest.json',m.background.service_worker]);
for(const entry of m.content_scripts)for(const key of ['js','css'])for(const file of entry[key]||[])files.add(file);
const bg=fs.readFileSync('background-v100.js','utf8');
for(const name of ['MAIN_RUNTIME','ISOLATED_RUNTIME']){
  const body=bg.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1];
  if(!body)throw new Error(`Missing ${name}`);
  for(const hit of body.matchAll(/'([^']+)'/g))files.add(hit[1]);
}
for(const file of [...Object.values(m.icons||{}),...Object.values(m.action?.default_icon||{})])files.add(file);
for(const file of ['README.md','PRIVACY.md','SECURITY.md','CHANGELOG.md'])if(fs.existsSync(file))files.add(file);

for(const file of files){
  if(!fs.existsSync(file))throw new Error(`Missing packaged file: ${file}`);
  const dest=path.join(build,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);
}
for(const required of ['boot-gate-v100.js','page-bridge.js','runtime-integrity-v101.js','cache-guardian-v100.js','server-index-v100.js','app-v090.js','activity-ui-v097.js'])if(!fs.existsSync(path.join(build,required)))throw new Error(`Runtime omitted from ZIP: ${required}`);
for(const retired of ['hotcache-main-v084.js','hotcache-ui-v097.js','hotcache-v084.js','activity-main-v087.js','app-v08-safe.js','project-governance-v085.js','project-pins-v085.js','boot-watchdog-v099.js'])if(fs.existsSync(path.join(build,retired)))throw new Error(`Retired runtime in ZIP: ${retired}`);

execFileSync('zip',['-qr',zip,'.'],{cwd:build,stdio:'inherit'});
console.log(`Packaged NiakGPT ${m.version}: ${zip}`);
