import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test,expect,chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';

const ROOT=path.resolve('..');
const EXECUTABLE=String(process.env.NIAKGPT_EXECUTABLE_PATH||'').trim();
const LABEL=String(process.env.NIAKGPT_BROWSER_LABEL||'chromium').replace(/[^a-z0-9._-]+/gi,'-');
const OUT=path.join(ROOT,'visual-lab','artifacts','live-chatgpt-v109');
const TARGET='https://chatgpt.com/';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function closePersistent(context){
  const braveMac=!!EXECUTABLE&&process.platform==='darwin';
  if(!braveMac){await context.close().catch(()=>{});return;}
  for(const signal of ['-TERM','-KILL']){
    try{execFileSync('/usr/bin/pkill',[signal,'-f','Brave Browser'],{stdio:'ignore'});}catch{}
    await sleep(signal==='-TERM'?350:120);
    if(!context.browser()?.isConnected())break;
  }
  await Promise.race([context.close().catch(()=>{}),sleep(1500)]);
}
const launchBase=()=>({
  headless:true,
  ...(EXECUTABLE?{executablePath:EXECUTABLE}:{channel:'chromium'}),
  args:['--disable-background-mode','--no-first-run','--no-default-browser-check']
});

function attachTelemetry(page,bucket){
  page.on('console',msg=>{
    const text=msg.text();
    if(msg.type()==='error'||/React error #418|RecoverableError|hydration/i.test(text)){
      bucket.console.push({type:msg.type(),text:text.slice(0,5000),url:msg.location()?.url||''});
    }
  });
  page.on('pageerror',err=>bucket.pageerrors.push(String(err?.stack||err).slice(0,12000)));
  page.on('requestfailed',req=>{
    const url=req.url();
    if(/chatgpt\.com|oaistatic\.com|openai/i.test(url)) bucket.requestfailed.push({url,error:req.failure()?.errorText||''});
  });
}

async function snapshot(page,label){
  return page.evaluate(label=>{
    const reactKeys=node=>{
      if(!node)return[];
      try{return Object.getOwnPropertyNames(node).filter(k=>/^__react(?:Container|Fiber|Props|Events|InternalInstance|Listening)/.test(k));}
      catch{return[];}
    };
    const documentKeys=reactKeys(document);
    const htmlKeys=reactKeys(document.documentElement);
    const bodyKeys=reactKeys(document.body);
    const owned=[];
    const containers=[];
    const nodes=[...document.querySelectorAll('*')].slice(0,6000);
    for(const node of nodes){
      const keys=reactKeys(node);
      if(!keys.length)continue;
      const entry={
        tag:node.tagName,
        id:node.id||'',
        cls:String(node.className||'').slice(0,180),
        keys:keys.slice(0,8)
      };
      if(keys.some(k=>k.startsWith('__reactContainer$')))containers.push(entry);
      if(owned.length<40)owned.push(entry);
    }
    return {
      label,
      href:location.href,
      title:document.title,
      readyState:document.readyState,
      htmlDataBuild:document.documentElement.hasAttribute('data-build'),
      routerContext:typeof window.__reactRouterContext!=='undefined',
      hydrationProof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      ngReady:document.body?.classList.contains('ng8-ready')||false,
      documentKeys,
      htmlKeys,
      bodyKeys,
      containers:containers.slice(0,20),
      ownedCount:owned.length,
      ownedSamples:owned,
      shell:{
        nav:!!document.querySelector('nav,aside'),
        main:!!document.querySelector('main'),
        composer:!!document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')
      },
      bodyText:String(document.body?.innerText||'').slice(0,600)
    };
  },label);
}

async function visitBaseline(){
  const browser=await chromium.launch(launchBase());
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  const page=await context.newPage();
  const bucket={console:[],pageerrors:[],requestfailed:[],snapshots:[],gotoError:null};
  attachTelemetry(page,bucket);
  try{
    await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:45000}).catch(e=>{bucket.gotoError=String(e);});
    for(const [label,delay] of [['t0',0],['t2',2000],['t6',4000],['t12',6000]]){
      if(delay)await sleep(delay);
      bucket.snapshots.push(await snapshot(page,label).catch(e=>({label,error:String(e)})));
    }
  }finally{
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
  return bucket;
}

async function visitExtension(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-live-chatgpt-'));
  const opts=launchBase();
  opts.args=[
    ...opts.args,
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`
  ];
  const context=await chromium.launchPersistentContext(dir,{...opts,viewport:{width:1365,height:900}});
  const page=context.pages()[0]||await context.newPage();
  const bucket={console:[],pageerrors:[],requestfailed:[],snapshots:[],gotoError:null,worker:false};
  attachTelemetry(page,bucket);
  try{
    const worker=context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))
      ||await context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000}).catch(()=>null);
    bucket.worker=!!worker;
    if(worker){
      await worker.evaluate(async version=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}}),JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version);
    }
    await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:45000}).catch(e=>{bucket.gotoError=String(e);});
    for(const [label,delay] of [['t0',0],['t2',2000],['t6',4000],['t12',6000]]){
      if(delay)await sleep(delay);
      bucket.snapshots.push(await snapshot(page,label).catch(e=>({label,error:String(e)})));
    }
  }finally{
    await closePersistent(context);
    fs.rmSync(dir,{recursive:true,force:true});
  }
  return bucket;
}

test('live chatgpt hydration baseline vs real NiakGPT MV3',async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const baseline=await visitBaseline();
  const extension=await visitExtension();
  const result={
    at:new Date().toISOString(),
    label:LABEL,
    target:TARGET,
    baseline,
    extension,
    baseline418:baseline.console.filter(x=>/React error #418|RecoverableError/.test(x.text)).length+baseline.pageerrors.filter(x=>/418|RecoverableError/.test(x)).length,
    extension418:extension.console.filter(x=>/React error #418|RecoverableError/.test(x.text)).length+extension.pageerrors.filter(x=>/418|RecoverableError/.test(x)).length
  };
  fs.writeFileSync(path.join(OUT,`${LABEL}.json`),JSON.stringify(result,null,2));
  console.log('LIVE_CHATGPT_HYDRATION_RESULT '+JSON.stringify({
    label:LABEL,
    baseline418:result.baseline418,
    extension418:result.extension418,
    baselineLast:baseline.snapshots.at(-1),
    extensionLast:extension.snapshots.at(-1)
  }));
  expect(extension.worker).toBe(true);
  expect(extension.snapshots.length).toBeGreaterThan(0);
});
