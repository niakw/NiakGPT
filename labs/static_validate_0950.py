#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/niakgpt-0950-work').resolve()
errors=[]
def fail(x): errors.append(x)
manifest=json.loads((ROOT/'manifest.json').read_text())
if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if manifest.get('version')!='0.9.50': fail(f"version={manifest.get('version')}")
js=sorted(ROOT.glob('*.js')); css=sorted(ROOT.glob('*.css'))
if len(js)!=31: fail(f'JS count {len(js)} != 31')
if len(css)!=17: fail(f'CSS count {len(css)} != 17')
for f in js:
 r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
 if r.returncode: fail(f'node --check {f.name}: {r.stderr.strip()}')
for f in css:
 t=f.read_text()
 if t.count('{')!=t.count('}'): fail(f'CSS braces {f.name}')

def runtime(name):
 t=(ROOT/'background-v100.js').read_text();m=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];",t,re.S)
 if not m: fail(f'missing {name}'); return []
 return re.findall(r"['\"]([^'\"]+\.js)['\"]",m.group(1))
main=runtime('MAIN_RUNTIME'); iso=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
refs=set(main+iso)
for cs in manifest.get('content_scripts',[]): refs.update(cs.get('js',[]));refs.update(cs.get('css',[]))
if manifest.get('background',{}).get('service_worker'): refs.add(manifest['background']['service_worker'])
refs.update(manifest.get('action',{}).get('default_icon',{}).values());refs.update(manifest.get('icons',{}).values())
missing=sorted(x for x in refs if not (ROOT/x).exists())
if missing: fail('missing refs: '+','.join(missing))
if len(refs)!=52: fail(f'refs {len(refs)} != 52')
alljs='\n'.join(f.read_text() for f in js)
if re.search(r'window\.fetch\s*=|globalThis\.fetch\s*=',alljs): fail('fetch assignment')
if 'conversation_detail_get_disabled' not in (ROOT/'page-bridge.js').read_text(): fail('conversation GET guard missing')
for f in css:
 if 'content-visibility' in f.read_text(): fail(f'content-visibility in {f.name}')
interval=[f.name for f in js if 'setInterval' in f.read_text()]
if interval!=['retro-loader-v097.js']: fail(f'setInterval files {interval}')
# 0.9.50 UI invariants
sp=(ROOT/'side-panels-v096.css').read_text();app=(ROOT/'app-v090.js').read_text();core=(ROOT/'core-v090.css').read_text()
for needle in ['width:min(320px','position:fixed!important','right:var(--ng8-rail,46px)']:
 if needle not in sp: fail('side panel invariant missing '+needle)
if 'ng8-native-projects-suppressed' not in app or 'ng8-native-projects-suppressed' not in core: fail('native project duplicate suppression missing')
if 'data-ng8-title-duplicate' not in app or 'data-ng8-title-duplicate' not in core: fail('chat title dedupe missing')
if errors:
 print('STATIC_FAIL');[print('-',e) for e in errors];sys.exit(1)
print(f'STATIC_PASS version=0.9.50 js={len(js)} css={len(css)} refs={len(refs)}')
