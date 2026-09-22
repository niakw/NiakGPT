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
          getManifest:()=>({version:'0.9.107'}),
          sendMessage:async message=>{
            if(message?.type==='niakgpt:probe-react-hydration-v107'){
              const ownerRx=/^__react(?:Fiber|Props|Container)\$.+/;
              const containerRx=/^__reactContainer\$.+/;
              const identities=[document.querySelector('nav,aside'),document.querySelector('main'),document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(Boolean);
              let container=null;
              for(const node of [document,document.documentElement,document.body]){
                const key=node&&Object.getOwnPropertyNames(node).find(name=>containerRx.test(name));
                if(key&&node[key]){container=node[key];break;}
              }
              const current=container?.stateNode?.current||container;
              const candidates=[container,current,container?.alternate,current?.alternate].filter(Boolean);
              const needed=Math.min(2,identities.length);
              const htmlOwned=Object.getOwnPropertyNames(document.documentElement).some(key=>ownerRx.test(key));
              const bodyOwned=Object.getOwnPropertyNames(document.body).some(key=>ownerRx.test(key));
              return {ok:true,fullDocument:true,rootSettled:candidates.some(f=>f?.memoizedState?.isDehydrated===false),htmlOwned,bodyOwned,documentRootOwned:htmlOwned&&bodyOwned,needed,ownedCount:identities.filter(node=>Object.getOwnPropertyNames(node).some(key=>ownerRx.test(key))).length};
            }
            return {ok:true,errors:[]};
          }
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
      body:`<!doctype html><html lang="fr" data-build="prod-hydration-lab"><head><title>late scheduler hydration fixture</title></head>
      <body>
        <nav data-testid="conversation-sidebar" data-generation="ssr"><a href="/">Nouveau chat</a><div>Projects</div></nav>
        <main data-generation="ssr"><article><div data-message-author-role="assistant">SSR stable</div></article>
          <form><div id="prompt-textarea" contenteditable="true"></div><button aria-label="Envoyer" type="button">Envoyer</button></form>
        </main>
        <script>
          window.__reactRouterContext={streamController:{closed:true}};
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
              }
              if(tick===25){
                const dollar=String.fromCharCode(36);
                const rootFiber={memoizedState:{isDehydrated:true},stateNode:{current:null}};
                rootFiber.stateNode.current=rootFiber;
                Object.defineProperty(document,'__reactContainer'+dollar+'lab',{value:rootFiber,configurable:true});
                for(const node of [document.documentElement,document.body,document.querySelector('nav'),document.querySelector('main'),document.getElementById('prompt-textarea')]){
                  if(node)Object.defineProperty(node,'__reactFiber'+dollar+'lab',{value:{memoizedState:{}},configurable:true});
                }
                window.__hydratedAtReactMarkerOnly=window.__NIAKGPT_HOST_HYDRATED_100__===true;
                document.documentElement.dataset.lateHydrationStage='markers-only';
              }
              if(tick===55){
                window.__hydratedBeforeReactRootSettled=window.__NIAKGPT_HOST_HYDRATED_100__===true;
                const dollar=String.fromCharCode(36);
                const key=Object.getOwnPropertyNames(document).find(k=>k.startsWith('__reactContainer'+dollar));
                if(key&&document[key]?.memoizedState)document[key].memoizedState.isDehydrated=false;
                document.documentElement.dataset.lateHydrationStage='3';
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

    // Production JS runs at document_idle, but current ChatGPT hydrates the full HTML document
    // asynchronously. Stable node identities alone must not authorize DOM mutation.
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
      main:document.querySelector('main')?.dataset.generation||'',
      htmlNg:[...document.documentElement.attributes].map(a=>a.name).filter(name=>name.startsWith('data-ng')),
      bodyNg:[...document.body.attributes].map(a=>a.name).filter(name=>name.startsWith('data-ng')),
      ownNodes:document.querySelectorAll('[id^="ng8-"],[id^="ng90-"],[id^="ng100-"],[id^="ng119-"],[id^="ng123-"]').length
    }));
    assert(stage2.nav==='react-2'&&stage2.main==='react-2',name+': second late React replacement did not run');
    assert(stage2.hydrated===false&&!stage2.rail,name+': NiakGPT activated before late MessagePort hydration settled');
    assert(stage2.htmlNg.length===0&&stage2.bodyNg.length===0&&stage2.ownNodes===0,name+': NiakGPT mutated React-owned HTML before hydration ownership: '+JSON.stringify(stage2));

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='markers-only',null,{timeout:6000});
    const markerOnly=await page.evaluate(()=>({
      hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
      hydratedAtMarkerOnly:window.__hydratedAtReactMarkerOnly===true,
      htmlNg:[...document.documentElement.attributes].map(a=>a.name).filter(name=>name.startsWith('data-ng')),
      ownNodes:document.querySelectorAll('[id^="ng8-"],[id^="ng90-"],[id^="ng100-"],[id^="ng119-"],[id^="ng123-"]').length
    }));
    assert(!markerOnly.hydrated&&!markerOnly.hydratedAtMarkerOnly&&markerOnly.htmlNg.length===0&&markerOnly.ownNodes===0,name+': bare React ownership markers incorrectly unlocked NiakGPT before root hydration settled: '+JSON.stringify(markerOnly));

    await page.waitForFunction(()=>document.documentElement.dataset.lateHydrationStage==='3',null,{timeout:9000});
    const ownership=await page.evaluate(()=>{
      const dollar=String.fromCharCode(36);
      const key=Object.getOwnPropertyNames(document).find(k=>k.startsWith('__reactContainer'+dollar));
      return{
        hydratedBeforeRootSettled:window.__hydratedBeforeReactRootSettled===true,
        rootSettled:document[key]?.memoizedState?.isDehydrated===false,
        nav:Object.getOwnPropertyNames(document.querySelector('nav')).some(k=>k.startsWith('__reactFiber'+dollar)),
        main:Object.getOwnPropertyNames(document.querySelector('main')).some(k=>k.startsWith('__reactFiber'+dollar))
      };
    });
    assert(!ownership.hydratedBeforeRootSettled&&ownership.rootSettled&&ownership.nav&&ownership.main,name+': React root-dehydration gate did not precede NiakGPT activation: '+JSON.stringify(ownership));

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

console.log('hydration-barrier-v080: PASS MAIN-world React root isDehydrated=false + bare-marker rejection + zero pre-hydration DOM mutation + late MessagePort host replacements');
