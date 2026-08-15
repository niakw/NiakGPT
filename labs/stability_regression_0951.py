#!/usr/bin/env python3
from pathlib import Path
import json,os,sys,time
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('NIAKGPT_ROOT','/mnt/data/niakgpt-0951-work')).resolve()
CHROMIUM=os.environ.get('NIAKGPT_SYSTEM_CHROMIUM','/usr/bin/chromium')
CHAT='12345678-1234-1234-1234-123456789abc'; P='g-p-tech123'
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def guard(src):return src.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def shim(store):
 raw=json.dumps(store,ensure_ascii=False)
 return f"""(()=>{{const store={raw};const ls=[];const norm=k=>{{if(k==null)return{{...store}};if(typeof k==='string')return{{[k]:store[k]}};if(Array.isArray(k))return Object.fromEntries(k.map(x=>[x,store[x]]));if(typeof k==='object')return Object.fromEntries(Object.entries(k).map(([x,v])=>[x,store[x]===undefined?v:store[x]]));return{{}}}};window.chrome={{runtime:{{getManifest:()=>({{version:'0.9.51'}})}},storage:{{local:{{get:async k=>norm(k),set:async o=>Object.assign(store,o),remove:async()=>{{}}}},onChanged:{{addListener:f=>ls.push(f)}}}}}};window.__store=store;}})();"""

def project_dedupe(browser):
 page=browser.new_page(viewport={'width':1000,'height':800})
 store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':P,'name':'Tech & Développement','href':f'/g/{P}/project','domOnly':False}],'chats':[],'counts':{P:8},'indexedProjectIds':[P],'serverIndexedAt':1},'niakgpt-governance-v085':{'coreProjectIds':[P],'hiddenProjectIds':[]}}
 try:
  # Deliberately use a plain DIV label and a wrapper that also contains Recents so section-level hiding is unsafe.
  page.set_content(f"""<nav data-testid='conversation-sidebar'><div id='native-wrap'><div id='native-label'>Projets</div><a id='native-project' href='/g/{P}/project'>Tech & Développement</a><div><div>Récents</div><a href='/c/{CHAT}'>Long chat</a></div></div></nav><main></main>""")
  page.add_script_tag(content=shim(store));page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready'")
  page.add_style_tag(content=read('theme-v08.css'));page.add_style_tag(content=read('core-v090.css'));page.add_script_tag(content=guard(read('app-v090.js')));page.wait_for_timeout(700)
  return page.evaluate("""()=>({ours:!!document.querySelector('#ng8-pins a[data-ng8-pin="1"]'),nativeHidden:getComputedStyle(document.getElementById('native-project')).display==='none',labelHidden:getComputedStyle(document.getElementById('native-label')).display==='none',chatVisible:getComputedStyle(document.querySelector(`a[href='/c/${'12345678-1234-1234-1234-123456789abc'}']`)).display!=='none'})""")
 finally:page.close()

def bridge_pause(browser):
 page=browser.new_page()
 try:
  page.set_content('<main></main>');page.evaluate("window.__net=[];window.fetch=async (url,init={})=>{window.__net.push(String(url));if(String(url)==='/api/auth/session')return new Response(JSON.stringify({accessToken:'t'}),{status:200,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({items:[]}),{status:200,headers:{'content-type':'application/json'}})}")
  page.add_script_tag(content=guard(read('page-bridge.js')))
  baseline=page.evaluate('window.__net.length')
  page.evaluate("document.documentElement.dataset.ng86Activity='thinking';document.documentElement.dataset.ng8Running='1'")
  busy=page.evaluate("""async()=>new Promise(resolve=>{const id='busy';const h=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail)};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0',method:'GET',governance:true}}));})""")
  net_busy=page.evaluate('window.__net.length')
  page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8Running='0'")
  ready=page.evaluate("""async()=>new Promise(resolve=>{const id='ready';const h=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail)};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0',method:'GET',governance:true}}));})""")
  net_ready=page.evaluate('window.__net.length')
  return {'busy':busy,'net_busy':net_busy,'ready':ready,'net_ready':net_ready,'baseline':baseline}
 finally:page.close()

def heavy_activity(browser):
 page=browser.new_page(viewport={'width':1200,'height':800})
 turns=''.join(f'<article data-testid="conversation-turn-{i}"><div data-message-author-role="{("user" if i%2 else "assistant")}" id="m{i}">m{i}</div></article>' for i in range(340))
 try:
  page.set_content(f'<nav data-testid="conversation-sidebar"><a href="/c/{CHAT}">Long</a></nav><main>{turns}</main><div id="prompt-textarea" contenteditable="true"></div>')
  page.add_script_tag(content=shim({}));page.evaluate("document.documentElement.dataset.ng8Heavy='1'")
  page.add_script_tag(content=guard(read('activity-ui-v097.js')));page.wait_for_timeout(1400)
  page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));")
  # Explicitly trigger waiting through a fake send button, then mutate an OLD turn many times.
  page.evaluate("""()=>{const b=document.createElement('button');b.setAttribute('aria-label','Envoyer');document.body.appendChild(b);b.click()}""");page.wait_for_timeout(100)
  before=page.evaluate("document.documentElement.dataset.ng86Activity")
  page.evaluate("""()=>{const n=document.getElementById('m20');for(let i=0;i<800;i++)n.firstChild.data='old-'+i}""");page.wait_for_timeout(550)
  after_old=page.evaluate("document.documentElement.dataset.ng86Activity")
  # Mutating latest assistant is allowed to signal execution.
  page.evaluate("""()=>{const n=document.querySelector('[data-message-author-role="assistant"]:last-of-type')||[...document.querySelectorAll('[data-message-author-role="assistant"]')].at(-1);n.textContent+=' streamed'}""");page.wait_for_timeout(700)
  after_latest=page.evaluate("document.documentElement.dataset.ng86Activity")
  return {'before':before,'after_old':after_old,'after_latest':after_latest}
 finally:page.close()

def main():
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox'])
  try:
   d=project_dedupe(b);bp=bridge_pause(b);ha=heavy_activity(b)
  finally:b.close()
 res={
  'ours_projects':d['ours'],'native_project_hidden':d['nativeHidden'],'native_label_hidden':d['labelHidden'],'recents_preserved':d['chatVisible'],
  'bridge_pauses_when_native_busy':bp['busy'].get('error')=='native_busy' and bp['net_busy']==bp['baseline'],
  'bridge_resumes_when_ready':bool(bp['ready'].get('ok')) and bp['net_ready']>=bp['baseline']+2,
  'old_turn_mutations_do_not_mark_execution':ha['before'] in ('waiting','thinking') and ha['after_old'] in ('waiting','thinking'),
  'latest_assistant_mutation_detected':ha['after_latest']=='executing',
 }
 ok=all(res.values());print(('PASS' if ok else 'FAIL'),json.dumps(res,ensure_ascii=False,sort_keys=True));sys.exit(0 if ok else 1)
if __name__=='__main__':main()
