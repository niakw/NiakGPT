#!/usr/bin/env python3
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)

def src(name):
    s=(ROOT/name).read_text()
    return s.replace("location.hostname!=='chatgpt.com'||","false||").replace("location.hostname !== 'chatgpt.com' ||","false ||")

async def run(browser_name):
  async with async_playwright() as p:
    browser=await getattr(p,browser_name).launch(headless=True)

    # 0.9.61 regression: ChatGPT can expose a standalone /projects home row above
    # NiakGPT. Hide native Projects surfaces only; our own PROJECTS title/link must stay.
    page=await browser.new_page(viewport={'width':900,'height':650})
    errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    await page.set_content('''<nav data-testid="conversation-sidebar" id="s1">
      <a id="native-home1" data-sidebar-item="true" href="/projects"><span>Projects</span></a>
      <div id="native1" class="group/sidebar-expando-section"><button><span>Projets</span></button><div class="project-unfurl-row"><div data-sidebar-item="true">NiakGPT</div></div></div>
      <div id="recents1">Discussions</div>
      <section id="ng8-pins"><div class="ng8-pin-head"><a id="our-projects" class="ng106-projects-home" href="/projects">PROJECTS</a></div><a data-ng8-pin="1" href="/g/g-p-one/project">NiakGPT</a></section>
    </nav>''')
    await page.add_style_tag(content=(ROOT/'sidebar-projects-authority-v111.css').read_text())
    await page.evaluate(src('sidebar-projects-authority-v111.js')); await page.wait_for_timeout(180)
    first=await page.evaluate("() => ({home:getComputedStyle(document.querySelector('#native-home1')).display,section:getComputedStyle(native1).display,recents:getComputedStyle(recents1).display,ours:getComputedStyle(document.querySelector('#our-projects')).display,oursHidden:document.querySelector('#our-projects').classList.contains('ng111-native-projects-authoritative')})")
    assert first['home']=='none' and first['section']=='none',first
    assert first['recents']!='none' and first['ours']!='none' and not first['oursHidden'],first

    # Full sidebar replacement: native home link wrapped in a sidebar item must hide the
    # native row, while GPTs and our own link remain available.
    await page.evaluate('''s1.outerHTML='<nav data-testid="conversation-sidebar" id="s2"><div id="home-row2" data-sidebar-item="true"><a id="native-home2" href="/projects?source=sidebar"><span>Projects</span></a></div><div id="native2" class="sidebar-expando-section"><div role="button" aria-label="Projects">Workspace</div><a href="/g/g-p-two/project">Films</a></div><div id="gpts">GPTs</div><section id="ng8-pins"><div class="ng8-pin-head"><a id="our-projects2" class="ng106-projects-home" href="/projects">PROJECTS</a></div><a data-ng8-pin="1" href="/g/g-p-two/project">Films</a></section></nav>' ''')
    await page.wait_for_timeout(220)
    second=await page.evaluate("() => ({homeRow:getComputedStyle(document.querySelector('#home-row2')).display,native:getComputedStyle(native2).display,gpts:getComputedStyle(gpts).display,ours:getComputedStyle(document.querySelector('#our-projects2')).display})")
    assert second['homeRow']=='none' and second['native']=='none',second
    assert second['gpts']!='none' and second['ours']!='none',second

    # Shared Projects/Recents layout: never hide the shared nav. Only exact native Projects
    # targets disappear; Recents, manual lock and NiakGPT PROJECTS remain visible.
    await page.evaluate('''s2.outerHTML=`<aside data-testid="conversation-sidebar" id="s3"><nav id="shared-nav">
      <button>Nouveau chat</button>
      <a id="native-home3" href="/projects">Projects</a>
      <h3 id="loose-projects">Projects</h3><div id="loose-project-list"><a href="/g/g-p-three/project">Studio</a><a href="/g/g-p-four/project">Films</a></div>
      <h3 id="recent-heading">Récents</h3><div id="recents3"><a href="/c/chat-one">Chat récent <button class="ng85-manual-lock">🔒</button></a></div>
      <section id="ng8-pins"><div class="ng8-pin-head"><a id="our-projects3" class="ng106-projects-home" href="/projects">PROJECTS</a></div><a data-ng8-pin="1" href="/g/g-p-three/project">Studio</a></section>
    </nav></aside>`''')
    await page.wait_for_timeout(240)
    shared=await page.evaluate('''() => ({
      nav:getComputedStyle(document.querySelector('#shared-nav')).display,
      home:getComputedStyle(document.querySelector('#native-home3')).display,
      heading:getComputedStyle(document.querySelector('#loose-projects')).display,
      projectList:getComputedStyle(document.querySelector('#loose-project-list')).display,
      recents:getComputedStyle(document.querySelector('#recents3')).display,
      lock:getComputedStyle(document.querySelector('.ng85-manual-lock')).display,
      recentHeading:getComputedStyle(document.querySelector('#recent-heading')).display,
      ours:getComputedStyle(document.querySelector('#our-projects3')).display
    })''')
    assert shared['nav']!='none' and shared['home']=='none' and shared['heading']=='none' and shared['projectList']=='none',shared
    assert shared['recents']!='none' and shared['lock']!='none' and shared['recentHeading']!='none' and shared['ours']!='none',shared

    # Fallback: if the NiakGPT Projects block disappears, restore all native Projects UI.
    await page.evaluate("document.querySelector('#ng8-pins').remove()"); await page.wait_for_timeout(160)
    fallback=await page.evaluate("() => ({home:getComputedStyle(document.querySelector('#native-home3')).display,heading:getComputedStyle(document.querySelector('#loose-projects')).display,list:getComputedStyle(document.querySelector('#loose-project-list')).display})")
    assert fallback['home']!='none' and fallback['heading']!='none' and fallback['list']!='none',fallback
    await page.screenshot(path=str(ART/f'0961-projects-{browser_name}.png'))
    assert not errors,errors

    # Keep 0.9.60 chat-row stability guarantees: exact anchor identity, fixed date,
    # active/OUT decoration and a real click after a long-enough rerender window.
    page2=await browser.new_page(viewport={'width':700,'height':650})
    errors2=[]; page2.on('pageerror',lambda e: errors2.append(str(e)))
    cur='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; out='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; pid='g-p-test'
    cache={'projects':[{'id':pid,'name':'NiakGPT'}],'chats':[{'id':cur,'title':'Titre très long qui doit être tronqué sans déplacer la date','projectId':pid,'updated':1786960000000},{'id':out,'title':'Limite','projectId':pid,'updated':1786870000000}],'projectChats':{pid:[{'id':cur,'title':'Titre très long qui doit être tronqué sans déplacer la date','projectId':pid,'updated':1786960000000},{'id':out,'title':'Limite','projectId':pid,'updated':1786870000000}]}}
    state={'out':{out:{'out':True}}}
    await page2.set_content(f'''<style>#ng8-pins{{width:320px}}#native{{display:none}}</style><div id="native"><a id="nativeChat" href="/g/{pid}/c/{cur}">native</a></div><section id="ng8-pins"><a data-ng8-pin="1" href="/g/{pid}/project"><span>NiakGPT</span></a></section>''')
    await page2.add_style_tag(content=(ROOT/'pin-folders-v096.css').read_text()+(ROOT/'project-chat-ux-v110.css').read_text())
    await page2.evaluate(f'''() => {{window.__store={json.dumps({'niakgpt-v08-cache':cache,'niakgpt-continuity-v100':state})};window.__clicks=0;nativeChat.onclick=e=>{{e.preventDefault();window.__clicks++}};window.prompt=()=>null;window.chrome={{runtime:{{id:'x'}},storage:{{local:{{get:async k=>Object.fromEntries((Array.isArray(k)?k:[k]).map(x=>[x,window.__store[x]])),set:async o=>Object.assign(window.__store,o)}},onChanged:{{addListener:()=>{{}}}}}}}};window.__NIAKGPT_CACHE_BUS__={{subscribe(fn){{queueMicrotask(()=>fn(window.__store['niakgpt-v08-cache']));return()=>{{}};}},update:async fn=>fn(window.__store['niakgpt-v08-cache'])}};}}''')
    await page2.evaluate(src('pin-folders-v096.js')); await page2.wait_for_timeout(100); await page2.click('#ng8-pins a[data-ng8-pin="1"]'); await page2.wait_for_timeout(80)
    ux=src('project-chat-ux-v110.js').replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{cur}';")
    await page2.evaluate(ux); await page2.wait_for_timeout(160)
    before=await page2.evaluate(f'''() => {{const a=document.querySelector('a[data-chat="{cur}"]'),t=a.querySelector('time');window.__stable=a;return{{active:a.dataset.ng110Active,out:document.querySelector('a[data-chat="{out}"]').dataset.ng110Out,date:t.getBoundingClientRect().x,ellipsis:getComputedStyle(a.querySelector('span')).textOverflow}}}}''')
    assert before['active']=='1' and before['out']=='1' and before['ellipsis']=='ellipsis',before
    await page2.wait_for_timeout(1000)
    after=await page2.evaluate(f'''() => {{const a=document.querySelector('a[data-chat="{cur}"]'),t=a.querySelector('time');return{{same:a===window.__stable,date:t.getBoundingClientRect().x,drawers:document.querySelectorAll('.ng96-pin-drawer').length}}}}''')
    assert after['same'] and after['drawers']==1 and abs(after['date']-before['date'])<0.5,(before,after)
    box=await page2.locator(f'a[data-chat="{cur}"]').bounding_box(); await page2.mouse.click(box['x']+12,box['y']+box['height']/2); await page2.wait_for_timeout(60)
    assert await page2.evaluate('window.__clicks')==1
    await page2.screenshot(path=str(ART/f'0961-chat-stability-{browser_name}.png'))
    assert not errors2,errors2

    print(f'REGRESSION_0961_PASS browser={browser_name}')
    await browser.close()

if __name__=='__main__':
  ap=argparse.ArgumentParser(); ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium'); args=ap.parse_args(); asyncio.run(run(args.browser))
