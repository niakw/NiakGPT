import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const OUT=path.resolve('artifacts/finalization-v112');
const ALL_ENGINES={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
if(requested&&!ALL_ENGINES[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const engines=requested?{[requested]:ALL_ENGINES[requested]}:ALL_ENGINES;
const read=async file=>fs.readFile(path.join(ROOT,file),'utf8');
const jsFiles={
  authority:await read('sidebar-projects-authority-v112.js'),
  home:await read('home-layout-v112.js'),
  matrix:await read('matrix-guardian-v112.js'),
  perf:await read('performance-guard-v112.js'),
  headers:await read('turn-headers-v112.js'),
  rename:await read('native-rename-v112.js'),
  cacheBus:await read('cache-bus-v096.js')
};
const cssFiles={
  authority:await read('sidebar-projects-authority-v112.css'),
  home:await read('home-layout-v112.css'),
  matrix:await read('matrix-guardian-v112.css'),
  perf:await read('performance-guard-v112.css'),
  rename:await read('native-rename-v112.css'),
  nativeDa:await read('native-da-v112.css'),
  visual:await read('visual-stability-v101.css')
};

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function basePage(browser,html,{pathname='/'}={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark',reducedMotion:'no-preference'});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    const chats=Array.from({length:120},(_,i)=>({id:`cache-${String(i).padStart(4,'0')}`,title:`Cached ${i}`,projectId:i%2?'g-p-niakgpt':'g-p-medialab',updated:Date.now()-i*1000}));
    chats[0]={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Long thread',projectId:'g-p-niakgpt',updated:Date.now()};
    const store={
      'niakgpt-v08-cache':{
        schema:2,at:Date.now(),projects:[
          {id:'g-p-niakgpt',name:'NiakGPT'},{id:'g-p-medialab',name:'MediaLab'},{id:'g-p-films',name:'Films'}
        ],chats
      }
    };
    window.__niakgptTestStore=store;
    window.chrome={
      runtime:{id:'niakgpt-test',getManifest:()=>({version:'0.9.62'})},
      storage:{local:{
        get:async keys=>{if(keys==null)return{...store};const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},
        set:async obj=>Object.assign(store,obj)
      },onChanged:{addListener:()=>{}}}
    };
  });
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto(`https://chatgpt.com${pathname}`,{waitUntil:'domcontentloaded'});
  return{context,page};
}
async function save(page,engine,scenario,analysis){
  const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${scenario}.png`),fullPage:true});
  await fs.writeFile(path.join(dir,`${scenario}.html`),await page.content());
  await fs.writeFile(path.join(dir,`${scenario}.json`),JSON.stringify(analysis,null,2));
}
async function inject(page,{js=[],css=[]}){
  for(const code of css)await page.addStyleTag({content:code});
  for(const code of js)await page.addScriptTag({content:code});
}

async function sidebarScenario(browser,engine){
  const html=`<!doctype html><html><body class="ng8-ready"><nav data-testid="conversation-sidebar" style="width:310px;background:#071019;color:#fff;padding:8px">
    <section id="native-projects" class="group/sidebar-expando-section" style="padding:8px;border:1px solid #555">
      <h2>Projets</h2>
      <div class="group/project-unfurl-row"><a href="/g/g-p-niakgpt/project">NiakGPT</a><button id="native-options" aria-label="Plus d’options">⋯</button></div>
      <div class="group/project-unfurl-row" role="button">MediaLab</div>
      <div class="group/project-unfurl-row" role="button">Films</div>
    </section>
    <section id="ng8-pins" style="display:block"><div class="ng8-pin-head">PROJECTS</div><div class="ng8-pin-list">
      <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-niakgpt/project"><span>NiakGPT</span></a></div>
      <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-medialab/project"><span>MediaLab</span></a></div>
      <div class="ng96-pin-entry"><a data-ng8-pin="1" href="/g/g-p-films/project"><span>Films</span></a></div>
    </div></section>
    <section><h2>Récents</h2><a href="/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Long thread</a></section>
  </nav><script>
    document.getElementById('native-options').addEventListener('click',()=>{const menu=document.createElement('div');menu.setAttribute('role','menu');const item=document.createElement('button');item.setAttribute('role','menuitem');item.textContent='Renommer';item.addEventListener('click',()=>document.documentElement.dataset.testNativeRename='1');menu.appendChild(item);document.body.appendChild(menu);});
  <\/script></body></html>`;
  const {context,page}=await basePage(browser,html);
  try{
    await inject(page,{css:[cssFiles.authority,cssFiles.rename],js:[jsFiles.authority,jsFiles.rename]});
    await page.waitForTimeout(500);
    await page.locator('.ng112-native-rename-project').first().click();await page.waitForTimeout(450);
    const analysis=await page.evaluate(()=>{
      const native=document.getElementById('native-projects'),pins=document.getElementById('ng8-pins');
      return{
        nativeClass:native.className,nativeDisplay:getComputedStyle(native).display,
        ownDisplay:getComputedStyle(pins).display,
        projectRenameButtons:pins.querySelectorAll('.ng112-native-rename-project').length,
        hiddenTargets:document.querySelectorAll('.ng112-native-projects-authoritative').length,
        recentVisible:getComputedStyle(document.querySelector('a[href*="/c/"]')).display,
        nativeRenameInvoked:document.documentElement.dataset.testNativeRename||'0'
      };
    });
    assert(analysis.nativeDisplay==='none','native Projects section still visible');
    assert(analysis.ownDisplay!=='none','NiakGPT Projects section hidden');
    assert(analysis.projectRenameButtons===3,'rename controls missing from Projects');
    assert(analysis.recentVisible!=='none','Recents was hidden with Projects');
    assert(analysis.nativeRenameInvoked==='1','managed Project rename did not invoke the native menu');
    await save(page,engine,'sidebar-projects',analysis);
  }finally{await context.close();}
}

async function homeScenario(browser,engine){
  const html=`<!doctype html><html><head><style>
    body{margin:0;background:#05090d;color:#fff}.home{position:relative;height:700px}h1{position:absolute;top:360px;left:50%;transform:translateX(-50%);margin:0;font:700 32px system-ui}
    form{position:absolute;top:350px;left:50%;transform:translateX(-50%);width:760px;height:110px;background:#111;border:1px solid #555}#prompt-textarea{height:70px}
  </style></head><body class="ng8-ready"><main><div class="home"><h1>Par quoi commençons-nous ?</h1><form><div id="prompt-textarea" contenteditable="true"></div></form></div></main></body></html>`;
  const {context,page}=await basePage(browser,html);
  try{
    await inject(page,{css:[cssFiles.home],js:[jsFiles.home]});await page.waitForTimeout(450);
    const analysis=await page.evaluate(()=>{const h=document.querySelector('h1').getBoundingClientRect(),f=document.querySelector('form').getBoundingClientRect();return{heading:{top:h.top,bottom:h.bottom},composer:{top:f.top,bottom:f.bottom},overlap:h.bottom>f.top-12&&h.top<f.bottom+12,repaired:document.querySelector('h1').classList.contains('ng112-home-heading-repaired'),rootFlag:document.documentElement.dataset.ng112HomeOverlap||''};});
    assert(!analysis.overlap,'home heading still overlaps composer');assert(analysis.repaired,'home overlap guard did not activate');
    await save(page,engine,'home-layout',analysis);
  }finally{await context.close();}
}

async function matrixScenario(browser,engine){
  const html='<!doctype html><html data-ng90-matrix="subtle"><body class="ng8-ready" style="margin:0;background:#05090d"><main style="height:700px"><div style="padding:60px;color:white">Matrix guard</div></main></body></html>';
  const {context,page}=await basePage(browser,html,{pathname:'/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});
  try{
    await inject(page,{css:[cssFiles.matrix],js:[jsFiles.matrix]});await page.waitForTimeout(350);
    const analysis=await page.evaluate(()=>{const c=document.querySelector('#ng8-matrix,#ng112-matrix-fallback');return{canvasId:c?.id||'',canvasCount:document.querySelectorAll('#ng8-matrix,#ng112-matrix-fallback').length,z:c?getComputedStyle(c).zIndex:'',pointer:c?getComputedStyle(c).pointerEvents:''};});
    assert(analysis.canvasCount===1,'Matrix canvas missing or duplicated');assert(analysis.pointer==='none','Matrix intercepts pointer events');
    await save(page,engine,'matrix',analysis);
  }finally{await context.close();}
}

async function longThreadScenario(browser,engine){
  const turns=Array.from({length:120},(_,i)=>`<article data-testid="conversation-turn-${i}"><div data-message-author-role="${i%2?'assistant':'user'}" ${i>=118?`data-create-time="${Math.floor(Date.now()/1000)-i}"`:''}>Message ${i}</div></article>`).join('');
  const html=`<!doctype html><html><body class="ng8-ready"><main>${turns}<form><div id="prompt-textarea" contenteditable="true"></div></form></main></body></html>`;
  const {context,page}=await basePage(browser,html,{pathname:'/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});
  try{
    await inject(page,{css:[cssFiles.visual,cssFiles.perf],js:[jsFiles.perf,jsFiles.headers]});await page.waitForTimeout(900);
    const analysis=await page.evaluate(()=>({
      longThread:document.documentElement.dataset.ng112LongThread,
      heavy:document.documentElement.dataset.ng8Heavy,
      cold:document.querySelectorAll('[data-ng112-cold="1"]').length,
      headers:document.querySelectorAll('[data-ng112-header="1"]').length,
      roles:{user:document.querySelectorAll('[data-ng8-role="user"]').length,assistant:document.querySelectorAll('[data-ng8-role="assistant"]').length},
      tailTimes:[...document.querySelectorAll('[data-ng8-time]')].slice(-4).map(x=>x.dataset.ng8Time)
    }));
    assert(analysis.longThread==='1','long thread not detected');assert(analysis.heavy==='1','heavy mode not enabled');assert(analysis.cold>=60,'cold history budget too large');assert(analysis.headers>=50,'recent TOI/CHATGPT headers not decorated');assert(analysis.tailTimes.some(x=>/\d{2}\/\d{2}\/\d{2} · \d{2}:\d{2}/.test(x)),'exact native date/time not formatted');
    await save(page,engine,'long-thread',analysis);
  }finally{await context.close();}
}

async function cacheScenario(browser,engine){
  const html='<!doctype html><html><body class="ng8-ready"><main><p>Cache transaction lab</p></main></body></html>';
  const {context,page}=await basePage(browser,html,{pathname:'/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});
  try{
    await inject(page,{js:[jsFiles.cacheBus]});await page.waitForTimeout(120);
    const analysis=await page.evaluate(async()=>{
      const bus=window.__NIAKGPT_CACHE_BUS__;await bus.ready;const before=await bus.get();
      const target=before.chats[0].id;await Promise.all([
        bus.update(raw=>({...raw,at:Date.now(),chats:raw.chats.map(c=>c.id===target?{...c,title:'Delta A',updated:Date.now()}:c)})),
        bus.update(raw=>({...raw,at:Date.now(),cacheProof:'second-write'}))
      ]);
      const after=await bus.get(),stored=window.__niakgptTestStore['niakgpt-v08-cache'];
      return{active:bus.active(),beforeCount:before.chats.length,afterCount:after.chats.length,storedCount:stored.chats.length,title:after.chats.find(c=>c.id===target)?.title,proof:after.cacheProof||'',dataset:document.documentElement.dataset.ng96CacheBus||''};
    });
    assert(analysis.active,'cache bus inactive');assert(analysis.beforeCount===120&&analysis.afterCount===120&&analysis.storedCount===120,'cache update lost historical conversations');assert(analysis.title==='Delta A','first serialized delta was lost');assert(analysis.proof==='second-write','second serialized delta was lost');
    await save(page,engine,'cache-long-thread',analysis);
  }finally{await context.close();}
}

async function nativeDaScenario(browser,engine){
  const html=`<!doctype html><html><body class="ng8-ready"><nav><button id="newchat" aria-label="Nouveau chat"><svg width="24" height="24"><path d="M2 12h20"/></svg></button></nav><main><form><div id="prompt-textarea"></div><button id="attach" aria-label="Joindre"><svg width="24" height="24"><path d="M2 2h20v20H2z"/></svg></button></form></main></body></html>`;
  const {context,page}=await basePage(browser,html);
  try{
    await inject(page,{css:[cssFiles.nativeDa]});await page.waitForTimeout(100);
    const analysis=await page.evaluate(()=>({newChatColor:getComputedStyle(document.querySelector('#newchat svg')).color,attachBg:getComputedStyle(document.getElementById('attach')).backgroundColor,attachBorder:getComputedStyle(document.getElementById('attach')).borderTopColor}));
    assert(analysis.newChatColor!=='rgb(255, 255, 255)','native icon remained untouched white');assert(analysis.attachBg!=='rgba(0, 0, 0, 0)','composer native action lacks NiakGPT surface');
    await save(page,engine,'native-da',analysis);
  }finally{await context.close();}
}

await fs.rm(OUT,{recursive:true,force:true});
const summary={version:'0.9.62',engines:{}};
for(const [name,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const started=Date.now();
  try{
    await sidebarScenario(browser,name);
    await homeScenario(browser,name);
    await matrixScenario(browser,name);
    await longThreadScenario(browser,name);
    await cacheScenario(browser,name);
    await nativeDaScenario(browser,name);
    summary.engines[name]={ok:true,durationMs:Date.now()-started};
  }catch(error){summary.engines[name]={ok:false,durationMs:Date.now()-started,error:String(error?.stack||error)};throw error;}
  finally{await browser.close();await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));}
}
console.log(JSON.stringify(summary,null,2));
