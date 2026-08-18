from pathlib import Path
import json


def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text(encoding='utf-8')
    if old not in text: raise SystemExit(f'expected snippet not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old,new,count),encoding='utf-8')

# 1) Native action buttons must recover synchronously after every pins render/remount.
replace('native-actions-v113.js', "  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();closeFallback();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();", "  document.addEventListener('niakgpt:pins-rendered',()=>{bind();decorate();});\n  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();decorate();}});\n  window.addEventListener('popstate',()=>{bind();decorate();});\n  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bind();decorate();});\n  window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();observer=boot=null;box=null;closeFallback();});\n  window.addEventListener('pageshow',event=>{if(event.persisted)start();});\n  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();")

# 2) Project folders also recover synchronously and intercept the tiny undecorated race window.
replace('pin-folders-v096.js', "  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();schedule(80);}});\n  window.addEventListener('popstate',()=>schedule(60));\n  bootstrap();", "  document.addEventListener('niakgpt:pins-rendered',()=>{bindBox();rehydrate();});\n  document.addEventListener('click',event=>{\n    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;\n    const target=event.target instanceof Element?event.target:null,anchor=target?.closest('#ng8-pins a[data-ng8-pin=\"1\"]');\n    if(!anchor||anchor.dataset.ng96Bound)return;\n    const pid=pidFromHref(anchor.getAttribute('href'));if(!pid)return;\n    event.preventDefault();event.stopImmediatePropagation();wrapAnchor(anchor);toggle(pid,anchor);schedule(0);\n  },true);\n  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bindBox();rehydrate();}});\n  window.addEventListener('popstate',()=>{bindBox();rehydrate();});\n  if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>{bindBox();rehydrate();});\n  window.addEventListener('pageshow',event=>{if(event.persisted){bindBox();rehydrate();}});\n  bootstrap();")

# 3) Sidebar icons: stop merely recolouring ChatGPT SVGs; give the main navigation its own NiakGPT glyph layer.
icons_js="""(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_SIDEBAR_ICONS_114__)return;
  window.__NIAKGPT_SIDEBAR_ICONS_114__=true;
  const OWN='#ng8-pins,#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng90-control,#ng100-command,#ng100-onboarding,#ng100-breadcrumb';
  let navNode=null,observer=null,rootObserver=null,timer=0;
  const clean=v=>String(v||'').replace(/\\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
  const navRoot=()=>document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"]')||document.querySelector('nav');
  function kindFor(el){
    const text=norm(`${el.getAttribute?.('aria-label')||''} ${el.getAttribute?.('title')||''} ${el.textContent||''}`),href=String(el.getAttribute?.('href')||'');
    if(/nouvelle discussion|nouveau chat|new chat/.test(text))return'new';
    if(/rechercher|search/.test(text))return'search';
    if(/(^| )images?( |$)|\/images(?:[/?#]|$)/.test(text+' '+href))return'images';
    if(/applications?|(^| )apps?( |$)|\/apps(?:[/?#]|$)/.test(text+' '+href))return'apps';
    if(/codex/.test(text+' '+href))return'codex';
    return'';
  }
  function decorate(){
    timer=0;const nav=navRoot();if(!nav)return;if(nav!==navNode)bind(nav);
    let count=0;
    for(const el of nav.querySelectorAll('a,button,[role="button"],[role="link"]')){
      if(!(el instanceof HTMLElement)||el.closest(OWN)||el.matches('[data-ng8-chat],[data-ng8-project]')||el.closest('[data-ng8-chat],[data-ng8-project]'))continue;
      const kind=kindFor(el);if(!kind)continue;el.dataset.ng114NavIcon=kind;const svg=el.querySelector('svg');if(svg)svg.classList.add('ng114-native-icon');count++;
    }
    window.__NIAKGPT_DIAGNOSTICS__?.set('sidebar-icons',count?`OK · ${count} contrôles NiakGPT`:'ATTENTE · navigation native non rendue');
  }
  function schedule(delay=20){clearTimeout(timer);timer=setTimeout(decorate,delay);}
  function bind(nav=navRoot()){if(!nav)return false;if(nav===navNode&&observer)return true;observer?.disconnect();navNode=nav;observer=new MutationObserver(()=>schedule(12));observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','title','href','class']});return true;}
  function start(){bind();decorate();rootObserver?.disconnect();rootObserver=new MutationObserver(()=>{const next=navRoot();if(next!==navNode){bind(next);decorate();}});rootObserver.observe(document.documentElement,{childList:true,subtree:true});}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){bind();decorate();}});window.addEventListener('popstate',()=>decorate());if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>decorate());window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
"""
Path('sidebar-icons-v114.js').write_text(icons_js,encoding='utf-8')
icons_css="""/* NiakGPT 0.9.64 — distinctive main-sidebar glyphs while preserving native controls/accessibility. */
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon]{--ng114-glyph:'◆';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon] .ng114-native-icon{display:none!important;}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon]::before{
  content:var(--ng114-glyph);display:grid!important;place-items:center!important;flex:0 0 22px!important;width:22px!important;height:22px!important;
  margin-right:1px!important;border:1px solid rgba(79,193,255,.28)!important;border-radius:4px!important;background:linear-gradient(145deg,rgba(18,34,47,.96),rgba(8,17,25,.96))!important;
  color:#9ddcff!important;box-shadow:inset 0 0 0 1px rgba(78,201,176,.04),0 0 10px rgba(79,193,255,.035)!important;font:800 13px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon="new"]{--ng114-glyph:'+';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon="search"]{--ng114-glyph:'⌕';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon="images"]{--ng114-glyph:'◇';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon="apps"]{--ng114-glyph:'▦';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon="codex"]{--ng114-glyph:'</>';}
body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon]:hover::before,body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon]:focus-visible::before{border-color:#4fc1ff!important;color:#effaff!important;background:#152735!important;}
@media(prefers-reduced-motion:reduce){body.ng8-ready :is(nav,[data-testid*="sidebar" i]) [data-ng114-nav-icon]::before{transition:none!important;}}
"""
Path('sidebar-icons-v114.css').write_text(icons_css,encoding='utf-8')

# Runtime wiring.
replace('background-v100.js', "  'locale-fr-v101.js',\n  'sidebar-authority-v107.js',", "  'locale-fr-v101.js',\n  'sidebar-icons-v114.js',\n  'sidebar-authority-v107.js',")
manifest_path=Path('manifest.json'); manifest=json.loads(manifest_path.read_text(encoding='utf-8')); manifest['version']='0.9.64'; manifest['description']='Workspace power-user local pour ChatGPT : navigation robuste, actions natives Projects/chats, titres canoniques, nouveaux messages visibles et gros fils optimisés.'
css=manifest['content_scripts'][0]['css']; idx=css.index('native-da-v112.css') if 'native-da-v112.css' in css else len(css); css.insert(idx,'sidebar-icons-v114.css'); manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Static/package invariants.
replace('labs/static_validate_current.py', "if manifest.get('version')!='0.9.63':fail(f\"version={manifest.get('version')}\")", "if manifest.get('version')!='0.9.64':fail(f\"version={manifest.get('version')}\")")
replace('labs/static_validate_current.py', "'conversation-load-guard-v113.js'}", "'conversation-load-guard-v113.js','sidebar-icons-v114.js'}")
replace('labs/static_validate_current.py', "'native-da-v112.css','native-actions-v113.css'", "'native-da-v112.css','sidebar-icons-v114.css','native-actions-v113.css'")
replace('tools/package-extension.mjs', "'matrix-guardian-v112.js','matrix-guardian-v112.css','turn-headers-v112.js','continuity-v112.js','native-da-v112.css','cache-bus-v096.js',", "'matrix-guardian-v112.js','matrix-guardian-v112.css','turn-headers-v112.js','continuity-v112.js','native-da-v112.css','sidebar-icons-v114.js','sidebar-icons-v114.css','cache-bus-v096.js',")

# Human-navigation stress lab: repeated React-like remounts, immediate clicks, native-menu staging, image overlays and icon DA.
stress="""import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/human-nav-v114');
const names=['pin-folders-v096.js','native-actions-v113.js','sidebar-projects-authority-v112.js','visual-stability-v101.js','sidebar-icons-v114.js','pin-folders-v096.css','native-actions-v113.css','sidebar-projects-authority-v112.css','visual-stability-v101.css','sidebar-icons-v114.css'];
const loaded=Object.fromEntries(await Promise.all(names.map(async n=>[n,await fs.readFile(path.join(ROOT,n),'utf8')])));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const cache={projects:[{id:'g-p-studio',name:'Studio',href:'/g/g-p-studio/project'},{id:'g-p-legal',name:'Legal',href:'/g/g-p-legal/project'}],chats:[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Alpha',projectId:'g-p-studio',updated:1787000000000},{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',title:'Beta',projectId:'g-p-studio',updated:1786990000000}],counts:{'g-p-studio':2,'g-p-legal':0}};
const pixel='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600"%3E%3Crect width="900" height="600" fill="%23222"/%3E%3C/svg%3E';
for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'}),page=await context.newPage();
  try{
    await page.addInitScript(cache=>{const listeners=[];const store={'niakgpt-v08-cache':cache};window.__navHits=0;window.__menus=0;window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.64'})},storage:{local:{get:async k=>typeof k==='string'?{[k]:store[k]}:{...store},set:async obj=>{Object.assign(store,obj);}},onChanged:{addListener:fn=>listeners.push(fn)}}};window.__NIAKGPT_CACHE_BUS__={subscribe(fn){fn(store['niakgpt-v08-cache']);return()=>{};},get:async()=>store['niakgpt-v08-cache']};},cache);
    const base=`<!doctype html><html data-ng86-activity="ready"><body class="ng8-ready"><nav data-testid="conversation-sidebar" id="nav"><a aria-label="Nouvelle discussion" href="/"><svg><circle/></svg><span>Nouvelle discussion</span></a><button aria-label="Rechercher"><svg><circle/></svg><span>Rechercher</span></button><a href="/images" aria-label="Images"><svg><circle/></svg><span>Images</span></a><a href="/apps" aria-label="Applications"><svg><circle/></svg><span>Applications</span></a><button aria-label="Codex"><svg><circle/></svg><span>Codex</span><svg class="chevron"><path/></svg></button><div data-sidebar-item="true" id="native-project-home"><a href="/projects"><span>Projects</span></a><button aria-label="Projects options">...</button></div><section class="sidebar-expando-section" id="native-project-cluster"><div role="heading">Projects</div><div class="project-unfurl-row" id="native-studio"><a href="/g/g-p-studio/project"><span>Studio</span></a><button aria-label="More actions">...</button></div><div class="project-unfurl-row"><a href="/g/g-p-legal/project"><span>Legal</span></a><button aria-label="More actions">...</button></div></section><section id="ng8-pins"></section></nav><main><button id="thumb"><img src="${pixel}" style="width:410px;height:270px"></button></main><script>document.addEventListener('click',e=>{const a=e.target.closest?.('#ng8-pins a[data-ng8-pin]');if(a&&!e.defaultPrevented)window.__navHits++;},false);function wireMenus(){document.querySelectorAll('#native-project-cluster button[aria-label="More actions"]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[role=menu]').forEach(x=>x.remove());const m=document.createElement('div');m.setAttribute('role','menu');m.textContent='Rename Move Delete';m.style.cssText='position:fixed;left:700px;top:80px;display:block';document.body.appendChild(m);window.__menus++;});}wireMenus();document.getElementById('thumb').onclick=()=>{const o=document.createElement('div');o.id='preview-overlay';o.style.cssText='position:fixed;inset:0;background:#000;z-index:9999;display:grid;place-items:center';const img=document.createElement('img');img.src='${pixel}';img.style.cssText='width:78vw;height:72vh';const c=document.createElement('button');c.setAttribute('aria-label','Close preview');c.textContent='close';c.onclick=()=>o.remove();o.append(img,c);document.body.appendChild(o);};window.__wireMenus=wireMenus;</script></body></html>`;
    await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:base}));await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    for(const f of ['pin-folders-v096.css','native-actions-v113.css','sidebar-projects-authority-v112.css','visual-stability-v101.css','sidebar-icons-v114.css'])await page.addStyleTag({content:loaded[f]});
    for(const f of ['pin-folders-v096.js','native-actions-v113.js','sidebar-projects-authority-v112.js','visual-stability-v101.js','sidebar-icons-v114.js'])await page.addScriptTag({content:loaded[f]});
    await page.waitForTimeout(120);
    const iconState=await page.evaluate(()=>[...document.querySelectorAll('[data-ng114-nav-icon]')].map(el=>({kind:el.dataset.ng114NavIcon,svg:getComputedStyle(el.querySelector('.ng114-native-icon')).display,pseudo:getComputedStyle(el,'::before').content})));
    assert(iconState.length>=5&&iconState.every(x=>x.svg==='none'&&x.pseudo&&x.pseudo!=='none'),'main sidebar icons still look native/unclassified');
    const cycles=[];
    for(let i=0;i<16;i++){
      await page.evaluate(i=>{const nav=document.getElementById('nav');let pins=document.getElementById('ng8-pins');if(i%4===3){pins.remove();pins=document.createElement('section');pins.id='ng8-pins';nav.appendChild(pins);}pins.innerHTML=`<a data-ng8-pin="1" href="/g/g-p-studio/project" style="--ng-project:#4fc1ff"><i>◇</i><span>Studio</span><small class="ng8-project-meta">18/08 [2]</small></a><a data-ng8-pin="1" href="/g/g-p-legal/project" style="--ng-project:#4ec9b0"><i>§</i><span>Legal</span><small class="ng8-project-meta">18/08 [0]</small></a>`;for(const id of ['native-project-home','native-project-cluster']){const el=document.getElementById(id);el.className=id==='native-project-cluster'?'sidebar-expando-section':'';el.removeAttribute('aria-hidden');}window.__wireMenus();document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered',{detail:{count:2,shown:2}}));history.pushState({},'',i%2?'/g/g-p-studio/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa':'/');window.dispatchEvent(new PopStateEvent('popstate'));},i);
      const ready=await page.evaluate(()=>({entries:document.querySelectorAll('#ng8-pins .ng96-pin-entry').length,actions:document.querySelectorAll('#ng8-pins .ng113-native-actions-project').length,home:getComputedStyle(document.getElementById('native-project-home')).display,cluster:getComputedStyle(document.getElementById('native-project-cluster')).display}));
      assert(ready.entries===2&&ready.actions===2,`cycle ${i}: pins were not synchronously interactive after render/remount`);assert(ready.home==='none'&&ready.cluster==='none',`cycle ${i}: native Projects resurfaced`);
      await page.locator('#ng8-pins a[data-ng8-pin="1"]').first().click();await page.waitForTimeout(15);const drawer=await page.locator('#ng8-pins .ng96-pin-drawer').count();const navHits=await page.evaluate(()=>window.__navHits);assert(drawer===1&&navHits===0,`cycle ${i}: pin click navigated or failed to open drawer`);
      await page.locator('#ng8-pins .ng113-native-actions-project').first().click();await page.waitForFunction(()=>!!document.querySelector('[role="menu"]'),null,{timeout:1200});const menus=await page.locator('[role="menu"]').count();assert(menus===1,`cycle ${i}: Project action menu failed`);await page.evaluate(()=>document.querySelectorAll('[role="menu"]').forEach(x=>x.remove()));
      cycles.push({i,...ready,drawer,navHits});
    }
    for(let i=0;i<4;i++){await page.locator('#thumb').click();await page.waitForFunction(()=>!!document.getElementById('ng103-image-close'),null,{timeout:1200});const visible=await page.evaluate(()=>{const b=document.getElementById('ng103-image-close');return !!b&&getComputedStyle(b).display!=='none';});assert(visible,`image cycle ${i}: close control missing`);await page.locator('#ng103-image-close').click();await page.waitForFunction(()=>!document.getElementById('preview-overlay'),null,{timeout:900});}
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'human-nav-stress.png'),fullPage:true});await fs.writeFile(path.join(dir,'human-nav-stress.json'),JSON.stringify({iconState,cycles,menus:await page.evaluate(()=>window.__menus)},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`human-nav-stress-v114: ${Object.keys(engines).join(',')} PASS`);
"""
Path('visual-lab/human-nav-stress-v114.mjs').write_text(stress,encoding='utf-8')

# Release/docs.
readme=Path('README.md'); text=readme.read_text(encoding='utf-8'); text=text.replace('version-0.9.63-4fc1ff','version-0.9.64-4fc1ff',1); text=text.replace('> **Version actuelle : 0.9.63** — menu d’actions ChatGPT natif complet depuis les Projects/chats NiakGPT, suppression du propriétaire `project-pins` contradictoire, titres de conversations canoniques protégés contre les caches obsolètes, fil d’Ariane lié `Accueil > Project > Chat`, état de nouveau message visible et garde de chargement des conversations multi-onglets.', '> **Version actuelle : 0.9.64** — stabilité de navigation durcie après refresh/remount, menus de pins immédiatement interactifs, visualiseur image refermable, suppression plus robuste du dernier bloc Projects natif, icônes principales de sidebar réellement NiakGPT et correction CodeQL du sommaire DOM.',1); readme.write_text(text,encoding='utf-8')
ch=Path('CHANGELOG.md'); old=ch.read_text(encoding='utf-8'); head='''# NiakGPT 0.9.64 — Human navigation, stabilité live et sécurité\n\n- Corrige l’alerte CodeQL `js/xss-through-dom` : le texte des tours du sommaire est maintenant injecté via `textContent` et n’est plus réinterprété comme HTML.\n- Durcit les pins contre les remounts/rerenders React : dossiers et boutons d’actions se réhydratent de façon synchrone à chaque `niakgpt:pins-rendered`, avec garde du premier clic avant décoration.\n- Réarme les actions après retour BFCache, visibilité et navigation SPA.\n- Le visualiseur image détecte aussi les overlays plein écran sans ancien sélecteur dialog et restaure systématiquement le bouton de fermeture NiakGPT.\n- L’autorité Projects masque aussi la ligne native `Projects` lorsqu’elle contient un bouton d’action frère.\n- Les contrôles principaux de sidebar (nouvelle discussion, recherche, images, applications, Codex) reçoivent désormais des glyphes NiakGPT distinctifs au lieu de simples SVG ChatGPT recolorés.\n- Nouveau stress test `human-nav-stress-v114` : 16 cycles de rerender/remount/navigation + menus natifs + fermeture image sur Chromium, Firefox et WebKit.\n\n'''; ch.write_text(head+old,encoding='utf-8')

Path('.github/apply-human-nav-v114.py').unlink()
