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

    # Native Projects: markup drift + full sidebar replacement + fallback.
    page=await browser.new_page(viewport={'width':900,'height':650})
    errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    await page.set_content('''<nav data-testid="conversation-sidebar" id="s1">
      <div id="native1" class="group/sidebar-expando-section"><button><span>Projets</span></button><div class="project-unfurl-row"><div data-sidebar-item="true">NiakGPT</div></div></div>
      <div id="recents">Discussions</div><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-one/project">NiakGPT</a></section></nav>''')
    await page.add_style_tag(content=(ROOT/'sidebar-projects-authority-v110.css').read_text())
    await page.evaluate(src('sidebar-projects-authority-v110.js')); await page.wait_for_timeout(160)
    assert await page.evaluate("getComputedStyle(native1).display")=='none'
    await page.evaluate('''s1.outerHTML='<nav data-testid="conversation-sidebar" id="s2"><div id="native2" class="sidebar-expando-section"><div role="button" aria-label="Projects">Workspace</div><a href="/g/g-p-two/project">Films</a></div><div id="gpts">GPTs</div><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-two/project">Films</a></section></nav>' ''')
    await page.wait_for_timeout(200)
    assert await page.evaluate("getComputedStyle(native2).display")=='none'
    assert await page.evaluate("getComputedStyle(gpts).display")!='none'
    await page.evaluate("document.querySelector('#ng8-pins').remove()"); await page.wait_for_timeout(140)
    assert await page.evaluate("getComputedStyle(native2).display")!='none'
    await page.screenshot(path=str(ART/f'0960-projects-{browser_name}.png'))
    assert not errors,errors

    # pin-folders + v110 together: no chat-node churn, stable date, active/OUT state and clickable route.
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
    await page2.screenshot(path=str(ART/f'0960-chat-stability-{browser_name}.png'))
    assert not errors2,errors2

    print(f'REGRESSION_0960_PASS browser={browser_name}')
    await browser.close()

if __name__=='__main__':
  ap=argparse.ArgumentParser(); ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium'); args=ap.parse_args(); asyncio.run(run(args.browser))
