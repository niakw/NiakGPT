import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const ROOT=path.resolve(process.cwd(),'..');
const engineName=process.env.NIAKGPT_BROWSER||'chromium';
const launcher={chromium,firefox,webkit}[engineName];
if(!launcher)throw new Error('unknown browser '+engineName);
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const selfheal=read('project-state-selfheal-v102.js');
const projects=read('sidebar-projects-v121.js');
const authority=read('sidebar-projects-authority-v112.js');
const authorityCss=read('sidebar-projects-authority-v112.css');
const reclass=read('reclassify-v101.js');
const scrollGuard=read('conversation-scroll-guard-v133.js');
const launchOptions={headless:process.env.NIAKGPT_HEADLESS==='0'?false:true};
if(process.env.NIAKGPT_EXECUTABLE_PATH&&engineName==='chromium')launchOptions.executablePath=process.env.NIAKGPT_EXECUTABLE_PATH;
const browser=await launcher.launch(launchOptions);
const ARTIFACTS=path.join(process.cwd(),'artifacts','user-reported-v095');
fs.mkdirSync(ARTIFACTS,{recursive:true});
const C='11111111-1111-4111-8111-111111111111';

async function duplicateRecovery(){
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  try{
    await page.addInitScript(()=>{
      const raw={
        schema:2,
        projects:[
          {id:'dom-p-studio',name:'Studio',domOnly:true},
          {id:'dom-p-cinema',name:'Cinema',domOnly:true},
          {id:'dom-p-commerce',name:'Commerce Lab',domOnly:true}
        ],
        chats:[],
        counts:{},
        indexedProjectIds:[],
        serverIndexedAt:0
      };
      const store={'niakgpt-v08-cache':raw,'niakgpt-governance-v085':{seeded:true,coreProjectIds:[],hiddenProjectIds:[],locks:{}}};
      const listeners=[];
      window.chrome={storage:{local:{
        get:async keys=>{
          if(typeof keys==='string')return {[keys]:store[keys]};
          const arr=Array.isArray(keys)?keys:Object.keys(store);
          return Object.fromEntries(arr.map(k=>[k,store[k]]));
        },
        set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){const oldValue=store[k];store[k]=v;changes[k]={oldValue,newValue:v};}for(const fn of listeners)fn(changes,'local');}
      },onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__diag={};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>
      <aside data-testid="conversation-sidebar" style="width:310px;height:800px">
        <a href="/">ChatGPT</a><a href="/search">Search</a>
        <section id="native-projects">
          <div data-sidebar-item="true"><button>Studio</button></div>
          <div data-sidebar-item="true"><button>Cinema</button></div>
          <div data-sidebar-item="true"><button>Commerce Lab</button></div>
          <button>Afficher plus</button>
        </section>
        <section><a href="/c/${C}">Recent chat</a></section>
      </aside>
      <main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">ready</div></article></main>
    </body></html>`}));
    await page.goto('https://chatgpt.com/c/'+C,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:authorityCss});
    await page.addScriptTag({content:authority});
    await page.addScriptTag({content:projects});
    await page.addScriptTag({content:selfheal});
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(ARTIFACTS,`${engineName}-01-project-recovery.png`),fullPage:true});
    const got=await page.evaluate(()=>{
      const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&!el.hidden&&r.width>0&&r.height>0;};
      const native=document.getElementById('native-projects');
      return{
        pins:!!document.getElementById('ng8-pins'),
        hidden:document.getElementById('ng8-pins')?.hidden,
        preferred:document.getElementById('ng8-pins')?.dataset.ng102NativePreferred||'',
        nativeVisible:visible(native),
        nativeMark:native?.getAttribute('data-ng112-native-projects')||'',
        pinsDiag:window.__diag['pins-ui']||'',
        authorityDiag:window.__diag['projects-authority']||'',
        uxDiag:window.__diag['sidebar-ux-119']||''
      };
    });
    assert.equal(got.pins,true);
    assert.equal(got.hidden,false,'NiakGPT recovery surface was hidden instead of becoming the single Projects authority');
    assert.equal(got.preferred,'');
    assert.equal(got.nativeVisible,false,'native Projects remained visually visible beside the NiakGPT recovery surface');
    assert.equal(got.nativeMark,'1','v112 did not acquire the native Projects host');
    assert.match(got.authorityDiag,/surface\(s\) Projects native\(s\) masquée\(s\)/);
    assert.match(got.pinsDiag,/^RÉCUPÉRATION · 3 Projects cache local · surface NiakGPT unique/);
    assert.match(got.uxDiag,/autorité v121 unique · natif masqué/);
  }finally{await page.close();}
}

async function falseMirrorRecovery(){
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  try{
    await page.addInitScript(()=>{
      const raw={
        schema:2,
        projects:[
          {id:'dom-p-studio',name:'Studio',domOnly:true},
          {id:'dom-p-cinema',name:'Cinema',domOnly:true},
          {id:'dom-p-commerce',name:'Commerce Lab',domOnly:true}
        ],
        chats:[],counts:{},indexedProjectIds:[],serverIndexedAt:0
      };
      const store={'niakgpt-v08-cache':raw,'niakgpt-governance-v085':{seeded:true,coreProjectIds:[],hiddenProjectIds:[],locks:{}}};
      const listeners=[];
      window.chrome={storage:{local:{
        get:async keys=>{
          if(typeof keys==='string')return {[keys]:store[keys]};
          const arr=Array.isArray(keys)?keys:Object.keys(store);
          return Object.fromEntries(arr.map(k=>[k,store[k]]));
        },
        set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){const oldValue=store[k];store[k]=v;changes[k]={oldValue,newValue:v};}for(const fn of listeners)fn(changes,'local');}
      },onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__diag={};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>
      <aside data-testid="conversation-sidebar" style="width:310px;height:800px">
        <a href="/">ChatGPT</a><a href="/search">Search</a>
        <section id="recent-chats">
          <div data-sidebar-item="true"><a href="/c/22222222-2222-4222-8222-222222222222">Studio</a></div>
          <div data-sidebar-item="true"><a href="/c/33333333-3333-4333-8333-333333333333">Cinema</a></div>
          <div data-sidebar-item="true"><a href="/c/44444444-4444-4444-8444-444444444444">Commerce Lab</a></div>
        </section>
      </aside>
      <main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">ready</div></article></main>
    </body></html>`}));
    await page.goto('https://chatgpt.com/c/'+C,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:projects});
    await page.addScriptTag({content:selfheal});
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(ARTIFACTS,`${engineName}-01b-false-native-mirror.png`),fullPage:true});
    const got=await page.evaluate(()=>({
      hidden:document.getElementById('ng8-pins')?.hidden,
      preferred:document.getElementById('ng8-pins')?.dataset.ng102NativePreferred||'',
      fallback:document.getElementById('ng8-pins')?.dataset.ng102Fallback||'',
      localCount:document.querySelectorAll('#ng8-pins [data-ng102-project]').length,
      pinsDiag:window.__diag['pins-ui']||''
    }));
    assert.equal(got.hidden,false,'recent chat titles were mistaken for a native Projects mirror');
    assert.equal(got.preferred,'');
    assert.equal(got.fallback,'1');
    assert.equal(got.localCount,3);
    assert.match(got.pinsDiag,/RÉCUPÉRATION.*surface NiakGPT unique/);
  }finally{await page.close();}
}

async function historicalCatchup(){
  const page=await browser.newPage({viewport:{width:1100,height:720}});
  try{
    await page.addInitScript(chatId=>{
      const now=Date.now(),tech='g-p-tech123',films='g-p-films123';
      const raw={
        schema:2,
        projects:[
          {id:tech,name:'Tech & Développement',description:'code github extension chrome'},
          {id:films,name:'Films',description:'cinema anime films'}
        ],
        chats:[{id:chatId,title:'Bug extension Chrome GitHub API',snippet:'javascript code runtime extension',projectId:'',updated:now-30*24*60*60*1000}],
        counts:{[tech]:0,[films]:0},
        indexedProjectIds:[tech,films],
        serverIndexedAt:now
      };
      const store={'niakgpt-v08-cache':raw,'niakgpt-governance-v085':{seeded:true,coreProjectIds:[tech,films],hiddenProjectIds:[],locks:{},autoResync:true}};
      const listeners=[];
      window.chrome={storage:{local:{
        get:async keys=>{
          if(typeof keys==='string')return {[keys]:store[keys]};
          const arr=Array.isArray(keys)?keys:Object.keys(store);
          return Object.fromEntries(arr.map(k=>[k,store[k]]));
        },
        set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){const oldValue=store[k];store[k]=v;changes[k]={oldValue,newValue:v};}for(const fn of listeners)fn(changes,'local');}
      },onChanged:{addListener:fn=>listeners.push(fn)}}};
      try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'lock'})}});}catch{}
      window.__store=store;window.__rpc=[];window.__diag={};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
      window.__NIAKGPT_CACHE_BUS__={update:async fn=>{store['niakgpt-v08-cache']=fn(store['niakgpt-v08-cache']);return store['niakgpt-v08-cache'];}};
      document.addEventListener('niakgpt:rpc-request',e=>{
        const d=e.detail||{};window.__rpc.push({path:d.path,method:d.method,body:d.body});
        queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{gizmo_id:d.body?.gizmo_id||null}}})));
      });
    },C);
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html data-ng86-activity="ready"><body><main>home</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:reclass});
    await page.waitForTimeout(3600);
    const got=await page.evaluate(chatId=>({
      pid:window.__store['niakgpt-v08-cache'].chats.find(c=>c.id===chatId)?.projectId||'',
      rpc:window.__rpc,
      diag:window.__diag['reclassement']||''
    }),C);
    assert.equal(got.pid,'g-p-tech123','30-day unassigned chat was not caught up after complete canonical index');
    assert.equal(got.rpc.filter(x=>x.method==='PATCH').length,1);
    assert.equal(got.rpc.filter(x=>x.method==='GET').length,0);
    assert.match(got.diag,/historique complet/);
  }finally{await page.close();}
}

async function generationScroll(){
  const page=await browser.newPage({viewport:{width:1100,height:760}});
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html data-ng86-activity="ready"><head><style>
      html,body{margin:0;height:100%;overflow:hidden}
      body{display:grid;grid-template-columns:180px 1fr}
      #side-scroll{height:100vh;overflow-y:auto;border-right:1px solid #444}
      #shell{height:100vh;overflow-y:auto;position:relative}
      main{min-height:100%;display:block;padding:20px 40px 120px}
      #decoy{position:absolute;left:-9999px;top:0;width:80px;height:70px;overflow:visible}
      .chunk{height:260px}.assistant{min-height:180px}
      #composer-wrap{position:fixed;left:260px;right:40px;bottom:20px;background:#222;padding:8px}
    </style></head><body>
      <aside id="side-scroll"><div style="height:1600px">sidebar</div></aside>
      <div id="shell">
        <main>
          <div id="decoy"><div style="height:2600px"><div data-message-author-role="assistant">decoy</div></div></div>
          <div class="chunk"></div><div class="chunk"></div><div class="chunk"></div>
          <article data-testid="conversation-turn-8"><div data-message-author-role="user">previous</div></article>
          <article data-testid="conversation-turn-9" class="assistant"><div data-message-author-role="assistant" id="assistant">ready</div></article>
          <div id="composer-wrap"><textarea id="composer" data-testid="prompt-textarea"></textarea><button id="send" data-testid="send-button" aria-label="Envoyer">Send</button></div>
        </main>
      </div>
      <script>
        const shell=document.getElementById('shell'),send=document.getElementById('send'),assistant=document.getElementById('assistant');
        window.__nativeSabotage=0;window.__nativeLateSabotage=0;
        send.addEventListener('pointerdown',()=>{
          requestAnimationFrame(()=>{shell.scrollTop=0;window.__nativeSabotage++;});
          setTimeout(()=>{
            document.documentElement.dataset.ng86Activity='executing';
            document.dispatchEvent(new CustomEvent('niakgpt:activity-changed'));
            const stop=document.createElement('button');stop.id='stop';stop.dataset.testid='stop-generating';stop.setAttribute('aria-label','Stop generating');document.body.appendChild(stop);
          },25);
          [70,130,210].forEach((ms,i)=>setTimeout(()=>{
            const x=document.createElement('div');x.style.height=(220+i*40)+'px';x.textContent='stream-'+i;assistant.appendChild(x);
            // Simulate a native ChatGPT scrollIntoView/layout correction fighting our guard.
            requestAnimationFrame(()=>{if(i<2)shell.scrollTop=Math.max(0,shell.scrollTop-500);});
          },ms));
          // Field regression: a native correction can arrive well after the last stream mutation.
          setTimeout(()=>requestAnimationFrame(()=>{
            shell.scrollTop=Math.max(0,shell.scrollTop-620);window.__nativeLateSabotage++;
          }),520);
        });
      <\/script>
    </body></html>`}));
    await page.goto('https://chatgpt.com/c/'+C,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{const e=document.getElementById('shell');e.scrollTop=e.scrollHeight;});
    await page.addScriptTag({content:scrollGuard});
    await page.waitForTimeout(80);

    // Exact field failure: user sends from the bottom, native ChatGPT immediately yanks the
    // scroll container upward, then the assistant grows over several later frames.
    await page.locator('#send').dispatchEvent('pointerdown');
    await page.waitForTimeout(380);
    let got=await page.evaluate(()=>{const e=document.getElementById('shell');return{
      d:e.scrollHeight-e.clientHeight-e.scrollTop,
      top:e.scrollTop,
      sticky:document.documentElement.dataset.ng133ScrollSticky,
      root:document.documentElement.dataset.ng133ScrollRoot,
      restore:document.documentElement.dataset.ng133ScrollRestore,
      sabotage:window.__nativeSabotage
    };});
    assert.equal(got.sabotage,1,'native scroll sabotage did not run');
    assert.ok(got.d<8,`send/generation path still ended above the bottom: ${JSON.stringify(got)}`);
    assert.equal(got.sticky,'1');
    assert.equal(got.root,'shell','guard did not bind to the ancestor conversation scroller');
    await page.waitForTimeout(320);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{
      d:e.scrollHeight-e.clientHeight-e.scrollTop,
      sticky:document.documentElement.dataset.ng133ScrollSticky,
      restore:document.documentElement.dataset.ng133ScrollRestore,
      lateSabotage:window.__nativeLateSabotage
    };});
    assert.equal(got.lateSabotage,1,'late native scroll sabotage did not run');
    assert.ok(got.d<8,`late native correction escaped the live-follow guard: ${JSON.stringify(got)}`);
    assert.equal(got.sticky,'1','late native correction was mistaken for deliberate user reading');
    assert.match(String(got.restore||''),/correction scroll native|mutation|resize|raf/);
    await page.screenshot({path:path.join(ARTIFACTS,`${engineName}-02-post-send-live-scroll.png`),fullPage:true});

    await page.evaluate(()=>{
      const e=document.getElementById('shell');e.dispatchEvent(new WheelEvent('wheel',{deltaY:-220,bubbles:true}));e.scrollTop=Math.max(0,e.scrollTop-360);e.dispatchEvent(new Event('scroll',{bubbles:false}));
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='240px';x.textContent='read-up';a.appendChild(x);
    });
    await page.waitForTimeout(140);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d>180,'intentional upward reading was overridden by the scroll guard');
    assert.equal(got.sticky,'0');

    await page.evaluate(()=>{
      const e=document.getElementById('shell');e.scrollTop=e.scrollHeight;e.dispatchEvent(new WheelEvent('wheel',{deltaY:220,bubbles:true}));e.dispatchEvent(new Event('scroll',{bubbles:false}));
    });
    await page.waitForTimeout(70);
    await page.evaluate(()=>{const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='260px';x.textContent='bottom-again';a.appendChild(x);});
    await page.waitForTimeout(140);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d<8,'returning to bottom did not re-arm live following');
    assert.equal(got.sticky,'1');

    await page.evaluate(()=>{
      const side=document.getElementById('side-scroll');side.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,bubbles:true}));
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='180px';x.textContent='sidebar-wheel';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d<8,'sidebar scrolling disabled live answer following');

    await page.evaluate(()=>{
      const composer=document.getElementById('composer');composer.focus();composer.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='180px';x.textContent='composer-key';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d<8,'composer ArrowUp was mistaken for conversation scrolling');

    await page.evaluate(()=>{
      const e=document.getElementById('shell');
      const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientY:180}]});e.dispatchEvent(start);
      const move=new Event('touchmove',{bubbles:true});Object.defineProperty(move,'touches',{value:[{clientY:330}]});e.dispatchEvent(move);
      e.scrollTop=Math.max(0,e.scrollTop-300);e.dispatchEvent(new Event('scroll',{bubbles:false}));
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='200px';x.textContent='touch-read';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    got=await page.evaluate(()=>{const e=document.getElementById('shell');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d>180,'touch upward-reading intent was overridden');
    assert.equal(got.sticky,'0');
  }finally{await page.close();}
}

async function generationScrollRootMigration(){
  const page=await browser.newPage({viewport:{width:1100,height:760}});
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html data-ng86-activity="ready"><head><style>
      html,body{margin:0;height:100%;overflow:hidden}
      #outer{height:100vh;overflow:hidden}
      #shell{height:100vh;overflow-y:auto}
      main{min-height:100%;padding:20px 40px 120px}
      .chunk{height:300px}
      #composer{position:fixed;left:180px;right:40px;bottom:20px;background:#222;padding:12px}
    </style></head><body>
      <div id="outer"><div id="shell"><main>
        <div class="chunk"></div><div class="chunk"></div><div class="chunk"></div>
        <article data-testid="conversation-turn-20"><div data-message-author-role="assistant" id="answer">ready</div></article>
        <div id="composer"><button id="send" data-testid="send-button" aria-label="Envoyer">Send</button></div>
      </main></div></div>
      <script>
        const outer=document.getElementById('outer'),shell=document.getElementById('shell'),answer=document.getElementById('answer');
        document.getElementById('send').addEventListener('pointerdown',()=>{
          document.documentElement.dataset.ng86Activity='executing';
          document.dispatchEvent(new CustomEvent('niakgpt:activity-changed'));
          setTimeout(()=>{
            outer.style.overflowY='auto';
            shell.style.height='auto';
            shell.style.overflow='visible';
            const growth=document.createElement('div');growth.style.height='720px';growth.textContent='root-migration-growth';answer.appendChild(growth);
            outer.scrollTop=0;
          },120);
        });
      <\/script>
    </body></html>`}));
    await page.goto('https://chatgpt.com/c/'+C,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{const e=document.getElementById('shell');e.scrollTop=e.scrollHeight;});
    await page.addScriptTag({content:scrollGuard});
    await page.waitForTimeout(80);
    await page.locator('#send').dispatchEvent('pointerdown');
    await page.waitForTimeout(420);
    const got=await page.evaluate(()=>{
      const outer=document.getElementById('outer');
      return{
        d:outer.scrollHeight-outer.clientHeight-outer.scrollTop,
        root:document.documentElement.dataset.ng133ScrollRoot,
        sticky:document.documentElement.dataset.ng133ScrollSticky,
        restore:document.documentElement.dataset.ng133ScrollRestore
      };
    });
    assert.equal(got.root,'outer','scroll authority did not migrate to the new live conversation scroller');
    assert.equal(got.sticky,'1','root migration disabled live answer following');
    assert.ok(got.d<8,`new scroll root was not pinned after ownership migration: ${JSON.stringify(got)}`);
    await page.screenshot({path:path.join(ARTIFACTS,`${engineName}-03-scroll-root-migration.png`),fullPage:true});
  }finally{await page.close();}
}

try{
  await duplicateRecovery();
  await falseMirrorRecovery();
  await historicalCatchup();
  await generationScroll();
  await generationScrollRootMigration();
  console.log(`user-reported-v133 ${engineName}: OK`);
}finally{
  await browser.close();
}
