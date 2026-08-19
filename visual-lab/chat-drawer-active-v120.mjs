import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..'),code=await fs.readFile(path.join(ROOT,'project-chat-ux-v110.js'),'utf8');
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const ids=Array.from({length:14},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-4111-8111-${String(i+1).padStart(12,'0')}`),activeId=ids.at(-1);

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1000,height:700}}),page=await context.newPage();
  try{
    await page.addInitScript(()=>{window.chrome={storage:{local:{get:async()=>({'niakgpt-continuity-v100':{out:{}}})},onChanged:{addListener:()=>{}}}};});
    const rows=ids.map((id,i)=>`<div class="ng96-chat-entry" data-chat-entry="${id}"><a data-chat="${id}" href="/g/g-p-test/c/${id}"><span>Discussion ${i+1}</span></a></div>`).join('');
    const html=`<!doctype html><html><head><style>#ng8-pins{width:300px}.ng96-folder-list{height:150px;overflow:auto}.ng96-chat-entry{height:34px}.ng96-chat-entry>a{display:block;height:34px}</style></head><body><section id="ng8-pins"><div class="ng96-folder-list">${rows}</div></section></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto(`https://chatgpt.com/g/g-p-test/c/${activeId}`,{waitUntil:'domcontentloaded'});await page.addScriptTag({content:code});document;
    await page.waitForFunction(id=>document.querySelector(`a[data-chat="${id}"]`)?.getAttribute('aria-current')==='page',activeId,{timeout:2500});await page.waitForTimeout(120);
    const state=await page.evaluate(id=>{const link=document.querySelector(`a[data-chat="${id}"]`),list=link.closest('.ng96-folder-list'),lr=list.getBoundingClientRect(),rr=link.getBoundingClientRect();return{active:link.dataset.ng110Active,current:link.getAttribute('aria-current'),row:link.closest('.ng96-chat-entry')?.dataset.ng110Active,scrollTop:list.scrollTop,visible:rr.top>=lr.top-1&&rr.bottom<=lr.bottom+1,rows:list.querySelectorAll('.ng96-chat-entry').length};},activeId);
    assert(state.rows===14&&state.active==='1'&&state.current==='page'&&state.row==='1',`active state missing: ${JSON.stringify(state)}`);assert(state.scrollTop>0&&state.visible,`active chat not scrolled into view: ${JSON.stringify(state)}`);console.log(`${engine} active Project chat auto-scroll: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`chat-drawer-active-v120: ${Object.keys(engines).join(',')} PASS`);