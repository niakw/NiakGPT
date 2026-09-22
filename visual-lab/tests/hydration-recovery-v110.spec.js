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

test('recoverable React hydration fallback without isDehydrated flag still boots NiakGPT',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-hydration-recovery-'));
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
          body:`<!doctype html><html lang="fr"><head><title>Hydration recovery</title></head><body>
            <nav aria-label="Historique de chat"><button id="native-action" type="button">Native action</button></nav>
            <main><article><div data-message-author-role="assistant">Fixture</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              window.__earlyNiakMutation=false;
              window.__hostRecovered=false;
              const niakNode=node=>node instanceof Element && (/^ng/i.test(node.id||'') || [...node.attributes].some(a=>/^data-ng/i.test(a.name)));
              const observer=new MutationObserver(records=>{
                if(window.__hostRecovered)return;
                for(const record of records){
                  if(record.type==='attributes'){
                    const name=String(record.attributeName||'');
                    if(/^data-ng/i.test(name) || (record.target===document.body&&name==='class'&&/\\bng/i.test(document.body.className)))window.__earlyNiakMutation=true;
                  }
                  for(const node of record.addedNodes||[]){
                    if(niakNode(node) || (node instanceof Element&&node.querySelector?.('[id^="ng"],[data-ng8],[data-ng90],[data-ng100],[data-ng119],[data-ng123],[data-ng128],[data-ng129]')))window.__earlyNiakMutation=true;
                  }
                }
              });
              observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});

              const dollar=String.fromCharCode(36);
              const stale={tag:3,memoizedState:{isDehydrated:true},return:null,stateNode:{current:null},alternate:null};
              const root={tag:3,memoizedState:{isDehydrated:true},return:null,stateNode:{current:null},alternate:stale};
              stale.alternate=root;stale.stateNode.current=root;root.stateNode.current=root;
              for(const node of [document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')]){
                Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:{tag:5,memoizedState:{},return:root,alternate:null},configurable:true});
              }
              setTimeout(()=>{
                window.dispatchEvent(new ErrorEvent('error',{message:'Minified React error #418; hydration mismatch at HTML'}));
              },120);
              setTimeout(()=>{
                root.memoizedState={};
                window.__hostRecovered=true;
                document.documentElement.dataset.hostRecovered='1';
              },1400);
            <\/script>
          </body></html>`
        });
      }
      if(new URL(req.url()).pathname==='/api/auth/session')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/44444444-4444-4444-8444-444444444444',{waitUntil:'load',timeout:15000});
    await page.locator('#native-action').click();
    await page.waitForTimeout(600);

    const before=await page.evaluate(()=>({
      recovered:window.__hostRecovered===true,
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      htmlFiber:Object.getOwnPropertyNames(document.documentElement).some(k=>k.startsWith('__reactFiber$')),
      bodyFiber:Object.getOwnPropertyNames(document.body).some(k=>k.startsWith('__reactFiber$'))
    }));
    expect(before.recovered).toBe(false);
    expect(before.early).toBe(false);
    expect(before.proof).toBe('');
    expect(before.rail).toBe(false);
    expect(before.htmlFiber).toBe(false);
    expect(before.bodyFiber).toBe(false);

    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.hostRecovered||''),{timeout:4000}).toBe('1');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:8000})
      .toMatch(/^react-fiber-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:8000});

    const after=await page.evaluate(()=>({
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      htmlFiber:Object.getOwnPropertyNames(document.documentElement).some(k=>k.startsWith('__reactFiber$')),
      bodyFiber:Object.getOwnPropertyNames(document.body).some(k=>k.startsWith('__reactFiber$')),
      probe:JSON.parse(sessionStorage.getItem('niakgpt-hydration-probe-v109')||'null')
    }));
    expect(after.early).toBe(false);
    expect(after.htmlFiber).toBe(false);
    expect(after.bodyFiber).toBe(false);
    expect(after.proof).toMatch(/^react-fiber-root-settled/);
    expect(after.rail).toBe(true);
    console.log('HYDRATION_RECOVERY_V110_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    await removeProfile(dir);
  }
});
