import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [sidebarJs,pinJs,chatJs,controllerJs,nativeJs,interruptJs,bridgeJs,pinCss,sidebarCss,nativeCss,interruptCss,authorityCss]=await Promise.all([
  read('sidebar-ux-v119.js'),
  read('pin-folders-v096.js'),
  read('project-chat-ux-v110.js'),
  read('native-actions-controller-v119.js'),
  read('native-actions-v113.js'),
  read('interruption-guard-v119.js'),
  read('page-bridge.js'),
  read('pin-folders-v096.css'),
  read('sidebar-ux-v119.css'),
  read('native-actions-v113.css'),
  read('interruption-guard-v119.css'),
  read('sidebar-projects-authority-v112.css')
]);

const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const P='g-p-niakgpt';
const ids=Array.from({length:14},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-4111-8111-${String(i+1).padStart(12,'0')}`);
const chats=ids.map((id,i)=>({id,title:`Discussion ${String(i+1).padStart(2,'0')}`,projectId:P,updated:Date.now()-i*60000,href:`/g/${P}/c/${id}`}));

const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#081018;color:#dce7f1;font-family:Arial}.sidebar{position:fixed;inset:0 auto 0 0;width:310px;height:100vh;overflow:auto;background:#101820;padding:8px}.brand{height:48px;padding:12px;font-weight:700}.primary>a,.primary>button{display:flex;width:100%;height:38px;align-items:center;padding:0 10px;color:white;background:transparent;border:0;text-decoration:none}.native-projects,.recents{padding:5px}.native-row{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:4px;min-height:36px}.native-row>a{padding:8px;color:#dce7f1;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.native-row>button{width:34px;border:0;background:#16222d;color:white}.native-menu{position:absolute;left:12px;top:180px;width:250px;padding:6px;background:#16222d;border:1px solid #405063}.native-menu button{display:block;width:100%;height:34px;background:transparent;color:white;border:0;text-align:left}.main{margin-left:310px;min-height:100vh;padding:70px 60px 160px}.composer{position:fixed;left:370px;right:60px;bottom:30px}.composer textarea{width:100%;height:60px}.retry{position:fixed;right:20px;top:20px}.signal{margin:8px;padding:10px;border:1px solid #7d4}.token{display:inline}.ng8-pin-head{padding:6px 8px}.ng8-pin-list>a{display:flex;min-height:36px;padding:8px;color:white;text-decoration:none;background:#0d1720}
</style></head><body>
<aside class="sidebar" data-testid="conversation-sidebar">
  <section id="ng8-pins"><div class="ng8-pin-head">PROJECTS</div><div class="ng8-pin-list"><div class="ng96-pin-entry" data-pid="${P}"><a data-ng8-pin="1" href="/g/${P}/project"><span>NiakGPT</span></a><button class="ng113-native-actions ng113-native-actions-project" data-ng113-actions="project" data-ng113-id="${P}" aria-label="Actions du Project (menu ChatGPT)">•••</button></div></div></section>
  <div class="brand" id="native-brand">ChatGPT</div>
  <section class="primary" id="primary"><button>Nouveau chat</button><a href="/library">Bibliothèque</a><a href="/projects">Projects</a><button>Plus</button></section>
  <section id="native-projects" class="native-projects" data-ng112-native-projects="1"><h3>Projects</h3><div class="native-row" data-sidebar-item="true"><a href="/g/${P}/project">NiakGPT</a><button id="native-project-options" aria-label="Plus d’options">•••</button></div></section>
  <section id="recents" class="recents"><h3>Récents</h3><div class="native-row" data-sidebar-item="true"><a href="/c/${ids[0]}">Discussion 01</a><button id="native-chat-options" aria-label="Plus d’options">•••</button></div></section>
</aside>
<main class="main"><h1 id="welcome">Comment puis-je vous aider ?</h1><section id="signal-host"></section><section id="feed"></section><form class="composer"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea></form></main>
<script>
window.__retryClicks=0;window.__challengeClicks=0;
function closeMenus(){document.querySelectorAll('.native-menu').forEach(m=>m.remove());}
function menu(kind){const old=document.querySelector('.native-menu[data-kind="'+kind+'"]');if(old){old.remove();return;}closeMenus();const m=document.createElement('div');m.className='native-menu';m.dataset.kind=kind;m.setAttribute('role','menu');for(const t of kind==='project'?['Renommer','Modifier le projet','Supprimer']:['Renommer','Déplacer vers un projet','Archiver']){const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=t;m.appendChild(b);}document.body.appendChild(m);}
document.getElementById('native-project-options').addEventListener('click',()=>menu('project'));document.getElementById('native-chat-options').addEventListener('click',()=>menu('chat'));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
window.addRetry=()=>{document.getElementById('lab-retry')?.remove();window.__retryClicks=0;const b=document.createElement('button');b.id='lab-retry';b.className='retry';b.textContent='Réessayer';b.addEventListener('click',()=>{window.__retryClicks++;b.remove();});document.body.appendChild(b);};
window.addSignal=(id,text)=>{document.getElementById(id)?.remove();const a=document.createElement('div');a.id=id;a.className='signal';a.setAttribute('role','alert');a.textContent=text;document.getElementById('signal-host').appendChild(a);return a;};
</script></body></html>`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(({P,chats})=>{
      const listeners=[];
      const store={
        'niakgpt-v08-cache':{schema:2,at:Date.now(),projects:[{id:P,name:'NiakGPT',href:`/g/${P}/project`}],chats,projectChats:{[P]:chats},counts:{[P]:chats.length},indexedProjectIds:[P]},
        'niakgpt-continuity-v100':{schema:1,out:{}}
      };
      window.__store=store;window.__networkCalls=[];window.__outMarks=0;window.__diag={};
      window.fetch=async input=>{window.__networkCalls.push(String(input));return new Response(JSON.stringify({accessToken:'lab-token'}),{status:200,headers:{'Content-Type':'application/json'}});};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.70'})},storage:{local:{
        get:async keys=>{if(keys==null)return{...store};const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},
        set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}listeners.forEach(fn=>fn(changes,'local'));}
      },onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=v};
      window.__NIAKGPT_CONTINUITY__={markCurrentOut:async()=>{window.__outMarks++;}};
    },{P,chats});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/c/${ids[0]}`,{waitUntil:'domcontentloaded'});

    const initial=await page.evaluate(()=>{const pins=document.getElementById('ng8-pins'),brand=document.getElementById('native-brand');return{pinsTop:pins.getBoundingClientRect().top,brandTop:brand.getBoundingClientRect().top};});
    assert(initial.pinsTop<initial.brandTop,`reported bad placement was not reproduced: ${JSON.stringify(initial)}`);

    for(const css of [authorityCss,pinCss,sidebarCss,nativeCss,interruptCss])await page.addStyleTag({content:css});
    await page.addScriptTag({content:bridgeJs});
    await page.addScriptTag({content:sidebarJs});
    await page.addScriptTag({content:pinJs});
    await page.addScriptTag({content:chatJs});
    await page.addScriptTag({content:controllerJs});
    await page.addScriptTag({content:nativeJs});
    await page.addScriptTag({content:interruptJs});
    await page.waitForTimeout(650);

    const slot=await page.evaluate(()=>{const b=document.getElementById('ng8-pins');return{prev:b.previousElementSibling?.id,next:b.nextElementSibling?.id,placement:b.dataset.ng119Placement,ready:document.documentElement.dataset.ng119PinsReady,visible:getComputedStyle(b).visibility!=='hidden'};});
    assert(slot.prev==='primary'&&slot.next==='native-projects'&&slot.placement==='projects-slot'&&slot.ready==='1'&&slot.visible,`Projects slot not corrected/stable: ${JSON.stringify(slot)}`);

    for(const route of ['/','/library','/projects',`/c/${ids[0]}`]){
      await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},route);await page.waitForTimeout(120);
      const state=await page.evaluate(()=>{const b=document.getElementById('ng8-pins');return{connected:!!b?.isConnected,prev:b?.previousElementSibling?.id,next:b?.nextElementSibling?.id,visible:b?getComputedStyle(b).visibility!=='hidden':false};});
      assert(state.connected&&state.prev==='primary'&&state.next==='native-projects'&&state.visible,`Projects missing/moved on ${route}: ${JSON.stringify(state)}`);
    }
    assert(await page.evaluate(()=>getComputedStyle(document.getElementById('welcome')).display==='none'),'home welcome heading was not suppressed');

    const project=page.locator('#ng8-pins a[data-ng8-pin="1"]');
    const beforePath=new URL(page.url()).pathname;
    await project.click();await page.waitForTimeout(160);
    assert(new URL(page.url()).pathname===beforePath,'Project name navigated instead of toggling drawer');
    assert(await page.locator('#ng8-pins .ng96-pin-drawer').count()===1,'Project name did not open drawer');
    await project.click();await page.waitForTimeout(100);assert(await page.locator('#ng8-pins .ng96-pin-drawer').count()===0,'second Project-name click did not close drawer');
    await project.click();await page.waitForTimeout(160);

    const scroll=await page.evaluate(()=>{const l=document.querySelector('#ng8-pins .ng96-folder-list');return{rows:l?.querySelectorAll('.ng96-chat-entry').length||0,client:l?.clientHeight||0,height:l?.scrollHeight||0};});
    assert(scroll.rows===14&&scroll.height>scroll.client,`14-chat drawer is not independently scrollable: ${JSON.stringify(scroll)}`);
    const reachLast=await page.evaluate(()=>{const l=document.querySelector('#ng8-pins .ng96-folder-list');l.scrollTop=l.scrollHeight;return new Promise(resolve=>requestAnimationFrame(()=>{const last=l.querySelector('.ng96-chat-entry:last-child').getBoundingClientRect(),lr=l.getBoundingClientRect();resolve({scrollTop:l.scrollTop,lastBottom:last.bottom,listBottom:lr.bottom});}));});
    assert(reachLast.scrollTop>0&&reachLast.lastBottom<=reachLast.listBottom+2,`last chat cannot be reached after first 8: ${JSON.stringify(reachLast)}`);

    await page.evaluate(()=>{const l=document.querySelector('#ng8-pins .ng96-folder-list');l.scrollTop=0;});
    await page.evaluate(({P,id})=>{history.pushState({},'',`/g/${P}/c/${id}`);dispatchEvent(new PopStateEvent('popstate'));},{P,id:ids[13]});
    await page.waitForTimeout(450);
    const active=await page.evaluate(id=>{const a=document.querySelector(`#ng8-pins a[data-chat="${id}"]`),l=a?.closest('.ng96-folder-list');return{active:a?.dataset.ng110Active,current:a?.getAttribute('aria-current'),scroll:l?.scrollTop||0};},ids[13]);
    assert(active.active==='1'&&active.current==='page'&&active.scroll>0,`active/continued chat was not selected and revealed: ${JSON.stringify(active)}`);

    const stableBefore=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),r=b.getBoundingClientRect();return{top:r.top,prev:b.previousElementSibling?.id,next:b.nextElementSibling?.id,parent:b.parentElement?.getAttribute('data-testid')||''};});
    await page.evaluate(()=>{const ed=document.getElementById('prompt-textarea'),feed=document.getElementById('feed');for(let i=0;i<100;i++){ed.value=`texte ${i}`;ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:String(i)}));const s=document.createElement('span');s.className='token';s.textContent='x';feed.appendChild(s);}});
    await page.waitForTimeout(300);
    const stableAfter=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),r=b.getBoundingClientRect();return{top:r.top,prev:b.previousElementSibling?.id,next:b.nextElementSibling?.id,parent:b.parentElement?.getAttribute('data-testid')||''};});
    assert(Math.abs(stableAfter.top-stableBefore.top)<1&&JSON.stringify(stableAfter)===JSON.stringify(stableBefore),`Projects moved during typing/streaming: ${JSON.stringify({stableBefore,stableAfter})}`);

    const projectAction=page.locator('#ng8-pins .ng113-native-actions-project');
    await projectAction.click();await page.waitForTimeout(520);
    let menuState=await page.evaluate(()=>({native:!!document.querySelector('.native-menu[data-kind="project"].ng113-native-menu-floating'),owned:document.querySelector('.native-menu[data-kind="project"]')?.dataset.ng119Owned||'',fallback:!!document.getElementById('ng113-actions-fallback')}));
    assert(menuState.native&&menuState.owned==='1'&&!menuState.fallback,`Project ... is not native-only: ${JSON.stringify(menuState)}`);
    await projectAction.click();await page.waitForTimeout(220);assert(await page.locator('.native-menu[data-kind="project"]').count()===0,'Project ... reopened instead of closing');

    await page.evaluate(id=>{history.pushState({},'',`/c/${id}`);dispatchEvent(new PopStateEvent('popstate'));},ids[0]);await page.waitForTimeout(160);
    const chatAction=page.locator(`#ng8-pins .ng96-chat-entry[data-chat-entry="${ids[0]}"]>.ng113-native-actions-chat`);
    await chatAction.click();await page.waitForTimeout(520);
    menuState=await page.evaluate(()=>({native:!!document.querySelector('.native-menu[data-kind="chat"].ng113-native-menu-floating'),owned:document.querySelector('.native-menu[data-kind="chat"]')?.dataset.ng119Owned||'',fallback:!!document.getElementById('ng113-actions-fallback')}));
    assert(menuState.native&&menuState.owned==='1'&&!menuState.fallback,`Chat ... is not native-only: ${JSON.stringify(menuState)}`);
    await chatAction.click();await page.waitForTimeout(220);assert(await page.locator('.native-menu[data-kind="chat"]').count()===0,'Chat ... reopened instead of closing');

    await page.evaluate(()=>{window.addRetry();const ed=document.getElementById('prompt-textarea');ed.value='brouillon vérification';ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:'brouillon vérification'}));const a=window.addSignal('verify-alert','Vérification en cours — verify you are human');a.addEventListener('click',()=>window.__challengeClicks++);});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="verify"]')&&document.documentElement.dataset.ng105Verification==='1',null,{timeout:3000});
    const beforeCalls=await page.evaluate(()=>window.__networkCalls.length);
    const bridgePause=await page.evaluate(()=>new Promise(resolve=>{const id='verify-rpc';const h=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',h);resolve(e.detail);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path:'/backend-api/conversations?offset=0&limit=1',method:'GET'}}));}));
    const verifyState=await page.evaluate(()=>({challengeClicks:window.__challengeClicks,calls:window.__networkCalls.length,draft:document.getElementById('prompt-textarea').value}));
    assert(bridgePause?.error==='native_busy'&&bridgePause?.transport==='bridge-pause',`bridge did not pause during verification: ${JSON.stringify(bridgePause)}`);
    assert(verifyState.challengeClicks===0&&verifyState.calls===beforeCalls&&verifyState.draft==='brouillon vérification',`verification was bypassed or draft changed: ${JSON.stringify(verifyState)}`);
    await page.evaluate(()=>document.getElementById('verify-alert')?.remove());
    await page.waitForFunction(()=>document.documentElement.dataset.ng105Verification!=='1'&&!document.getElementById('ng119-interruption'),null,{timeout:3500});
    assert(await page.evaluate(()=>window.__retryClicks)===0,'verification recovery must never auto-click native Retry');

    await page.evaluate(()=>{document.getElementById('ng119-interruption')?.remove();window.addRetry();const ed=document.getElementById('prompt-textarea');ed.value='brouillon connexion à conserver';ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:'brouillon connexion à conserver'}));window.addSignal('network-alert','Connexion perdue');});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="network"]'),null,{timeout:3000});
    await page.evaluate(()=>{const ed=document.getElementById('prompt-textarea');ed.value='';ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:null}));document.getElementById('network-alert')?.remove();window.dispatchEvent(new Event('online'));});
    await page.waitForFunction(()=>!document.getElementById('ng119-interruption')&&document.getElementById('prompt-textarea').value==='brouillon connexion à conserver',null,{timeout:3500});
    assert(await page.evaluate(()=>window.__retryClicks)===0,'connection-lost recovery must never auto-click native Retry');

    await page.evaluate(()=>{document.getElementById('ng119-interruption')?.remove();window.addSignal('limit-alert','Cette conversation est trop longue. Commencez un nouveau chat pour continuer.');});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="limit"] .ng100-continue:not(:disabled)'),null,{timeout:3000});
    assert(await page.evaluate(()=>window.__outMarks)>=1,'conversation limit did not enter continuity state');

    console.log(`${engine} user-reported regressions: PASS`);
  }finally{
    await context.close();
    await browser.close();
  }
}
console.log(`user-reported-regressions-v120: ${Object.keys(engines).join(',')} PASS`);
