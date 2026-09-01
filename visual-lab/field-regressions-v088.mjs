import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [bridgeSource,projectsSource,authoritySource,uxSource,memorySource,pinFoldersSource,serverIndexSource]=await Promise.all([
  read('page-bridge.js'),
  read('sidebar-projects-v121.js'),
  read('sidebar-projects-authority-v112.js'),
  read('ux-v131.js'),
  read('project-memory-v132.js'),
  read('pin-folders-v096.js'),
  read('server-index-v100.js')
]);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const P1='g-p-aaaaaaaaaaaaaaaa',P2='g-p-bbbbbbbbbbbbbbbb';
const C1='11111111-1111-4111-8111-111111111111',C2='22222222-2222-4222-8222-222222222222';

async function pinsFieldRegression(browser){
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(({P1,P2,C1,C2})=>{
      const listeners=[];
      const store={
        'niakgpt-v08-cache':{
          schema:2,at:Date.now(),
          projects:[
            {id:P1,name:'NiakVIO',href:`/g/${P1}/project`,domOnly:false},
            {id:P2,name:'NiakGPT',href:`/g/${P2}/project`,domOnly:false}
          ],
          chats:[
            {id:C1,title:'Terminer le durcissement sécurité',projectId:P1,updated:Date.now(),href:`/g/${P1}/c/${C1}`},
            {id:C2,title:'Providers VF',projectId:P1,updated:Date.now()-1000,href:`/g/${P1}/c/${C2}`}
          ],
          projectChats:{[P1]:[
            {id:C1,title:'Terminer le durcissement sécurité',projectId:P1,updated:Date.now(),href:`/g/${P1}/c/${C1}`},
            {id:C2,title:'Providers VF',projectId:P1,updated:Date.now()-1000,href:`/g/${P1}/c/${C2}`}
          ]},
          counts:{[P1]:2,[P2]:0},indexedProjectIds:[P1]
        },
        'niakgpt-governance-v085':{coreProjectIds:[P1,P2],hiddenProjectIds:[]}
      };
      const clone=v=>v===undefined?undefined:structuredClone(v);
      window.chrome={
        runtime:{getManifest:()=>({version:'0.9.89'})},
        storage:{
          local:{
            async get(keys){
              if(keys==null)return clone(store);
              if(typeof keys==='string')return{[keys]:clone(store[keys])};
              if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>store[k]!==undefined).map(k=>[k,clone(store[k])]));
              if(keys&&typeof keys==='object')return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]===undefined?v:clone(store[k])]));
              return{};
            },
            async set(obj){
              const changes={};
              for(const [k,v] of Object.entries(obj||{})){changes[k]={oldValue:clone(store[k]),newValue:clone(v)};store[k]=clone(v);}
              for(const fn of listeners)fn(changes,'local');
            },
            async remove(keys){for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      window.__NIAKGPT_CACHE_BUS__={
        async get(){return clone(store['niakgpt-v08-cache']);},
        peek(){return clone(store['niakgpt-v08-cache']);},
        subscribe(fn){listeners.push((changes,area)=>{if(area==='local'&&changes['niakgpt-v08-cache'])fn(clone(changes['niakgpt-v08-cache'].newValue));});return()=>{};}
      };
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    },{P1,P2,C1,C2});

    const html=`<!doctype html><html><head><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
      body{background:#090d12;color:#d9e0e7;font-family:Arial}
      aside[data-testid="conversation-sidebar"]{position:fixed;left:0;top:0;bottom:0;width:310px;background:#0b1219;overflow:auto}
      #shell{min-height:100%;padding:8px}
      #primary,#native-projects,#recents{display:block;width:100%}
      #primary a,#native-projects a,#recents a{display:block;min-height:34px;padding:7px;color:#dde;text-decoration:none}
      #native-projects{padding-top:8px} #native-projects h3{margin:4px 8px}
      .native-row{display:block}.expanded{padding-left:22px}
      main{margin-left:310px;padding:30px}
    </style></head><body>
      <aside data-testid="conversation-sidebar"><div id="shell">
        <div id="primary">
          <a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/search">Rechercher</a>
        </div>
        <section id="native-projects">
          <h3>Projects</h3>
          <div class="native-row">
            <a href="/g/${P1}/project">NiakVIO</a>
            <div class="expanded">
              <a href="/g/${P1}/c/${C1}">Terminer le durcissement sécurité</a>
              <a href="/g/${P1}/c/${C2}">Providers VF</a>
            </div>
          </div>
          <button>Afficher plus</button>
        </section>
        <section id="recents"><h3>Récents</h3><a href="/c/33333333-3333-4333-8333-333333333333">Autre chat</a></section>
      </div></aside>
      <main><div data-message-author-role="user">Message terrain</div></main>
    </body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
    await page.goto(`https://chatgpt.com/g/${P1}/c/${C1}`,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:projectsSource});
    await page.addScriptTag({content:authoritySource});
    await page.addScriptTag({content:uxSource});
    await page.waitForFunction(()=>document.querySelector('#ng8-pins[data-ng131-mounted="1"]'),null,{timeout:5000});
    await page.waitForFunction(()=>document.getElementById('native-projects')?.dataset.ng112NativeProjects==='1',null,{timeout:5000});
    const state=await page.evaluate(()=>{const pins=document.getElementById('ng8-pins'),native=document.getElementById('native-projects'),shell=document.getElementById('shell');return{
      pins:!!pins,native:!!native,sameParent:pins?.parentElement===native?.parentElement,
      immediate:pins?.nextElementSibling===native,insideNative:!!native?.contains(pins),
      nativeSuppressed:native?.dataset.ng112NativeProjects||'',mounted:pins?.dataset.ng131Mounted||'',
      parentId:pins?.parentElement?.id||'',count:pins?.querySelectorAll('a[data-ng8-pin="1"]').length||0,
      shellContains:shell?.contains(pins)||false
    };});
    assert(state.pins&&state.native&&state.shellContains,'Pins/native Projects missing: '+JSON.stringify(state));
    assert(state.sameParent&&state.immediate&&!state.insideNative,'Pins were mounted inside/wrong side of expanded native Projects: '+JSON.stringify(state));
    assert(state.nativeSuppressed==='1','native Projects sibling was not deterministically suppressed: '+JSON.stringify(state));
    assert(state.mounted==='1'&&state.count===2,'managed Pins were not visible/complete: '+JSON.stringify(state));
    console.log('field-v088 Pins: PASS sibling-before-native expanded Project + deterministic suppression');
  }finally{await context.close();}
}


async function screenshotSidebarRegression(browser){
  const context=await browser.newContext({viewport:{width:900,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    const C3='33333333-3333-4333-8333-333333333333',C4='44444444-4444-4444-8444-444444444444';
    await page.addInitScript(({P1,C3,C4})=>{
      const listeners=[];
      const stale=[
        {id:C3,title:'Choisir un purificateur',projectId:P1,updated:Date.now()-1000},
        {id:C4,title:'Voyant batterie moteur arrêté',projectId:P1,updated:Date.now()-2000}
      ];
      const canonical=stale.map(row=>({...row,projectId:'',projectIdKnown:true}));
      const store={
        'niakgpt-v08-cache':{
          schema:2,at:Date.now(),
          projects:[{id:P1,name:'NiakVIO',href:`/g/${P1}/project`,domOnly:false}],
          chats:canonical,
          projectChats:{[P1]:stale},
          counts:{[P1]:2},indexedProjectIds:[P1]
        },
        'niakgpt-governance-v085':{coreProjectIds:[P1],hiddenProjectIds:[]}
      };
      const clone=v=>v===undefined?undefined:structuredClone(v);
      window.chrome={
        runtime:{getManifest:()=>({version:'0.9.89'})},
        storage:{
          local:{
            async get(keys){
              if(typeof keys==='string')return{[keys]:clone(store[keys])};
              if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>store[k]!==undefined).map(k=>[k,clone(store[k])]));
              return clone(store);
            },
            async set(obj){const changes={};for(const[k,v]of Object.entries(obj||{})){changes[k]={oldValue:clone(store[k]),newValue:clone(v)};store[k]=clone(v);}for(const fn of listeners)fn(changes,'local');}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      window.__NIAKGPT_CACHE_BUS__={
        async get(){return clone(store['niakgpt-v08-cache']);},
        peek(){return clone(store['niakgpt-v08-cache']);},
        subscribe(fn){listeners.push((changes,area)=>{if(area==='local'&&changes['niakgpt-v08-cache'])fn(clone(changes['niakgpt-v08-cache'].newValue));});return()=>{};}
      };
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    },{P1,C3,C4});
    const html=`<!doctype html><html><head><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
      body{background:#080d12;color:#dce4ed;font-family:Arial}
      aside[data-testid="conversation-sidebar"]{position:fixed;left:0;top:0;bottom:0;width:320px;background:#071018;overflow:auto}
      #shell{min-height:100%;padding:10px}
      #primary a,#native-chats a{display:block;min-height:38px;padding:8px;color:#dde;text-decoration:none}
      #native-chats{margin-top:12px}#native-chats h3{margin:8px 12px}
      main{margin-left:320px}
    </style></head><body>
      <aside data-testid="conversation-sidebar"><div id="shell">
        <div id="primary"><a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/apps">Plugins</a></div>
        <section id="native-chats"><h3>Chats</h3><a href="/c/${C3}">Choisir un purificateur</a><a href="/c/${C4}">Voyant batterie moteur arrêté</a></section>
      </div></aside><main></main>
    </body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:projectsSource});
    await page.addScriptTag({content:pinFoldersSource});
    await page.waitForFunction(()=>document.getElementById('ng8-pins'),null,{timeout:5000});
    const placed=await page.evaluate(()=>{const pins=document.getElementById('ng8-pins'),chats=document.getElementById('native-chats');return{
      beforeChats:pins?.nextElementSibling===chats,
      placement:pins?.dataset.ng121Placement||'',
      parent:pins?.parentElement?.id||''
    };});
    assert(placed.beforeChats&&placed.placement==='before-native-chats','screenshot shape still mounts Pins under native Chats: '+JSON.stringify(placed));
    const pin=page.locator('#ng8-pins a[data-ng8-pin="1"]').first();
    await pin.click();
    await page.waitForTimeout(80);
    const rows=await page.locator('#ng8-pins .ng96-chat-entry').count();
    assert(rows===0,'stale generic chats leaked into NiakVIO drawer: '+rows);
    console.log('field-v089 screenshot: PASS Pins before Chats + stale cross-project rows suppressed');
  }finally{await context.close();}
}

async function serverIndexOwnershipRegression(browser){
  const context=await browser.newContext({viewport:{width:900,height:700}});
  const page=await context.newPage();
  try{
    const C3='33333333-3333-4333-8333-333333333333';
    await page.addInitScript(({P1,C3})=>{
      const listeners=[];
      const store={'niakgpt-v08-cache':{
        schema:2,at:Date.now()-999999,serverIndexedAt:0,projectInventoryAt:Date.now(),
        projects:[{id:P1,name:'NiakVIO',href:`/g/${P1}/project`,domOnly:false}],
        chats:[{id:C3,title:'Choisir un purificateur',projectId:P1,updated:Date.now()-5000}],
        projectChats:{[P1]:[{id:C3,title:'Choisir un purificateur',projectId:P1,updated:Date.now()-5000}]},
        counts:{[P1]:1},indexedProjectIds:[P1]
      }};
      const clone=v=>v===undefined?undefined:structuredClone(v);
      window.__store=store;window.__rpc=[];
      window.chrome={storage:{
        local:{
          async get(key){return typeof key==='string'?{[key]:clone(store[key])}:clone(store);},
          async set(obj){for(const[k,v]of Object.entries(obj||{}))store[k]=clone(v);}
        },
        onChanged:{addListener(fn){listeners.push(fn);}}
      }};
      window.__NIAKGPT_CACHE_BUS__={
        async update(fn){store['niakgpt-v08-cache']=clone(fn(clone(store['niakgpt-v08-cache'])));return clone(store['niakgpt-v08-cache']);},
        async get(){return clone(store['niakgpt-v08-cache']);}
      };
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
      document.addEventListener('niakgpt:rpc-request',e=>{
        const d=e.detail||{};window.__rpc.push(d.path);
        let data={};
        if(d.path.includes('/gizmos/'+P1+'/conversations'))data={items:[],cursor:null};
        else if(d.path.startsWith('/backend-api/conversations'))data={items:[{id:C3,title:'Choisir un purificateur',gizmo_id:null,update_time:Date.now()/1000}],has_more:false,total:1};
        else if(d.path.includes('/gizmos/snorlax/sidebar'))data={items:[],cursor:null};
        document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data}}));
      });
    },{P1,C3});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><main></main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    const fastServerIndex=serverIndexSource.replace('const BACKGROUND_QUIET_MS=2*60*1000;','const BACKGROUND_QUIET_MS=50;');
    await page.addScriptTag({content:fastServerIndex});
    await page.waitForTimeout(80);
    await page.evaluate(()=>document.dispatchEvent(new CustomEvent('niakgpt:force-server-index')));
    await page.waitForFunction(({C3})=>{
      const c=window.__store?.['niakgpt-v08-cache']?.chats?.find(x=>x.id===C3);
      return c?.projectIdKnown===true&&c.projectId==='';
    },{C3},{timeout:7000});
    const state=await page.evaluate(({P1,C3})=>{const raw=window.__store['niakgpt-v08-cache'];return{
      chat:raw.chats.find(x=>x.id===C3),
      stale:(raw.projectChats?.[P1]||[]).some(x=>x.id===C3)
    };},{P1,C3});
    assert(state.chat?.projectId===''&&state.chat?.projectIdKnown===true&&!state.stale,'authoritative gizmo_id:null did not clear stale Project ownership: '+JSON.stringify(state));
    console.log('field-v089 ownership: PASS gizmo_id:null clears stale Project + projectChats residue');
  }finally{await context.close();}
}

async function networkFieldRegression(browser){
  const context=await browser.newContext({viewport:{width:1000,height:720}});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      window.__sessionCalls=0;window.__backendCalls=0;
      window.fetch=(input,init={})=>{
        const url=String(typeof input==='string'?input:input?.url||'');
        if(url.includes('/api/auth/session')){window.__sessionCalls++;return Promise.resolve(new Response(JSON.stringify({accessToken:'field-token'}),{status:200,headers:{'Content-Type':'application/json'}}));}
        if(url.includes('/backend-api/')){window.__backendCalls++;return Promise.resolve(new Response(JSON.stringify({items:[],cursor:null}),{status:200,headers:{'Content-Type':'application/json'}}));}
        return Promise.resolve(new Response('{}',{status:200}));
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><main><textarea id="prompt-textarea"></textarea></main></body></html>'}));
    await page.goto(`https://chatgpt.com/g/${P1}/c/${C1}`,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:bridgeSource});
    const rpc=detail=>page.evaluate(d=>new Promise(resolve=>{
      const id='field-'+crypto.randomUUID(),handler=e=>{if(e.detail?.id!==id)return;document.removeEventListener('niakgpt:rpc-response',handler);resolve(e.detail);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,...d}}));
    }),detail);
    const requests=[
      {path:`/backend-api/gizmos/${P1}/conversations?limit=20`,method:'GET',foreground:true},
      {path:'/backend-api/conversations?offset=0&limit=100',method:'GET'},
      {path:`/backend-api/conversation/${C1}`,method:'GET',memoryBootstrap:true,governance:true},
      {path:`/backend-api/conversation/${C1}`,method:'PATCH',body:{gizmo_id:P2},governance:true},
      {path:'/backend-api/projects',method:'POST',body:{instructions:'',name:'Synthetic',memory_scope:'unset'},governance:true},
      {path:`/backend-api/gizmos/${P2}`,method:'DELETE',governance:true}
    ];
    for(const request of requests){
      const result=await rpc(request);
      assert(result.error==='native_conversation_quiet'&&result.transport==='chat-route-guard','conversation request escaped absolute quarantine: '+JSON.stringify({request,result}));
    }
    let counts=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
    assert(counts.session===0&&counts.backend===0,'conversation quarantine emitted ChatGPT network: '+JSON.stringify(counts));

    await page.evaluate(()=>{history.pushState({},'', '/');document.documentElement.dataset.ng90PeerChatActive='1';});
    const peer=await rpc({path:`/backend-api/gizmos/${P1}/conversations?limit=20`,method:'GET',foreground:true});
    assert(peer.error==='native_conversation_quiet','visible peer chat did not block foreground traffic: '+JSON.stringify(peer));
    counts=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
    assert(counts.session===0&&counts.backend===0,'peer conversation emitted ChatGPT network: '+JSON.stringify(counts));

    await page.evaluate(()=>{delete document.documentElement.dataset.ng90PeerChatActive;});
    const offChat=await rpc({path:`/backend-api/gizmos/${P1}/conversations?limit=20`,method:'GET',foreground:true});
    assert(offChat.ok===true,'off-chat foreground read should remain available: '+JSON.stringify(offChat));
    counts=await page.evaluate(()=>({session:window.__sessionCalls,backend:window.__backendCalls}));
    assert(counts.session===1&&counts.backend===1,'off-chat foreground read should use exactly one auth/backend call: '+JSON.stringify(counts));
    console.log('field-v088 network: PASS zero NiakGPT ChatGPT-backend traffic for current/peer conversation, all methods');
  }finally{await context.close();}
}

async function memoryFieldRegression(browser){
  const context=await browser.newContext({viewport:{width:1000,height:720}});
  const page=await context.newPage();
  try{
    await page.addInitScript(({P1,P2,C1,C2})=>{
      const listeners=[];
      const store={
        'niakgpt-v08-cache':{
          schema:2,at:Date.now(),
          projects:[{id:P1,name:'Studio',href:`/g/${P1}/project`},{id:P2,name:'Research',href:`/g/${P2}/project`}],
          chats:[{id:C1,title:'Studio cached chat',projectId:P1,updated:Date.now()}],
          projectChats:{[P2]:[{id:C2,title:'Research cached chat',projectId:P2,updated:Date.now()-1000}]},
          counts:{[P1]:1,[P2]:1},indexedProjectIds:[P1,P2]
        },
        'niakgpt-project-memory-prefs-v132':{autoSync:true,injectOnNewChat:true}
      };
      const clone=v=>v===undefined?undefined:structuredClone(v);
      window.__commits=[];window.__chatRpc=[];window.__vaultConnected=false;
      window.chrome={
        runtime:{
          lastError:null,
          getManifest:()=>({version:'0.9.89'}),
          sendMessage(message,cb){
            const reply=value=>queueMicrotask(()=>cb(value));
            if(message.type==='niakgpt:memory-status-v132')return reply({ok:true,connected:window.__vaultConnected,configured:window.__vaultConnected,tokenAvailable:window.__vaultConnected,config:window.__vaultConnected?{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}:null,github:{authenticated:true,repositories:[{fullName:'synthetic/private',defaultBranch:'main'}]}});
            if(message.type==='niakgpt:memory-github-connect-repo-v132'){window.__vaultConnected=true;return reply({ok:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});}
            if(message.type==='niakgpt:memory-commit-v132'){window.__commits.push(clone({files:message.files,message:message.message}));return reply({ok:true,sha:'synthetic-'+window.__commits.length});}
            if(message.type==='niakgpt:memory-read-v132')return reply({ok:false,error:'github_http_404:not_found'});
            return reply({ok:false,error:'unexpected:'+message.type});
          }
        },
        storage:{
          local:{
            async get(keys){
              if(keys==null)return clone(store);
              if(typeof keys==='string')return{[keys]:clone(store[keys])};
              if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>store[k]!==undefined).map(k=>[k,clone(store[k])]));
              if(keys&&typeof keys==='object')return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]===undefined?v:clone(store[k])]));
              return{};
            },
            async set(obj){const changes={};for(const[k,v]of Object.entries(obj||{})){changes[k]={oldValue:clone(store[k]),newValue:clone(v)};store[k]=clone(v);}for(const fn of listeners)fn(changes,'local');},
            async remove(keys){const changes={};for(const k of(Array.isArray(keys)?keys:[keys])){if(store[k]!==undefined){changes[k]={oldValue:clone(store[k]),newValue:undefined};delete store[k];}}if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local');}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      document.addEventListener('niakgpt:rpc-request',e=>window.__chatRpc.push(clone(e.detail||{})));
    },{P1,P2,C1,C2});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><main>Project Memory field fixture</main></body></html>'}));
    await page.goto(`https://chatgpt.com/g/${P1}/c/${C1}`,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:memorySource});
    await page.waitForFunction(()=>!!window.__NIAKGPT_PROJECT_MEMORY__,null,{timeout:3000});
    const connected=await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.githubConnectRepo({repo:'synthetic/private',branch:'main',root:'.niakgpt-memory'}));
    assert(connected.ok===true&&connected.bootstrapWritten===true,'GitHub connection did not write cached bootstrap: '+JSON.stringify(connected));
    let result=await page.evaluate(()=>({
      commits:window.__commits,
      rpc:window.__chatRpc,
      state:window.__store
    })).catch(()=>null);
    // __store intentionally remains closure-private; only commit/RPC evidence is needed.
    const evidence=await page.evaluate(()=>({commits:window.__commits,rpc:window.__chatRpc}));
    const files=evidence.commits.flatMap(c=>c.files||[]);
    const paths=files.map(f=>String(f.path||''));
    assert(evidence.commits.length>=1,'no GitHub commit was emitted after vault selection');
    assert(paths.includes('PROJECTS.json'),'cached bootstrap PROJECTS.json missing: '+JSON.stringify(paths));
    for(const pid of [P1,P2]){
      assert(paths.includes(`projects/${pid}/project.json`),`project.json missing for ${pid}`);
      assert(paths.includes(`projects/${pid}/index.json`),`index.json missing for ${pid}`);
      assert(paths.includes(`projects/${pid}/PROJECT_STATE.md`),`PROJECT_STATE.md missing for ${pid}`);
    }
    assert(evidence.rpc.length===0,'cached GitHub bootstrap touched ChatGPT RPC during conversation: '+JSON.stringify(evidence.rpc));

    const before=evidence.commits.length;
    const manual=await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.syncNow({force:true}));
    assert(manual.ok===true&&manual.cachedOnly===true&&manual.historyDeferred===true,'manual sync on chat did not remain cached-only: '+JSON.stringify(manual));
    const after=await page.evaluate(()=>({commits:window.__commits.length,rpc:window.__chatRpc.length}));
    assert(after.commits>before,'manual cached-only sync did not write GitHub');
    assert(after.rpc===0,'manual cached-only sync touched ChatGPT RPC');
    console.log('field-v088 Project Memory: PASS immediate local-cache GitHub files + full history deferred + zero ChatGPT RPC');
  }finally{await context.close();}
}

const browser=await chromium.launch({headless:true});
try{
  await pinsFieldRegression(browser);
  await screenshotSidebarRegression(browser);
  await serverIndexOwnershipRegression(browser);
  await networkFieldRegression(browser);
  await memoryFieldRegression(browser);
}finally{await browser.close();}
console.log('field-regressions-v088: PASS Pins + screenshot placement + ownership cleanup + network + GitHub bootstrap');
