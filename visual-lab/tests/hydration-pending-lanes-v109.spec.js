import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test,expect,chromium} from '@playwright/test';

const ROOT=path.resolve('..');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version;

test('NiakGPT stays zero-touch while React FiberRoot still has pending hydration work',async()=>{
  test.setTimeout(45000);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-pending-lanes-'));
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
      const req=route.request();
      if(req.resourceType()==='document')return route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        body:`<!doctype html><html lang="fr"><head><title>Pending lanes hydration</title></head><body>
          <nav aria-label="Historique de chat"><div>Projects</div></nav>
          <main><div data-message-author-role="assistant">Fixture</div>
            <div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div>
          </main>
          <script>
            window.__earlyNiakMutation=false;
            const niak=node=>node instanceof Element&&(/^ng/i.test(node.id||'')||[...node.attributes].some(a=>/^data-ng/i.test(a.name)));
            new MutationObserver(records=>{
              if(window.__pendingReactWorkCleared)return;
              for(const record of records){
                if(record.type==='attributes'&&/^data-ng/i.test(String(record.attributeName||'')))window.__earlyNiakMutation=true;
                for(const node of record.addedNodes||[])if(niak(node)||node.querySelector?.('[id^="ng"],[data-ng100]'))window.__earlyNiakMutation=true;
              }
            }).observe(document.documentElement,{subtree:true,childList:true,attributes:true});

            const dollar=String.fromCharCode(36);
            const fiberRoot={current:null,pendingLanes:32,suspendedLanes:32,pingedLanes:0,callbackNode:{pending:true}};
            const hostRoot={memoizedState:{isDehydrated:false},stateNode:fiberRoot};
            fiberRoot.current=hostRoot;
            Object.defineProperty(document,'__reactContainer'+dollar+'pending',{value:hostRoot,configurable:true});
            for(const node of [document.documentElement,document.body,document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')]){
              Object.defineProperty(node,'__reactFiber'+dollar+'pending',{value:{memoizedState:{}},configurable:true});
            }
            document.documentElement.dataset.hostRootSettled='1';
            setTimeout(()=>{
              fiberRoot.pendingLanes=0;
              fiberRoot.suspendedLanes=0;
              fiberRoot.callbackNode=null;
              window.__pendingReactWorkCleared=true;
              document.documentElement.dataset.pendingReactWorkCleared='1';
            },8500);
          <\/script>
        </body></html>`
      });
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/33333333-3333-4333-8333-333333333333',{waitUntil:'load'});
    await page.waitForTimeout(6500);
    const before=await page.evaluate(()=>({
      pendingCleared:!!window.__pendingReactWorkCleared,
      early:!!window.__earlyNiakMutation,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail')
    }));
    console.log('PENDING_LANES_BEFORE '+JSON.stringify(before));
    expect(before.pendingCleared).toBe(false);
    expect(before.early).toBe(false);
    expect(before.proof).toBe('');
    expect(before.rail).toBe(false);

    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.pendingReactWorkCleared||''),{timeout:5000}).toBe('1');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:12000}).toMatch(/^react-document-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:10000});
    console.log('HYDRATION_PENDING_LANES_CHECKPOINT PASS');
  }finally{
    await context.close().catch(()=>{});
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
