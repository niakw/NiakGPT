const { test, expect, chromium } = require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.join(__dirname,'..','runtime-fixture.html'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8')).version;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function launch(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-tabs-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1200,height:760},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:10000});
  await worker.evaluate(async v=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version:v,at:Date.now()}}),version);
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),u=new URL(req.url()),json=x=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
    if(req.resourceType()==='document'&&/^\/c\//.test(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(u.pathname==='/api/auth/session')return json({accessToken:'tabs-token'});
    if(u.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[],cursor:null});
    if(u.pathname==='/backend-api/conversations')return json({items:[],has_more:false,total:0});
    if(/^\/backend-api\/conversation\//.test(u.pathname))return json({id:u.pathname.split('/').pop(),gizmo_id:null,update_time:1786608000,current_node:'n',mapping:{}});
    return route.fulfill({status:204,body:''});
  });
  const p1=context.pages()[0]||await context.newPage(),p2=await context.newPage();
  await Promise.all([p1.goto(`https://chatgpt.com/c/${A}`,{waitUntil:'domcontentloaded'}),p2.goto(`https://chatgpt.com/c/${B}`,{waitUntil:'domcontentloaded'})]);
  await Promise.all([expect(p1.locator('#ng8-status')).toBeVisible({timeout:12000}),expect(p2.locator('#ng8-status')).toBeVisible({timeout:12000})]);
  await expect.poll(async()=>{const r=await Promise.all([p1,p2].map(p=>p.locator('html').getAttribute('data-ng8-tab-role')));return r.sort().join(',');},{timeout:10000}).toBe('client,worker');
  return{context,dir,p1,p2};
}
async function roles(a,b){return Promise.all([a,b].map(p=>p.locator('html').getAttribute('data-ng8-tab-role')));}
async function close(rt){await rt.context.close();fs.rmSync(rt.dir,{recursive:true,force:true});}

test('closing the WORKER promotes the remaining CLIENT without a DOM rescan',async()=>{
  const rt=await launch();
  try{
    const [r1]=await roles(rt.p1,rt.p2),worker=r1==='worker'?rt.p1:rt.p2,client=worker===rt.p1?rt.p2:rt.p1;
    await worker.close();
    await expect.poll(()=>client.locator('html').getAttribute('data-ng8-tab-role'),{timeout:10000}).toBe('worker');
  }finally{await close(rt);}
});

test('a heavy WORKER hands background work to a light visible CLIENT',async()=>{
  const rt=await launch();
  try{
    const [r1]=await roles(rt.p1,rt.p2),worker=r1==='worker'?rt.p1:rt.p2,client=worker===rt.p1?rt.p2:rt.p1;
    await worker.locator('html').evaluate(el=>{el.dataset.ng8Heavy='1';});
    await expect.poll(async()=>({worker:await worker.locator('html').getAttribute('data-ng8-tab-role'),client:await client.locator('html').getAttribute('data-ng8-tab-role')}),{timeout:12000}).toEqual({worker:'client',client:'worker'});
  }finally{await close(rt);}
});
