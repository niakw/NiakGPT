const { test, expect, chromium } = require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const extensionPath=path.resolve(__dirname,'..','..');
const labRoot=path.resolve(__dirname,'..');
const fixture=fs.readFileSync(path.join(labRoot,'runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const EXECUTABLE=process.env.NIAKGPT_EXECUTABLE_PATH||undefined;
const BROWSER_LABEL=process.env.NIAKGPT_BROWSER_LABEL||'chromium';
const HEADLESS=process.env.NIAKGPT_HEADLESS!=='0';
const PROFILE_NAME=process.env.NIAKGPT_PROFILE||'runtime-cold-v116';
const PROFILE_PATH=path.join(labRoot,'profiles',`${PROFILE_NAME}.json`);
const P1='g-p-aaaaaaaaaaaaaaaa',P2='g-p-bbbbbbbbbbbbbbbb';
const CHAT1='11111111-1111-4111-8111-111111111111';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const projectId=i=>i===0?P1:i===1?P2:`g-p-${i.toString(36).padStart(16,'0')}`;
const chatId=i=>i===0?CHAT1:`${(i+1).toString(16).padStart(8,'0')}-0000-4000-8000-${(i+1).toString(16).padStart(12,'0')}`;
const EXPECTED_STUDIO_IDS=Array.from({length:72},(_,i)=>chatId(i));
const projectRaw=p=>({gizmo:{gizmo:{id:p.id,display:{name:p.name,description:`Description ${p.name}`},instructions:''}}});
const chatRaw=c=>({id:c.id,title:c.title,update_time:c.updated/1000,create_time:c.updated/1000,gizmo_id:c.projectId});

test.setTimeout(240000);
function loadProfile(){
  const raw=JSON.parse(fs.readFileSync(PROFILE_PATH,'utf8')),now=Date.now();
  const expand=v=>Array.isArray(v)?v.map(expand):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,expand(x)])):v==='__CURRENT_VERSION__'?manifest.version:v==='__NOW__'?now:v==='__NOW_MINUS_1000__'?now-1000:v;
  return expand(raw);
}
const PROFILE=loadProfile();
async function extensionWorker(context){return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});}
async function closeRuntime(context,dir){
  const braveMac=BROWSER_LABEL.includes('brave')&&process.platform==='darwin';
  if(braveMac){for(const signal of ['-TERM','-KILL']){for(const pattern of [dir,'Brave Browser Helper'])try{execFileSync('/usr/bin/pkill',[signal,'-f',pattern],{stdio:'ignore'});}catch{}await sleep(signal==='-TERM'?420:180);}}else await context.close().catch(()=>{});
  fs.rmSync(dir,{recursive:true,force:true});
}
function makeServer(){
  const projects=Array.from({length:30},(_,i)=>({id:projectId(i),name:i===0?'Studio':i===1?'Research Lab':`Project UX ${String(i+1).padStart(2,'0')}`}));
  const chats=[];const base=Date.now()-3600000;
  for(let i=0;i<72;i++)chats.push({id:chatId(i),title:i===0?'Runtime integration test':`Studio conversation ${String(i+1).padStart(2,'0')}`,projectId:P1,updated:base-i*60000});
  for(let i=72;i<88;i++)chats.push({id:chatId(i),title:`Research conversation ${String(i-71).padStart(2,'0')}`,projectId:P2,updated:base-i*60000});
  return{projects,chats};
}
async function launchRuntime(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`niakgpt-human-v123-${BROWSER_LABEL}-`)),prefs=PROFILE.browser||{},launch={headless:HEADLESS,viewport:prefs.viewport||{width:1440,height:900},colorScheme:prefs.colorScheme||'dark',reducedMotion:prefs.reducedMotion||'reduce',args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`,'--disable-background-mode','--no-first-run','--no-default-browser-check']};
  if(EXECUTABLE)launch.executablePath=EXECUTABLE;else launch.channel='chromium';
  const context=await chromium.launchPersistentContext(dir,launch),worker=await extensionWorker(context);await worker.evaluate(async s=>chrome.storage.local.set(s),PROFILE.storageLocal||{});
  const server=makeServer(),traffic={documents:0,session:0,projects:0,projectChats:{},general:0,patches:[],posts:0,projectRenames:0,other:[]};
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method().toUpperCase(),json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'){traffic.documents++;return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});}
    if(url.pathname==='/api/auth/session'){traffic.session++;return json({accessToken:'human-ux-token'});}
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar'){traffic.projects++;return json({items:server.projects.map(projectRaw),cursor:null});}
    const pm=url.pathname.match(/^\/backend-api\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations$/);if(pm){const p=pm[1],all=server.chats.filter(c=>c.projectId===p),start=Number(url.searchParams.get('cursor')||0)||0,items=all.slice(start,start+20),next=start+items.length<all.length?String(start+items.length):null;traffic.projectChats[p]=(traffic.projectChats[p]||0)+1;return json({items:items.map(chatRaw),cursor:next});}
    if(url.pathname==='/backend-api/conversations'){const offset=Number(url.searchParams.get('offset')||0)||0,limit=Number(url.searchParams.get('limit')||100)||100,items=server.chats.slice(offset,offset+limit);traffic.general++;return json({items:items.map(chatRaw),has_more:offset+items.length<server.chats.length,total:server.chats.length});}
    const cm=url.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);if(cm&&method==='PATCH'){
      let body={};try{body=req.postDataJSON()||{};}catch{}const c=server.chats.find(x=>x.id===cm[1]);if(c){if(Object.prototype.hasOwnProperty.call(body,'title'))c.title=String(body.title);if(Object.prototype.hasOwnProperty.call(body,'gizmo_id'))c.projectId=body.gizmo_id||'';c.updated=Date.now();}traffic.patches.push({id:cm[1],body});return json({id:cm[1],title:c?.title||'',gizmo_id:c?.projectId||''});
    }
    if(cm&&method==='GET'){const c=server.chats.find(x=>x.id===cm[1]);return json({id:cm[1],title:c?.title||'',gizmo_id:c?.projectId||'',mapping:{}});}
    if(url.pathname==='/backend-api/conversation'&&method==='POST'){traffic.posts++;return json({conversation_id:CHAT1});}
    if(url.pathname==='/lab/project-rename'&&method==='POST'){let body={};try{body=req.postDataJSON()||{};}catch{}const p=server.projects.find(x=>x.id===body.id);if(p&&body.name)p.name=String(body.name);traffic.projectRenames++;return json({ok:!!p,id:p?.id,name:p?.name});}
    traffic.other.push(`${method} ${url.pathname}`);if(traffic.other.length>40)traffic.other.shift();return route.fulfill({status:204,body:''});
  });
  const page=context.pages()[0]||await context.newPage(),pageErrors=[],consoleErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const goto=async pathname=>{await page.goto(`https://chatgpt.com${pathname}`,{waitUntil:'commit'});if(!HEADLESS)await page.bringToFront();await expect(page.locator('#ng8-status')).toContainText(manifest.version,{timeout:20000});await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(server.projects.length,{timeout:20000});};
  await goto(`/c/${CHAT1}`);
  // Extend the fixture's native Project Rename command into a real modal. The user-visible
  // NiakGPT menu remains custom; this only lets the exact native Project mutation path be certified.
  await page.evaluate(({P1})=>{
    document.addEventListener('click',event=>{
      const item=event.target instanceof Element?event.target.closest('.lab-inline-menu[data-kind="project"] [role="menuitem"]'):null;if(!item||!/^(renommer|rename)$/i.test((item.textContent||'').trim()))return;
      document.querySelector('#lab-project-rename-dialog')?.remove();const d=document.createElement('div');d.id='lab-project-rename-dialog';d.setAttribute('role','dialog');d.innerHTML='<input value="Studio"><button type="button">Enregistrer</button>';document.body.appendChild(d);d.querySelector('button').addEventListener('click',async()=>{const name=d.querySelector('input').value;await fetch('/lab/project-rename',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:P1,name})});const a=document.querySelector(`a[href="/g/${P1}/project"]`);if(a)a.textContent=name;d.remove();document.querySelectorAll('.lab-inline-menu').forEach(m=>m.remove());});
    },true);
  },{P1});
  return{context,worker,page,server,traffic,pageErrors,consoleErrors,goto,close:()=>closeRuntime(context,dir)};
}

const studioPin=p=>p.locator(`#ng8-pins a[data-ng8-pin="1"][data-ng121-pid="${P1}"]`);
const projectAction=p=>p.locator(`#ng8-pins .ng96-pin-entry[data-pid="${P1}"]>.ng113-native-actions-project`);
const drawer=p=>p.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"]`);
async function waitStudioChats(page){
  const rows=page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"] .ng96-chat-entry`);
  await expect.poll(async()=>rows.count(),{timeout:25000}).toBeGreaterThanOrEqual(EXPECTED_STUDIO_IDS.length);
  const ids=await rows.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-chat-entry')).filter(Boolean));
  expect(new Set(ids).size).toBe(ids.length);
  for(const id of EXPECTED_STUDIO_IDS)expect(ids).toContain(id);
}
async function menuGeometry(page){return page.evaluate(()=>{const m=document.getElementById('ng123-action-menu'),side=document.querySelector('[data-testid="conversation-sidebar"]');if(!m||!side)return null;const r=m.getBoundingClientRect(),s=side.getBoundingClientRect(),cs=getComputedStyle(m),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{body:m.parentElement===document.body,position:cs.position,left:r.left,right:r.right,top:r.top,bottom:r.bottom,sideRight:s.right,z:Number(cs.zIndex)||0,hit:!!hit?.closest?.('#ng123-action-menu'),inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};});}
async function scrollState(page){return page.evaluate(()=>{const outer=document.querySelector('#ng8-pins>.ng8-pin-list'),inner=document.querySelector('#ng8-pins .ng96-pin-drawer .ng96-folder-list'),head=document.querySelector('#ng8-pins>.ng8-pin-head'),box=document.getElementById('ng8-pins');return{outer:outer?.scrollTop||0,outerMax:outer?outer.scrollHeight-outer.clientHeight:0,inner:inner?.scrollTop||0,innerMax:inner?inner.scrollHeight-inner.clientHeight:0,headToken:head?.dataset.humanToken||'',boxToken:box?.dataset.humanToken||'',border:getComputedStyle(box).borderTopWidth+'|'+getComputedStyle(box).borderTopStyle+'|'+getComputedStyle(box).borderTopColor,order:[...document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]')].map(a=>a.dataset.ng121Pid)};});}

test(`full human sidebar session UX (${BROWSER_LABEL}, ${PROFILE_NAME})`,async()=>{
  let rt;await test.step('boot real MV3 extension in exact browser',async()=>{rt=await launchRuntime();const env=await rt.page.evaluate(()=>({brave:!!navigator.brave,visibility:document.visibilityState,hidden:document.hidden,ua:navigator.userAgent}));console.log(`HUMAN_UX_ENV ${JSON.stringify(env)}`);if(BROWSER_LABEL.includes('brave')){expect(env.brave).toBe(true);expect(env.visibility).toBe('visible');expect(env.hidden).toBe(false);expect(env.ua).not.toContain('HeadlessChrome');}});
  try{
    await test.step('Projects catalog is complete, scrollable and visually stable',async()=>{
      const page=rt.page;await expect(page.locator('#ng8-pins>.ng8-pin-head')).toContainText('PROJECTS');await expect(page.locator('#ng8-pins>.ng8-pin-list')).toHaveCount(1);
      await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),head=box.querySelector(':scope>.ng8-pin-head'),outer=box.querySelector(':scope>.ng8-pin-list');box.dataset.humanToken='box-stable';head.dataset.humanToken='head-stable';window.__humanRemoved={box:0,head:0,pins:0,drawers:0};window.__humanObs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.removedNodes){if(!(n instanceof Element))continue;window.__humanRemoved.box+=n.id==='ng8-pins'?1:n.querySelectorAll?.('#ng8-pins').length||0;window.__humanRemoved.head+=n.matches?.('.ng8-pin-head')?1:n.querySelectorAll?.('.ng8-pin-head').length||0;window.__humanRemoved.pins+=n.matches?.('a[data-ng8-pin]')?1:n.querySelectorAll?.('a[data-ng8-pin]').length||0;window.__humanRemoved.drawers+=n.matches?.('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;}});window.__humanObs.observe(document.body,{childList:true,subtree:true});outer.dispatchEvent(new WheelEvent('wheel',{deltaY:240,bubbles:true,cancelable:true}));outer.scrollTop=Math.floor((outer.scrollHeight-outer.clientHeight)*.55);});
      const before=await scrollState(page);expect(before.outerMax).toBeGreaterThan(120);expect(before.outer).toBeGreaterThan(40);expect(before.border).not.toMatch(/^0px/);
      // Repeated live cache timestamps are the exact updates that used to rebuild/reorder the catalog.
      for(let i=0;i<18;i++){await rt.worker.evaluate(async ({key,delta})=>{const raw=(await chrome.storage.local.get(key))[key]||{};raw.at=Date.now();raw.chats=(raw.chats||[]).map((c,j)=>({...c,updated:Number(c.updated||0)+delta+j}));await chrome.storage.local.set({[key]:raw});},{key:'niakgpt-v08-cache',delta:i+1});await page.evaluate(i=>{const main=document.querySelector('main');const n=document.createElement('span');n.dataset.churn=String(i);main.appendChild(n);n.remove();},i);await page.waitForTimeout(35);}
      const after=await scrollState(page),removed=await page.evaluate(()=>window.__humanRemoved);expect(Math.abs(after.outer-before.outer)).toBeLessThanOrEqual(3);expect(after.headToken).toBe('head-stable');expect(after.boxToken).toBe('box-stable');expect(after.border).toBe(before.border);expect(after.order).toEqual(before.order);expect(removed.box).toBe(0);expect(removed.head).toBe(0);expect(removed.pins).toBe(0);
    });

    await test.step('Project folder and chat drawer keep independent scroll positions',async()=>{
      const page=rt.page,beforeUrl=page.url();await studioPin(page).click();await expect(drawer(page)).toHaveCount(1,{timeout:5000});expect(page.url()).toBe(beforeUrl);await waitStudioChats(page);
      await page.evaluate(()=>{const outer=document.querySelector('#ng8-pins>.ng8-pin-list'),inner=document.querySelector('#ng8-pins .ng96-folder-list');outer.scrollTop=Math.min(outer.scrollHeight-outer.clientHeight-20,Math.max(120,outer.scrollTop));inner.scrollTop=Math.floor((inner.scrollHeight-inner.clientHeight)*.6);document.querySelector('#ng8-pins .ng96-pin-drawer').dataset.humanDrawer='stable';});
      const before=await scrollState(page);expect(before.innerMax).toBeGreaterThan(200);expect(before.inner).toBeGreaterThan(80);
      for(let i=0;i<20;i++){await rt.worker.evaluate(async ({key,i})=>{const raw=(await chrome.storage.local.get(key))[key]||{};raw.at=Date.now();raw.chats=(raw.chats||[]).map((c,j)=>({...c,updated:Number(c.updated||0)+i+j}));await chrome.storage.local.set({[key]:raw});},{key:'niakgpt-v08-cache',i});await page.waitForTimeout(30);}
      const after=await scrollState(page);expect(Math.abs(after.outer-before.outer)).toBeLessThanOrEqual(3);expect(Math.abs(after.inner-before.inner)).toBeLessThanOrEqual(3);expect(await page.locator('#ng8-pins .ng96-pin-drawer').getAttribute('data-human-drawer')).toBe('stable');
      // Closing/reopening intentionally recreates the drawer, but the human scroll position survives.
      await studioPin(page).click();await expect(drawer(page)).toHaveCount(0);expect(page.url()).toBe(beforeUrl);await studioPin(page).click();await waitStudioChats(page);const reopened=await scrollState(page);expect(Math.abs(reopened.inner-before.inner)).toBeLessThanOrEqual(5);
    });

    await test.step('Project and chat action hitboxes are reliable, exclusive and true toggles',async()=>{
      const page=rt.page;await page.evaluate(()=>{document.querySelector('#ng8-pins>.ng8-pin-list').scrollTop=0;});await expect(projectAction(page)).toHaveCount(1,{timeout:5000});
      const geometry=await page.evaluate(({P1})=>{const entry=document.querySelector(`#ng8-pins .ng96-pin-entry[data-pid="${P1}"]`),a=entry.querySelector(':scope>a'),b=entry.querySelector(':scope>.ng113-native-actions-project'),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),hit=(r)=>document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{gap:br.left-ar.right,a:!!hit(ar)?.closest('a[data-ng8-pin]'),ab:!!hit(ar)?.closest('.ng113-native-actions'),b:!!hit(br)?.closest('.ng113-native-actions-project'),ba:!!hit(br)?.closest('a[data-ng8-pin]'),bw:br.width,bh:br.height};},{P1});expect(geometry.gap).toBeGreaterThanOrEqual(0);expect(geometry).toMatchObject({a:true,ab:false,b:true,ba:false});expect(geometry.bw).toBeGreaterThanOrEqual(24);expect(geometry.bh).toBeGreaterThanOrEqual(24);
      for(let i=0;i<8;i++){await projectAction(page).click();await expect(page.locator('#ng123-action-menu[data-kind="project"]')).toHaveCount(1);const g=await menuGeometry(page);expect(g).toMatchObject({body:true,position:'fixed',hit:true,inside:true});expect(g.left).toBeGreaterThanOrEqual(g.sideRight+2);expect(g.z).toBeGreaterThan(100000);expect(await page.locator('#ng123-action-menu').innerText()).toContain('Actualiser les conversations');expect(await page.locator('#ng123-action-menu').innerText()).not.toContain('Déplacer vers');await projectAction(page).click();await expect(page.locator('#ng123-action-menu')).toHaveCount(0);}
      const chatButton=page.locator('#ng8-pins .ng96-chat-entry>.ng113-native-actions-chat').first();await chatButton.scrollIntoViewIfNeeded();for(let i=0;i<8;i++){await chatButton.click();await expect(page.locator('#ng123-action-menu[data-kind="chat"]')).toHaveCount(1);const text=await page.locator('#ng123-action-menu').innerText();expect(text).toContain('Renommer');expect(text).toContain('Déplacer vers');expect(text).not.toContain('Actualiser les conversations');await chatButton.click();await expect(page.locator('#ng123-action-menu')).toHaveCount(0);}expect(await page.locator('#ng123-action-menu').count()).toBe(0);
    });

    await test.step('Keyboard, focus and modal accessibility follow WAI-ARIA interaction contracts',async()=>{
      const page=rt.page,action=projectAction(page);await action.focus();await expect(action).toHaveAttribute('aria-haspopup','menu');await expect(action).toHaveAttribute('aria-expanded','false');await page.keyboard.press('Enter');await expect(page.locator('#ng123-action-menu')).toHaveCount(1);await expect(action).toHaveAttribute('aria-expanded','true');await expect(action).toHaveAttribute('aria-controls','ng123-action-menu');await expect.poll(()=>page.evaluate(()=>document.activeElement?.textContent?.trim()||'')).toBe('Renommer…');
      await page.keyboard.press('ArrowDown');await expect.poll(()=>page.evaluate(()=>document.activeElement?.textContent?.trim()||'')).toBe('Actualiser les conversations');await page.keyboard.press('Home');await expect.poll(()=>page.evaluate(()=>document.activeElement?.textContent?.trim()||'')).toBe('Renommer…');await page.keyboard.press('End');await expect.poll(()=>page.evaluate(()=>document.activeElement?.textContent?.trim()||'')).toBe('Actualiser les conversations');await page.keyboard.press('Escape');await expect(page.locator('#ng123-action-menu')).toHaveCount(0);await expect(action).toHaveAttribute('aria-expanded','false');expect(await page.evaluate(()=>document.activeElement?.classList.contains('ng113-native-actions-project'))).toBe(true);
      await action.click();await page.getByRole('menuitem',{name:'Renommer…'}).click();const dialog=page.locator('#ng123-rename-dialog');await expect(dialog).toHaveAttribute('role','dialog');await expect(dialog).toHaveAttribute('aria-modal','true');await expect(dialog).toHaveAttribute('aria-labelledby','ng123-rename-title');await expect(page.locator('#ng123-rename-title')).toContainText('Renommer le Project');await expect.poll(()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||'')).toBe('Nouveau nom');await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.activeElement?.hasAttribute('data-save'))).toBe(true);await page.keyboard.press('Tab');await expect.poll(()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||'')).toBe('Nouveau nom');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>document.activeElement?.classList.contains('ng113-native-actions-project'))).toBe(true);
    });

    await test.step('Custom chat rename and move update the correct entity without losing scroll',async()=>{
      const page=rt.page,entry=page.locator('#ng8-pins .ng96-chat-entry').nth(18),id=await entry.getAttribute('data-chat-entry'),button=entry.locator(':scope>.ng113-native-actions-chat');await button.scrollIntoViewIfNeeded();const scrollBefore=await scrollState(page);
      await button.click();await page.getByRole('menuitem',{name:'Renommer…'}).click();await expect(page.locator('#ng123-rename-dialog')).toHaveCount(1);await page.locator('#ng123-rename-dialog input').fill('Conversation renommée UX');await page.locator('#ng123-rename-dialog [data-save]').click();await expect(page.locator('#ng123-rename-dialog')).toHaveCount(0,{timeout:5000});await expect(page.locator(`#ng8-pins .ng96-chat-entry[data-chat-entry="${id}"] a[data-chat]`)).toContainText('Conversation renommée UX',{timeout:5000});expect(rt.traffic.patches.some(p=>p.id===id&&p.body.title==='Conversation renommée UX')).toBe(true);const afterRename=await scrollState(page);expect(Math.abs(afterRename.inner-scrollBefore.inner)).toBeLessThanOrEqual(6);
      const movedEntry=page.locator(`#ng8-pins .ng96-chat-entry[data-chat-entry="${id}"]`);await movedEntry.locator(':scope>.ng113-native-actions-chat').click();await page.getByRole('menuitem',{name:'Déplacer vers…'}).click();await expect(page.locator('#ng123-action-menu .ng123-move-list')).toBeVisible();await page.locator('#ng123-action-menu .ng123-move-list button',{hasText:'Research Lab'}).click();await expect(page.locator(`#ng8-pins .ng96-chat-entry[data-chat-entry="${id}"]`)).toHaveCount(0,{timeout:6000});expect(rt.traffic.patches.some(p=>p.id===id&&p.body.gizmo_id===P2)).toBe(true);const afterMove=await scrollState(page);expect(Math.abs(afterMove.inner-afterRename.inner)).toBeLessThanOrEqual(10);
    });

    await test.step('Project custom rename targets only the exact Project native row',async()=>{
      const page=rt.page;await page.evaluate(()=>document.querySelector('#ng8-pins>.ng8-pin-list').scrollTop=0);await projectAction(page).click();await page.getByRole('menuitem',{name:'Renommer…'}).click();await expect(page.locator('#ng123-rename-dialog')).toHaveCount(1);await page.locator('#ng123-rename-dialog input').fill('Studio Renommé UX');await page.locator('#ng123-rename-dialog [data-save]').click();await expect(page.locator('#ng123-rename-dialog')).toHaveCount(0,{timeout:7000});await expect(studioPin(page)).toContainText('Studio Renommé UX',{timeout:10000});expect(rt.traffic.projectRenames).toBeGreaterThanOrEqual(1);expect(rt.traffic.patches.some(p=>p.body.title==='Studio Renommé UX')).toBe(false);
    });

    await test.step('Late sidebar mount and route diversity always recover Pins',async()=>{
      const page=rt.page;for(const route of ['/','/search','/library','/images','/apps',`/g/${P1}/project`,`/c/${CHAT1}`]){await rt.goto(route);await expect(page.locator('#ng8-pins>.ng8-pin-head')).toContainText('PROJECTS',{timeout:7000});}
      await page.evaluate(()=>{const old=document.querySelector('[data-testid="conversation-sidebar"]'),fresh=old.cloneNode(true);fresh.querySelector('#ng8-pins')?.remove();fresh.querySelectorAll('[data-ng112-native-projects]').forEach(x=>x.removeAttribute('data-ng112-native-projects'));old.remove();setTimeout(()=>document.body.prepend(fresh),350);});
      await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(rt.server.projects.length,{timeout:9000});await expect(page.locator('#ng8-pins .ng113-native-actions-project')).toHaveCount(rt.server.projects.length,{timeout:5000});
    });

    await test.step('Conversation limit CTA really starts continuity in same Project',async()=>{
      const page=rt.page;await rt.goto(`/c/${CHAT1}`);await page.evaluate(()=>{const a=document.createElement('div');a.setAttribute('role','alert');a.dataset.testid='conversation-limit-error';a.textContent="You've reached the maximum conversation limit. Continue in a new chat.";document.querySelector('main').appendChild(a);});await expect(page.locator('#ng119-interruption')).toContainText(/limite|continuer/i,{timeout:5000});await expect(page.locator('#ng119-interruption .ng100-continue')).toHaveCount(1);await page.locator('#ng119-interruption .ng100-continue').click();await expect.poll(()=>new URL(page.url()).pathname,{timeout:7000}).toBe(`/g/${P1}/project`);await expect(page.locator('#prompt-textarea')).toContainText('CONTINUITÉ NIAKGPT',{timeout:7000});
    });

    await test.step('Network/generation error recovery preserves draft and never auto-sends',async()=>{
      const page=rt.page;await rt.goto(`/c/${CHAT1}`);await page.locator('#prompt-textarea').fill('Brouillon important à préserver');const posts=rt.traffic.posts;await page.evaluate(()=>{const a=document.createElement('div');a.setAttribute('role','alert');a.dataset.testid='generation-error';a.textContent='Something went wrong. Failed to fetch.';document.querySelector('main').appendChild(a);});await expect(page.locator('#ng119-interruption')).toContainText(/connexion|réseau|repr/i,{timeout:5000});await page.evaluate(()=>document.querySelector('[data-testid="generation-error"]')?.remove());await page.waitForTimeout(1400);await expect(page.locator('#prompt-textarea')).toHaveValue('Brouillon important à préserver');expect(rt.traffic.posts).toBe(posts);
    });

    await test.step('Long-work soak: more than 10 logical minutes never causes timeout, abort or forced relaunch',async()=>{
      const page=rt.page;await rt.goto(`/c/${CHAT1}`);const docs=rt.traffic.documents,posts=rt.traffic.posts,url=page.url();await page.evaluate(()=>{window.__humanAutoClicks=0;document.addEventListener('click',e=>{if(e.isTrusted)window.__humanAutoClicks++;},true);window.__humanRealDateNow=Date.now;window.__humanNow=Date.now();window.__humanSoakStart=window.__humanNow;Date.now=()=>window.__humanNow;document.documentElement.dataset.ng86Activity='thinking';document.documentElement.dataset.ng8Running='1';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:true,state:'thinking'}}));});await rt.worker.evaluate(()=>{self.__humanRealDateNow=Date.now;self.__humanNow=Date.now();Date.now=()=>self.__humanNow;});
      for(let i=0;i<48;i++){await page.evaluate(i=>{window.__humanNow+=20000;const t=document.createElement('article');t.dataset.testid=`conversation-turn-soak-${i}`;const m=document.createElement('div');m.setAttribute('data-message-author-role','assistant');m.textContent=i%7===0?'Discussion normale : “network error”, “conversation limit”, “retry” et “failed to fetch” sont seulement des mots dans la réponse.':`Analyse longue toujours active · minute logique ${Math.floor((i+1)/3)}`;t.appendChild(m);document.querySelector('.content').insertBefore(t,document.querySelector('.composer'));},i);await rt.worker.evaluate(()=>{self.__humanNow+=20000;});await page.waitForTimeout(35);}
      const elapsed=await page.evaluate(()=>Date.now()-window.__humanSoakStart);expect(elapsed).toBeGreaterThanOrEqual(16*60*1000);expect(page.url()).toBe(url);expect(rt.traffic.documents).toBe(docs);expect(rt.traffic.posts).toBe(posts);await expect(page.locator('#ng119-interruption')).toHaveCount(0);expect(await page.evaluate(()=>window.__humanAutoClicks)).toBe(0);expect(await page.evaluate(()=>document.documentElement.dataset.ng8Running)).toBe('1');await page.evaluate(()=>{Date.now=window.__humanRealDateNow;delete window.__humanRealDateNow;delete window.__humanNow;document.documentElement.dataset.ng86Activity='ready';document.documentElement.dataset.ng8Running='0';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{active:false,state:'ready'}}));});await rt.worker.evaluate(()=>{Date.now=self.__humanRealDateNow;delete self.__humanRealDateNow;delete self.__humanNow;});
    });

    await test.step('No UX leaks, duplicate menus, extension page errors or console errors',async()=>{
      const page=rt.page;await expect(page.locator('#ng123-action-menu')).toHaveCount(0);await expect(page.locator('#ng123-rename-dialog')).toHaveCount(0);expect(await page.locator('#ng8-pins [id]').evaluateAll(nodes=>nodes.length-new Set(nodes.map(n=>n.id)).size)).toBe(0);await page.evaluate(()=>window.__humanObs?.disconnect());expect(rt.pageErrors).toEqual([]);expect(rt.consoleErrors).toEqual([]);
    });
  }finally{if(rt)await rt.close();}
});
