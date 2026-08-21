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
for(const file of ['README.md','LICENSE','PRIVACY.md','SECURITY.md','CHANGELOG.md'])if(fs.existsSync(file))files.add(file);

for(const file of files){
  if(!fs.existsSync(file))throw new Error(`Missing packaged file: ${file}`);
  const dest=path.join(build,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);
}
for(const required of [
  'boot-gate-v100.js','page-bridge.js','browser-compat-v102.js','lifecycle-guard-v104.js','multitab-v090.js',
  'governance-adapter-v105.js','project-governance-v090.js','app-v090.js','project-state-selfheal-v102.js','project-assignment-selfheal-v103.js',
  'sidebar-metadata-v118.js','sidebar-metadata-v118.css','sidebar-projects-authority-v112.js','sidebar-projects-authority-v112.css',
  'sidebar-ux-v119.js','sidebar-ux-v119.css','sidebar-actions-v123.js','sidebar-actions-v123.css','interruption-guard-v119.js','interruption-guard-v119.css',
  'analysis-bridge-v112.js','reclassify-deep-v112.js','performance-guard-v112.js','performance-guard-v112.css','home-layout-v112.js','home-layout-v112.css',
  'matrix-guardian-v112.js','matrix-guardian-v112.css','turn-headers-v112.js','continuity-v112.js','native-da-v112.css','sidebar-icons-v114.js','sidebar-icons-v114.css','cache-bus-v096.js',
  'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','chat-attention-v113.css','native-actions-v113.css','conversation-load-guard-v113.js',
  'activity-ui-v097.js','side-panels-v096.js','live-fixes-v104.js','live-fixes-v106.js','project-links-v106.js','live-fixes-v104.css','continuity-v100.js'
])if(!fs.existsSync(path.join(build,required)))throw new Error(`Runtime omitted from ZIP: ${required}`);
for(const requiredDoc of ['README.md','LICENSE','PRIVACY.md','SECURITY.md','CHANGELOG.md'])if(!fs.existsSync(path.join(build,requiredDoc)))throw new Error(`Required release document omitted from ZIP: ${requiredDoc}`);
for(const dead of [
  'app-v08-safe.js','project-governance-v085.js','project-pins-v085.js','project-pins-v090.js','boot-watchdog-v099.js','hotcache-main-v084.js',
  'activity-main-v087.js','manual-lock-main-v085.js','sidebar-authority-v107.js','sidebar-authority-v107.css','sidebar-expando-guard-v108.js','sidebar-expando-guard-v108.css',
  'sidebar-projects-authority-v109.js','sidebar-projects-authority-v110.js','sidebar-projects-authority-v111.js','native-rename-v112.js','native-rename-v112.css','native-actions-controller-v119.js','native-actions-v113.js','breadcrumb-v100.js'
])if(fs.existsSync(path.join(build,dead)))throw new Error(`Legacy runtime in ZIP: ${dead}`);

execFileSync('zip',['-qr',zip,'.'],{cwd:build,stdio:'inherit'});
console.log(`Packaged NiakGPT ${m.version}: ${zip}`);