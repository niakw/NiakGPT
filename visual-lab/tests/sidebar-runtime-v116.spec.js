const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const extensionPath=path.resolve(__dirname,'..','..');
const labRoot=path.resolve(__dirname,'..');
const fixture=fs.readFileSync(path.join(labRoot,'runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const VERSION=manifest.version;
const EXECUTABLE=process.env.NIAKGPT_EXECUTABLE_PATH||undefined;
const BROWSER_LABEL=process.env.NIAKGPT_BROWSER_LABEL||'chromium';
const HEADLESS=process.env.NIAKGPT_HEADLESS!=='0';
const PROFILE_NAME=process.env.NIAKGPT_PROFILE||'runtime-cold-v116';
const PROFILE_PATH=path.join(labRoot,'profiles',`${PROFILE_NAME}.json`);
const CHAT1='11111111-1111-4111-8111-111111111111';
const CHAT2='22222222-2222-4222-8222-222222222222';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';
const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:name},instructions:''}}});
const chatRaw=(id,title,time,gizmo_id)=>({id,title,update_time:time,create_time:time,gizmo_id});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test.setTimeout(120000);

function loadProfile(){
  if(!fs.existsSync(PROFILE_PATH))throw new Error(`Unknown lab profile: ${PROFILE_PATH}`);
  const raw=JSON.parse(fs.readFileSync(PROFILE_PATH,'utf8')),now=Date.now();
  const expand=value=>{
    if(Array.isArray(value))return value.map(expand);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v)]));
    if(value==='__CURRENT_VERSION__')return VERSION;
    if(value==='__NOW__')return now;
    if(value==='__NOW_MINUS_1000__')return now-1000;
    return value;
  };
  return expand(raw);
}
const PROFILE=loadProfile();

async function extensionWorker(context){
  return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});
}

async function closeRuntime(context,dir){
  let settled=false;
  const closePromise=context.close().then(()=>{settled=true;}).catch(()=>{settled=true;});
  await Promise.race([closePromise,sleep(5000)]);
  if(!settled&&BROWSER_LABEL.includes('brave')&&process.platform==='darwin'){
    const pattern='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    for(const signal of ['-TERM','-KILL']){
      try{execFileSync('/usr/bin/pkill',[signal,'-f',pattern],{stdio:'ignore'});}catch{}
      await Promise.race([closePromise,sleep(1800)]);
      if(settled)break;
    }
  }
  if(!settled)await Promise.race([closePromise,sleep(1200)]);
  fs.rmSync(dir,{recursive:true,force:true});
}

async function launchRuntime(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`niakgpt-sidebar-v116-${BROWSER_LABEL}-${PROFILE_NAME}-`));
  const browserPrefs=PROFILE.browser||{};
  const launch={headless:HEADLESS,viewport:browserPrefs.viewport||{width:1440,height:900},colorScheme:browserPrefs.colorScheme||'dark',reducedMotion:browserPrefs.reducedMotion||'reduce',args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]};
  if(EXECUTABLE)launch.executablePath=EXECUTABLE;else launch.channel='chromium';
  const context=await chromium.launchPersistentContext(dir,launch);
  const worker=await extensionWorker(context);
  await worker.evaluate(async storage=>chrome.storage.local.set(storage),PROFILE.storageLocal||{});
  const chats=[chatRaw(CHAT1,'Runtime integration test',1786608000,P1),chatRaw(CHAT2,'Second conversation',1786521600,P1)];
  const traffic={documents:0,session:0,projects:0,projectChats:{},general:0,conversationGet:0,conversationPatch:0,other:[]};
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method().toUpperCase();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&/^\/c\/[0-9a-f-]+$/i.test(url.pathname)){traffic.documents++;return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});}
    if(url.pathname==='/api/auth/session'){traffic.session++;return json({accessToken:'runtime-sidebar-token'});}
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar'){traffic.projects++;return json({items:[projectRaw(P1,'Studio'),projectRaw(P2,'Research Lab')],cursor:null});}
    const pm=url.pathname.match(/^\/backend-api\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations$/);
    if(pm){traffic.projectChats[pm[1]]=(traffic.projectChats[pm[1]]||0)+1;return json({items:chats.filter(c=>c.gizmo_id===pm[1]),cursor:null});}
    if(url.pathname==='/backend-api/conversations'){traffic.general++;return json({items:chats,has_more:false,total:chats.length});}
    const cm=url.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);
    if(cm&&method==='PATCH'){traffic.conversationPatch++;return json({id:cm[1],gizmo_id:P1});}
    if(cm&&method==='GET'){traffic.conversationGet++;return json({id:cm[1],gizmo_id:P1,mapping:{}});}
    traffic.other.push(`${method} ${url.pathname}${url.search}`);if(traffic.other.length>30)traffic.other.shift();return route.fulfill({status:204,body:''});
  });
  const page=context.pages()[0]||await context.newPage();
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(`https://chatgpt.com/c/${CHAT1}`,{waitUntil:'commit'});if(!HEADLESS)await page.bringToFront();
  await expect(page.locator('#ng8-status')).toContainText(VERSION,{timeout:18000});
  await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(2,{timeout:18000});
  return {context,worker,page,pageErrors,consoleErrors,traffic,close:()=>closeRuntime(context,dir)};
}

const studioPin=page=>page.locator(`#ng8-pins a[data-ng8-pin="1"][href="/g/${P1}/project"]`);
const studioAction=page=>page.locator(`#ng8-pins .ng96-pin-entry[data-pid="${P1}"]>.ng113-native-actions-project`);
async function nativeProjectsVisible(page){return page.evaluate(()=>[...document.querySelectorAll('.project-list,a[href="/projects"],h3')].filter(el=>!el.closest('#ng8-pins')&&(/projects?/i.test(el.textContent||'')||el.matches('.project-list,a[href="/projects"]'))).filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}).map(el=>({tag:el.tagName,text:(el.textContent||'').trim(),cls:el.className})));}
async function drawerSnapshot(page){return page.evaluate(()=>{const drawer=document.querySelector('#ng8-pins .ng96-pin-drawer'),rows=[...document.querySelectorAll('#ng8-pins .ng96-folder-list>a[data-chat]')],actions=[...document.querySelectorAll('#ng8-pins .ng96-folder-list>.ng113-native-actions-chat')];return{pid:drawer?.dataset.pid||'',rows:rows.length,actions:actions.length,uniqueRows:new Set(rows.map(r=>r.dataset.chat)).size,chatIds:rows.map(r=>r.dataset.chat),rowsWithOneAction:rows.filter(r=>r.nextElementSibling?.matches('.ng113-native-actions-chat')).length,nestedActions:rows.filter(r=>r.querySelector('.ng113-native-actions-chat')).length,duplicateActions:actions.length-new Set(actions.map(a=>a.dataset.ng113Id)).size};});}
async function runtimeDiagnostics(rt){
  const dom=await rt.page.evaluate(()=>({visibility:document.visibilityState,hidden:document.hidden,root:{ng100CacheGuard:document.documentElement.dataset.ng100CacheGuard||'',ng90Safe:document.documentElement.dataset.ng90Safe||'',ng100Recovery:document.documentElement.dataset.ng100Recovery||'',ng8Running:document.documentElement.dataset.ng8Running||'',ng86Activity:document.documentElement.dataset.ng86Activity||'',ng105Verification:document.documentElement.dataset.ng105Verification||'',ng100RateLimitedUntil:document.documentElement.dataset.ng100RateLimitedUntil||'',ng8TabRole:document.documentElement.dataset.ng8TabRole||''},drawer:[...document.querySelectorAll('#ng8-pins .ng96-folder-list>a[data-chat]')].map(a=>({id:a.dataset.chat,title:a.textContent?.trim()}))}));
  const cache=await rt.worker.evaluate(async key=>(await chrome.storage.local.get(key))[key]||{},'niakgpt-v08-cache');
  return{traffic:rt.traffic,dom,cache:{serverIndexedAt:cache.serverIndexedAt||0,counts:cache.counts||{},indexedProjectIds:cache.indexedProjectIds||[],projects:(cache.projects||[]).map(p=>({id:p.id,name:p.name})),chats:(cache.chats||[]).map(c=>({id:c.id,title:c.title,projectId:c.projectId,updated:c.updated}))},snapshot:await drawerSnapshot(rt.page),pageErrors:rt.pageErrors,consoleErrors:rt.consoleErrors};
}
async function hitTargets(page){return page.evaluate(pid=>{
  const anchor=document.querySelector(`#ng8-pins .ng96-pin-entry[data-pid="${pid}"]>a[data-ng8-pin]`),action=document.querySelector(`#ng8-pins .ng96-pin-entry[data-pid="${pid}"]>.ng113-native-actions-project`),ar=anchor.getBoundingClientRect(),br=action.getBoundingClientRect();
  const target=(x,y)=>{const el=document.elementFromPoint(x,y);return{tag:el?.tagName||'',anchor:!!el?.closest?.('a[data-ng8-pin]'),action:!!el?.closest?.('.ng113-native-actions-project')};};
  return{anchor:{left:ar.left,right:ar.right,top:ar.top,bottom:ar.bottom,width:ar.width,height:ar.height},action:{left:br.left,right:br.right,top:br.top,bottom:br.bottom,width:br.width,height:br.height},left:target(ar.left+4,(ar.top+ar.bottom)/2),chevron:target(ar.right-7,(ar.top+ar.bottom)/2),button:target((br.left+br.right)/2,(br.top+br.bottom)/2)};
},P1);}
async function floatingMenuState(page){return page.evaluate(()=>{const sidebar=document.querySelector('[data-testid="conversation-sidebar"]'),menus=[...document.querySelectorAll('[role="menu"]')].filter(m=>getComputedStyle(m).display!=='none'),sr=sidebar.getBoundingClientRect();return{sidebarRight:sr.right,menus:menus.map(m=>{const r=m.getBoundingClientRect(),s=getComputedStyle(m);return{left:r.left,right:r.right,top:r.top,z:Number(s.zIndex)||0,floated:m.dataset.ng113Floated==='1',kind:m.dataset.kind||'',level:m.dataset.level||''};})};});}

test(`real extension left-sidebar UX (${BROWSER_LABEL}, ${PROFILE_NAME})`,async()=>{
  let rt;
  await test.step('boot exact browser + real MV3 extension + saved profile',async()=>{
    rt=await launchRuntime();const state=await rt.page.evaluate(()=>({hasBrave:!!navigator.brave,ua:navigator.userAgent,visibility:document.visibilityState,hidden:document.hidden}));console.log(`${BROWSER_LABEL}/${PROFILE_NAME} runtime: ${JSON.stringify(state)}`);
    if(BROWSER_LABEL.includes('brave')){expect(state.hasBrave).toBe(true);expect(HEADLESS).toBe(false);expect(state.visibility).toBe('visible');expect(state.hidden).toBe(false);expect(state.ua).not.toContain('HeadlessChrome');}
  });
  try{
    await test.step('native Projects hidden and obsolete open-page buttons absent',async()=>{await expect.poll(()=>nativeProjectsVisible(rt.page),{timeout:7000}).toEqual([]);await expect(rt.page.locator('#ng8-pins .ng96-project-open')).toHaveCount(0);});
    await test.step('Project row has two exclusive hitboxes: folder and actions',async()=>{
      await expect(studioPin(rt.page)).toHaveCount(1,{timeout:10000});await expect(studioAction(rt.page)).toHaveCount(1,{timeout:10000});
      const h=await hitTargets(rt.page);expect(h.anchor.height).toBeGreaterThanOrEqual(32);expect(h.action.width).toBeGreaterThanOrEqual(30);expect(h.anchor.right).toBeLessThanOrEqual(h.action.left);expect(h.left.anchor).toBe(true);expect(h.left.action).toBe(false);expect(h.chevron.anchor).toBe(true);expect(h.chevron.action).toBe(false);expect(h.button.action).toBe(true);expect(h.button.anchor).toBe(false);
      await studioPin(rt.page).click({position:{x:8,y:16}});await expect(rt.page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"]`)).toHaveCount(1,{timeout:5000});
      await studioPin(rt.page).click({position:{x:(await studioPin(rt.page).boundingBox()).width-8,y:16}});await expect(rt.page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"]`)).toHaveCount(0,{timeout:3000});
      await studioPin(rt.page).click();await expect(rt.page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"]`)).toHaveCount(1,{timeout:3000});
    });
    await test.step('cold index converges Studio to exact chats with sibling action hitboxes',async()=>{
      try{await expect.poll(async()=>{const s=await drawerSnapshot(rt.page);return{pid:s.pid,ids:[...s.chatIds].sort(),actions:s.actions,rowsWithOneAction:s.rowsWithOneAction,nested:s.nestedActions,dup:s.duplicateActions};},{timeout:18000}).toEqual({pid:P1,ids:[CHAT1,CHAT2].sort(),actions:2,rowsWithOneAction:2,nested:0,dup:0});}
      catch(error){const diag=await runtimeDiagnostics(rt);console.log(`RUNTIME_INDEX_DIAG ${JSON.stringify(diag)}`);throw new Error(`${error.message}\nRUNTIME_INDEX_DIAG=${JSON.stringify(diag)}`);}
      const geometry=await rt.page.evaluate(()=>[...document.querySelectorAll('#ng8-pins .ng96-folder-list>a[data-chat]')].map(a=>{const b=a.nextElementSibling,r=a.getBoundingClientRect(),q=b.getBoundingClientRect(),at=document.elementFromPoint(r.right-4,(r.top+r.bottom)/2),bt=document.elementFromPoint((q.left+q.right)/2,(q.top+q.bottom)/2);return{gap:q.left-r.right,anchorHit:!!at?.closest?.('a[data-chat]'),anchorButton:!!at?.closest?.('.ng113-native-actions-chat'),buttonHit:!!bt?.closest?.('.ng113-native-actions-chat'),buttonAnchor:!!bt?.closest?.('a[data-chat]')};}));
      for(const g of geometry){expect(g.gap).toBeGreaterThanOrEqual(0);expect(g.anchorHit).toBe(true);expect(g.anchorButton).toBe(false);expect(g.buttonHit).toBe(true);expect(g.buttonAnchor).toBe(false);}
    });
    await test.step('Project actions menu floats outside sidebar and never toggles folder',async()=>{
      const expanded=await studioPin(rt.page).getAttribute('aria-expanded');expect(expanded).toBe('true');await studioAction(rt.page).click();await expect(rt.page.locator('[role="menu"][data-kind="project"]')).toHaveCount(1,{timeout:3000});await expect.poll(async()=>{const s=await floatingMenuState(rt.page),m=s.menus.find(x=>x.kind==='project');return!!m&&m.floated&&m.left>=s.sidebarRight+4&&m.z>1000;},{timeout:3000}).toBe(true);expect(await studioPin(rt.page).getAttribute('aria-expanded')).toBe('true');
      await rt.page.locator('[role="menu"][data-kind="project"] [role="menuitem"]', {hasText:'Déplacer vers'}).click();await expect(rt.page.locator('[role="menu"][data-level="2"]')).toHaveCount(1,{timeout:2000});await expect.poll(async()=>{const s=await floatingMenuState(rt.page);return s.menus.filter(m=>m.floated&&m.left>=s.sidebarRight+4).length>=2;},{timeout:2500}).toBe(true);await rt.page.evaluate(()=>document.querySelectorAll('[role="menu"]').forEach(m=>m.remove()));
    });
    await test.step('Chat actions menu also floats outside sidebar',async()=>{
      const button=rt.page.locator(`#ng8-pins .ng96-folder-list>a[data-chat="${CHAT1}"] + .ng113-native-actions-chat`);await button.click();await expect(rt.page.locator('[role="menu"][data-kind="chat"]')).toHaveCount(1,{timeout:3000});await expect.poll(async()=>{const s=await floatingMenuState(rt.page),m=s.menus.find(x=>x.kind==='chat');return!!m&&m.floated&&m.left>=s.sidebarRight+4&&m.z>1000;},{timeout:3000}).toBe(true);await rt.page.evaluate(()=>document.querySelectorAll('[role="menu"]').forEach(m=>m.remove()));
    });
    await test.step('unrelated ChatGPT churn preserves drawer, focus and action nodes',async()=>{
      await rt.page.evaluate(()=>{window.__sidebarChurn={removedActions:0,removedDrawers:0};const pins=document.getElementById('ng8-pins'),action=pins.querySelector('.ng113-native-actions-chat');action.dataset.realRuntimeToken='keep';action.focus();window.__focusedAction=action;window.__sidebarObs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.removedNodes){if(!(n instanceof Element))continue;window.__sidebarChurn.removedActions+=n.matches('.ng113-native-actions-chat')?1:n.querySelectorAll?.('.ng113-native-actions-chat').length||0;window.__sidebarChurn.removedDrawers+=n.matches('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;}});window.__sidebarObs.observe(pins,{childList:true,subtree:true});const main=document.querySelector('main');for(let i=0;i<500;i++)main.className=`main native-state-${i%23}`;});
      await rt.page.waitForTimeout(500);const stable=await rt.page.evaluate(()=>({churn:window.__sidebarChurn,token:document.querySelector('#ng8-pins .ng113-native-actions-chat')?.dataset.realRuntimeToken||'',focus:document.activeElement===window.__focusedAction}));expect(stable).toEqual({churn:{removedActions:0,removedDrawers:0},token:'keep',focus:true});
    });
    await test.step('zero extension JS/console errors',async()=>{expect(rt.pageErrors).toEqual([]);expect(rt.consoleErrors).toEqual([]);await rt.page.evaluate(()=>window.__sidebarObs?.disconnect());});
  }finally{if(rt)await rt.close();}
});
