#!/usr/bin/env python3
from pathlib import Path
import argparse, json, os, sys
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('NIAKGPT_ROOT','/mnt/data/niakgpt-0949')).resolve()
CHAT_ID='12345678-1234-1234-1234-123456789abc'
PROJECT_ID='g-p-tech123'


def read(name): return (ROOT/name).read_text(encoding='utf-8')
def patch_guard(src): return src.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def chrome_shim(store):
    raw=json.dumps(store,ensure_ascii=False)
    return f"""(()=>{{const store={raw};const listeners=[];const norm=(keys)=>{{if(keys==null)return{{...store}};if(typeof keys==='string')return{{[keys]:store[keys]}};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==='object'){{const out={{}};for(const [k,v] of Object.entries(keys))out[k]=store[k]===undefined?v:store[k];return out;}}return{{}};}};window.chrome={{runtime:{{getManifest:()=>({{version:'0.9.49'}})}},storage:{{local:{{get:async k=>norm(k),set:async obj=>{{const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:store[k],newValue:v}};store[k]=v;}}for(const fn of listeners)fn(changes,'local');}},remove:async keys=>{{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}}}},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};window.__niakStore=store;}})();"""

def launch(bt,name):
    kwargs={'headless':True}
    exe=os.environ.get('NIAKGPT_SYSTEM_CHROMIUM') if name=='chromium' else None
    if exe: kwargs.update(executable_path=exe,args=['--no-sandbox'])
    return bt.launch(**kwargs)

def core_surfaces(browser):
    page=browser.new_page(viewport={'width':1440,'height':900}); results={}
    html=f"""<nav data-testid='conversation-sidebar'><a data-ng8-chat='1' href='/c/{CHAT_ID}'>Conseils prompts OpenAI</a></nav><header><span>ChatGPT</span></header><main><h1>Qu’est-ce qui vous intéresse aujourd’hui ?</h1><article data-message-author-role='user'>Travaille localement, sans GitHub, conserve les locks et livre le ZIP complet.</article><article data-message-author-role='assistant'>D’accord, je conserve toutes les contraintes.</article><div role='alert'>You’ve reached the maximum conversation length. Start a new chat.</div></main><form><div id='prompt-textarea' contenteditable='true' data-testid='prompt-textarea'></div></form>"""
    store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':PROJECT_ID,'name':'Tech & Développement','description':'Projet technique NiakGPT','instructions':'Préserver les contraintes et vérifier les tests.'}],'chats':[{'id':CHAT_ID,'title':'Conseils prompts OpenAI','projectId':PROJECT_ID,'snippet':'prompts GPT','updated':1786818840000}],'counts':{PROJECT_ID:1},'indexedProjectIds':[PROJECT_ID],'serverIndexedAt':1786818840000},'niakgpt-governance-v085':{'coreProjectIds':[PROJECT_ID],'locks':{}},'niakgpt-continuity-v100':{'schema':1,'out':{}}}
    try:
        page.set_content(html);page.add_script_tag(content=chrome_shim(store))
        page.evaluate("window.__netCalls=0;window.fetch=(...a)=>{window.__netCalls++;return Promise.resolve(new Response('{}',{status:200,headers:{'content-type':'application/json'}}));};window.__fetchBeforeBridge=window.fetch;")
        page.add_script_tag(content=patch_guard(read('page-bridge.js')))
        results['bridge_fetch_identity']=page.evaluate('window.fetch===window.__fetchBeforeBridge');page.evaluate('window.__netCalls=0')
        response=page.evaluate("""async()=>new Promise(resolve=>{const id='bridge-test';const h=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail)};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversation/12345678-1234-1234-1234-123456789abc',method:'GET'}}));})""")
        results['bridge_blocked']=response.get('error')=='conversation_detail_get_disabled' and page.evaluate('window.__netCalls')==0

        page.evaluate("""()=>{const p=document.createElement('aside');p.id='reflection-panel';p.setAttribute('role','dialog');p.style.cssText='position:fixed;right:0;top:40px;width:420px;height:500px';p.innerHTML='<h2>Réflexion</h2><pre style="width:800px">oversized code</pre>';document.body.appendChild(p)}""")
        page.add_style_tag(content=read('side-panels-v096.css'));page.add_script_tag(content=patch_guard(read('side-panels-v096.js')));page.wait_for_timeout(250)
        geom=page.evaluate("""()=>{const p=document.getElementById('reflection-panel'),r=p.getBoundingClientRect();return{rightStyle:p.style.right,right:r.right,cls:p.classList.contains('ng96-native-sidepanel'),client:p.clientWidth,scroll:p.scrollWidth}}""")
        results['native_panel']=geom['rightStyle']=='0px' and abs(geom['right']-1440)<1.1 and geom['cls'] and geom['client']==geom['scroll']

        page.add_style_tag(content=read('theme-v08.css'));page.add_style_tag(content=read('visual-stability-v101.css'))
        page.evaluate("""()=>{const u=document.querySelector('[data-message-author-role="user"]');u.dataset.ng8Turn='1';u.dataset.ng8Role='user';u.dataset.ng8Time='10:34';const a=document.querySelector('[data-message-author-role="assistant"]');a.dataset.ng8Turn='1';a.dataset.ng8Role='assistant';a.dataset.ng8Time='10:35'}""")
        c=page.evaluate("""()=>({u:getComputedStyle(document.querySelector('[data-ng8-role="user"]'),'::before').content,a:getComputedStyle(document.querySelector('[data-ng8-role="assistant"]'),'::before').content})""")
        results['timestamps']='TOI · 10:34' in c['u'] and 'CHATGPT · 10:35' in c['a']

        page.add_style_tag(content=read('coach-v100.css'));page.add_script_tag(content=patch_guard(read('coach-v101.js')));page.wait_for_timeout(120)
        prompt='Corrige NiakGPT et vérifie les régressions. Travaille localement, sans GitHub. Conserve les locks manuels. Je veux un ZIP complet. Ne supprime aucune fonctionnalité déjà validée.'
        optimized=page.evaluate('p=>window.__NIAKGPT_PROMPTER__.optimize(p)',prompt).lower()
        results['prompter']=all(x in optimized for x in ['local','sans github','locks','zip complet','vérifie']) and page.evaluate('window.__netCalls')==0

        cont=patch_guard(read('continuity-v100.js')).replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{CHAT_ID}';").replace("const currentPid=()=>pid(location.pathname)||cache.chats?.find?.(c=>c.id===currentCid())?.projectId||'';",f"const currentPid=()=>'{PROJECT_ID}';")
        page.add_style_tag(content=read('continuity-v100.css'));page.add_script_tag(content=cont);page.wait_for_timeout(450)
        out=page.evaluate("""()=>{const a=document.querySelector('a[href*="/c/"]'),capsule=window.__NIAKGPT_CONTINUITY__.buildCapsule();return{out:a.dataset.ng100Out,badge:!!a.querySelector('.ng100-out-badge'),order:getComputedStyle(a).order,capsule,net:window.__netCalls}}""")
        results['continuity']=out['out']=='1' and out['badge'] and out['order']=='9999' and 'Tech & Développement' in out['capsule'] and 'HISTORIQUE DU FIL PRÉCÉDENT' in out['capsule'] and 'Travaille localement' in out['capsule'] and out['net']==0
        pos=page.evaluate("()=>({p:getComputedStyle(document.querySelector('main')).position,o:getComputedStyle(document.querySelector('main')).overflow})")
        results['home_geometry']=pos['p']=='static' and pos['o']=='visible'
    finally: page.close()
    return results

def long_thread(browser):
    page=browser.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    turns=''.join(f'<article data-testid="conversation-turn-{i}"><div data-message-author-role="{("user" if i%2 else "assistant")}">msg {i}</div></article>' for i in range(140))
    store={'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{},'indexedProjectIds':[],'serverIndexedAt':1},'niakgpt-governance-v085':{'coreProjectIds':[],'hiddenProjectIds':[]}}
    try:
        page.set_content(f'<nav data-testid="conversation-sidebar"></nav><main>{turns}<div id="prompt-textarea" contenteditable="true" data-testid="prompt-textarea"></div></main>');page.add_script_tag(content=chrome_shim(store));page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off'")
        page.add_script_tag(content=patch_guard(read('app-v090.js')));page.wait_for_timeout(1450)
        initial=page.evaluate("()=>({n:document.querySelectorAll('[data-ng8-turn]').length,h:document.documentElement.dataset.ng8Heavy})")
        page.evaluate("document.documentElement.dataset.ng86Activity='thinking'")
        page.evaluate("""()=>{const m=document.querySelector('main'),f=document.createDocumentFragment();for(let i=140;i<340;i++){const a=document.createElement('article');a.setAttribute('data-testid','conversation-turn-'+i);const d=document.createElement('div');d.setAttribute('data-message-author-role',i%2?'user':'assistant');d.textContent='msg '+i;a.appendChild(d);f.appendChild(a)}m.appendChild(f)}""");page.wait_for_timeout(450)
        streaming=page.evaluate("document.querySelectorAll('[data-ng8-turn]').length")
        page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:false}}))");page.wait_for_timeout(2200)
        final=page.evaluate("()=>({n:document.querySelectorAll('[data-ng8-turn]').length,total:document.querySelectorAll('[data-testid^=conversation-turn-]').length,h:document.documentElement.dataset.ng8Heavy,composer:!!document.querySelector('#prompt-textarea')})")
        return {'longthread':initial['n']==140 and initial['h']=='1' and streaming==140 and final['n']==340 and final['total']==340 and final['h']=='1' and final['composer'] and not errors}
    finally: page.close()

def server_index(browser):
    page=browser.new_page();
    projects=[{'id':f'g-p-p{i:02d}','display':{'name':f'Project {i:02d}'}} for i in range(16)]
    store={'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{},'indexedProjectIds':[],'serverIndexedAt':0}}
    responder=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpcCalls.push({path:d.path,method:d.method});let data={};if(d.path.includes('/gizmos/snorlax/sidebar'))data={items:window.__projects};else if(d.path.includes('/gizmos/g-p-')&&d.path.includes('/conversations')){const m=d.path.match(/gizmos\/(g-p-[^/]+)\/conversations/);data={items:[{id:'chat-'+m[1],title:'Chat '+m[1],update_time:1786818840}]};}else if(d.path.startsWith('/backend-api/conversations'))data={items:[]};document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data}}));});"""
    try:
        page.set_content('<main></main>');page.add_script_tag(content=chrome_shim(store));page.evaluate("document.documentElement.dataset.ng86Activity='thinking';window.__rpcCalls=[]");page.evaluate('(p)=>window.__projects=p',projects);page.add_script_tag(content=responder);page.add_script_tag(content=patch_guard(read('server-index-v100.js')));page.wait_for_timeout(700)
        phase1=page.evaluate("()=>({projects:(__niakStore['niakgpt-v08-cache']?.projects||[]).length,deep:__rpcCalls.filter(x=>x.path.includes('/gizmos/g-p-')&&x.path.includes('/conversations')).length})")
        page.evaluate("document.documentElement.dataset.ng86Activity='ready';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:false}}))");page.wait_for_timeout(2600)
        phase2=page.evaluate("()=>({projects:(__niakStore['niakgpt-v08-cache']?.projects||[]).length,chats:(__niakStore['niakgpt-v08-cache']?.chats||[]).length,deep:__rpcCalls.filter(x=>x.path.includes('/gizmos/g-p-')&&x.path.includes('/conversations')).length,indexed:Number(__niakStore['niakgpt-v08-cache']?.serverIndexedAt||0)})")
        return {'project_bootstrap':phase1['projects']==16 and phase1['deep']==0,'project_resume':phase2['projects']==16 and phase2['chats']==16 and phase2['deep']==16 and phase2['indexed']>0}
    finally: page.close()

def reclass(browser):
    page=browser.new_page();queue='g-p-queue';target=PROJECT_ID
    store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':queue,'name':'À classer'},{'id':target,'name':'Tech & Développement','description':'Code API extension Chrome'}],'chats':[{'id':CHAT_ID,'title':'Conseils prompts OpenAI','snippet':'GPT prompt extension Chrome code','projectId':queue,'updated':1786810000000}],'counts':{queue:1,target:0},'indexedProjectIds':[queue,target],'serverIndexedAt':1786810000000},'niakgpt-governance-v085':{'coreProjectIds':[target],'locks':{}}}
    responder=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpcCalls.push({path:d.path,method:d.method});document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:'g-p-tech123'}}}));});"""
    try:
        page.set_content('<main></main>');page.add_script_tag(content=chrome_shim(store));page.evaluate("document.documentElement.dataset.ng86Activity='ready';window.__rpcCalls=[]");page.add_script_tag(content=responder);page.add_script_tag(content=patch_guard(read('reclassify-v101.js')));page.evaluate("document.dispatchEvent(new CustomEvent('niakgpt:cache-guard-ready'))");page.wait_for_timeout(1400)
        got=page.evaluate("()=>({pid:__niakStore['niakgpt-v08-cache'].chats.find(c=>c.id==='12345678-1234-1234-1234-123456789abc')?.projectId,calls:__rpcCalls})")
        patches=[x for x in got['calls'] if x['method']=='PATCH' and '/backend-api/conversation/' in x['path']];gets=[x for x in got['calls'] if x['method']=='GET' and '/backend-api/conversation/' in x['path']]
        return {'reclass':got['pid']==target and len(patches)==1 and len(gets)==0}
    finally: page.close()

def continuity_patch(browser):
    page=browser.new_page();old=CHAT_ID;new='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':PROJECT_ID,'name':'Tech & Développement'}],'chats':[{'id':old,'title':'Old','projectId':PROJECT_ID},{'id':new,'title':'New','projectId':''}]},'niakgpt-continuity-v100':{'schema':1,'out':{}}}
    responder=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpcCalls.push({path:d.path,method:d.method,body:d.body});document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:'g-p-tech123'}}}));});"""
    try:
        page.set_content(f'<nav><a href="/c/{new}">New</a></nav><main></main><div id="prompt-textarea" contenteditable="true"></div>');page.add_script_tag(content=chrome_shim(store));page.evaluate("window.__rpcCalls=[]");page.add_script_tag(content=responder)
        page.evaluate('(p)=>window.__testPending=p',{'schema':1,'chatId':old,'projectId':PROJECT_ID,'capsule':'capsule','createdAt':1786813336000,'patched':False})
        page.evaluate("()=>{window.__testPending.createdAt=Date.now()}")
        src=patch_guard(read('continuity-v100.js')).replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{new}';").replace("const currentPid=()=>pid(location.pathname)||cache.chats?.find?.(c=>c.id===currentCid())?.projectId||'';",f"const currentPid=()=>'{PROJECT_ID}';")
        src=src.replace("function readPending(){try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}}","function readPending(){const p=window.__testPending||null;if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}")
        src=src.replace("function writePending(p){try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}}","function writePending(p){window.__testPending=p;}")
        src=src.replace("function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}}","function clearPending(){window.__testPending=null;}")
        page.add_script_tag(content=src);page.wait_for_timeout(700)
        calls=page.evaluate('__rpcCalls')
        patches=[x for x in calls if x['method']=='PATCH' and x['path'].endswith(new)]
        return {'continuity_patch':len(patches)==1 and patches[0]['body'].get('gizmo_id')==PROJECT_ID}
    finally: page.close()

def run_engine(bt,name):
    browser=launch(bt,name);out={}
    try:
        for fn in (core_surfaces,long_thread,server_index,reclass,continuity_patch): out.update(fn(browser))
    finally: browser.close()
    out['no_content_visibility']='content-visibility' not in (read('theme-v08.css')+read('visual-stability-v101.css'))
    ok=all(out.values());print(name,'PASS' if ok else 'FAIL',json.dumps(out,ensure_ascii=False));return ok

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit','all'],default='all');args=ap.parse_args();all_ok=True
    with sync_playwright() as p:
        items={'chromium':p.chromium,'firefox':p.firefox,'webkit':p.webkit}
        selected=items.items() if args.browser=='all' else [(args.browser,items[args.browser])]
        for name,bt in selected:
            try: all_ok &= run_engine(bt,name)
            except Exception as e: all_ok=False;print(name,'ERROR',repr(e))
    sys.exit(0 if all_ok else 1)
if __name__=='__main__':main()
