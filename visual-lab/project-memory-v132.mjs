import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const uiScript=await fs.readFile(path.join(ROOT,'project-memory-ui-v132.js'),'utf8');
const coreScript=await fs.readFile(path.join(ROOT,'project-memory-v132.js'),'utf8');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'chromium').trim();
if(!engines[requested])throw new Error('Unsupported browser '+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const browser=await engines[requested].launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:820},reducedMotion:'reduce'});
const errors=[];

async function newPage(){
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  return page;
}

try{
  {
    const page=await newPage();
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div></body></html>'
    }));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      window.__calls=[];
      window.__snapshot={
        ok:true,connected:false,configured:false,tokenAvailable:false,config:null,
        github:{authenticated:false,account:null,repositories:[],installations:[],manageUrl:''},
        state:{mode:'disconnected'},queue:{pending:[]},prefs:{autoSync:true,injectOnNewChat:true}
      };
      window.__NIAKGPT_PROJECT_MEMORY__={
        status:async()=>structuredClone(window.__snapshot),
        githubLogin:async()=>{
          window.__calls.push({type:'github-login'});
          window.__snapshot.github={
            authenticated:true,
            account:{login:'synthetic-user'},
            repositories:[
              {fullName:'synthetic-user/vault-one',defaultBranch:'main'},
              {fullName:'synthetic-user/vault-two',defaultBranch:'stable'}
            ],
            installations:[{id:42,manageUrl:'https://github.com/settings/installations/42'}],
            manageUrl:'https://github.com/settings/installations/42'
          };
          return{ok:true};
        },
        githubRepositories:async()=>{window.__calls.push({type:'repos-refresh'});return{ok:true};},
        githubConnectRepo:async options=>{
          window.__calls.push({type:'github-repo',options});
          window.__snapshot={
            ...window.__snapshot,connected:true,configured:true,tokenAvailable:true,
            config:{repo:options.repo,branch:options.branch,root:options.root,authMode:'github-app',rememberToken:false},
            state:{mode:'queued',queuedProjects:2,lastSyncAt:0},
            queue:{pending:['g-p-one','g-p-two'],force:false,at:Date.now()}
          };
          return{ok:true,bootstrapQueued:true,queuedProjects:2};
        },
        githubLogout:async()=>({ok:true}),
        connect:async()=>({ok:false,error:'manual-not-used'}),
        disconnect:async()=>({ok:true}),
        syncNow:async options=>{window.__calls.push({type:'sync',options});return{ok:true};},
        setPrefs:async prefs=>{window.__calls.push({type:'prefs',prefs});window.__snapshot.prefs=prefs;return prefs;}
      };
    });
    await page.addScriptTag({content:uiScript});
    await page.locator('[data-ng132-memory]').waitFor({timeout:3000});
    await page.locator('[data-ng132-github-login]').evaluate(button=>{button.dataset.ngLabStable='1';});
    await page.waitForTimeout(240);
    assert(await page.locator('[data-ng132-github-login]').getAttribute('data-ng-lab-stable')==='1','Project Memory GitHub form rerendered after initial mount/settings click');

    const disclosure=await page.locator('[data-ng132-memory]').innerText();
    assert(/Se connecter avec GitHub/i.test(disclosure),'GitHub login is not the primary Project Memory CTA');
    assert(/aucun nom de coffre, token ou secret/i.test(disclosure),'public/private repository isolation disclosure missing');

    await page.locator('[data-ng132-github-login]').click();
    await page.locator('[data-ng132-repo-select]').waitFor();
    assert(await page.locator('[data-ng132-repo-select] option').count()===2,'authorized repository picker did not expose expected repositories');
    assert(/@synthetic-user/.test(await page.locator('[data-ng132-memory]').innerText()),'authenticated GitHub account is not visible');

    await page.locator('[data-ng132-repo-select]').selectOption('synthetic-user/vault-two');
    assert(await page.locator('[data-ng132-app-branch]').inputValue()==='stable','repository default branch did not follow selection');
    await page.locator('[data-ng132-app-root]').fill('.niakgpt-memory');
    await page.locator('[data-ng132-use-repo]').click();
    await page.waitForTimeout(120);
    const calls=await page.evaluate(()=>window.__calls);
    const selection=calls.find(call=>call.type==='github-repo');
    assert(selection?.options?.repo==='synthetic-user/vault-two','chosen GitHub repository not forwarded');
    assert(selection?.options?.branch==='stable','chosen GitHub branch not forwarded');
    const connectedText=await page.locator('.ng132-memory-status').innerText();
    assert(/bootstrap/i.test(connectedText)&&/2 Project/.test(connectedText),'queued bootstrap state not visible after repository connection: '+connectedText);
    await page.close();
  }

  {
    const page=await newPage();
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-grid"></div></div></body></html>'
    }));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      window.__calls=[];
      window.__connectAttempt=0;
      window.__snapshot={ok:true,connected:false,configured:false,tokenAvailable:false,config:null,github:{authenticated:false,repositories:[]},state:{mode:'disconnected'},prefs:{autoSync:true,injectOnNewChat:true}};
      window.__NIAKGPT_PROJECT_MEMORY__={
        status:async()=>structuredClone(window.__snapshot),
        githubLogin:async()=>({ok:false,error:'synthetic'}),
        githubRepositories:async()=>({ok:true}),
        githubConnectRepo:async()=>({ok:false}),
        githubLogout:async()=>({ok:true}),
        connect:async options=>{
          window.__calls.push({type:'connect',options});
          window.__connectAttempt++;
          if(window.__connectAttempt===1)return{ok:false,error:'github_http_401:Bad credentials'};
          window.__snapshot={...window.__snapshot,connected:true,configured:true,tokenAvailable:true,config:{repo:options.repo,branch:options.branch,root:options.root,authMode:'pat',rememberToken:options.rememberToken},state:{mode:'connected'}};
          return{ok:true};
        },
        disconnect:async()=>({ok:true}),
        syncNow:async()=>({ok:true}),
        setPrefs:async prefs=>{window.__snapshot.prefs=prefs;return prefs;}
      };
    });
    await page.addScriptTag({content:uiScript});
    await page.locator('#ng90-settings-btn').click();
    await page.locator('.ng132-advanced summary').click();
    const repo=page.locator('[data-ng132-repo]');
    await repo.fill('synthetic-user/private-memory-lab');
    await page.locator('[data-ng132-branch]').fill('main');
    await page.locator('[data-ng132-root]').fill('.niakgpt-memory');
    await page.locator('[data-ng132-token]').fill('synthetic-token-value');
    await page.locator('[data-ng132-remember]').check();
    await page.locator('[data-ng132-connect]').click();
    await page.waitForTimeout(120);
    assert(/Connexion PAT refusée/.test(await page.locator('.ng132-memory-status').innerText()),'manual PAT failure is invisible');
    assert(await repo.inputValue()==='synthetic-user/private-memory-lab','failed PAT connect erased repository');
    assert(await page.locator('[data-ng132-token]').inputValue()==='synthetic-token-value','failed PAT connect erased token');
    await page.locator('[data-ng132-connect]').click();
    await page.waitForTimeout(120);
    const calls=await page.evaluate(()=>window.__calls);
    assert(calls.length===2&&calls[1].options.rememberToken===true,'manual PAT retry contract broken');
    assert(await page.locator('[data-ng132-token]').inputValue()==='','PAT remained visible after successful fallback connect');
    await page.close();
  }

  {
    const page=await newPage();
    const pid='g-p-lab0001';
    const checkpoint='# NiakGPT Project Memory — Lab\n\n## Open tasks / next actions\n\n- Verify private sync.\n\n## Architecture / invariants / constraints\n\n- One WORKER owns automatic sync.';
    await page.addInitScript(({pid,checkpoint})=>{
      const localData={
        'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:true},
        'niakgpt-project-memory-context-v132':{[pid]:{text:checkpoint,at:Date.now()}}
      };
      window.chrome={
        runtime:{lastError:null,sendMessage(message,cb){if(message.type==='niakgpt:memory-status-v132')cb({ok:true,connected:false,configured:false});else cb({ok:false,error:'not_connected'});}},
        storage:{
          local:{
            async get(keys){const list=Array.isArray(keys)?keys:[keys];const out={};for(const key of list)if(localData[key]!==undefined)out[key]=structuredClone(localData[key]);return out;},
            async set(obj){Object.assign(localData,structuredClone(obj));},
            async remove(keys){for(const key of (Array.isArray(keys)?keys:[keys]))delete localData[key];}
          },
          onChanged:{addListener(){}}
        }
      };
    },{pid,checkpoint});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><body><form class="composer"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button id="send" type="button" data-testid="send-button" aria-label="Envoyer">↑</button></form><main id="thread"></main></body></html>'
    }));
    await page.goto('https://chatgpt.com/g/'+pid+'/project',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      window.__sent=[];
      document.getElementById('send').addEventListener('click',()=>{
        const ed=document.getElementById('prompt-textarea');
        const text=ed.value;
        window.__sent.push(text);
        const turn=document.createElement('div');
        turn.setAttribute('data-message-author-role','user');
        turn.textContent=text;
        document.getElementById('thread').appendChild(turn);
        ed.value='';
        ed.dispatchEvent(new InputEvent('input',{bubbles:true}));
      });
    });
    await page.addScriptTag({content:coreScript});
    await page.waitForFunction(()=>window.__NIAKGPT_PROJECT_MEMORY__&&document.querySelector('#prompt-textarea'));
    await page.waitForTimeout(120);

    await page.locator('#prompt-textarea').fill('Continue la tâche actuelle.');
    await page.locator('#send').click();
    let sent=await page.evaluate(()=>window.__sent.slice());
    assert(sent.length===1,'native send observer did not run');
    assert(sent[0].startsWith('NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ'),'checkpoint was not injected before native send');
    assert(sent[0].includes('Verify private sync.'),'checkpoint content missing');
    assert(sent[0].includes('Continue la tâche actuelle.'),'user request lost');

    await page.locator('#prompt-textarea').fill('Deuxième message.');
    await page.locator('#send').click();
    sent=await page.evaluate(()=>window.__sent.slice());
    assert(sent[1]==='Deuxième message.','checkpoint leaked into a later prompt');
    await page.close();
  }

  {
    const page=await newPage();
    await page.addInitScript(()=>{
      const CACHE='niakgpt-v08-cache',PREFS='niakgpt-project-memory-prefs-v132';
      const localData={
        [CACHE]:{
          projects:[
            {id:'g-p-one',name:'One',href:'/g/g-p-one/project'},
            {id:'g-p-two',name:'Two',href:'/g/g-p-two/project'}
          ],
          chats:[],
          counts:{'g-p-one':4,'g-p-two':2},
          indexedProjectIds:['g-p-one','g-p-two']
        },
        [PREFS]:{autoSync:true,injectOnNewChat:true}
      };
      window.__localData=localData;
      const listeners=[];
      window.chrome={
        runtime:{
          lastError:null,
          sendMessage(message,cb){
            if(message.type==='niakgpt:memory-status-v132')cb({
              ok:true,connected:true,configured:true,tokenAvailable:true,
              config:{repo:'synthetic-user/private-vault',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}
            });
            else cb({ok:false,error:'not-used-in-bootstrap-queue-lab'});
          }
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return structuredClone(localData);
              const list=Array.isArray(keys)?keys:[keys],out={};
              for(const key of list)if(localData[key]!==undefined)out[key]=structuredClone(localData[key]);
              return out;
            },
            async set(obj){
              const changes={};
              for(const [key,value] of Object.entries(obj)){changes[key]={oldValue:localData[key],newValue:structuredClone(value)};localData[key]=structuredClone(value);}
              for(const fn of listeners)fn(changes,'local');
            },
            async remove(keys){for(const key of (Array.isArray(keys)?keys:[keys]))delete localData[key];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html><body><main>Configured private memory client tab</main></body></html>'
    }));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{document.documentElement.dataset.ng8TabRole='inactive';});
    await page.addScriptTag({content:coreScript});
    await page.waitForFunction(()=>Array.isArray(window.__localData?.['niakgpt-project-memory-queue-v132']?.pending),null,{timeout:3000});
    const recovered=await page.evaluate(()=>({
      queue:window.__localData['niakgpt-project-memory-queue-v132'],
      state:window.__localData['niakgpt-project-memory-state-v132']
    }));
    assert(recovered.queue.pending.length===2,'configured unsynced vault did not recreate persistent bootstrap queue');
    assert(recovered.queue.pending.includes('g-p-one')&&recovered.queue.pending.includes('g-p-two'),'bootstrap queue lost Project IDs');
    assert(recovered.state.mode==='queued'&&recovered.state.queuedProjects===2,'bootstrap recovery state is not visible/persistent');
    await page.close();
  }

  assert(errors.length===0,'browser errors: '+JSON.stringify(errors));
  console.log('project-memory-v132 '+requested+': PASS auto-render+github-picker+persistent-bootstrap-queue+manual-fallback+single-injection');
}finally{
  await context.close();
  await browser.close();
}
