#!/usr/bin/env python3
from pathlib import Path
import argparse,json,os,sys
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('NIAKGPT_ROOT','.')).resolve();ART=Path(os.environ.get('NIAKGPT_ARTIFACTS','/tmp/niakgpt-0953-visual'));ART.mkdir(parents=True,exist_ok=True)

def read(n):return (ROOT/n).read_text(encoding='utf-8')
def guard(s):return s.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],required=True);a=ap.parse_args()
 with sync_playwright() as p:
  bt={'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[a.browser];b=bt.launch(headless=True);page=b.new_page(viewport={'width':1360,'height':900});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  try:
   local=[{'id':f'dom-p-{i}','name':f'Project {i}','domOnly':True} for i in range(1,6)];chats=[{'id':f'{i:08x}-1234-1234-1234-{i:012x}','title':f'Conversation {i}','projectId':f'dom-p-{((i-1)%5)+1}','updated':1786810000000+i} for i in range(1,9)]
   store={'niakgpt-v08-cache':{'schema':2,'projects':local,'chats':chats,'counts':{f'dom-p-{i}':2 for i in range(1,6)}},'niakgpt-governance-v085':{'seeded':True,'coreProjectIds':[],'hiddenProjectIds':[],'locks':{}}}
   native=''.join(f'<a class="native-project" id="native-{i}" href="/g/g-p-project{i}"><span>Project {i}</span></a>' for i in range(1,6))
   page.set_content(f'''<style>html,body{{margin:0;background:#071019;color:#ddd;font:14px Arial}}nav{{width:308px;height:900px;overflow:auto;border-right:1px solid #234}}nav a{{display:block;padding:12px;color:#ddd}}main{{position:absolute;left:308px;right:0;top:0;bottom:0;background:#08131d;padding:36px}}</style><nav data-testid="conversation-sidebar"><div style="padding:16px;font-size:20px">ChatGPT</div><section id="native-projects"><h2>Projects</h2>{native}</section><section><h2>Récents</h2><a href="/c/{chats[0]['id']}">Conversation 1</a></section></nav><main><h1>Conversation longue</h1><p>La sidebar NiakGPT doit remplacer le système Projects natif.</p></main>''')
   raw=json.dumps(store);page.add_script_tag(content=f"""(()=>{{const store={raw},ls=[];window.chrome={{runtime:{{id:'test',getManifest:()=>({{version:'0.9.53'}})}},storage:{{local:{{get:async k=>typeof k==='string'?{{[k]:store[k]}}:Object.fromEntries((Array.isArray(k)?k:Object.keys(store)).map(x=>[x,store[x]])),set:async o=>{{const ch={{}};for(const[k,v]of Object.entries(o)){{store[k]=v;ch[k]={{newValue:v}}}}for(const fn of ls)fn(ch,'local')}}}},onChanged:{{addListener:fn=>ls.push(fn)}}}}}};window.__store=store;const d=new Map();window.__NIAKGPT_DIAGNOSTICS__={{set:(k,v)=>d.set(k,String(v)),snapshot:()=>Object.fromEntries(d)}};}})();""")
   page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng100CacheGuard='ready';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off'")
   for css in ('theme-v08.css','core-v090.css','pin-folders-v096.css'):page.add_style_tag(content=read(css))
   page.add_script_tag(content=guard(read('app-v090.js')));page.add_script_tag(content=guard(read('project-state-selfheal-v102.js')));page.add_script_tag(content=guard(read('project-assignment-selfheal-v103.js')));page.wait_for_timeout(1000)
   got=page.evaluate("""()=>{const vis=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const c=__store['niakgpt-v08-cache'];return{pins:document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]').length,nativeVisible:[...document.querySelectorAll('.native-project')].filter(vis).length,core:(__store['niakgpt-governance-v085']?.coreProjectIds||[]).length,mapped:c.chats.filter(x=>String(x.projectId).startsWith('g-p-')).length};}""")
   page.screenshot(path=str(ART/f'{a.browser}-project-recovery-0953.png'),full_page=True)
   ok=got['pins']==5 and got['nativeVisible']==0 and got['core']==5 and got['mapped']==8 and not errs
   print(a.browser,'PASS' if ok else 'FAIL',json.dumps(got),json.dumps(errs));sys.exit(0 if ok else 1)
  finally:page.close();b.close()
if __name__=='__main__':main()
