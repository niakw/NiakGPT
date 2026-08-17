#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
ap.add_argument('--executable',default=None)
a=ap.parse_args();root=Path(a.root)

def source(name):
    s=(root/name).read_text(encoding='utf-8')
    s=s.replace("if(location.hostname!=='chatgpt.com'||", "if(false||")
    s=s.replace("if (location.hostname !== 'chatgpt.com' ||", "if (false ||")
    return s

fixture='''<!doctype html><html><body><nav data-testid="conversation-sidebar"></nav><main><form><div id="prompt-textarea" contenteditable="true"></div><button aria-label="Envoyer" type="button">Envoyer</button></form></main><div id="ng8-status"></div><script>
window.__rawChannels=[];window.__nativePostAfterClose=0;window.__invalidStorage=false;
class RawBC extends EventTarget {constructor(name){super();this.name=name;this.closed=false;window.__rawChannels.push(this)}postMessage(data){if(this.closed){window.__nativePostAfterClose++;throw new DOMException('Channel is closed','InvalidStateError')}this.last=data}close(){this.closed=true}}
window.BroadcastChannel=RawBC;
const listeners=[];const data={};
window.chrome={runtime:{id:'test-extension',getManifest:()=>({version:'0.9.54'})},storage:{local:{get:async keys=>{if(window.__invalidStorage)throw new Error('Extension context invalidated.');if(typeof keys==='string')return {[keys]:data[keys]};if(Array.isArray(keys)){const o={};for(const k of keys)o[k]=data[k];return o}return {...data}},set:async obj=>{await new Promise(r=>setTimeout(r,15));if(window.__invalidStorage)throw new Error('Extension context invalidated.');Object.assign(data,obj)}},onChanged:{addListener:fn=>listeners.push(fn)}}};
try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async()=>{throw new DOMException('Document is not active','InvalidStateError')}}})}catch{}
</script></body></html>'''

with sync_playwright() as p:
    bt=getattr(p,a.browser);kwargs={'headless':True}
    if a.executable: kwargs['executable_path']=a.executable
    browser=bt.launch(**kwargs);page=browser.new_page()
    logs=[];pageerrors=[]
    page.on('console',lambda m: logs.append(f'{m.type}:{m.text}') if m.type in ('warning','error') else None)
    page.on('pageerror',lambda e:pageerrors.append(str(e)))
    page.set_content(fixture,wait_until='domcontentloaded')
    for name in ['browser-compat-v102.js','lifecycle-guard-v104.js','cache-bus-v096.js','multitab-v090.js','project-governance-v090.js','activity-ui-v097.js']:
        page.add_script_tag(content=source(name))
    page.wait_for_timeout(350)
    probe=page.evaluate('''() => {const c=new BroadcastChannel('closed-probe');c.close();let threw=false;try{c.postMessage({x:1})}catch(e){threw=true}return {threw,rawAfterClose:window.__nativePostAfterClose}}''')
    page.evaluate('''() => {window.__lateWrite=window.__NIAKGPT_CACHE_BUS__.update(x=>({...(x||{}),probe:Date.now()}));setTimeout(()=>{window.__invalidStorage=true;chrome.runtime.id=''},1)}''')
    page.wait_for_timeout(70)
    page.evaluate('''() => {window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));}''')
    page.wait_for_timeout(80)
    state=page.evaluate('''() => ({rawAfterClose:window.__nativePostAfterClose,channels:window.__rawChannels.map(x=>({name:x.name,closed:x.closed})),cacheActive:window.__NIAKGPT_CACHE_BUS__?.active?.(),tabRole:document.documentElement.dataset.ng8TabRole||''})''')
    browser.close()

alltext='\n'.join(logs+pageerrors)
forbidden=['[NiakGPT cache bus write]','[NiakGPT multitab] lock','Failed to execute \'postMessage\' on \'BroadcastChannel\'','Channel is closed']
bad=[x for x in forbidden if x.lower() in alltext.lower()]
if probe['threw'] or probe['rawAfterClose'] or state['rawAfterClose']: bad.append('raw-post-after-close')
print(json.dumps({'browser':a.browser,'probe':probe,'state':state,'logs':logs,'pageerrors':pageerrors,'bad':bad},ensure_ascii=False))
if bad or pageerrors:
    print('FAIL '+','.join(bad or ['pageerror']),file=sys.stderr);sys.exit(1)
print(f'{a.browser} LIFECYCLE_0954_PASS')
