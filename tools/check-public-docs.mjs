import fs from 'node:fs';

const required=['README.md','PRIVACY.md','SECURITY.md','ARCHITECTURE.md','CONTRIBUTING.md','TROUBLESHOOTING.md','CHANGELOG.md'];
const forbidden=[
  /miorra/i,/aelyron/i,/eitty/i,/elias/i,/niakvio/i,/tommy/i,/foissy/i,
  /authorization:\s*bearer\s+[A-Za-z0-9._-]+/i,
  /accessToken["'\s:]+[A-Za-z0-9._-]{20,}/i,
  /cookie:\s*[^\n]{20,}/i
];

for(const file of required){
  if(!fs.existsSync(file))throw new Error(`Missing public document: ${file}`);
  const text=fs.readFileSync(file,'utf8');
  if(text.trim().length<120)throw new Error(`Document unexpectedly short: ${file}`);
  for(const pattern of forbidden)if(pattern.test(text))throw new Error(`Sensitive/private marker found in ${file}: ${pattern}`);
}

const readme=fs.readFileSync('README.md','utf8');
for(const requiredText of [
  'local-first',
  'Safe Mode',
  'Project Governance',
  'Visual Lab',
  'endpoints internes',
  'non documentés',
  'PRIVACY.md',
  'SECURITY.md'
]){
  if(!readme.includes(requiredText))throw new Error(`README missing public-grade disclosure: ${requiredText}`);
}

const architecture=fs.readFileSync('ARCHITECTURE.md','utf8');
for(const invariant of [
  'pas de polling global permanent',
  'un seul WORKER',
  'manuel > automatique',
  'ne jamais inventer un cursor',
  'un seul host Projects'
]){
  if(!architecture.toLowerCase().includes(invariant.toLowerCase()))throw new Error(`Architecture invariant missing: ${invariant}`);
}

const privacy=fs.readFileSync('PRIVACY.md','utf8');
for(const disclosure of ['chrome.storage.local','chrome.storage.session','IndexedDB','BroadcastChannel','aucune analytics','api.github.com','dépôt privé']){
  if(!privacy.includes(disclosure))throw new Error(`Privacy disclosure missing: ${disclosure}`);
}

const security=fs.readFileSync('SECURITY.md','utf8');
for(const disclosure of ['Project Governance','Authorization','Permissions','Secrets','fine-grained PAT','memoryBootstrap']){
  if(!security.includes(disclosure))throw new Error(`Security guidance missing: ${disclosure}`);
}

console.log(`Public documentation gate: ${required.length} documents OK`);
