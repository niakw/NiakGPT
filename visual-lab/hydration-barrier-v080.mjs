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
          getManifest:()=>({version:'0.9.80'}),
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
    // Match manifest order in one init script: boot gate first, then every pre-runtime module.
    await page.addInitScript({content:manifestOrderedSource});

    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><head><title>SSR hydration fixture</title></head><body><nav data-testid="conversation-sidebar"><a href="/">Nouveau chat</a><div>Projects</div></nav><main><article><div data-message-author-role="assistant">SSR stable</div></article><form><div id="prompt-textarea" contenteditable="true"></div><button aria-label="Envoyer" type="button">Envoyer</button></form></main></body></html>'
    }));

    await page.goto('https://chatgpt.com/c/hydration-fixture',{waitUntil:'domcontentloaded'});
    const before=await page.evaluate(()=>({
      html:document.documentElement.outerHTML,
      attrs:[...document.documentElement.attributes].map(a=>[a.name,a.value]),
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      sentinels:{
        parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
        watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
        rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
        menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
        handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
      }
    }));

    // The boot gate requires a 650ms quiet window + frames + 120ms. At 420ms the SSR DOM
    // must still be byte-for-byte untouched by every NiakGPT document_start script.
    await page.waitForTimeout(420);
    const blocked=await page.evaluate(()=>({
      html:document.documentElement.outerHTML,
      attrs:[...document.documentElement.attributes].map(a=>[a.name,a.value]),
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      sentinels:{
        parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
        watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
        rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
        menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
        handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
      }
    }));

    assert(blocked.html===before.html,name+': document_start runtime mutated SSR DOM before hydration barrier');
    assert(JSON.stringify(blocked.attrs)===JSON.stringify(before.attrs),name+': html attributes changed before hydration barrier');
    assert(blocked.hydrated===false,name+': boot gate opened hydration barrier before its quiet window');
    assert(Object.values(blocked.sentinels).every(v=>v===false),name+': a pre-runtime initialized before host hydration');

    await page.waitForFunction(()=>window.__NIAKGPT_HOST_HYDRATED_100__===true,null,{timeout:5000});
    await page.waitForFunction(()=>[
      window.__NIAKGPT_PARALLEL_CONTINUE_128__,
      window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
      window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
      window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
      window.__NIAKGPT_NATIVE_HANDOFF_129__
    ].every(Boolean),null,{timeout:1500});

    const active=await page.evaluate(()=>({
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
      watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
      rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
      menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
      handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
    }));
    assert(active.hydrated&&Object.values(active).every(v=>v===true),name+': host hydration did not activate the full pre-runtime chain');
  }finally{
    await context.close();
    await browser.close();
  }
}

console.log('hydration-barrier-v080: PASS manifest-order SSR immutability + boot-gate activation');
