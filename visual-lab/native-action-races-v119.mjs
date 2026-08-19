import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const actionJs=await fs.readFile(path.join(ROOT,'native-actions-v113.js'),'utf8');
const actionCss=await fs.readFile(path.join(ROOT,'native-actions-v113.css'),'utf8');
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const fixture=`<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial}.sidebar{position:fixed;left:0;top:0;bottom:0;width:310px;overflow:hidden;padding:10px}.native-row{display:grid;grid-template-columns:1fr 36px}.menu{position:absolute;width:230px;padding:8px;border:1px solid #444;background:#eee}.menu button{display:block}#native-project-menu{display:none;left:20px;top:120px}#ng8-pins{margin-top:180px}.ng96-pin-entry{display:grid;grid-template-columns:1fr 32px;gap:4px}
</style></head><body>
<aside class="sidebar" data-testid="conversation-sidebar"><div class="native-row" data-sidebar-item="true"><a href="/g/g-p-studio/project">Studio</a><button id="project-more" aria-label="Plus d’options" aria-haspopup="menu" aria-controls="native-project-menu">•••</button></div><section id="ng8-pins"><div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-studio/project">Studio</a></div></section></aside>
<main style="margin-left:310px"><div id="native-project-menu" class="menu" role="menu"><button role="menuitem">Renommer</button></div></main>
<script>window.__nativeClicks=0;document.getElementById('project-more').onclick=()=>{window.__nativeClicks++;const m=document.getElementById('native-project-menu');m.style.display=m.style.display==='block'?'none':'block'};<\/script>
</body></html>`;

async function makePage(browser){
  const page=await browser.newPage({viewport:{width:1280,height:820},colorScheme:'dark'});
  await page.addInitScript(()=>{const store={'niakgpt-v08-cache':{projects:[{id:'g-p-studio',name:'Studio'}],chats:[]}};window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.68'})},storage:{local:{get:async key=>({[key]:store[key]}),set:async obj=>Object.assign(store,obj)},onChanged:{addListener:()=>{}}}};window.__NIAKGPT_DIAGNOSTICS__={set:()=>{}};});
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:actionCss});await page.addScriptTag({content:actionJs});await page.waitForTimeout(100);
  return page;
}

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  try{
    {
      const page=await makePage(browser);const action=page.locator('.ng113-native-actions-project');await action.click({noWaitAfter:true});await page.waitForTimeout(20);
      await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.waitForTimeout(500);
      const s=await page.evaluate(()=>({clicks:window.__nativeClicks,display:getComputedStyle(document.getElementById('native-project-menu')).display,pop:document.getElementById('native-project-menu').matches(':popover-open'),busy:document.querySelector('.ng113-native-actions-project')?.getAttribute('aria-busy')||''}));
      assert(s.clicks===0&&s.display==='none'&&!s.pop&&!s.busy,`pagehide left a stale native action alive: ${JSON.stringify(s)}`);await page.close();
    }
    {
      const page=await makePage(browser);await page.locator('.ng113-native-actions-project').click({noWaitAfter:true});await page.waitForTimeout(20);
      await page.evaluate(()=>{const old=document.getElementById('ng8-pins'),next=old.cloneNode(true);old.replaceWith(next);document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));});await page.waitForTimeout(500);
      const s=await page.evaluate(()=>({clicks:window.__nativeClicks,busy:[...document.querySelectorAll('.ng113-native-actions')].map(b=>b.getAttribute('aria-busy')||''),display:getComputedStyle(document.getElementById('native-project-menu')).display}));
      assert(s.clicks===0&&s.busy.every(v=>!v)&&s.display==='none',`remount preserved a stale action/busy state: ${JSON.stringify(s)}`);await page.close();
    }
    {
      const page=await makePage(browser);await page.locator('.ng113-native-actions-project').click({noWaitAfter:true});await page.waitForTimeout(20);
      await page.evaluate(()=>{const old=document.getElementById('ng8-pins'),next=old.cloneNode(true);old.replaceWith(next);document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));});
      await page.locator('.ng113-native-actions-project').click({noWaitAfter:true});await page.waitForTimeout(500);
      const s=await page.evaluate(()=>{const own=document.getElementById('native-project-menu');return{clicks:window.__nativeClicks,busy:[...document.querySelectorAll('.ng113-native-actions')].map(b=>b.getAttribute('aria-busy')||''),display:getComputedStyle(own).display,pop:own.matches(':popover-open'),float:own.dataset.ng113Floated||''};});
      assert(s.clicks===1&&s.busy.every(v=>!v)&&s.display==='block'&&s.pop&&s.float==='1',`first click on remounted action was swallowed by stale in-flight action: ${JSON.stringify(s)}`);await page.close();
    }
    {
      const page=await makePage(browser);await page.locator('.ng113-native-actions-project').click({noWaitAfter:true});await page.waitForTimeout(115);
      await page.evaluate(()=>{const m=document.createElement('div');m.id='racer';m.className='menu';m.setAttribute('role','menu');m.style.cssText='display:block;left:800px;top:60px';m.innerHTML='<button role="menuitem">Concurrent</button>';document.querySelector('main').appendChild(m);});await page.waitForTimeout(500);
      const s=await page.evaluate(()=>{const own=document.getElementById('native-project-menu'),racer=document.getElementById('racer'),r=racer.getBoundingClientRect();return{clicks:window.__nativeClicks,ownPop:own.matches(':popover-open'),ownFloat:own.dataset.ng113Floated||'',racerPop:racer.matches(':popover-open'),racerFloat:racer.dataset.ng113Floated||'',racerLeft:r.left};});
      assert(s.clicks===1&&s.ownPop&&s.ownFloat==='1'&&!s.racerPop&&!s.racerFloat&&s.racerLeft>=790,`controlled action captured a concurrent menu: ${JSON.stringify(s)}`);await page.close();
    }
    {
      const page=await makePage(browser);await page.evaluate(()=>{const b=document.getElementById('project-more');b.removeAttribute('aria-label');b.removeAttribute('aria-haspopup');b.removeAttribute('aria-controls');b.textContent='Ouvrir';window.__unsafeClicks=0;b.onclick=()=>window.__unsafeClicks++;});
      await page.locator('.ng113-native-actions-project').click();await page.waitForTimeout(700);
      const s=await page.evaluate(()=>({unsafe:window.__unsafeClicks,display:getComputedStyle(document.getElementById('native-project-menu')).display,pop:document.getElementById('native-project-menu').matches(':popover-open')}));
      assert(s.unsafe===0&&s.display==='none'&&!s.pop,`unsafe native button fallback was clicked: ${JSON.stringify(s)}`);await page.close();
    }
    console.log(`${engine} native action lifecycle/remount/reclick/ownership/fail-safe races: PASS`);
  }finally{await browser.close();}
}
console.log(`native-action-races-v119: ${Object.keys(engines).join(',')} PASS`);
await import('./sidebar-authority-isolation-v119.mjs');
