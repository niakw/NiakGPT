#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/niakgpt-0951-work').resolve()
errors=[]
def fail(x): errors.append(x)
manifest=json.loads((ROOT/'manifest.json').read_text())
if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if manifest.get('version')!='0.9.51': fail(f"version={manifest.get('version')}")
js=sorted(ROOT.glob('*.js'));css=sorted(ROOT.glob('*.css'))
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
 if not m: fail(f'missing {name}');return []
 return re.findall(r"['\"]([^'\"]+\.js)['\"]",m.group(1))
main=runtime('MAIN_RUNTIME');iso=runtime('ISOLATED_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
refs=set(main+iso)
for cs in manifest.get('content_scripts',[]):refs.update(cs.get('js',[]));refs.update(cs.get('css',[]))
if manifest.get('background',{}).get('service_worker'):refs.add(manifest['background']['service_worker'])
refs.update(manifest.get('action',{}).get('default_icon',{}).values());refs.update(manifest.get('icons',{}).values())
missing=sorted(x for x in refs if not (ROOT/x).exists())
if missing: fail('missing refs: '+','.join(missing))
if len(refs)!=52: fail(f'refs {len(refs)} != 52')
alljs='\n'.join(f.read_text() for f in js)
if '/backend-api/f/conversation/resume' in alljs or 'conversation/resume' in alljs: fail('native conversation resume route referenced')
if re.search(r'window\.fetch\s*=|globalThis\.fetch\s*=',alljs): fail('fetch assignment')
bridge=(ROOT/'page-bridge.js').read_text()
for n in ['conversation_detail_get_disabled','native_busy','bridge-pause']:
 if n not in bridge: fail('bridge invariant missing '+n)
app=(ROOT/'app-v090.js').read_text();core=(ROOT/'core-v090.css').read_text();act=(ROOT/'activity-ui-v097.js').read_text();idx=(ROOT/'server-index-v100.js').read_text()
for n in ['ng8-native-project-link-suppressed','ng8-native-project-label-suppressed']:
 if n not in app or n not in core: fail('project dedupe invariant missing '+n)
if "activeObserver.observe(root,{childList:true,subtree:true,characterData:true})" in act: fail('whole-main characterData observer still present')
if "activeObserver.observe(root,{childList:true,subtree:true})" not in act: fail('structural root observer missing')
if "activeAssistantObserver.observe(assistant,{childList:true,subtree:true,characterData:true})" not in act: fail('assistant-scoped streaming observer missing')
if 'ng105Verification' not in idx or 'nativeBusy' not in idx: fail('server-index native busy guard missing')
if errors:
 print('STATIC_FAIL');[print('-',e) for e in errors];sys.exit(1)
print(f'STATIC_PASS version=0.9.51 js={len(js)} css={len(css)} refs={len(refs)} resume_route=absent')
