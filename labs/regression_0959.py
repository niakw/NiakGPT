#!/usr/bin/env python3
import argparse, asyncio, json, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)

def source(name):
    s=(ROOT/name).read_text(encoding='utf-8')
    return s.replace("location.hostname!=='chatgpt.com'||", "false||")

async def run(browser_name):
  async with async_playwright() as p:
    browser=await getattr(p,browser_name).launch(headless=True)

    # A. Current Projects expando remains hidden as soon as the NiakGPT block exists,
    # even when the old recognised-pin readiness predicate would be false.
    page=await browser.new_page(viewport={'width':1100,'height':760})
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    await page.set_content('''<style>body{background:#071019;color:#dce7f1;font-family:system-ui}nav{width:300px}.group\\/sidebar-expando-section{padding:8px;border:1px solid #334}.own{margin-top:12px;border:1px solid #1d566f;padding:8px}</style><nav data-testid="sidebar">
      <div id="native-projects" class="group/sidebar-expando-section mb-x">
        <div class="group/sidebar-expando-section-header"><button><h2>Projets</h2></button><button aria-label="Nouveau projet">+</button></div>
        <ul><li><div class="group/project-unfurl-row"><div role="button" data-sidebar-item="true">NiakGPT</div></div></li><li>Films</li></ul>
      </div>
      <div id="custom-gpts"><h2>GPTs</h2><a href="/g/custom-one">Custom GPT</a></div>
      <section id="ng8-pins" class="own"><b>PROJECTS</b><div>NiakGPT</div><div>Films</div></section>
    </nav>''')
    await page.add_style_tag(content=(ROOT/'sidebar-projects-authority-v109.css').read_text())
    await page.evaluate(source('sidebar-projects-authority-v109.js')); await page.wait_for_timeout(120)
    assert await page.evaluate("getComputedStyle(document.querySelector('#native-projects')).display")=='none'
    assert await page.evaluate("document.querySelector('#native-projects').dataset.ng109NativeProjects")=='1'
    assert await page.evaluate("getComputedStyle(document.querySelector('#custom-gpts')).display")!='none'
    await page.screenshot(path=str(ART/f'0959-authority-{browser_name}.png'),full_page=True)
    await page.evaluate("document.querySelector('#ng8-pins').remove()"); await page.wait_for_timeout(80)
    assert await page.evaluate("getComputedStyle(document.querySelector('#native-projects')).display")!='none'
    assert not errors,errors

    # B. Project drawer: current chat focus, rename button, OUT badge + ordering and native right-click.
    page2=await browser.new_page(viewport={'width':720,'height':650})
    errors2=[]; page2.on('pageerror',lambda e:errors2.append(str(e)))
    current='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; out='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; other='cccccccc-cccc-cccc-cccc-cccccccccccc'
    state={'out':{out:{'out':True,'title':'Conversation OUT'}}}
    cache={'projects':[{'id':'g-p-x','name':'NiakGPT'}],'chats':[{'id':current,'title':'Active','projectId':'g-p-x'},{'id':out,'title':'Conversation OUT','projectId':'g-p-x'},{'id':other,'title':'Autre','projectId':'g-p-x'}],'projectChats':{'g-p-x':[{'id':current,'title':'Active','projectId':'g-p-x'},{'id':out,'title':'Conversation OUT','projectId':'g-p-x'},{'id':other,'title':'Autre','projectId':'g-p-x'}]}}
    await page2.set_content(f'''<style>body{{background:#071019;color:#dce7f1;width:350px}}</style><div id="ng8-pins"><div class="ng96-pin-drawer"><div class="ng96-folder-list">
      <a data-chat="{out}" href="/g/g-p-x/c/{out}" title="Conversation OUT"><span>Conversation OUT</span><time>16/08</time></a>
      <a data-chat="{current}" href="/g/g-p-x/c/{current}" title="Active"><span>Active</span><time>17/08</time></a>
      <a data-chat="{other}" href="/g/g-p-x/c/{other}" title="Autre"><span>Autre</span><time>17/08</time></a>
    </div></div></div>''')
    await page2.add_style_tag(content=(ROOT/'pin-folders-v096.css').read_text()+(ROOT/'project-chat-ux-v109.css').read_text())
    await page2.evaluate(f'''() => {{
      window.__store={json.dumps({'niakgpt-continuity-v100':state,'niakgpt-v08-cache':cache})}; window.__rpc=[]; window.prompt=()=> 'Titre renommé';
      window.chrome={{storage:{{local:{{get:async k=>Array.isArray(k)?Object.fromEntries(k.map(x=>[x,window.__store[x]])):{{[k]:window.__store[k]}},set:async o=>Object.assign(window.__store,o)}},onChanged:{{addListener:()=>{{}}}}}}}};
      window.__NIAKGPT_CACHE_BUS__={{update:async fn=>{{window.__store['niakgpt-v08-cache']=fn(window.__store['niakgpt-v08-cache']);return window.__store['niakgpt-v08-cache'];}}}};
      document.addEventListener('niakgpt:rpc-request',e=>{{window.__rpc.push(e.detail);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:e.detail.id,ok:true,status:200,data:{{title:e.detail.body?.title}}}}}})));}});
    }}''')
    ux=source('project-chat-ux-v109.js').replace("const currentCid=()=>cid(location.pathname);",f"const currentCid=()=>'{current}';")
    await page2.evaluate(ux); await page2.wait_for_timeout(120)
    result=await page2.evaluate(f'''() => {{const cur=document.querySelector('a[data-chat="{current}"]'),out=document.querySelector('a[data-chat="{out}"]'),list=document.querySelector('.ng96-folder-list');const order=[...list.querySelectorAll(':scope > .ng109-chat-row')].map(r=>r.querySelector('a').dataset.chat);const ev=new MouseEvent('contextmenu',{{bubbles:true,cancelable:true}});return{{active:cur.dataset.ng109Active,aria:cur.getAttribute('aria-current'),renames:document.querySelectorAll('.ng109-chat-rename').length,out:!!out.querySelector('.ng109-out-badge'),last:order.at(-1),rightAllowed:out.dispatchEvent(ev)}};}}''')
    assert result=={'active':'1','aria':'page','renames':3,'out':True,'last':out,'rightAllowed':True},result
    await page2.screenshot(path=str(ART/f'0959-project-chat-{browser_name}.png'),full_page=True)
    await page2.click(f'a[data-chat="{current}"] + .ng109-chat-rename'); await page2.wait_for_timeout(100)
    renamed=await page2.evaluate(f'''() => ({{text:document.querySelector('a[data-chat="{current}"] span').textContent,cache:window.__store['niakgpt-v08-cache'].chats.find(c=>c.id==='{current}').title,rpc:window.__rpc}})''')
    assert renamed['text']=='Titre renommé' and renamed['cache']=='Titre renommé' and len(renamed['rpc'])==1 and renamed['rpc'][0]['body']['title']=='Titre renommé'
    assert not errors2,errors2

    # C. Three recent root chats are caught up even without an "À classer" Project.
    page3=await browser.new_page(); errors3=[]; page3.on('pageerror',lambda e:errors3.append(str(e)))
    recent=int(time.time()*1000)-24*3600*1000; old=recent-10*24*3600*1000
    chats=[
      {'id':'11111111-1111-1111-1111-111111111111','title':'NiakGPT extension bug','snippet':'chrome github niakgpt','projectId':'','updated':recent,'href':'/c/11111111-1111-1111-1111-111111111111'},
      {'id':'22222222-2222-2222-2222-222222222222','title':'NiakGPT GitHub CI','snippet':'niakgpt code extension','projectId':'','updated':recent,'href':'/c/22222222-2222-2222-2222-222222222222'},
      {'id':'33333333-3333-3333-3333-333333333333','title':'NiakGPT sidebar Projects','snippet':'niakgpt javascript chrome','projectId':'','updated':recent,'href':'/c/33333333-3333-3333-3333-333333333333'},
      {'id':'44444444-4444-4444-4444-444444444444','title':'NiakGPT ancien chat','snippet':'niakgpt','projectId':'','updated':old,'href':'/c/44444444-4444-4444-4444-444444444444'}]
    raw={'projects':[{'id':'g-p-niakgpt','name':'NiakGPT'},{'id':'g-p-films','name':'Films'}],'chats':chats,'projectChats':{},'counts':{}}
    gov={'coreProjectIds':['g-p-niakgpt','g-p-films'],'locks':{},'autoResync':True}
    await page3.set_content('<main></main>')
    await page3.evaluate(f'''() => {{window.__store={json.dumps({'niakgpt-v08-cache':raw,'niakgpt-governance-v085':gov})};window.__rpc=[];window.chrome={{storage:{{local:{{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,window.__store[k]])),set:async o=>Object.assign(window.__store,o),remove:async k=>delete window.__store[k]}},onChanged:{{addListener:()=>{{}}}}}}}};try{{Object.defineProperty(navigator,'locks',{{configurable:true,value:{{request:async(_n,_o,cb)=>cb({{name:'x'}})}}}})}}catch{{}}document.addEventListener('niakgpt:rpc-request',e=>{{window.__rpc.push(e.detail);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:e.detail.id,ok:true,status:200,data:{{gizmo_id:e.detail.body?.gizmo_id}}}}}})));}});window.__NIAKGPT_CACHE_BUS__={{update:async fn=>{{window.__store['niakgpt-v08-cache']=fn(window.__store['niakgpt-v08-cache']);return window.__store['niakgpt-v08-cache'];}}}};}}''')
    rc=source('reclassify-v101.js').replace("setTimeout(()=>schedule(0),2200);","setTimeout(()=>schedule(0),10);")
    await page3.evaluate(rc); await page3.wait_for_timeout(1800)
    got=await page3.evaluate("() => ({rpc:window.__rpc,chats:window.__store['niakgpt-v08-cache'].chats.map(c=>({id:c.id,p:c.projectId}))})")
    patches=[x for x in got['rpc'] if x.get('method')=='PATCH']; assert len(patches)==3,got
    assert all(x['body']['gizmo_id']=='g-p-niakgpt' for x in patches)
    mapping={c['id']:c['p'] for c in got['chats']}
    assert all(mapping[x]=='g-p-niakgpt' for x in ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333'])
    assert mapping['44444444-4444-4444-4444-444444444444']==''
    assert not any(x.get('method')=='GET' and '/backend-api/conversation/' in x.get('path','') for x in got['rpc'])
    assert not errors3,errors3

    print(f'REGRESSION_0959_PASS browser={browser_name}')
    await browser.close()

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');args=ap.parse_args();asyncio.run(run(args.browser))
