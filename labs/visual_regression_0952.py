#!/usr/bin/env python3
from pathlib import Path
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','/mnt/data/niakgpt-0952-work')).resolve()
ART=Path(os.environ.get('NIAKGPT_ARTIFACTS','/mnt/data/niakgpt-0952-visual')).resolve()
ART.mkdir(parents=True,exist_ok=True)
CHAT='12345678-1234-1234-1234-123456789abc';P1='g-p-niakvio123';P2='g-p-niakgpt123'

def read(n): return (ROOT/n).read_text(encoding='utf-8')
def guard(s): return s.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def shim(store):
 raw=json.dumps(store,ensure_ascii=False)
 return f"""(()=>{{const store={raw};const listeners=[];const norm=(keys)=>{{if(keys==null)return{{...store}};if(typeof keys==='string')return{{[keys]:store[keys]}};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==='object'){{const out={{}};for(const [k,v] of Object.entries(keys))out[k]=store[k]===undefined?v:store[k];return out;}}return{{}};}};window.chrome={{runtime:{{getManifest:()=>({{version:'0.9.52'}})}},storage:{{local:{{get:async k=>norm(k),set:async obj=>{{const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:store[k],newValue:v}};store[k]=v;}}for(const fn of listeners)fn(changes,'local');}},remove:async keys=>{{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}}}},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};window.__niakStore=store;}})();"""

def launch(p,browser):
 bt={'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[browser]
 kw={'headless':True}
 if browser=='chromium' and os.environ.get('NIAKGPT_SYSTEM_CHROMIUM'):
  kw.update(executable_path=os.environ['NIAKGPT_SYSTEM_CHROMIUM'],args=['--no-sandbox'])
 return bt.launch(**kw)

def sidebar_case(browser,name):
 page=browser.new_page(viewport={'width':1360,'height':900})
 store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':P1,'name':'NiakVIO','href':f'/g/{P1}/project'},{'id':P2,'name':'NiakGPT','href':f'/g/{P2}/project'}],'chats':[{'id':CHAT,'title':'Correction ARCHI 2 GitHub','projectId':P1,'updated':1786818840000}],'counts':{P1:19,P2:6},'indexedProjectIds':[P1,P2],'serverIndexedAt':1786818840000},'niakgpt-governance-v085':{'coreProjectIds':[P1,P2],'hiddenProjectIds':[]}}
 try:
  page.set_content(f'''<style>html,body{{margin:0;background:#071019;color:#ddd;font:14px Arial}}nav{{width:308px;height:900px;overflow:auto;border-right:1px solid #234}}nav a,nav button{{display:block;padding:12px;color:#ddd}}main{{position:absolute;left:308px;right:0;top:0;bottom:0;background:#08131d}}</style><nav data-testid="conversation-sidebar"><div style="padding:16px;font-size:20px">ChatGPT Plus</div><section id="native-project-tree"><h2>Projects</h2><a id="native-p1" href="/g/{P1}">NiakVIO</a><div class="children"><a id="native-child" href="/g/{P1}/c/{CHAT}">Correction ARCHI 2 GitHub</a><a href="/g/{P1}/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">Correction problèmes précédents</a><button id="native-more">Afficher plus</button></div><a id="native-p2" href="/g/{P2}">NiakGPT</a></section><section id="recents"><h2>Récents</h2><a id="recent-chat" href="/c/{CHAT}">Correction ARCHI 2 GitHub</a></section></nav><main><h1>Conversation</h1></main>''')
  page.add_script_tag(content=shim(store));page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready'")
  for css in ('theme-v08.css','core-v090.css','pin-folders-v096.css'): page.add_style_tag(content=read(css))
  page.add_script_tag(content=guard(read('app-v090.js')));page.wait_for_timeout(1000)
  got=page.evaluate("""()=>{const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const pins=document.getElementById('ng8-pins');return{pins:vis(pins),pinCount:pins?.querySelectorAll('a[data-ng8-pin="1"]').length||0,n1:vis(document.getElementById('native-p1')),child:vis(document.getElementById('native-child')),more:vis(document.getElementById('native-more')),recent:vis(document.getElementById('recent-chat')),pinsBeforeNative:!!(pins&&pins.compareDocumentPosition(document.getElementById('native-project-tree'))&Node.DOCUMENT_POSITION_FOLLOWING)};}""")
  page.screenshot(path=str(ART/f'{name}-sidebar.png'),full_page=True)
  return {'sidebar_owned':got['pins'] and got['pinCount']>=2,'native_project_hidden':not got['n1'],'native_project_chat_hidden':not got['child'],'native_project_more_hidden':not got['more'],'recents_preserved':got['recent'],'managed_slot_first':got['pinsBeforeNative']}
 finally: page.close()

def panel_case(browser,name):
 page=browser.new_page(viewport={'width':1710,'height':900})
 try:
  page.set_content('''<style>html,body{margin:0;width:100%;height:100%;background:#05090d;color:white}.left{position:fixed;left:0;top:0;bottom:0;width:308px;background:#07121b}.workspace{position:fixed;left:308px;right:46px;top:0;bottom:24px;display:flex}.chat{flex:1 1 auto;min-width:0;background:#08131d;padding:40px}.rail{position:fixed;right:0;top:0;bottom:24px;width:46px;background:#07121b}</style><aside class="left"></aside><div class="workspace"><main class="chat"><h1>Longue conversation</h1><p>Le contenu doit garder sa largeur.</p></main></div><div id="ng8-rail" class="rail"></div>''')
  page.add_style_tag(content=read('side-panels-v096.css'));page.add_script_tag(content=guard(read('side-panels-v096.js')));page.wait_for_timeout(150)
  before=page.evaluate("document.querySelector('main').getBoundingClientRect().width")
  page.evaluate("""()=>{const p=document.createElement('div');p.id='native-right';p.style.cssText='width:430px;flex:0 0 430px;background:#020406;border-left:1px solid #333;overflow:auto';p.innerHTML='<div><h2>Activité</h2><h3>Réflexion</h3><pre style="width:720px">repo_full_name: niakw/NiakGPT — long output</pre></div>';document.querySelector('.workspace').appendChild(p)}""")
  page.wait_for_timeout(500)
  got=page.evaluate("""()=>{const p=document.getElementById('native-right'),r=p.getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect(),rail=document.getElementById('ng8-rail').getBoundingClientRect();return{marked:p.classList.contains('ng96-native-sidepanel'),fixed:getComputedStyle(p).position,width:r.width,right:r.right,railLeft:rail.left,mainWidth:m.width,overflow:p.scrollWidth<=p.clientWidth+2};}""")
  page.screenshot(path=str(ART/f'{name}-panel-activity.png'),full_page=True)
  page.evaluate("document.querySelector('#native-right h2').textContent='Sources';document.querySelector('#native-right h3').textContent='Sources';document.getElementById('native-right').dispatchEvent(new Event('click',{bubbles:true}))");page.wait_for_timeout(180)
  page.screenshot(path=str(ART/f'{name}-panel-sources.png'),full_page=True)
  return {'panel_detected':got['marked'] and got['fixed']=='fixed','panel_overlay_width':318<=got['width']<=422,'panel_left_of_rail':abs(got['right']-got['railLeft'])<3,'chat_not_squeezed':got['mainWidth']>=before-4,'panel_content_contained':got['overflow']}
 finally: page.close()

def long_case(browser,name):
 page=browser.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 store={'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{},'indexedProjectIds':[],'serverIndexedAt':1},'niakgpt-governance-v085':{'coreProjectIds':[],'hiddenProjectIds':[]},'niakgpt-continuity-v100':{'schema':1,'out':{}}}
 turns=''.join(f'<article data-testid="conversation-turn-{i}"><div data-message-author-role="{("user" if i%2 else "assistant")}">message {i}</div></article>' for i in range(500))
 try:
  page.set_content(f'<nav data-testid="conversation-sidebar"></nav><main>{turns}<div id="prompt-textarea" contenteditable="true"></div></main>')
  page.add_script_tag(content=shim(store))
  page.evaluate("""()=>{window.__obs=[];const Native=window.MutationObserver;window.MutationObserver=class extends Native{observe(target,opts){window.__obs.push({tag:target===document.querySelector('main')?'MAIN':target.getAttribute?.('data-message-author-role')||target.tagName,characterData:!!opts.characterData,subtree:!!opts.subtree});return super.observe(target,opts)}};document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready';}""")
  t=time.monotonic();page.add_script_tag(content=guard(read('app-v090.js')));page.add_script_tag(content=guard(read('continuity-v100.js')));page.add_script_tag(content=guard(read('activity-ui-v097.js')));page.wait_for_timeout(2600);elapsed=time.monotonic()-t
  initial=page.evaluate("()=>({decorated:document.querySelectorAll('[data-ng8-turn]').length,heavy:document.documentElement.dataset.ng8Heavy,mainChar:__obs.filter(x=>x.tag==='MAIN'&&x.characterData).length,mainObservers:__obs.filter(x=>x.tag==='MAIN').length})")
  page.evaluate("document.documentElement.dataset.ng86Activity='thinking';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'thinking',active:true}}))")
  page.evaluate("""()=>{const old=document.querySelector('[data-testid="conversation-turn-10"] [data-message-author-role]');for(let i=0;i<1000;i++)old.textContent='old '+i;const last=document.querySelector('[data-testid="conversation-turn-498"] [data-message-author-role="assistant"]');if(last)last.textContent+=' live';}""")
  page.wait_for_timeout(600);during=page.evaluate("document.querySelectorAll('[data-ng8-turn]').length")
  page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'ready',active:false}}))");page.wait_for_timeout(2200)
  final=page.evaluate("()=>({decorated:document.querySelectorAll('[data-ng8-turn]').length,heavy:document.documentElement.dataset.ng8Heavy,composer:!!document.querySelector('#prompt-textarea'),mainChar:__obs.filter(x=>x.tag==='MAIN'&&x.characterData).length})")
  page.screenshot(path=str(ART/f'{name}-long-thread.png'),full_page=False)
  return {'long_initial_bounded':initial['heavy']=='1' and 120<=initial['decorated']<=180,'no_main_character_observer':initial['mainChar']==0 and final['mainChar']==0,'streaming_does_not_rescan_history':during<=initial['decorated']+2,'long_ready_bounded':final['decorated']<=180 and final['composer'],'long_no_page_errors':not errors,'long_boot_reasonable':elapsed<6.0}
 finally: page.close()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');a=ap.parse_args()
 with sync_playwright() as p:
  b=launch(p,a.browser);res={}
  try:
   res.update(sidebar_case(b,a.browser));res.update(panel_case(b,a.browser));res.update(long_case(b,a.browser))
  finally:b.close()
 ok=all(res.values());print(a.browser,'PASS' if ok else 'FAIL',json.dumps(res,ensure_ascii=False,sort_keys=True));sys.exit(0 if ok else 1)
if __name__=='__main__':main()
