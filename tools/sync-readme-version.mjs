import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const version=manifest.version;
const file='README.md';
let text=fs.readFileSync(file,'utf8');

const badge=/version-\d+\.\d+\.\d+-4fc1ff/;
const current=/> \*\*Version actuelle : \d+\.\d+\.\d+\*\*/;
if(!badge.test(text))throw new Error('README version badge not found');
if(!current.test(text))throw new Error('README current-version marker not found');
text=text.replace(badge,`version-${version}-4fc1ff`);
text=text.replace(current,`> **Version actuelle : ${version}**`);
fs.writeFileSync(file,text);
console.log(`README synchronized to ${version}`);
