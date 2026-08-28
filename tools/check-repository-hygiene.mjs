import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'})
  .split('\0').filter(Boolean);

const failures=[];
const fail=message=>failures.push(message);

const allowedArchives=new Set([
  'labs/archives/NiakGPT-0.9.51-LABS.zip',
]);

const junkPatterns=[
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)__pycache__(\/|$)/,
  /(^|\/)\.cache(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /\.(?:log|tmp|bak|orig|swp)$/i,
];

for(const file of tracked){
  if(junkPatterns.some(rx=>rx.test(file)))fail(`generated/junk file tracked: ${file}`);
  if(/\.(?:zip|tar|tgz|gz)$/i.test(file)&&!allowedArchives.has(file)){
    fail(`unexpected archive tracked: ${file}`);
  }
}

const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const shipped=new Set([
  manifest.background?.service_worker,
  ...manifest.content_scripts.flatMap(entry=>[...(entry.js||[]),...(entry.css||[])]),
].filter(Boolean));

const background=fs.readFileSync(path.join(root,'background-v100.js'),'utf8');
for(const hit of background.matchAll(/['"]([^'"]+\.(?:js|css))['"]/g))shipped.add(hit[1]);

const textFiles=new Map();
for(const file of tracked){
  const full=path.join(root,file);
  let buf;
  try{buf=fs.readFileSync(full);}catch{continue;}
  if(buf.includes(0))continue;
  textFiles.set(file,buf.toString('utf8'));
}

const rootRuntime=tracked.filter(file=>!file.includes('/')&&/\.(?:js|css)$/i.test(file));
for(const file of rootRuntime){
  if(shipped.has(file))continue;
  let referenced=false;
  for(const [other,content] of textFiles){
    if(other===file)continue;
    if(content.includes(file)){referenced=true;break;}
  }
  if(!referenced)fail(`unreferenced top-level runtime file: ${file}`);
}

const requiredDocs=['README.md','README.fr.md','ARCHITECTURE.md','CHANGELOG.md','PRIVACY.md','SECURITY.md','CONTRIBUTING.md','TESTING_TRUTH.md'];
for(const doc of requiredDocs)if(!tracked.includes(doc))fail(`missing required documentation: ${doc}`);

const readme=fs.readFileSync('README.md','utf8');
const readmeFr=fs.readFileSync('README.fr.md','utf8');
if(!readme.includes('README.fr.md'))fail('English README must link to README.fr.md');
if(!readmeFr.includes('README.md'))fail('French README must link back to README.md');

if(failures.length){
  console.error('Repository hygiene FAILED');
  for(const item of failures)console.error(` - ${item}`);
  process.exit(1);
}

console.log(
  `Repository hygiene OK: ${tracked.length} tracked files, ${rootRuntime.length} top-level runtime files, no generated junk or unreferenced root runtime.`
);
