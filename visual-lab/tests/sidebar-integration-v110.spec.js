const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', '..');
const fixture = fs.readFileSync(path.join(__dirname, '..', 'sidebar-0960-fixture.html'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')).version;
const P1='g-p-aaaaaaaaaaaaaaaa',P2='g-p-bbbbbbbbbbbbbbbb';
const C1='11111111-1111-4111-8111-111111111111',C2='22222222-2222-4222-8222-222222222222',C3='33333333-3333-4333-8333-333333333333';
const LONG='Une conversation NiakGPT avec un titre extrêmement long qui doit rester tronqué sans déplacer la date ni remplacer le lien pendant les rafraîchissements';
const project=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:name},instructions:''}}});
const chat=(id,title,pid,time)=>({id,title,gizmo_id:pid,update_time:time,create_time:time});

async function workerFor(context){
  return context.serviceWorkers()[0]||context.waitForEvent('serviceworker',{timeout:10000});
}

test('0.9.60 unpacked extension owns Projects + stable clickable chat rows + active/OUT state',async()=>{
  const userDataDir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-sidebar-0960-'));
  const context=await chromium.launchPersistentContext(userDataDir,{headless:true,channel:'chromium',viewport:{width:1280,height:820},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const worker=await workerFor(context);
  const all=[chat(C1,LONG,P1,1787000000),chat(C2,'Conversation normale',P1,1786900000),chat(C3,'Conversation arrivée à la limite',P1,1786800000)];
  await worker.evaluate(async({version,C3})=>{
    await chrome.storage.local.set({
      'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()},
      'niakgpt-continuity-v100':{schema:1,out:{[C3]:{out:true,updatedAt:Date.now(),reason:'limit-detected',title:'Conversation arrivée à la limite'}}}
    });
  },{version,C3});

  await context.route('https://chatgpt.com/**',async route=>{
    const request=route.request(),u=new URL(request.url()),method=request.method().toUpperCase();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(request.resourceType()==='document'&&/\/c\/[0-9a-f-]+$/i.test(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(u.pathname==='/api/auth/session')return json({accessToken:'sidebar-lab-token'});
    if(u.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[project(P1,'Studio'),project(P2,'Research Lab')],cursor:null});
    if(/^\/backend-api\/gizmos\/g-p-[A-Za-z0-9]+\/conversations$/.test(u.pathname)){
      const pid=u.pathname.match(/\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations/)[1];return json({items:all.filter(c=>c.gizmo_id===pid),cursor:null});
    }
    if(u.pathname==='/backend-api/conversations')return json({items:all,has_more:false,total:all.length});
    if(/^\/backend-api\/conversation\/[0-9a-f-]+$/i.test(u.pathname)&&method==='PATCH')return json({ok:true});
    return route.fulfill({status:204,body:''});
  });

  const page=context.pages()[0]||await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  try{
    await page.goto(`https://chatgpt.com/g/${P1}/c/${C1}`,{waitUntil:'commit'});
    await expect(page.locator('#native-brand')).toBeVisible({timeout:8000});
    await expect(page.locator('#ng8-status')).toContainText('0.9.60',{timeout:14000});
    await expect(page.locator('#ng8-pins')).toBeVisible({timeout:16000});
    await expect.poll(async()=>page.locator('#native-projects-0960').evaluate(el=>getComputedStyle(el).display),{timeout:12000}).toBe('none');
    await expect(page.locator('#custom-gpts')).toBeVisible();await expect(page.locator('#recents')).toBeVisible();

    const pin=page.locator(`#ng8-pins a[href*="${P1}"]`).first();await expect(pin).toBeVisible({timeout:16000});await pin.click();
    await expect(page.locator('.ng110-pin-drawer')).toBeVisible({timeout:6000});
    await expect(page.locator('.ng96-pin-drawer')).toHaveCount(0);await expect(page.locator('.ng109-chat-row')).toHaveCount(0);
    await expect(page.locator('.ng110-chat-row')).toHaveCount(3);

    const current=page.locator(`.ng110-chat-row[data-chat-row="${C1}"]`);const currentLink=current.locator('a[data-chat]');
    await expect(current).toHaveAttribute('data-ng110-active','');await expect(currentLink).toHaveAttribute('aria-current','page');
    const activeStyle=await current.evaluate(el=>({shadow:getComputedStyle(el).boxShadow,bg:getComputedStyle(el).backgroundImage}));expect(activeStyle.shadow).not.toBe('none');
    const out=page.locator(`.ng110-chat-row[data-chat-row="${C3}"]`);await expect(out).toHaveAttribute('data-ng110-out','');await expect(out.locator('.ng110-chat-status')).toHaveText('OUT');
    expect((await page.locator('.ng110-chat-row').evaluateAll(els=>els.map(e=>e.dataset.chatRow))).at(-1)).toBe(C3);

    const title=current.locator('.ng110-chat-title'),date=current.locator('.ng110-chat-date');
    const titleStyle=await title.evaluate(el=>({overflow:getComputedStyle(el).overflow,white:getComputedStyle(el).whiteSpace,ellipsis:getComputedStyle(el).textOverflow,client:el.clientWidth,scroll:el.scrollWidth}));
    expect(titleStyle).toMatchObject({overflow:'hidden',white:'nowrap',ellipsis:'ellipsis'});expect(titleStyle.scroll).toBeGreaterThanOrEqual(titleStyle.client);
    const box0=await date.boundingBox();await page.evaluate((id)=>{window.__ng110Row=document.querySelector(`.ng110-chat-row[data-chat-row="${id}"]`);},C1);

    for(let i=0;i<12;i++){
      await worker.evaluate(async({C1,LONG,i})=>{const key='niakgpt-v08-cache',raw=(await chrome.storage.local.get(key))[key];if(!raw)return;const next=structuredClone(raw);const title=i%2?`Court ${i}`:`${LONG} #${i}`;for(const c of next.chats||[])if(c.id===C1)c.title=title;for(const list of Object.values(next.projectChats||{}))for(const c of list||[])if(c.id===C1)c.title=title;next.at=Date.now();await chrome.storage.local.set({[key]:next});},{C1,LONG,i});
      await page.waitForTimeout(35);
      expect(await page.evaluate((id)=>window.__ng110Row===document.querySelector(`.ng110-chat-row[data-chat-row="${id}"]`),C1)).toBe(true);
    }
    const box1=await date.boundingBox();expect(Math.abs(box0.x-box1.x)).toBeLessThanOrEqual(1);expect(Math.abs(box0.width-box1.width)).toBeLessThanOrEqual(1);

    await page.evaluate(()=>{
      window.__ng110Clicks=[];
      window.__ng110Recorder=e=>{const a=e.target.closest?.('.ng110-chat-link');if(!a)return;window.__ng110Clicks.push({type:e.type,prevented:e.defaultPrevented,ctrl:!!e.ctrlKey,meta:!!e.metaKey});e.preventDefault();};
      for(const type of ['click','contextmenu'])document.addEventListener(type,window.__ng110Recorder);
    });
    const normal=page.locator(`.ng110-chat-link[data-chat="${C2}"]`);await normal.dispatchEvent('click',{button:0});await normal.dispatchEvent('contextmenu',{button:2});await normal.dispatchEvent('click',{button:0,ctrlKey:true});
    expect(await page.evaluate(()=>window.__ng110Clicks)).toEqual([{type:'click',prevented:false,ctrl:false,meta:false},{type:'contextmenu',prevented:false,ctrl:false,meta:false},{type:'click',prevented:false,ctrl:true,meta:false}]);
    await page.evaluate(()=>{for(const type of ['click','contextmenu'])document.removeEventListener(type,window.__ng110Recorder);delete window.__ng110Recorder;});

    await page.evaluate((id)=>{window.__ng110Other=document.querySelector(`.ng110-chat-row[data-chat-row="${id}"]`);},C2);
    await worker.evaluate(async C2=>{const key='niakgpt-continuity-v100',st=(await chrome.storage.local.get(key))[key]||{schema:1,out:{}};st.out=st.out||{};st.out[C2]={out:true,updatedAt:Date.now(),reason:'limit-detected'};await chrome.storage.local.set({[key]:st});},C2);
    await expect(page.locator(`.ng110-chat-row[data-chat-row="${C2}"] .ng110-chat-status`)).toHaveText('OUT',{timeout:4000});
    expect(await page.evaluate((id)=>window.__ng110Other===document.querySelector(`.ng110-chat-row[data-chat-row="${id}"]`),C2)).toBe(true);

    await page.evaluate(()=>{const old=document.querySelector('#native-projects-0960');const clone=old.cloneNode(true);clone.id='native-projects-rerender';old.replaceWith(clone);});
    await expect.poll(async()=>page.locator('#native-projects-rerender').evaluate(el=>getComputedStyle(el).display),{timeout:3000}).toBe('none');

    fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'..','artifacts','sidebar-integration-v110-unpacked.png'),fullPage:true});
    expect(pageErrors).toEqual([]);

    // Final proof: a real left click must perform browser navigation to the chat URL.
    await Promise.all([
      page.waitForURL(url=>url.pathname.endsWith(`/c/${C2}`),{timeout:6000}),
      normal.click()
    ]);
    expect(new URL(page.url()).pathname).toBe(`/g/${P1}/c/${C2}`);
  }finally{await context.close();fs.rmSync(userDataDir,{recursive:true,force:true});}
});
