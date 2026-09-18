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
const reclass=read('reclassify-v101.js');
const scrollGuard=read('conversation-scroll-guard-v133.js');
const browser=await launcher.launch({headless:true});
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
    await page.addScriptTag({content:projects});
    await page.addScriptTag({content:selfheal});
    await page.waitForTimeout(500);
    const got=await page.evaluate(()=>({
      pins:!!document.getElementById('ng8-pins'),
      hidden:document.getElementById('ng8-pins')?.hidden,
      preferred:document.getElementById('ng8-pins')?.dataset.ng102NativePreferred||'',
      nativeVisible:[...document.querySelectorAll('#native-projects [data-sidebar-item]')].every(x=>getComputedStyle(x).display!=='none'),
      pinsDiag:window.__diag['pins-ui']||'',
      uxDiag:window.__diag['sidebar-ux-119']||''
    }));
    assert.equal(got.pins,true);
    assert.equal(got.hidden,true,'local fallback duplicated the visible native Projects block');
    assert.equal(got.preferred,'1');
    assert.equal(got.nativeVisible,true);
    assert.match(got.pinsDiag,/^NATIF · 3\/3 Projects visibles/);
    assert.match(got.uxDiag,/Projects natifs seuls/);
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
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html data-ng86-activity="executing"><head><style>
      html,body{margin:0;height:100%;overflow:hidden}main{height:100%;display:flex;justify-content:center}
      #thread{height:420px;width:700px;overflow-y:auto;border:1px solid #444}
      .chunk{height:180px}.assistant{min-height:180px}
    </style></head><body><main><div id="thread">
      <div class="chunk"></div><div class="chunk"></div><div class="chunk"></div>
      <article data-testid="conversation-turn-9" class="assistant"><div data-message-author-role="assistant" id="assistant">streaming</div></article>
    </div><button data-testid="stop-generating">Stop</button></main></body></html>`}));
    await page.goto('https://chatgpt.com/c/'+C,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{const el=document.getElementById('thread');el.scrollTop=el.scrollHeight;});
    await page.addScriptTag({content:scrollGuard});
    await page.waitForTimeout(120);
    await page.evaluate(()=>{
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='260px';x.textContent='more';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    let got=await page.evaluate(()=>{const e=document.getElementById('thread');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d<5,'active generation pushed the user away from the bottom');
    assert.equal(got.sticky,'1');

    await page.evaluate(()=>{
      const e=document.getElementById('thread');e.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,bubbles:true}));e.scrollTop=Math.max(0,e.scrollTop-260);e.dispatchEvent(new Event('scroll',{bubbles:false}));
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='220px';x.textContent='more2';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    got=await page.evaluate(()=>{const e=document.getElementById('thread');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d>150,'intentional upward reading was overridden by the scroll guard');
    assert.equal(got.sticky,'0');

    await page.evaluate(()=>{
      const e=document.getElementById('thread');e.scrollTop=e.scrollHeight;e.dispatchEvent(new WheelEvent('wheel',{deltaY:180,bubbles:true}));e.dispatchEvent(new Event('scroll',{bubbles:false}));
    });
    await page.waitForTimeout(60);
    await page.evaluate(()=>{
      const a=document.getElementById('assistant'),x=document.createElement('div');x.style.height='240px';x.textContent='more3';a.appendChild(x);
    });
    await page.waitForTimeout(120);
    got=await page.evaluate(()=>{const e=document.getElementById('thread');return{d:e.scrollHeight-e.clientHeight-e.scrollTop,sticky:document.documentElement.dataset.ng133ScrollSticky};});
    assert.ok(got.d<5,'returning to bottom did not re-arm sticky generation following');
    assert.equal(got.sticky,'1');
  }finally{await page.close();}
}

try{
  await duplicateRecovery();
  await historicalCatchup();
  await generationScroll();
  console.log(`user-reported-v133 ${engineName}: OK`);
}finally{
  await browser.close();
}
