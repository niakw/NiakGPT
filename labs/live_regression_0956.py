#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
ap.add_argument('--screenshot',default=None)
a=ap.parse_args()
root=Path(a.root)

P1='g-p-aaaaaaaaaaaaaaaa'
P2='g-p-bbbbbbbbbbbbbbbb'
C1='11111111-1111-4111-8111-111111111111'
C2='22222222-2222-4222-8222-222222222222'

def source(name):
    s=(root/name).read_text(encoding='utf-8')
    s=s.replace("if(location.hostname!=='chatgpt.com'||", "if(false||")
    s=s.replace("if (location.hostname !== 'chatgpt.com' ||", "if (false ||")
    return s

html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box}}html,body{{margin:0;width:100%;min-height:100%;background:#071018;color:#dce7f1;font-family:Arial,sans-serif}}
nav[data-testid="conversation-sidebar"]{{width:310px;min-height:900px;padding:16px 9px;background:#08131d}}
.native-zone{{display:flex;flex-direction:column;gap:2px;padding:8px 0 14px;border-bottom:1px solid #233342}}
.native-zone a,.native-zone button{{display:block;padding:8px;color:#d4dee7;background:transparent;border:0;text-align:left;text-decoration:none}}
#ng8-pins{{display:block;margin-top:18px;padding:5px;border:1px solid #2b91a9}}
#ng8-pins .ng8-pin-head{{display:flex;align-items:center;justify-content:space-between;min-height:28px;padding:0 5px;font:800 10px/1 Consolas,monospace;letter-spacing:.08em}}
#ng8-pins .ng8-pin-list>a{{display:grid;grid-template-columns:22px minmax(0,1fr) 70px;align-items:center;gap:5px;padding:7px;color:#dce7f1;text-decoration:none}}
#ng100-breadcrumb{{position:fixed;left:380px;top:20px;display:flex;gap:8px;padding:8px 12px;border:1px solid #33495a;background:#0b151e}}
#ng100-breadcrumb a{{color:#a6d9ef;text-decoration:none}}
#ng8-status{{position:fixed;left:0;right:0;bottom:0;height:28px;display:flex;align-items:center;gap:14px;padding:0 10px;background:#0784be;color:white}}
</style></head><body>
<nav data-testid="conversation-sidebar">
  <section class="native-zone" id="native-projects">
    <span id="native-project-label">Projects</span>
    <a id="native-p1" href="/g/{P1}/project">NiakGPT</a>
    <a id="native-p2" href="/g/{P2}/project">NiakVIO</a>
    <a id="native-c1" href="/g/{P1}/c/{C1}">Mise à jour NiakGPT</a>
    <button id="native-more">Afficher plus</button>
  </section>
  <section id="ng8-pins">
    <div class="ng8-pin-head"><span>PROJECTS</span><b>2</b></div>
    <div class="ng8-pin-list">
      <a data-ng8-pin="1" href="/g/{P1}/project" style="--ng-project:#4fc1ff"><i>▤</i><span>NiakGPT</span><small>17/08 [2]</small></a>
      <a data-ng8-pin="1" href="/g/{P2}/project" style="--ng-project:#4ec9b0"><i>▤</i><span>NiakVIO</span><small>17/08 [1]</small></a>
    </div>
  </section>
</nav>
<nav id="ng100-breadcrumb" aria-label="Fil d’Ariane NiakGPT"><a>NiakGPT</a><span>›</span><a class="ng100-bc-project" href="/g/{P1}/project">NiakGPT</a><span>›</span><span class="ng100-bc-current">Mise à jour NiakGPT</span></nav>
<div id="ng8-status"><b>NiakGPT 0.9.56</b><span class="ng8-status-project">Hors projet</span></div>
<script>
window.__labCacheSubscribers=[];
window.__NIAKGPT_CACHE_BUS__={{subscribe(fn){{window.__labCacheSubscribers.push(fn);return()=>{{}};}}}};
window.__NIAKGPT_DIAGNOSTICS__={{set(){{}}}};
</script>
</body></html>'''

cache={
  'projects':[
    {'id':P1,'name':'NiakGPT','href':f'/g/{P1}/project'},
    {'id':P2,'name':'NiakVIO','href':f'/g/{P2}/project'},
  ],
  'chats':[
    {'id':C1,'title':'Mise à jour NiakGPT','projectId':P1,'updated':1786942800000},
    {'id':C2,'title':'Deuxième discussion','projectId':P1,'updated':1786856400000},
  ],
  'counts':{P1:2,P2:0},
  'projectChats':{}
}

with sync_playwright() as p:
    browser=getattr(p,a.browser).launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e: errors.append('PAGE:'+str(e)))
    page.on('console',lambda m: errors.append(f'CONSOLE:{m.type}:{m.text}') if m.type in ('error','warning') else None)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(root/'core-v090.css').read_text(encoding='utf-8')+'\n'+(root/'live-fixes-v104.css').read_text(encoding='utf-8')+'\n'+(root/'pin-folders-v096.css').read_text(encoding='utf-8'))
    # Exact relative production order for the modules involved in this regression.
    for f in ['live-fixes-v104.js','live-fixes-v106.js','pin-folders-v096.js','project-links-v106.js']:
        page.add_script_tag(content=source(f))
    page.evaluate('(raw)=>window.__labCacheSubscribers.forEach(fn=>fn(raw))',cache)
    page.wait_for_timeout(500)

    before=page.evaluate('''() => {
      const native=[...document.querySelectorAll('#native-projects a[href*="/g/g-p-"]')];
      const home=document.querySelector('#ng8-pins .ng106-projects-home');
      return {
        nativeHidden:native.every(x=>getComputedStyle(x).display==='none'),
        labelHidden:getComputedStyle(document.getElementById('native-project-label')).display==='none',
        status:document.querySelector('#ng8-status .ng8-status-project')?.textContent?.trim(),
        homeTag:home?.tagName||'',homeHref:home?.getAttribute('href')||'',
      };
    }''')

    page.locator(f'#ng8-pins a[data-ng8-pin][href*="{P1}"]').click()
    page.wait_for_timeout(180)
    drawer=page.evaluate('''() => {
      const link=document.querySelector('.ng96-folder-list > a[data-chat]');
      if(!link)return {exists:false};
      const contextEvent=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});
      link.dispatchEvent(contextEvent);
      const ctrlEvent=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true});
      link.dispatchEvent(ctrlEvent);
      return {
        exists:true,tag:link.tagName,href:link.getAttribute('href')||'',
        contextPrevented:contextEvent.defaultPrevented,modifiedPrevented:ctrlEvent.defaultPrevented
      };
    }''')

    # Reproduce the real 0.9.55 race: app-v090 removes suppression classes after
    # live-fixes-v104 has already hidden the native Project rows.
    page.evaluate('''() => {
      document.querySelectorAll('#native-projects *').forEach(el=>el.classList.remove(
        'ng8-native-projects-suppressed','ng8-native-project-link-suppressed',
        'ng8-native-project-chat-suppressed','ng8-native-project-label-suppressed',
        'ng8-native-project-more-suppressed'));
    }''')
    page.wait_for_timeout(180)
    race=page.evaluate('''() => ({
      hidden:[...document.querySelectorAll('#native-projects a[href*="/g/g-p-"]')].every(x=>getComputedStyle(x).display==='none'),
      labelHidden:getComputedStyle(document.getElementById('native-project-label')).display==='none'
    })''')

    if a.screenshot:
      Path(a.screenshot).parent.mkdir(parents=True,exist_ok=True)
      page.screenshot(path=a.screenshot,full_page=True)

    # Managed block disappears: native Projects must immediately become the fallback.
    page.evaluate("document.getElementById('ng8-pins').remove()")
    page.wait_for_timeout(220)
    fallback=page.evaluate('''() => ({
      visible:[...document.querySelectorAll('#native-projects a[href*="/g/g-p-"]')].every(x=>getComputedStyle(x).display!=='none'),
      labelVisible:getComputedStyle(document.getElementById('native-project-label')).display!=='none'
    })''')
    browser.close()

bad=[]
if not before['nativeHidden']: bad.append('initialNativeHidden')
if not before['labelHidden']: bad.append('initialLabelHidden')
if before['status']!='NiakGPT': bad.append('statusProject')
if before['homeTag']!='A' or before['homeHref']!='/projects': bad.append('projectsHomeLink')
if not drawer.get('exists'): bad.append('drawerMissing')
else:
    if drawer.get('tag')!='A': bad.append('drawerNotAnchor')
    if drawer.get('href')!=f'/g/{P1}/c/{C1}': bad.append('drawerHref')
    if drawer.get('contextPrevented'): bad.append('contextMenuPrevented')
    if drawer.get('modifiedPrevented'): bad.append('modifiedClickPrevented')
if not race['hidden'] or not race['labelHidden']: bad.append('suppressionRace')
if not fallback['visible'] or not fallback['labelVisible']: bad.append('nativeFallback')
if errors: bad.append('consoleErrors')

result={'browser':a.browser,'before':before,'drawer':drawer,'race':race,'fallback':fallback,'errors':errors,'bad':bad}
print(json.dumps(result,ensure_ascii=False))
if bad:
    print('FAIL '+','.join(bad),file=sys.stderr)
    sys.exit(1)
print(f'{a.browser} LIVE_0956_PASS')
