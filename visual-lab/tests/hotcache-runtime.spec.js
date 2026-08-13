const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.join(__dirname,'..','runtime-fixture.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const CHAT='44444444-4444-4444-8444-444444444444';

async function workerFor(context){
  const current=context.serviceWorkers().find(w=>w.url().includes('background-v100.js'));
  if(current)return current;
  return context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:10000});
}

async function runtime(){
  const userDataDir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-hotcache-'));
  const context=await chromium.launchPersistentContext(userDataDir,{
    headless:true,channel:'chromium',viewport:{width:1280,height:800},
    args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]
  });
  const worker=await workerFor(context);
  await worker.evaluate(async version=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}}),manifest.version);
  const state={gets:0};
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&url.pathname===`/c/${CHAT}`)return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(url.pathname==='/api/auth/session')return json({accessToken:'visual-lab-token'});
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[],cursor:null});
    if(url.pathname==='/backend-api/conversations')return json({items:[],has_more:false,total:0});
    if(url.pathname===`/backend-api/conversation/${CHAT}`&&req.method()==='GET'){
      state.gets++;
      return json({id:CHAT,title:'Cached heavy conversation',gizmo_id:null,update_time:1786608000,current_node:'node-cache',mapping:{}});
    }
    return route.fulfill({status:204,body:''});
  });
  const page=context.pages()[0]||await context.newPage();
  await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'commit'});
  await expect(page.locator('#native-brand')).toBeVisible({timeout:8000});
  await expect(page.locator('#ng8-status')).toBeVisible({timeout:12000});
  return {context,page,state,userDataDir};
}

async function close(rt){
  await rt.context.close();
  fs.rmSync(rt.userDataDir,{recursive:true,force:true});
}

test('hot cache serves repeat conversation GET locally and invalidates on dirty',async()=>{
  const rt=await runtime();
  try{
    const fetchConversation=()=>rt.page.evaluate(id=>fetch(`/backend-api/conversation/${id}`).then(r=>r.json()),CHAT);

    const before=rt.state.gets;
    const first=await fetchConversation();
    expect(first.id).toBe(CHAT);
    expect(rt.state.gets).toBe(before+1);

    await expect.poll(async()=>rt.page.locator('html').getAttribute('data-ng8-hotcache'),{timeout:10000}).toBe('STORED');

    const second=await fetchConversation();
    expect(second.id).toBe(CHAT);
    expect(rt.state.gets).toBe(before+1);
    await expect(rt.page.locator('html')).toHaveAttribute('data-ng8-hotcache','HIT');

    await rt.page.evaluate(id=>document.dispatchEvent(new CustomEvent('niakgpt:hotcache-dirty',{detail:{id}})),CHAT);
    await expect(rt.page.locator('html')).toHaveAttribute('data-ng8-hotcache','DIRTY');

    const third=await fetchConversation();
    expect(third.id).toBe(CHAT);
    expect(rt.state.gets).toBe(before+2);
    await expect.poll(async()=>rt.page.locator('html').getAttribute('data-ng8-hotcache'),{timeout:10000}).toBe('STORED');
  }finally{await close(rt);}
});
