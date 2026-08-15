#!/usr/bin/env python3
from pathlib import Path
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','/mnt/data/niakgpt-0951-work')).resolve()
CHROMIUM=os.environ.get('NIAKGPT_SYSTEM_CHROMIUM','/usr/bin/chromium')
CHAT='12345678-1234-1234-1234-123456789abc'
P1='g-p-niakvio123'
P2='g-p-niakgpt123'

def read(name): return (ROOT/name).read_text(encoding='utf-8')
def guard(src): return src.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")

def shim(store):
    raw=json.dumps(store,ensure_ascii=False)
    return f"""(()=>{{const store={raw};const listeners=[];const norm=(keys)=>{{if(keys==null)return{{...store}};if(typeof keys==='string')return{{[keys]:store[keys]}};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==='object'){{const out={{}};for(const [k,v] of Object.entries(keys))out[k]=store[k]===undefined?v:store[k];return out;}}return{{}};}};window.chrome={{runtime:{{getManifest:()=>({{version:'0.9.51'}})}},storage:{{local:{{get:async k=>norm(k),set:async obj=>{{const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:store[k],newValue:v}};store[k]=v;}}for(const fn of listeners)fn(changes,'local');}},remove:async keys=>{{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}}}},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};window.__niakStore=store;}})();"""

def panel_test(browser):
    page=browser.new_page(viewport={'width':1710,'height':900})
    try:
        page.set_content("""
        <style>html,body{margin:0;width:100%;height:100%}body{--ng8-rail:46px;padding-right:46px;box-sizing:border-box}.shell{display:flex;width:100%;height:876px}.left{width:308px;flex:0 0 308px}.chat{flex:1 1 auto;min-width:0;background:#111}.native{flex:0 0 430px;width:430px;background:#050505;color:white}</style>
        <aside class='left'></aside><div class='shell'><main class='chat'><div style='width:760px;margin:auto'>chat</div></main></div>
        <aside id='ng8-rail' style='position:fixed;right:0;top:0;bottom:24px;width:46px;display:block'></aside>
        """)
        page.add_style_tag(content=read('side-panels-v096.css'))
        page.add_script_tag(content=guard(read('side-panels-v096.js')))
        page.wait_for_timeout(120)
        before=page.evaluate("()=>document.querySelector('main').getBoundingClientRect().width")
        page.evaluate("""()=>{const shell=document.querySelector('.shell');const p=document.createElement('aside');p.className='native';p.setAttribute('aria-label','Activité');p.innerHTML='<h2>Activité</h2><pre style="width:700px">code</pre>';shell.appendChild(p)}""")
        page.wait_for_timeout(350)
        got=page.evaluate("""()=>{const p=document.querySelector('.native'),m=document.querySelector('main'),r=p.getBoundingClientRect(),mr=m.getBoundingClientRect(),rail=getComputedStyle(document.getElementById('ng8-rail'));return{marked:p.classList.contains('ng96-native-sidepanel'),width:r.width,right:r.right,mainWidth:mr.width,railVisibility:rail.visibility,railOpacity:rail.opacity,nativeFlag:document.documentElement.dataset.ng96NativePanel||'',scroll:p.scrollWidth<=p.clientWidth+1}}""")
        return {
          'panel_marked': got['marked'],
          'panel_width_320': 318 <= got['width'] <= 322,
          'panel_left_of_rail': abs(got['right']-(1710-46)) < 2,
          'main_not_shifted': abs(got['mainWidth']-before) < 4,
          'rail_kept': got['railVisibility']!='hidden' and float(got['railOpacity'])>0.9,
          'panel_flag': got['nativeFlag']=='1',
          'panel_content_contained': got['scroll'],
        }
    finally: page.close()

def sidebar_test(browser):
    page=browser.new_page(viewport={'width':1200,'height':800})
    store={
      'niakgpt-v08-cache':{'schema':2,'projects':[{'id':P1,'name':'NiakVIO','href':f'/g/{P1}/project','domOnly':False},{'id':P2,'name':'NiakGPT','href':f'/g/{P2}/project','domOnly':False}],'chats':[{'id':CHAT,'title':'Correction bug TV','projectId':P1,'updated':1786818840000}],'counts':{P1:17,P2:6},'indexedProjectIds':[P1,P2],'serverIndexedAt':1786818840000},
      'niakgpt-governance-v085':{'coreProjectIds':[P1,P2],'hiddenProjectIds':[]},
    }
    html=f"""
      <nav data-testid='conversation-sidebar' style='height:760px;overflow:auto;width:300px'>
        <div class='top'>Top</div>
        <section id='native-projects'><h2>Projets</h2><a href='/g/{P1}/project'><span>NiakVIO</span></a><a href='/g/{P2}/project'><span>NiakGPT</span></a></section>
        <section id='recents'><h2>Récents</h2><a id='chatrow' href='/c/{CHAT}'><span class='truncate'><span>Correction bug TV</span></span><span class='dup'>Correction bug TV</span></a></section>
      </nav><main></main>
    """
    try:
        page.set_content(html)
        page.add_script_tag(content=shim(store))
        page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready'")
        page.add_style_tag(content=read('theme-v08.css'));page.add_style_tag(content=read('core-v090.css'))
        page.add_script_tag(content=guard(read('app-v090.js')))
        page.wait_for_timeout(700)
        got=page.evaluate("""()=>{const native=document.getElementById('native-projects'),dup=document.querySelector('#chatrow .dup'),pins=document.getElementById('ng8-pins'),list=pins?.querySelector('.ng8-pin-list');return{pins:!!pins,pinCount:pins?.querySelectorAll('a[data-ng8-pin="1"]').length||0,nativeDisplay:getComputedStyle(native).display,nativeClass:native.classList.contains('ng8-native-projects-suppressed'),dupHidden:dup?.dataset.ng8TitleDuplicate==='1'&&getComputedStyle(dup).display==='none',pinOverflow:list?getComputedStyle(list).overflowY:'',pinScroll:list?list.scrollHeight-list.clientHeight:999}}""")
        return {
          'managed_projects_present': got['pins'] and got['pinCount']==2,
          'native_projects_suppressed': got['nativeClass'] and got['nativeDisplay']=='none',
          'duplicate_chat_title_hidden': bool(got['dupHidden']),
          'single_scroll_owner': got['pinOverflow'] in ('visible','clip') and got['pinScroll'] <= 1,
        }
    finally: page.close()

def background_test(browser):
    page=browser.new_page(viewport={'width':1200,'height':800})
    try:
        page.set_content("<body class='ng8-ready'><main><canvas id='ng8-matrix'></canvas></main></body>")
        page.evaluate("document.documentElement.dataset.ng90Matrix='subtle';document.documentElement.dataset.ng86Activity='ready'")
        page.add_style_tag(content=read('visual-stability-v101.css'))
        got=page.evaluate("()=>({opacity:parseFloat(getComputedStyle(document.getElementById('ng8-matrix')).opacity),bg:getComputedStyle(document.body,'::before').backgroundImage})")
        return {'matrix_subtle': got['opacity'] <= .10, 'background_gradient': 'radial-gradient' in got['bg'] and 'linear-gradient' in got['bg']}
    finally: page.close()

def main():
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox'])
      try:
        results={};results.update(panel_test(browser));results.update(sidebar_test(browser));results.update(background_test(browser))
      finally: browser.close()
    ok=all(results.values())
    print(('PASS' if ok else 'FAIL'),json.dumps(results,ensure_ascii=False,sort_keys=True))
    sys.exit(0 if ok else 1)
if __name__=='__main__': main()
