import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const [icons,memoryUi]=await Promise.all(['sidebar-icons-v114.js','project-memory-ui-v132.js'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

try{
  await page.addInitScript(()=>{
    window.__hotQueries={sidebar:0,memory:0,status:0};
    const q=Document.prototype.querySelector;
    Document.prototype.querySelector=function(sel){
      const s=String(sel||'');
      if(s.includes('conversation-sidebar')||s==='nav')window.__hotQueries.sidebar++;
      if(s.includes('#ng90-control'))window.__hotQueries.memory++;
      return q.call(this,sel);
    };
    window.__NIAKGPT_PROJECT_MEMORY__={
      async status(){window.__hotQueries.status++;return{connected:false,configured:false,github:{authenticated:false,repositories:[]},prefs:{autoSync:true,injectOnNewChat:true},state:{}};},
      async startGitHub(){},async listRepositories(){return[];},async configure(){},async disconnect(){},async setPrefs(){},async syncNow(){}
    };
    window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.101'})}};
    window.__NIAKGPT_DIAGNOSTICS__={set(){}};
  });
  const html=`<!doctype html><html><body>
    <aside data-testid="conversation-sidebar">
      <a href="/">ChatGPT</a><a href="/search" aria-label="Rechercher">Rechercher</a>
    </aside>
    <div id="ng90-control"><div class="ng90-grid"></div></div>
    <main id="main"><article>Conversation</article></main>
  </body></html>`;
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:icons});
  await page.addScriptTag({content:memoryUi});
  await page.waitForTimeout(180);
  await page.evaluate(()=>{window.__hotQueries.sidebar=0;window.__hotQueries.memory=0;window.__hotQueries.status=0;});

  for(let i=0;i<14;i++){
    await page.evaluate(i=>{const n=document.createElement('span');n.textContent='stream '+i;document.getElementById('main').appendChild(n);},i);
    await page.waitForTimeout(12);
  }
  await page.waitForTimeout(120);
  let state=await page.evaluate(()=>structuredClone(window.__hotQueries));
  assert(state.sidebar===0,`sidebar-icons searched global sidebar during unrelated stream churn: ${JSON.stringify(state)}`);
  assert(state.memory===0&&state.status===0,`Project Memory UI woke during unrelated stream churn: ${JSON.stringify(state)}`);

  await page.evaluate(()=>{
    const old=document.querySelector('[data-testid="conversation-sidebar"]');
    const next=old.cloneNode(false);
    next.innerHTML='<a href="/">ChatGPT</a><button aria-label="Rechercher">Rechercher</button>';
    old.replaceWith(next);
  });
  await page.waitForTimeout(120);
  const iconState=await page.evaluate(()=>({
    marked:document.querySelector('[data-testid="conversation-sidebar"] button')?.dataset.ng114NavIcon||'',
    q:structuredClone(window.__hotQueries)
  }));
  assert(iconState.marked==='search',`sidebar remount no longer rebinds icons: ${JSON.stringify(iconState)}`);

  await page.evaluate(()=>{
    window.__hotQueries.status=0;
    const old=document.getElementById('ng90-control');old.remove();
    const next=document.createElement('div');next.id='ng90-control';next.className='open';next.innerHTML='<div class="ng90-grid"></div>';document.body.appendChild(next);
  });
  await page.waitForTimeout(180);
  const memState=await page.evaluate(()=>({
    memory:!!document.querySelector('#ng90-control [data-ng132-memory]'),
    status:window.__hotQueries.status
  }));
  assert(memState.memory&&memState.status>=1,`Project Memory control remount was not detected: ${JSON.stringify(memState)}`);

  console.log('global-observer-hotpath-v099: PASS');
}finally{
  await page.close();
  await browser.close();
}
