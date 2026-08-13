import fs from 'node:fs';
const p='hotcache-main-v084.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

if(!s.includes('KNOWN_META_TTL'))s=s.replace('  const UNKNOWN_META_TTL = 2 * 60 * 1000;','  const UNKNOWN_META_TTL = 2 * 60 * 1000;\n  const KNOWN_META_TTL = 15 * 60 * 1000;');
const old="    if (latest && entry.updateTime) return latest <= entry.updateTime;\n    if (latest && !entry.updateTime) return false;\n    return age <= UNKNOWN_META_TTL;";
const next="    if (latest && entry.updateTime) return latest <= entry.updateTime && age <= KNOWN_META_TTL;\n    if (latest && !entry.updateTime) return false;\n    return age <= UNKNOWN_META_TTL;";
if(s.includes(old))s=s.replace(old,next);
must(s.includes('KNOWN_META_TTL = 15 * 60 * 1000'),'known-metadata freshness TTL missing');
must(s.includes('latest <= entry.updateTime && age <= KNOWN_META_TTL'),'known cache can remain fresh indefinitely');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('KNOWN_META_TTL'))c=c.replace("has(hotMain,'MAX_MEMORY_BYTES = 48 * 1024 * 1024','hot-cache memory byte cap missing');","has(hotMain,'MAX_MEMORY_BYTES = 48 * 1024 * 1024','hot-cache memory byte cap missing');\nhas(hotMain,'KNOWN_META_TTL = 15 * 60 * 1000','hot-cache soft freshness TTL missing');\nhas(hotMain,'latest <= entry.updateTime && age <= KNOWN_META_TTL','known metadata cache must still revalidate periodically');");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 hot-cache freshness bounded to 15 minutes');
