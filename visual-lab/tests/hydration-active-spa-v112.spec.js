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

async function removeProfile(dir){
  if(EXECUTABLE&&process.platform==='darwin')await sleep(220);
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:120});
}
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

test('settled recovered HostRoot boots while active SPA keeps non-structural DOM activity alive',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-active-spa-'));
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
          body:`<!doctype html><html lang="fr"><head><title>Active SPA hydration recovery</title></head><body>
            <nav aria-label="Historique de chat"><button type="button">Nouveau chat</button></nav>
            <main><article id="live-activity"><div data-message-author-role="assistant">Recovered app</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              const dollar=String.fromCharCode(36);
              const root={tag:3,memoizedState:{},return:null,stateNode:{current:null},alternate:null};
              root.stateNode.current=root;
              const attach=node=>{if(node)Object.defineProperty(node,'__reactFiber'+dollar+'active',{value:{tag:5,memoizedState:{},return:root,alternate:null},configurable:true});};
              attach(document.querySelector('nav'));attach(document.querySelector('main'));attach(document.getElementById('prompt-textarea'));
              window.__activeSpaTicks=0;
              window.__activeSpaTimer=setInterval(()=>{
                window.__activeSpaTicks+=1;
                const el=document.getElementById('live-activity');
                if(el)el.dataset.liveTick=String(window.__activeSpaTicks);
              },120);
              window.addEventListener('load',()=>{
                window.dispatchEvent(new ErrorEvent('error',{message:'Minified React error #418; recovered HTML hydration mismatch'}));
              },{once:true});
            <\/script>
          </body></html>`
        });
      }
      if(new URL(req.url()).pathname==='/api/auth/session')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/66666666-6666-4666-8666-666666666666',{waitUntil:'load',timeout:15000});

    await expect.poll(()=>page.evaluate(()=>window.__activeSpaTicks||0),{timeout:3000}).toBeGreaterThan(5);

    // A recovered, settled HostRoot must be enough to boot even when the active SPA keeps
    // performing unrelated subtree/attribute updates. Global DOM silence is not a valid
    // prerequisite for a continuously updating ChatGPT application.
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:12000}).toMatch(/^react-fiber-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:12000});

    const state=await page.evaluate(()=>({
      ticks:window.__activeSpaTicks||0,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail')
    }));
    expect(state.ticks).toBeGreaterThan(20);
    expect(state.rail).toBe(true);
    console.log('HYDRATION_ACTIVE_SPA_V112_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    await removeProfile(dir);
  }
});
