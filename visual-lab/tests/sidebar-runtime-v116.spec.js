const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.join(__dirname,'..','runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const VERSION=manifest.version;
const CHAT1='11111111-1111-4111-8111-111111111111';
const CHAT2='22222222-2222-4222-8222-222222222222';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';
const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:name},instructions:''}}});
const chatRaw=(id,title,time,gizmo_id)=>({id,title,update_time:time,create_time:time,gizmo_id});

async function extensionWorker(context){
  return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:12000});
}

async function launchRuntime(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-sidebar-v116-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1440,height:900},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
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
  await expect(page.locator('#ng8-status')).toContainText(VERSION,{timeout:16000});
  await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(2,{timeout:16000});
  return {context,page,pageErrors,consoleErrors,close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});}};
}

async function nativeProjectsVisible(page){
  return page.evaluate(()=>{
    const own='#ng8-pins';
    const candidates=[...document.querySelectorAll('.project-list,a[href="/projects"],h3')].filter(el=>!el.closest(own)&&(/projects?/i.test(el.textContent||'')||el.matches('.project-list,a[href="/projects"]')));
    return candidates.filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}).map(el=>({tag:el.tagName,text:(el.textContent||'').trim(),cls:el.className}));
  });
}

test('real extension: native Projects stay hidden and pin actions stay stable under React-like churn',async()=>{
  const rt=await launchRuntime();
  try{
    await expect.poll(()=>nativeProjectsVisible(rt.page),{timeout:6000}).toEqual([]);
    const firstPin=rt.page.locator('#ng8-pins a[data-ng8-pin="1"]').first();
    await firstPin.click();
    await expect(rt.page.locator('#ng8-pins .ng96-pin-drawer')).toHaveCount(1,{timeout:4000});
    await expect(rt.page.locator('#ng8-pins .ng113-native-actions-chat')).toHaveCount(2,{timeout:4000});

    await rt.page.evaluate(()=>{
      window.__sidebarChurn={removedActions:0,removedDrawers:0};
      const pins=document.getElementById('ng8-pins');
      const action=pins.querySelector('.ng113-native-actions-chat');action.dataset.realRuntimeToken='keep';action.focus();window.__focusedAction=action;
      window.__sidebarObs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.removedNodes){if(!(n instanceof Element))continue;window.__sidebarChurn.removedActions+=n.matches('.ng113-native-actions-chat')?1:n.querySelectorAll?.('.ng113-native-actions-chat').length||0;window.__sidebarChurn.removedDrawers+=n.matches('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;}});
      window.__sidebarObs.observe(pins,{childList:true,subtree:true});
      const main=document.querySelector('main');for(let i=0;i<500;i++)main.className=`main native-state-${i%23}`;
      const content=document.getElementById('lab-content');for(let i=0;i<80;i++){const d=document.createElement('div');d.textContent=`stream-${i}`;content.insertBefore(d,content.querySelector('.composer'));if(i%2===0)d.remove();}
    });
    await rt.page.waitForTimeout(500);
    const stable=await rt.page.evaluate(()=>({churn:window.__sidebarChurn,token:document.querySelector('#ng8-pins .ng113-native-actions-chat')?.dataset.realRuntimeToken||'',focus:document.activeElement===window.__focusedAction}));
    expect(stable).toEqual({churn:{removedActions:0,removedDrawers:0},token:'keep',focus:true});

    await rt.page.evaluate(()=>{
      const nav=document.querySelector('aside[data-testid="conversation-sidebar"] nav');
      const old=nav.querySelector('.project-list');old?.remove();
      const heading=[...nav.querySelectorAll('h3')].find(x=>/projects?/i.test(x.textContent||''));heading?.remove();
      const h=document.createElement('div');h.textContent='Projets';h.id='runtime-remount-title';
      const list=document.createElement('div');list.id='runtime-remount-projects';list.innerHTML='<button role="button">Studio</button><button role="button">Research Lab</button>';
      nav.insertBefore(h,nav.querySelector('.recent-list'));nav.insertBefore(list,nav.querySelector('.recent-list'));
    });
    await expect.poll(async()=>rt.page.evaluate(()=>['runtime-remount-title','runtime-remount-projects'].every(id=>{const el=document.getElementById(id),s=getComputedStyle(el);return s.display==='none'||s.visibility==='hidden'||!!el.closest('[data-ng112-native-projects="1"]');})),{timeout:4000}).toBe(true);
    await expect.poll(()=>nativeProjectsVisible(rt.page),{timeout:4000}).toEqual([]);
    expect(rt.pageErrors).toEqual([]);
    expect(rt.consoleErrors).toEqual([]);
    await rt.page.evaluate(()=>window.__sidebarObs?.disconnect());
  }finally{await rt.close();}
});
