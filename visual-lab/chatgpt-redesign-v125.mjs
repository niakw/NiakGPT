import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [ux,background,metadata,authority,icons]=await Promise.all([
  read('ux-v131.js'),
  read('background-v100.js'),
  read('sidebar-metadata-v118.js'),
  read('sidebar-projects-authority-v112.js'),
  read('sidebar-icons-v114.js')
]);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const runtime=background.slice(background.indexOf('const ISOLATED_RUNTIME=['),background.indexOf('const OPTIONAL_RUNTIME=['));
assert(runtime.indexOf("'ux-v131.js'")>=0,'ux-v131 missing from isolated runtime');
assert(runtime.indexOf("'ux-v131.js'")<runtime.indexOf("'sidebar-metadata-v118.js'"),'sidebar finder must initialize before metadata');
assert(metadata.includes('__NIAKGPT_FIND_SIDEBAR_V131__'),'metadata bypasses canonical sidebar finder');
assert(authority.includes('__NIAKGPT_FIND_SIDEBAR_V131__'),'Projects authority bypasses canonical sidebar finder');
assert(icons.includes('__NIAKGPT_FIND_SIDEBAR_V131__'),'sidebar icons bypass canonical sidebar finder');
assert(ux.includes('aria-roledescription*="sortable"'),'redesigned sortable sidebar signal missing');
assert(ux.includes('[role="navigation"]'),'semantic navigation candidate missing');

const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);

const project='g-p-aaaaaaaaaaaaaaaa';
const project2='g-p-bbbbbbbbbbbbbbbb';
const chat='11111111-1111-4111-8111-111111111111';

function sidebarMarkup(){
  return `
    <div id="primary"><a href="/">ChatGPT</a><a href="/search">Rechercher</a></div>
    <nav id="semantic-nav" role="navigation" aria-label="Navigation ChatGPT">
      <section aria-label="Épinglés" aria-roledescription="sortable">
        <div role="group" draggable="true"><a href="/c/${chat}">Conversation épinglée</a></div>
      </section>
      <section id="native-projects" aria-label="Projets" aria-roledescription="sortable">
        <div role="group" draggable="true"><a href="/g/${project}/project">Studio</a><button aria-label="Actions du projet">•••</button></div>
        <div role="group" draggable="true"><a href="/g/${project2}/project">Research</a><button aria-label="Actions du projet">•••</button></div>
      </section>
      <section aria-label="Récents" aria-roledescription="sortable">
        <div role="group" draggable="true"><a href="/c/22222222-2222-4222-8222-222222222222">Conversation récente</a></div>
      </section>
    </nav>`;
}

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{window.__NIAKGPT_SIDEBAR_PROJECTS_121__=true;window.__NIAKGPT_DIAGNOSTICS__={set(){}};});
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0}
      #left-shell{position:fixed;left:0;top:0;bottom:0;width:320px;background:#111;color:white;padding:8px;overflow:auto}
      #primary{width:100%;height:90px}#primary a{display:block;height:36px;color:white}
      #semantic-nav{margin-left:44px;width:244px;min-height:560px}
      #semantic-nav section{padding:8px 0}#semantic-nav a{display:block;min-height:32px;color:white}
      #ng8-pins{width:100%;min-height:72px;padding:8px}#ng8-pins a{display:block;min-height:32px;color:white}
      main{margin-left:340px;min-height:100vh;padding:30px}
    </style></head><body>
      <div id="left-shell">${sidebarMarkup()}<section id="ng8-pins"><a data-ng8-pin="1" href="/g/${project}/project">Studio</a><a data-ng8-pin="1" href="/g/${project2}/project">Research</a></section></div>
      <main><nav id="main-nav" role="navigation"><a href="/projects">Projects content navigation</a></nav><h1>Conversation</h1></main>
    </body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
    await page.goto(`https://chatgpt.com/g/${project}/c/${chat}`,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:ux});
    await page.waitForTimeout(180);

    const first=await page.evaluate(()=>({
      finder:window.__NIAKGPT_FIND_SIDEBAR_V131__?.()?.id||'',
      verified:document.getElementById('ng8-pins')?.dataset.ng131SidebarVerified||'',
      surface:document.documentElement.dataset.ng131Surface||'',
      pinsParent:document.getElementById('ng8-pins')?.parentElement?.id||''
    }));
    assert(first.finder==='left-shell',`${engine}: redesigned sidebar resolved to ${JSON.stringify(first)}`);
    assert(first.verified==='1',`${engine}: managed Projects were not verified in redesigned sidebar: ${JSON.stringify(first)}`);
    assert(first.surface==='conversation',`${engine}: project-chat route lost conversation surface: ${JSON.stringify(first)}`);
    assert(first.pinsParent==='left-shell',`${engine}: Projects moved into an inner sortable lane: ${JSON.stringify(first)}`);

    await page.evaluate(markup=>{
      const old=document.getElementById('semantic-nav');
      const host=document.createElement('div');
      host.innerHTML=markup;
      old.replaceWith(host.firstElementChild);
    },sidebarMarkup());
    await page.waitForTimeout(220);
    const remount=await page.evaluate(()=>({
      finder:window.__NIAKGPT_FIND_SIDEBAR_V131__?.()?.id||'',
      verified:document.getElementById('ng8-pins')?.dataset.ng131SidebarVerified||'',
      pinsParent:document.getElementById('ng8-pins')?.parentElement?.id||'',
      nativeProjects:document.querySelectorAll('#native-projects a[href*="/g/g-p-"]').length
    }));
    assert(remount.finder==='left-shell'&&remount.verified==='1'&&remount.pinsParent==='left-shell'&&remount.nativeProjects===2,
      `${engine}: SPA sidebar remount broke redesigned authority: ${JSON.stringify(remount)}`);
  }finally{
    await context.close();
    await browser.close();
  }
}
console.log(`chatgpt-redesign-v125: ${Object.keys(engines).join(',')} PASS`);
