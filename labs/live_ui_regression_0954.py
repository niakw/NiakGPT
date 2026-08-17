#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
ap.add_argument('--executable',default=None)
ap.add_argument('--screenshot',default=None)
a=ap.parse_args()
root=Path(a.root)

def source(name):
    s=(root/name).read_text(encoding='utf-8')
    s=s.replace("if(location.hostname!=='chatgpt.com'||", "if(false||")
    s=s.replace("if (location.hostname !== 'chatgpt.com' ||", "if (false ||")
    return s

html='''<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#071018;color:#dbe6ef;font-family:Arial,sans-serif;overflow:hidden}
#shell{display:flex;width:calc(100vw - 70px);height:calc(100vh - 24px)}
nav{width:310px;flex:0 0 310px;background:#08131d;padding:16px 10px;overflow:auto}
nav a,nav button,nav span{display:block;color:#cbd7e2;padding:8px 10px;text-decoration:none;background:transparent;border:0;text-align:left}
.native-group{border-bottom:1px solid #172635}.native-more-wrap{padding-top:8px}
#ng8-pins{display:block;margin-top:26px;border:1px solid #2b91a9;padding:8px;background:#0a1a24}
#ng8-pins a{display:block;border:1px solid #4ec9b0;margin:4px 0}
main{flex:1 1 auto;min-width:0;padding:90px 80px 160px;background:linear-gradient(180deg,#09151e,#071018)}
#chat{max-width:900px;margin:0 auto;font-size:18px;line-height:1.5}
#ng8-coach{position:absolute!important;left:390px!important;bottom:55px!important;width:760px!important;margin:0!important;border:1px solid #344858;border-radius:8px;overflow:hidden;background:#101923!important}
#native-panel{width:500px;flex:0 0 500px;height:calc(100vh - 24px);background:#05080b;border-left:1px solid #293846;padding:24px 26px;overflow:auto}
#native-panel h2{font-size:22px}#native-panel p{font-size:16px;line-height:1.6}
#ng8-rail{position:fixed;right:0;top:0;width:70px;height:100vh;background:#08131d;border-left:1px solid #24404e;z-index:999}
#ng8-status{position:fixed;left:0;right:70px;bottom:0;height:24px;background:#0784be;z-index:999}
</style></head><body class="ng8-ready"><div id="shell">
<nav data-testid="conversation-sidebar">
  <div class="native-group"><a href="/g/g-p-films/project">Films</a><a href="/g/g-p-niakvio/project">NiakVIO</a><button>Afficher plus</button></div>
  <div class="native-group"><a href="/g/g-p-niakgpt/project">NiakGPT</a><a href="/g/g-p-tech/project">Tech & Développement</a><a href="/g/g-p-content/project">Création & Contenu</a><div class="native-more-wrap"><button>Afficher plus</button></div></div>
  <section id="ng8-pins"><div>PROJECTS <b>5</b></div><a data-ng8-pin="1" href="/g/g-p-niakvio/project">NiakVIO</a><a data-ng8-pin="1" href="/g/g-p-niakgpt/project">NiakGPT</a><a data-ng8-pin="1" href="/g/g-p-tech/project">Tech & Développement</a></section>
</nav>
<main><div id="chat"><p>Conversation de test longue.</p><p>Le panneau Activité ne doit pas voler la largeur du chat.</p></div>
<section id="ng8-coach" data-ng100-coach="1"><div class="ng100-prompt-head"><b>PROMPTEUR ADAPTATIF · LOCAL</b><span>GENERAL</span></div><pre class="ng100-prompt-preview">Réponds directement à l’objectif, utilise le contexte utile, conserve toutes les contraintes explicites et rends une réponse complète. Cette ligne doit revenir à la ligne sans déborder horizontalement.</pre><div class="ng100-prompt-actions"><button type="button">COPIER</button><button type="button">REMPLACER</button></div></section>
</main>
<div id="native-panel"><h2>Activité · 25m 9s</h2><h3>Réflexion</h3><p>Retrouvant votre conversation et contrôlant les fichiers déjà modifiés.</p><p>Le traitement pourrait durer longtemps car plusieurs scénarios sont exécutés séquentiellement.</p></div>
</div><aside id="ng8-rail"></aside><div id="ng8-status"></div></body></html>'''

with sync_playwright() as p:
    bt=getattr(p,a.browser)
    kwargs={'headless':True}
    if a.executable: kwargs['executable_path']=a.executable
    browser=bt.launch(**kwargs)
    page=browser.new_page(viewport={'width':2048,'height':1073})
    errors=[]
    page.on('pageerror',lambda e:errors.append('PAGE:'+str(e)))
    page.on('console',lambda m: errors.append(f'CONSOLE:{m.type}:{m.text}') if m.type in ('error','warning') else None)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(root/'side-panels-v096.css').read_text()+"\n"+(root/'core-v090.css').read_text()+"\n"+(root/'live-fixes-v104.css').read_text())
    page.add_script_tag(content=source('side-panels-v096.js'))
    page.add_script_tag(content=source('live-fixes-v104.js'))
    page.wait_for_timeout(450)
    data=page.evaluate('''() => {
      const native=[...document.querySelectorAll('nav a[href^="/g/g-p-"]')].filter(a=>!a.closest('#ng8-pins'));
      const mores=[...document.querySelectorAll('nav button')];
      const panel=document.getElementById('native-panel'),main=document.querySelector('main'),rail=document.getElementById('ng8-rail');
      const pr=document.querySelector('.ng100-prompt-preview'),head=document.querySelector('.ng100-prompt-head'),actions=document.querySelector('.ng100-prompt-actions');
      const buttons=[...actions.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
      const r=panel.getBoundingClientRect(),rr=rail.getBoundingClientRect();
      return {
        nativeHidden:native.every(x=>getComputedStyle(x).display==='none'),
        moreHidden:mores.every(x=>getComputedStyle(x).display==='none'),
        pinsVisible:getComputedStyle(document.getElementById('ng8-pins')).display!=='none',
        panelMarked:panel.classList.contains('ng96-native-sidepanel'),
        panelWidth:Math.round(r.width), panelRight:Math.round(innerWidth-r.right), railWidth:Math.round(rr.width),
        panelPosition:getComputedStyle(panel).position, mainWidth:Math.round(main.getBoundingClientRect().width),
        headDisplay:getComputedStyle(head).display, headGap:getComputedStyle(head).gap,
        previewWhiteSpace:getComputedStyle(pr).whiteSpace, previewOverflowWrap:getComputedStyle(pr).overflowWrap,
        previewScrollWidth:pr.scrollWidth, previewClientWidth:pr.clientWidth,
        actionDisplay:getComputedStyle(actions).display, actionGap:getComputedStyle(actions).gap,
        buttonSeparated:buttons.length===2 && buttons[1].left-buttons[0].right>=5
      };
    }''')
    if a.screenshot:
      Path(a.screenshot).parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=a.screenshot,full_page=True)
    browser.close()

bad=[]
for key in ('nativeHidden','moreHidden','pinsVisible','panelMarked','buttonSeparated'):
    if not data.get(key): bad.append(key)
if not (318<=data['panelWidth']<=322): bad.append('panelWidth')
if abs(data['panelRight']-data['railWidth'])>2: bad.append('panelRight')
if data['panelPosition']!='fixed': bad.append('panelPosition')
if data['mainWidth']<1400: bad.append('mainWidth')
if data['headDisplay']!='flex': bad.append('headDisplay')
if data['previewWhiteSpace'] not in ('pre-wrap','break-spaces'): bad.append('previewWhiteSpace')
if data['previewScrollWidth']>data['previewClientWidth']+2: bad.append('previewOverflow')
if data['actionDisplay']!='flex': bad.append('actionDisplay')
if errors: bad.append('consoleErrors')
print(json.dumps({'browser':a.browser,**data,'errors':errors},ensure_ascii=False))
if bad:
    print('FAIL '+','.join(bad),file=sys.stderr);sys.exit(1)
print(f'{a.browser} LIVE_UI_0954_PASS')
