import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const ROOT=path.resolve(process.cwd(),'..');
const memoryJs=fs.readFileSync(path.join(ROOT,'project-memory-v132.js'),'utf8');
const projectsJs=fs.readFileSync(path.join(ROOT,'sidebar-projects-v121.js'),'utf8');
const authorityJs=fs.readFileSync(path.join(ROOT,'sidebar-projects-authority-v112.js'),'utf8');
const authorityCss=fs.readFileSync(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const browser=await chromium.launch({headless:true});

async function memoryCatalogRecovery(){
  const page=await browser.newPage({viewport:{width:1100,height:760}});
  try{
    await page.addInitScript(()=>{
      const P1='g-p-one123',P2='g-p-two456',P3='g-p-three789';
      const now=Date.now();
      const cache={
        schema:2,at:now,
        projects:[{id:P1,name:'NiakGPT',href:'/g/'+P1+'/project',domOnly:false}],
        chats:[{id:'11111111-1111-4111-8111-111111111111',title:'Current',projectId:P1,updated:now-1000}],
        counts:{[P1]:1},indexedProjectIds:[P1],serverIndexedAt:now
      };
      const store={
        'niakgpt-v08-cache':cache,
        'niakgpt-project-memory-prefs-v132':{autoSync:true,injectOnNewChat:true},
        'niakgpt-project-memory-state-v132':{},
        'niakgpt-project-memory-queue-v132':{}
      };
      const remote={
        'PROJECTS.json':JSON.stringify({schema:1,kind:'NiakGPTCachedBootstrap',projectCount:1,projects:[{id:P1,name:'NiakGPT',href:'/g/'+P1+'/project',knownConversationCount:1,cachedConversationCount:1,indexed:true}]}),
        ['projects/'+P2+'/project.json']:JSON.stringify({schema:1,id:P2,name:'NiakVIO',description:'providers streaming',instructions:'repair providers',conversationCount:171,knownConversationCount:171,indexed:true,updatedAt:new Date(now-2000).toISOString()}),
        ['projects/'+P3+'/project.json']:JSON.stringify({schema:1,id:P3,name:'Films',description:'cinema anime',instructions:'',conversationCount:12,knownConversationCount:12,indexed:true,updatedAt:new Date(now-3000).toISOString()})
      };
      const listeners=[];window.__commits=[];window.__remote=remote;window.__store=store;window.__diag={};
      const keysFor=keys=>typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(store);
      window.chrome={
        runtime:{
          id:'lab',lastError:null,getManifest:()=>({version:'0.9.114'}),
          sendMessage(message,cb){
            const reply=value=>queueMicrotask(()=>cb(value));
            const type=message?.type;
            if(type==='niakgpt:memory-status-v132')return reply({ok:true,connected:true,configured:true,tokenAvailable:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(type==='niakgpt:memory-read-v132'){
              const value=remote[String(message.path||'')];
              return reply(value===undefined?{ok:false,error:'github_http_404:not_found'}:{ok:true,content:value});
            }
            if(type==='niakgpt:memory-list-v132'&&message.path==='projects')return reply({ok:true,items:[
              {name:P1,type:'dir',path:'projects/'+P1,sha:'1'},
              {name:P2,type:'dir',path:'projects/'+P2,sha:'2'},
              {name:P3,type:'dir',path:'projects/'+P3,sha:'3'}
            ]});
            if(type==='niakgpt:memory-commit-v132'){
              const files=structuredClone(message.files||[]);window.__commits.push(files);
              for(const file of files)remote[String(file.path||'')]=String(file.content||'');
              return reply({ok:true,sha:'commit-'+window.__commits.length});
            }
            if(type==='niakgpt:memory-github-connect-repo-v132')return reply({ok:true,config:{repo:'synthetic/private',branch:'main',root:'.niakgpt-memory',authMode:'github-app'}});
            if(type==='niakgpt:memory-chatgpt-probe-v132')return reply({ok:false,error:'transport_unavailable'});
            return reply({ok:false,error:'unexpected:'+type});
          }
        },
        storage:{
          local:{
            async get(keys){return Object.fromEntries(keysFor(keys).filter(k=>store[k]!==undefined).map(k=>[k,structuredClone(store[k])]));},
            async set(obj){const changes={};for(const [k,v] of Object.entries(obj)){const oldValue=store[k];store[k]=structuredClone(v);changes[k]={oldValue,newValue:structuredClone(v)};}for(const fn of listeners)fn(changes,'local');},
            async remove(keys){for(const k of (Array.isArray(keys)?keys:[keys]))delete store[k];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><main>home</main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:memoryJs});
    await page.waitForFunction(()=>((window.__store['niakgpt-v08-cache']?.projects||[]).filter(p=>String(p.id||'').startsWith('g-p-')).length===3),null,{timeout:5000});
    const recovered=await page.evaluate(()=>({
      projects:window.__store['niakgpt-v08-cache'].projects.map(p=>({id:p.id,name:p.name,memoryRecovered:p.memoryRecovered===true})),
      counts:window.__store['niakgpt-v08-cache'].counts,
      diag:window.__diag['memory-catalog']||''
    }));
    assert.equal(recovered.projects.length,3);
    assert.equal(recovered.projects.find(p=>p.name==='NiakVIO')?.memoryRecovered,true);
    assert.equal(recovered.counts[P2],171);
    assert.equal(recovered.counts[P3],12);
    assert.match(recovered.diag,/RÉPARÉ · 3 Projects canoniques/);

    await page.evaluate(()=>window.__NIAKGPT_PROJECT_MEMORY__.githubConnectRepo({repo:'synthetic/private'}));
    await page.waitForFunction(()=>window.__commits.some(batch=>batch.some(file=>file.path==='PROJECTS.json')),null,{timeout:5000});
    const manifest=await page.evaluate(()=>{
      const batches=window.__commits.flat();
      const file=[...batches].reverse().find(row=>row.path==='PROJECTS.json');
      return JSON.parse(file.content);
    });
    assert.equal(manifest.projectCount,3,'cached bootstrap destructively shrank the vault Project catalog');
    assert.deepEqual(new Set(manifest.projects.map(p=>p.name)),new Set(['NiakGPT','NiakVIO','Films']));
    assert.equal(manifest.retainedProjectCount,0);
  }finally{await page.close();}
}

async function sidebarNoHrefNativeProjects(){
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  try{
    await page.addInitScript(()=>{
      const P1='g-p-one123',P2='g-p-two456',P3='g-p-three789';
      const raw={schema:2,projects:[
        {id:P1,name:'NiakGPT',href:'/g/'+P1+'/project',domOnly:false},
        {id:P2,name:'NiakVIO',href:'/g/'+P2+'/project',domOnly:false},
        {id:P3,name:'Films',href:'/g/'+P3+'/project',domOnly:false}
      ],chats:[],counts:{[P1]:21,[P2]:171,[P3]:12},indexedProjectIds:[P1,P2,P3],serverIndexedAt:Date.now()};
      const store={'niakgpt-v08-cache':raw,'niakgpt-governance-v085':{seeded:true,coreProjectIds:[P1,P2,P3],hiddenProjectIds:[],locks:{}}};
      const listeners=[];window.__store=store;window.__diag={};
      const keysFor=keys=>typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(store);
      window.chrome={storage:{local:{
        async get(keys){return Object.fromEntries(keysFor(keys).filter(k=>store[k]!==undefined).map(k=>[k,structuredClone(store[k])]));},
        async set(obj){const changes={};for(const[k,v]of Object.entries(obj)){const oldValue=store[k];store[k]=structuredClone(v);changes[k]={oldValue,newValue:structuredClone(v)};}for(const fn of listeners)fn(changes,'local');}
      },onChanged:{addListener(fn){listeners.push(fn);}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=String(v)};
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><head><style>
      *{box-sizing:border-box}html,body{margin:0}#side{width:320px;height:800px;overflow:auto;border-right:1px solid #333}
      #side>section{width:100%;padding:8px 10px}#primary a,#native-projects button,#native-chats a,#native-chats button{display:block;width:100%;min-height:34px;padding:7px;text-align:left}
      #ng8-pins{display:block;width:100%;min-height:60px}main{position:absolute;left:320px;top:0}
    </style></head><body>
      <nav id="side" data-testid="conversation-sidebar">
        <section id="primary"><a href="/">ChatGPT</a><a href="/new">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/search">Rechercher</a></section>
        <section id="native-projects">
          <div role="heading">Projects</div>
          <button data-sidebar-item="true"><span>NiakVIO</span></button>
          <button data-sidebar-item="true"><span>Administratif & Juridique</span></button>
          <button data-sidebar-item="true"><span>Films</span></button>
          <button>Afficher plus</button>
        </section>
        <section id="native-chats">
          <button aria-label="Chats"><span>Chats</span><span>⌄</span></button>
          <a data-sidebar-item="true" href="/c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa">Chat sans Project</a>
          <a data-sidebar-item="true" href="/c/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb">Autre chat</a>
        </section>
      </nav><main>ready</main></body></html>`}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:authorityCss});
    await page.addScriptTag({content:authorityJs});
    await page.addScriptTag({content:projectsJs});
    await page.waitForTimeout(700);
    const got=await page.evaluate(()=>{
      const box=document.getElementById('ng8-pins'),native=document.getElementById('native-projects'),chats=document.getElementById('native-chats');
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
      return{
        pins:!!box,pinCount:box?.querySelectorAll('a[data-ng8-pin="1"]').length||0,
        nativeVisible:visible(native),nativeMark:native?.getAttribute('data-ng112-native-projects')||'',
        chatsVisible:visible(chats),
        beforeChats:!!box&&!!(box.compareDocumentPosition(chats)&Node.DOCUMENT_POSITION_FOLLOWING),
        placement:box?.dataset.ng121Placement||'',
        authority:window.__diag['projects-authority']||''
      };
    });
    assert.equal(got.pins,true);
    assert.equal(got.pinCount,3);
    assert.equal(got.nativeVisible,false,'native no-href Projects rows remained visible');
    assert.equal(got.nativeMark,'1');
    assert.equal(got.chatsVisible,true,'generic Chats were hidden with Projects');
    assert.equal(got.beforeChats,true,'managed Projects did not stay above Chats');
    assert.match(got.authority,/Projects native\(s\) masquée\(s\)/);
  }finally{await page.close();}
}

try{
  await memoryCatalogRecovery();
  await sidebarNoHrefNativeProjects();
  console.log('project-catalog-recovery-v114: PASS vault anti-shrink + cache recovery + no-href native Projects + Pins above Chats');
}finally{await browser.close();}
