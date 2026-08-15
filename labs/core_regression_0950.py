#!/usr/bin/env python3
from pathlib import Path
import argparse,json,os,sys
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('NIAKGPT_ROOT','/mnt/data/niakgpt-0950-work')).resolve()
CHROMIUM=os.environ.get('NIAKGPT_SYSTEM_CHROMIUM','/usr/bin/chromium')
CHAT='12345678-1234-1234-1234-123456789abc'; PROJECT='g-p-tech123'
def read(n): return (ROOT/n).read_text(encoding='utf-8')
def guard(src): return src.replace("location.hostname !== 'chatgpt.com' ||","false ||").replace("location.hostname!=='chatgpt.com'||","false||")
def shim(store):
 raw=json.dumps(store,ensure_ascii=False)
 return f"""(()=>{{const store={raw};const listeners=[];const norm=(keys)=>{{if(keys==null)return{{...store}};if(typeof keys==='string')return{{[keys]:store[keys]}};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==='object'){{const out={{}};for(const [k,v] of Object.entries(keys))out[k]=store[k]===undefined?v:store[k];return out;}}return{{}};}};window.chrome={{runtime:{{getManifest:()=>({{version:'0.9.50'}})}},storage:{{local:{{get:async k=>norm(k),set:async obj=>{{const changes={{}};for(const [k,v] of Object.entries(obj)){{changes[k]={{oldValue:store[k],newValue:v}};store[k]=v;}}for(const fn of listeners)fn(changes,'local');}},remove:async keys=>{{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}}}},onChanged:{{addListener:fn=>listeners.push(fn)}}}}}};window.__niakStore=store;}})();"""

def bridge(browser):
 p=browser.new_page()
 try:
  p.set_content('<main></main>');p.evaluate("window.__calls=0;window.fetch=(...a)=>{window.__calls++;return Promise.resolve(new Response('{}',{status:200,headers:{'content-type':'application/json'}}))};window.__before=window.fetch")
  p.add_script_tag(content=guard(read('page-bridge.js')))
  ident=p.evaluate('window.fetch===window.__before');p.evaluate('window.__calls=0')
  r=p.evaluate("""async()=>new Promise(resolve=>{const id='x';const h=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail)};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversation/12345678-1234-1234-1234-123456789abc',method:'GET'}}));})""")
  return {'bridge_fetch_identity':ident,'bridge_get_blocked':r.get('error')=='conversation_detail_get_disabled' and p.evaluate('__calls')==0}
 finally:p.close()

def longthread(browser):
 p=browser.new_page(viewport={'width':1440,'height':900});errs=[];p.on('pageerror',lambda e:errs.append(str(e)))
 turns=''.join(f'<article data-testid="conversation-turn-{i}"><div data-message-author-role="{("user" if i%2 else "assistant")}">msg {i}</div></article>' for i in range(140))
 store={'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{},'indexedProjectIds':[],'serverIndexedAt':1},'niakgpt-governance-v085':{'coreProjectIds':[],'hiddenProjectIds':[]}}
 try:
  p.set_content(f'<nav data-testid="conversation-sidebar"></nav><main>{turns}<div id="prompt-textarea" contenteditable="true"></div></main>');p.add_script_tag(content=shim(store));p.evaluate("document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8TabRole='client';document.documentElement.dataset.ng90Matrix='off';document.documentElement.dataset.ng90Eggs='off';document.documentElement.dataset.ng100CacheGuard='ready'")
  p.add_script_tag(content=guard(read('app-v090.js')));p.wait_for_timeout(1450)
  a=p.evaluate("()=>({n:document.querySelectorAll('[data-ng8-turn]').length,h:document.documentElement.dataset.ng8Heavy})")
  p.evaluate("document.documentElement.dataset.ng86Activity='thinking'")
  p.evaluate("""()=>{const m=document.querySelector('main'),f=document.createDocumentFragment();for(let i=140;i<340;i++){const a=document.createElement('article');a.setAttribute('data-testid','conversation-turn-'+i);const d=document.createElement('div');d.setAttribute('data-message-author-role',i%2?'user':'assistant');d.textContent='msg '+i;a.appendChild(d);f.appendChild(a)}m.appendChild(f)}""");p.wait_for_timeout(450)
  mid=p.evaluate("document.querySelectorAll('[data-ng8-turn]').length")
  p.evaluate("document.documentElement.dataset.ng86Activity='ready';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:false}}))");p.wait_for_timeout(2300)
  z=p.evaluate("()=>({n:document.querySelectorAll('[data-ng8-turn]').length,total:document.querySelectorAll('[data-testid^=conversation-turn-]').length,h:document.documentElement.dataset.ng8Heavy,composer:!!document.querySelector('#prompt-textarea')})")
  return {'longthread':a['n']==140 and a['h']=='1' and mid==140 and z['n']==340 and z['total']==340 and z['h']=='1' and z['composer'] and not errs}
 finally:p.close()

def serverindex(browser):
 p=browser.new_page();projects=[{'id':f'g-p-p{i:02d}','display':{'name':f'Project {i:02d}'}} for i in range(16)]
 store={'niakgpt-v08-cache':{'schema':2,'projects':[],'chats':[],'counts':{},'indexedProjectIds':[],'serverIndexedAt':0}}
 responder=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpc.push({path:d.path,method:d.method});let data={};if(d.path.includes('/gizmos/snorlax/sidebar'))data={items:window.__projects};else if(d.path.includes('/gizmos/g-p-')&&d.path.includes('/conversations')){const m=d.path.match(/gizmos\/(g-p-[^/]+)\/conversations/);data={items:[{id:'chat-'+m[1],title:'Chat '+m[1],update_time:1786818840}]};}else if(d.path.startsWith('/backend-api/conversations'))data={items:[]};document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data}}));});"""
 try:
  p.set_content('<main></main>');p.add_script_tag(content=shim(store));p.evaluate("document.documentElement.dataset.ng86Activity='thinking';window.__rpc=[]");p.evaluate('(x)=>window.__projects=x',projects);p.add_script_tag(content=responder);p.add_script_tag(content=guard(read('server-index-v100.js')));p.wait_for_timeout(750)
  x=p.evaluate("()=>({projects:(__niakStore['niakgpt-v08-cache']?.projects||[]).length,deep:__rpc.filter(x=>x.path.includes('/gizmos/g-p-')&&x.path.includes('/conversations')).length})")
  p.evaluate("document.documentElement.dataset.ng86Activity='ready';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:false}}))");p.wait_for_timeout(2700)
  y=p.evaluate("()=>({projects:(__niakStore['niakgpt-v08-cache']?.projects||[]).length,chats:(__niakStore['niakgpt-v08-cache']?.chats||[]).length,deep:__rpc.filter(x=>x.path.includes('/gizmos/g-p-')&&x.path.includes('/conversations')).length,indexed:Number(__niakStore['niakgpt-v08-cache']?.serverIndexedAt||0)})")
  return {'project_bootstrap':x['projects']==16 and x['deep']==0,'project_resume':y['projects']==16 and y['chats']==16 and y['deep']==16 and y['indexed']>0}
 finally:p.close()

def reclass(browser):
 p=browser.new_page();queue='g-p-queue';target=PROJECT
 store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':queue,'name':'À classer'},{'id':target,'name':'Tech & Développement','description':'Code API extension Chrome'}],'chats':[{'id':CHAT,'title':'Conseils prompts OpenAI','snippet':'GPT prompt extension Chrome code','projectId':queue,'updated':1786810000000}],'counts':{queue:1,target:0},'indexedProjectIds':[queue,target],'serverIndexedAt':1786810000000},'niakgpt-governance-v085':{'coreProjectIds':[target],'locks':{}}}
 resp=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpc.push({path:d.path,method:d.method});document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:'g-p-tech123'}}}));});"""
 try:
  p.set_content('<main></main>');p.add_script_tag(content=shim(store));p.evaluate("document.documentElement.dataset.ng86Activity='ready';window.__rpc=[]");p.add_script_tag(content=resp);p.add_script_tag(content=guard(read('reclassify-v101.js')));p.evaluate("document.dispatchEvent(new CustomEvent('niakgpt:cache-guard-ready'))");p.wait_for_timeout(1500)
  g=p.evaluate("()=>({pid:__niakStore['niakgpt-v08-cache'].chats.find(c=>c.id==='12345678-1234-1234-1234-123456789abc')?.projectId,calls:__rpc})")
  patches=[x for x in g['calls'] if x['method']=='PATCH' and '/backend-api/conversation/' in x['path']];gets=[x for x in g['calls'] if x['method']=='GET' and '/backend-api/conversation/' in x['path']]
  return {'reclass':g['pid']==target and len(patches)==1 and len(gets)==0}
 finally:p.close()

def continuity(browser):
 p=browser.new_page();old=CHAT;new='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
 store={'niakgpt-v08-cache':{'schema':2,'projects':[{'id':PROJECT,'name':'Tech & Développement'}],'chats':[{'id':old,'title':'Old','projectId':PROJECT},{'id':new,'title':'New','projectId':''}]},'niakgpt-continuity-v100':{'schema':1,'out':{}}}
 resp=r"""document.addEventListener('niakgpt:rpc-request',e=>{const d=e.detail||{};window.__rpc.push({path:d.path,method:d.method,body:d.body});document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:'g-p-tech123'}}}));});"""
 try:
  p.set_content(f'<nav><a href="/c/{new}">New</a></nav><main></main><div id="prompt-textarea" contenteditable="true"></div>');p.add_script_tag(content=shim(store));p.evaluate("window.__rpc=[]");p.add_script_tag(content=resp)
  p.evaluate('(x)=>window.__testPending=x',{'schema':1,'chatId':old,'projectId':PROJECT,'capsule':'capsule','createdAt':1786813336000,'patched':False});p.evaluate('window.__testPending.createdAt=Date.now()')
  src=guard(read('continuity-v100.js')).replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{new}';").replace("const currentPid=()=>pid(location.pathname)||cache.chats?.find?.(c=>c.id===currentCid())?.projectId||'';",f"const currentPid=()=>'{PROJECT}';")
  src=src.replace("function readPending(){try{const p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}catch{return null;}}","function readPending(){const p=window.__testPending||null;if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return null;return p;}")
  src=src.replace("function writePending(p){try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch{}}","function writePending(p){window.__testPending=p;}").replace("function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}}","function clearPending(){window.__testPending=null;}")
  p.add_script_tag(content=src);p.wait_for_timeout(750)
  calls=p.evaluate('__rpc');patches=[x for x in calls if x['method']=='PATCH' and x['path'].endswith(new)]
  return {'continuity_patch':len(patches)==1 and patches[0]['body'].get('gizmo_id')==PROJECT}
 finally:p.close()

def main():
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox']);res={}
  try:
   for fn in (bridge,longthread,serverindex,reclass,continuity): res.update(fn(b))
  finally:b.close()
 ok=all(res.values());print(('PASS' if ok else 'FAIL'),json.dumps(res,ensure_ascii=False,sort_keys=True));sys.exit(0 if ok else 1)
if __name__=='__main__':main()
