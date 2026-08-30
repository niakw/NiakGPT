import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const source=await fs.readFile(path.join(ROOT,'project-memory-ui-v132.js'),'utf8');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const selected=requested?{[requested]:engines[requested]}:engines;
if(requested&&!engines[requested])throw new Error('Unsupported NIAKGPT_BROWSER='+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1000,height:760}});
    const page=await context.newPage();
    try{
      await page.route('https://chatgpt.com/**',route=>route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        body:'<!doctype html><html><body><button id="ng90-settings-btn">Settings</button><aside id="ng90-control" class="open"><div class="ng90-grid"></div></aside></body></html>'
      }));
      await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
      await page.evaluate(()=>{
        window.__snapshot={
          ok:true,connected:true,configured:true,tokenAvailable:true,
          config:{repo:'synthetic/private-vault',branch:'main',root:'.niakgpt-memory',authMode:'github-app',rememberToken:false},
          github:{registered:true,authenticated:true,account:{login:'synthetic'},repositories:[{fullName:'synthetic/private-vault',defaultBranch:'main'}],installations:[],manageUrl:''},
          state:{mode:'queued',queuedProjects:2,lastSyncAt:0},
          queue:{pending:['g-p-one','g-p-two'],force:false,at:Date.now()},
          prefs:{autoSync:true,injectOnNewChat:true}
        };
        const ok=async()=>({ok:true});
        window.__NIAKGPT_PROJECT_MEMORY__={
          status:async()=>structuredClone(window.__snapshot),
          githubLogin:ok,githubRepositories:ok,githubConnectRepo:ok,githubLogout:ok,
          connect:ok,disconnect:ok,syncNow:ok,
          setPrefs:async p=>p
        };
      });
      await page.addScriptTag({content:source});
      await page.locator('[data-ng132-memory] [data-ng132-app-root]').waitFor();
      await page.evaluate(()=>{
        const input=document.querySelector('[data-ng132-app-root]');
        input.value='.custom-root';input.dataset.ng084Identity='stable';input.focus();window.__ng084MemoryInput=input;
      });

      await page.evaluate(()=>{
        window.__snapshot.state={mode:'syncing',projectDone:0,projectTotal:2,projectName:'One',chatTitle:'First chat',chatDone:1,chatTotal:4,lastSyncAt:0};
        document.dispatchEvent(new CustomEvent('niakgpt:project-memory-state',{detail:window.__snapshot.state}));
      });
      await page.waitForTimeout(140);
      let state=await page.evaluate(()=>{
        const input=document.querySelector('[data-ng132-app-root]');
        return{same:input===window.__ng084MemoryInput,identity:input?.dataset.ng084Identity||'',value:input?.value||'',focused:document.activeElement===input,status:document.querySelector('.ng132-memory-status b')?.textContent||''};
      });
      assert(state.same&&state.identity==='stable'&&state.value==='.custom-root'&&state.focused,engine+': live sync state rebuilt/destroyed the GitHub controls: '+JSON.stringify(state));
      assert(/Synchronisation/.test(state.status),engine+': live status did not update in place');

      await page.evaluate(()=>{
        window.__snapshot.connected=false;
        window.__snapshot.tokenAvailable=false;
        window.__snapshot.github.authenticated=false;
        window.__snapshot.state={mode:'queued',queuedProjects:2,lastSyncAt:0};
        document.dispatchEvent(new CustomEvent('niakgpt:project-memory-state',{detail:window.__snapshot.state}));
      });
      await page.waitForTimeout(140);
      state=await page.evaluate(()=>{
        const input=document.querySelector('[data-ng132-app-root]');
        return{same:input===window.__ng084MemoryInput,repoPicker:!!document.querySelector('[data-ng132-repo-select]'),login:!!document.querySelector('[data-ng132-github-login]'),value:input?.value||''};
      });
      assert(state.same&&state.repoPicker&&!state.login&&state.value==='.custom-root',engine+': configured GitHub App controls vanished during transient token/session state: '+JSON.stringify(state));
    }finally{await context.close();}
  }finally{await browser.close();}
}
console.log('project-memory-ui-stability-v084: PASS GitHub controls keep DOM identity + survive transient auth refresh state');
