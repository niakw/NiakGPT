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

test('settled HostRoot cannot unlock NiakGPT before late MessagePort commits drain',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-scheduler-drain-'));
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
          body:`<!doctype html><html lang="fr"><head><title>Scheduler drain</title></head><body>
            <nav aria-label="Historique de chat" data-generation="ssr"><button id="native-action" type="button">Native action</button></nav>
            <main data-generation="ssr"><article><div data-message-author-role="assistant">Fixture</div></article>
              <form><div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true"></div><button type="button" aria-label="Envoyer">Envoyer</button></form>
            </main>
            <script>
              window.__lateSchedulerDone=false;
              window.__earlyNiakMutation=false;
              const dollar=String.fromCharCode(36);
              const root={tag:3,memoizedState:{},return:null,stateNode:{current:null},alternate:null};
              root.stateNode.current=root;
              const attach=node=>{if(node)Object.defineProperty(node,'__reactFiber'+dollar+'page',{value:{tag:5,memoizedState:{},return:root,alternate:null},configurable:true});};
              const attachHosts=()=>{attach(document.querySelector('nav'));attach(document.querySelector('main'));attach(document.getElementById('prompt-textarea'));};
              attachHosts();
              const niakNode=node=>node instanceof Element && (/^ng/i.test(node.id||'') || [...node.attributes].some(a=>/^data-ng/i.test(a.name)));
              const observer=new MutationObserver(records=>{
                if(window.__lateSchedulerDone)return;
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
              window.addEventListener('load',()=>{
                const channel=new MessageChannel();
                let tick=0;
                channel.port1.onmessage=()=>{
                  tick+=1;
                  if(tick===9){
                    window.dispatchEvent(new ErrorEvent('error',{message:'Minified React error #418; late MessagePort hydration at HTML'}));
                    const old=document.querySelector('nav'),next=old.cloneNode(true);
                    next.dataset.generation='late-1';old.replaceWith(next);attach(next);
                    document.documentElement.dataset.schedulerStage='late-1';
                  }
                  if(tick===19){
                    const old=document.querySelector('main'),next=old.cloneNode(true);
                    next.dataset.generation='late-2';old.replaceWith(next);
                    attach(next);attach(next.querySelector('#prompt-textarea'));
                    document.documentElement.dataset.schedulerStage='late-2';
                  }
                  if(tick===26){
                    window.__lateSchedulerDone=true;
                    document.documentElement.dataset.schedulerStage='done';
                    return;
                  }
                  setTimeout(()=>channel.port2.postMessage('react-work'),150);
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
    await page.goto('https://chatgpt.com/c/55555555-5555-4555-8555-555555555555',{waitUntil:'load',timeout:15000});

    await page.waitForFunction(()=>document.documentElement.dataset.schedulerStage==='late-1',null,{timeout:5000});
    const first=await page.evaluate(()=>({
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      generation:document.querySelector('nav')?.dataset.generation||''
    }));
    expect(first.generation).toBe('late-1');
    expect(first.early).toBe(false);
    expect(first.proof).toBe('');
    expect(first.rail).toBe(false);

    await page.waitForFunction(()=>document.documentElement.dataset.schedulerStage==='late-2',null,{timeout:5000});
    const second=await page.evaluate(()=>({
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail'),
      generation:document.querySelector('main')?.dataset.generation||''
    }));
    expect(second.generation).toBe('late-2');
    expect(second.early).toBe(false);
    expect(second.proof).toBe('');
    expect(second.rail).toBe(false);

    await page.waitForFunction(()=>window.__lateSchedulerDone===true,null,{timeout:6000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng100HydrationProof||''),{timeout:12000}).toMatch(/^react-fiber-root-settled/);
    await expect(page.locator('#ng8-rail')).toBeAttached({timeout:12000});
    const after=await page.evaluate(()=>({
      early:window.__earlyNiakMutation===true,
      proof:document.documentElement.dataset.ng100HydrationProof||'',
      rail:!!document.getElementById('ng8-rail')
    }));
    expect(after.early).toBe(false);
    expect(after.rail).toBe(true);
    console.log('HYDRATION_SCHEDULER_DRAIN_V111_CHECKPOINT PASS');
  }finally{
    await closePersistentContext(context);
    await removeProfile(dir);
  }
});
