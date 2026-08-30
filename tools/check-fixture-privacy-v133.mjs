import fs from 'node:fs';
import path from 'node:path';

const roots=['labs','visual-lab','test'];
const allowedExt=new Set(['.js','.mjs','.md','.json','.html','.css']);
const files=[];
for(const root of roots){
  if(!fs.existsSync(root))continue;
  const walk=dir=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,ent.name);
      if(ent.isDirectory()){if(ent.name!=='node_modules'&&ent.name!=='artifacts')walk(full);continue;}
      if(ent.name==='package-lock.json'||!allowedExt.has(path.extname(ent.name)))continue;
      files.push(full);
    }
  };
  walk(root);
}

const violations=[];
const personalGreeting=/\b(?:Bonjour|Hello)\s+(?!(?:Utilisateur|User|Test|Synthetic|World)\b)([A-ZÀ-ÖØ-Ý][\p{L}'’-]{1,30})\b/gu;
const email=/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;
const secret=/(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/g;

for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const m of text.matchAll(personalGreeting))violations.push(`${file}: personal-looking greeting fixture "${m[0]}"`);
  for(const m of text.matchAll(email)){
    const domain=String(m[1]||'').toLowerCase();
    if(!isSyntheticEmailDomain(domain))violations.push(`${file}: non-synthetic email fixture`);
  }
  if(secret.test(text))violations.push(`${file}: secret/token-looking fixture`);
  secret.lastIndex=0;
}
if(violations.length){
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`FIXTURE_PRIVACY_V133_PASS files=${files.length}`);
