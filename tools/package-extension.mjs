import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const dist=path.join(root,'dist');
const build=path.join(dist,'niakgpt');
const zip=path.join(dist,`niakgpt-${manifest.version}.zip`);

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(build,{recursive:true});

const runtime=new Set(['manifest.json']);
for(const script of manifest.content_scripts||[]){
  for(const file of script.js||[])runtime.add(file);
  for(const file of script.css||[])runtime.add(file);
}
if(manifest.background?.service_worker)runtime.add(manifest.background.service_worker);
for(const file of Object.values(manifest.icons||{}))runtime.add(file);
for(const file of Object.values(manifest.action?.default_icon||{}))runtime.add(file);
for(const file of ['README.md','PRIVACY.md','SECURITY.md','CHANGELOG.md'])if(fs.existsSync(path.join(root,file)))runtime.add(file);

for(const file of runtime){
  const src=path.join(root,file);
  if(!fs.existsSync(src))throw new Error(`Missing packaged file: ${file}`);
  const dest=path.join(build,file);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(src,dest);
}

const dead=['app-v08-safe.js','multitab-v083.js','polish-v081.js','chronology-v081.js','project-governance-v085.js','project-pins-v085.js','onboarding-v100.js'];
for(const file of dead)if(fs.existsSync(path.join(build,file)))throw new Error(`Legacy runtime leaked into package: ${file}`);

const manifestInBuild=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8'));
if(manifestInBuild.name!=='NiakGPT')throw new Error('Packaged manifest invalid');
if(!fs.existsSync(path.join(build,'manifest.json')))throw new Error('manifest.json must be at package root');
if(manifestInBuild.background?.service_worker&&!fs.existsSync(path.join(build,manifestInBuild.background.service_worker)))throw new Error('Lifecycle service worker missing from package');

const sensitive=/miorra|aelyron|eitty|elias|niakvio|tommy|foissy/i;
for(const file of [...runtime].filter(x=>/\.(js|css|json|md)$/i.test(x))){
  const text=fs.readFileSync(path.join(build,file),'utf8');
  if(sensitive.test(text))throw new Error(`Personal data leaked into package: ${file}`);
}

fs.mkdirSync(dist,{recursive:true});
try{fs.rmSync(zip,{force:true});}catch{}
execFileSync('zip',['-qr',zip,'.'],{cwd:build,stdio:'inherit'});
console.log(`Packaged NiakGPT ${manifest.version}: ${zip}`);
console.log([...runtime].sort().join('\n'));
