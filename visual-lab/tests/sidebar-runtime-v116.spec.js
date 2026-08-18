const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.join(__dirname,'..','runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const VERSION=manifest.version;
const EXECUTABLE=process.env.NIAKGPT_EXECUTABLE_PATH||undefined;
const BROWSER_LABEL=process.env.NIAKGPT_BROWSER_LABEL||'chromium';
const HEADLESS=process.env.NIAKGPT_HEADLESS!=='0';
const CHAT1='11111111-1111-4111-8111-111111111111';
const CHAT2='22222222-2222-4222-8222-222222222222';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';
const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:name},instructions:''}}});
const chatRaw=(id,title,time,gizmo_id)=>({id,title,update_time:time,create_time:time,gizmo_id});

test.setTimeout(75000);

async function extensionWorker(context){
  return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});
}

async function launchRuntime(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`niakgpt-sidebar-v116-${BROWSER_LABEL}-`));
  const launch={headless:HEADLESS,viewport:{width:1440,height:900},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]};
  if(EXECUTABLE)launch.executablePath=EXECUTABLE;else launch.channel='chromium';
  const context=await chromium.launchPersistentContext(dir,launch);
  const worker=await extensionWorker(context);
  await worker.evaluate(async version=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}}),VERSION);
  const chats=[chatRaw(CHAT1,'Runtime integration test',1786608000,P1),chatRaw(CHAT2,'Second conversation',1786521600,P1)];
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method().toUpperCase();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&/^\/c\/[0-9a-f-]+$/i.test(url.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(url.pathname==='/api/auth/session')return json({accessToken:'runtime-sidebar-token'});
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[projectRaw(P1,'Studio'),projectRaw(P2,'Research Lab')],cursor:null});
    const pm=url.pathname.match(/^\/backend-api\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations$/);
    if(pm)return json({items:chats.filter(c=>c.gizmo_id===pm[1]),cursor:null});
    if(url.pathname==='/backend-api/conversations')return json({items:chats,has_more:false,total:chats.length});
    const cm=url.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);
    if(cm&&method==='PATCH')return json({id:cm[1],gizmo_id:P1});
    if(cm&&method==='GET')return json({id:cm[1],gizmo_id:P1,mapping:{}});
    return route.fulfill({status:204,body:''});
  });
  const page=context.pages()[0]||await context.newPage();
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(`https://chatgpt.com/c/${CHAT1}`,{waitUntil:'commit'});
  if(!HEADLESS)await page.bringToFront();
  await expect(page.locator('#ng8-status')).toContainText(VERSION,{timeout:18000});
  await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(2,{timeout:18000});
  return {context,page,pageErrors,consoleErrors,close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});}};
}

async function nativeProjectsVisible(page){return page.evaluate(()=>[...document.querySelectorAll('.project-list,a[href="/projects"],h3')].filter(el=>!el.closest('#ng8-pins')&&(/projects?/i.test(el.textContent||'')||el.matches('.project-list,a[href="/projects"]'))).filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}).map(el=>({tag:el.tagName,text:(el.textContent||'').trim(),cls:el.className})));}
async function drawerSnapshot(page){return page.evaluate(()=>{const rows=[...document.querySelectorAll('#ng8-pins .ng96-folder-list>a[data-chat]')],actions=[...document.querySelectorAll('#ng8-pins .ng113-native-actions-chat')];return{rows:rows.length,actions:actions.length,uniqueRows:new Set(rows.map(r=>r.dataset.chat)).size,rowsWithOneAction:rows.filter(r=>r.querySelectorAll(':scope>.ng113-native-actions-chat').length===1).length,duplicateActions:rows.filter(r=>r.querySelectorAll(':scope>.ng113-native-actions-chat').length>1).length};});}

test(`real extension (${BROWSER_LABEL}): Projects hidden, progressive actions complete, sidebar stable`,async()=>{
  let rt;
  await test.step('boot exact browser + real MV3 extension',async()=>{
    rt=await launchRuntime();
    const state=await rt.page.evaluate(()=>({hasBrave:!!navigator.brave,ua:navigator.userAgent,visibility:document.visibilityState,hidden:document.hidden}));
    console.log(`${BROWSER_LABEL} runtime: ${JSON.stringify(state)}`);
    if(BROWSER_LABEL.includes('brave')){expect(state.hasBrave,`Expected Brave runtime, got ${state.ua}`).toBe(true);expect(HEADLESS).toBe(false);expect(state.visibility).toBe('visible');expect(state.hidden).toBe(false);expect(state.ua).not.toContain('HeadlessChrome');}
  });
  try{
    await test.step('native Projects hidden, recents untouched',async()=>{await expect.poll(()=>nativeProjectsVisible(rt.page),{timeout:7000}).toEqual([]);});
    await test.step('human opens pin; every visible chat gets exactly one action',async()=>{
      await rt.page.locator('#ng8-pins a[data-ng8-pin="1"]').first().click();await expect(rt.page.locator('#ng8-pins .ng96-pin-drawer')).toHaveCount(1,{timeout:5000});
      await expect.poll(async()=>{const s=await drawerSnapshot(rt.page);return s.rows>0&&s.actions===s.rows&&s.rowsWithOneAction===s.rows&&s.duplicateActions===0;},{timeout:5000}).toBe(true);
    });
    await test.step('progressive backend index converges to all chats + actions',async()=>{await expect.poll(()=>drawerSnapshot(rt.page),{timeout:15000}).toEqual({rows:2,actions:2,uniqueRows:2,rowsWithOneAction:2,duplicateActions:0});});
    await test.step('unrelated ChatGPT DOM/class churn does not rebuild drawer or blink actions',async()=>{
      await rt.page.evaluate(()=>{window.__sidebarChurn={removedActions:0,removedDrawers:0};const pins=document.getElementById('ng8-pins'),action=pins.querySelector('.ng113-native-actions-chat');action.dataset.realRuntimeToken='keep';action.focus();window.__focusedAction=action;window.__sidebarObs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.removedNodes){if(!(n instanceof Element))continue;window.__sidebarChurn.removedActions+=n.matches('.ng113-native-actions-chat')?1:n.querySelectorAll?.('.ng113-native-actions-chat').length||0;window.__sidebarChurn.removedDrawers+=n.matches('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;}});window.__sidebarObs.observe(pins,{childList:true,subtree:true});const main=document.querySelector('main');for(let i=0;i<500;i++)main.className=`main native-state-${i%23}`;const content=document.getElementById('lab-content');for(let i=0;i<80;i++){const d=document.createElement('div');d.textContent=`stream-${i}`;content.insertBefore(d,content.querySelector('.composer'));if(i%2===0)d.remove();}});
      await rt.page.waitForTimeout(500);const stable=await rt.page.evaluate(()=>({churn:window.__sidebarChurn,token:document.querySelector('#ng8-pins .ng113-native-actions-chat')?.dataset.realRuntimeToken||'',focus:document.activeElement===window.__focusedAction}));expect(stable).toEqual({churn:{removedActions:0,removedDrawers:0},token:'keep',focus:true});expect(await drawerSnapshot(rt.page)).toEqual({rows:2,actions:2,uniqueRows:2,rowsWithOneAction:2,duplicateActions:0});
    });
    await test.step('React-like text-only Projects remount is hidden again',async()=>{
      await rt.page.evaluate(()=>{const nav=document.querySelector('aside[data-testid="conversation-sidebar"] nav');nav.querySelector('.project-list')?.remove();[...nav.querySelectorAll('h3')].find(x=>/projects?/i.test(x.textContent||''))?.remove();const h=document.createElement('div');h.textContent='Projets';h.id='runtime-remount-title';const list=document.createElement('div');list.id='runtime-remount-projects';list.innerHTML='<button role="button">Studio</button><button role="button">Research Lab</button>';nav.insertBefore(h,nav.querySelector('.recent-list'));nav.insertBefore(list,nav.querySelector('.recent-list'));});
      await expect.poll(async()=>rt.page.evaluate(()=>['runtime-remount-title','runtime-remount-projects'].every(id=>{const el=document.getElementById(id),s=getComputedStyle(el);return s.display==='none'||s.visibility==='hidden'||!!el.closest('[data-ng112-native-projects="1"]');})),{timeout:5000}).toBe(true);await expect.poll(()=>nativeProjectsVisible(rt.page),{timeout:5000}).toEqual([]);
    });
    await test.step('zero extension JS/console errors',async()=>{expect(rt.pageErrors).toEqual([]);expect(rt.consoleErrors).toEqual([]);await rt.page.evaluate(()=>window.__sidebarObs?.disconnect());});
  }finally{if(rt)await rt.close();}
});
