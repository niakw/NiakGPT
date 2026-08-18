import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const files=['pin-folders-v096.js','native-actions-v113.js','sidebar-projects-authority-v112.js','pin-folders-v096.css','native-actions-v113.css','sidebar-projects-authority-v112.css'];
const src=Object.fromEntries(await Promise.all(files.map(async f=>[f,await fs.readFile(path.join(ROOT,f),'utf8')])));
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'chromium').trim();
const launcher=ALL[requested];
if(!launcher)throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const cache={projects:[{id:'g-p-studio',name:'Studio',href:'/g/g-p-studio/project'},{id:'g-p-legal',name:'Legal',href:'/g/g-p-legal/project'}],chats:[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Alpha',projectId:'g-p-studio',updated:1787000000000},{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',title:'Beta',projectId:'g-p-studio',updated:1786990000000}],counts:{'g-p-studio':2,'g-p-legal':0}};

const browser=await launcher.launch({headless:true});
const context=await browser.newContext({viewport:{width:1365,height:900}});
const page=await context.newPage();
const consoleErrors=[];
const pageErrors=[];
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('pageerror',err=>pageErrors.push(String(err?.stack||err)));
try{
  await page.addInitScript(cache=>{
    const store={'niakgpt-v08-cache':cache};
    window.__diagEvents=[];
    window.__NIAKGPT_DIAGNOSTICS__={set(k,v){window.__diagEvents.push({k,v,at:performance.now()});}};
    window.chrome={storage:{local:{get:async k=>typeof k==='string'?{[k]:store[k]}:{...store},set:async o=>Object.assign(store,o)},onChanged:{addListener(){}}}};
    window.__NIAKGPT_CACHE_BUS__={subscribe(fn){fn(store['niakgpt-v08-cache']);return()=>{};},get:async()=>store['niakgpt-v08-cache']};
    window.addEventListener('unhandledrejection',e=>{window.__unhandled=(window.__unhandled||[]).concat(String(e.reason||'unknown'));});
  },cache);
  const base=`<!doctype html><html><body><aside id="sidebar-shell"><section id="ng8-pins"></section><nav data-testid="conversation-sidebar" id="toolbar"><a href="/">Nouveau chat</a><a href="/images">Images</a><a id="recent-chat" href="/c/recent">Conversation récente</a></nav><section id="native-project-zone"></section></aside><main id="main"><h1>Conversation</h1><div id="stream"></div></main><script>
    window.__menus=0;
    window.__projectMarkup=(variant=0)=>{
      const zone=document.getElementById('native-project-zone');
      if(variant%3===0)zone.innerHTML='<div data-sidebar-item="true" id="native-project-home"><a href="/projects">Projects</a><button aria-label="Projects options">...</button></div><div id="native-project-list"><div role="heading">Projects</div><div class="project-unfurl-row" id="native-studio"><a href="/g/g-p-studio/project">Studio</a><button aria-label="More actions">...</button></div><div class="project-unfurl-row" id="native-legal"><a href="/g/g-p-legal/project">Legal</a><button aria-label="More actions">...</button></div><button id="show-more">Afficher plus</button></div>';
      else if(variant%3===1)zone.innerHTML='<div id="native-project-list"><div>Projets</div><button role="button">Studio</button><button role="button">Legal</button><button id="show-more">Afficher plus</button></div>';
      else zone.innerHTML='<div data-sidebar-item="true" id="native-project-home"><a href="/projects">Projects</a></div><section id="native-project-list"><span>Projects</span><div class="project-unfurl-row" id="native-studio"><a href="/g/g-p-studio/project">Studio</a><button aria-label="More actions">...</button></div><div class="project-unfurl-row" id="native-legal"><a href="/g/g-p-legal/project">Legal</a><button aria-label="More actions">...</button></div></section>';
      window.__wire();
    };
    window.__wire=()=>document.querySelectorAll('#native-project-zone button[aria-label="More actions"]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[role=menu]').forEach(x=>x.remove());const m=document.createElement('div');m.setAttribute('role','menu');m.textContent='Rename Move Delete';m.style.cssText='position:fixed;left:700px;top:80px;display:block';document.body.appendChild(m);window.__menus++;});
    window.__projectMarkup(0);
  </script></body></html>`;
  await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:base}));
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  for(const f of files.filter(x=>x.endsWith('.css')))await page.addStyleTag({content:src[f]});
  for(const f of files.filter(x=>x.endsWith('.js')))await page.addScriptTag({content:src[f]});
  await page.evaluate(()=>{const pins=document.getElementById('ng8-pins');pins.innerHTML='<a data-ng8-pin="1" href="/g/g-p-studio/project"><span>Studio</span></a><a data-ng8-pin="1" href="/g/g-p-legal/project"><span>Legal</span></a>';document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:2,shown:2}}));});
  await page.waitForTimeout(120);

  // DOM authority: native Projects hidden, Recents untouched, no legacy class churn.
  const initial=await page.evaluate(()=>({
    projectHidden:getComputedStyle(document.getElementById('native-project-zone')).display==='none'||document.getElementById('native-project-zone').querySelector('[data-ng112-native-projects="1"]')!==null||document.getElementById('native-project-zone').getAttribute('data-ng112-native-projects')==='1',
    recentVisible:getComputedStyle(document.getElementById('recent-chat')).display!=='none',
    legacy:document.querySelectorAll('.ng112-native-projects-authoritative').length,
    marks:document.querySelectorAll('[data-ng112-native-projects="1"]').length
  }));
  assert(initial.projectHidden&&initial.recentVisible&&initial.legacy===0&&initial.marks>0,`DOM authority invalid: ${JSON.stringify(initial)}`);

  // Human path: open pin, preserve accessible action controls and native project menu.
  await page.locator('#ng8-pins a[data-ng8-pin="1"]').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#ng8-pins .ng113-native-actions-chat').length===2,null,{timeout:1500});
  const human=await page.evaluate(()=>({drawer:document.querySelectorAll('#ng8-pins .ng96-pin-drawer').length,actions:document.querySelectorAll('#ng8-pins .ng113-native-actions-chat').length,labels:[...document.querySelectorAll('#ng8-pins .ng113-native-actions')].every(b=>!!b.getAttribute('aria-label'))}));
  assert(human.drawer===1&&human.actions===2&&human.labels,`human pin path invalid: ${JSON.stringify(human)}`);
  await page.locator('#ng8-pins .ng113-native-actions-project').first().click();
  await page.waitForFunction(()=>!!document.querySelector('[role="menu"]'),null,{timeout:1500});
  assert(await page.evaluate(()=>window.__menus>0),'native Project menu did not open from hidden row');
  await page.evaluate(()=>document.querySelector('[role="menu"]')?.remove());

  // UX / anti-churn: unrelated ChatGPT class and content churn must not wake the sidebar authority.
  await page.evaluate(()=>{
    window.__churn={drawerAdd:0,drawerRemove:0,actionAdd:0,actionRemove:0};
    window.__churnObserver=new MutationObserver(rs=>{for(const r of rs)for(const [nodes,key] of [[r.addedNodes,'Add'],[r.removedNodes,'Remove']])for(const n of nodes){if(!(n instanceof Element))continue;const drawers=n.matches('.ng96-pin-drawer')?1:n.querySelectorAll?.('.ng96-pin-drawer').length||0;const actions=n.matches('.ng113-native-actions-chat')?1:n.querySelectorAll?.('.ng113-native-actions-chat').length||0;window.__churn['drawer'+key]+=drawers;window.__churn['action'+key]+=actions;}});
    window.__churnObserver.observe(document.getElementById('ng8-pins'),{childList:true,subtree:true});
    const action=document.querySelector('#ng8-pins .ng113-native-actions-chat');action.dataset.stabilityToken='keep';action.focus();window.__focused=action;
    window.__diagBefore=window.__diagEvents.filter(x=>x.k==='projects-authority').length;
  });
  await page.evaluate(()=>{
    const main=document.getElementById('main'),stream=document.getElementById('stream');
    for(let i=0;i<800;i++){main.className=`native-react-state-${i%17}`;stream.className=`stream-${i%11}`;}
    for(let i=0;i<80;i++){const n=document.createElement('div');n.textContent=`token-${i}`;stream.appendChild(n);if(i%3===0)n.remove();}
  });
  await page.waitForTimeout(300);
  const ux=await page.evaluate(()=>({
    churn:window.__churn,
    token:document.querySelector('#ng8-pins .ng113-native-actions-chat')?.dataset.stabilityToken||'',
    sameFocus:document.activeElement===window.__focused,
    diagBefore:window.__diagBefore,
    diagAfter:window.__diagEvents.filter(x=>x.k==='projects-authority').length,
    marks:document.querySelectorAll('[data-ng112-native-projects="1"]').length
  }));
  assert(ux.churn.drawerRemove===0&&ux.churn.actionRemove===0&&ux.token==='keep'&&ux.sameFocus,`UX churn regression: ${JSON.stringify(ux)}`);
  assert(ux.diagAfter===ux.diagBefore,`unrelated native class/content churn woke Projects authority: ${JSON.stringify(ux)}`);

  // React remount stress across several native DOM shapes. Each new Projects surface must be hidden quickly.
  for(let i=1;i<=12;i++){
    await page.evaluate(i=>window.__projectMarkup(i),i);
    await page.waitForFunction(()=>{const z=document.getElementById('native-project-zone');return getComputedStyle(z).display==='none'||z.getAttribute('data-ng112-native-projects')==='1'||!!z.querySelector('[data-ng112-native-projects="1"]');},null,{timeout:1000});
  }
  const remount=await page.evaluate(()=>({marks:document.querySelectorAll('[data-ng112-native-projects="1"]').length,recent:getComputedStyle(document.getElementById('recent-chat')).display,diag:window.__diagEvents.filter(x=>x.k==='projects-authority').length}));
  assert(remount.marks>0&&remount.recent!=='none',`React remount authority regression: ${JSON.stringify(remount)}`);

  // Restore a menu-capable native row and verify staging after remounts.
  await page.evaluate(()=>window.__projectMarkup(0));
  await page.waitForFunction(()=>!!document.querySelector('#native-project-zone [data-ng112-native-projects="1"]')||document.getElementById('native-project-zone')?.getAttribute('data-ng112-native-projects')==='1',null,{timeout:1000});
  await page.locator('#ng8-pins .ng113-native-actions-project').first().click();
  await page.waitForFunction(()=>!!document.querySelector('[role="menu"]'),null,{timeout:1500});

  // Error budget: our lab must finish with no JS/page/unhandled errors.
  const unhandled=await page.evaluate(()=>window.__unhandled||[]);
  assert(consoleErrors.length===0,`console errors: ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length===0,`page errors: ${JSON.stringify(pageErrors)}`);
  assert(unhandled.length===0,`unhandled rejections: ${JSON.stringify(unhandled)}`);
  await page.evaluate(()=>window.__churnObserver?.disconnect());
  console.log(`experience-gate-v116 ${process.platform}/${requested}: PASS human+DOM+errors+UX+remount+anti-churn`);
}finally{
  await context.close();
  await browser.close();
}
