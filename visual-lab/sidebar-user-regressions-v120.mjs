import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [hostJs,resilienceJs,pinJs,chatJs,guardJs,nativeJs,execJs,continuityJs,pinCss,chatCss,nativeCss,resilienceCss,authorityCss]=await Promise.all([
  read('sidebar-host-v090.js'),read('sidebar-resilience-v120.js'),read('pin-folders-v096.js'),read('project-chat-ux-v110.js'),read('native-actions-guard-v120.js'),read('native-actions-v113.js'),read('execution-resilience-v120.js'),read('continuity-v100.js'),read('pin-folders-v096.css'),read('project-chat-ux-v110.css'),read('native-actions-v113.css'),read('sidebar-resilience-v120.css'),read('sidebar-projects-authority-v112.css')
]);
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const P='g-p-niakgpt';
const ids=Array.from({length:14},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-4111-8111-${String(i+1).padStart(12,'0')}`);
const chats=ids.map((id,i)=>({id,title:`Discussion ${String(i+1).padStart(2,'0')}`,projectId:P,updated:Date.now()-i*60000,href:`/g/${P}/c/${id}`}));
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#081018;color:#dce7f1;font-family:Arial}.sidebar{position:fixed;inset:0 auto 0 0;width:310px;height:100vh;overflow:auto;background:#101820;padding:8px}.brand{height:50px;padding:12px;font-weight:700}.nav>button,.nav>a{display:flex;width:100%;height:40px;align-items:center;padding:0 10px;color:white;background:transparent;border:0;text-decoration:none}.nav h3{margin:18px 10px 6px}.native-row{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:4px;min-height:36px}.native-row>a{padding:8px;color:#dce7f1;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.native-row>button{width:34px;border:0;background:#16222d;color:white}.native-menu{position:absolute;left:10px;top:190px;width:250px;padding:6px;background:#16222d;border:1px solid #405063}.native-menu button{display:block;width:100%;height:34px;background:transparent;color:white;border:0;text-align:left}.main{margin-left:310px;min-height:100vh;padding:80px 60px 160px}.composer{position:fixed;left:370px;right:60px;bottom:30px}.composer textarea{width:100%;height:60px}.retry{position:fixed;right:20px;top:20px}.alert{margin:8px;padding:10px;border:1px solid #7d4}.token{display:inline}.ng8-pin-head{padding:6px 8px}.ng8-pin-list>a{display:flex;min-height:36px;padding:8px;color:white;text-decoration:none;background:#0d1720}
</style></head><body>
<aside class="sidebar" data-testid="conversation-sidebar"><div class="brand" id="native-brand">ChatGPT</div><nav class="nav" id="native-nav">
<button>Nouveau chat</button><a href="/library">Bibliothèque</a><a href="/projects">Projects</a><a href="/tasks">Planification</a><button>Plus</button>
<section id="native-projects" data-ng112-native-projects="1"><h3>Projects</h3><div class="project-list"><div class="native-row" data-sidebar-item="true"><a href="/g/${P}/project">NiakGPT</a><button id="native-project-options" aria-label="Plus d’options">•••</button></div></div></section>
<h3 id="recents-heading">Récents</h3><div class="recent-list"><div class="native-row" data-sidebar-item="true"><a href="/c/${ids[0]}">Discussion 01</a><button id="native-chat-options" aria-label="Plus d’options">•••</button></div></div>
</nav></aside>
<main class="main"><h1 id="welcome">Comment puis-je vous aider ?</h1><section id="feed"><article data-message-author-role="assistant">Réponse initiale</article></section><form class="composer"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea></form></main>
<script>
window.__menuOpen=0;window.__retryClicks=0;
function closeMenus(){document.querySelectorAll('.native-menu').forEach(m=>m.remove());}
function menu(kind){const old=document.querySelector('.native-menu[data-kind="'+kind+'"]');if(old){old.remove();return;}closeMenus();const m=document.createElement('div');m.className='native-menu';m.dataset.kind=kind;m.setAttribute('role','menu');for(const t of kind==='project'?['Renommer','Modifier le projet','Supprimer']:['Renommer','Déplacer vers un projet','Archiver']){const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=t;m.appendChild(b);}document.querySelector('.sidebar').appendChild(m);window.__menuOpen++;}
document.getElementById('native-project-options').addEventListener('click',()=>menu('project'));document.getElementById('native-chat-options').addEventListener('click',()=>menu('chat'));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
window.addRetry=()=>{document.getElementById('lab-retry')?.remove();const b=document.createElement('button');b.id='lab-retry';b.className='retry';b.textContent='Réessayer';b.addEventListener('click',()=>{window.__retryClicks++;b.remove();});document.body.appendChild(b);};
window.addAlert=text=>{document.getElementById('lab-alert')?.remove();const a=document.createElement('div');a.id='lab-alert';a.className='alert';a.setAttribute('role','alert');a.textContent=text;document.querySelector('main').prepend(a);};
window.clearAlert=()=>document.getElementById('lab-alert')?.remove();
</script></body></html>`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:800},colorScheme:'dark'}),page=await context.newPage();
  try{
    await page.addInitScript(({P,chats})=>{
      const listeners=[];const store={'niakgpt-v08-cache':{schema:2,at:Date.now(),projects:[{id:P,name:'NiakGPT',href:`/g/${P}/project`}],chats,projectChats:{[P]:chats},counts:{[P]:chats.length},indexedProjectIds:[P]},'niakgpt-continuity-v100':{schema:1,out:{}}};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.68'})},storage:{local:{get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}listeners.forEach(fn=>fn(changes,'local'));}},onChanged:{addListener:fn=>listeners.push(fn)}}};window.__store=store;
    },{P,chats});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/c/${ids[0]}`,{waitUntil:'domcontentloaded'});
    for(const css of [authorityCss,pinCss,chatCss,nativeCss,resilienceCss])await page.addStyleTag({content:css});
    await page.addScriptTag({content:hostJs});
    await page.waitForTimeout(80);
    const wrongSlot=await page.evaluate(()=>document.getElementById('ng8-pins')?.nextElementSibling?.id||'');
    assert(wrongSlot==='native-nav',`legacy host bug not reproduced before guard: ${wrongSlot}`);
    await page.addScriptTag({content:resilienceJs});
    await page.waitForTimeout(120);
    await page.evaluate(P=>{const box=document.getElementById('ng8-pins');box.innerHTML=`<div class="ng8-pin-head"><span>PROJECTS</span></div><div class="ng8-pin-list"><a data-ng8-pin="1" href="/g/${P}/project"><span>NiakGPT</span></a></div>`;document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));},P);
    await page.addScriptTag({content:pinJs});await page.addScriptTag({content:chatJs});await page.addScriptTag({content:guardJs});await page.addScriptTag({content:nativeJs});await page.addScriptTag({content:continuityJs});await page.addScriptTag({content:execJs});await page.waitForTimeout(450);

    const slot=await page.evaluate(()=>{const b=document.getElementById('ng8-pins');return{parent:b.parentElement?.id,next:b.nextElementSibling?.id,visible:getComputedStyle(b).display!=='none',brandBefore:document.getElementById('native-brand').getBoundingClientRect().top<b.getBoundingClientRect().top};});
    assert(slot.parent==='native-nav'&&slot.next==='native-projects'&&slot.visible&&slot.brandBefore,`Projects slot unstable/wrong: ${JSON.stringify(slot)}`);

    for(const pathName of ['/','/library','/projects']){
      await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},pathName);await page.waitForTimeout(120);
      const state=await page.evaluate(()=>({connected:document.getElementById('ng8-pins')?.isConnected,display:getComputedStyle(document.getElementById('ng8-pins')).display,parent:document.getElementById('ng8-pins')?.parentElement?.id}));
      assert(state.connected&&state.display!=='none'&&state.parent==='native-nav',`Projects missing on ${pathName}: ${JSON.stringify(state)}`);
    }
    const welcomeHidden=await page.evaluate(()=>getComputedStyle(document.getElementById('welcome')).display==='none');assert(welcomeHidden,'home welcome message not hidden');

    await page.evaluate(id=>{history.pushState({},'',`/c/${id}`);dispatchEvent(new PopStateEvent('popstate'));},ids[0]);await page.waitForTimeout(100);
    const project=page.locator('#ng8-pins a[data-ng8-pin="1"]');const beforePath=new URL(page.url()).pathname;await project.click();await page.waitForTimeout(120);assert(new URL(page.url()).pathname===beforePath,'Project name click navigated instead of toggling');assert(await page.locator('#ng8-pins .ng96-pin-drawer').count()===1,'Project name did not open drawer');await project.click();await page.waitForTimeout(80);assert(await page.locator('#ng8-pins .ng96-pin-drawer').count()===0,'Project name did not close drawer');await project.click();await page.waitForTimeout(120);

    const scroll=await page.evaluate(()=>{const l=document.querySelector('#ng8-pins .ng96-folder-list');return{rows:l?.querySelectorAll('.ng96-chat-entry').length||0,client:l?.clientHeight||0,height:l?.scrollHeight||0};});
    assert(scroll.rows===14&&scroll.height>scroll.client,`drawer is not really scrollable past 8 chats: ${JSON.stringify(scroll)}`);
    const scrolled=await page.evaluate(()=>{const l=document.querySelector('#ng8-pins .ng96-folder-list');l.scrollTop=l.scrollHeight;return new Promise(r=>requestAnimationFrame(()=>{const last=l.querySelector('.ng96-chat-entry:last-child').getBoundingClientRect(),lr=l.getBoundingClientRect();r({top:l.scrollTop,lastBottom:last.bottom,listBottom:lr.bottom});}));});
    assert(scrolled.top>0&&scrolled.lastBottom<=scrolled.listBottom+2,`cannot reach last discussion by scroll: ${JSON.stringify(scrolled)}`);

    await page.evaluate(({P,id})=>{history.pushState({},'',`/g/${P}/c/${id}`);dispatchEvent(new PopStateEvent('popstate'));},{P,id:ids[13]});await page.waitForTimeout(850);
    const active=await page.evaluate(id=>{const a=document.querySelector(`#ng8-pins a[data-chat="${id}"]`),l=a?.closest('.ng96-folder-list');return{active:a?.dataset.ng110Active,current:a?.getAttribute('aria-current'),scroll:l?.scrollTop||0};},ids[13]);
    assert(active.active==='1'&&active.current==='page'&&active.scroll>0,`continued/new chat not selected/revealed: ${JSON.stringify(active)}`);

    const stableBefore=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),r=b.getBoundingClientRect();return{top:r.top,parent:b.parentElement?.id,next:b.nextElementSibling?.id};});
    await page.evaluate(()=>{const ed=document.getElementById('prompt-textarea'),feed=document.getElementById('feed');for(let i=0;i<80;i++){ed.value=`texte ${i}`;ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:String(i)}));const s=document.createElement('span');s.className='token';s.textContent='x';feed.appendChild(s);}});await page.waitForTimeout(350);
    const stableAfter=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),r=b.getBoundingClientRect();return{top:r.top,parent:b.parentElement?.id,next:b.nextElementSibling?.id};});
    assert(Math.abs(stableAfter.top-stableBefore.top)<1&&stableAfter.parent===stableBefore.parent&&stableAfter.next===stableBefore.next,`Projects block moved while typing/streaming: ${JSON.stringify({stableBefore,stableAfter})}`);

    const projectAction=page.locator('#ng8-pins .ng113-native-actions-project');await projectAction.click();await page.waitForTimeout(520);
    let menu=await page.evaluate(()=>({native:!!document.querySelector('.native-menu[data-kind="project"].ng120-native-menu'),fallback:!!document.getElementById('ng113-actions-fallback')}));assert(menu.native&&!menu.fallback,`Project ... did not stay native: ${JSON.stringify(menu)}`);await projectAction.click();await page.waitForTimeout(180);assert(await page.locator('.native-menu[data-kind="project"]').count()===0,'Project ... reopened instead of closing');

    const chatAction=page.locator(`#ng8-pins .ng96-chat-entry[data-chat-entry="${ids[0]}"]>.ng113-native-actions-chat`);await chatAction.click();await page.waitForTimeout(520);menu=await page.evaluate(()=>({native:!!document.querySelector('.native-menu[data-kind="chat"].ng120-native-menu'),fallback:!!document.getElementById('ng113-actions-fallback')}));assert(menu.native&&!menu.fallback,`Chat ... did not stay native: ${JSON.stringify(menu)}`);await chatAction.click();await page.waitForTimeout(180);assert(await page.locator('.native-menu[data-kind="chat"]').count()===0,'Chat ... reopened instead of closing');

    await page.evaluate(()=>{window.__retryClicks=0;window.addRetry();window.addAlert('Vérification en cours');});await page.waitForTimeout(500);
    let recovery=await page.evaluate(()=>({verify:document.documentElement.dataset.ng105Verification,retries:window.__retryClicks}));assert(recovery.verify==='1'&&recovery.retries===0,`verification was not a real pause: ${JSON.stringify(recovery)}`);
    await page.evaluate(()=>{window.clearAlert();document.documentElement.dataset.ng86Activity='ready';});await page.waitForTimeout(3900);recovery=await page.evaluate(()=>({verify:document.documentElement.dataset.ng105Verification||'',retries:window.__retryClicks}));assert(recovery.verify===''&&recovery.retries===1,`post-verification native recovery failed: ${JSON.stringify(recovery)}`);

    await page.evaluate(()=>{window.__retryClicks=0;window.addRetry();document.documentElement.dataset.ng86Activity='executing';window.addAlert('Connexion perdue');});await page.waitForTimeout(700);assert(await page.evaluate(()=>window.__retryClicks)===0,'network retry fired while connection error was still visible');await page.evaluate(()=>{window.clearAlert();document.documentElement.dataset.ng86Activity='ready';});await page.waitForTimeout(3900);assert(await page.evaluate(()=>window.__retryClicks)===1,'connection-lost recovery did not trigger native Retry exactly once');

    await page.evaluate(()=>{const a=document.createElement('div');a.setAttribute('data-message-author-role','assistant');a.textContent='Cette conversation est trop longue. Commencez un nouveau chat pour continuer.';document.getElementById('feed').appendChild(a);});await page.waitForTimeout(650);
    const out=await page.evaluate(id=>window.__store['niakgpt-continuity-v100']?.out?.[id]||null,ids[13]);assert(out?.projectId===P,'conversation limit was not converted into NiakGPT continuity state');

    console.log(`${engine} user regressions v120: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-user-regressions-v120: ${Object.keys(engines).join(',')} PASS`);
