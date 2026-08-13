import fs from 'node:fs';

const fail = message => { throw new Error(message); };
const read = path => fs.readFileSync(path, 'utf8');
const has = (text, token, message = `missing: ${token}`) => { if (!text.includes(token)) fail(message); };
const no = (text, token, message = `forbidden: ${token}`) => { if (text.includes(token)) fail(message); };

const manifest = JSON.parse(read('manifest.json'));
if (manifest.manifest_version !== 3) fail('Manifest V3 required');
if (manifest.name !== 'NiakGPT') fail('Wrong extension name');
if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || ''))) fail(`Invalid semantic version: ${manifest.version}`);
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage'])) fail('Only storage permission is allowed');
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(['https://chatgpt.com/*'])) fail('Host permissions must remain ChatGPT-only');
if (manifest.background?.service_worker !== 'background-v100.js') fail('Lifecycle service worker required');
if (!manifest.content_scripts.every(x => x.matches?.every(v => v === 'https://chatgpt.com/*') && x.run_at === 'document_start')) fail('Every content script must be ChatGPT-only and start at document_start');

const main = manifest.content_scripts.find(x => x.world === 'MAIN');
const isolated = manifest.content_scripts.find(x => x.world !== 'MAIN');
const expectedMain = ['page-bridge.js','manual-lock-main-v085.js','activity-main-v087.js','hotcache-main-v084.js'];
const expectedIsolated = ['onboarding-v101.js','profiles-v100.js','control-center-v090.js','commands-v100.js','multitab-v090.js','project-governance-v090.js','project-pins-v090.js','sidebar-host-v090.js','app-v090.js','polish-v090.js','chronology-v090.js','hotcache-v084.js','activity-v086.js'];
const expectedCss = ['theme-v08.css','polish-v081.css','chronology-v081.css','multitab-v083.css','governance-v085.css','activity-v086.css','control-center-v090.css','core-v090.css','profiles-v100.css','commands-v100.css','onboarding-v100.css'];
if (JSON.stringify(main?.js) !== JSON.stringify(expectedMain)) fail('MAIN runtime order mismatch');
if (JSON.stringify(isolated?.js) !== JSON.stringify(expectedIsolated)) fail('Isolated runtime order mismatch');
if (JSON.stringify(isolated?.css) !== JSON.stringify(expectedCss)) fail('CSS runtime order mismatch');

const deadRuntime = ['app-v08-safe.js','multitab-v083.js','polish-v081.js','chronology-v081.js','project-governance-v085.js','project-pins-v085.js','onboarding-v100.js'];
for (const old of deadRuntime) if (isolated.js.includes(old)) fail(`Legacy runtime loaded: ${old}`);

const texts = Object.fromEntries([...expectedMain, ...expectedIsolated].map(path => [path, read(path)]));
const cssTexts = Object.fromEntries(expectedCss.map(path => [path, read(path)]));
const background = read(manifest.background.service_worker);

for (const file of ['app-v090.js','chronology-v090.js','polish-v090.js','control-center-v090.js','project-governance-v090.js','project-pins-v090.js','sidebar-host-v090.js','profiles-v100.js','commands-v100.js','onboarding-v101.js']) {
  no(texts[file], 'setInterval(', `Permanent polling forbidden in ${file}`);
}

// Core / performance invariants.
has(texts['app-v090.js'], 'MutationObserver(queueMainNodes)');
has(texts['app-v090.js'], 'S.pendingMain');
has(texts['app-v090.js'], 'canBackground');
has(texts['app-v090.js'], 'setTimeout(matrixLoop');
has(texts['app-v090.js'], 'setTimeout(routeTick,2400)');
no(texts['app-v090.js'], "querySelectorAll('button,[data-testid]')", 'Broad generation button scan reintroduced');
no(texts['app-v090.js'], 'requestAnimationFrame(draw)', 'Perpetual RAF Matrix loop reintroduced');

// Managed Project host must be unique and inside the sidebar.
has(texts['sidebar-host-v090.js'], "document.querySelectorAll('#ng8-pins')");
has(texts['sidebar-host-v090.js'], 'root.insertBefore(host');
has(texts['sidebar-host-v090.js'], 'if(box!==host)box.remove()');
has(texts['sidebar-host-v090.js'], "dataset.ng90ProjectHosts='1'");

// Project pagination: never invent cursors.
has(texts['page-bridge.js'], 'Never invent a cursor');
no(texts['page-bridge.js'], "searchParams.set('cursor', '0')", 'cursor=0 must never be invented');
no(texts['page-bridge.js'], 'searchParams.set("cursor", "0")', 'cursor=0 must never be invented');
has(texts['app-v090.js'], "new URLSearchParams({limit:'20'})");
has(texts['app-v090.js'], "if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor))");
has(texts['page-bridge.js'], 'result.status === 422');
has(texts['page-bridge.js'], "url.searchParams.delete('limit')");

// Activity must survive document_start and share real states.
has(texts['activity-main-v087.js'], 'niakgptActivityAwareFetch');
has(texts['activity-v086.js'], 'body may not exist yet');
has(texts['activity-v086.js'], 'tick recovered');
for (const token of ["loading:'CHARGEMENT'","waiting:'ATTENTE'","thinking:'RÉFLEXION / ANALYSE'","executing:'EXÉCUTION'","error:'ERREUR'","ready:'PRÊT'"]) has(texts['activity-v086.js'], token);
has(texts['activity-v086.js'], 'BroadcastChannel');

// Multi-tab and Safe Mode.
has(texts['multitab-v090.js'], 'navigator.locks');
has(texts['multitab-v090.js'], 'canRunWorkerIdle');
has(texts['multitab-v090.js'], 'dataset.ng8Running');
has(texts['multitab-v090.js'], 'dataset.ng8Heavy');
has(texts['multitab-v090.js'], 'releaseWorkerForSafeMode');
no(texts['multitab-v090.js'], "querySelectorAll('button,[data-testid]')", 'Broad multi-tab DOM scan reintroduced');

// Governance + manual priority.
has(texts['manual-lock-main-v085.js'], 'niakgpt:manual-project-move');
has(texts['page-bridge.js'], 'project_move_requires_governance');
for (const token of ['verifyAndLockManualMove','verifyDestination','buildCleanupPlan','buildProfiles','executePlan','unlockChat','À CLASSER','scheduleAutoResync']) has(texts['project-governance-v090.js'], token);
has(texts['project-governance-v090.js'], "role()==='worker'");
has(texts['project-governance-v090.js'], 'safeMode()');

// Native pins must obey settings + verification.
for (const token of ['syncEnabled','nativePinnedIds','verifyPinned','désépingler','épingler']) has(texts['project-pins-v090.js'], token);
has(texts['project-pins-v090.js'], "role()==='worker'");
has(texts['project-pins-v090.js'], 'settings.safeMode!==true');

// Hot cache.
for (const token of ['indexedDB.open','MAX_ENTRIES = 5','MAX_TOTAL_BYTES = 96','WAIT_PEER','HIT_PEER']) has(texts['hotcache-main-v084.js'], token);

// Control Center public controls + accessibility.
for (const token of ['sanitize(raw','SETTINGS_MIRROR','syncGovernanceAutomation','exportConfig','importConfig','copyDiagnostic','wipeAllLocalData','trapTab','returnFocus']) has(texts['control-center-v090.js'], token);
has(texts['polish-v090.js'], "setAttribute('aria-label','Activer le Safe Mode')");
has(texts['polish-v090.js'], "setAttribute('role','switch')");

// Install lifecycle + onboarding.
has(background, 'chrome.runtime.onInstalled');
has(background, 'currentVersion:current');
has(background, 'previousVersion:details.previousVersion');
has(texts['onboarding-v101.js'], 'INSTALL_META');
has(texts['onboarding-v101.js'], "lifecycle?.reason==='install'");
has(texts['onboarding-v101.js'], "lifecycle?.reason==='update'");
has(texts['onboarding-v101.js'], "status:'upgrade-skipped'");
has(texts['onboarding-v101.js'], 'data-skip');
no(texts['onboarding-v101.js'], 'hasLegacyMirror');

// Workspace profiles + Command Palette.
for (const profile of ['power','code','research','focus','analyst','contrast']) has(texts['profiles-v100.js'], `'${profile}'`);
has(texts['profiles-v100.js'], 'niakgpt:set-profile');
has(texts['commands-v100.js'], "event.ctrlKey||event.metaKey");
has(texts['commands-v100.js'], "String(event.key).toLowerCase()==='p'");
has(texts['commands-v100.js'], 'Project Governance');
has(texts['commands-v100.js'], 'Profil : Code / IDE');

// User-facing core features.
for (const token of ['fetchProjects','fetchGeneralBestEffort','openQuick','suggestionSet','ensureCoach','ng8-toc-search','ng90-project-extras','BY SKYNET']) has(texts['app-v090.js'], token);
has(cssTexts['core-v090.css'], 'focus-visible');
has(cssTexts['profiles-v100.css'], 'data-ng100-profile="contrast"');
has(cssTexts['commands-v100.css'], '#ng100-command');
has(cssTexts['onboarding-v100.css'], '#ng100-onboarding');

// Privacy guard: no personal/project-specific names in active runtime.
const privatePattern = /miorra|aelyron|eitty|elias|niakvio|tommy|foissy/i;
for (const [file, text] of [...Object.entries(texts), ...Object.entries(cssTexts), [manifest.background.service_worker, background]]) {
  if (privatePattern.test(text)) fail(`Personal data hardcoded in active runtime: ${file}`);
}

// No accidental external origins in active runtime source.
for (const [file, text] of [...Object.entries(texts), [manifest.background.service_worker, background]]) {
  const urls = [...text.matchAll(/https?:\/\/[^'"`\s)]+/g)].map(m => m[0]);
  for (const url of urls) if (!url.startsWith('https://chatgpt.com')) fail(`Unexpected external URL in ${file}: ${url}`);
}

// Public documentation must exist and match the manifest version.
for (const doc of ['README.md','PRIVACY.md','SECURITY.md','CHANGELOG.md']) if (!fs.existsSync(doc)) fail(`Missing public documentation: ${doc}`);
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
has(readme, `État actuel : ${manifest.version}`, 'README version/status must match manifest');
has(changelog, `## ${manifest.version}`, 'CHANGELOG must contain current manifest version');

console.log(`NiakGPT ${manifest.version} runtime invariants: OK`);
