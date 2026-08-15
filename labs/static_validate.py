#!/usr/bin/env python3
from pathlib import Path
import json, re, subprocess, sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
errors=[]

def fail(msg): errors.append(msg)

def parse_runtime(name):
    text=(ROOT/'background-v100.js').read_text(encoding='utf-8')
    m=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];", text, re.S)
    if not m: fail(f'missing {name}'); return []
    return re.findall(r"['\"]([^'\"]+\.js)['\"]",m.group(1))

js=sorted(ROOT.glob('*.js'))
css=sorted(ROOT.glob('*.css'))
if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if manifest.get('version')!='0.9.49': fail(f"version={manifest.get('version')}")
if len(js)!=31: fail(f'JS count {len(js)} != 31')
if len(css)!=17: fail(f'CSS count {len(css)} != 17')

for f in js:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode: fail(f'node --check {f.name}: {r.stderr.strip()}')
for f in css:
    text=f.read_text(encoding='utf-8')
    if text.count('{')!=text.count('}'): fail(f'CSS braces {f.name}')

main=parse_runtime('MAIN_RUNTIME')
isolated=parse_runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
for forbidden in ('hotcache-main-v084.js','activity-main-v087.js'):
    if (ROOT/forbidden).exists(): fail(f'legacy MAIN runtime present: {forbidden}')

refs=set(main+isolated)
for cs in manifest.get('content_scripts',[]): refs.update(cs.get('js',[])); refs.update(cs.get('css',[]))
if manifest.get('background',{}).get('service_worker'): refs.add(manifest['background']['service_worker'])
action=manifest.get('action',{}).get('default_icon',{})
icons=manifest.get('icons',{})
refs.update(action.values()); refs.update(icons.values())
missing=sorted(x for x in refs if not (ROOT/x).exists())
if missing: fail('missing refs: '+', '.join(missing))
if len(refs)!=52: fail(f'unique runtime/assets refs {len(refs)} != 52')

alljs='\n'.join(f.read_text(encoding='utf-8') for f in js)
if re.search(r'window\.fetch\s*=|globalThis\.fetch\s*=',alljs): fail('runtime assigns window/globalThis.fetch')
bridge=(ROOT/'page-bridge.js').read_text(encoding='utf-8')
if 'conversation_detail_get_disabled' not in bridge: fail('bridge conversation GET guard missing')

for f in js:
    text=f.read_text(encoding='utf-8')
    for m in re.finditer(r'/backend-api/conversation/', text):
        window=text[max(0,m.start()-220):m.start()+380]
        if re.search(r"method\s*:\s*['\"]GET['\"]",window): fail(f'conversation detail GET suspect in {f.name}')

for f in css:
    if 'content-visibility' in f.read_text(encoding='utf-8'): fail(f'content-visibility in {f.name}')

intervals=[]
for f in js:
    if 'setInterval' in f.read_text(encoding='utf-8'): intervals.append(f.name)
if intervals!=['retro-loader-v097.js']: fail(f'setInterval files={intervals!r}')

if errors:
    print('STATIC_FAIL')
    for e in errors: print('-',e)
    sys.exit(1)
print(f'STATIC_PASS version=0.9.49 js={len(js)} css={len(css)} refs={len(refs)} files={sum(1 for p in ROOT.rglob("*") if p.is_file())}')
