import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const ROOT=path.resolve('..');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version;
const EXECUTABLE=String(process.env.NIAKGPT_EXECUTABLE_PATH||'').trim();
const HEADLESS=String(process.env.NIAKGPT_HEADLESS||'1')!=='0';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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

test('NiakGPT waits for HostRoot settlement without requiring HTML/BODY React expandos',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-document-root-hydration-'));
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
      const request=route.request();
      if(request.resourceType()==='document'){
        return route.fulfill({
          status:200,
          contentType:'text/html; charset=utf-8',
          body:`<!doctype html><html lang="fr" data-build="prod-document-root-probe"><head><title>NiakGPT document root hydration</title></head><body>
            <nav aria-label="Historique de chat"><a href="/">Nouveau chat</a><div>Projects</div></nav>
            <main><article><div data-message-author-role="assistant">Fixture</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              window.__reactRouterContext={streamController:{closed:true}};
              window.__documentRootClaimed=false;
              window.__earlyNiakMutation=false;
              const niakNode=node=>node instanceof Element && (/^ng/i.test(node.id||'') || [...node.attributes].some(a=>/^data-ng/i.test(a.name)));
              const observer=new MutationObserver(records=>{
                if(document.documentElement.dataset.hostRootSettled==='1')return;
                for(const record of records){
                  if(record.type==='attributes'){
                    const name=String(record.attributeName||'');
                    if(/^data-ng/i.test(name) || (record.target===document.body&&name==='class'&&/\\bng/i.test(document.body.className))){
                      window.__earlyNiakMutation=true;
                    }
                  }
                  for(const node of record.addedNodes||[]){
                    if(niakNode(node) || (node instanceof Element&&node.querySelector?.('[id^="ng"],[data-ng8],[data-ng90],[data-ng100],[data-ng119],[data-ng123],[data-ng128],[data-ng129]'))){
                      window.__earlyNiakMutation=true;
                    }
                  }
                }
              });
              observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});

              const dollar=String.fromCharCode(36);
              const rootFiber={tag:3,memoizedState:{isDehydrated:true},stateNode:{current:null},return:null,alternate:null};
              rootFiber.stateNode.current=rootFiber;
              Object.defineProperty(document,'__reactContainer'+dollar+'page',{value:rootFiber,configurable:true});
              for(const node of [document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')]){
                if(node)Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:{tag:5,memoizedState:{},return:rootFiber,alternate:null},configurable:true});
              }
              setTimeout(()=>{
                rootFiber.memoizedState.isDehydrated=false;
                document.documentElement.dataset.hostRootSettled='1';
              },700);
              setTimeout(()=>{
                for(const node of [document.documentElement,document.body]){
                  Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:{tag:5,memoizedState:{},return:rootFiber,alternate:null},configurable:true});
                }
                window.__documentRootClaimed=true;
                document.documentElement.dataset.documentRootClaimed='1';
              },6500);
            <\/script>
          </body></html>`
        });
      }
      if(new URL(request.url()).pathname==='/api/auth/session'){
        return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      }
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/22222222-2222-4222-8222-222222222222',{waitUntil:'load',timeout:15000});
    await page.waitForTimeout(300);
    const beforeSettle=await page.evaluate(()=>({
      settled:document.documentElement.dataset.hostRootSettled||'',
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail')
    }));
    expect(beforeSettle.settled).toBe('');
    expect(beforeSettle.early).toBe(false);
    expect(beforeSettle.proof).toBe('');
    expect(beforeSettle.rail).toBe(false);

    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.hostRootSettled||''),{timeout:3000}).toBe('1');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:6000})
      .toMatch(/^react-document-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:6000});

    const afterSettle=await page.evaluate(()=>({
      claimed:window.__documentRootClaimed===true,
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      htmlFiber:Object.getOwnPropertyNames(document.documentElement).some(k=>k.startsWith('__reactFiber$')),
      bodyFiber:Object.getOwnPropertyNames(document.body).some(k=>k.startsWith('__reactFiber$'))
    }));
    expect(afterSettle.claimed).toBe(false);
    expect(afterSettle.early).toBe(false);
    expect(afterSettle.htmlFiber).toBe(false);
    expect(afterSettle.bodyFiber).toBe(false);
    expect(afterSettle.proof).toMatch(/^react-document-root-settled/);
    expect(afterSettle.rail).toBe(true);
    console.log('HYDRATION_DOCUMENT_ROOT_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    await removeProfile(dir);
  }
});
