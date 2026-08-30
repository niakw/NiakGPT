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
      window.__connectAttempt=0;
      window.__snapshot={ok:true,connected:false,configured:false,tokenAvailable:false,config:null,state:{mode:'disconnected'},prefs:{autoSync:true,injectOnNewChat:true}};
      window.__NIAKGPT_PROJECT_MEMORY__={
        status:async()=>structuredClone(window.__snapshot),
        connect:async options=>{
          window.__calls.push({type:'connect',options});
          window.__connectAttempt++;
          if(window.__connectAttempt===1)return{ok:false,error:'github_http_401:Bad credentials'};
          window.__snapshot={...window.__snapshot,connected:true,configured:true,tokenAvailable:true,config:{repo:options.repo,branch:options.branch,root:options.root,rememberToken:options.rememberToken},state:{mode:'connected'}};
          return{ok:true};
        },
        disconnect:async()=>({ok:true}),
        syncNow:async options=>{window.__calls.push({type:'sync',options});return{ok:true};},
        setPrefs:async prefs=>{window.__calls.push({type:'prefs',prefs});window.__snapshot.prefs=prefs;return prefs;}
      };
    });
    await page.addScriptTag({content:uiScript});
    await page.locator('#ng90-settings-btn').click();
    await page.locator('[data-ng132-memory]').waitFor();
    await page.locator('[data-ng132-connect]').evaluate(button=>{button.dataset.ngLabStable='1';});
    await page.waitForTimeout(240);
    assert(await page.locator('[data-ng132-connect]').getAttribute('data-ng-lab-stable')==='1','Project Memory form rerendered after initial mount/settings click');

    assert(await page.locator('[data-ng132-token]').getAttribute('type')==='password','GitHub token input is not password');
    const disclosure=await page.locator('[data-ng132-memory]').innerText();
    assert(/dépôt public NiakGPT/i.test(disclosure)&&/doit être privé/i.test(disclosure),'private repository disclosure missing');

    const repo=page.locator('[data-ng132-repo]');
    await repo.fill('niakw/private-memory-lab');
    await page.waitForTimeout(520);
    assert(await repo.inputValue()==='niakw/private-memory-lab','Project Memory UI rerendered while typing');

    await page.locator('[data-ng132-branch]').fill('main');
    await page.locator('[data-ng132-root]').fill('.niakgpt-memory');
    await page.locator('[data-ng132-token]').fill('synthetic-token-value');
    await page.locator('[data-ng132-remember]').check();
    await page.locator('[data-ng132-connect]').click();
    await page.waitForTimeout(150);
    let calls=await page.evaluate(()=>window.__calls);
    assert(calls.length===1&&calls[0].type==='connect','failed connect action not forwarded');
    assert(/Connexion refusée/.test(await page.locator('.ng132-memory-status').innerText()),'failed connect is invisible to the user');
    assert(await repo.inputValue()==='niakw/private-memory-lab','failed connect erased repository');
    assert(await page.locator('[data-ng132-branch]').inputValue()==='main','failed connect erased branch');
    assert(await page.locator('[data-ng132-root]').inputValue()==='.niakgpt-memory','failed connect erased root');
    assert(await page.locator('[data-ng132-token]').inputValue()==='synthetic-token-value','failed connect erased token');
    assert(await page.locator('[data-ng132-remember]').isChecked(),'failed connect erased remember preference');
    assert(/Réessayer la connexion/.test(await page.locator('[data-ng132-connect]').innerText()),'failed connect did not expose retry');

    await page.locator('[data-ng132-connect]').click();
    await page.waitForTimeout(150);
    calls=await page.evaluate(()=>window.__calls);
    assert(calls.length===2&&calls[1].type==='connect','retry connect action not forwarded');
    assert(calls[1].options.repo==='niakw/private-memory-lab','repository value lost');
    assert(calls[1].options.token==='synthetic-token-value','token value lost before background handoff');
    assert(calls[1].options.rememberToken===true,'remember-token preference lost');
    assert(await page.locator('[data-ng132-token]').inputValue()==='','token remained visible after successful connect');
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

  assert(errors.length===0,'browser errors: '+JSON.stringify(errors));
  console.log('project-memory-v132 '+requested+': PASS failed-connect-preserves-form+retry+private-ui+stable-input+synchronous-first-send+single-injection');
}finally{
  await context.close();
  await browser.close();
}
