import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const join=(...parts)=>parts.join('');
const forbidden=[
  join('mio','rra'),
  join('aely','ron'),
  join('eit','ty'),
  join('eli','as'),
  join('niak','vio'),
  join('nu','vio'),
  join('tom','my'),
  join('fois','sy'),
  join('poll','estres'),
  join('mitja','vila')
].map(x=>x.toLowerCase());

const violations=[];
const syntheticEmailDomain=domain=>{
  const d=String(domain||'').toLowerCase();
  return d.endsWith('.invalid')||d==='invalid'||d==='example.com'||d.endsWith('.example.com')||d.endsWith('users.noreply.github.com');
};
const emailRx=/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;
const localPathRx=/(?:\/Users\/[^/\s]+|[A-Z]:\\Users\\[^\\\s]+)/giu;
const secretRx=/(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/g;

for(const file of tracked){
  const full=path.join(root,file);
  let buf;
  try{buf=fs.readFileSync(full);}catch{continue;}
  if(buf.includes(0))continue;
  const text=buf.toString('utf8'),lower=text.toLowerCase();
  for(const token of forbidden){
    if(lower.includes(token))violations.push(`${file}: private marker "${token}"`);
  }
  for(const m of text.matchAll(emailRx)){
    const address=String(m[0]||'').toLowerCase();
    if(address==='git@github.com')continue; // SSH remote syntax, not a mailbox fixture.
    if(!syntheticEmailDomain(m[1]))violations.push(`${file}: non-synthetic email address`);
  }
  if(localPathRx.test(text))violations.push(`${file}: personal local user path`);
  localPathRx.lastIndex=0;
  if(secretRx.test(text))violations.push(`${file}: secret/token-looking value`);
  secretRx.lastIndex=0;
}

if(violations.length){
  console.error('PUBLIC_TREE_PRIVACY_FAILED');
  for(const item of [...new Set(violations)])console.error(' - '+item);
  process.exit(1);
}
console.log(`PUBLIC_TREE_PRIVACY_PASS tracked=${tracked.length}`);
