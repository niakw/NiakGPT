#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
a=ap.parse_args();root=Path(a.root)
CHAT='11111111-1111-4111-8111-111111111111';P1='g-p-aaaaaaaaaaaaaaaa';P2='g-p-bbbbbbbbbbbbbbbb'
source=(root/'governance-adapter-v105.js').read_text(encoding='utf-8').replace("if (location.hostname !== 'chatgpt.com' ||", "if (false ||")
source=source.replace("const currentChatId=()=>location.pathname.match(/\\/c\\/([0-9a-f-]{20,})/i)?.[1]||'';",f"const currentChatId=()=>'{CHAT}';")
html=f'''<!doctype html><html><body>
<div id="move" role="menu" aria-label="Déplacer vers un projet"><button id="target" role="menuitem">Research Lab</button></div>
<script>
window.__project='{P1}';window.__fullDetail=0;window.__lightLists=0;window.__manual=[];window.__responses={{}};
window.__NIAKGPT_CACHE_BUS__={{peek:()=>({{projects:[{{id:'{P1}',name:'Studio'}},{{id:'{P2}',name:'Research Lab'}}]}})}};
const CHAT='{CHAT}',P2='{P2}';
document.addEventListener('niakgpt:rpc-request',e=>{{
  const d=e.detail||{{}},path=String(d.path||''),method=String(d.method||'GET').toUpperCase();
  if(/^\\/backend-api\\/conversation\\//.test(path)){{
    if(method==='GET')window.__fullDetail++;
    if(method==='PATCH')window.__project=d.body?.gizmo_id||'';
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:d.id,ok:true,status:200,data:{{id:CHAT,gizmo_id:window.__project}},transport:'fake-bridge'}}}})));
    return;
  }}
  if(path.startsWith('/backend-api/conversations')){{
    window.__lightLists++;
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:d.id,ok:true,status:200,data:{{items:[{{id:CHAT,gizmo_id:window.__project}}]}}}}}})));
    return;
  }}
  if(path.includes('/backend-api/gizmos/')&&path.includes('/conversations')){{
    window.__lightLists++;
    const pid=path.match(/gizmos\\/(g-p-[A-Za-z0-9]+)/)?.[1]||'';
    const items=pid===window.__project?[{{id:CHAT,gizmo_id:pid}}]:[];
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:d.id,ok:true,status:200,data:{{items}}}}}})));
  }}
}});
document.addEventListener('niakgpt:manual-project-move',e=>{{
  window.__manual.push(e.detail);
  const id='verify-'+Date.now();
  const handler=r=>{{if(r.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',handler);window.__responses.manual=r.detail;}};
  document.addEventListener('niakgpt:rpc-response',handler);
  document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{{detail:{{id,path:'/backend-api/conversation/'+CHAT,method:'GET',governance:true}}}}));
}});
document.getElementById('target').addEventListener('click',()=>{{window.__project=P2;}});
</script></body></html>'''

with sync_playwright() as p:
    browser=getattr(p,a.browser).launch(headless=True)
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded')
    page.add_script_tag(content=source)
    page.locator('#target').click()
    page.wait_for_timeout(700)
    manual=page.evaluate('''() => ({manual:window.__manual,res:window.__responses.manual,full:window.__fullDetail,light:window.__lightLists,project:window.__project})''')

    automated=page.evaluate(f'''async () => {{
      const req=(detail)=>new Promise(resolve=>{{const h=e=>{{if(e.detail?.id!==detail.id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail);}};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{{detail}}));}});
      const patch=await req({{id:'patch-1',path:'/backend-api/conversation/{CHAT}',method:'PATCH',body:{{gizmo_id:'{P1}'}},governance:true}});
      const verify=await req({{id:'verify-1',path:'/backend-api/conversation/{CHAT}',method:'GET',governance:true}});
      return {{patch,verify,full:window.__fullDetail,light:window.__lightLists,project:window.__project}};
    }}''')
    browser.close()

bad=[]
if len(manual['manual'])!=1:bad.append('manual-signal')
if manual['res'] is None or not manual['res'].get('ok') or manual['res'].get('data',{}).get('gizmo_id')!=P2:bad.append('manual-verify')
if manual['full']!=0:bad.append('manual-full-get')
if manual['light']<1:bad.append('manual-light-list')
if not automated['patch'].get('ok'):bad.append('patch')
if not automated['verify'].get('ok') or automated['verify'].get('data',{}).get('gizmo_id')!=P1:bad.append('patch-ack-verify')
if automated['full']!=0:bad.append('automated-full-get')
if errors:bad.append('pageerror')
print(json.dumps({'browser':a.browser,'manual':manual,'automated':automated,'errors':errors,'bad':bad},ensure_ascii=False))
if bad:
    print('FAIL '+','.join(bad),file=sys.stderr);sys.exit(1)
print(f'{a.browser} GOVERNANCE_0955_PASS')
