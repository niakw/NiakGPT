import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version;

test('real MV3 boot reads React hydration from MAIN world without user interaction',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-hydration-main-world-'));
  const context=await chromium.launchPersistentContext(dir,{
    headless:true,
    channel:'chromium',
    viewport:{width:1280,height:820},
    args:[`--disable-extensions-except=${ROOT}`,`--load-extension=${ROOT}`,'--disable-background-mode','--no-first-run','--no-default-browser-check']
  });
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
          body:`<!doctype html><html lang="fr" data-build="prod-main-world-probe"><head><title>NiakGPT hydration isolation</title></head><body>
            <nav aria-label="Historique de chat"><a href="/">Nouveau chat</a><div>Projects</div></nav>
            <main><article><div data-message-author-role="assistant">Fixture</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              window.__reactRouterContext={streamController:{closed:true}};
              const dollar=String.fromCharCode(36);
              const rootFiber={memoizedState:{isDehydrated:true},stateNode:{current:null}};
              rootFiber.stateNode.current=rootFiber;
              Object.defineProperty(document,'__reactContainer'+dollar+'page',{value:rootFiber,configurable:true});
              for(const node of [document.documentElement,document.body,document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')]){
                if(node)Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:{memoizedState:{}},configurable:true});
              }
              setTimeout(()=>{
                rootFiber.memoizedState.isDehydrated=false;
                document.documentElement.dataset.hostRootSettled='1';
              },900);
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
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'load',timeout:15000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.hostRootSettled||''),{timeout:4000}).toBe('1');

    // No click/key/touch is performed: production boot must succeed from the service-worker
    // MAIN-world probe, not from the trusted-interaction fallback.
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:15000})
      .toMatch(/^react-main-world-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:10000});

    const state=await page.evaluate(()=>({
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      pageContainer:Object.getOwnPropertyNames(document).some(k=>k.startsWith('__reactContainer$')),
      pageNavFiber:Object.getOwnPropertyNames(document.querySelector('nav')).some(k=>k.startsWith('__reactFiber$'))
    }));
    expect(state.pageContainer).toBe(true);
    expect(state.pageNavFiber).toBe(true);
    expect(state.proof).toMatch(/^react-main-world-settled/);
    expect(state.rail).toBe(true);
  }finally{
    await context.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
