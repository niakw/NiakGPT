#!/usr/bin/env python3
from pathlib import Path
import argparse,json,os,sys
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('NIAKGPT_ROOT','.')).resolve()

def read(n):return (ROOT/n).read_text(encoding='utf-8')
def guard(s):return s.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],required=True);a=ap.parse_args()
 with sync_playwright() as p:
  bt={'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[a.browser];b=bt.launch(headless=True);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   projects=[{'id':f'dom-p-{i}','name':f'Project {i}','domOnly':True} for i in range(1,6)]+[{'id':f'g-p-project{i}','name':f'Project {i}','domOnly':False,'href':f'/g/g-p-project{i}/project'} for i in range(1,6)]
   chats=[{'id':f'{i:08x}-1234-1234-1234-{i:012x}','title':f'Chat {i}','projectId':f'dom-p-{((i-1)%5)+1}','updated':1786810000000+i} for i in range(1,9)]
   store={'niakgpt-v08-cache':{'schema':2,'projects':projects,'chats':chats,'counts':{f'dom-p-{i}':2 for i in range(1,6)}}}
   raw=json.dumps(store)
   page.set_content('<main></main>')
   page.add_script_tag(content=f"""(()=>{{const store={raw},listeners=[];window.chrome={{storage:{{local:{{get:async k=>typeof k==='string'?{{[k]:store[k]}}:{{...store}},set:async o=>{{const ch={{}};for(const[k,v]of Object.entries(o)){{store[k]=v;ch[k]={{newValue:v}}}}for(const fn of listeners)fn(ch,'local')}}}},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};window.__store=store;window.__NIAKGPT_DIAGNOSTICS__={{set:(k,v)=>{{window.__diag=[k,v]}}}};}})();""")
   page.add_script_tag(content=guard(read('project-assignment-selfheal-v103.js')));page.wait_for_timeout(450)
   got=page.evaluate("""()=>{const c=__store['niakgpt-v08-cache'];return{mapped:c.chats.filter(x=>String(x.projectId).startsWith('g-p-')).length,ids:[...new Set(c.chats.map(x=>x.projectId))],counts:Object.fromEntries(Object.entries(c.counts||{}).filter(([k])=>k.startsWith('g-p-'))),diag:window.__diag?.[1]||''}}""")
   ok=got['mapped']==8 and len(got['ids'])==5 and all(int(got['counts'].get(f'g-p-project{i}',0))>=1 for i in range(1,6)) and '8 chat(s)' in got['diag'] and not errors
   print(a.browser,'PASS' if ok else 'FAIL',json.dumps(got,ensure_ascii=False),json.dumps(errors,ensure_ascii=False));sys.exit(0 if ok else 1)
  finally:page.close();b.close()
if __name__=='__main__':main()
