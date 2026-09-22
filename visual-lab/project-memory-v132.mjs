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
const ARTIFACTS=path.join(process.cwd(),'artifacts','project-memory-v132',requested);
await fs.mkdir(ARTIFACTS,{recursive:true});
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
            state:{mode:'queued',queuedProjects:2,lastSyncAt:0,bootstrapCachedAt:Date.now(),bootstrapCachedProjects:2,bootstrapCachedFiles:7,pauseReason:'quiet'},
            queue:{pending:['g-p-one','g-p-two'],force:false,at:Date.now()}
          };
          return{ok:true,bootstrapQueued:true,queuedProjects:2,bootstrapWritten:true,bootstrapProjects:2,bootstrapFiles:7};
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
    assert(/Coffre écrit/i.test(connectedText)&&/2 Project/.test(connectedText)&&/7 fichier/.test(connectedText),'immediate cached GitHub snapshot state not visible after repository connection: '+connectedText);
    await page.close();
  }

  {
    const page=await newPage();
    await page.addInitScript(()=>{
      const localData={};
      const listeners=[];
      window.chrome={
        runtime:{
          id:'lopeiincnbjihmoahcbogokeniojgobk',
          lastError:null,
          sendMessage(message,cb){
            if(message.type==='niakgpt:memory-status-v132')cb({ok:true,connected:false,configured:false,tokenAvailable:false,github:{authenticated:false,repositories:[]},state:{mode:'disconnected'}});
            else cb({ok:false,error:'not_connected'});
          },
          connect(){throw new Error('Extension context invalidated.');}
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return structuredClone(localData);
              const list=Array.isArray(keys)?keys:[keys],out={};
              for(const key of list)if(localData[key]!==undefined)out[key]=structuredClone(localData[key]);
              return out;
            },
            async set(obj){Object.assign(localData,structuredClone(obj));},
            async remove(keys){for(const key of (Array.isArray(keys)?keys:[keys]))delete localData[key];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><body><button id="ng90-settings-btn">Réglages</button><div id="ng90-control" class="open"><div class="ng90-card"><div class="ng90-grid"></div></div></div></body></html>'
    }));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:coreScript});
    await page.waitForFunction(()=>window.__NIAKGPT_PROJECT_MEMORY__);
    await page.addScriptTag({content:uiScript});
    await page.locator('[data-ng132-memory]').waitFor({timeout:3000});
    const button=page.locator('[data-ng132-github-login]');
    await button.click();
    await page.waitForTimeout(120);
    const authFailure=await page.locator('[data-ng132-memory]').innerText();
    assert(/Contexte NiakGPT expiré/i.test(authFailure),'invalidated extension context did not become an actionable GitHub login error');
    assert(await button.isEnabled(),'GitHub login button stayed disabled after extension-context failure');
    assert(/Recharger l’onglet puis réessayer/i.test(await button.innerText()),'GitHub login CTA stayed stuck on Ouverture de GitHub');
    await page.screenshot({path:path.join(ARTIFACTS,'github-context-invalidated-recovery.png'),fullPage:true});
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
            else if(message.type==='niakgpt:memory-commit-v132')cb({ok:true,sha:'synthetic-bootstrap'});
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
    assert(Number(recovered.state.bootstrapCachedAt||0)>0&&recovered.state.bootstrapCachedProjects===2&&recovered.state.bootstrapCachedFiles===7,'configured vault did not immediately persist local-cache bootstrap metadata');
    await page.close();
  }

  {
    const page=await newPage();
    await page.addInitScript(()=>{
      const CACHE='niakgpt-v08-cache',PREFS='niakgpt-project-memory-prefs-v132';
      const localData={
        [CACHE]:{
          schema:2,
          projects:[{id:'g-p-alpha',name:'Workspace Alpha',href:'/g/g-p-alpha/project',domOnly:false}],
          chats:[{id:'chat-alpha',title:'Alpha thread',projectId:'g-p-alpha',updated:Date.now()-1000}],
          counts:{'g-p-alpha':1},
          indexedProjectIds:['g-p-alpha'],
          serverIndexedAt:0
        },
        [PREFS]:{autoSync:false,injectOnNewChat:true},
        'niakgpt-governance-v085':{seeded:true,manualCoreSelection:false,coreProjectIds:['g-p-alpha'],hiddenProjectIds:[],locks:{}}
      };
      const catalog=[
        {id:'g-p-alpha',name:'Workspace Alpha',conversationCount:1,knownConversationCount:1,indexed:true},
        {id:'g-p-beta',name:'Workspace Beta',conversationCount:7,knownConversationCount:7,indexed:true},
        {id:'g-p-gamma',name:'Workspace Gamma',conversationCount:3,knownConversationCount:4,indexed:true},
        {id:'g-p-delta',name:'Workspace Delta',conversationCount:2,knownConversationCount:2,indexed:true}
      ];
      const listeners=[];window.__localData=localData;window.__commits=[];
      const clone=value=>value===undefined?undefined:structuredClone(value);
      window.chrome={
        runtime:{
          lastError:null,
          sendMessage(message,cb){
            const reply=value=>queueMicrotask(()=>cb(value));
            if(message.type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private-vault',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(message.type==='niakgpt:memory-catalog-v132')return reply({ok:true,repoPrivate:true,source:'vault-project-directories',projectCount:catalog.length,projects:clone(catalog)});
            if(message.type==='niakgpt:memory-read-v132')return reply({ok:false,error:'github_http_404:not_found'});
            if(message.type==='niakgpt:memory-commit-v132'){window.__commits.push(clone({files:message.files,message:message.message}));return reply({ok:true,sha:'catalog-bootstrap-'+window.__commits.length});}
            if(message.type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:false,error:'not-needed'});
            return reply({ok:false,error:'unexpected:'+message.type});
          }
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return clone(localData);
              if(typeof keys==='string')return localData[keys]===undefined?{}:{[keys]:clone(localData[keys])};
              const list=Array.isArray(keys)?keys:Object.keys(keys||{}),out={};
              for(const key of list)if(localData[key]!==undefined)out[key]=clone(localData[key]);
              return out;
            },
            async set(obj){
              const changes={};
              for(const[key,value]of Object.entries(obj||{})){changes[key]={oldValue:clone(localData[key]),newValue:clone(value)};localData[key]=clone(value);}
              for(const fn of listeners)fn(changes,'local');
            },
            async remove(keys){for(const key of(Array.isArray(keys)?keys:[keys]))delete localData[key];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html><body><main>Cold local Project cache</main></body></html>'
    }));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{document.documentElement.dataset.ng8TabRole='inactive';});
    await page.addScriptTag({content:coreScript});
    await page.waitForFunction(()=>window.__localData?.['niakgpt-v08-cache']?.projects?.length===4,null,{timeout:4000});
    await page.waitForFunction(()=>Number(window.__localData?.['niakgpt-project-memory-state-v132']?.bootstrapCachedProjects||0)===4,null,{timeout:4000});
    await page.waitForFunction(()=>window.__localData?.['niakgpt-governance-v085']?.coreProjectIds?.length===4,null,{timeout:4000});
    const recovered=await page.evaluate(()=>{
      const cache=window.__localData['niakgpt-v08-cache'],commits=window.__commits||[];
      const root=commits.flatMap(commit=>commit.files||[]).find(file=>file.path==='PROJECTS.json');
      return{
        ids:(cache.projects||[]).map(p=>p.id),
        serverIndexedAt:Number(cache.serverIndexedAt||0),
        vaultCount:Number(cache.vaultCatalogCount||0),
        core:[...(window.__localData['niakgpt-governance-v085']?.coreProjectIds||[])],
        manualCoreSelection:window.__localData['niakgpt-governance-v085']?.manualCoreSelection,
        diag:window.__diag?.['project-memory-catalog']||'',
        root:root?JSON.parse(root.content):null
      };
    });
    assert(recovered.ids.length===4&&recovered.ids.includes('g-p-delta'),'cold local cache did not recover durable vault Project catalog: '+JSON.stringify(recovered));
    assert(recovered.vaultCount===4,'recovered catalog high-water marker missing');
    assert(recovered.serverIndexedAt===0,'vault recovery falsely claimed a complete current server index');
    assert(recovered.core.length===4&&recovered.manualCoreSelection===false,'classification governance stayed collapsed at one Project: '+JSON.stringify(recovered));
    assert(recovered.root?.projectCount===4,'cached bootstrap rewrote durable PROJECTS.json from the collapsed one-Project cache');
    assert(recovered.root.projects.every(row=>!('description'in row)&&!('instructions'in row)),'cached Project inventory leaked private Project content');
    await page.close();
  }

  {
    const page=await newPage();
    const pid='g-p-lab0001',slug=pid+'-niakgpt',current='current-chat-0001',historical='historical-chat-0002';
    await page.addInitScript(({pid,current,historical})=>{
      const localData={
        'niakgpt-v08-cache':{
          schema:2,
          projects:[{id:pid,name:'Memory Lab',href:'/g/'+pid+'/project'}],
          chats:[{id:historical,title:'Historical cached chat',projectId:pid,updated:Date.now()-5000}],
          counts:{[pid]:2},indexedProjectIds:[pid]
        },
        'niakgpt-project-memory-prefs-v132':{autoSync:false,injectOnNewChat:true}
      };
      const listeners=[];window.__commits=[];window.__pageRpc=[];
      const clone=value=>value===undefined?undefined:structuredClone(value);
      window.chrome={
        runtime:{
          lastError:null,
          sendMessage(message,cb){
            const reply=value=>queueMicrotask(()=>cb(value));
            if(message.type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(message.type==='niakgpt:memory-read-v132')return reply({ok:false,error:'github_http_404:not_found'});
            if(message.type==='niakgpt:memory-commit-v132'){window.__commits.push(clone({files:message.files,message:message.message}));return reply({ok:true,sha:'commit-'+window.__commits.length});}
            if(message.type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:true,authenticated:true,transport:'extension-background'});
            if(message.type==='niakgpt:memory-chatgpt-fetch-v132'){
              const id=String(message.path||'').split('/').at(-1);
              if(id!==historical)return reply({ok:false,status:404,error:'chatgpt_memory_http_404'});
              return reply({ok:true,status:200,transport:'extension-background',data:{
                title:'Historical cached chat',update_time:Date.now()/1000,current_node:'a2',mapping:{
                  a1:{id:'a1',parent:null,message:{author:{role:'user'},content:{parts:['historical user request']},create_time:Date.now()/1000-2}},
                  a2:{id:'a2',parent:'a1',message:{author:{role:'assistant'},content:{parts:['historical assistant answer']},create_time:Date.now()/1000-1}}
                }
              }});
            }
            return reply({ok:false,error:'unexpected:'+message.type});
          }
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return clone(localData);
              if(typeof keys==='string')return{[keys]:clone(localData[keys])};
              if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>localData[k]!==undefined).map(k=>[k,clone(localData[k])]));
              if(keys&&typeof keys==='object')return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,localData[k]===undefined?v:clone(localData[k])]));
              return{};
            },
            async set(obj){const changes={};for(const[k,v]of Object.entries(obj||{})){changes[k]={oldValue:clone(localData[k]),newValue:clone(v)};localData[k]=clone(v);}for(const fn of listeners)fn(changes,'local');},
            async remove(keys){for(const k of(Array.isArray(keys)?keys:[keys]))delete localData[k];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      document.addEventListener('niakgpt:rpc-request',event=>window.__pageRpc.push(clone(event.detail||{})));
    },{pid,current,historical});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html><body><main><article data-testid="conversation-turn-1"><div data-message-author-role="user">current user message</div></article><article data-testid="conversation-turn-2"><div data-message-author-role="assistant">current assistant answer</div></article></main></body></html>'
    }));
    await page.goto('https://chatgpt.com/g/'+slug+'/c/'+current,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{document.documentElement.dataset.ng8TabRole='worker';document.documentElement.dataset.ng86Activity='ready';});
    await page.addScriptTag({content:coreScript});
    await page.waitForFunction(()=>window.__NIAKGPT_PROJECT_MEMORY__);
    const result=await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.syncNow({force:true}));
    assert(result.ok===true,'active-chat background history sync failed: '+JSON.stringify(result));
    const evidence=await page.evaluate(()=>({commits:window.__commits,rpc:window.__pageRpc,transport:document.documentElement.dataset.ng132HistoryTransport||''}));
    const files=evidence.commits.flatMap(commit=>commit.files||[]),paths=files.map(file=>String(file.path||''));
    assert(paths.some(path=>path.includes('/conversations/'+current+'/part-001.md')),'slugged current Project route did not archive visible DOM: '+JSON.stringify(paths));
    assert(paths.some(path=>path.includes('/conversations/'+historical+'/part-001.md')),'active chat did not archive cached history through extension background: '+JSON.stringify(paths));
    assert(evidence.commits.some(commit=>/live DOM Memory Lab/.test(commit.message)),'current DOM archive commit missing');
    assert(evidence.commits.some(commit=>/Memory Lab \/ Historical cached chat/.test(commit.message)),'historical background archive commit missing');
    assert(evidence.rpc.length===0,'active-chat history sync escaped into page RPC broker: '+JSON.stringify(evidence.rpc));
    assert(evidence.transport==='background','active-chat history transport was not marked background: '+evidence.transport);
    await page.close();
  }

  assert(errors.length===0,'browser errors: '+JSON.stringify(errors));
  console.log('project-memory-v132 '+requested+': PASS auto-render+github-picker+invalid-context-recovery+immediate-cache-bootstrap+persistent-history-queue+active-chat-background-history+slugged-dom-capture+manual-fallback+single-injection');
}finally{
  await context.close();
  await browser.close();
}
