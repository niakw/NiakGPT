import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test,expect,chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';

const ROOT=path.resolve('..');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version;
const EXECUTABLE=String(process.env.NIAKGPT_EXECUTABLE_PATH||'').trim();
const HEADLESS=String(process.env.NIAKGPT_HEADLESS||'1')!=='0';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function closePersistentContext(context){
  const braveMac=!!EXECUTABLE&&process.platform==='darwin';
  if(!braveMac){await context.close().catch(()=>{});return;}
  for(const signal of ['-TERM','-KILL']){
    try{execFileSync('/usr/bin/pkill',[signal,'-f','Brave Browser'],{stdio:'ignore'});}catch{}
    await sleep(signal==='-TERM'?350:120);
    if(!context.browser()?.isConnected())break;
  }
  await Promise.race([context.close().catch(()=>{}),sleep(1500)]);
}

test('real MV3 boot resolves HostRoot through owner Fiber chain when container expando is absent',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-fiber-root-hydration-'));
  const launchOptions={
    headless:HEADLESS,
    viewport:{width:1280,height:820},
    args:[`--disable-extensions-except=${ROOT}`,`--load-extension=${ROOT}`,'--disable-background-mode','--no-first-run','--no-default-browser-check']
  };
  if(EXECUTABLE)launchOptions.executablePath=EXECUTABLE;else launchOptions.channel='chromium';
  const context=await chromium.launchPersistentContext(dir,launchOptions);
  try{
    const worker=context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))
      ||await context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});
    await worker.evaluate(async version=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}}),VERSION);

    await context.route('https://chatgpt.com/**',route=>{
      const req=route.request();
      if(req.resourceType()==='document'){
        return route.fulfill({
          status:200,
          contentType:'text/html; charset=utf-8',
          body:`<!doctype html><html lang="fr"><head><title>Fiber root hydration</title></head><body>
            <nav aria-label="Historique de chat"><a href="/">Nouveau chat</a><div>Projects</div></nav>
            <main><article><div data-message-author-role="assistant">Fixture</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              const dollar=String.fromCharCode(36);
              const root={tag:3,memoizedState:{isDehydrated:true},return:null,stateNode:{current:null},alternate:null};
              root.stateNode.current=root;
              const hosts=[document.documentElement,document.body,document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')];
              for(const node of hosts){
                const fiber={tag:5,memoizedState:{},return:root,alternate:null};
                Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:fiber,configurable:true});
              }
              window.__fiberRootReady=false;
              setTimeout(()=>{
                root.memoizedState.isDehydrated=false;
                window.__fiberRootReady=true;
                document.documentElement.dataset.hostRootSettled='1';
              },6500);
            <\/script>
          </body></html>`
        });
      }
      if(new URL(req.url()).pathname==='/api/auth/session')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/33333333-3333-4333-8333-333333333333',{waitUntil:'load',timeout:15000});

    await page.waitForTimeout(5000);
    const before=await page.evaluate(()=>({
      ready:window.__fiberRootReady===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      container:Object.getOwnPropertyNames(document).some(k=>k.startsWith('__reactContainer$'))
        ||Object.getOwnPropertyNames(document.documentElement).some(k=>k.startsWith('__reactContainer$'))
        ||Object.getOwnPropertyNames(document.body).some(k=>k.startsWith('__reactContainer$'))
    }));
    expect(before.ready).toBe(false);
    expect(before.proof).toBe('');
    expect(before.rail).toBe(false);
    expect(before.container).toBe(false);

    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.hostRootSettled||''),{timeout:5000}).toBe('1');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:12000})
      .toMatch(/^react-fiber-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:10000});

    const after=await page.evaluate(()=>({
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      container:Object.getOwnPropertyNames(document).some(k=>k.startsWith('__reactContainer$'))
        ||Object.getOwnPropertyNames(document.documentElement).some(k=>k.startsWith('__reactContainer$'))
        ||Object.getOwnPropertyNames(document.body).some(k=>k.startsWith('__reactContainer$'))
    }));
    expect(after.container).toBe(false);
    expect(after.proof).toMatch(/^react-fiber-root-settled/);
    expect(after.rail).toBe(true);
    console.log('HYDRATION_FIBER_ROOT_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
