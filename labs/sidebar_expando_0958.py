#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
a=ap.parse_args(); root=Path(a.root)


def source(name):
    s=(root/name).read_text(encoding='utf-8')
    return s.replace("if(location.hostname!=='chatgpt.com'||","if(false||").replace("if (location.hostname !== 'chatgpt.com' ||","if (false ||")

css=(root/'sidebar-expando-guard-v108.css').read_text(encoding='utf-8')
html='''<!doctype html><html><head><style>
body{background:#071018;color:white}nav{width:320px}nav a,nav button{display:block}
</style></head><body>
<nav data-testid="conversation-sidebar">
  <div id="native-projects" class="group/sidebar-expando-section mb-[var(--sidebar-expanded-section-margin-bottom)]">
    <div class="group/sidebar-expando-section-header flex items-center justify-between pe-1.5">
      <button aria-expanded="true"><h2 class="__menu-label font-medium" data-no-spacing="true">Projets</h2></button>
    </div>
    <ul>
      <li><div class="group/project-unfurl-row relative"><div role="button" data-sidebar-item="true">MediaLab</div></div></li>
      <li><div class="group/project-unfurl-row relative"><div role="button" data-sidebar-item="true">NiakGPT</div></div></li>
      <li><div class="group/project-unfurl-row relative"><div role="button" data-sidebar-item="true">Films</div></div></li>
      <li><button id="project-more">Afficher plus</button></li>
    </ul>
  </div>
  <div id="custom-gpts" class="group/sidebar-expando-section"><h2>GPTs</h2><a href="/g/g-123456-custom">Code Helper</a></div>
  <div id="recents"><h2>Discussions</h2><a href="/c/chat-1">Chat récent</a><button id="recents-more">Afficher plus</button></div>
  <section id="ng8-pins"><div class="ng8-pin-list"><a data-ng8-pin="1" href="/g/g-p-aaaaaaaaaaaaaaaa/project"><span>NiakGPT</span></a></div></section>
</nav>
<script>window.__NIAKGPT_DIAGNOSTICS__={set(){}};</script>
</body></html>'''

with sync_playwright() as p:
    browser=getattr(p,a.browser).launch(headless=True)
    page=browser.new_page(); errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html)
    page.add_style_tag(content=css)
    page.add_script_tag(content=source('sidebar-expando-guard-v108.js'))
    page.wait_for_timeout(180)
    initial=page.evaluate('''() => ({
      native:getComputedStyle(document.getElementById('native-projects')).display,
      custom:getComputedStyle(document.getElementById('custom-gpts')).display,
      recent:getComputedStyle(document.getElementById('recents')).display,
      recentsMore:getComputedStyle(document.getElementById('recents-more')).display,
      nativeClass:document.getElementById('native-projects').className
    })''')

    page.evaluate("document.getElementById('ng8-pins').remove()")
    page.wait_for_timeout(120)
    fallback=page.evaluate('''() => ({
      native:getComputedStyle(document.getElementById('native-projects')).display,
      nativeClass:document.getElementById('native-projects').className
    })''')

    page.evaluate('''() => {
      const nav=document.querySelector('nav');
      const pins=document.createElement('section');
      pins.id='ng8-pins';
      pins.innerHTML='<a data-ng8-pin="1" href="/g/g-p-bbbbbbbbbbbbbbbb/project"><span>Films</span></a>';
      nav.appendChild(pins);
      const old=document.getElementById('native-projects');
      const clone=old.cloneNode(true); clone.id='native-projects-rerender'; old.replaceWith(clone);
    }''')
    page.wait_for_timeout(160)
    rerender=page.evaluate('''() => ({
      native:getComputedStyle(document.getElementById('native-projects-rerender')).display,
      custom:getComputedStyle(document.getElementById('custom-gpts')).display,
      recent:getComputedStyle(document.getElementById('recents')).display,
      recentsMore:getComputedStyle(document.getElementById('recents-more')).display
    })''')
    browser.close()

bad=[]
if initial['native']!='none': bad.append('nativeProjectExpandoVisible')
if initial['custom']=='none': bad.append('customGptExpandoHidden')
if initial['recent']=='none' or initial['recentsMore']=='none': bad.append('recentsHidden')
if 'ng108-native-project-expando' not in initial['nativeClass']: bad.append('markerMissing')
if fallback['native']=='none': bad.append('nativeFallbackMissing')
if 'ng108-native-project-expando' in fallback['nativeClass']: bad.append('fallbackMarkerStuck')
if rerender['native']!='none': bad.append('rerenderedNativeProjectsVisible')
if rerender['custom']=='none' or rerender['recent']=='none' or rerender['recentsMore']=='none': bad.append('rerenderCollateral')
if errors: bad.append('pageErrors')
print(json.dumps({'browser':a.browser,'initial':initial,'fallback':fallback,'rerender':rerender,'errors':errors,'bad':bad},ensure_ascii=False))
if bad: sys.exit(1)
print(f'{a.browser} SIDEBAR_EXPANDO_0958_PASS')
