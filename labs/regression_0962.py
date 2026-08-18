#!/usr/bin/env python3
import argparse, asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)


def src(name):
    s=(ROOT/name).read_text(encoding='utf-8')
    return s.replace("location.hostname!=='chatgpt.com'||","false||").replace("location.hostname !== 'chatgpt.com' ||","false ||")


def runtime_files():
    text=(ROOT/'background-v100.js').read_text(encoding='utf-8')
    block=re.search(r"const ISOLATED_RUNTIME=\[(.*?)\];",text,re.S)
    assert block, 'ISOLATED_RUNTIME missing'
    return re.findall(r"'([^']+)'",block.group(1))


async def run(browser_name):
    runtime=runtime_files()
    assert 'sidebar-projects-authority-v112.js' in runtime, runtime
    assert 'home-layout-v112.js' in runtime, runtime
    for forbidden in ['project-pins-v090.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','sidebar-projects-authority-v111.js']:
        assert forbidden not in runtime, (forbidden,runtime)

    async with async_playwright() as p:
        browser=await getattr(p,browser_name).launch(headless=True)

        # Exact class of failure seen on the authenticated UI: native Project rows can be
        # plain sidebar items with no Projects heading, no g-p href and no project-unfurl class.
        page=await browser.new_page(viewport={'width':560,'height':920})
        errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
        await page.set_content('''<!doctype html><html><head><style>
          *{box-sizing:border-box}body{margin:0;background:#071018;color:#dce7f1;font:18px system-ui}
          aside{width:505px;min-height:900px;background:#071019;padding:12px}
          .general,.native-projects,#ng8-pins,.recents{display:block}
          [data-sidebar-item="true"],.show-more{display:flex;align-items:center;height:54px;padding:0 22px;margin:1px 0}
          .general{border-bottom:1px solid #23313d;padding-bottom:12px}.general>*{display:block;padding:8px 18px}
          #ng8-pins{margin-top:28px;padding:8px;border:1px solid #24516c}
          #ng8-pins>a{display:flex;height:46px;align-items:center;padding:0 12px;color:#e8f3fb;text-decoration:none;border:1px solid #345}
          #ng8-pins span{margin-left:8px}.recents{margin-top:20px}
        </style></head><body>
        <aside data-testid="sidebar" id="sidebar">
          <div class="general" id="general"><div>Nouveau chat</div><div>Bibliothèque</div><div>Planification</div><div>Plugins</div><div id="codex">Codex</div><div id="plus">Plus</div></div>
          <div class="native-projects" id="native-projects-top">
            <div data-sidebar-item="true" id="native-niakvio">NiakVIO</div>
            <div data-sidebar-item="true" id="native-niakgpt">NiakGPT</div>
            <button class="show-more" id="native-more-1">Afficher plus</button>
            <div data-sidebar-item="true" id="native-films">Films</div>
            <div data-sidebar-item="true" id="native-tech">Tech & Développement</div>
            <div data-sidebar-item="true" id="native-content">Création & Contenu</div>
            <button class="show-more" id="native-more-2">Afficher plus</button>
          </div>
          <section id="ng8-pins">
            <div class="ng8-pin-head"><a href="/projects">PROJECTS</a><b>5</b></div>
            <a data-ng8-pin="1" href="/g/g-p-one/project"><i>▤</i><span>NiakVIO</span><small>18/08</small></a>
            <a data-ng8-pin="1" href="/g/g-p-two/project"><i>▤</i><span>NiakGPT</span><small>18/08</small></a>
            <a data-ng8-pin="1" href="/g/g-p-three/project"><i>▤</i><span>Films</span><small>18/08</small></a>
            <a data-ng8-pin="1" href="/g/g-p-four/project"><i>▤</i><span>Tech & Développement</span><small>18/08</small></a>
            <a data-ng8-pin="1" href="/g/g-p-five/project"><i>▤</i><span>Création & Contenu</span><small>18/08</small></a>
          </section>
          <section class="recents" id="recents"><div>Chats</div><button id="recents-more">Afficher plus</button></section>
        </aside>
        <script>window.__NIAKGPT_DIAGNOSTICS__={set(){}};</script>
        </body></html>''')
        await page.add_style_tag(content=(ROOT/'sidebar-projects-authority-v112.css').read_text(encoding='utf-8'))
        await page.evaluate(src('sidebar-projects-authority-v112.js'))
        await page.wait_for_timeout(220)
        sidebar=await page.evaluate('''() => {
          const d=id=>getComputedStyle(document.getElementById(id)).display;
          return {
            niakvio:d('native-niakvio'),niakgpt:d('native-niakgpt'),films:d('native-films'),tech:d('native-tech'),content:d('native-content'),
            more1:d('native-more-1'),more2:d('native-more-2'),codex:d('codex'),plus:d('plus'),ours:d('ng8-pins'),recents:d('recents'),recentsMore:d('recents-more'),
            hidden:document.querySelectorAll('.ng112-native-projects-hidden').length
          };
        }''')
        assert all(sidebar[k]=='none' for k in ['niakvio','niakgpt','films','tech','content','more1','more2']),sidebar
        assert all(sidebar[k]!='none' for k in ['codex','plus','ours','recents','recentsMore']),sidebar
        assert sidebar['hidden']>=7,sidebar
        await page.screenshot(path=str(ART/f'0962-sidebar-{browser_name}.png'),full_page=True)

        # DOM rerender must not resurrect native Projects.
        await page.evaluate('''() => {
          const old=document.getElementById('native-projects-top');
          const clone=old.cloneNode(true); clone.id='native-projects-rerender'; old.replaceWith(clone);
        }''')
        await page.wait_for_timeout(180)
        rerender=await page.evaluate("() => [...document.querySelectorAll('#native-projects-rerender [data-sidebar-item=true],#native-projects-rerender .show-more')].map(x=>getComputedStyle(x).display)")
        assert rerender and all(x=='none' for x in rerender),rerender

        # Fallback safety: if our managed Project block really disappears, native Projects return.
        await page.evaluate("document.getElementById('ng8-pins').remove()")
        await page.wait_for_timeout(180)
        fallback=await page.evaluate("() => [...document.querySelectorAll('#native-projects-rerender [data-sidebar-item=true],#native-projects-rerender .show-more')].map(x=>getComputedStyle(x).display)")
        assert fallback and all(x!='none' for x in fallback),fallback
        assert not errors,errors

        # Home regression from the real screenshot: the native greeting must never sit behind
        # the unified composer. The test starts with a deliberate collision.
        home=await browser.new_page(viewport={'width':1964,'height':900})
        errors_home=[]; home.on('pageerror',lambda e: errors_home.append(str(e)))
        await home.set_content('''<!doctype html><html><head><style>
          *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#071018;color:#dce7f1;font-family:system-ui}
          main{position:relative;width:100%;height:100%;overflow:hidden}
          h1{position:absolute;left:50%;top:430px;transform:translateX(-50%);margin:0;font-size:38px;line-height:52px;font-weight:500;white-space:nowrap}
          [data-type="unified-composer"]{position:absolute;left:50%;top:455px;transform:translateX(-50%);width:1536px;height:104px;background:#232323;border-radius:14px;display:flex;align-items:center;padding:0 32px}
          [data-testid="prompt-textarea"]{font-size:28px;color:#8597aa}
        </style></head><body><main>
          <h1 id="greeting">Par quoi commençons-nous ?</h1>
          <form id="composer" data-type="unified-composer"><div data-testid="prompt-textarea" contenteditable="true">Demander à ChatGPT</div></form>
        </main><script>window.__NIAKGPT_DIAGNOSTICS__={set(){}};</script></body></html>''')
        before=await home.evaluate("() => {const t=greeting.getBoundingClientRect(),c=composer.getBoundingClientRect();return {titleBottom:t.bottom,composerTop:c.top,gap:c.top-t.bottom}}")
        assert before['gap']<0,before
        await home.add_style_tag(content=(ROOT/'home-layout-v112.css').read_text(encoding='utf-8'))
        await home.evaluate(src('home-layout-v112.js'))
        await home.wait_for_timeout(180)
        after=await home.evaluate('''() => {const t=greeting.getBoundingClientRect(),c=composer.getBoundingClientRect();return {
          titleBottom:t.bottom,composerTop:c.top,composerBottom:c.bottom,gap:c.top-t.bottom,shift:composer.dataset.ng112HomeShift||'',protected:document.documentElement.dataset.ng112HomeProtected||''
        }}''')
        assert after['gap']>=25,after
        assert after['composerBottom']<=900,after
        assert int(after['shift'])>0 and after['protected']=='1',after
        await home.screenshot(path=str(ART/f'0962-home-{browser_name}.png'),full_page=True)

        # Conversation routes/content must not retain the home-only shift.
        await home.evaluate("() => {const turn=document.createElement('article');turn.dataset.testid='conversation-turn-1';document.querySelector('main').appendChild(turn)}")
        await home.wait_for_timeout(100)
        cleared=await home.evaluate("() => ({cls:composer.classList.contains('ng112-home-composer-shift'),shift:composer.dataset.ng112HomeShift||''})")
        assert not cleared['cls'] and not cleared['shift'],cleared
        assert not errors_home,errors_home

        print(json.dumps({'browser':browser_name,'sidebar':sidebar,'homeBefore':before,'homeAfter':after},ensure_ascii=False))
        print(f'REGRESSION_0962_PASS browser={browser_name}')
        await browser.close()


if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
    args=ap.parse_args(); asyncio.run(run(args.browser))
