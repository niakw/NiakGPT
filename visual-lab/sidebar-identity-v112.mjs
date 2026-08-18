import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const OUT=path.resolve('artifacts/finalization-v112');
const authority=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.js'),'utf8');
const authorityCss=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const rename=await fs.readFile(path.join(ROOT,'native-rename-v112.js'),'utf8');
const renameCss=await fs.readFile(path.join(ROOT,'native-rename-v112.css'),'utf8');
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const engines=requested?{[requested]:ALL[requested]}:ALL;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1220,height:800},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const store={'niakgpt-v08-cache':{projects:[{id:'g-p-niakgpt',name:'NiakGPT'},{id:'g-p-niakvio',name:'NiakVIO'},{id:'g-p-films',name:'Films'}],chats:[]}};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.62'})},storage:{local:{get:async key=>({[key]:store[key]}),set:async obj=>Object.assign(store,obj)},onChanged:{addListener:()=>{}}}};
    });
    const html=`<!doctype html><html><body class="ng8-ready"><nav data-testid="conversation-sidebar" style="width:320px;background:#071019;color:white;padding:8px">
      <section id="native-vnext" class="unknown-native-bucket" style="padding:8px;border:1px solid #596675">
        <div class="label-vnext">Projets</div>
        <div role="button" class="row-vnext">NiakGPT<button id="native-options" aria-label="Plus d’options"></button></div>
        <div role="button" class="row-vnext">NiakVIO</div>
        <div role="button" class="row-vnext">Films</div>
      </section>
      <section id="ng8-pins" style="display:block">
        <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-niakgpt/project"><span>NiakGPT</span></a></div>
        <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-niakvio/project"><span>NiakVIO</span></a></div>
        <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-films/project"><span>Films</span></a></div>
      </section>
      <section id="recents"><a href="/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Conversation récente</a></section>
    </nav><script>
      document.getElementById('native-options').addEventListener('click',()=>{const menu=document.createElement('div');menu.setAttribute('role','menu');const item=document.createElement('button');item.setAttribute('role','menuitem');item.textContent='Renommer';item.addEventListener('click',()=>document.documentElement.dataset.identityRename='1');menu.appendChild(item);document.body.appendChild(menu);});
    <\/script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:authorityCss});await page.addStyleTag({content:renameCss});
    await page.addScriptTag({content:authority});await page.addScriptTag({content:rename});
    await page.waitForTimeout(480);
    const before=await page.evaluate(()=>({
      nativeDisplay:getComputedStyle(document.getElementById('native-vnext')).display,
      nativeMarked:document.getElementById('native-vnext').classList.contains('ng112-native-projects-authoritative'),
      ownDisplay:getComputedStyle(document.getElementById('ng8-pins')).display,
      recentDisplay:getComputedStyle(document.getElementById('recents')).display,
      knownClass:document.getElementById('native-vnext').className.includes('sidebar-expando-section'),
      projectHrefCount:document.getElementById('native-vnext').querySelectorAll('a[href*="/g/g-p-"]').length
    }));
    assert(before.nativeMarked&&before.nativeDisplay==='none','identity-only native Project block was not suppressed');
    assert(before.ownDisplay!=='none'&&before.recentDisplay!=='none','identity fallback hid NiakGPT or Recents');
    assert(!before.knownClass&&before.projectHrefCount===0,'fixture accidentally exposes old structural Project signals');
    await page.locator('.ng112-native-rename-project').first().click();await page.waitForTimeout(420);
    const after=await page.evaluate(()=>({identityRename:document.documentElement.dataset.identityRename||'0',nativeDisplay:getComputedStyle(document.getElementById('native-vnext')).display}));
    assert(after.identityRename==='1','native rename was not reachable through identity-only hidden block');
    assert(after.nativeDisplay==='none','native block remained staged after rename');
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});
    const result={before,after};
    await page.screenshot({path:path.join(dir,'sidebar-identity-only.png'),fullPage:true});
    await fs.writeFile(path.join(dir,'sidebar-identity-only.html'),await page.content());
    await fs.writeFile(path.join(dir,'sidebar-identity-only.json'),JSON.stringify(result,null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-identity-v112: ${Object.keys(engines).join(',')} PASS`);
