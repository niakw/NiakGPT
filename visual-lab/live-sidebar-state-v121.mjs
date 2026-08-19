import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [foldersJs,projectsJs,controllerJs,nativeJs,foldersCss,sidebarCss,nativeCss]=await Promise.all([
  read('pin-folders-v096.js'),read('sidebar-projects-v121.js'),read('native-actions-controller-v119.js'),read('native-actions-v113.js'),
  read('pin-folders-v096.css'),read('sidebar-ux-v119.css'),read('native-actions-v113.css')
]);
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const projects=Array.from({length:15},(_,i)=>({id:`g-p-proj${String(i+1).padStart(2,'0')}`,name:`Project ${String(i+1).padStart(2,'0')}`,href:`/g/g-p-proj${String(i+1).padStart(2,'0')}/project`,color:'#4fc1ff',icon:'▤'}));
const chats=[];
for(let p=0;p<projects.length;p++)for(let j=0;j<2;j++){
  const n=p*2+j+1,id=`${String(n).padStart(8,'0')}-1111-4111-8111-${String(n).padStart(12,'0')}`;
  chats.push({id,title:`Chat ${String(n).padStart(2,'0')}`,projectId:projects[p].id,updated:Date.now()-n*60000,href:`/g/${projects[p].id}/c/${id}`});
}
const projectChats=Object.fromEntries(projects.map(p=>[p.id,chats.filter(c=>c.projectId===p.id)]));
const counts=Object.fromEntries(projects.map(p=>[p.id,2]));
const initialRows=projects.slice(0,8).map(p=>`<a data-ng8-pin="1" href="${p.href}" style="--ng-project:${p.color}"><i>${p.icon}</i><span>${p.name}</span><small>— [2]</small></a>`).join('');
const nativeProjects=projects.map(p=>`<div class="native-row" data-sidebar-item="true"><a href="${p.href}">${p.name}</a><button class="native-project-more" aria-label="Plus d’options">•••</button></div>`).join('');
const firstChat=chats[0];
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial}.sidebar{position:fixed;left:0;top:0;width:310px;height:100vh;overflow:auto;padding:8px;background:#101820;color:white}.brand{height:46px;padding:12px}.primary{display:block}.primary a,.primary button{display:flex;width:100%;height:38px;align-items:center;padding:0 10px;background:transparent;color:white;border:0;text-decoration:none}.ng8-pin-list>a{display:flex;min-height:36px;align-items:center;padding:6px;color:white;text-decoration:none}.native-projects{position:absolute;left:-9999px;top:0;width:300px}.native-row{display:grid;grid-template-columns:1fr 34px;min-height:36px}.native-menu{position:fixed;left:330px;top:120px;width:240px;padding:6px;background:#172431;color:white}.native-menu button{display:block;width:100%;height:32px}.main{margin-left:310px;padding:40px}.ng113-actions-staging,.ng113-actions-staging-leaf{display:block!important;visibility:visible!important}
</style></head><body>
<aside class="sidebar" data-testid="conversation-sidebar" id="sidebar">
  <div class="brand" id="brand">ChatGPT Plus</div>
  <section class="primary" id="primary"><button>Nouveau chat</button><a href="/library">Bibliothèque</a><button>Planification</button><button>Plugins</button><button>Plus</button></section>
  <section id="ng8-pins" data-ng8-signature="legacy-app-signature"><div class="ng8-pin-head"><span>PROJECTS</span><b>15</b></div><div class="ng8-pin-list">${initialRows}</div></section>
  <section class="native-projects" data-ng112-native-projects="1" id="native-projects">${nativeProjects}<div class="native-row" data-sidebar-item="true"><a href="${firstChat.href}">${firstChat.title}</a><button id="native-chat-more" aria-label="Plus d’options">•••</button></div></section>
</aside><main class="main"><textarea id="prompt-textarea"></textarea></main>
<script>
function closeMenus(){document.querySelectorAll('.native-menu').forEach(m=>m.remove());}
function toggleMenu(kind){const old=document.querySelector('.native-menu[data-kind="'+kind+'"]');if(old){old.remove();return;}closeMenus();const m=document.createElement('div');m.className='native-menu';m.dataset.kind=kind;m.setAttribute('role','menu');for(const label of ['Renommer','Déplacer','Supprimer']){const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=label;m.appendChild(b);}document.body.appendChild(m);}
document.querySelectorAll('.native-project-more').forEach(b=>b.addEventListener('click',()=>toggleMenu('project')));document.getElementById('native-chat-more').addEventListener('click',()=>toggleMenu('chat'));
</script></body></html>`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(({projects,chats,projectChats,counts})=>{
      const listeners=[];const store={'niakgpt-v08-cache':{schema:2,at:Date.now(),projects,chats,projectChats,counts,indexedProjectIds:projects.map(p=>p.id)},'niakgpt-governance-v085':{coreProjectIds:[],hiddenProjectIds:[]}};
      window.__store=store;window.__diag={};
      window.chrome={storage:{local:{get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}listeners.forEach(fn=>fn(changes,'local'));}},onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=v};
    },{projects,chats,projectChats,counts});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/g/${projects[0].id}/c/${firstChat.id}`,{waitUntil:'domcontentloaded'});
    for(const css of [foldersCss,nativeCss,sidebarCss])await page.addStyleTag({content:css});
    await page.addScriptTag({content:projectsJs});
    await page.addScriptTag({content:foldersJs});
    await page.addScriptTag({content:controllerJs});
    await page.addScriptTag({content:nativeJs});
    await page.waitForTimeout(700);

    let state=await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),list=box.querySelector('.ng8-pin-list');return{count:box.querySelectorAll('.ng8-pin-list>a[data-ng8-pin="1"],.ng8-pin-list .ng96-pin-entry>a[data-ng8-pin="1"]').length,prev:box.previousElementSibling?.id,placement:box.dataset.ng121Placement,scroll:list.scrollHeight>list.clientHeight,diag:window.__diag['sidebar-ux-119']||''};});
    assert(state.count===15&&state.prev==='primary'&&['native-projects','after-primary'].includes(state.placement),`all Projects not restored in stable slot: ${JSON.stringify(state)}`);
    assert(state.scroll,`15 Projects should remain accessible through a bounded scroll list: ${JSON.stringify(state)}`);

    for(let i=0;i<25;i++){
      await page.evaluate(()=>{const s=document.getElementById('sidebar'),b=document.getElementById('ng8-pins');s.insertBefore(b,s.firstElementChild);});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
      const prev=await page.evaluate(()=>document.getElementById('ng8-pins').previousElementSibling?.id||'');
      assert(prev==='primary',`Projects visibly escaped upward on hostile move ${i}: prev=${prev}`);
    }

    const project=page.locator('#ng8-pins a[data-ng8-pin="1"]').filter({hasText:'Project 01'}).first();
    const pathBefore=new URL(page.url()).pathname;
    await project.click();await page.waitForTimeout(220);
    assert(new URL(page.url()).pathname===pathBefore,'Project name navigated instead of opening its chats');
    const drawer=await page.evaluate(()=>({count:document.querySelectorAll('#ng8-pins .ng96-pin-drawer').length,chats:document.querySelectorAll('#ng8-pins .ng96-pin-drawer .ng96-chat-entry').length}));
    assert(drawer.count===1&&drawer.chats===2,`Project chats did not open: ${JSON.stringify(drawer)}`);

    const projectAction=page.locator('#ng8-pins .ng96-pin-entry').filter({hasText:'Project 01'}).locator('.ng113-native-actions-project').first();
    assert(await projectAction.count()===1,'Project native action button was not decorated');
    await projectAction.click();await page.waitForTimeout(600);
    state=await page.evaluate(()=>({menu:!!document.querySelector('.native-menu[data-kind="project"].ng113-native-menu-floating'),fallback:!!document.getElementById('ng113-actions-fallback')}));
    assert(state.menu&&!state.fallback,`Project action button did not open the native menu: ${JSON.stringify(state)}`);
    await projectAction.click();await page.waitForTimeout(250);assert(await page.locator('.native-menu[data-kind="project"]').count()===0,'Project native menu did not close on second click');

    const chatAction=page.locator('#ng8-pins .ng96-chat-entry').filter({hasText:firstChat.title}).locator('.ng113-native-actions-chat').first();
    assert(await chatAction.count()===1,'Chat action button was not decorated');
    await chatAction.click();await page.waitForTimeout(600);
    state=await page.evaluate(()=>({menu:!!document.querySelector('.native-menu[data-kind="chat"].ng113-native-menu-floating'),fallback:!!document.getElementById('ng113-actions-fallback')}));
    assert(state.menu&&!state.fallback,`Chat action button did not open the native menu: ${JSON.stringify(state)}`);

    console.log(`${engine} live sidebar state: PASS`);
  } finally { await browser.close(); }
}
console.log(`live-sidebar-state-v121: ${Object.keys(engines).join(',')} PASS`);
