import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/finalization-v113');
const authority=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.js'),'utf8');
const authorityCss=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const actions=await fs.readFile(path.join(ROOT,'native-actions-v113.js'),'utf8');
const actionsCss=await fs.readFile(path.join(ROOT,'native-actions-v113.css'),'utf8');
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1220,height:800},colorScheme:'dark'}),page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const store={'niakgpt-v08-cache':{projects:[{id:'g-p-niakgpt',name:'NiakGPT'},{id:'g-p-niakvio',name:'NiakVIO'},{id:'g-p-films',name:'Films'}],chats:[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Chat test',projectId:'g-p-niakgpt',updated:10}]}};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.63'})},storage:{local:{get:async key=>typeof key==='string'?{[key]:store[key]}:Object.fromEntries((key||[]).map(k=>[k,store[k]])),set:async obj=>Object.assign(store,obj)},onChanged:{addListener:()=>{}}}};
    });
    const html=`<!doctype html><html><body><nav data-testid="conversation-sidebar" style="width:340px;background:#071019;color:white;padding:8px">
      <section id="native-projects" class="unknown-native-bucket"><div>Projets</div>
        <div role="button" class="native-project">NiakGPT<button id="p-options" aria-label="Plus d’options"></button></div>
        <div role="button" class="native-project">NiakVIO</div><div role="button" class="native-project">Films</div>
      </section>
      <section id="ng8-pins"><div class="ng96-pin-entry" data-pid="g-p-niakgpt"><a data-ng8-pin="1" href="/g/g-p-niakgpt/project"><span>NiakGPT</span></a><button class="ng96-project-open">↗</button></div>
        <div class="ng96-pin-entry" data-pid="g-p-niakvio"><a data-ng8-pin="1" href="/g/g-p-niakvio/project"><span>NiakVIO</span></a><button class="ng96-project-open">↗</button></div>
        <div class="ng96-pin-entry" data-pid="g-p-films"><a data-ng8-pin="1" href="/g/g-p-films/project"><span>Films</span></a><button class="ng96-project-open">↗</button></div>
        <div class="ng96-folder-list"><a data-chat="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" href="/g/g-p-niakgpt/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"><span>Chat test</span><time>18/08</time></a></div>
      </section>
      <section id="recents"><div data-sidebar-item="true"><a href="/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Chat test</a><button id="c-options" aria-label="Plus d’options"></button></div></section>
    </nav><script>
      function menu(kind){document.querySelectorAll('[role=menu]').forEach(x=>x.remove());const m=document.createElement('div');m.setAttribute('role','menu');m.dataset.kind=kind;for(const t of kind==='project'?['Renommer','Modifier le projet','Supprimer']:['Renommer','Déplacer vers un projet','Archiver']){const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=t;m.appendChild(b);}document.body.appendChild(m);}
      document.getElementById('p-options').addEventListener('click',()=>menu('project'));document.getElementById('c-options').addEventListener('click',()=>menu('chat'));
    <\/script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:authorityCss});await page.addStyleTag({content:actionsCss});await page.addScriptTag({content:authority});await page.addScriptTag({content:actions});await page.waitForTimeout(420);
    const before=await page.evaluate(()=>({nativeDisplay:getComputedStyle(document.getElementById('native-projects')).display,projectButtons:document.querySelectorAll('.ng113-native-actions-project').length,chatButtons:document.querySelectorAll('.ng113-native-actions-chat').length,recents:getComputedStyle(document.getElementById('recents')).display}));
    assert(before.nativeDisplay==='none','native Projects block not hidden');assert(before.projectButtons===3&&before.chatButtons===1,'managed action buttons missing');assert(before.recents!=='none','Recents hidden');
    await page.locator('.ng113-native-actions-project').first().click();await page.waitForTimeout(250);let projectMenu=await page.evaluate(()=>({kind:document.querySelector('[role=menu]')?.dataset.kind||'',items:[...document.querySelectorAll('[role=menuitem]')].map(x=>x.textContent)}));
    assert(projectMenu.kind==='project'&&projectMenu.items.length>=3&&projectMenu.items.some(x=>/Modifier/i.test(x)),'full native Project menu not opened');
    await page.locator('.ng113-native-actions-chat').click();await page.waitForTimeout(250);let chatMenu=await page.evaluate(()=>({kind:document.querySelector('[role=menu]')?.dataset.kind||'',items:[...document.querySelectorAll('[role=menuitem]')].map(x=>x.textContent)}));
    assert(chatMenu.kind==='chat'&&chatMenu.items.some(x=>/Déplacer/i.test(x)),'native chat move action not reachable');
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'native-actions.png'),fullPage:true});await fs.writeFile(path.join(dir,'native-actions.html'),await page.content());await fs.writeFile(path.join(dir,'native-actions.json'),JSON.stringify({before,projectMenu,chatMenu},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-native-actions-v113: ${Object.keys(engines).join(',')} PASS`);
