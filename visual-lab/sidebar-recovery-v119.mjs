import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const sidebarJs=await fs.readFile(path.join(ROOT,'sidebar-ux-v119.js'),'utf8');
const sidebarCss=await fs.readFile(path.join(ROOT,'sidebar-ux-v119.css'),'utf8');
const actionJs=await fs.readFile(path.join(ROOT,'native-actions-controller-v119.js'),'utf8');
const actionCss=await fs.readFile(path.join(ROOT,'native-actions-v113.css'),'utf8');
const authorityCss=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const interruptionJs=await fs.readFile(path.join(ROOT,'interruption-guard-v119.js'),'utf8');
const interruptionCss=await fs.readFile(path.join(ROOT,'interruption-guard-v119.css'),'utf8');
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const P1='g-p-studio',P2='g-p-research',C1='11111111-1111-4111-8111-111111111111';

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'}),page=await context.newPage();
  try{
    await page.addInitScript(({P1,P2})=>{
      const store={'niakgpt-v08-cache':{projects:[{id:P1,name:'Studio',href:`/g/${P1}/project`,description:'code interface extension'},{id:P2,name:'Research Lab',href:`/g/${P2}/project`,description:'recherche études documents'}],chats:[]}};
      window.chrome={storage:{local:{get:async key=>typeof key==='string'?{[key]:store[key]}:{...store},set:async obj=>Object.assign(store,obj)},onChanged:{addListener:()=>{}}}};
      window.__ng119Diag={};window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__ng119Diag[k]=v};
      window.__ng119OutMarks=0;window.__NIAKGPT_CONTINUITY__={markCurrentOut:async()=>{window.__ng119OutMarks++;}};
    },{P1,P2});
    const html=`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#081019;color:#dce7f1;font-family:Arial}.sidebar{position:fixed;left:0;top:0;bottom:0;width:310px;padding:8px;overflow:auto;background:#101820}.block{padding:6px}.row{display:grid;grid-template-columns:1fr 34px;gap:4px}.row a,.row button,#ng8-pins a,#ng8-pins button{min-height:32px}.native-menu{position:absolute;left:18px;top:150px;width:230px;padding:8px;background:#17212b;border:1px solid #405267}.ng96-pin-entry{display:grid;grid-template-columns:1fr 32px;gap:4px}#ng8-pins{padding:6px;background:#0b151e}main{margin-left:310px;padding:34px}button{cursor:pointer}</style></head><body><aside class="sidebar" data-testid="conversation-sidebar"><section id="ng8-pins"><div class="ng96-pin-entry" data-pid="${P1}"><a data-ng8-pin="1" href="/g/${P1}/project">Studio</a><button class="ng113-native-actions ng113-native-actions-project" data-ng113-actions="project" data-ng113-id="${P1}">...</button></div><div class="ng96-pin-entry" data-pid="${P2}"><a data-ng8-pin="1" href="/g/${P2}/project">Research Lab</a><button id="p2-action" class="ng113-native-actions ng113-native-actions-project" data-ng113-actions="project" data-ng113-id="${P2}">...</button></div><div class="ng96-chat-entry"><a data-chat="${C1}" href="/g/${P1}/c/${C1}">Chat sans ligne native</a><button id="chat-action" class="ng113-native-actions ng113-native-actions-chat" data-ng113-actions="chat" data-ng113-id="${C1}">...</button></div></section><div id="primary" class="block"><a href="/">ChatGPT</a><a href="/search">Recherche</a><button aria-label="Nouveau chat">Nouveau chat</button></div><section id="native-projects" data-ng112-native-projects="1" class="block"><div class="row" data-sidebar-item="true"><a href="/g/${P1}/project">Studio</a><button class="native-more" aria-label="Plus d’options" data-pid="${P1}">...</button></div><button id="show-more">Afficher plus</button></section><section id="recents" class="block"><h3>Récents</h3><a href="/c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa">Recent chat</a></section></aside><main><h1>Bonjour Tommy</h1><div id="signal-host"></div></main><script>window.__ng119PinToggles=0;document.querySelectorAll('#ng8-pins a[data-ng8-pin]').forEach(a=>a.addEventListener('click',()=>window.__ng119PinToggles++));function toggleMenu(pid){const old=document.querySelector('[role="menu"][data-owner="'+pid+'"]');if(old){old.remove();return;}const m=document.createElement('div');m.className='native-menu';m.setAttribute('role','menu');m.dataset.owner=pid;m.innerHTML='<button role="menuitem">Renommer</button><button role="menuitem">Supprimer</button>';document.body.appendChild(m)}document.querySelectorAll('.native-more').forEach(b=>b.onclick=()=>toggleMenu(b.dataset.pid));document.getElementById('show-more').onclick=()=>{if(document.querySelector('[data-sidebar-item][data-pid="${P2}"]'))return;const row=document.createElement('div');row.className='row';row.dataset.sidebarItem='true';row.dataset.pid='${P2}';row.innerHTML='<a href="/g/${P2}/project">Research Lab</a><button class="native-more" aria-label="Plus d’options" data-pid="${P2}">...</button>';row.querySelector('button').onclick=()=>toggleMenu('${P2}');document.getElementById('show-more').before(row)};<\/script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/c/${C1}`,{waitUntil:'domcontentloaded'});
    for(const css of [sidebarCss,actionCss,authorityCss,interruptionCss])await page.addStyleTag({content:css});
    await page.addScriptTag({content:sidebarJs});await page.addScriptTag({content:actionJs});await page.addScriptTag({content:interruptionJs});await page.waitForTimeout(420);

    const placement=await page.evaluate(()=>{const pins=document.getElementById('ng8-pins'),heading=document.querySelector('main h1');return{prev:pins.previousElementSibling?.id,next:pins.nextElementSibling?.id,placement:pins.dataset.ng119Placement,ready:document.documentElement.dataset.ng119PinsReady,greetingClass:heading.classList.contains('ng119-native-home-greeting'),greetingDisplay:getComputedStyle(heading).display};});
    assert(placement.prev==='primary'&&placement.next==='native-projects'&&placement.ready==='1',`pins not locked to native Projects slot: ${JSON.stringify(placement)}`);
    assert(placement.greetingClass&&placement.greetingDisplay==='none',`native welcome greeting not suppressed: ${JSON.stringify(placement)}`);

    const before=page.url();await page.locator(`#ng8-pins a[href="/g/${P2}/project"]`).click();await page.waitForTimeout(80);assert(page.url()===before,'Project label navigated instead of acting as folder');assert(await page.evaluate(()=>window.__ng119PinToggles)===1,'Project folder click did not propagate to drawer handler');

    await page.locator('#p2-action').click();await page.waitForFunction(pid=>document.querySelector(`[role="menu"][data-owner="${pid}"]`),P2,{timeout:3500});
    const projectMenu=await page.evaluate(pid=>{const menu=document.querySelector(`[role="menu"][data-owner="${pid}"]`),r=menu.getBoundingClientRect(),s=document.querySelector('.sidebar').getBoundingClientRect();return{left:r.left,sidebarRight:s.right,floated:menu.dataset.ng113Floated==='1',owned:menu.dataset.ng119Owned==='1',showMoreExpanded:!!document.querySelector(`[data-sidebar-item][data-pid="${pid}"]`),fallback:!!document.getElementById('ng113-actions-fallback')};},P2);
    assert(projectMenu.showMoreExpanded&&projectMenu.floated&&projectMenu.owned&&projectMenu.left>=projectMenu.sidebarRight,`non-first native Project menu did not resolve: ${JSON.stringify(projectMenu)}`);assert(!projectMenu.fallback,'custom fallback appeared for Project');
    await page.locator('#p2-action').click();await page.waitForTimeout(220);assert(await page.locator(`[role="menu"][data-owner="${P2}"]`).count()===0,'same Project dots did not close native menu');

    await page.locator('#chat-action').click();await page.waitForTimeout(700);const chatPolicy=await page.evaluate(()=>({fallback:!!document.getElementById('ng113-actions-fallback'),diag:window.__ng119Diag['actions-chat']||''}));assert(!chatPolicy.fallback&&/aucun fallback custom|INDISPONIBLE/i.test(chatPolicy.diag),`chat native-only policy failed: ${JSON.stringify(chatPolicy)}`);

    await page.evaluate(()=>{const a=document.createElement('div');a.id='limit-alert';a.setAttribute('role','alert');a.textContent='Vous avez atteint la limite de cette conversation. Continuez dans une nouvelle conversation.';document.getElementById('signal-host').appendChild(a);});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="limit"] .ng100-continue:not(:disabled)'),null,{timeout:3000});assert(await page.evaluate(()=>window.__ng119OutMarks)>=1,'limit signal did not persist continuity context');

    await page.evaluate(()=>{document.getElementById('limit-alert')?.remove();document.getElementById('ng119-interruption')?.remove();window.__ng119RetryClicks=0;const b=document.createElement('button');b.id='native-retry';b.textContent='Réessayer';b.onclick=()=>window.__ng119RetryClicks++;document.querySelector('main').appendChild(b);const a=document.createElement('div');a.id='network-alert';a.setAttribute('role','alert');a.textContent='Connexion perdue';document.getElementById('signal-host').appendChild(a);});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="network"]'),null,{timeout:2500});await page.evaluate(()=>document.getElementById('network-alert')?.remove());await page.waitForFunction(()=>window.__ng119RetryClicks===1,null,{timeout:3000});await page.waitForTimeout(450);assert(await page.evaluate(()=>window.__ng119RetryClicks)===1,'native network Retry was triggered more than once');

    await page.evaluate(()=>{document.getElementById('ng119-interruption')?.remove();window.__ng119ChallengeClicks=0;const a=document.createElement('div');a.id='verify-alert';a.setAttribute('role','alert');a.textContent='Vérification en cours — verify you are human';a.onclick=()=>window.__ng119ChallengeClicks++;document.getElementById('signal-host').appendChild(a);});
    await page.waitForFunction(()=>document.querySelector('#ng119-interruption[data-type="verify"]'),null,{timeout:2500});await page.waitForTimeout(350);assert(await page.evaluate(()=>window.__ng119ChallengeClicks)===0,'verification challenge was interacted with instead of being respected');

    console.log(`${engine} 0.9.69 stable pins/native-only actions/interruption recovery: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-recovery-v119: ${Object.keys(engines).join(',')} PASS`);
