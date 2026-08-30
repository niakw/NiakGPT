import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const source=await fs.readFile(path.join(ROOT,'sidebar-projects-v121.js'),'utf8');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const selected=requested?{[requested]:engines[requested]}:engines;
if(requested&&!engines[requested])throw new Error('Unsupported NIAKGPT_BROWSER='+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const cache={
  schema:2,
  projects:[
    {id:'g-p-alpha',name:'Alpha',href:'/g/g-p-alpha/project'},
    {id:'g-p-beta',name:'Beta',href:'/g/g-p-beta/project'}
  ],
  chats:[],counts:{'g-p-alpha':1,'g-p-beta':1},indexedProjectIds:['g-p-alpha','g-p-beta']
};

for(const [engine,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1200,height:800}});
    const page=await context.newPage();
    try{
      await page.addInitScript(cache=>{
        const local={'niakgpt-v08-cache':cache,'niakgpt-governance-v085':{hiddenProjectIds:[],coreProjectIds:[]}};
        window.chrome={
          storage:{
            local:{
              async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>k&&local[k]!==undefined).map(k=>[k,structuredClone(local[k])]));}
            },
            onChanged:{addListener(){}}
          }
        };
        window.__NIAKGPT_DIAGNOSTICS__={set(){}};
      },cache);
      await page.route('https://chatgpt.com/**',route=>route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        body:'<!doctype html><html><head><style>body{margin:0}.sidebar{position:fixed;left:0;top:0;width:310px;height:780px;display:block;background:#111;color:#eee}.sidebar>section,.sidebar>div{display:block;padding:8px}.sidebar a{display:block;height:32px}</style></head><body><aside class="sidebar" data-testid="conversation-sidebar"></aside><main style="margin-left:340px">Chat</main></body></html>'
      }));
      await page.goto('https://chatgpt.com/c/late-hydration',{waitUntil:'domcontentloaded'});
      await page.addScriptTag({content:source});
      await page.waitForTimeout(220);
      assert(await page.locator('#ng8-pins').count()===0,engine+': Projects mounted before native primary navigation existed');

      await page.evaluate(()=>{
        const root=document.querySelector('[data-testid="conversation-sidebar"]');
        const primary=document.createElement('div');primary.id='primary';
        primary.innerHTML='<a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/apps">Apps</a>';
        root.appendChild(primary);
      });
      await page.waitForFunction(()=>document.querySelector('#ng8-pins')?.dataset.ng121PlacementReady==='1');
      let state=await page.evaluate(()=>{
        const root=document.querySelector('[data-testid="conversation-sidebar"]'),box=document.getElementById('ng8-pins'),primary=document.getElementById('primary');
        window.__ng084FirstBox=box;
        return{mode:box?.dataset.ng121Placement||'',previous:box?.previousElementSibling?.id||'',rootLast:root?.lastElementChild?.id||'',primaryBottom:primary?.getBoundingClientRect().bottom||0,boxTop:box?.getBoundingClientRect().top||0};
      });
      assert(state.mode==='after-primary',engine+': late primary controls did not become authoritative: '+JSON.stringify(state));
      assert(state.previous==='primary'&&state.rootLast==='ng8-pins',engine+': Projects not mounted directly after hydrated native controls: '+JSON.stringify(state));
      assert(state.boxTop>=state.primaryBottom-4,engine+': Projects still above primary navigation after hydration');

      await page.evaluate(()=>{
        const root=document.querySelector('[data-testid="conversation-sidebar"]'),box=document.getElementById('ng8-pins');
        const native=document.createElement('section');native.id='native-projects';
        native.innerHTML='<h3>Projects</h3><a href="/g/g-p-alpha/project">Alpha native</a><a href="/g/g-p-beta/project">Beta native</a>';
        root.insertBefore(native,box);
      });
      await page.waitForFunction(()=>document.getElementById('ng8-pins')&&document.getElementById('ng8-pins')!==window.__ng084FirstBox&&document.getElementById('ng8-pins').nextElementSibling?.id==='native-projects');
      state=await page.evaluate(()=>{
        const box=document.getElementById('ng8-pins'),old=window.__ng084FirstBox;
        return{
          mode:box?.dataset.ng121Placement||'',
          next:box?.nextElementSibling?.id||'',
          oldRetired:old?.dataset.ng121Retired||'',
          oldHidden:!!old?.hidden,
          same:old===box,
          pins:box?.querySelectorAll('a[data-ng8-pin="1"]').length||0
        };
      });
      assert(state.mode==='native-projects'&&state.next==='native-projects',engine+': later native Projects slot did not win: '+JSON.stringify(state));
      assert(!state.same&&state.oldRetired==='1'&&state.oldHidden,engine+': old node was moved instead of retired/remounted: '+JSON.stringify(state));
      assert(state.pins===2,engine+': remounted catalogue lost Projects');
    }finally{await context.close();}
  }finally{await browser.close();}
}
console.log('pins-late-hydration-v084: PASS waits for native controls + retires/remounts when the authoritative Projects slot appears');
