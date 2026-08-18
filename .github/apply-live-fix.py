from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'expected snippet not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# CodeQL js/xss-through-dom: DOM text must never be reinterpreted through innerHTML.
replace('app-v090.js', r'''    }else if(S.tab==='toc'){
      const turns=liveTurns();health('toc',turns.length?`OK · ${turns.length} blocs`:'VIDE · 0 bloc');
      panel.innerHTML=`<header><div><small>SOMMAIRE</small><b>${turns.length} blocs</b></div><button aria-label="Fermer">×</button></header><input id="ng8-toc-search" placeholder="Filtrer le fil…"><div class="ng8-toc">${turns.map((t,i)=>`<button data-turn="${i}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc((t.innerText||t.textContent||'').replace(/\s+/g,' ').slice(0,135))}</span></button>`).join('')}</div>`;
    }else{''', r'''    }else if(S.tab==='toc'){
      const turns=liveTurns();health('toc',turns.length?`OK · ${turns.length} blocs`:'VIDE · 0 bloc');
      panel.innerHTML=`<header><div><small>SOMMAIRE</small><b>${turns.length} blocs</b></div><button aria-label="Fermer">×</button></header><input id="ng8-toc-search" placeholder="Filtrer le fil…"><div class="ng8-toc"></div>`;
      const toc=panel.querySelector('.ng8-toc');
      for(let i=0;i<turns.length;i++){
        const turn=turns[i],button=document.createElement('button'),index=document.createElement('i'),label=document.createElement('span');
        button.dataset.turn=String(i);index.textContent=String(i+1).padStart(2,'0');label.textContent=String(turn.innerText||turn.textContent||'').replace(/\s+/g,' ').slice(0,135);button.append(index,label);toc?.appendChild(button);
      }
    }else{''')

# Hide the complete native Projects home row even when ChatGPT adds a trailing action button.
replace('sidebar-projects-authority-v112.js', '''  function compactLabelTarget(label,nav){if(!label||label===nav)return null;if(label.matches?.('a[href]'))return label;const button=label.closest('button,[role="button"]');if(button&&button!==nav&&outsideOwn(button))return button;return label;}''', '''  function compactLabelTarget(label,nav){if(!label||label===nav)return null;const row=label.closest('[data-sidebar-item="true"],li,[class*="sidebar-item"]');if(row&&row!==nav&&outsideOwn(row)&&!row.contains(ownProjects()))return row;if(label.matches?.('a[href]'))return label;const button=label.closest('button,[role="button"]');if(button&&button!==nav&&outsideOwn(button))return button;return label;}''')
replace('sidebar-projects-authority-v112.js', '''  function projectHomeTarget(link,nav){if(!link||link===nav||!outsideOwn(link))return null;const row=link.closest('[data-sidebar-item="true"],li');if(row&&row!==nav&&outsideOwn(row)&&!row.contains(ownProjects())){const interactive=row.querySelectorAll('a[href],button,[role="button"]');if(interactive.length===1)return row;}return link;}''', '''  function projectHomeTarget(link,nav){if(!link||link===nav||!outsideOwn(link))return null;const row=link.closest('[data-sidebar-item="true"],li,[class*="sidebar-item"]');if(row&&row!==nav&&outsideOwn(row)&&!row.contains(ownProjects())){const genericChats=[...row.querySelectorAll('a[href*="/c/"]')].some(a=>!projectChildHref(a.getAttribute('href')));if(!genericChats)return row;}return link;}''')

# Detect current ChatGPT image overlays even when they no longer expose the old dialog selectors.
replace('visual-stability-v101.js', '''  let detectorTimer=0,detectorProbe=0,viewerHost=null,closeButton=null,viewerObserver=null;''', '''  let detectorTimer=0,detectorProbe=0,viewerHost=null,closeButton=null,viewerObserver=null,viewerRootObserver=null;''')
replace('visual-stability-v101.js', '''  function viewerCandidate(){
    for(const host of document.querySelectorAll(VIEWER_SEL)){
      if(!visible(host)||host.closest(OWN))continue;
      const r=host.getBoundingClientRect();
      if(r.width<innerWidth*.55||r.height<innerHeight*.55)continue;
      if(largeMedia(host))return host;
    }
    return null;
  }''', '''  function overlayHostFromMedia(){
    for(const media of document.querySelectorAll('img,video,canvas')){
      if(!visible(media)||media.closest(OWN)||media.id==='ng8-matrix')continue;
      const mr=media.getBoundingClientRect();
      if(mr.width<Math.min(360,innerWidth*.34)||mr.height<Math.min(240,innerHeight*.30))continue;
      let node=media.parentElement;
      for(let depth=0;depth<10&&node&&node!==document.body;depth++,node=node.parentElement){
        if(!visible(node)||node.closest(OWN))continue;
        const r=node.getBoundingClientRect(),cs=getComputedStyle(node),modal=node.getAttribute('aria-modal')==='true'||node.getAttribute('role')==='dialog';
        if(r.width>=innerWidth*.68&&r.height>=innerHeight*.68&&(cs.position==='fixed'||modal))return node;
      }
    }
    return null;
  }
  function viewerCandidate(){
    for(const host of document.querySelectorAll(VIEWER_SEL)){
      if(!visible(host)||host.closest(OWN))continue;
      const r=host.getBoundingClientRect();
      if(r.width<innerWidth*.55||r.height<innerHeight*.55)continue;
      if(largeMedia(host))return host;
    }
    return overlayHostFromMedia();
  }''')
replace('visual-stability-v101.js', '''  function imageIntent(target){
    if(!(target instanceof Element)||target.closest(OWN))return false;
    return !!(target.closest('img,video')||target.closest('button,a')?.querySelector('img,video'));
  }''', '''  function imageIntent(target){
    if(!(target instanceof Element)||target.closest(OWN))return false;
    if(target.closest('img,video,figure,[data-testid*="image" i],[data-testid*="media" i]')||target.closest('button,a')?.querySelector('img,video,canvas'))return true;
    const control=target.closest('button,a,[role="button"]'),label=`${control?.getAttribute?.('aria-label')||''} ${control?.getAttribute?.('title')||''}`;
    return /image|photo|preview|aper[cç]u|visualis/i.test(label);
  }
  function armViewerObserver(){
    viewerRootObserver?.disconnect();
    viewerRootObserver=new MutationObserver(records=>{
      if(viewerHost)return;
      const mediaAdded=records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&(n.matches?.('img,video,canvas,[role="dialog"],[aria-modal="true"]')||n.querySelector?.('img,video,canvas'))));
      if(mediaAdded)setTimeout(()=>scanViewer(),35);
    });
    viewerRootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }''')
replace('visual-stability-v101.js', '''  window.addEventListener('pageshow',event=>{if(event.persisted){armMatrixProbes();if(viewerHost)scanViewer();}});
  window.addEventListener('pagehide',()=>{
    clearTimeout(detectorTimer);clearTimeout(matrixTimer);viewerObserver?.disconnect();viewerObserver=null;
  });

  if(document.body)armMatrixProbes();
  else document.addEventListener('DOMContentLoaded',armMatrixProbes,{once:true});''', '''  window.addEventListener('pageshow',event=>{if(event.persisted){armMatrixProbes();armViewerObserver();if(viewerHost)scanViewer();}});
  window.addEventListener('pagehide',()=>{
    clearTimeout(detectorTimer);clearTimeout(matrixTimer);viewerObserver?.disconnect();viewerRootObserver?.disconnect();viewerObserver=viewerRootObserver=null;
  });

  const start=()=>{armMatrixProbes();armViewerObserver();};
  if(document.body)start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});''')

lab = '''import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/finalization-v114');
const [viewerJs,viewerCss,authorityJs,authorityCss]=await Promise.all(['visual-stability-v101.js','visual-stability-v101.css','sidebar-projects-authority-v112.js','sidebar-projects-authority-v112.css'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const pixel='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600"%3E%3Crect width="900" height="600" fill="%23222"/%3E%3C/svg%3E';
for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'}),page=await context.newPage();
  try{
    const html=`<!doctype html><html><body class="ng8-ready"><nav data-testid="conversation-sidebar"><div data-sidebar-item="true" id="native-project-home"><a href="/projects"><span>Projects</span></a><button aria-label="Projects options">...</button></div><section class="sidebar-expando-section" id="native-project-cluster"><div role="heading">Projects</div><div class="project-unfurl-row"><a href="/g/g-p-studio/project"><span>Studio</span></a></div><div class="project-unfurl-row"><a href="/g/g-p-legal/project"><span>Legal</span></a></div></section><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-studio/project"><span>Studio</span></a><a data-ng8-pin="1" href="/g/g-p-legal/project"><span>Legal</span></a></section></nav><main><button id="open-preview"><img id="thumb" src="${pixel}" style="width:420px;height:280px"></button></main><script>document.getElementById('open-preview').addEventListener('click',()=>{const overlay=document.createElement('div');overlay.id='preview-overlay';overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:#000;display:grid;place-items:center';const img=document.createElement('img');img.src='${pixel}';img.style.cssText='width:78vw;height:72vh;object-fit:contain';const close=document.createElement('button');close.id='native-preview-close';close.setAttribute('aria-label','Close preview');close.textContent='close';close.addEventListener('click',()=>overlay.remove());overlay.append(img,close);document.body.appendChild(overlay);});</script></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});await page.addStyleTag({content:viewerCss});await page.addStyleTag({content:authorityCss});await page.addScriptTag({content:viewerJs});await page.addScriptTag({content:authorityJs});await page.waitForTimeout(220);
    const projects=await page.evaluate(()=>({home:getComputedStyle(document.getElementById('native-project-home')).display,cluster:getComputedStyle(document.getElementById('native-project-cluster')).display,pins:getComputedStyle(document.getElementById('ng8-pins')).display}));assert(projects.home==='none','native Projects home row with trailing action survived authority');assert(projects.cluster==='none','native Projects cluster survived authority');assert(projects.pins!=='none','NiakGPT pins were hidden with native Projects');
    await page.locator('#open-preview').click();await page.waitForTimeout(420);const closeState=await page.evaluate(()=>{const b=document.getElementById('ng103-image-close');return{exists:!!b,display:b?getComputedStyle(b).display:'',viewer:document.documentElement.dataset.ng103ImageViewer||''};});assert(closeState.exists&&closeState.display!=='none'&&closeState.viewer==='1','image preview did not get the NiakGPT close control');const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'live-ui-regressions.png'),fullPage:true});await page.locator('#ng103-image-close').click();await page.waitForTimeout(180);assert(!(await page.locator('#preview-overlay').count()),'NiakGPT image close did not close native preview');await fs.writeFile(path.join(dir,'live-ui-regressions.json'),JSON.stringify({projects,closeState},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`live-ui-regressions-v114: ${Object.keys(engines).join(',')} PASS`);
'''
Path('visual-lab/live-ui-regressions-v114.mjs').write_text(lab, encoding='utf-8')

wf = Path('.github/workflows/current-finalization.yml')
text = wf.read_text(encoding='utf-8')
start = text.find('  # BEGIN TEMP LIVE FIX\n')
end = text.find('  # END TEMP LIVE FIX\n')
if start >= 0 and end >= 0:
    text = text[:start] + text[end + len('  # END TEMP LIVE FIX\n'):]
text = text.replace('permissions:\n  contents: write', 'permissions:\n  contents: read', 1)
text = text.replace('for f in background-v100.js sidebar-projects-authority-v112.js', 'for f in background-v100.js app-v090.js visual-stability-v101.js sidebar-projects-authority-v112.js', 1)
needle = '''      - name: Native Project and chat actions\n        working-directory: visual-lab\n        env:\n          NIAKGPT_BROWSER: ${{ matrix.browser }}\n        run: node sidebar-native-actions-v113.mjs\n'''
addition = needle + '''      - name: Live image viewer and native Projects regressions\n        working-directory: visual-lab\n        env:\n          NIAKGPT_BROWSER: ${{ matrix.browser }}\n        run: node live-ui-regressions-v114.mjs\n'''
if 'run: node live-ui-regressions-v114.mjs' not in text:
    text = text.replace(needle, addition, 1)
text = text.replace('            visual-lab/artifacts/finalization-v113/${{ matrix.browser }}\n', '            visual-lab/artifacts/finalization-v113/${{ matrix.browser }}\n            visual-lab/artifacts/finalization-v114/${{ matrix.browser }}\n', 1)
wf.write_text(text, encoding='utf-8')

for p in [Path('.github/workflows/_temporary-live-fix.yml'), Path('.github/apply-live-fix.py')]:
    if p.exists():
        p.unlink()
