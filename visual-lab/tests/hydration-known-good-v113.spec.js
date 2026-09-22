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

test('field-proven scheduler barrier boots without private React internals',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-known-good-'));
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
          body:`<!doctype html><html lang="fr"><head><title>Known-good boot boundary</title></head><body>
            <nav aria-label="Historique de chat" data-generation="ssr"><button type="button">Nouveau chat</button></nav>
            <main data-generation="ssr"><article><div data-message-author-role="assistant">SSR stable</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              window.__earlyNiakMutation=false;
              const niakNode=node=>node instanceof Element && (
                /^ng(?:8|90|100|119|123)-/.test(node.id||'') ||
                [...(node.attributes||[])].some(a=>a.name.startsWith('data-ng'))
              );
              const observer=new MutationObserver(records=>{
                if(document.documentElement.dataset.lateHydrationStage==='2')return;
                for(const record of records){
                  if(record.type==='attributes'&&niakNode(record.target))window.__earlyNiakMutation=true;
                  for(const node of record.addedNodes||[])if(niakNode(node)||node.querySelector?.('[id^="ng8-"],[id^="ng90-"],[id^="ng100-"],[id^="ng119-"],[id^="ng123-"]'))window.__earlyNiakMutation=true;
                }
              });
              observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});
              window.addEventListener('load',()=>{
                const channel=new MessageChannel();
                let tick=0;
                channel.port1.onmessage=()=>{
                  tick+=1;
                  if(tick===7){
                    const old=document.querySelector('nav');
                    const next=old.cloneNode(true);
                    next.dataset.generation='react-1';
                    old.replaceWith(next);
                    document.documentElement.dataset.lateHydrationStage='1';
                  }
                  if(tick===17){
                    const oldNav=document.querySelector('nav');
                    const nextNav=oldNav.cloneNode(true);
                    nextNav.dataset.generation='react-2';
                    oldNav.replaceWith(nextNav);
                    const oldMain=document.querySelector('main');
                    const nextMain=oldMain.cloneNode(true);
                    nextMain.dataset.generation='react-2';
                    oldMain.replaceWith(nextMain);
                    document.documentElement.dataset.lateHydrationStage='2';
                    return;
                  }
                  setTimeout(()=>channel.port2.postMessage('react-work'),120);
                };
                channel.port2.postMessage('react-work');
              },{once:true});
            <\/script>
          </body></html>`
        });
      }
      if(new URL(req.url()).pathname==='/api/auth/session')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=context.pages()[0]||await context.newPage();
    await page.goto('https://chatgpt.com/c/77777777-7777-4777-8777-777777777777',{waitUntil:'load',timeout:15000});

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='1',null,{timeout:5000});
    const stage1=await page.evaluate(()=>({
      rail:!!document.getElementById('ng8-rail'),
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      early:window.__earlyNiakMutation===true,
      nav:document.querySelector('nav')?.dataset.generation||''
    }));
    expect(stage1).toEqual({rail:false,hydrated:false,early:false,nav:'react-1'});

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='2',null,{timeout:6000});
    const stage2=await page.evaluate(()=>({
      rail:!!document.getElementById('ng8-rail'),
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      early:window.__earlyNiakMutation===true,
      nav:document.querySelector('nav')?.dataset.generation||'',
      main:document.querySelector('main')?.dataset.generation||''
    }));
    expect(stage2).toEqual({rail:false,hydrated:false,early:false,nav:'react-2',main:'react-2'});

    await expect.poll(()=>page.evaluate(()=>window.__NIAKGPT_HOST_HYDRATED_100__===true),{timeout:15000}).toBe(true);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:12000});
    const final=await page.evaluate(()=>({
      rail:!!document.getElementById('ng8-rail'),
      nav:document.querySelector('nav')?.dataset.generation||'',
      main:document.querySelector('main')?.dataset.generation||'',
      privateReactKeys:[document,document.documentElement,document.body,document.querySelector('nav'),document.querySelector('main')]
        .filter(Boolean).flatMap(node=>Object.getOwnPropertyNames(node)).filter(key=>/^__react(?:Fiber|Props|Container)\$/.test(key)).length
    }));
    expect(final).toEqual({rail:true,nav:'react-2',main:'react-2',privateReactKeys:0});
    console.log('HYDRATION_KNOWN_GOOD_V113_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    await removeProfile(dir);
  }
});
