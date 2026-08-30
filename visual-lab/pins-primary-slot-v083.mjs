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
  chats:[
    {id:'11111111-1111-4111-8111-111111111111',title:'Alpha chat',projectId:'g-p-alpha',updated:Date.now()}
  ],
  counts:{'g-p-alpha':1,'g-p-beta':0},
  indexedProjectIds:['g-p-alpha','g-p-beta']
};

for(const [engine,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  try{
    for(const scenario of ['hidden-native-above-primary','visible-native-after-primary']){
      const context=await browser.newContext({viewport:{width:1200,height:800}});
      const page=await context.newPage();
      try{
        await page.addInitScript(cache=>{
          const local={'niakgpt-v08-cache':cache,'niakgpt-governance-v085':{hiddenProjectIds:[],coreProjectIds:[]}};
          window.chrome={
            storage:{
              local:{
                async get(keys){
                  const list=Array.isArray(keys)?keys:[keys];
                  return Object.fromEntries(list.filter(k=>k&&local[k]!==undefined).map(k=>[k,structuredClone(local[k])]));
                }
              },
              onChanged:{addListener(){}}
            }
          };
          window.__NIAKGPT_DIAGNOSTICS__={set(){}};
        },cache);

        const hidden=scenario==='hidden-native-above-primary';
        const native=hidden
          ? '<section id="native-projects" data-ng112-native-projects="1" style="display:none"><h3>Projects</h3><a href="/g/g-p-alpha/project">Alpha native</a></section>'
          : '<section id="native-projects" data-ng112-native-projects="1"><h3>Projects</h3><a href="/g/g-p-alpha/project">Alpha native</a><a href="/g/g-p-beta/project">Beta native</a></section>';
        const body=hidden
          ? native+'<div id="primary"><a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/apps">Plugins</a></div><section id="recents"><a href="/c/11111111-1111-4111-8111-111111111111">Recent</a></section>'
          : '<div id="primary"><a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/apps">Plugins</a></div>'+native+'<section id="recents"><a href="/c/11111111-1111-4111-8111-111111111111">Recent</a></section>';

        await page.route('https://chatgpt.com/**',route=>route.fulfill({
          status:200,
          contentType:'text/html; charset=utf-8',
          body:'<!doctype html><html><head><style>body{margin:0}.sidebar{position:fixed;left:0;top:0;width:310px;height:780px;display:block;background:#111;color:#eee}.sidebar>section,.sidebar>div{display:block;padding:8px}.sidebar a{display:block;height:32px}</style></head><body><aside class="sidebar" data-testid="conversation-sidebar">'+body+'</aside><main style="margin-left:340px">Chat</main></body></html>'
        }));
        await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
        await page.addScriptTag({content:source});
        await page.waitForFunction(()=>document.querySelector('#ng8-pins')?.dataset.ng121PlacementReady==='1',null,{timeout:5000});

        const state=await page.evaluate(()=>{const box=document.getElementById('ng8-pins');return{
          mode:box?.dataset.ng121Placement||'',
          previous:box?.previousElementSibling?.id||'',
          next:box?.nextElementSibling?.id||'',
          parent:box?.parentElement?.getAttribute('data-testid')||box?.parentElement?.id||'',
          pins:box?.querySelectorAll('a[data-ng8-pin="1"]').length||0,
          primaryTop:document.getElementById('primary')?.getBoundingClientRect().top||0,
          boxTop:box?.getBoundingClientRect().top||0,
          nativeDisplay:getComputedStyle(document.getElementById('native-projects')).display
        };});

        assert(state.pins===2,engine+'/'+scenario+': managed Projects missing');
        assert(state.parent==='conversation-sidebar',engine+'/'+scenario+': Pins mounted outside sidebar');
        assert(state.boxTop>=state.primaryTop,engine+'/'+scenario+': Pins rendered above native ChatGPT navigation');
        if(hidden){
          assert(state.mode==='after-primary',engine+': hidden native Projects surface wrongly won placement: '+JSON.stringify(state));
          assert(state.previous==='primary'&&state.next==='recents',engine+': hidden-above-primary case not placed after native controls: '+JSON.stringify(state));
          assert(state.nativeDisplay==='none',engine+': hidden fixture drift');
        }else{
          assert(state.mode==='native-projects',engine+': visible native Projects slot after primary was not used: '+JSON.stringify(state));
          assert(state.previous==='primary'&&state.next==='native-projects',engine+': visible native slot ordering wrong: '+JSON.stringify(state));
        }
      }finally{await context.close();}
    }
  }finally{await browser.close();}
}
console.log('pins-primary-slot-v083: PASS hidden-above-primary rejected + native controls remain above Pins');
