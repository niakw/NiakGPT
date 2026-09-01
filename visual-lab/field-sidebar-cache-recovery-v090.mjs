import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const files=['sidebar-projects-v121.js','project-state-selfheal-v102.js','sidebar-projects-authority-v112.js','sidebar-projects-authority-v112.css','ux-v131.js','ux-v131.css'];
const src=Object.fromEntries(await Promise.all(files.map(async file=>[file,await fs.readFile(path.join(ROOT,file),'utf8')])));
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'chromium').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(!engines[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const localProjects=Array.from({length:5},(_,i)=>({
  id:`dom-p-${i+1}`,
  name:['Studio','Research Lab','Cinema','Commerce Lab','Home Lab'][i],
  href:'',
  domOnly:true
}));
const chats=Array.from({length:9},(_,i)=>({
  id:`${String(i+1).padStart(8,'0')}-1111-4111-8111-${String(i+1).padStart(12,'0')}`,
  title:`Conversation ${i+1}`,
  projectId:`dom-p-${(i%5)+1}`,
  updated:1788269000000+i
}));

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));

  try{
    await page.addInitScript(({projects,chats})=>{
      const listeners=[];
      const store={
        'niakgpt-v08-cache':{
          schema:2,at:1,projects,chats,
          counts:Object.fromEntries(projects.map(p=>[p.id,chats.filter(c=>c.projectId===p.id).length])),
          indexedProjectIds:[],serverIndexedAt:0
        },
        'niakgpt-governance-v085':{seeded:true,coreProjectIds:[],hiddenProjectIds:[],locks:{}}
      };
      const emit=(changes)=>{for(const fn of [...listeners])fn(changes,'local');};
      window.__store=store;
      window.__rpcCalls=0;
      window.__diag=new Map();
      window.__NIAKGPT_DIAGNOSTICS__={set(k,v){window.__diag.set(k,String(v));},snapshot(){return Object.fromEntries(window.__diag);}};
      window.chrome={
        storage:{
          local:{
            get:async keys=>{
              if(typeof keys==='string')return{[keys]:store[keys]};
              const list=Array.isArray(keys)?keys:Object.keys(store);
              return Object.fromEntries(list.map(k=>[k,store[k]]));
            },
            set:async obj=>{
              const changes={};
              for(const [k,v] of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}
              emit(changes);
            }
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      window.__NIAKGPT_CACHE_BUS__={
        get:async()=>structuredClone(store['niakgpt-v08-cache']),
        peek:()=>structuredClone(store['niakgpt-v08-cache']),
        subscribe(fn){fn(structuredClone(store['niakgpt-v08-cache']));listeners.push((changes)=>{if(changes['niakgpt-v08-cache'])fn(structuredClone(changes['niakgpt-v08-cache'].newValue));});return()=>{};},
        update:async fn=>{
          const old=store['niakgpt-v08-cache'];
          const next=await fn(structuredClone(old));
          if(next&&next!==old){
            store['niakgpt-v08-cache']=next;
            emit({'niakgpt-v08-cache':{oldValue:old,newValue:next}});
          }
          return structuredClone(store['niakgpt-v08-cache']);
        }
      };
      document.addEventListener('niakgpt:rpc-request',()=>window.__rpcCalls++);
      window.__upgradeCanonical=async()=>{
        const current=store['niakgpt-v08-cache'];
        const mapped=projects.map((p,i)=>({
          ...p,id:`g-p-synthetic${i+1}`,href:`/g/g-p-synthetic${i+1}/project`,domOnly:false,nativeDom:false
        }));
        const idMap=new Map(projects.map((p,i)=>[p.id,mapped[i].id]));
        const next={
          ...current,at:Date.now(),projects:mapped,
          chats:current.chats.map(c=>({...c,projectId:idMap.get(c.projectId)||c.projectId})),
          counts:Object.fromEntries(mapped.map((p,i)=>[p.id,current.counts[projects[i].id]||0])),
          indexedProjectIds:mapped.map(p=>p.id),serverIndexedAt:Date.now()
        };
        const old=store['niakgpt-v08-cache'];store['niakgpt-v08-cache']=next;
        emit({'niakgpt-v08-cache':{oldValue:old,newValue:next}});
      };
    },{projects:localProjects,chats});

    const html=`<!doctype html><html data-ng86-activity="ready" data-ng8-tab-role="worker"><head><meta charset="utf-8"><style>
      html,body{margin:0;background:#0b0f14;color:#e7edf5;font:14px system-ui}
      nav{width:310px;height:900px;overflow:auto;background:#10151c;padding:8px;box-sizing:border-box}
      #primary>a,#primary>button,[data-sidebar-item="true"],#native-chats>a{display:block;width:100%;min-height:36px;padding:8px;box-sizing:border-box;color:inherit;background:transparent;border:0;text-align:left}
      #native-projects,#native-chats,#ng8-pins{display:block;margin:8px 0;padding:8px;border:1px solid #263243}
      [role="heading"]{padding:4px 8px;font-weight:600}
      .project-unfurl-row{min-height:34px}
      #ng8-pins a{display:flex;gap:8px;padding:7px;color:inherit;text-decoration:none}
      main{position:fixed;left:310px;right:0;top:0;bottom:0;padding:28px}
    </style></head><body>
      <nav data-testid="conversation-sidebar" id="sidebar">
        <div id="primary">
          <a href="/">Nouveau chat</a>
          <a href="/search">Rechercher</a>
        </div>
        <section id="native-recents">
          <a data-sidebar-item="true" href="/c/11111111-1111-4111-8111-111111111111">Continuer la tâche</a>
          <a data-sidebar-item="true" href="/c/22222222-1111-4111-8111-222222222222">Reprise sur retry</a>
        </section>
        <section id="native-projects" class="group/sidebar-expando-section">
          ${['Studio','Research Lab','Cinema','Commerce Lab','Home Lab'].map((name,i)=>`<div class="group/project-unfurl-row"><div data-sidebar-item="true" data-row="${i+1}">${name}</div></div>`).join('')}
          <button type="button">Afficher plus</button>
        </section>
        <section id="native-chats">
          <div role="heading">Chats</div>
          <a href="/c/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa">Discussion récente</a>
        </section>
      </nav>
      <main><article data-message-author-role="user">Conversation active</article></main>
    </body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/g/g-p-active/c/99999999-1111-4111-8111-999999999999',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:src['sidebar-projects-authority-v112.css']});
    await page.addStyleTag({content:src['ux-v131.css']});
    // Production order: authority first, v121 placement owner, self-heal later, UX guard last.
    await page.addScriptTag({content:src['sidebar-projects-authority-v112.js']});
    await page.addScriptTag({content:src['sidebar-projects-v121.js']});
    await page.addScriptTag({content:src['project-state-selfheal-v102.js']});
    await page.addScriptTag({content:src['ux-v131.js']});
    await page.waitForFunction(()=>document.querySelector('#ng8-pins[data-ng102-fallback="1"][data-ng131-mounted="1"] [data-ng102-project]'),null,{timeout:6000});

    const recovery=await page.evaluate(()=>{
      const box=document.getElementById('ng8-pins'),native=document.getElementById('native-projects'),chats=document.getElementById('native-chats');
      const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&!el.hidden&&r.width>0&&r.height>0;};
      return{
        box:!!box,
        fallback:box?.dataset.ng102Fallback||'',
        localCount:box?.querySelectorAll('[data-ng102-project]').length||0,
        canonicalCount:box?.querySelectorAll('a[data-ng8-pin][href*="/g/g-p-"]').length||0,
        order:box&&native&&chats?[
          !!(box.compareDocumentPosition(native)&Node.DOCUMENT_POSITION_FOLLOWING),
          !!(native.compareDocumentPosition(chats)&Node.DOCUMENT_POSITION_FOLLOWING)
        ]:[false,false],
        sameParent:box?.parentElement===native?.parentElement,
        nativeVisible:visible(native),
        nativeMark:native?.getAttribute('data-ng112-native-projects')||'',
        rpc:window.__rpcCalls,
        pinsDiag:window.__diag.get('pins-ui')||'',
        authorityDiag:window.__diag.get('projects-authority')||'',
        governance:(window.__store['niakgpt-governance-v085']?.coreProjectIds||[]).length,
        visible:visible(box),
        mounted:box?.dataset.ng131Mounted||'',
        placement:box?.dataset.ng121Placement||''
      };
    });

    assert(recovery.box,'managed Pins block missing in screenshot-shaped recovery');
    assert(recovery.fallback==='1',`local-only cache was not preserved as fallback: ${JSON.stringify(recovery)}`);
    assert(recovery.localCount===5,`expected 5 local fallback Projects, got ${recovery.localCount}`);
    assert(recovery.canonicalCount===0,'local fallback was incorrectly converted into canonical Project links');
    assert(recovery.sameParent&&recovery.order.every(Boolean),`Pins not placed before native Projects / above Chats: ${JSON.stringify(recovery)}`);
    assert(recovery.placement==='native-projects',`cached-name Project identity did not win the exact native slot: ${JSON.stringify(recovery)}`);
    assert(recovery.nativeVisible&&recovery.nativeMark!=='1',`native Projects were hidden before canonical identity existed: ${JSON.stringify(recovery)}`);
    assert(recovery.rpc===0,`local recovery emitted ChatGPT RPC during active conversation: ${recovery.rpc}`);
    assert(/RÉCUPÉRATION.*5 Projects cache local/i.test(recovery.pinsDiag),`wrong recovery diagnostic: ${recovery.pinsDiag}`);
    assert(recovery.governance===0,'local-only recovery invented canonical governance ownership');
    assert(recovery.visible&&recovery.mounted==='1',`fallback exists but UX guard keeps it invisible: ${JSON.stringify(recovery)}`);
    assert(/cache local.*Projects natifs conservés/i.test(recovery.authorityDiag),`authority diagnostic does not describe fallback truth: ${recovery.authorityDiag}`);

    // Reproduce the production failure: React remounts the whole sidebar after NiakGPT boot and
    // drops the injected child. The replacement still has only modern no-href Project rows.
    await page.evaluate(()=>{
      const old=document.getElementById('sidebar');
      const next=old.cloneNode(true);
      next.id='sidebar-remounted';
      next.querySelector('#ng8-pins')?.remove();
      old.replaceWith(next);
    });
    await page.waitForFunction(()=>document.querySelector('#sidebar-remounted #ng8-pins[data-ng102-fallback="1"][data-ng131-mounted="1"] [data-ng102-project]'),null,{timeout:6000});
    const remount=await page.evaluate(()=>{
      const root=document.getElementById('sidebar-remounted'),box=root?.querySelector('#ng8-pins'),native=root?.querySelector('#native-projects'),chats=root?.querySelector('#native-chats');
      const s=box?getComputedStyle(box):null,r=box?.getBoundingClientRect();
      return{
        box:!!box,
        localCount:box?.querySelectorAll('[data-ng102-project]').length||0,
        visible:!!box&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&!box.hidden&&r.width>0&&r.height>0,
        mounted:box?.dataset.ng131Mounted||'',
        fallback:box?.dataset.ng102Fallback||'',
        beforeNative:!!(box&&native&&(box.compareDocumentPosition(native)&Node.DOCUMENT_POSITION_FOLLOWING)),
        nativeBeforeChats:!!(native&&chats&&(native.compareDocumentPosition(chats)&Node.DOCUMENT_POSITION_FOLLOWING)),
        rpc:window.__rpcCalls,
        authority:window.__diag.get('projects-authority')||'',
        ux:window.__diag.get('ux-v131')||'',
        placement:box?.dataset.ng121Placement||''
      };
    });
    assert(remount.box&&remount.localCount===5&&remount.fallback==='1',`fallback was not recreated after sidebar remount: ${JSON.stringify(remount)}`);
    assert(remount.visible&&remount.mounted==='1',`recreated fallback is still visually hidden: ${JSON.stringify(remount)}`);
    assert(remount.beforeNative&&remount.nativeBeforeChats,`recreated Pins not above native Projects/Chats: ${JSON.stringify(remount)}`);
    assert(remount.placement==='native-projects',`remounted Pins fell back to a generic slot: ${JSON.stringify(remount)}`);
    assert(remount.rpc===0,`sidebar remount recovery emitted ChatGPT RPC during active chat: ${remount.rpc}`);
    assert(/cache local.*Projects natifs conservés/i.test(remount.authority),`wrong fallback authority after remount: ${JSON.stringify(remount)}`);

    await page.evaluate(()=>window.__upgradeCanonical());
    await page.waitForTimeout(850);

    const upgraded=await page.evaluate(()=>{
      const root=document.getElementById('sidebar-remounted')||document,box=root.querySelector('#ng8-pins'),native=root.querySelector('#native-projects');
      return{
        fallback:box?.dataset.ng102Fallback||'',
        pins:box?.querySelectorAll('a[data-ng8-pin="1"][href*="/g/g-p-"]').length||0,
        nativeMark:native?.getAttribute('data-ng112-native-projects')||'',
        nativeDisplay:native?getComputedStyle(native).display:'',
        rpc:window.__rpcCalls,
        diag:window.__diag.get('pins-ui')||'',
        mounted:box?.dataset.ng131Mounted||'',
        visible:!!box&&getComputedStyle(box).visibility!=='hidden'&&getComputedStyle(box).display!=='none'&&!box.hidden
      };
    });
    assert(upgraded.fallback!=='1',`fallback marker survived canonical upgrade: ${JSON.stringify(upgraded)}`);
    assert(upgraded.pins===5,`canonical upgrade did not render 5 Projects: ${JSON.stringify(upgraded)}`);
    assert(upgraded.nativeMark==='1'&&upgraded.nativeDisplay==='none',`native Projects not handed to authority after canonical upgrade: ${JSON.stringify(upgraded)}`);
    assert(upgraded.rpc===0,`canonical cache upgrade emitted ChatGPT RPC during active conversation: ${upgraded.rpc}`);
    assert(upgraded.visible&&upgraded.mounted==='1',`canonical Pins lost UX visibility after upgrade: ${JSON.stringify(upgraded)}`);
    assert(!errors.length,`page errors: ${errors.join(' | ')}`);

    console.log(`FIELD_SIDEBAR_CACHE_RECOVERY_V091_PASS engine=${engine} initial+react-remount+canonical-upgrade`);
  }finally{
    await context.close();
    await browser.close();
  }
}
