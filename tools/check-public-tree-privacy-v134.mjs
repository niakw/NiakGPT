import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);

// Sensitive/cross-project markers are stored only as SHA-256 digests.
// The public repository must not contain the underlying literal values even inside its privacy checker.
const forbiddenTokenHashes=new Set([
  '948291cd5de291e654aedc5104825b4cdeb45d414183d495c1171bac81848dc2',
  'd4923b761f86c7d2adf3b40d0ee59bba646c74801fc363887b9e45a88df3baed',
  '411a90a09f0b6da4dd1d0a353dff15a2a2327a1904324df2b7c24ab32427e2de',
  'de7ee76e7373c19bf7418e69cadecba96107bbb6d99524c516e1d37605dca829',
  'de88543670c7e730fca6f37ffa71a33692ddcd859617111c17e64ed2481e426e',
  '83f41b253eebe749bd32512d0985d2562207126cf1c10b1f8dabac552ed7f061',
  '044f4b3501cd8e8131d40c057893f4fdff66bf4032ecae159e0c892a28cf6c8e',
  '3291264178b7ea4130c020a7b4f7507040c7a4fd67c2340d46c881ef36725f9d',
  '12bdf19effaa77274cc0ccc76732c9c768bfe880bbd2a150969668bfbe3ca7bd',
  'd63e98c40394cfb53330471c7fa0748e345f0a730fab5cf5f03c74bf24ee0d8a'
]);
const sha256=value=>crypto.createHash('sha256').update(String(value||'').toLowerCase(),'utf8').digest('hex');

const violations=[];
const syntheticEmailDomain=domain=>{
  const d=String(domain||'').toLowerCase();
  return d.endsWith('.invalid')||d==='invalid'||d==='example.com'||d.endsWith('.example.com')||d==='users.noreply.github.com'||d.endsWith('.users.noreply.github.com');
};

const emailRx=/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;
const localPathRx=/(?:\/Users\/[^/\s]+|[A-Z]:\\Users\\[^\\\s]+)/gu;
const secretRx=/(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9_-]{20,})/g;
const frPhoneRx=/(?<!\d)(?:\+33\s?(?:\(0\)\s?)?|0)[1-9](?:[ .-]\d{2}){4}(?!\d)/g;
const intlPhoneContextRx=/\b(?:phone|telephone|téléphone|mobile|portable|whatsapp)\s*[:=]\s*\+?[0-9][0-9 .()/-]{6,22}[0-9]/giu;
const nirContextRx=/\b(?:nir|num(?:éro)?\s+de\s+sécu(?:rité\s+sociale)?|sécurité\s+sociale|social\s+security)\s*[:=#]\s*[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?(?:2A|2B|\d{2})\s?\d{3}\s?\d{3}\s?\d{2}/giu;
const ibanRx=/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/gu;
const ibanValid=raw=>{
  const compact=String(raw||'').replace(/\s+/g,'').toUpperCase();
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)||compact.length>34)return false;
  const moved=compact.slice(4)+compact.slice(0,4);
  let remainder=0;
  for(const ch of moved){
    const piece=/[A-Z]/.test(ch)?String(ch.charCodeAt(0)-55):ch;
    for(const digit of piece)remainder=(remainder*10+Number(digit))%97;
  }
  return remainder===1;
};
const addressContextRx=/\b(?:address|adresse|domicile|home\s+address)\s*[:=]\s*\d{1,4}(?:\s*(?:bis|ter|quater))?\s+(?:rue|avenue|av\.?|boulevard|bd\.?|chemin|route|impasse|allée|allee|place|quai|cours|street|st\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|way)\b[^\n]{2,100}/giu;
const labeledNameRx=/^(?:nom|prénom|prenom|full\s+name|first\s+name|last\s+name)\s*[:=]\s*[^\n]{2,100}$/gimu;

const scanForbiddenTokens=(text,file)=>{
  // Hash lexical tokens instead of embedding private literals in this public checker.
  const tokens=text.toLowerCase().match(/[\p{L}\p{N}_-]{3,64}/gu)||[];
  const seen=new Set();
  for(const token of tokens){
    if(seen.has(token))continue;
    seen.add(token);
    if(forbiddenTokenHashes.has(sha256(token)))violations.push(`${file}: forbidden private/cross-project marker`);
  }
};

for(const file of tracked){
  const full=path.join(root,file);
  let buf;
  try{buf=fs.readFileSync(full);}catch{continue;}
  if(buf.includes(0))continue;

  const text=buf.toString('utf8');
  scanForbiddenTokens(text,file);

  for(const m of text.matchAll(emailRx)){
    const address=String(m[0]||'').toLowerCase();
    if(address==='git@github.com')continue;
    if(!syntheticEmailDomain(m[1]))violations.push(`${file}: non-synthetic email address`);
  }

  if(localPathRx.test(text))violations.push(`${file}: personal local user path`);
  localPathRx.lastIndex=0;

  if(secretRx.test(text))violations.push(`${file}: secret/token-looking value`);
  secretRx.lastIndex=0;

  if(frPhoneRx.test(text))violations.push(`${file}: personal-looking French phone number`);
  frPhoneRx.lastIndex=0;

  if(intlPhoneContextRx.test(text))violations.push(`${file}: labeled phone number`);
  intlPhoneContextRx.lastIndex=0;

  if(nirContextRx.test(text))violations.push(`${file}: labeled social-security identifier`);
  nirContextRx.lastIndex=0;

  for(const m of text.matchAll(ibanRx)){
    if(ibanValid(m[0]))violations.push(`${file}: valid IBAN-looking value`);
  }

  if(addressContextRx.test(text))violations.push(`${file}: labeled postal address`);
  addressContextRx.lastIndex=0;

  if(labeledNameRx.test(text))violations.push(`${file}: labeled personal name`);
  labeledNameRx.lastIndex=0;
}

if(violations.length){
  console.error('PUBLIC_TREE_PRIVACY_FAILED');
  for(const item of [...new Set(violations)])console.error(' - '+item);
  process.exit(1);
}
console.log(`PUBLIC_TREE_PRIVACY_PASS tracked=${tracked.length}`);
