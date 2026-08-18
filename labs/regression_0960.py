#!/usr/bin/env python3
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)

def source(name):
    s=(ROOT/name).read_text(encoding='utf-8')
    return s.replace("location.hostname!=='chatgpt.com'||","false||").replace("location.hostname !== 'chatgpt.com' ||","false ||")

def project_source():
    s=source('project-folders-v110.js')
    return s.replace("const currentCid=()=>cidFromHref(location.pathname);","const currentCid=()=>window.__testCurrentCid||cidFromHref(location.pathname);")

def storage_mock(page, store):
    page.add_script_tag(content=f'''(() => {{
      window.__store={json.dumps(store)}; window.__listeners=[]; window.__rpc=[];
      const emit=changes=>window.__listeners.forEach(fn=>fn(changes,'local'));
      window.chrome={{runtime:{{id:'lab'}},storage:{{local:{{get:async keys=>Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,window.__store[k]])):{{[keys]:window.__store[keys]}},set:async obj=>{{const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:window.__store[k],newValue:v}};window.__store[k]=v;}}emit(changes);}}}},onChanged:{{addListener:fn=>window.__listeners.push(fn)}}}}}};
      window.__NIAKGPT_CACHE_BUS__={{subscribe(fn){{window.__cacheSub=fn;queueMicrotask(()=>fn(window.__store['niakgpt-v08-cache']));return()=>{{}};}},async update(fn){{const old=window.__store['niakgpt-v08-cache'],next=await fn(old);if(next!==old){{window.__store['niakgpt-v08-cache']=next;emit({{'niakgpt-v08-cache':{{oldValue:old,newValue:next}}}});window.__cacheSub?.(next);}}return window.__store['niakgpt-v08-cache'];}}}};
      document.addEventListener('niakgpt:rpc-request',e=>{{window.__rpc.push(e.detail);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:e.detail.id,ok:true,status:200,data:e.detail.body||{{}}}}}})));}});
      window.__setStore=(k,v)=>{{const old=window.__store[k];window.__store[k]=v;emit({{[k]:{{oldValue:old,newValue:v}}}});if(k==='niakgpt-v08-cache')window.__cacheSub?.(v);}};
    }})()''')

def run(browser_name):
  with sync_playwright() as p:
    browser=getattr(p,browser_name).launch(headless=True)

    # A. Native Projects authority survives replacement of the ENTIRE ChatGPT sidebar root.
    page=browser.new_page(viewport={'width':1000,'height':700}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('''<style>body{background:#071019;color:#dce7f1;font-family:system-ui}nav{width:310px}.group\\/sidebar-expando-section,.group\\/foo\\/sidebar-expando-section{padding:8px;border:1px solid #334}</style><nav data-testid="conversation-sidebar"><div id="native" class="group/sidebar-expando-section"><button><span>Projets</span></button><div class="group/project-unfurl-row"><div role="button">NiakGPT</div></div></div><div id="gpts"><h2>GPTs</h2></div><section id="ng8-pins"><b>PROJECTS NIAKGPT</b></section></nav>''')
    page.add_style_tag(content=(ROOT/'sidebar-projects-authority-v109.css').read_text(encoding='utf-8'))
    page.add_script_tag(content=source('sidebar-projects-authority-v110.js')); page.wait_for_timeout(120)
    assert page.eval_on_selector('#native','e=>getComputedStyle(e).display')=='none'
    page.evaluate('''() => {document.querySelector('nav').outerHTML=`<nav data-testid="conversation-sidebar"><section id="native2" class="group/foo/sidebar-expando-section"><div><button aria-expanded="true">Projects</button></div><div class="group/project-unfurl-row"><div role="button">Films</div></div></section><div id="gpts2"><h2>GPTs</h2></div><section id="ng8-pins"><b>PROJECTS NIAKGPT</b></section></nav>`;}''')
    page.wait_for_timeout(160)
    assert page.eval_on_selector('#native2','e=>getComputedStyle(e).display')=='none'
    assert page.eval_on_selector('#gpts2','e=>getComputedStyle(e).display')!='none'
    page.screenshot(path=str(ART/f'0960-authority-root-rerender-{browser_name}.png'),full_page=True)
    page.evaluate("document.getElementById('ng8-pins').remove()"); page.wait_for_timeout(100)
    assert page.eval_on_selector('#native2','e=>getComputedStyle(e).display')!='none'
    assert not errors,errors

    # B. Project folder is a single-owner DOM: no wrapper/re-render loop, stable dates/clicks,
    # route-only active state, and cached OUT state.
    page2=browser.new_page(viewport={'width':700,'height':650}); errors2=[]; page2.on('pageerror',lambda e:errors2.append(str(e)))
    page2.set_content('''<style>body{background:#071019;color:#dce7f1;font-family:system-ui}#ng8-pins{width:340px}#ng8-pins>a{display:grid;grid-template-columns:24px 1fr 50px}</style><a id="native-chat" href="/g/g-p-x/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">native route</a><div id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-x/project"><span>◆</span><span>NiakGPT</span><small>3</small></a></div>''')
    cache={'projects':[{'id':'g-p-x','name':'NiakGPT'}],'chats':[],'projectChats':{'g-p-x':[
      {'id':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','title':'Titre actif extrêmement long qui doit rester tronqué sans faire bouger la date','projectId':'g-p-x','updated':1786900000000},
      {'id':'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','title':'Deuxième conversation','projectId':'g-p-x','updated':1786800000000},
      {'id':'cccccccc-cccc-cccc-cccc-cccccccccccc','title':'Conversation limite','projectId':'g-p-x','updated':1786700000000}]}}
    storage_mock(page2,{'niakgpt-v08-cache':cache,'niakgpt-continuity-v100':{'out':{}}})
    page2.evaluate("window.__testCurrentCid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")
    page2.add_style_tag(content=(ROOT/'pin-folders-v096.css').read_text(encoding='utf-8')+(ROOT/'project-chat-ux-v109.css').read_text(encoding='utf-8'))
    page2.add_script_tag(content=project_source()); page2.wait_for_timeout(120)
    page2.locator('#ng8-pins a[data-ng8-pin="1"]').click(); page2.wait_for_timeout(100)
    assert page2.locator('.ng109-chat-row').count()==3
    assert page2.locator('.ng109-chat-row[data-ng109-active="1"]').get_attribute('data-chat-row')=='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    geom=page2.evaluate('''() => {const row=document.querySelector('.ng109-chat-row'),title=row.querySelector('.ng96-chat-title'),time=row.querySelector('time');window.__stableRow=row;window.__timeX=time.getBoundingClientRect().x;return{titleRight:title.getBoundingClientRect().right,timeLeft:time.getBoundingClientRect().left,activeBg:getComputedStyle(row).backgroundColor};}''')
    assert geom['titleRight']<=geom['timeLeft']+1,geom
    page2.evaluate("() => {const r=window.__store['niakgpt-v08-cache'];window.__setStore('niakgpt-v08-cache',{...r,at:Date.now()});for(let i=0;i<25;i++){const x=document.createElement('i');document.querySelector('.ng96-pin-drawer').appendChild(x);x.remove();}}")
    page2.wait_for_timeout(500)
    assert page2.evaluate("document.querySelector('.ng109-chat-row')===window.__stableRow") is True
    assert abs(page2.evaluate("document.querySelector('.ng109-chat-row time').getBoundingClientRect().x-window.__timeX"))<1
    page2.evaluate("window.__testCurrentCid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';dispatchEvent(new PopStateEvent('popstate'))"); page2.wait_for_timeout(80)
    assert page2.evaluate("document.querySelector('.ng109-chat-row')===window.__stableRow") is True
    assert page2.locator('.ng109-chat-row[data-ng109-active="1"]').get_attribute('data-chat-row')=='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    inactive_bg=page2.eval_on_selector('.ng109-chat-row[data-chat-row="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]','e=>getComputedStyle(e).backgroundColor')
    active_bg=page2.eval_on_selector('.ng109-chat-row[data-chat-row="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]','e=>getComputedStyle(e).backgroundColor')
    assert active_bg!=inactive_bg,(active_bg,inactive_bg)
    page2.evaluate("window.__setStore('niakgpt-continuity-v100',{out:{'cccccccc-cccc-cccc-cccc-cccccccccccc':{out:true,title:'Conversation limite',updatedAt:1787000000000,reason:'limit-detected'}}})");page2.wait_for_timeout(120)
    assert page2.locator('.ng109-chat-row[data-ng109-out="1"] .ng109-out-badge').count()==1
    assert page2.locator('.ng109-chat-row').last.get_attribute('data-chat-row')=='cccccccc-cccc-cccc-cccc-cccccccccccc'
    page2.evaluate("window.__outRow=document.querySelector('.ng109-chat-row[data-ng109-out=\"1\"]')");page2.wait_for_timeout(350)
    assert page2.evaluate("document.querySelector('.ng109-chat-row[data-ng109-out=\"1\"]')===window.__outRow") is True
    page2.evaluate("window.__nativeClicks=0;document.getElementById('native-chat').addEventListener('click',e=>{e.preventDefault();window.__nativeClicks++})")
    page2.locator('a[data-chat="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]').click(); page2.wait_for_timeout(80)
    assert page2.evaluate('window.__nativeClicks')==1
    page2.screenshot(path=str(ART/f'0960-project-folders-stable-{browser_name}.png'),full_page=True)
    assert not errors2,errors2

    # C. Continuity OUT is mirrored into the conversation cache and Project cache.
    page3=browser.new_page(); errors3=[]; page3.on('pageerror',lambda e:errors3.append(str(e)));page3.set_content('<main></main>')
    cache2={'chats':[{'id':'x','title':'X','projectId':'g-p-x'}],'projectChats':{'g-p-x':[{'id':'x','title':'X','projectId':'g-p-x'}]}}
    state={'out':{'x':{'out':True,'title':'X','reason':'limit-detected','updatedAt':123456}}}
    storage_mock(page3,{'niakgpt-v08-cache':cache2,'niakgpt-continuity-v100':state})
    page3.add_script_tag(content=source('continuity-out-cache-v110.js'));page3.wait_for_timeout(120)
    got=page3.evaluate("window.__store['niakgpt-v08-cache']")
    assert got['chats'][0]['out'] is True and got['chats'][0]['outUpdatedAt']==123456
    assert got['projectChats']['g-p-x'][0]['out'] is True
    assert not errors3,errors3

    print(f'REGRESSION_0960_PASS browser={browser_name}')
    browser.close()

if __name__=='__main__':
  ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');a=ap.parse_args();run(a.browser)
