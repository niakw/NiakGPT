const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const sidebar=fs.readFileSync(path.join(ROOT,'sidebar-projects-v121.js'),'utf8');
const ux=fs.readFileSync(path.join(ROOT,'ux-v131.js'),'utf8');

const fixture=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:800px;background:#0d1117;color:#ddd}.left{position:fixed;left:0;top:0;bottom:0;width:300px;overflow:auto}.left a{display:block;height:32px}.native-projects{min-height:120px}main{margin-left:320px}
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

test('v121 + v131 observers recover after repeated BFCache pagehide/pageshow cycles',async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:800}});
  const page=await context.newPage();
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:sidebar});
    await page.addScriptTag({content:ux});
    await assertRecovered(page,'initial mount');

    await cycle(page);
    await page.evaluate(()=>document.getElementById('ng8-pins')?.remove());
    await assertRecovered(page,'first BFCache cycle did not restore observers');

    await cycle(page);
    await page.evaluate(()=>{
      const old=document.querySelector('[data-testid="conversation-sidebar"]');
      const next=old.cloneNode(true);
      next.querySelector('#ng8-pins')?.remove();
      old.replaceWith(next);
    });
    await assertRecovered(page,'second BFCache cycle did not rebind to remounted sidebar');

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
