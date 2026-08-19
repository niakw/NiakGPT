import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const files=await Promise.all([
  'sidebar-projects-v121.js','sidebar-ux-v119.js','pin-folders-v096.js','native-actions-controller-v119.js','native-actions-v113.js',
  'sidebar-ux-v119.css','pin-folders-v096.css','native-actions-v113.css','sidebar-projects-authority-v112.css','project-chat-ux-v110.css'
].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const [projectsJs,legacySidebarJs,foldersJs,controllerJs,actionsJs,sidebarCss,foldersCss,actionsCss,authorityCss,chatCss]=files;
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const projectId=i=>`g-p-p${String(i).padStart(2,'0')}`;
const projectHref=i=>`/g/${projectId(i)}-project-${i}/project`;
const chatId=i=>`${String(i).padStart(8,'0')}-1111-4111-8111-${String(i).padStart(12,'0')}`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'}),page=await context.newPage();
  try{
    const projects=Array.from({length:25},(_,i)=>({id:projectId(i+1),name:i===0?'NiakGPT':`Project ${String(i+1).padStart(2,'0')}`,href:projectHref(i+1),color:'#4fc1ff',icon:'▤'}));
    const chats=[];for(let i=1;i<=12;i++)chats.push({id:chatId(i),title:`NiakGPT chat ${i}`,projectId:projectId(1),updated:Date.now()-i*1000,href:`/g/${projectId(1)}-niakgpt/c/${chatId(i)}`});for(let i=13;i<=30;i++)chats.push({id:chatId(i),title:`Other chat ${i}`,projectId:projectId((i%24)+2),updated:Date.now()-i*1000});
    const cache={schema:2,projects,chats,counts:Object.fromEntries(projects.map(p=>[p.id,chats.filter(c=>c.projectId===p.id).length])),projectChats:{[`${projectId(1)}-niakgpt`]:chats.filter(c=>c.projectId===projectId(1))}};
    await page.addInitScript(({cache})=>{
      const listeners=[];const store={'niakgpt-v08-cache':cache,'niakgpt-governance-v085':{coreProjectIds:['g-p-p01'],hiddenProjectIds:[]},'niakgpt-continuity-v100':{schema:2,out:{}}};
      window.__store=store;window.__diag={};
      window.chrome={storage:{local:{get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}for(const fn of listeners)fn(changes,'local');}},onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=v};
      window.__NIAKGPT_CACHE_BUS__={get:async()=>store['niakgpt-v08-cache'],peek:()=>store['niakgpt-v08-cache'],subscribe:fn=>{listeners.push((changes,area)=>{if(area==='local'&&changes['niakgpt-v08-cache'])fn(changes['niakgpt-v08-cache'].newValue);});return()=>{};}};
    },{cache});
    const p1=projectId(1),c1=chatId(1);
    const html=`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#070b10;color:#ddd;font-family:Arial}.sidebar{position:fixed;left:0;top:0;bottom:0;width:310px;overflow:auto;background:#101820}.sidebar a,.sidebar button{min-height:32px}.shell{padding:6px}.primary{display:grid;gap:2px}.native-projects{padding:4px}.native-row,.recent-row{display:grid;grid-template-columns:1fr 34px;gap:4px}.native-menu{position:absolute;width:220px;padding:8px;background:#18232e;border:1px solid #456}.ng96-folder-list{max-height:150px!important;overflow:auto!important}main{margin-left:310px;padding:30px}</style></head><body>
    <aside class="sidebar" data-testid="conversation-sidebar"><div id="sidebar-shell" class="shell"><div id="primary" class="primary"><a href="/">ChatGPT</a><a href="/explorer">Explorer</a><a href="/new">Nouveau chat</a><a href="/search">Rechercher dans les chats</a><a href="/images">Images</a><a href="/apps">Applications</a><a id="codex" href="/codex">Codex</a></div><section id="native-projects" class="native-projects" data-ng112-native-projects="1"><h3>Projets</h3>${projects.map((p,i)=>`<div class="native-row" data-sidebar-item="true"><a href="${p.href}">${p.name}</a><button class="native-more" aria-haspopup="menu" aria-controls="menu-${i+1}" data-pid="${p.id}">...</button></div>`).join('')}</section><section id="recents"><h3>Récents</h3><div class="recent-row" data-sidebar-item="true"><a href="/g/${p1}-niakgpt/c/${c1}">NiakGPT chat 1</a><button id="native-chat-more" aria-haspopup="menu" aria-controls="chat-menu">...</button></div></section></div></aside>
    <main><div data-message-author-role="assistant">Normal conversation</div><button id="main-more" aria-label="Plus d’options">...</button></main>
    <script>function toggleMenu(id){const old=document.getElementById(id);if(old){old.remove();return;}const m=document.createElement('div');m.id=id;m.className='native-menu';m.setAttribute('role','menu');m.innerHTML='<button role="menuitem">Renommer</button><button role="menuitem">Supprimer</button>';document.body.appendChild(m)}document.querySelectorAll('.native-more').forEach((b,i)=>b.onclick=()=>toggleMenu('menu-'+(i+1)));document.getElementById('native-chat-more').onclick=()=>toggleMenu('chat-menu');document.getElementById('main-more').onclick=()=>toggleMenu('main-menu');<\/script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/g/${p1}-niakgpt/c/${c1}`,{waitUntil:'domcontentloaded'});
    for(const css of [sidebarCss,foldersCss,actionsCss,authorityCss,chatCss])await page.addStyleTag({content:css});
    await page.addScriptTag({content:projectsJs});await page.addScriptTag({content:legacySidebarJs});await page.addScriptTag({content:foldersJs});await page.addScriptTag({content:controllerJs});await page.addScriptTag({content:actionsJs});
    await page.waitForTimeout(500);

    let state=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),native=document.getElementById('native-projects');return{parent:b?.parentElement?.id,next:b?.nextElementSibling?.id,count:b?.querySelectorAll('a[data-ng8-pin="1"]').length,head:b?.querySelector('.ng8-pin-head b')?.textContent,ready:document.documentElement.dataset.ng121PinsReady,placement:b?.dataset.ng121Placement};});
    assert(state.parent==='sidebar-shell'&&state.next==='native-projects'&&state.count===25&&state.head==='25'&&state.ready==='1',`initial live-shaped placement/catalog failed: ${JSON.stringify(state)}`);

    await page.evaluate(()=>{
      window.__badFrames=0;window.__frameWatch=true;const watch=()=>{if(!window.__frameWatch)return;const b=document.getElementById('ng8-pins'),native=document.getElementById('native-projects');if(!b||b.parentElement?.id!=='sidebar-shell'||b.nextElementSibling!==native||b.querySelectorAll('a[data-ng8-pin="1"]').length!==25)window.__badFrames++;requestAnimationFrame(watch);};requestAnimationFrame(watch);
      let n=0;window.__churn=setInterval(()=>{const b=document.getElementById('ng8-pins'),aside=document.querySelector('.sidebar'),shell=document.getElementById('sidebar-shell');if(!b||!aside||!shell)return;aside.insertBefore(b,shell);b.innerHTML='<div class="ng8-pin-head"><span>PROJECTS</span><b>8</b></div><div class="ng8-pin-list">'+Array.from({length:8},(_,i)=>'<a data-ng8-pin="1" href="/g/g-p-broken'+i+'/project"><span>Broken '+i+'</span></a>').join('')+'</div>';if(++n>=35){clearInterval(window.__churn);setTimeout(()=>window.__frameWatch=false,180);}},9);
    });
    await page.waitForTimeout(750);
    state=await page.evaluate(()=>{const b=document.getElementById('ng8-pins'),native=document.getElementById('native-projects');return{parent:b?.parentElement?.id,next:b?.nextElementSibling?.id,count:b?.querySelectorAll('a[data-ng8-pin="1"]').length,badFrames:window.__badFrames,diag:window.__diag['pins-ui']||''};});
    assert(state.parent==='sidebar-shell'&&state.next==='native-projects'&&state.count===25&&state.badFrames===0,/0/.test(String(state.badFrames))?`catalog not recovered after competing renderer: ${JSON.stringify(state)}`:`Projects block visibly jumped during competing renders: ${JSON.stringify(state)}`);

    const before=page.url();await page.locator(`#ng8-pins a[data-ng121-pid="${p1}"]`).click();await page.waitForTimeout(180);
    state=await page.evaluate(()=>({url:location.href,rows:document.querySelectorAll('#ng8-pins .ng96-folder-list a[data-chat]').length,empty:!!document.querySelector('#ng8-pins .ng96-folder-empty'),open:document.querySelector(`#ng8-pins a[data-ng121-pid="${p1}"]`)?.getAttribute('aria-expanded')}));
    assert(state.url===before&&state.rows===12&&!state.empty&&state.open==='true',`canonical Project slug did not open its 12 cached chats: ${JSON.stringify(state)}`);
    const scroll=await page.evaluate(()=>{const list=document.querySelector('#ng8-pins .ng96-folder-list');list.scrollTop=list.scrollHeight;return{client:list.clientHeight,scroll:list.scrollHeight,top:list.scrollTop,last:!!list.querySelector('.ng96-chat-entry:last-child')};});
    assert(scroll.scroll>scroll.client&&scroll.top>0&&scroll.last,`Project chat list is not independently scrollable: ${JSON.stringify(scroll)}`);

    const action=page.locator(`#ng8-pins .ng96-pin-entry[data-pid="${p1}"] > .ng113-native-actions-project`);await action.waitFor({state:'visible',timeout:2500});await action.click();await page.waitForFunction(()=>document.querySelector('#menu-1[role="menu"]'),null,{timeout:3500});
    state=await page.evaluate(()=>{const m=document.getElementById('menu-1');return{menu:!!m,owned:m?.dataset.ng119Owned||'',floated:m?.dataset.ng113Floated||'',diag:window.__diag['actions-project']||''};});
    assert(state.menu&&state.owned==='1'&&state.floated==='1',`canonical slug Project action button did not open native menu: ${JSON.stringify(state)}`);
    await action.click();await page.waitForTimeout(250);assert(await page.locator('#menu-1').count()===0,'second click did not close native Project menu');

    const chatAction=page.locator('#ng8-pins .ng96-chat-entry').first().locator('.ng113-native-actions-chat');await chatAction.click();await page.waitForFunction(()=>document.querySelector('#chat-menu[role="menu"]')||document.querySelector('#main-menu[role="menu"]'),null,{timeout:3500});
    assert(await page.locator('#ng113-actions-fallback').count()===0,'chat action fell back to a custom NiakGPT menu');

    console.log(`${engine} live sidebar screenshot state: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`live-sidebar-state-v122: ${Object.keys(engines).join(',')} PASS`);
