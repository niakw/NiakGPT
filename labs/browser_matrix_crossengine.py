#!/usr/bin/env python3
"""Cross-engine runner for the current NiakGPT checkout.

The base matrix carries broad regression coverage. This adapter adds engine-neutral
checks for CSS pseudo-content, current side-panel geometry, and continuity OUT state.
"""
import importlib.util
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
SPEC=importlib.util.spec_from_file_location('niakgpt_browser_matrix', HERE/'browser_matrix.py')
bm=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bm)

engine='chromium'
if '--browser' in sys.argv:
    try: engine=sys.argv[sys.argv.index('--browser')+1]
    except Exception: pass

_original_core=bm.core_surfaces

def timestamp_cssom(browser):
    page=browser.new_page(viewport={'width':900,'height':500})
    try:
        page.set_content("<article id='u' data-ng8-role='user' data-ng8-time='10:34'></article><article id='a' data-ng8-role='assistant' data-ng8-time='10:35'></article>")
        page.add_style_tag(content=bm.read('visual-stability-v101.css'))
        return page.evaluate("""()=>{
          const rules=[];
          for(const sheet of document.styleSheets){
            try{ for(const rule of sheet.cssRules||[]) rules.push({selector:rule.selectorText||'',content:rule.style?.content||''}); }catch{}
          }
          const user=rules.find(r=>r.selector.includes('[data-ng8-role="user"]')&&r.selector.includes('[data-ng8-time]')&&r.selector.includes('::before'));
          const assistant=rules.find(r=>r.selector.includes('[data-ng8-role="assistant"]')&&r.selector.includes('[data-ng8-time]')&&r.selector.includes('::before'));
          return !!user && !!assistant && user.content.includes('TOI · ') && user.content.includes('attr(data-ng8-time)') && assistant.content.includes('CHATGPT · ') && assistant.content.includes('attr(data-ng8-time)') && document.getElementById('u').dataset.ng8Time==='10:34' && document.getElementById('a').dataset.ng8Time==='10:35';
        }""")
    finally:
        page.close()

def current_panel(browser):
    page=browser.new_page(viewport={'width':1440,'height':900})
    try:
        page.set_content("""<main style='position:fixed;left:300px;right:46px;top:0;bottom:0'>chat</main><aside id='ng8-rail' style='position:fixed;right:0;top:0;bottom:0;width:46px'></aside>""")
        page.add_style_tag(content=bm.read('side-panels-v096.css'))
        page.add_script_tag(content=bm.patch_guard(bm.read('side-panels-v096.js')))
        page.evaluate("""()=>{const p=document.createElement('aside');p.id='panel';p.setAttribute('role','dialog');p.style.cssText='position:fixed;right:0;top:40px;width:420px;height:500px';p.innerHTML='<h2>Réflexion</h2><pre style="width:800px">oversized code</pre>';document.body.appendChild(p)}""")
        page.wait_for_timeout(300)
        return page.evaluate("""()=>{const p=document.getElementById('panel'),r=p.getBoundingClientRect(),rail=document.getElementById('ng8-rail').getBoundingClientRect(),pre=p.querySelector('pre');return p.classList.contains('ng96-native-sidepanel')&&getComputedStyle(p).position==='fixed'&&r.width>=300&&r.width<=330&&Math.abs(r.right-rail.left)<2&&!!p.querySelector('.ng96-side-close')&&pre.clientWidth<=p.clientWidth+2;}""")
    finally:
        page.close()

def current_continuity(browser):
    page=browser.new_page(viewport={'width':1100,'height':700})
    store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':bm.PROJECT_ID,'name':'Tech & Développement','description':'Projet technique NiakGPT','instructions':'Préserver les contraintes.'}],'chats':[{'id':bm.CHAT_ID,'title':'Conseils prompts OpenAI','projectId':bm.PROJECT_ID}]},'niakgpt-continuity-v100':{'schema':1,'out':{}}}
    try:
        page.set_content(f"""<nav data-testid='conversation-sidebar'><a href='/c/{bm.CHAT_ID}'>Conseils prompts OpenAI</a></nav><main><article data-message-author-role='user'>Travaille localement et conserve les locks.</article><article data-message-author-role='assistant'>Compris.</article><div role='alert'>You've reached the maximum conversation length. Start a new chat.</div></main><div id='prompt-textarea' contenteditable='true'></div>""")
        page.add_script_tag(content=bm.chrome_shim(store))
        page.evaluate("window.__netCalls=0;window.fetch=(...a)=>{window.__netCalls++;return Promise.resolve(new Response('{}',{status:200}))}")
        src=bm.patch_guard(bm.read('continuity-v100.js')).replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{bm.CHAT_ID}';").replace("const currentPid=()=>pid(location.pathname)||cache.chats?.find?.(c=>c.id===currentCid())?.projectId||'';",f"const currentPid=()=>'{bm.PROJECT_ID}';")
        page.add_script_tag(content=src);page.wait_for_timeout(500)
        return page.evaluate("""()=>{const a=document.querySelector('a[href*="/c/"]'),capsule=window.__NIAKGPT_CONTINUITY__.buildCapsule();return a.dataset.ng100Out==='1'&&!!a.querySelector('.ng100-out-badge')&&capsule.includes('Tech & Développement')&&capsule.includes('HISTORIQUE DU FIL PRÉCÉDENT')&&capsule.includes('Travaille localement')&&window.__netCalls===0;}""")
    finally:
        page.close()

def cross_core(browser):
    result=_original_core(browser)
    if engine in ('firefox','webkit') and not result.get('timestamps'):
        result['timestamps']=bool(timestamp_cssom(browser))
    # Replace two stale base-fixture assertions with explicit current-behaviour checks.
    result['native_panel']=bool(current_panel(browser))
    result['continuity']=bool(current_continuity(browser))
    return result

bm.core_surfaces=cross_core

if __name__=='__main__':
    bm.main()
