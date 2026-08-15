#!/usr/bin/env python3
"""Cross-engine runner for NiakGPT regression labs.

Chromium keeps the strict computed pseudo-content assertion from browser_matrix.py.
Firefox/WebKit additionally validate the timestamp pseudo-elements through CSSOM,
because getComputedStyle(..., '::before').content is not serialized consistently
across engines even when the rule is parsed and rendered.
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

def cross_core(browser):
    result=_original_core(browser)
    if engine in ('firefox','webkit') and not result.get('timestamps'):
        result['timestamps']=bool(timestamp_cssom(browser))
    return result

bm.core_surfaces=cross_core

if __name__=='__main__':
    bm.main()
