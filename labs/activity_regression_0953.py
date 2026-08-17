#!/usr/bin/env python3
from pathlib import Path
import argparse,json,os,sys
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','.')).resolve()
CHAT='11111111-1111-4111-8111-111111111111'

def read(n): return (ROOT/n).read_text(encoding='utf-8')
def guard(s): return s.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def launch(p,b): return {'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[b].launch(headless=True)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],required=True);a=ap.parse_args()
 with sync_playwright() as p:
  b=launch(p,a.browser);page=b.new_page(viewport={'width':1100,'height':700});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content(f'''<nav data-testid="conversation-sidebar"><a id="chat" href="/c/{CHAT}">Current chat</a></nav><main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">Ready</div></article><div id="thinking-host"></div><form><textarea id="prompt-textarea">hello</textarea><button id="send" type="button" data-testid="send-button" aria-label="Envoyer">Send</button></form></main><div id="ng8-status"><span><b>NiakGPT</b> 0.9.53</span></div>''')
   page.add_script_tag(content="""(()=>{window.chrome={runtime:{getManifest:()=>({version:'0.9.53'})}};window.BroadcastChannel=class{addEventListener(){}postMessage(){}close(){}};})();""")
   page.add_script_tag(content=guard(read('activity-ui-v097.js')));page.wait_for_timeout(180)
   ready=page.evaluate("document.documentElement.dataset.ng86Activity")
   page.locator('#send').click()
   page.wait_for_function("document.documentElement.dataset.ng86Activity==='waiting'",timeout=1000)
   waiting=page.evaluate("()=>({state:document.documentElement.dataset.ng86Activity,row:document.getElementById('chat').dataset.ng86Activity||''})")
   page.evaluate("""()=>{const x=document.createElement('div');x.id='native-thinking';x.dataset.testid='thinking-indicator';x.dataset.state='thinking';x.setAttribute('aria-busy','true');x.textContent='Réflexion en cours';document.getElementById('thinking-host').appendChild(x)}""")
   page.wait_for_function("document.documentElement.dataset.ng86Activity==='thinking'",timeout=2500)
   thinking=page.evaluate("()=>({state:document.documentElement.dataset.ng86Activity,label:document.querySelector('.ng86-status-state')?.textContent||''})")
   ok=ready=='ready' and waiting['state']=='waiting' and thinking['state']=='thinking' and 'RÉFLEXION' in thinking['label'] and not errors
   print(a.browser,'PASS' if ok else 'FAIL',json.dumps({'ready':ready,'waiting':waiting,'thinking':thinking,'errors':errors},ensure_ascii=False));sys.exit(0 if ok else 1)
  finally: page.close();b.close()
if __name__=='__main__': main()
