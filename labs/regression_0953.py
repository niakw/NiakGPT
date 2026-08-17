#!/usr/bin/env python3
from pathlib import Path
import argparse, json, os, sys
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','.')).resolve()
PIDS=[f'g-p-project{i}' for i in range(1,6)]
CHATS=[f'{i:08x}-1234-1234-1234-{i:012x}' for i in range(1,9)]

def read(name): return (ROOT/name).read_text(encoding='utf-8')
def guard(src):
    return src.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")

def launch(p,browser):
    bt={'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}[browser]
    return bt.launch(headless=True)

def storage_shim(store, with_runtime=True):
    raw=json.dumps(store,ensure_ascii=False)
    rid="id:'niakgpt-test'," if with_runtime else ''
    return f"""(()=>{{
      const store={raw},listeners=[];
      window.__storageInvalid=false;
      const invalid=()=>{{throw new Error('Extension context invalidated.');}};
      const norm=keys=>{{if(keys==null)return{{...store}};if(typeof keys==='string')return{{[keys]:store[keys]}};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));const out={{}};for(const [k,v] of Object.entries(keys||{{}}))out[k]=store[k]===undefined?v:store[k];return out;}};
      window.chrome={{runtime:{{{rid}getManifest:()=>({{version:'0.9.53'}})}},storage:{{local:{{
        get:async keys=>{{if(window.__storageInvalid)return invalid();return norm(keys);}},
        set:async obj=>{{if(window.__storageInvalid)return invalid();const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:store[k],newValue:v}};store[k]=v;}}for(const fn of listeners)fn(changes,'local');}},
        remove:async keys=>{{if(window.__storageInvalid)return invalid();for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}}
      }},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};
      window.__niakStore=store;
      window.__fireStorage=(changes)=>listeners.forEach(fn=>fn(changes,'local'));
    }})();"""

def diag_shim():
    return """(()=>{const m=new Map();window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>m.set(k,String(v)),snapshot:()=>Object.fromEntries(m),get:k=>m.get(k)||''};})();"""

def project_state_case(browser):
    page=browser.new_page(viewport={'width':1200,'height':850})
    errors=[]; warnings=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: warnings.append(m.text) if m.type in ('warning','error') else None)
    local_projects=[{'id':f'dom-p-{i}','name':f'Project {i}','href':'','domOnly':True} for i in range(1,6)]
    chats=[{'id':CHATS[i], 'title':f'Chat {i+1}', 'projectId':f'dom-p-{(i%5)+1}', 'updated':1786810000000+i} for i in range(8)]
    store={
      'niakgpt-v08-cache':{'schema':2,'projects':local_projects,'chats':chats,'counts':{f'dom-p-{i}':2 for i in range(1,6)},'indexedProjectIds':[],'serverIndexedAt':0},
      'niakgpt-governance-v085':{'seeded':True,'coreProjectIds':[],'hiddenProjectIds':[],'locks':{}},
      'niakgpt-settings-v090':{'nativePins':False,'safeMode':False}
    }
    native=''.join(f'<a id="p{i}" href="/g/{PIDS[i-1]}"><span>Project {i}</span></a>' for i in range(1,6))
    try:
      page.set_content(f'<nav data-testid="conversation-sidebar"><section><h2>Projects</h2>{native}</section><section><h2>Récents</h2><a href="/c/{CHATS[0]}">Chat 1</a></section></nav><main></main>')
      page.add_script_tag(content=storage_shim(store));page.add_script_tag(content=diag_shim())
      page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready'")
      page.add_style_tag(content=read('core-v090.css'))
      page.add_script_tag(content=guard(read('app-v090.js')))
      page.add_script_tag(content=guard(read('project-state-selfheal-v102.js')))
      page.wait_for_timeout(900)
      got=page.evaluate("""()=>({
        canonical:(__niakStore['niakgpt-v08-cache']?.projects||[]).filter(p=>String(p.id||'').startsWith('g-p-')&&!p.domOnly).length,
        core:(__niakStore['niakgpt-governance-v085']?.coreProjectIds||[]).length,
        pins:document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]').length,
        repair:__NIAKGPT_DIAGNOSTICS__.get('project-repair'),
        pinui:__NIAKGPT_DIAGNOSTICS__.get('pins-ui')
      })""")
      return {
        'project_cache_promoted':got['canonical']>=5,
        'governance_self_healed':got['core']>=5,
        'managed_projects_rendered':got['pins']>=5,
        'project_repair_diagnostic':('5 Projects' in got['repair']),
        'no_project_page_errors':not errors,
        'no_project_console_errors':not [x for x in warnings if 'NiakGPT' in x]
      }
    finally: page.close()

def local_fallback_case(browser):
    page=browser.new_page(viewport={'width':1000,'height':700})
    local_projects=[{'id':f'dom-p-{i}','name':f'Local {i}','href':'','domOnly':True} for i in range(1,6)]
    chats=[{'id':CHATS[i], 'title':f'Chat {i+1}', 'projectId':f'dom-p-{(i%5)+1}', 'updated':1786810000000+i} for i in range(8)]
    store={'niakgpt-v08-cache':{'schema':2,'projects':local_projects,'chats':chats,'counts':{},'indexedProjectIds':[],'serverIndexedAt':0},'niakgpt-governance-v085':{'seeded':True,'coreProjectIds':[],'hiddenProjectIds':[],'locks':{}}}
    try:
      page.set_content(f'<nav data-testid="conversation-sidebar"><section><h2>Récents</h2><a href="/c/{CHATS[0]}">Chat 1</a></section></nav><main></main>')
      page.add_script_tag(content=storage_shim(store));page.add_script_tag(content=diag_shim())
      page.add_style_tag(content=read('core-v090.css'));page.add_style_tag(content=read('pin-folders-v096.css'))
      page.add_script_tag(content=guard(read('project-state-selfheal-v102.js')));page.wait_for_timeout(450)
      got=page.evaluate("""()=>({pins:document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]').length,fallback:document.getElementById('ng8-pins')?.dataset.ng102Fallback||'',diag:__NIAKGPT_DIAGNOSTICS__.get('pins-ui')})""")
      return {'cache_only_fallback_visible':got['pins']==5 and got['fallback']=='1','cache_only_fallback_diagnostic':'RÉCUPÉRATION' in got['diag']}
    finally: page.close()

def lifecycle_case(browser):
    page=browser.new_page(viewport={'width':900,'height':600})
    errors=[]; console=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: console.append((m.type,m.text)))
    store={'niakgpt-settings-v090':{'safeMode':False},'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{}}}
    try:
      page.set_content('<main></main><div id="ng8-panel"></div>')
      page.add_script_tag(content=storage_shim(store));page.add_script_tag(content=diag_shim())
      page.add_script_tag(content="""(()=>{
        window.__bcPosts=0;window.__bcClosedPosts=0;
        class FakeBC{constructor(){this.closed=false;this.listeners=[];}addEventListener(t,fn){if(t==='message')this.listeners.push(fn)}removeEventListener(t,fn){this.listeners=this.listeners.filter(x=>x!==fn)}postMessage(){if(this.closed){window.__bcClosedPosts++;throw new DOMException('Channel is closed','InvalidStateError')}window.__bcPosts++;}close(){this.closed=true;}}
        window.BroadcastChannel=FakeBC;
        Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async()=>{throw new DOMException('Document is not active','InvalidStateError')}}});
      })();""")
      page.add_script_tag(content=guard(read('cache-bus-v096.js')))
      page.add_script_tag(content=guard(read('multitab-v090.js')))
      page.wait_for_timeout(450)
      # A lock DOMException must be absorbed and the lease fallback may take over.
      before=page.evaluate("()=>({role:document.documentElement.dataset.ng8TabRole||'',posts:__bcPosts,closed:__bcClosedPosts})")
      # Closing/suspending the page must make every later callback inert.
      page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));document.documentElement.dataset.ng8Heavy='1';document.documentElement.dataset.ng86Activity='thinking';")
      page.wait_for_timeout(250)
      after=page.evaluate("()=>({posts:__bcPosts,closed:__bcClosedPosts,role:document.documentElement.dataset.ng8TabRole||''})")
      # Cache bus must swallow extension-context invalidation without emitting the reported warning.
      page.evaluate("window.__storageInvalid=true")
      page.evaluate("()=>window.__NIAKGPT_CACHE_BUS__.update(cur=>({...cur,at:Date.now()}))")
      page.wait_for_timeout(100)
      active=page.evaluate("window.__NIAKGPT_CACHE_BUS__.active()")
      bad=[text for typ,text in console if typ in ('warning','error') and ('Channel is closed' in text or 'multitab] lock' in text or 'cache bus write' in text or 'Extension context invalidated' in text)]
      return {
        'lock_domexception_absorbed':not any('multitab] lock' in x for _,x in console),
        'closed_channel_never_posted':after['closed']==0 and after['posts']==before['posts'],
        'invalidated_cache_bus_goes_inactive':active is False,
        'lifecycle_no_page_errors':not errors,
        'reported_console_errors_absent':not bad
      }
    finally: page.close()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');args=ap.parse_args()
    with sync_playwright() as p:
      browser=launch(p,args.browser);result={}
      try:
        result.update(project_state_case(browser));result.update(local_fallback_case(browser));result.update(lifecycle_case(browser))
      finally: browser.close()
    ok=all(result.values())
    print(args.browser,'PASS' if ok else 'FAIL',json.dumps(result,ensure_ascii=False,sort_keys=True))
    sys.exit(0 if ok else 1)
if __name__=='__main__':main()
