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

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const P='g-p-studio';
      const store={'niakgpt-v08-cache':{projects:[{id:P,name:'Studio',href:`/g/${P}/project`}],chats:[]}};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.68'})},storage:{local:{get:async key=>typeof key==='string'?{[key]:store[key]}:{...store},set:async obj=>Object.assign(store,obj)},onChanged:{addListener:()=>{}}}};
    });
    const html=`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#080e14;color:#dce7f1;font-family:Arial}.sidebar{position:fixed;left:0;top:0;bottom:0;width:310px;overflow:hidden;padding:10px;background:#101820}.native-row{display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:4px}.native-row a,.native-row button{min-height:34px}.menu{position:absolute;width:230px;padding:8px;border:1px solid #405267;background:#17212b}.menu button{display:block;width:100%;min-height:34px}#unrelated-menu{left:760px;top:60px}#native-action-menu{left:18px;top:120px;display:none}#ng8-pins{margin-top:180px}.ng96-pin-entry{display:grid;grid-template-columns:minmax(0,1fr) 32px;gap:4px}.ng96-pin-entry>a{min-height:34px;padding:7px;background:#0c151e;color:#dce7f1;text-decoration:none}</style></head><body><aside class="sidebar" data-testid="conversation-sidebar"><div class="native-row" data-sidebar-item="true"><a href="/g/g-p-studio/project">Studio</a><button id="native-project-more" aria-label="Plus d’options">•••</button></div><section id="ng8-pins"><div class="ng96-pin-entry" data-pid="g-p-studio"><a data-ng8-pin="1" href="/g/g-p-studio/project">Studio</a></div></section></aside><main style="margin-left:310px;padding:30px"><div id="unrelated-menu" class="menu" role="menu"><button role="menuitem">Compte</button></div><div id="native-action-menu" class="menu" role="menu"><button role="menuitem">Renommer</button><button role="menuitem">Supprimer</button></div></main><script>const actionMenu=document.getElementById('native-action-menu');document.getElementById('native-project-more').onclick=()=>{actionMenu.style.display='block'};<\/script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:actionCss});
    await page.addScriptTag({content:actionJs});
    await page.waitForTimeout(300);

    const action=page.locator('#ng8-pins .ng113-native-actions-project');
    assert(await action.count()===1,'NiakGPT project action was not decorated');
    const unrelatedBefore=await page.evaluate(()=>{const e=document.getElementById('unrelated-menu'),r=e.getBoundingClientRect();return{left:r.left,top:r.top};});

    await action.click();
    await page.waitForFunction(()=>document.getElementById('native-action-menu')?.matches?.(':popover-open'));
    const opened=await page.evaluate(()=>{
      const own=document.getElementById('native-action-menu'),other=document.getElementById('unrelated-menu');
      const r=own.getBoundingClientRect(),o=other.getBoundingClientRect();
      return{
        ownFloated:own.dataset.ng113Floated==='1',ownTop:own.dataset.ng113TopLayer==='1',ownPopover:own.matches(':popover-open'),ownLeft:r.left,
        otherFloated:other.dataset.ng113Floated==='1',otherTop:other.dataset.ng113TopLayer==='1',otherPopover:other.matches(':popover-open'),otherLeft:o.left,otherTopPx:o.top,
      };
    });
    assert(opened.ownFloated&&opened.ownTop&&opened.ownPopover&&opened.ownLeft>=314,`owned menu did not float: ${JSON.stringify(opened)}`);
    assert(!opened.otherFloated&&!opened.otherTop&&!opened.otherPopover,`unrelated visible menu was captured: ${JSON.stringify(opened)}`);
    assert(Math.abs(opened.otherLeft-unrelatedBefore.left)<1&&Math.abs(opened.otherTopPx-unrelatedBefore.top)<1,'unrelated menu geometry changed');

    await page.evaluate(()=>{document.getElementById('native-action-menu').style.display='none';document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    await page.waitForTimeout(1150);
    const cleaned=await page.evaluate(()=>{
      const own=document.getElementById('native-action-menu'),other=document.getElementById('unrelated-menu');
      return{
        cls:own.classList.contains('ng113-native-menu-floating'),leftVar:own.style.getPropertyValue('--ng113-menu-left'),topVar:own.style.getPropertyValue('--ng113-menu-top'),floated:own.dataset.ng113Floated||'',topLayer:own.dataset.ng113TopLayer||'',floatIndex:own.dataset.ng113FloatIndex||'',ownedPopover:own.dataset.ng113PopoverOwned||'',popoverAttr:own.hasAttribute('popover'),otherFloated:other.classList.contains('ng113-native-menu-floating'),
      };
    });
    assert(!cleaned.cls&&!cleaned.leftVar&&!cleaned.topVar&&!cleaned.floated&&!cleaned.topLayer&&!cleaned.floatIndex&&!cleaned.ownedPopover&&!cleaned.popoverAttr,`native menu cleanup incomplete: ${JSON.stringify(cleaned)}`);
    assert(!cleaned.otherFloated,'unrelated menu was mutated during cleanup');

    await page.evaluate(()=>{document.getElementById('native-action-menu').style.display='block';});
    await page.waitForTimeout(120);
    const reusedNative=await page.evaluate(()=>{const e=document.getElementById('native-action-menu'),r=e.getBoundingClientRect();return{left:r.left,top:r.top,floated:e.classList.contains('ng113-native-menu-floating'),popover:e.hasAttribute('popover')};});
    assert(!reusedNative.floated&&!reusedNative.popover&&reusedNative.left<310,`React/native reuse inherited NiakGPT geometry: ${JSON.stringify(reusedNative)}`);

    await page.evaluate(()=>{document.getElementById('native-action-menu').style.display='none';});
    await action.click();
    await page.waitForFunction(()=>document.getElementById('native-action-menu')?.matches?.(':popover-open'));
    const reopened=await page.evaluate(()=>{const e=document.getElementById('native-action-menu'),r=e.getBoundingClientRect();return{floated:e.dataset.ng113Floated==='1',topLayer:e.dataset.ng113TopLayer==='1',left:r.left};});
    assert(reopened.floated&&reopened.topLayer&&reopened.left>=314,`reused native menu did not promote cleanly a second time: ${JSON.stringify(reopened)}`);

    // Fallback session must die at the exact close, not 900 ms later. Otherwise a
    // completely unrelated menu appearing just after dismissal can be captured by a
    // delayed queueMenuFloat timer.
    await page.evaluate(()=>{document.getElementById('native-action-menu').style.display='none';});
    await page.waitForTimeout(1050);
    await page.evaluate(()=>{
      const id='33333333-3333-4333-8333-333333333333';
      const list=document.createElement('div');list.className='ng96-folder-list';
      const entry=document.createElement('div');entry.className='ng96-chat-entry';
      const a=document.createElement('a');a.dataset.chat=id;a.href=`/g/g-p-studio/c/${id}`;a.textContent='Fallback chat';
      entry.appendChild(a);list.appendChild(entry);document.getElementById('ng8-pins').appendChild(list);
    });
    const fallbackAction=page.locator('#ng8-pins .ng113-native-actions-chat');
    await fallbackAction.waitFor({state:'visible'});await fallbackAction.click();
    await page.waitForFunction(()=>document.getElementById('ng113-actions-fallback')?.matches?.(':popover-open'));
    await page.mouse.click(1100,700);
    await page.waitForFunction(()=>!document.getElementById('ng113-actions-fallback'));
    await page.evaluate(()=>{
      const m=document.createElement('div');m.id='post-fallback-menu';m.className='menu';m.setAttribute('role','menu');m.style.cssText='left:840px;top:420px';m.innerHTML='<button role="menuitem">Unrelated later menu</button>';document.querySelector('main').appendChild(m);
    });
    await page.waitForTimeout(220);
    const afterFallback=await page.evaluate(()=>{const m=document.getElementById('post-fallback-menu'),r=m.getBoundingClientRect();return{floated:m.dataset.ng113Floated==='1',topLayer:m.dataset.ng113TopLayer==='1',popover:m.matches?.(':popover-open')||false,left:r.left,top:r.top};});
    assert(!afterFallback.floated&&!afterFallback.topLayer&&!afterFallback.popover&&afterFallback.left>=830,`closed fallback session captured a later unrelated menu: ${JSON.stringify(afterFallback)}`);

    console.log(`${engine} native menu session isolation/cleanup/reuse/fallback-close: PASS`);
  }finally{
    await context.close();
    await browser.close();
  }
}
console.log(`native-menu-session-v118: ${Object.keys(engines).join(',')} PASS`);
