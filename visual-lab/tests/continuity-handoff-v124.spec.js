const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.resolve(__dirname,'..','runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8'));
const P1='g-p-aaaaaaaaaaaaaaaa';
const CHAT='11111111-1111-4111-8111-111111111111';
const STORE='niakgpt-continuity-pending-v124';
const SESSION='niakgpt-continuity-pending-v100';
const projectRaw={gizmo:{gizmo:{id:P1,display:{name:'Studio',description:'Studio continuity project'},instructions:''}}};
const chatRaw={id:CHAT,title:'Runtime integration test',gizmo_id:P1,update_time:1787000000,create_time:1787000000};

test.setTimeout(120000);

test('real MV3 continuity pending survives full document navigation and is consumed once injected',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-continuity-handoff-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1440,height:900},args:[`--disable-extensions-except=${ROOT}`,`--load-extension=${ROOT}`,'--disable-background-mode','--no-first-run','--no-default-browser-check']});
  try{
    const worker=context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||await context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});
    await worker.evaluate(async()=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version:chrome.runtime.getManifest().version,at:Date.now()}}));
    await context.route('https://chatgpt.com/**',async route=>{
      const req=route.request(),url=new URL(req.url()),json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(req.resourceType()==='document')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
      if(url.pathname==='/api/auth/session')return json({accessToken:'handoff-token'});
      if(url.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[projectRaw],cursor:null});
      if(url.pathname===`/backend-api/gizmos/${P1}/conversations`)return json({items:[chatRaw],cursor:null});
      if(url.pathname==='/backend-api/conversations')return json({items:[chatRaw],has_more:false,total:1});
      if(url.pathname===`/backend-api/conversation/${CHAT}`)return json({...chatRaw,mapping:{}});
      return route.fulfill({status:204,body:''});
    });
    const page=context.pages()[0]||await context.newPage();
    await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'commit'});
    await expect(page.locator('#ng8-status')).toContainText(manifest.version,{timeout:20000});
    await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(2,{timeout:20000});
    await page.evaluate(()=>{const a=document.createElement('div');a.setAttribute('role','alert');a.dataset.testid='conversation-limit-error';a.textContent="You've reached the maximum conversation limit. Continue in a new chat.";document.querySelector('main').appendChild(a);});
    await expect(page.locator('#ng119-interruption .ng100-continue')).toHaveCount(1,{timeout:5000});
    const before={session:await page.evaluate(key=>sessionStorage.getItem(key),SESSION),worker:await worker.evaluate(async key=>(await chrome.storage.local.get(key))[key]||null,STORE)};
    await page.locator('#ng119-interruption .ng100-continue').click();
    await expect.poll(()=>new URL(page.url()).pathname,{timeout:10000}).toBe(`/g/${P1}/project`);
    // Visibility of the capsule is the commit point: boot-gate-v100 consumes both
    // pending records before mutating the composer, so a subsequent navigation
    // cannot replay the same continuity payload into another draft.
    await expect(page.locator('#prompt-textarea')).toHaveValue(/CONTINUITÉ NIAKGPT/,{timeout:10000});
    await expect(page.locator('#prompt-textarea')).toHaveValue(/BROUILLON PRÉSERVÉ AVANT CONTINUITÉ[\s\S]*Test runtime/,{timeout:10000});
    const afterWorker=await worker.evaluate(async key=>(await chrome.storage.local.get(key))[key]||null,STORE);
    const afterPage=await page.evaluate(key=>({session:sessionStorage.getItem(key),value:document.querySelector('#prompt-textarea')?.value||'',text:document.querySelector('#prompt-textarea')?.textContent||'',bootErrors:sessionStorage.getItem('niakgpt-last-boot-errors-v100')}),SESSION);
    console.log(`CONTINUITY_HANDOFF_DIAG ${JSON.stringify({before,afterWorker,afterPage,url:page.url()})}`);
    expect(afterWorker).toBeNull();
    expect(afterPage.session).toBeNull();
    expect(afterPage.value).toContain('CONTINUITÉ NIAKGPT');
    expect(afterPage.value).toMatch(/BROUILLON PRÉSERVÉ AVANT CONTINUITÉ[\s\S]*Test runtime/);
  }finally{
    await context.close().catch(()=>{});
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
