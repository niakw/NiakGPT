import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const files=['pin-folders-v096.js','native-actions-v113.js','sidebar-projects-authority-v112.js','pin-folders-v096.css','native-actions-v113.css','sidebar-projects-authority-v112.css'];
const src=Object.fromEntries(await Promise.all(files.map(async f=>[f,await fs.readFile(path.join(ROOT,f),'utf8')])));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const cache={projects:[{id:'g-p-studio',name:'Studio',href:'/g/g-p-studio/project'},{id:'g-p-legal',name:'Legal',href:'/g/g-p-legal/project'}],chats:[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Alpha',projectId:'g-p-studio',updated:1787000000000},{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',title:'Beta',projectId:'g-p-studio',updated:1786990000000}],counts:{'g-p-studio':2,'g-p-legal':0}};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:820}}),page=await context.newPage();
  try{
    await page.addInitScript(cache=>{const store={'niakgpt-v08-cache':cache};window.chrome={storage:{local:{get:async k=>typeof k==='string'?{[k]:store[k]}:{...store},set:async o=>Object.assign(store,o)},onChanged:{addListener(){}}}};window.__NIAKGPT_CACHE_BUS__={subscribe(fn){fn(store['niakgpt-v08-cache']);return()=>{};},get:async()=>store['niakgpt-v08-cache']};},cache);
    const base=`<!doctype html><html><body><aside id="sidebar-shell"><section id="ng8-pins"></section><nav data-testid="conversation-sidebar" id="toolbar"><a href="/">Nouveau chat</a><a href="/images">Images</a></nav><section id="native-project-zone"><div data-sidebar-item="true" id="native-project-home"><a href="/projects">Projects</a><button aria-label="Projects options">...</button></div><div id="native-project-list"><div role="heading">Projects</div><div class="project-unfurl-row" id="native-studio"><a href="/g/g-p-studio/project">Studio</a><button aria-label="More actions">...</button></div><div class="project-unfurl-row" id="native-legal"><a href="/g/g-p-legal/project">Legal</a><button aria-label="More actions">...</button></div><button id="show-more">Afficher plus</button></div></section></aside><main>content</main><script>window.__menus=0;window.__wire=()=>document.querySelectorAll('#native-project-zone button[aria-label="More actions"]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[role=menu]').forEach(x=>x.remove());const m=document.createElement('div');m.setAttribute('role','menu');m.textContent='Rename Move Delete';m.style.cssText='position:fixed;left:700px;top:80px;display:block';document.body.appendChild(m);window.__menus++;});window.__wire();</script></body></html>`;
    await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:base}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    for(const f of files.filter(x=>x.endsWith('.css')))await page.addStyleTag({content:src[f]});
    for(const f of files.filter(x=>x.endsWith('.js')))await page.addScriptTag({content:src[f]});
    await page.evaluate(()=>{const pins=document.getElementById('ng8-pins');pins.innerHTML='<a data-ng8-pin="1" href="/g/g-p-studio/project"><span>Studio</span></a><a data-ng8-pin="1" href="/g/g-p-legal/project"><span>Legal</span></a>';document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:2,shown:2}}));});
    await page.waitForTimeout(80);
    const hidden=await page.evaluate(()=>['native-project-home','native-project-list','native-studio','native-legal','show-more'].map(id=>{const el=document.getElementById(id);return{id,hidden:!!el?.closest('.ng112-native-projects-authoritative')||getComputedStyle(el).display==='none'||getComputedStyle(el).visibility==='hidden'};}));
    assert(hidden.every(x=>x.hidden),`${engine}: split-root native Projects still visible: ${JSON.stringify(hidden)}`);

    await page.evaluate(()=>{window.__churn={drawerAdd:0,drawerRemove:0,actionAdd:0,actionRemove:0};window.__churnObserver=new MutationObserver(rs=>{for(const r of rs)for(const [nodes,key] of [[r.addedNodes,'Add'],[r.removedNodes,'Remove']])for(const n of nodes){if(!(n instanceof Element))continue;const drawers=n.matches('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;const actions=n.matches('.ng113-native-actions-chat')?1:n.querySelectorAll?.('.ng113-native-actions-chat').length||0;window.__churn['drawer'+key]+=drawers;window.__churn['action'+key]+=actions;}});window.__churnObserver.observe(document.getElementById('ng8-pins'),{childList:true,subtree:true});});
    await page.locator('#ng8-pins a[data-ng8-pin="1"]').first().click();
    await page.waitForFunction(()=>document.querySelectorAll('#ng8-pins .ng113-native-actions-chat').length===2,null,{timeout:1200});
    await page.evaluate(()=>{const b=document.querySelector('#ng8-pins .ng113-native-actions-chat');b.dataset.stabilityToken='keep';});
    await page.waitForTimeout(450);
    const stable=await page.evaluate(()=>({churn:window.__churn,drawer:document.querySelectorAll('#ng8-pins .ng96-pin-drawer').length,actions:document.querySelectorAll('#ng8-pins .ng113-native-actions-chat').length,token:document.querySelector('#ng8-pins .ng113-native-actions-chat')?.dataset.stabilityToken||''}));
    assert(stable.drawer===1&&stable.actions===2&&stable.token==='keep',`${engine}: chat action button was replaced during idle: ${JSON.stringify(stable)}`);
    assert(stable.churn.drawerRemove===0&&stable.churn.actionRemove===0,`${engine}: idle feedback loop detected: ${JSON.stringify(stable.churn)}`);

    await page.evaluate(()=>{const zone=document.getElementById('native-project-zone');zone.innerHTML='<div data-sidebar-item="true" id="native-project-home"><a href="/projects">Projects</a><button>...</button></div><div id="native-project-list"><div role="heading">Projects</div><div class="project-unfurl-row" id="native-studio"><a href="/g/g-p-studio/project">Studio</a><button aria-label="More actions">...</button></div><div class="project-unfurl-row" id="native-legal"><a href="/g/g-p-legal/project">Legal</a><button aria-label="More actions">...</button></div><button id="show-more">Afficher plus</button></div>';window.__wire();});
    await page.waitForTimeout(40);
    const remountHidden=await page.evaluate(()=>['native-project-home','native-project-list','native-studio','native-legal','show-more'].every(id=>{const el=document.getElementById(id);return !!el?.closest('.ng112-native-projects-authoritative')||getComputedStyle(el).display==='none'||getComputedStyle(el).visibility==='hidden';}));
    assert(remountHidden,`${engine}: native Projects resurfaced after independent React remount`);

    await page.locator('#ng8-pins .ng113-native-actions-project').first().click();
    await page.waitForFunction(()=>!!document.querySelector('[role="menu"]'),null,{timeout:1200});
    assert(await page.evaluate(()=>window.__menus>0),`${engine}: staging hidden Project row no longer opens native menu`);
    await page.evaluate(()=>window.__churnObserver?.disconnect());
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-real-shape-v115: ${Object.keys(engines).join(',')} PASS`);
