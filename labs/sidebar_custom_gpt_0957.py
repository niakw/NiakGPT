#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
a=ap.parse_args();root=Path(a.root)
P='g-p-aaaaaaaaaaaaaaaa'

def source(name):
    s=(root/name).read_text(encoding='utf-8')
    return s.replace("if(location.hostname!=='chatgpt.com'||","if(false||").replace("if (location.hostname !== 'chatgpt.com' ||","if (false ||")

html=f'''<!doctype html><html><head><style>
body{{background:#071018;color:white}}nav{{width:320px}}nav a{{display:block;padding:10px;color:white}}
#ng8-pins{{display:block}}.ng107-native-project-row,.ng107-native-project-cluster,.ng107-native-project-label,.ng107-native-project-more{{display:none!important}}
</style></head><body><nav data-testid="conversation-sidebar">
<section id="native-project-zone"><a id="project" href="/g/opaque-current-project"><span>NiakGPT</span></a><button>Afficher plus</button></section>
<a id="custom" href="/g/g-1234567890-custom-helper"><span>Code Helper</span></a>
<section id="ng8-pins"><div class="ng8-pin-list"><a data-ng8-pin="1" href="/g/{P}/project"><span>NiakGPT</span></a></div></section>
</nav><script>
window.__NIAKGPT_CACHE_BUS__={{async get(){{return {{projects:[],chats:[]}}}},async update(v){{return v}},subscribe(){{return()=>{{}}}}}};
window.__NIAKGPT_DIAGNOSTICS__={{set(){{}}}};
window.chrome={{storage:{{local:{{async get(){{return {{}}}},async set(){{}}}}}}}};
</script></body></html>'''

with sync_playwright() as p:
    browser=getattr(p,a.browser).launch(headless=True);page=browser.new_page();errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html);page.add_script_tag(content=source('sidebar-authority-v107.js'));page.wait_for_timeout(220)
    state=page.evaluate('''() => {
      const visible=el=>!!(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
      const project=document.getElementById('project'),custom=document.getElementById('custom');
      return {projectVisible:visible(project),customVisible:visible(custom),projectClass:project.className,projectParentClass:project.parentElement?.className||'',customClass:custom.className};
    }''')
    browser.close()
bad=[]
if state['projectVisible']:bad.append('projectNotHidden')
if not state['customVisible']:bad.append('customGptHidden')
if 'ng107-native-project' in state['customClass']:bad.append('customGptClassifiedAsProject')
if errors:bad.append('pageErrors')
print(json.dumps({'browser':a.browser,'state':state,'errors':errors,'bad':bad}))
if bad:sys.exit(1)
print(f'{a.browser} CUSTOM_GPT_0957_PASS')
