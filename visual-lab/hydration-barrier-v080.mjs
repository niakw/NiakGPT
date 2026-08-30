import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const FILES=[
  ['composer-continuation-v128.js','__NIAKGPT_PARALLEL_CONTINUE_128__'],
  ['long-run-watchdog-v129.js','__NIAKGPT_LONG_RUN_WATCHDOG_129__'],
  ['pin-interaction-rescue-v129.js','__NIAKGPT_PIN_INTERACTION_RESCUE_129__'],
  ['project-menu-augment-v129.js','__NIAKGPT_PROJECT_MENU_AUGMENT_129__'],
  ['continuity-native-handoff-v129.js','__NIAKGPT_NATIVE_HANDOFF_129__']
];
const sources=Object.fromEntries(await Promise.all(FILES.map(async ([file])=>[file,await fs.readFile(path.join(ROOT,file),'utf8')])));
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
        runtime:{id:'hydration-lab',getManifest:()=>({version:'0.9.80'})},
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
    for(const [file] of FILES)await page.addInitScript({content:sources[file]});

    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="fr"><head><title>SSR hydration fixture</title></head><body><nav data-testid="conversation-sidebar"><a href="/">Nouveau chat</a><div>Projects</div></nav><main><article><div data-message-author-role="assistant">SSR stable</div></article><form><div id="prompt-textarea" contenteditable="true"></div><button aria-label="Envoyer" type="button">Envoyer</button></form></main></body></html>'
    }));

    await page.goto('https://chatgpt.com/c/hydration-fixture',{waitUntil:'domcontentloaded'});
    const before=await page.evaluate(()=>({
      html:document.documentElement.outerHTML,
      attrs:[...document.documentElement.attributes].map(a=>[a.name,a.value]),
      sentinels:{
        parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
        watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
        rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
        menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
        handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
      }
    }));
    await page.waitForTimeout(650);
    const blocked=await page.evaluate(()=>({
      html:document.documentElement.outerHTML,
      attrs:[...document.documentElement.attributes].map(a=>[a.name,a.value]),
      sentinels:{
        parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
        watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
        rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
        menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
        handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
      }
    }));

    assert(blocked.html===before.html,name+': pre-runtime mutated SSR DOM before hydration barrier');
    assert(JSON.stringify(blocked.attrs)===JSON.stringify(before.attrs),name+': html attributes changed before hydration barrier');
    assert(Object.values(blocked.sentinels).every(v=>v===false),name+': a pre-runtime initialized before hydration barrier');

    await page.evaluate(()=>{
      window.__NIAKGPT_HOST_HYDRATED_100__=true;
      window.dispatchEvent(new Event('niakgpt:host-hydrated-v100'));
    });
    await page.waitForTimeout(350);
    const active=await page.evaluate(()=>({
      parallel:!!window.__NIAKGPT_PARALLEL_CONTINUE_128__,
      watchdog:!!window.__NIAKGPT_LONG_RUN_WATCHDOG_129__,
      rescue:!!window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__,
      menu:!!window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__,
      handoff:!!window.__NIAKGPT_NATIVE_HANDOFF_129__
    }));
    assert(Object.values(active).every(v=>v===true),name+': hydration barrier did not activate all pre-runtime modules');
  }finally{
    await context.close();
    await browser.close();
  }
}

console.log('hydration-barrier-v080: PASS pre-runtime DOM immutability + post-hydration activation');
