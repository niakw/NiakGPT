const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const sidebar=fs.readFileSync(path.join(ROOT,'sidebar-projects-v121.js'),'utf8');
const ux=fs.readFileSync(path.join(ROOT,'ux-v131.js'),'utf8');
const actions=fs.readFileSync(path.join(ROOT,'sidebar-actions-v123.js'),'utf8');

const fixture=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:800px;background:#0d1117;color:#ddd}.left{position:fixed;left:0;top:0;bottom:0;width:300px;overflow:auto}.left a{display:block;height:32px}.native-projects{min-height:120px}main{margin-left:320px}#ng8-pins>.ng8-pin-list{max-height:120px;overflow-y:auto}.ng96-pin-entry{display:grid;grid-template-columns:1fr 32px}.ng113-native-actions{width:28px;height:28px}#ng123-action-menu{position:fixed;width:260px;background:#222;color:#fff;z-index:9999}
</style></head><body>
<aside class="left" data-testid="conversation-sidebar" aria-label="Historique des conversations">
  <a href="/">Nouveau chat</a><a href="/library">Bibliothèque</a>
  <section class="native-projects"><h2>Projets</h2><a href="/g/g-p-alpha/project">Alpha</a><a href="/g/g-p-beta/project">Beta</a></section>
  <a href="/c/22222222-2222-4222-8222-222222222222">Chat récent</a>
</aside><main>Conversation</main>
<script>
window.__cache={projects:[{id:'g-p-alpha',name:'Alpha',href:'/g/g-p-alpha/project'},{id:'g-p-beta',name:'Beta',href:'/g/g-p-beta/project'}],chats:[],counts:{}};
window.chrome={storage:{local:{get:async()=>({'niakgpt-v08-cache':window.__cache,'niakgpt-governance-v085':{coreProjectIds:['g-p-alpha','g-p-beta'],hiddenProjectIds:[]}})},onChanged:{addListener:()=>{}}}};
</script></body></html>`;

async function cycle(page){
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForTimeout(30);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForTimeout(180);
}

async function assertRecovered(page,label){
  await expect.poll(()=>page.evaluate(()=>({
    pins:document.querySelectorAll('#ng8-pins').length,
    inSidebar:!!document.querySelector('[data-testid="conversation-sidebar"] #ng8-pins'),
    mounted:document.getElementById('ng8-pins')?.dataset.ng131Mounted||'',
    count:document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]').length
  })),{timeout:1600,message:label}).toEqual({pins:1,inSidebar:true,mounted:'1',count:2});
}

async function wrapAlpha(page){
  await page.evaluate(()=>{
    const a=document.querySelector('#ng8-pins a[data-ng121-pid="g-p-alpha"]');if(!a||a.closest('.ng96-pin-entry'))return;
    const row=document.createElement('div');row.className='ng96-pin-entry';row.dataset.pid='g-p-alpha';a.before(row);row.appendChild(a);
  });
}

async function assertActionWorks(page,label){
  await expect.poll(()=>page.locator('#ng8-pins .ng96-pin-entry>.ng113-native-actions-project').count(),{timeout:1400,message:label}).toBe(1);
  const button=page.locator('#ng8-pins .ng96-pin-entry>.ng113-native-actions-project');
  await button.click();await expect(page.locator('#ng123-action-menu[data-kind="project"]')).toHaveCount(1);
  await button.click();await expect(page.locator('#ng123-action-menu')).toHaveCount(0);
}

test('v121 + v131 + v123 observers recover after repeated BFCache pagehide/pageshow cycles',async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:800}});
  const page=await context.newPage();
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:sidebar});
    await page.addScriptTag({content:ux});
    await assertRecovered(page,'initial mount');
    await wrapAlpha(page);await page.addScriptTag({content:actions});await assertActionWorks(page,'initial action decoration failed');

    await cycle(page);
    await page.evaluate(()=>document.querySelector('#ng8-pins .ng113-native-actions-project')?.remove());
    await assertActionWorks(page,'sidebar action observer did not recover after BFCache');
    await page.evaluate(()=>document.getElementById('ng8-pins')?.remove());
    await assertRecovered(page,'first BFCache cycle did not restore observers');
    await wrapAlpha(page);await assertActionWorks(page,'actions did not rebind to recreated Projects host');

    await cycle(page);
    await page.evaluate(()=>{
      const old=document.querySelector('[data-testid="conversation-sidebar"]');
      const next=old.cloneNode(true);
      next.querySelector('#ng8-pins')?.remove();
      old.replaceWith(next);
    });
    await assertRecovered(page,'second BFCache cycle did not rebind to remounted sidebar');
    await wrapAlpha(page);await assertActionWorks(page,'actions did not rebind to remounted sidebar');

    await cycle(page);
    await page.evaluate(()=>document.getElementById('ng8-pins')?.remove());
    await assertRecovered(page,'third BFCache cycle revealed a once-only pageshow/pagehide listener');

    const state=await page.evaluate(()=>({
      finder:typeof window.__NIAKGPT_FIND_SIDEBAR_V131__,
      placement:document.getElementById('ng8-pins')?.dataset.ng121Placement||'',
      verified:document.documentElement.dataset.ng131Sidebar||''
    }));
    expect(state.finder).toBe('function');
    expect(state.placement).toBeTruthy();
    expect(state.verified).toBe('verified');
  }finally{
    await context.close();
    await browser.close();
  }
});

test('active user scroll wins over a pending cache restoration captured at the old position',async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:800}});
  const page=await context.newPage();
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:sidebar});await page.addScriptTag({content:ux});await assertRecovered(page,'scroll fixture mount');
    const moved=await page.evaluate(()=>{
      const list=document.querySelector('#ng8-pins>.ng8-pin-list');
      for(let i=0;i<24;i++){const n=document.createElement('div');n.textContent=`filler-${i}`;n.style.height='28px';list.appendChild(n);}
      list.scrollTop=0;
      list.dispatchEvent(new WheelEvent('wheel',{deltaY:260,bubbles:true,cancelable:true}));
      document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile'));
      list.scrollTop=150;
      return{max:list.scrollHeight-list.clientHeight,top:list.scrollTop};
    });
    expect(moved.max).toBeGreaterThan(300);expect(moved.top).toBeGreaterThan(100);
    await page.waitForTimeout(1050);
    expect(await page.locator('#ng8-pins>.ng8-pin-list').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  }finally{await context.close();await browser.close();}
});
