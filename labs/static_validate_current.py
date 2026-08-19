#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
errors=[]
def fail(message): errors.append(message)
def runtime(name):
    text=(ROOT/'background-v100.js').read_text(encoding='utf-8')
    match=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];",text,re.S)
    if not match:
        fail(f'missing {name}')
        return []
    return re.findall(r"['\"]([^'\"]+\.js)['\"]",match.group(1))

if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if manifest.get('version')!='0.9.68': fail(f"version={manifest.get('version')}")
if manifest.get('permissions')!=['storage','scripting']: fail('permissions drift')
if manifest.get('host_permissions')!=['https://chatgpt.com/*']: fail('host permissions drift')
main=runtime('MAIN_RUNTIME'); isolated=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
required={'sidebar-metadata-v118.js','sidebar-projects-authority-v112.js','home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js','continuity-v112.js','chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','native-actions-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js'}
missing_runtime=sorted(required-set(isolated))
if missing_runtime: fail('current runtime missing: '+', '.join(missing_runtime))
for forbidden in ('project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js'):
    if forbidden in isolated: fail(f'legacy/conflicting runtime still wired: {forbidden}')
try:
    metadata_index=isolated.index('sidebar-metadata-v118.js')
    for consumer in ('cache-guardian-v100.js','recovery-v100.js','server-index-v100.js','project-governance-v090.js','reclassify-v101.js'):
        if metadata_index>=isolated.index(consumer): fail(f'sidebar metadata must sanitize cache before {consumer}')
except ValueError as exc:
    fail(f'metadata-first runtime order incomplete: {exc}')
refs=set(main+isolated)
for cs in manifest.get('content_scripts',[]): refs.update(cs.get('js',[])); refs.update(cs.get('css',[]))
refs.add(manifest.get('background',{}).get('service_worker','')); refs.update((manifest.get('icons') or {}).values()); refs.update((manifest.get('action',{}).get('default_icon') or {}).values())
missing=sorted(x for x in refs if x and not (ROOT/x).exists())
if missing: fail('missing refs: '+', '.join(missing))
for f in sorted({ROOT/x for x in refs if x.endswith('.js')}):
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode: fail(f'node --check {f.name}: {r.stderr.strip()}')
for f in sorted({ROOT/x for x in refs if x.endswith('.css')}):
    text=f.read_text(encoding='utf-8')
    if text.count('{')!=text.count('}'): fail(f'CSS braces {f.name}')
all_runtime='\n'.join((ROOT/f).read_text(encoding='utf-8') for f in main+isolated)
if 'setInterval(' in '\n'.join((ROOT/f).read_text(encoding='utf-8') for f in isolated if f!='retro-loader-v097.js'): fail('permanent polling in isolated runtime')
if re.search(r'window\.fetch\s*=|globalThis\.fetch\s*=',all_runtime): fail('runtime replaces global fetch')
manifest_text=json.dumps(manifest)
for required_css in ('sidebar-metadata-v118.css','sidebar-projects-authority-v112.css','home-layout-v112.css','matrix-guardian-v112.css','performance-guard-v112.css','native-da-v112.css','sidebar-icons-v114.css','native-actions-v113.css','chat-attention-v113.css'):
    if required_css not in manifest_text: fail(f'missing CSS {required_css}')
for forbidden_css in ('native-rename-v112.css','sidebar-authority-v107.css','sidebar-expando-guard-v108.css','sidebar-projects-authority-v111.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v109.css'):
    if forbidden_css in manifest_text: fail(f'old CSS wired: {forbidden_css}')
perf=(ROOT/'performance-guard-v112.js').read_text(encoding='utf-8')
if 'COLD_KEEP=44' not in perf or 'requestIdleCallback' not in perf: fail('long-thread cold-history budget drift')
deep=(ROOT/'reclassify-deep-v112.js').read_text(encoding='utf-8')
if 'MAX_PER_RUN=2' not in deep or 'MAX_HEAVY=1' not in deep: fail('deep classification budget drift')
actions=(ROOT/'native-actions-v113.js').read_text(encoding='utf-8')
if 'invokeNativeMenu' not in actions or 'fallbackMove' not in actions: fail('native action/fallback move path missing')
if 'data-ng112-native-projects' not in actions: fail('native actions do not stage passive Projects marks')
for token in ('placeFloatingMenu','ng113-native-menu-floating','ensureChatEntry','ng96-chat-entry','showPopover','ng113TopLayer','menuBaseline','menuSession','sessionVisibleMenus','resetFloatingMenu','fallbackOutsideHandler','actionEpoch','actionOpening','claimTriggerMenu','aria-busy'):
    if token not in actions: fail('left-sidebar action geometry/session/race cleanup missing '+token)
state=(ROOT/'chat-state-authority-v113.js').read_text(encoding='utf-8')
if 'iu>pu' not in state or 'iu===pu' not in state: fail('monotonic title authority missing')
bread=(ROOT/'breadcrumb-v113.js').read_text(encoding='utf-8')
if '>Accueil<' not in bread or 'ng100-bc-current' not in bread: fail('canonical linked breadcrumb missing')
projects=(ROOT/'sidebar-projects-authority-v112.js').read_text(encoding='utf-8')
for token in ('sharesSidebarShell','managedIdentityCount','identityHosts','watchRoots','bindObservers',"const MARK='data-ng112-native-projects'"):
    if token not in projects: fail('passive sidebar authority missing '+token)
for forbidden in ('attributes:true','attributeFilter:','classList.add(HIDE)',"setAttribute('aria-hidden'"):
    if forbidden in projects: fail('Projects authority reintroduced native attribute/class churn: '+forbidden)
projects_css=(ROOT/'sidebar-projects-authority-v112.css').read_text(encoding='utf-8')
if '[data-ng112-native-projects="1"]' not in projects_css: fail('passive Projects CSS marker missing')
metadata=(ROOT/'sidebar-metadata-v118.js').read_text(encoding='utf-8')
for token in ('normalizeChatMetadata','cleanCache','wrapCacheBus','sanitizeCache','sanitizeTask','childList:true',"const DATA_LOCK='niakgpt-data-mutation-v100'",'navigator.locks?.request','await navigator.locks.request(DATA_LOCK','return{ok:false,error};',"window.__NIAKGPT_METADATA_READY_118__='error'",'let result=await sanitizeCache();',"if(!result?.ok&&!stopped){await new Promise(resolve=>setTimeout(resolve,80));result=await sanitizeCache();}"):
    if token not in metadata: fail('sidebar metadata hygiene/shared-lock/fail-closed serialization incomplete '+token)
for forbidden in ('suppressNativeProjects','ng107-native-project','ng108-native-project','data-ng112-native-projects','attributes:true','attributeFilter:'):
    if forbidden in metadata: fail('metadata module reintroduced Projects authority/churn '+forbidden)
initial_sanitize=metadata.find('let result=await sanitizeCache();')
subscription_arm=metadata.find('const rawSubscribe=')
if initial_sanitize<0 or subscription_arm<0 or initial_sanitize>=subscription_arm: fail('metadata subscription is armed before bounded initial sanitation barrier')
if "if(!result?.ok){window.__NIAKGPT_METADATA_READY_118__='error';throw" not in metadata: fail('metadata does not fail closed after bounded sanitation retry')
metadata_css=(ROOT/'sidebar-metadata-v118.css').read_text(encoding='utf-8')
if 'time.ng8-chat-date' not in metadata_css or 'native-project' in metadata_css: fail('metadata CSS drift or Projects suppression leak')
legacy104=(ROOT/'live-fixes-v104.js').read_text(encoding='utf-8')
legacy106=(ROOT/'live-fixes-v106.js').read_text(encoding='utf-8')
legacy_css=(ROOT/'live-fixes-v104.css').read_text(encoding='utf-8')
if 'suppressNativeProjects' in legacy104 or 'ng8-native-project-link-suppressed' in legacy104: fail('live-fixes-v104 still owns native Projects suppression')
if 'suppressNativeProjects' in legacy106 or "classList.add('ng8-native-project" in legacy106 or 'sidebarObserver' in legacy106: fail('live-fixes-v106 still mutates/observes native Projects authority')
if 'clearLegacyProjectMarks' not in legacy106: fail('legacy Projects classes are not cleaned once during v106 migration')
if '.ng8-native-project' in legacy_css: fail('legacy Projects suppression CSS is still active outside v112 authority')
folders=(ROOT/'pin-folders-v096.js').read_text(encoding='utf-8')
for token in ('drawerDirty','cooperativeNode','existing.previousElementSibling===entry','ng96-chat-entry'):
    if token not in folders: fail('pin idle-stability/atomic-row guard missing '+token)
if "createElement('button');open.type='button';open.className='ng96-project-open'" in folders: fail('obsolete open-page button recreated')
chatux=(ROOT/'project-chat-ux-v110.js').read_text(encoding='utf-8')
if 'ng110ChatRow' not in chatux: fail('chat state is not mirrored to atomic rows')
experience=ROOT/'visual-lab/experience-gate-v116.mjs'; runtime_gate=ROOT/'visual-lab/tests/sidebar-runtime-v116.spec.js'; hitbox_gate=ROOT/'visual-lab/sidebar-hitboxes-v117.mjs'; session_gate=ROOT/'visual-lab/native-menu-session-v118.mjs'; action_race_gate=ROOT/'visual-lab/native-action-races-v119.mjs'; metadata_gate=ROOT/'visual-lab/sidebar-metadata-v118.mjs'; metadata_failure_gate=ROOT/'visual-lab/sidebar-metadata-failure-v119.mjs'; live_gate=ROOT/'visual-lab/live-ui-regressions-v114.mjs'
if not experience.exists(): fail('cross-platform human DOM error UX gate missing')
if not runtime_gate.exists(): fail('real extension runtime gate missing')
if not hitbox_gate.exists(): fail('left-sidebar hitbox gate missing')
if not session_gate.exists(): fail('native menu session cleanup gate missing')
if not action_race_gate.exists(): fail('native action race gate missing')
if not metadata_gate.exists(): fail('sidebar metadata-only gate missing')
if not metadata_failure_gate.exists(): fail('metadata failure barrier gate missing')
if hitbox_gate.exists() and "import('./native-menu-session-v118.mjs')" not in hitbox_gate.read_text(encoding='utf-8'): fail('native menu cleanup gate is not chained into cross-engine sidebar validation')
if session_gate.exists() and "import('./native-action-races-v119.mjs')" not in session_gate.read_text(encoding='utf-8'): fail('native action race gate is not chained into cross-engine menu validation')
if live_gate.exists() and "import('./sidebar-metadata-v118.mjs')" not in live_gate.read_text(encoding='utf-8'): fail('metadata-only gate is not chained into cross-engine live UI validation')
if metadata_gate.exists():
    metadata_gate_text=metadata_gate.read_text(encoding='utf-8')
    for token in ('g-p-two','dom-race-b',"navigator.locks.request('niakgpt-data-mutation-v100'",'metadata sanitation overwrote a later lock-coordinated cache publication',"import('./sidebar-metadata-failure-v119.mjs')"):
        if token not in metadata_gate_text: fail('metadata shared-lock/failure race regression coverage incomplete '+token)
if metadata_failure_gate.exists():
    failure_text=metadata_failure_gate.read_text(encoding='utf-8')
    for token in ('forced_write_failure',"outcome.ready==='error'",'outcome.subscriptions===0','outcome.writes>=2'):
        if token not in failure_text: fail('metadata persistence failure barrier coverage incomplete '+token)
profile_dir=ROOT/'visual-lab/profiles'
for name,mode in (('runtime-cold-v116','cold'),('runtime-warm-v116','warm')):
    p=profile_dir/f'{name}.json'
    if not p.exists(): fail(f'missing saved lab profile {name}'); continue
    try: data=json.loads(p.read_text(encoding='utf-8'))
    except Exception as exc: fail(f'invalid lab profile {name}: {exc}'); continue
    if data.get('name')!=name: fail(f'profile name drift: {name}')
    if data.get('storageLocal',{}).get('niakgpt-lab-profile-v116',{}).get('mode')!=mode: fail(f'profile mode drift: {name}')
    if 'niakgpt-onboarding-v100' not in data.get('storageLocal',{}): fail(f'profile onboarding seed missing: {name}')
if (profile_dir/'runtime-warm-v116.json').exists():
    warm=json.loads((profile_dir/'runtime-warm-v116.json').read_text(encoding='utf-8'))
    if 'niakgpt-v08-cache' not in warm.get('storageLocal',{}): fail('warm profile cache seed missing')
runtime_text=runtime_gate.read_text(encoding='utf-8')
for token in ('NIAKGPT_PROFILE','runtime-cold-v116','PROFILE.storageLocal','saved profile','Project row has two exclusive hitboxes','Chat actions menu is also a real top-layer overlay','atomic chat/action rows'):
    if token not in runtime_text: fail('saved runtime/sidebar UX integration missing '+token)
workflow=(ROOT/'.github/workflows/current-finalization.yml').read_text(encoding='utf-8')
for token in ('ubuntu-latest, windows-latest, macos-latest','chromium, firefox, webkit','Human / DOM / errors / UX / remount / anti-churn','experience-gate-v116.mjs','sidebar-hitboxes-v117.mjs','LEFT SIDEBAR pixel hitboxes','PRIMARY real Brave — left sidebar'):
    if token not in workflow: fail('cross-platform experience matrix missing '+token)
for token in ('PLAYWRIGHT_BROWSERS_PATH','actions/cache@v4','playwright-${{ runner.os }}-${{ matrix.browser }}-1.62.1','homebrew-brave-${{ runner.os }}-${{ runner.arch }}-stable-v1','runtime-cold-v116','runtime-warm-v116'):
    if token not in workflow: fail('lab cache/profile acceleration missing '+token)
if errors:
    print('STATIC_CURRENT_FAIL')
    for e in errors: print('-',e)
    sys.exit(1)
print(f"STATIC_CURRENT_PASS version={manifest['version']} runtime={len(main)+len(isolated)} refs={len(refs)} profiles=2 cached-browsers=on left-sidebar=atomic-top-layer-session-clean single-projects-authority metadata-first serialized-shared-lock-fail-closed-sanitation")
