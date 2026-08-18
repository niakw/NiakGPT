#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'));errors=[]
def fail(m):errors.append(m)
def runtime(name):
    text=(ROOT/'background-v100.js').read_text(encoding='utf-8');m=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];",text,re.S)
    if not m:fail(f'missing {name}');return[]
    return re.findall(r"['\"]([^'\"]+\.js)['\"]",m.group(1))
if manifest.get('manifest_version')!=3:fail('manifest_version != 3')
if manifest.get('version')!='0.9.65':fail(f"version={manifest.get('version')}")
if manifest.get('permissions')!=['storage','scripting']:fail('permissions drift')
if manifest.get('host_permissions')!=['https://chatgpt.com/*']:fail('host permissions drift')
main=runtime('MAIN_RUNTIME');isolated=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']:fail(f'MAIN_RUNTIME={main!r}')
required={'sidebar-projects-authority-v112.js','home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js','continuity-v112.js','chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','native-actions-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js'}
missing_runtime=sorted(required-set(isolated))
if missing_runtime:fail('current runtime missing: '+', '.join(missing_runtime))
for forbidden in ('project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js'):
    if forbidden in isolated:fail(f'legacy/conflicting runtime still wired: {forbidden}')
refs=set(main+isolated)
for cs in manifest.get('content_scripts',[]):refs.update(cs.get('js',[]));refs.update(cs.get('css',[]))
refs.add(manifest.get('background',{}).get('service_worker',''));refs.update((manifest.get('icons')or{}).values());refs.update((manifest.get('action',{}).get('default_icon')or{}).values())
missing=sorted(x for x in refs if x and not (ROOT/x).exists())
if missing:fail('missing refs: '+', '.join(missing))
for f in sorted({ROOT/x for x in refs if x.endswith('.js')}):
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode:fail(f'node --check {f.name}: {r.stderr.strip()}')
for f in sorted({ROOT/x for x in refs if x.endswith('.css')}):
    text=f.read_text(encoding='utf-8')
    if text.count('{')!=text.count('}'):fail(f'CSS braces {f.name}')
all_runtime='\n'.join((ROOT/f).read_text(encoding='utf-8') for f in main+isolated)
if 'setInterval(' in '\n'.join((ROOT/f).read_text(encoding='utf-8') for f in isolated if f!='retro-loader-v097.js'):fail('permanent polling in isolated runtime')
if re.search(r'window\.fetch\s*=|globalThis\.fetch\s*=',all_runtime):fail('runtime replaces global fetch')
manifest_text=json.dumps(manifest)
for required_css in ('sidebar-projects-authority-v112.css','home-layout-v112.css','matrix-guardian-v112.css','performance-guard-v112.css','native-da-v112.css','sidebar-icons-v114.css','native-actions-v113.css','chat-attention-v113.css'):
    if required_css not in manifest_text:fail(f'missing CSS {required_css}')
for forbidden_css in ('native-rename-v112.css','sidebar-projects-authority-v111.css','sidebar-projects-authority-v110.css','sidebar-projects-authority-v109.css'):
    if forbidden_css in manifest_text:fail(f'old CSS wired: {forbidden_css}')
perf=(ROOT/'performance-guard-v112.js').read_text(encoding='utf-8')
if 'COLD_KEEP=44' not in perf or 'requestIdleCallback' not in perf:fail('long-thread cold-history budget drift')
deep=(ROOT/'reclassify-deep-v112.js').read_text(encoding='utf-8')
if 'MAX_PER_RUN=2' not in deep or 'MAX_HEAVY=1' not in deep:fail('deep classification budget drift')
actions=(ROOT/'native-actions-v113.js').read_text(encoding='utf-8')
if 'invokeNativeMenu' not in actions or 'fallbackMove' not in actions:fail('native action/fallback move path missing')
state=(ROOT/'chat-state-authority-v113.js').read_text(encoding='utf-8')
if 'iu>pu' not in state or 'iu===pu' not in state:fail('monotonic title authority missing')
bread=(ROOT/'breadcrumb-v113.js').read_text(encoding='utf-8')
if '>Accueil<' not in bread or 'ng100-bc-current' not in bread:fail('canonical linked breadcrumb missing')
att=(ROOT/'chat-attention-v113.js').read_text(encoding='utf-8')
if 'data.ng113Unread' in att:pass
projects=(ROOT/'sidebar-projects-authority-v112.js').read_text(encoding='utf-8')
for token in ('sharesSidebarShell','managedIdentityCount','identityHosts','MutationObserver'):
    if token not in projects:fail('sidebar split-root authority missing '+token)
folders=(ROOT/'pin-folders-v096.js').read_text(encoding='utf-8')
for token in ('drawerDirty','cooperativeNode','existing.previousElementSibling===entry'):
    if token not in folders:fail('pin idle-stability guard missing '+token)
if errors:
    print('STATIC_CURRENT_FAIL');[print('-',e) for e in errors];sys.exit(1)
print(f"STATIC_CURRENT_PASS version={manifest['version']} runtime={len(main)+len(isolated)} refs={len(refs)}")
