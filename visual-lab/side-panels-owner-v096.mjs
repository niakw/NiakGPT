import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const sidePanels=await fs.readFile(path.join(ROOT,'side-panels-v096.js'),'utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

try{
  const html=`<!doctype html><html><body style="margin:0">
    <main id="main" style="height:800px">Conversation</main>
    <aside id="ng8-rail" style="position:fixed;right:0;top:0;width:52px;height:800px"></aside>
    <div id="panel" style="position:fixed;right:52px;top:40px;width:320px;height:520px;background:#111">
      <h2>Sources</h2><p>Evidence</p>
    </div>
  </body></html>`;
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:sidePanels});
  await page.waitForTimeout(180);

  let state=await page.evaluate(()=>({
    cls:document.getElementById('panel')?.classList.contains('ng96-native-sidepanel')||false,
    kind:document.getElementById('panel')?.dataset.ng96Sidepanel||'',
    active:document.documentElement.dataset.ng96NativePanel||'',
    rail:getComputedStyle(document.documentElement).getPropertyValue('--ng96-rail-offset').trim()
  }));
  assert(state.cls&&state.kind==='sources'&&state.active==='1',`single side-panel owner did not classify panel: ${JSON.stringify(state)}`);
  assert(state.rail==='52px',`side-panel owner did not publish live rail offset: ${JSON.stringify(state)}`);

  await page.evaluate(()=>document.getElementById('panel')?.remove());
  await page.waitForTimeout(160);
  state=await page.evaluate(()=>({active:document.documentElement.dataset.ng96NativePanel||''}));
  assert(state.active==='',`removed side panel stayed active: ${JSON.stringify(state)}`);

  await page.evaluate(()=>{
    const hide=new Event('pagehide');Object.defineProperty(hide,'persisted',{value:true});window.dispatchEvent(hide);
    const panel=document.createElement('div');panel.id='panel-bfcache';panel.style.cssText='position:fixed;right:52px;top:60px;width:320px;height:500px;background:#111';
    panel.innerHTML='<h2>Activity</h2><p>Timeline</p>';document.body.appendChild(panel);
  });
  await page.waitForTimeout(140);
  const suspended=await page.evaluate(()=>document.getElementById('panel-bfcache')?.classList.contains('ng96-native-sidepanel')||false);
  assert(!suspended,'side-panel observer mutated DOM while page was suspended');

  await page.evaluate(()=>{const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});window.dispatchEvent(show);});
  await page.waitForTimeout(180);
  state=await page.evaluate(()=>({
    cls:document.getElementById('panel-bfcache')?.classList.contains('ng96-native-sidepanel')||false,
    kind:document.getElementById('panel-bfcache')?.dataset.ng96Sidepanel||'',
    active:document.documentElement.dataset.ng96NativePanel||''
  }));
  assert(state.cls&&state.kind==='activity'&&state.active==='1',`BFCache pageshow did not restore side-panel observation: ${JSON.stringify(state)}`);

  console.log('side-panels-owner-v096: PASS');
}finally{
  await page.close();
  await browser.close();
}
