import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const live106=await fs.readFile(path.join(ROOT,'live-fixes-v106.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

try{
  await page.addInitScript(()=>{
    window.__ng106LegacySweeps=0;
    const native=Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll=function(selector){
      if(String(selector).includes('ng8-native-projects-suppressed'))window.__ng106LegacySweeps++;
      return native.call(this,selector);
    };
  });
  const html=`<!doctype html><html><body>
    <nav data-testid="conversation-sidebar"></nav>
    <div id="ng100-breadcrumb"><a class="ng100-bc-project" href="/g/g-p-alpha/project">Alpha Project</a></div>
    <div id="ng8-status"><span class="ng8-status-project">Hors projet</span></div>
    <main id="main"><article>Conversation</article></main>
  </body></html>`;
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:live106});
  await page.waitForTimeout(2600);
  assert(await page.locator('#ng8-status .ng8-status-project').textContent()==='Alpha Project','initial Project context did not synchronize');

  await page.evaluate(()=>{window.__ng106LegacySweeps=0;});
  for(let i=0;i<12;i++){
    await page.evaluate(i=>{
      const node=document.createElement('div');
      node.className='unrelated-stream-fragment';
      node.textContent='assistant stream '+i;
      document.getElementById('main').appendChild(node);
    },i);
    await page.waitForTimeout(55);
  }
  await page.waitForTimeout(120);
  const unrelatedSweeps=await page.evaluate(()=>window.__ng106LegacySweeps);
  assert(unrelatedSweeps===0,`live-fixes-v106 woke on unrelated conversation DOM churn: ${unrelatedSweeps} full legacy sweep(s)`);

  await page.evaluate(()=>{
    window.__ng106LegacySweeps=0;
    const old=document.getElementById('ng100-breadcrumb');
    const next=old.cloneNode(false);
    next.innerHTML='<a class="ng100-bc-project" href="/g/g-p-beta/project">Beta Project</a>';
    old.replaceWith(next);
  });
  await page.waitForTimeout(150);
  const remount=await page.evaluate(()=>({
    status:document.querySelector('#ng8-status .ng8-status-project')?.textContent||'',
    sweeps:window.__ng106LegacySweeps
  }));
  assert(remount.status==='Beta Project',`breadcrumb remount no longer rebinds Project context: ${JSON.stringify(remount)}`);
  assert(remount.sweeps<=2,`breadcrumb remount caused excessive global legacy sweeps: ${JSON.stringify(remount)}`);

  console.log(`live-fixes-context-v106: PASS unrelatedSweeps=${unrelatedSweeps} remountSweeps=${remount.sweeps}`);
}finally{
  await page.close();
  await browser.close();
}
