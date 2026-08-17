#!/usr/bin/env python3
from pathlib import Path
import argparse, json, os
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','.')).resolve()
def read(n): return (ROOT/n).read_text(encoding='utf-8')
def guard(s): return s.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def launch(p,b): return {'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[b].launch(headless=True)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],required=True);a=ap.parse_args()
 with sync_playwright() as p:
  b=launch(p,a.browser);page=b.new_page();errors=[];logs=[]
  page.on('pageerror',lambda e: errors.append(str(e)));page.on('console',lambda m: logs.append((m.type,m.text)))
  try:
   page.set_content('<main></main><div id="ng8-panel"></div>')
   page.add_script_tag(content="""(()=>{const store={'niakgpt-settings-v090':{safeMode:false},'niakgpt-v08-cache':{schema:2,projects:[],chats:[],counts:{}}},listeners=[];window.__storageInvalid=false;const invalid=()=>{throw new Error('Extension context invalidated.')};const norm=k=>typeof k==='string'?{[k]:store[k]}:{...store};window.chrome={runtime:{id:'niakgpt-test',getManifest:()=>({version:'0.9.53'})},storage:{local:{get:async k=>{if(__storageInvalid)return invalid();return norm(k)},set:async o=>{if(__storageInvalid)return invalid();Object.assign(store,o);for(const fn of listeners)fn(Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{newValue:v}])),'local')}},onChanged:{addListener:fn=>listeners.push(fn)}}};window.__NIAKGPT_DIAGNOSTICS__={set:()=>{}};window.__bcPosts=0;window.__bcClosedPosts=0;class FakeBC{constructor(){this.closed=false;this.listeners=[]}addEventListener(t,fn){if(t==='message')this.listeners.push(fn)}removeEventListener(t,fn){this.listeners=this.listeners.filter(x=>x!==fn)}postMessage(){if(this.closed){__bcClosedPosts++;throw new DOMException('Channel is closed','InvalidStateError')}__bcPosts++}close(){this.closed=true}}window.BroadcastChannel=FakeBC;Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async()=>{throw new DOMException('Document is not active','InvalidStateError')}}});})();""")
   page.add_script_tag(content=guard(read('cache-bus-v096.js')));page.add_script_tag(content=guard(read('multitab-v090.js')));page.wait_for_timeout(500)
   page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));document.documentElement.dataset.ng8Heavy='1';document.documentElement.dataset.ng86Activity='thinking';")
   page.wait_for_timeout(300);page.evaluate("window.__storageInvalid=true");page.evaluate("()=>window.__NIAKGPT_CACHE_BUS__.update(cur=>({...cur,at:Date.now()}))");page.wait_for_timeout(150)
   print(a.browser,'PAGEERRORS',json.dumps(errors,ensure_ascii=False));print(a.browser,'CONSOLE',json.dumps(logs,ensure_ascii=False));print(a.browser,'BC',page.evaluate("()=>({posts:__bcPosts,closed:__bcClosedPosts,role:document.documentElement.dataset.ng8TabRole,bus:__NIAKGPT_CACHE_BUS__.active()})"))
  finally: page.close();b.close()
if __name__=='__main__':main()
