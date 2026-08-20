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
if manifest.get('version')!='0.9.70': fail(f"version={manifest.get('version')}")
if manifest.get('permissions')!=['storage','scripting']: fail('permissions drift')
if manifest.get('host_permissions')!=['https://chatgpt.com/*']: fail('host permissions drift')

main=runtime('MAIN_RUNTIME')
isolated=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
required={
    'sidebar-metadata-v118.js','sidebar-projects-authority-v112.js','sidebar-projects-v121.js','sidebar-ux-v119.js','pin-folders-v096.js','app-v090.js','sidebar-actions-v123.js',
    'home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js','continuity-v112.js',
    'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','interruption-guard-v119.js'
}
missing_runtime=sorted(required-set(isolated))
if missing_runtime: fail('current runtime missing: '+', '.join(missing_runtime))
for forbidden in ('project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','native-actions-controller-v119.js','native-actions-v113.js'):
    if forbidden in isolated: fail(f'legacy/conflicting runtime wired: {forbidden}')

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

# The Node validator owns the detailed architecture invariants. Keeping a single
# authoritative contract prevents release validators from drifting independently.
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
for token in ('continueFrom?.(chatId)',r'failed\s+to\s+fetch'):
    if token not in interrupt: fail('interruption recovery incomplete '+token)

for gate in ('visual-lab/sidebar-session-ux-v123.mjs','visual-lab/tests/sidebar-human-ux-v123.spec.js'):
    if not (ROOT/gate).exists(): fail('current human UX gate missing '+gate)
workflow=read('.github/workflows/current-finalization.yml')
for token in ('sidebar-session-ux-v123.mjs','sidebar-human-ux-v123.spec.js','PRIMARY real Brave — FULL human sidebar','mcr.microsoft.com/playwright:v1.62.1-noble'):
    if token not in workflow: fail('Current Finalization missing '+token)
if re.search(r'^\s*npx playwright install --with-deps\b',workflow,re.M): fail('Linux Finalization reintroduced apt --with-deps')

package_tool=read('tools/package-extension.mjs')
for token in ('sidebar-actions-v123.js','sidebar-actions-v123.css','native-actions-controller-v119.js','native-actions-v113.js'):
    if token not in package_tool: fail('package runtime policy missing '+token)

if errors:
    print('STATIC_CURRENT_FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('STATIC_CURRENT_PASS')
