import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{throw new Error(m);};
const need=(s,t,m)=>{if(!s.includes(t))fail(m||`missing ${t}`);};
const forbid=(s,t,m)=>{if(s.includes(t))fail(m||`forbidden ${t}`);};

const authority=read('sidebar-projects-authority-v112.js');
for(const token of [
  "const shell=own.closest(selector)",
  'const candidate=el.closest?.(selector)',
  'const overlap=Math.max(0',
  "candidate.querySelector?.('[class*=\"project-unfurl-row\"]')",
  "projectLinks=links.filter(a=>projectChildHref(a.getAttribute('href')))",
  'projectLinks.length>=2',
  'if(projectLinks.length!==1)return false',
  'showMoreLabel(node.textContent||node.getAttribute?.(\'aria-label\'))'
])need(authority,token,`Projects authority structural-evidence invariant missing: ${token}`);
for(const token of [
  "const evidence=candidate.querySelector?.('a[href=\"/projects\"],a[href*=\"/g/g-p-\"],[class*=\"project-unfurl-row\"]')",
  "if(el.closest('aside,nav,[data-testid*=\"sidebar\" i],[class*=\"sidebar\" i]'))return true;"
])forbid(authority,token,`Projects authority broad-root regression returned: ${token}`);

const metadata=read('sidebar-metadata-v118.js');
for(const token of [
  'cidFromHref',
  'isCanonicalProjectBadge',
  "const canonical=id.startsWith('g-p-')",
  'recoveries=[]',
  'if(recovered)recoveries.push(next)',
  'projectChats[projectId]=list',
  'counts[projectId]=Math.max(Number(counts[projectId])||0,known)',
  'lifecycleEpoch=0',
  "window.__NIAKGPT_METADATA_READY_118__='stopped'",
  "window.__NIAKGPT_METADATA_READY_118__='error'",
  "const DATA_LOCK='niakgpt-data-mutation-v100'"
])need(metadata,token,`metadata data-integrity/lifecycle invariant missing: ${token}`);
forbid(metadata,"const canonical=id.startsWith('g-p-')||!!pidFromHref(p?.href||'')",'date ghost can be incorrectly legitimized by another Project in its href');

const authorityGate=read('visual-lab/sidebar-authority-isolation-v119.mjs');
for(const token of [
  'search-project-result',
  'left-search',
  'separate-native',
  "s.native==='1'&&s.separateNative==='1'",
  '!s.searchResult&&!s.searchHost',
  'marked.length===2',
  '24'
])need(authorityGate,token,`Projects authority positive/negative isolation gate incomplete: ${token}`);

const metadataGate=read('visual-lab/sidebar-metadata-v118.mjs');
for(const token of [
  'realDateBadge',
  "state.realDateBadge==='Today'",
  'nestedChatProject',
  'goodDirect',
  'goodCount',
  'recovered chats missing from existing Project snapshot',
  'canonical date-named Project was deleted as a ghost',
  "navigator.locks.request('niakgpt-data-mutation-v100'"
])need(metadataGate,token,`metadata canonical/recovery gate incomplete: ${token}`);

for(const file of [
  'visual-lab/native-action-races-v119.mjs',
  'visual-lab/sidebar-authority-isolation-v119.mjs',
  'visual-lab/sidebar-metadata-failure-v119.mjs',
  'visual-lab/sidebar-metadata-lifecycle-v119.mjs',
  'labs/background-boot-barrier-v119.mjs'
])if(!fs.existsSync(file))fail(`missing hardening gate ${file}`);

const actions=read('native-actions-v113.js');
for(const token of ['actionEpoch','actionOpening','actionCurrent','claimTriggerMenu','menuStrict','source.isConnected'])need(actions,token,`native-action race guard missing ${token}`);
forbid(actions,'buttons.at(-1)','unsafe arbitrary native action fallback returned');

const background=read('background-v100.js');
need(background,"const HARD_ISOLATED_BARRIER='sidebar-metadata-v118.js'",'metadata hard bootstrap barrier missing');
need(read('tools/check-runtime.mjs'),"import '../labs/background-boot-barrier-v119.mjs'",'background barrier gate is not part of runtime check');

console.log('V119_HARDENING_PASS actions=serialized authority=structural metadata=lossless/fail-closed lifecycle=guarded');
