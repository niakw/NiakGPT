const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const fixture=fs.readFileSync(path.join(__dirname,'..','runtime-fixture.html'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8')).version;
const PAGE1='11111111-1111-4111-8111-111111111111';
const PAGE2='22222222-2222-4222-8222-222222222222';
const HOT='44444444-4444-4444-8444-444444444444';

async function worker(context){return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:10000});}

async function launch(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-hotcache-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1280,height:760},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const sw=await worker(context);await sw.evaluate(async v=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version:v,at:Date.now()}}),version);
  let hotGets=0;
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&/^\/c\/[0-9a-f-]+$/i.test(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(u.pathname==='/api/auth/session')return json({accessToken:'hotcache-test'});
    if(u.pathname===`/backend-api/conversation/${HOT}`){hotGets++;await new Promise(r=>setTimeout(r,420));return json({id:HOT,title:'Hot cache concurrency',gizmo_id:null,update_time:1786609000,current_node:'hot-node',mapping:{}});}
    if(/^\/backend-api\/conversation\/[0-9a-f-]+$/i.test(u.pathname))return json({id:u.pathname.split('/').at(-1),title:'Page conversation',update_time:1786608000,current_node:'page-node',mapping:{}});
    if(u.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[],cursor:null});
    if(u.pathname==='/backend-api/conversations')return json({items:[],has_more:false,total:0});
    return route.fulfill({status:204,body:''});
  });
  const p1=context.pages()[0]||await context.newPage();const p2=await context.newPage();
  await Promise.all([p1.goto(`https://chatgpt.com/c/${PAGE1}`,{waitUntil:'domcontentloaded'}),p2.goto(`https://chatgpt.com/c/${PAGE2}`,{waitUntil:'domcontentloaded'})]);
  await Promise.all([expect(p1.locator('#ng8-status')).toBeVisible({timeout:12000}),expect(p2.locator('#ng8-status')).toBeVisible({timeout:12000})]);
  return{context,p1,p2,get hotGets(){return hotGets;},close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});}};
}

async function hotFetch(page){
  return page.evaluate(async id=>{
    const start=performance.now();const r=await fetch(`/backend-api/conversation/${id}`);const data=await r.json();return{elapsed:performance.now()-start,id:data.id,mode:document.documentElement.dataset.ng8Hotcache};
  },HOT);
}

test('two simultaneous tabs produce one heavy backend GET and both receive the conversation',async()=>{
  const rt=await launch();
  try{
    const [first,second]=await Promise.all([hotFetch(rt.p1),hotFetch(rt.p2)]);
    expect(first.id).toBe(HOT);expect(second.id).toBe(HOT);
    expect(rt.hotGets).toBe(1);
    expect(Math.min(first.elapsed,second.elapsed)).toBeLessThan(1600);
    expect(Math.max(first.elapsed,second.elapsed)).toBeLessThan(6500);
    const modes=[first.mode,second.mode].join(' ');
    expect(modes).toMatch(/NETWORK|STORED|HIT_AFTER_LOCK|HIT/);
    await expect.poll(()=>rt.hotGets,{timeout:1500}).toBe(1);
  }finally{await rt.close();}
});

test('a third request after persistence is an immediate cache hit with no network',async()=>{
  const rt=await launch();
  try{
    await Promise.all([hotFetch(rt.p1),hotFetch(rt.p2)]);expect(rt.hotGets).toBe(1);
    const third=await hotFetch(rt.p1);
    expect(third.id).toBe(HOT);expect(rt.hotGets).toBe(1);expect(third.elapsed).toBeLessThan(500);
  }finally{await rt.close();}
});
