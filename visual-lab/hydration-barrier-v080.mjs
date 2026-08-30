import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const BOOT='boot-gate-v100.js';
const MODULES=[
  ['composer-continuation-v128.js','__NIAKGPT_PARALLEL_CONTINUE_128__'],
  ['long-run-watchdog-v129.js','__NIAKGPT_LONG_RUN_WATCHDOG_129__'],
  ['pin-interaction-rescue-v129.js','__NIAKGPT_PIN_INTERACTION_RESCUE_129__'],
  ['project-menu-augment-v129.js','__NIAKGPT_PROJECT_MENU_AUGMENT_129__'],
  ['continuity-native-handoff-v129.js','__NIAKGPT_NATIVE_HANDOFF_129__']
];
const orderedFiles=[BOOT,...MODULES.map(([file])=>file)];
const sources=Object.fromEntries(await Promise.all(orderedFiles.map(async file=>[file,await fs.readFile(path.join(ROOT,file),'utf8')])));
const manifestOrderedSource=orderedFiles.map(file=>sources[file]).join('\n;\n');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const selected=requested?{[requested]:engines[requested]}:engines;
if(requested&&!engines[requested])throw new Error('Unsupported NIAKGPT_BROWSER='+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [name,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const localData={};
      window.chrome={
        runtime:{
          id:'hydration-lab',
          getManifest:()=>({version:'0.9.83'}),
          sendMessage:async()=>({ok:true,errors:[]})
        },
        storage:{
          local:{
            get:async key=>{
              if(typeof key==='string')return {[key]:localData[key]};
              if(Array.isArray(key))return Object.fromEntries(key.map(k=>[k,localData[k]]));
              return {...localData};
            },
            set:async obj=>Object.assign(localData,obj),
            remove:async key=>{for(const k of Array.isArray(key)?key:[key])delete localData[k];}
          },
          onChanged:{addListener:()=>{}}
        }
      };
    });

    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:`<!doctype html><html lang="fr"><head><title>late scheduler hydration fixture</title></head>
      <body>
        <nav data-testid="conversation-sidebar" data-generation="ssr"><a href="/">Nouveau chat</a><div>Projects</div></nav>
        <main data-generation="ssr"><article><div data-message-author-role="assistant">SSR stable</div></article>
          <form><div id="prompt-textarea" contenteditable="true"></div><button aria-label="Envoyer" type="button">Envoyer</button></form>
        </main>
        <script>
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
        </script>
      </body></html>`
    }));

    await page.goto('https://chatgpt.com/c/hydration-fixture',{waitUntil:'load'});

    // Production 0.9.83 runs the JS content-script group at document_idle, never document_start.
    await page.addScriptTag({content:manifestOrderedSource});

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='1',null,{timeout:4000});
    const stage1=await page.evaluate(()=>({
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      rail:!!document.getElementById('ng8-rail'),
      generation:document.querySelector('nav')?.dataset.generation||''
    }));
    assert(stage1.generation==='react-1',name+': first late React replacement did not run');
    assert(stage1.hydrated===false&&!stage1.rail,name+': NiakGPT activated during the first false-calm scheduler window');

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='2',null,{timeout:5000});
    const stage2=await page.evaluate(()=>({
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      rail:!!document.getElementById('ng8-rail'),
      nav:document.querySelector('nav')?.dataset.generation||'',
      main:document.querySelector('main')?.dataset.generation||''
    }));
    assert(stage2.nav==='react-2'&&stage2.main==='react-2',name+': second late React replacement did not run');
    assert(stage2.hydrated===false&&!stage2.rail,name+': NiakGPT activated before late MessagePort hydration settled');

    await page.waitForFunction(()=>window.__NIAKGPT_HOST_HYDRATED_100__===true,null,{timeout:12000});
    await page.waitForFunction(()=>[
      window.__NIAKGPT_PARALLEL_CONTINUE_128__,
      window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
      window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
      window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
      window.__NIAKGPT_NATIVE_HANDOFF_129__
    ].every(Boolean),null,{timeout:2500});

    const active=await page.evaluate(()=>({
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      nav:document.querySelector('nav')?.dataset.generation||'',
      main:document.querySelector('main')?.dataset.generation||'',
      sentinels:[
        !!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
        !!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
        !!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
        !!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
        !!window.__NIAKGPT_NATIVE_HANDOFF_129__
      ]
    }));
    assert(active.hydrated&&active.nav==='react-2'&&active.main==='react-2',name+': activation did not wait for final host node identities');
    assert(active.sentinels.every(Boolean),name+': pre-runtime chain did not activate after host stability');
  }finally{
    await context.close();
    await browser.close();
  }
}

console.log('hydration-barrier-v080: PASS document_idle + late MessagePort host replacements + stable-node activation');
