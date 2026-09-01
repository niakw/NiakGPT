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
P3='g-p-cccccccccccccccc'
P4='g-p-dddddddddddddddd'
P5='g-p-eeeeeeeeeeeeeeee'
C1='11111111-1111-4111-8111-111111111111'
C2='22222222-2222-4222-8222-222222222222'
BAD='dom-p-date1708'

def source(name):
    s=(root/name).read_text(encoding='utf-8')
    s=s.replace("if(location.hostname!=='chatgpt.com'||", "if(false||")
    s=s.replace("if (location.hostname !== 'chatgpt.com' ||", "if (false ||")
    return s

html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box}}html,body{{margin:0;background:#071018;color:#dce7f1;font-family:Arial,sans-serif}}
nav[data-testid="conversation-sidebar"]{{width:310px;min-height:950px;padding:12px 8px;background:#08131d}}
.native-project-cluster,.recents{{display:flex;flex-direction:column;gap:3px;padding:8px 0}}
.native-project-cluster a,.native-project-cluster button,.recents a,.recents button{{display:flex;align-items:center;gap:8px;min-height:40px;padding:7px 10px;border:0;background:transparent;color:#d5e0e9;text-decoration:none;text-align:left}}
.native-project-cluster .folder{{font-size:18px}}.native-project-cluster button,.recents button{{color:#8295a8}}
#ng8-pins{{display:block;margin:12px 0;padding:5px;border:1px solid #2b91a9}}
#ng8-pins .ng8-pin-head{{display:flex;justify-content:space-between;padding:6px;font:800 10px Consolas,monospace}}
#ng8-pins .ng8-pin-list>a{{display:grid;grid-template-columns:22px minmax(0,1fr) 72px;gap:5px;padding:7px;color:#dce7f1;text-decoration:none}}
.ng8-chat-date{{padding:2px 4px;border:1px solid #263646;border-radius:4px;color:#91a4b5}}
.ng8-chat-project{{padding:2px 7px;border:1px solid #c15a9b;border-radius:5px;color:#f18ac8}}
</style></head><body>
<nav data-testid="conversation-sidebar">
  <section class="native-project-cluster" id="native-projects-a">
    <a href="/g/opaque-medialab"><span class="folder">□</span><span>MediaLab</span></a>
    <a href="/g/opaque-niakgpt"><span class="folder">□</span><span>NiakGPT</span></a>
    <button id="native-more-a">Afficher plus</button>
  </section>
  <section class="native-project-cluster" id="native-projects-b">
    <a href="/g/opaque-films"><span class="folder">□</span><span>Films</span></a>
    <a href="/g/opaque-tech"><span class="folder">□</span><span>Tech &amp; Développement</span></a>
    <a href="/g/opaque-content"><span class="folder">□</span><span>Création &amp; Contenu</span></a>
    <button id="native-more-b">Afficher plus</button>
  </section>
  <section id="ng8-pins">
    <div class="ng8-pin-head"><span>PROJECTS</span><b>5</b></div>
    <div class="ng8-pin-list">
      <a data-ng8-pin="1" href="/g/{P1}/project"><i>▤</i><span>MediaLab</span><small>17/08 [21]</small></a>
      <a data-ng8-pin="1" href="/g/{P2}/project"><i>▤</i><span>NiakGPT</span><small>17/08 [6]</small></a>
      <a data-ng8-pin="1" href="/g/{P3}/project"><i>▶</i><span>Films</span><small>17/08 [12]</small></a>
      <a data-ng8-pin="1" href="/g/{P4}/project"><i>&lt;/&gt;</i><span>Tech &amp; Développement</span><small>17/08 [8]</small></a>
      <a data-ng8-pin="1" href="/g/{P5}/project"><i>◇</i><span>Création &amp; Contenu</span><small>17/08 [5]</small></a>
    </div>
  </section>
  <section class="recents" id="recents">
    <h3>Chats</h3>
    <a id="chat-row" href="/c/{C1}"><span>Comparaison de devis</span><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a>
    <a href="/c/{C2}"><span>Projet EIDOLON IA</span><span class="ng8-chat-date">17/08</span></a>
    <button id="recents-more">Afficher plus</button>
  </section>
</nav>
<script>
window.__labRaw={json.dumps({
  'schema':2,'at':1,
  'projects':[
    {'id':P1,'name':'MediaLab','href':f'/g/{P1}/project','domOnly':False},
    {'id':P2,'name':'NiakGPT','href':f'/g/{P2}/project','domOnly':False},
    {'id':BAD,'name':'17/08','href':'/c/'+C1,'domOnly':True}
  ],
  'chats':[
    {'id':C1,'title':'Comparaison de devis','projectId':BAD,'href':f'/g/{P1}/c/{C1}','updated':1786942800000},
    {'id':C2,'title':'Projet EIDOLON IA','projectId':P2,'href':f'/g/{P2}/c/{C2}','updated':1786942800000}
  ],
  'counts':{P1:21,P2:6,BAD:2},
  'projectChats':{BAD:[]},'indexedProjectIds':[P1,P2,BAD]
}, ensure_ascii=False)};
window.__labSubscribers=[];
window.__NIAKGPT_CACHE_BUS__={{
  async get(){{return window.__labRaw;}},
  async update(fn){{window.__labRaw=fn(window.__labRaw)||window.__labRaw;for(const sub of [...window.__labSubscribers])sub(window.__labRaw);return window.__labRaw;}},
  subscribe(fn){{window.__labSubscribers.push(fn);return()=>{{window.__labSubscribers=window.__labSubscribers.filter(x=>x!==fn);}};}}
}};
window.chrome={{storage:{{local:{{async get(){{return {{'niakgpt-v08-cache':window.__labRaw}};}},async set(obj){{if(obj['niakgpt-v08-cache'])window.__labRaw=obj['niakgpt-v08-cache'];}}}}}}}};
window.__NIAKGPT_DIAGNOSTICS__={{set(){{}}}};
</script>
</body></html>'''

with sync_playwright() as p:
    browser=getattr(p,a.browser).launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':950})
    errors=[]
    page.on('pageerror',lambda e: errors.append('PAGE:'+str(e)))
    page.on('console',lambda m: errors.append(f'CONSOLE:{m.type}:{m.text}') if m.type in ('error','warning') else None)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(root/'sidebar-authority-v107.css').read_text(encoding='utf-8'))
    page.add_script_tag(content=source('sidebar-authority-v107.js'))
    page.wait_for_timeout(450)

    initial=page.evaluate('''() => ({
      clusterA:getComputedStyle(document.getElementById('native-projects-a')).display,
      clusterB:getComputedStyle(document.getElementById('native-projects-b')).display,
      nativeMoreA:getComputedStyle(document.getElementById('native-more-a')).display,
      nativeMoreB:getComputedStyle(document.getElementById('native-more-b')).display,
      recentsMore:getComputedStyle(document.getElementById('recents-more')).display,
      dateTags:[...document.querySelectorAll('#recents .ng8-chat-date')].map(x=>x.tagName),
      fakeProjectBadges:[...document.querySelectorAll('#recents .ng8-chat-project')].map(x=>x.textContent.trim()),
      badProjects:(window.__labRaw.projects||[]).filter(p=>p.id==='dom-p-date1708').length,
      c1Project:(window.__labRaw.chats||[]).find(c=>c.id==='11111111-1111-4111-8111-111111111111')?.projectId||'',
      badCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'dom-p-date1708'),
      badIndexed:(window.__labRaw.indexedProjectIds||[]).includes('dom-p-date1708')
    })''')

    # Reproduce another module/React removing our v107 suppression markers.
    page.evaluate('''() => document.querySelectorAll('.ng107-native-project-row,.ng107-native-project-cluster,.ng107-native-project-label,.ng107-native-project-more').forEach(el=>el.classList.remove('ng107-native-project-row','ng107-native-project-cluster','ng107-native-project-label','ng107-native-project-more'))''')
    page.wait_for_timeout(220)
    race=page.evaluate('''() => ({
      clusterA:getComputedStyle(document.getElementById('native-projects-a')).display,
      clusterB:getComputedStyle(document.getElementById('native-projects-b')).display,
      recentsMore:getComputedStyle(document.getElementById('recents-more')).display
    })''')

    if a.screenshot:
      Path(a.screenshot).parent.mkdir(parents=True,exist_ok=True)
      page.screenshot(path=a.screenshot,full_page=True)

    # Safety fallback only: if our own Projects block disappears, ChatGPT native Projects return.
    page.evaluate("document.getElementById('ng8-pins').remove()")
    page.wait_for_timeout(220)
    fallback=page.evaluate('''() => ({
      clusterA:getComputedStyle(document.getElementById('native-projects-a')).display,
      clusterB:getComputedStyle(document.getElementById('native-projects-b')).display,
      nativeMoreA:getComputedStyle(document.getElementById('native-more-a')).display,
      nativeMoreB:getComputedStyle(document.getElementById('native-more-b')).display
    })''')
    browser.close()

bad=[]
if initial['clusterA']!='none' or initial['clusterB']!='none': bad.append('nativeProjectsVisible')
if initial['nativeMoreA']!='none' or initial['nativeMoreB']!='none': bad.append('nativeProjectMoreVisible')
if initial['recentsMore']=='none': bad.append('recentsMoreHidden')
if not initial['dateTags'] or any(tag!='TIME' for tag in initial['dateTags']): bad.append('dateMetadataNotTime')
if initial['fakeProjectBadges']: bad.append('dateProjectBadgeVisible')
if initial['badProjects']!=0 or initial['badCount'] or initial['badIndexed']: bad.append('dateGhostProjectNotCleaned')
if initial['c1Project']!=P1: bad.append('chatProjectNotRecovered')
if race['clusterA']!='none' or race['clusterB']!='none': bad.append('suppressionRace')
if race['recentsMore']=='none': bad.append('raceHidRecents')
if fallback['clusterA']=='none' or fallback['clusterB']=='none': bad.append('nativeFallbackMissing')
if fallback['nativeMoreA']=='none' or fallback['nativeMoreB']=='none': bad.append('nativeFallbackMoreMissing')
if errors: bad.append('consoleErrors')

result={'browser':a.browser,'initial':initial,'race':race,'fallback':fallback,'errors':errors,'bad':bad}
print(json.dumps(result,ensure_ascii=False))
if bad:
    print('FAIL '+','.join(bad),file=sys.stderr)
    sys.exit(1)
print(f'{a.browser} LIVE_0957_PASS')
