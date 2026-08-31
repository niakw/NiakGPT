import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const source=await fs.readFile(path.join(ROOT,'sidebar-projects-v121.js'),'utf8');
const authority=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.js'),'utf8');
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
        window.chrome={storage:{local:{async get(keys){const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(k=>k&&local[k]!==undefined).map(k=>[k,structuredClone(local[k])]));}},onChanged:{addListener(){}}}};
        window.__NIAKGPT_DIAGNOSTICS__={set(){}};
      },cache);
      await page.route('https://chatgpt.com/**',route=>route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        body:'<!doctype html><html><head><style>body{margin:0}.sidebar{position:fixed;left:0;top:0;width:310px;height:780px;display:block;background:#111;color:#eee}.sidebar>div,.sidebar>section{display:block;padding:8px}.sidebar a{display:block;height:32px}</style></head><body><aside class="sidebar" data-testid="conversation-sidebar"><div id="primary"><a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a></div><div id="project-launcher-row"><a id="project-launcher" href="/projects">Projects</a></div><div id="recent"><a href="/c/recent">Conversation récente</a></div></aside><main style="margin-left:340px">Chat</main></body></html>'
      }));
      await page.goto('https://chatgpt.com/c/launcher-only',{waitUntil:'domcontentloaded'});
      await page.addScriptTag({content:source});
      await page.addScriptTag({content:authority});
      await page.waitForFunction(()=>document.querySelector('#ng8-pins')?.dataset.ng121PlacementReady==='1');
      await page.waitForFunction(()=>!!document.querySelector('[data-ng112-native-projects="1"]'));
      const state=await page.evaluate(()=>{
        const box=document.getElementById('ng8-pins'),launcher=document.getElementById('project-launcher');
        const marked=launcher?.closest('[data-ng112-native-projects="1"]')||null;
        const sameParent=!!box&&!!marked&&box.parentElement===marked.parentElement;
        const adjacent=sameParent&&(box.nextElementSibling===marked||marked.nextElementSibling===box);
        return{
          mode:box?.dataset.ng121Placement||'',
          header:box?.querySelector('.ng8-pin-head span')?.textContent||'',
          pins:box?.querySelectorAll('a[data-ng8-pin="1"]').length||0,
          launcherLinks:[...document.querySelectorAll('a[href*="/g/g-p-"]')].filter(a=>!a.closest('#ng8-pins,[data-ng121-retired="1"]')).length,
          launcherMarked:!!marked,
          adjacent,
          boxVisible:!!box&&box.isConnected&&!box.hidden&&getComputedStyle(box).display!=='none'
        };
      });
      assert(state.launcherLinks===0,engine+': fixture unexpectedly hydrated individual Projects');
      assert(['native-projects','native-projects-launcher'].includes(state.mode),engine+': visible /projects launcher was not authoritative: '+JSON.stringify(state));
      assert(state.launcherMarked,engine+': native Projects launcher was not identified for suppression: '+JSON.stringify(state));
      assert(state.adjacent,engine+': Pins are not adjacent to the native Projects authority slot: '+JSON.stringify(state));
      assert(state.boxVisible,engine+': custom Pins block is not visible: '+JSON.stringify(state));
      assert(/PINS\s*·\s*PROJECTS/i.test(state.header),engine+': explicit Pins identity missing: '+JSON.stringify(state));
      assert(state.pins===2,engine+': cached Pins did not render from launcher-only state: '+JSON.stringify(state));
    }finally{await context.close();}
  }finally{await browser.close();}
}
console.log('pins-launcher-only-v085: PASS native /projects launcher mounts explicit Pins before individual Project hydration');
