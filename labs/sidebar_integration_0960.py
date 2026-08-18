#!/usr/bin/env python3
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)

CURRENT='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
OTHER='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
OUT='cccccccc-cccc-cccc-cccc-cccccccccccc'
PID='g-p-niakgpt'
LONG='Correction architecture NiakGPT avec un titre volontairement extrêmement long qui ne doit jamais pousser la date ni remplacer le lien sous le pointeur'


def src(name):
    return (ROOT/name).read_text(encoding='utf-8')


def fixture():
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
      body{{margin:0;background:#071019;color:#dce7f1;font-family:system-ui}} nav{{width:330px;padding:8px}}
      #ng8-pins{{margin-top:10px;border:1px solid #27516a;padding:4px}}
      a{{color:inherit}}
    </style></head><body>
    <nav data-testid="conversation-sidebar">
      <div id="native-projects" class="group/sidebar-expando-section mb-x">
        <div class="group/sidebar-expando-section-header"><button><h2>Projets</h2></button><button aria-label="Nouveau projet">+</button></div>
        <ul><li><div class="group/project-unfurl-row"><div role="button" data-sidebar-item="true">NiakGPT</div></div></li><li><div class="group/project-unfurl-row"><div role="button">Films</div></div></li><li><button>Afficher plus</button></li></ul>
      </div>
      <section id="custom-gpts" class="group/sidebar-expando-section"><h2>GPTs</h2><a href="/g/custom-helper">Custom GPT</a></section>
      <section id="recents"><h2>Discussions</h2><a href="/c/recent-chat">Chat récent</a><button>Afficher plus</button></section>
      <section id="ng8-pins"><a data-ng8-pin="1" href="/g/{PID}/project"><span>NiakGPT</span><small>3</small></a></section>
    </nav></body></html>'''


async def run(browser_name):
  async with async_playwright() as p:
    browser=await getattr(p,browser_name).launch(headless=True)
    page=await browser.new_page(viewport={'width':1100,'height':760})
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    await page.route('https://chatgpt.com/**',lambda route: route.fulfill(status=200,content_type='text/html',body=fixture()))
    await page.goto(f'https://chatgpt.com/g/{PID}/c/{CURRENT}')

    cache={'projects':[{'id':PID,'name':'NiakGPT','href':f'/g/{PID}/project'}],
           'chats':[{'id':CURRENT,'title':LONG,'projectId':PID,'updated':1787000000000},
                    {'id':OTHER,'title':'Conversation normale','projectId':PID,'updated':1786900000000},
                    {'id':OUT,'title':'Conversation arrivée à la limite','projectId':PID,'updated':1786800000000}],
           'projectChats':{PID:[{'id':CURRENT,'title':LONG,'projectId':PID,'updated':1787000000000},
                               {'id':OTHER,'title':'Conversation normale','projectId':PID,'updated':1786900000000},
                               {'id':OUT,'title':'Conversation arrivée à la limite','projectId':PID,'updated':1786800000000}]}}
    state={'schema':1,'out':{OUT:{'out':True,'updatedAt':1787000000000,'reason':'limit-detected','title':'Conversation arrivée à la limite'}}}
    await page.evaluate(f'''() => {{
      window.__store={json.dumps({'niakgpt-v08-cache':cache,'niakgpt-continuity-v100':state})};
      window.__storageListeners=[]; window.__cacheListeners=[]; window.__rpc=[];
      const local={{
        get:async keys=>{{const ks=Array.isArray(keys)?keys:[keys];return Object.fromEntries(ks.map(k=>[k,window.__store[k]]));}},
        set:async obj=>{{for(const [k,v] of Object.entries(obj)){{const oldValue=window.__store[k];window.__store[k]=v;const changes={{[k]:{{oldValue,newValue:v}}}};for(const fn of window.__storageListeners)fn(changes,'local');}}}}
      }};
      window.chrome={{runtime:{{id:'lab-extension'}},storage:{{local,onChanged:{{addListener:fn=>window.__storageListeners.push(fn)}}}}}};
      window.chrome.storage.local=local;
      window.chrome.storage.onChanged={{addListener:fn=>window.__storageListeners.push(fn)}};
      window.__NIAKGPT_CACHE_BUS__={{
        subscribe(fn){{window.__cacheListeners.push(fn);queueMicrotask(()=>fn(window.__store['niakgpt-v08-cache']));return()=>{{window.__cacheListeners=window.__cacheListeners.filter(x=>x!==fn);}};}},
        async update(mutator){{const next=await mutator(window.__store['niakgpt-v08-cache']);window.__store['niakgpt-v08-cache']=next;for(const fn of window.__cacheListeners)fn(next);return next;}},
        peek:()=>window.__store['niakgpt-v08-cache']
      }};
      window.__publishCache=next=>{{window.__store['niakgpt-v08-cache']=next;for(const fn of window.__cacheListeners)fn(next);}};
      window.__publishOut=next=>{{const oldValue=window.__store['niakgpt-continuity-v100'];window.__store['niakgpt-continuity-v100']=next;const changes={{'niakgpt-continuity-v100':{{oldValue,newValue:next}}}};for(const fn of window.__storageListeners)fn(changes,'local');}};
      document.addEventListener('niakgpt:rpc-request',e=>{{window.__rpc.push(e.detail);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{{detail:{{id:e.detail.id,ok:true,status:200,data:{{}}}}}})));}});
      window.__NIAKGPT_DIAGNOSTICS__={{set(){{}}}};
    }}''')

    css='\n'.join(src(x) for x in ['sidebar-native-projects-v110.css','pin-folders-v096.css','project-chat-ux-v109.css','project-drawer-v110.css'])
    await page.add_style_tag(content=css)

    # Production order: v110 authority disables historical authority observers;
    # v110 drawer disables both historical drawer mutators before they execute.
    for name in ['sidebar-native-projects-v110.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js','sidebar-projects-authority-v109.js','project-drawer-v110.js','pin-folders-v096.js','project-chat-ux-v109.js']:
      await page.add_script_tag(content=src(name))
    await page.wait_for_timeout(180)

    assert await page.evaluate("getComputedStyle(document.querySelector('#native-projects')).display")=='none'
    assert await page.evaluate("getComputedStyle(document.querySelector('#custom-gpts')).display")!='none'
    assert await page.evaluate("getComputedStyle(document.querySelector('#recents')).display")!='none'
    flags=await page.evaluate("() => ({a:!!window.__NIAKGPT_SIDEBAR_AUTHORITY_107__,b:!!window.__NIAKGPT_SIDEBAR_EXPANDO_GUARD_108__,c:!!window.__NIAKGPT_PROJECTS_AUTHORITY_109__,d:!!window.__NIAKGPT_PIN_FOLDERS_096__,e:!!window.__NIAKGPT_PROJECT_CHAT_UX_109__})")
    assert all(flags.values()),flags

    await page.click('#ng8-pins a[data-ng8-pin="1"]')
    await page.wait_for_timeout(120)
    assert await page.locator('.ng110-pin-drawer').count()==1
    assert await page.locator('.ng96-pin-drawer').count()==0
    assert await page.locator('.ng109-chat-row').count()==0
    assert await page.locator('.ng110-chat-row').count()==3

    row_handle=await page.locator(f'.ng110-chat-row[data-chat-row="{CURRENT}"]').element_handle()
    date0=await page.locator(f'.ng110-chat-row[data-chat-row="{CURRENT}"] .ng110-chat-date').bounding_box()
    style=await page.locator(f'.ng110-chat-row[data-chat-row="{CURRENT}"] .ng110-chat-title').evaluate("el=>({overflow:getComputedStyle(el).overflow,white:getComputedStyle(el).whiteSpace,ellipsis:getComputedStyle(el).textOverflow,client:el.clientWidth,scroll:el.scrollWidth})")
    assert style['overflow']=='hidden' and style['white']=='nowrap' and style['ellipsis']=='ellipsis' and style['scroll']>=style['client'],style

    # 20 cache refreshes, alternating short/long titles. Node identity and date geometry must stay stable.
    for i in range(20):
      title='Court' if i%2 else LONG+f' #{i}'
      await page.evaluate(f'''() => {{const raw=structuredClone(window.__store['niakgpt-v08-cache']);for(const c of raw.chats)if(c.id==='{CURRENT}')c.title={json.dumps(title)};for(const c of raw.projectChats['{PID}'])if(c.id==='{CURRENT}')c.title={json.dumps(title)};window.__publishCache(raw);}}''')
      await page.wait_for_timeout(28)
    same=await page.evaluate("(el)=>el===document.querySelector('.ng110-chat-row[data-chat-row=\"%s\"]')"%CURRENT,row_handle)
    assert same is True
    date1=await page.locator(f'.ng110-chat-row[data-chat-row="{CURRENT}"] .ng110-chat-date').bounding_box()
    assert abs(date0['x']-date1['x'])<=1 and abs(date0['width']-date1['width'])<=1,(date0,date1)

    active=await page.locator(f'.ng110-chat-row[data-chat-row="{CURRENT}"]').evaluate("el=>({active:el.hasAttribute('data-ng110-active'),aria:el.querySelector('a').getAttribute('aria-current'),bg:getComputedStyle(el).backgroundColor,shadow:getComputedStyle(el).boxShadow})")
    assert active['active'] and active['aria']=='page' and active['shadow']!='none',active
    out=await page.locator(f'.ng110-chat-row[data-chat-row="{OUT}"]').evaluate("el=>({out:el.hasAttribute('data-ng110-out'),status:el.querySelector('.ng110-chat-status').textContent,shadow:getComputedStyle(el).boxShadow})")
    assert out['out'] and out['status']=='OUT' and out['shadow']!='none',out
    order=await page.locator('.ng110-chat-row').evaluate_all("els=>els.map(el=>el.dataset.chatRow)")
    assert order[-1]==OUT,order

    # Native anchors: production must not prevent normal, context-menu or modified clicks.
    await page.evaluate('''() => {window.__events=[];for(const type of ['click','contextmenu'])document.addEventListener(type,e=>{const a=e.target.closest?.('.ng110-chat-link');if(!a)return;window.__events.push({type,prevented:e.defaultPrevented,ctrl:e.ctrlKey,meta:e.metaKey});e.preventDefault();});}''')
    other=page.locator(f'.ng110-chat-link[data-chat="{OTHER}"]')
    await other.dispatch_event('click',{'button':0})
    await other.dispatch_event('contextmenu',{'button':2})
    await other.dispatch_event('click',{'button':0,'ctrlKey':True})
    ev=await page.evaluate('window.__events')
    assert len(ev)==3 and all(x['prevented'] is False for x in ev),ev

    # OUT state changes without rebuilding rows; it is persisted in local storage and reflected live.
    other_handle=await page.locator(f'.ng110-chat-row[data-chat-row="{OTHER}"]').element_handle()
    await page.evaluate(f'''() => {{const st=structuredClone(window.__store['niakgpt-continuity-v100']);st.out['{OTHER}']={{out:true,updatedAt:Date.now(),reason:'limit-detected'}};window.__publishOut(st);}}''')
    await page.wait_for_timeout(80)
    same_other=await page.evaluate("(el)=>el===document.querySelector('.ng110-chat-row[data-chat-row=\"%s\"]')"%OTHER,other_handle)
    assert same_other is True
    assert await page.locator(f'.ng110-chat-row[data-chat-row="{OTHER}"]').get_attribute('data-ng110-out') is not None
    assert await page.locator(f'.ng110-chat-row[data-chat-row="{OTHER}"] .ng110-chat-status').inner_text()=='OUT'

    # ChatGPT rerenders the native Projects expando: it must still never become visible.
    await page.evaluate('''() => {const old=document.querySelector('#native-projects');const clone=old.cloneNode(true);clone.id='native-projects-rerender';old.replaceWith(clone);}''')
    await page.wait_for_timeout(50)
    assert await page.evaluate("getComputedStyle(document.querySelector('#native-projects-rerender')).display")=='none'

    await page.screenshot(path=str(ART/f'0960-sidebar-integration-{browser_name}.png'),full_page=True)
    assert not errors,errors
    print(json.dumps({'browser':browser_name,'flags':flags,'active':active,'out':out,'order':order,'events':ev,'date0':date0,'date1':date1,'errors':errors},ensure_ascii=False))
    print(f'SIDEBAR_INTEGRATION_0960_PASS browser={browser_name}')
    await browser.close()

if __name__=='__main__':
  ap=argparse.ArgumentParser();ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');args=ap.parse_args();asyncio.run(run(args.browser))
