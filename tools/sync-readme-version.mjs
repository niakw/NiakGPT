import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const version=manifest.version;
const file='README.md';
let text=fs.readFileSync(file,'utf8');
const marker=/> \*\*État actuel : [^*]+\*\* — architecture en validation intensive\./;
const replacement=`> **État actuel : ${version} RC** — architecture en validation intensive.`;
if(!marker.test(text))throw new Error('README version marker not found');
text=text.replace(marker,replacement);
fs.writeFileSync(file,text);
console.log(`README synchronized to ${version}`);
