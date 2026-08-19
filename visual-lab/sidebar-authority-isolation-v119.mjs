import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const authorityJs=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.js'),'utf8');
const authorityCss=await fs.readFile(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    const html=`<!doctype html><html><head><style>
      *{box-sizing:border-box}body{margin:0;font-family:Arial}
      #left{position:fixed;left:0;top:0;bottom:0;width:310px;padding:10px;background:#111}
      #left-overlay{position:fixed;left:12px;top:560px;width:280px;height:120px;padding:10px;background:#ddd;color:#111}
      #left-search{position:fixed;left:14px;top:690px;width:278px;height:100px;padding:10px;background:#ccc;color:#111}
      #separate-native{position:fixed;left:8px;top:800px;width:292px;height:90px;padding:8px;background:#222;color:#fff}
      #right{position:fixed;right:0;top:0;bottom:0;width:300px;padding:10px;background:#222}
      main{margin:0 320px;padding:20px}
      #native-projects,#recents,#ng8-pins{padding:8px;margin:6px 0;border:1px solid #555}
    </style></head><body>
      <aside id="left" data-testid="conversation-sidebar">
        <section id="native-projects" class="sidebar-expando-section project-section">
          <h3>Projects</h3>
          <a href="/g/g-p-one/project">One</a><a href="/g/g-p-two/project">Two</a><button>Afficher plus</button>
        </section>
        <section id="recents"><h3>Récents</h3><a href="/c/c1">Recent chat</a></section>
        <section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-one/project"><span>One</span></a><a data-ng8-pin="1" href="/g/g-p-two/project"><span>Two</span></a></section>
      </aside>
      <aside id="left-overlay"><button id="left-unrelated-projects">Projects</button><a href="/help">Help</a></aside>
      <aside id="left-search"><h3>Search results</h3><a id="search-project-result" href="/g/g-p-one/project">One</a></aside>
      <aside id="separate-native"><h3>Projects</h3><a href="/g/g-p-one/project">One</a><a href="/g/g-p-two/project">Two</a></aside>
      <main><button id="main-projects">Projects</button></main>
      <aside id="right"><button id="unrelated-projects">Projects</button><a href="/help/projects">Project help</a></aside>
    </body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:authorityCss});
    await page.addScriptTag({content:authorityJs});
    await page.waitForTimeout(140);

    const snapshot=()=>page.evaluate(()=>({
      native:document.getElementById('native-projects')?.getAttribute('data-ng112-native-projects')||'',
      separateNative:document.getElementById('separate-native')?.getAttribute('data-ng112-native-projects')||'',
      recents:document.getElementById('recents')?.getAttribute('data-ng112-native-projects')||'',
      unrelated:document.getElementById('unrelated-projects')?.getAttribute('data-ng112-native-projects')||'',
      leftUnrelated:document.getElementById('left-unrelated-projects')?.getAttribute('data-ng112-native-projects')||'',
      searchResult:document.getElementById('search-project-result')?.getAttribute('data-ng112-native-projects')||'',
      searchHost:document.getElementById('left-search')?.getAttribute('data-ng112-native-projects')||'',
      main:document.getElementById('main-projects')?.getAttribute('data-ng112-native-projects')||'',
      marked:[...document.querySelectorAll('[data-ng112-native-projects="1"]')].map(e=>e.id||e.tagName),
    }));
    let s=await snapshot();
    assert(s.native==='1'&&s.separateNative==='1',`real native Projects surfaces were not both acquired: ${JSON.stringify(s)}`);
    assert(!s.recents&&!s.unrelated&&!s.leftUnrelated&&!s.searchResult&&!s.searchHost&&!s.main&&s.marked.length===2,`Projects authority escaped into unrelated/search UI: ${JSON.stringify(s)}`);

    await page.evaluate(()=>document.getElementById('ng8-pins').remove());
    await page.waitForTimeout(100);s=await snapshot();
    assert(s.marked.length===0,`Projects authority did not release native surfaces when NiakGPT host disappeared: ${JSON.stringify(s)}`);

    await page.evaluate(()=>{const box=document.createElement('section');box.id='ng8-pins';box.innerHTML='<a data-ng8-pin="1" href="/g/g-p-one/project"><span>One</span></a><a data-ng8-pin="1" href="/g/g-p-two/project"><span>Two</span></a>';document.getElementById('left').appendChild(box);document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));});
    await page.waitForTimeout(100);s=await snapshot();
    assert(s.native==='1'&&s.separateNative==='1'&&!s.searchHost&&!s.searchResult&&s.marked.length===2,`Projects authority did not reacquire only real Project surfaces: ${JSON.stringify(s)}`);

    for(let i=0;i<24;i++){
      await page.evaluate(i=>{const old=document.getElementById('native-projects'),next=old.cloneNode(true);next.dataset.remount=String(i);old.replaceWith(next);},i);
      await page.waitForTimeout(18);
    }
    await page.waitForTimeout(100);s=await snapshot();
    assert(s.native==='1'&&s.separateNative==='1'&&!s.recents&&!s.unrelated&&!s.leftUnrelated&&!s.searchResult&&!s.searchHost&&!s.main&&s.marked.length===2,`Projects authority drifted after repeated React-style remounts: ${JSON.stringify(s)}`);

    console.log(`${engine} Projects authority real-root/search-result isolation/remount/release: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-authority-isolation-v119: ${Object.keys(engines).join(',')} PASS`);
