#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
errors=[]

def fail(message):
    errors.append(str(message))

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def runtime(name):
    text=read('background-v100.js')
    match=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];",text,re.S)
    if not match:
        fail(f'missing {name}')
        return []
    return re.findall(r"['\"]([^'\"]+\.js)['\"]",match.group(1))

manifest=json.loads(read('manifest.json'))
if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if manifest.get('version')!='0.9.77': fail(f"version={manifest.get('version')}")
if manifest.get('permissions')!=['storage','scripting']: fail('permissions drift')
if manifest.get('host_permissions')!=['https://chatgpt.com/*']: fail('host permissions drift')
static_js=[file for cs in manifest.get('content_scripts',[]) for file in cs.get('js',[])]
expected_static=[
    'ux-v131.js','boot-gate-v100.js','composer-continuation-v128.js','long-run-watchdog-v129.js',
    'pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js'
]
if static_js!=expected_static: fail(f'static runtime drift: {static_js!r}')
css_runtime=[file for cs in manifest.get('content_scripts',[]) for file in cs.get('css',[])]
if 'ux-v131.css' not in css_runtime: fail('v131 visual authority missing from manifest')

main=runtime('MAIN_RUNTIME')
isolated=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
required={
    'sidebar-metadata-v118.js','sidebar-projects-authority-v112.js','sidebar-projects-v121.js','sidebar-ux-v119.js','pin-folders-v096.js','app-v090.js','sidebar-actions-v123.js',
    'home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js','continuity-v112.js',
    'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','interruption-guard-v119.js','ux-v131.js'
}
missing_runtime=sorted(required-set(isolated))
if missing_runtime: fail('current runtime missing: '+', '.join(missing_runtime))
if isolated and isolated[-1]!='ux-v131.js': fail('v131 UX reconciler must be the final isolated runtime authority')
for forbidden in (
    'project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js',
    'native-actions-controller-v119.js','native-actions-v113.js','composer-continuation-v128.js','long-run-watchdog-v129.js',
    'pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js'
):
    if forbidden in isolated: fail(f'legacy/conflicting runtime wired: {forbidden}')

recovery_overlays=(
    'native-ux-v125.js','native-ux-v126.js','continuity-limit-v125.js','continuity-live-v126.js',
    'sidebar-route-placement-v125.js','sidebar-truth-v127.js','native-ux-v125.css','native-ux-v126.css','sidebar-truth-v127.css','assets/mascot-v125.svg'
)
for file in recovery_overlays:
    if file in isolated: fail(f'0.9.71-0.9.73 recovery overlay wired: {file}')
    if (ROOT/file).exists(): fail(f'0.9.71-0.9.73 recovery overlay still shipped: {file}')

refs=set(main+isolated)
for cs in manifest.get('content_scripts',[]):
    refs.update(cs.get('js',[]))
    refs.update(cs.get('css',[]))
refs.add(manifest.get('background',{}).get('service_worker',''))
refs.update((manifest.get('icons') or {}).values())
refs.update((manifest.get('action',{}).get('default_icon') or {}).values())
missing=sorted(x for x in refs if x and not (ROOT/x).exists())
if missing: fail('missing refs: '+', '.join(missing))

for file in sorted(x for x in refs if x.endswith('.js')):
    result=subprocess.run(['node','--check',str(ROOT/file)],capture_output=True,text=True)
    if result.returncode: fail(f'node --check {file}: {result.stderr.strip()}')
for file in sorted(x for x in refs if x.endswith('.css')):
    text=read(file)
    if text.count('{')!=text.count('}'): fail(f'CSS braces {file}')

hydration=subprocess.run(['node','tools/check-hydration-v100.mjs'],cwd=ROOT,capture_output=True,text=True)
if hydration.returncode:
    fail('hydration invariants: '+(hydration.stderr.strip() or hydration.stdout.strip()))

actions=read('sidebar-actions-v123.js')
for token in ('ng123-action-menu','ng123-rename-dialog','dataset.ng123Action','dataset.ng123Id','openMenu','renameChat','moveChat','nativeProjectRename','stopImmediatePropagation'):
    if token not in actions: fail('single-owner sidebar actions incomplete '+token)

catalog=read('sidebar-projects-v121.js')
for token in ('sessionOrder','armBootstrap','projectScrollMemory','niakgpt:sidebar-projects-reconcile'):
    if token not in catalog: fail('session-stable Projects catalog incomplete '+token)
folders=read('pin-folders-v096.js')
for token in ('drawerScrollMemory','innerScroll','outerScroll','niakgpt:hydrate-project'):
    if token not in folders: fail('drawer scroll/hydration continuity incomplete '+token)
interrupt=read('interruption-guard-v119.js')
for token in ('continueFrom?.(chatId)',r'failed\s+to\s+fetch','persistedIncident','allowedType','type:allowedType'):
    if token not in interrupt: fail('interruption recovery/security incomplete '+token)

parallel=read('composer-continuation-v128.js')
for token in ('↳ Suite en parallèle','LEGACY_HEADER','waiting','thinking','executing','nativeGenerationBusy','idleTriggerUntil','CANCEL_RX','prepareParallelContinuation','niakgpt:parallel-continue','isContentEditable','execCommand'):
    if token not in parallel: fail('parallel continuation incomplete '+token)
if 'setInterval(' in parallel: fail('parallel continuation must remain event-driven')

watchdog=read('long-run-watchdog-v129.js')
for token in ('DEFAULT_SEGMENT_MS','6*60*1000+30*1000','↻ Reprise NiakGPT','LEGACY_MARKER','AUTO_RX','nativeStop','draft-protected','attemptResume','niakgpt:long-run-resume','CANCEL_RX'):
    if token not in watchdog: fail('long-run watchdog incomplete '+token)
if 'setInterval(' in watchdog: fail('long-run watchdog must use bounded timers, not polling intervals')

ux=read('ux-v131.js')
for token in ('findSidebar','score(el)','repairPins','dataset.ng131Mounted','nativeProjectSection','dataset.ng131Surface','enhanceA11y','__NIAKGPT_FIND_SIDEBAR_V131__'):
    if token not in ux: fail('v131 UX reconciler incomplete '+token)
ux_css=read('ux-v131.css')
for token in ('#ng8-pins:not([data-ng131-mounted="1"])','body.ng8-ready{padding-right:0!important;padding-bottom:0!important}','#ng8-status{','#ng8-rail{','.ng131-coach-detail[hidden]'):
    if token not in ux_css: fail('v131 UX visual authority incomplete '+token)

rescue=read('pin-interaction-rescue-v129.js')
for token in ('pointerdown','pointerup','replacementAction','clickSeen','fallback'):
    if token not in rescue: fail('pin interaction rescue incomplete '+token)
menu=read('project-menu-augment-v129.js')
for token in ('Personnaliser le Project','Nouveau chat dans ce Project','ng129-project-context','openProjectSettings'):
    if token not in menu: fail('Project menu augmentation incomplete '+token)
handoff=read('continuity-native-handoff-v129.js')
for token in ('nativeLimitControl','CONTINUITÉ NIAKGPT','markCurrentOut','writePending','finishProjectLock','sendButton'):
    if token not in handoff: fail('native continuity handoff incomplete '+token)

for gate in (
    'visual-lab/sidebar-session-ux-v123.mjs','visual-lab/tests/sidebar-human-ux-v123.spec.js',
    'visual-lab/parallel-continue-v128.mjs','visual-lab/tests/composer-continuation-runtime-v128.spec.js',
    'visual-lab/tests/live-stability-v129.spec.js','visual-lab/ux-integral-v131.mjs'
):
    if not (ROOT/gate).exists(): fail('current browser-fixture UX gate missing '+gate)
workflow=read('.github/workflows/current-finalization.yml')
for token in ('sidebar-session-ux-v123.mjs','sidebar-human-ux-v123.spec.js','PRIMARY real Brave — FULL human sidebar','mcr.microsoft.com/playwright:v1.62.1-noble'):
    if token not in workflow: fail('Current Finalization missing '+token)
if re.search(r'^\s*npx playwright install --with-deps\b',workflow,re.M): fail('Linux Finalization reintroduced apt --with-deps')
parallel_workflow=read('.github/workflows/parallel-continuation-v128.yml')
for token in ('parallel-continue-v128.mjs','composer-continuation-runtime-v128.spec.js','chromium, firefox, webkit','parallel-continuation-v128'):
    if token not in parallel_workflow: fail('Parallel continuation workflow missing '+token)
live_workflow=read('.github/workflows/live-stability-v129.yml')
for token in ('live-stability-v129.spec.js','Brave stable','chromium'):
    if token not in live_workflow: fail('Live stability workflow missing '+token)
ux_workflow=read('.github/workflows/ux-integral-v131.yml')
for token in ('ux-integral-v131.mjs','chromium, firefox, webkit','screenshot UX','mcr.microsoft.com/playwright:v1.62.1-noble'):
    if token not in ux_workflow: fail('UX integral v131 workflow missing '+token)

package_tool=read('tools/package-extension.mjs')
for token in (
    'sidebar-actions-v123.js','sidebar-actions-v123.css','native-actions-controller-v119.js','native-actions-v113.js','composer-continuation-v128.js',
    'long-run-watchdog-v129.js','pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js','live-stability-v129.css',
    'ux-v131.js','ux-v131.css'
):
    if token not in package_tool: fail('package runtime policy missing '+token)

if not (ROOT/'TESTING_TRUTH.md').exists(): fail('testing truth contract missing')
if errors:
    print('STATIC_CURRENT_FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('STATIC_CURRENT_PASS')
