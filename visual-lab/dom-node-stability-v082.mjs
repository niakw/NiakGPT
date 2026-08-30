import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const sources={
  ux:await fs.readFile(path.join(ROOT,'ux-v131.js'),'utf8'),
  sidebar:await fs.readFile(path.join(ROOT,'sidebar-projects-v121.js'),'utf8')
};
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const selected=requested?{[requested]:engines[requested]}:engines;
if(requested&&!engines[requested])throw new Error('Unsupported NIAKGPT_BROWSER='+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [name,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  try{
    await page.addInitScript(()=>{
      const cache={
        projects:[
          {id:'g-p-alpha',name:'Alpha',href:'/g/g-p-alpha/project'},
          {id:'g-p-beta',name:'Beta',href:'/g/g-p-beta/project'}
        ],
        chats:[],
        counts:{'g-p-alpha':3,'g-p-beta':2}
      };
      const local={
        'niakgpt-v08-cache':cache,
        'niakgpt-governance-v085':{hiddenProjectIds:[],coreProjectIds:[]}
      };
      window.chrome={
        storage:{
          local:{
            async get(keys){
              if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>Object.prototype.hasOwnProperty.call(local,k)).map(k=>[k,local[k]]));
              if(typeof keys==='string')return Object.prototype.hasOwnProperty.call(local,keys)?{[keys]:local[keys]}:{};
              return {...local};
            },
            async set(obj){Object.assign(local,obj);},
            async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete local[k];}
          },
          onChanged:{addListener(){}}
        }
      };
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};

      const parentByNode=new WeakMap();
      let tokenSeq=0;
      window.__ngDomNodeStability={
        syntheticMoveNodeErrors:[],
        mountParents:[],
        nodeMissingErrors:[],
        tracked:0
      };
      const tokenFor=node=>{
        if(!node.__ngStableToken)Object.defineProperty(node,'__ngStableToken',{value:'pins-'+(++tokenSeq)});
        return node.__ngStableToken;
      };
      const relevant=node=>node instanceof Element&&(node.id==='ng8-pins'||node.dataset?.ng121MountPolicy==='direct-once'||node.dataset?.ng121Retired==='1');
      const record=(parent,node,kind)=>{
        if(!relevant(node))return;
        const token=tokenFor(node),old=parentByNode.get(node);
        if(node===parent||node.contains(parent)){
          window.__ngDomNodeStability.syntheticMoveNodeErrors.push('Cannot moveNode with nodeId: '+token+' - new parent is already a descendant.');
        }
        if(old&&old!==parent){
          window.__ngDomNodeStability.syntheticMoveNodeErrors.push('Cannot moveNode with nodeId: '+token+' - parent changed after mount via '+kind);
        }
        if(!old){
          parentByNode.set(node,parent);
          window.__ngDomNodeStability.mountParents.push({token,parentId:parent.id||parent.getAttribute?.('data-shell')||parent.tagName,kind});
          window.__ngDomNodeStability.tracked++;
        }
      };
      const nativeInsert=Node.prototype.insertBefore;
      Node.prototype.insertBefore=function(node,before){record(this,node,'insertBefore');return nativeInsert.call(this,node,before);};
      const nativeAppend=Node.prototype.appendChild;
      Node.prototype.appendChild=function(node){record(this,node,'appendChild');return nativeAppend.call(this,node);};
      const nativeAdjacent=Element.prototype.insertAdjacentElement;
      Element.prototype.insertAdjacentElement=function(position,node){
        const parent=/beforebegin|afterend/i.test(position)?this.parentElement:this;
        if(parent)record(parent,node,'insertAdjacentElement');
        return nativeAdjacent.call(this,position,node);
      };
    });

    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:`<!doctype html><html><head><style>
        body{margin:0;font-family:sans-serif}
        .shell{position:fixed;left:0;top:0;width:280px;height:820px;background:#111;color:#eee;display:block}
        .shell[aria-hidden="true"]{display:none}
        .primary,.native-projects{display:block;padding:8px}
        .primary a,.native-projects a{display:block;height:32px}
        main{margin-left:300px;padding:24px}
      </style></head><body>
        <nav class="shell" data-shell="chat-a" data-testid="conversation-sidebar">
          <div class="primary"><a href="/">Accueil</a><a href="/search">Recherche</a></div>
          <section class="native-projects"><div>Projects</div><a href="/g/g-p-alpha/project">Alpha</a><a href="/g/g-p-beta/project">Beta</a></section>
          <a href="/c/old-chat">Ancien chat</a>
        </nav>
        <main><article><div data-message-author-role="assistant">Conversation active</div></article><div id="prompt-textarea" contenteditable="true"></div></main>
      </body></html>`
    }));
    await page.goto('https://chatgpt.com/c/direct-chat',{waitUntil:'load'});
    await page.addScriptTag({content:sources.ux});
    await page.addScriptTag({content:sources.sidebar});

    await page.waitForFunction(()=>document.querySelector('[data-shell="chat-a"] #ng8-pins')?.dataset.ng121MountPolicy==='direct-once',null,{timeout:6000});
    const first=await page.evaluate(()=>{
      const box=document.querySelector('[data-shell="chat-a"] #ng8-pins');
      return{
        parent:box?.parentElement?.className||box?.parentElement?.tagName||'',
        next:box?.nextElementSibling?.className||'',
        mountPolicy:box?.dataset.ng121MountPolicy||'',
        mountCount:box?.dataset.ng121MountCount||'',
        pins:box?.querySelectorAll('a[data-ng8-pin="1"]').length||0,
        track:{...window.__ngDomNodeStability,mountParents:[...window.__ngDomNodeStability.mountParents],syntheticMoveNodeErrors:[...window.__ngDomNodeStability.syntheticMoveNodeErrors]}
      };
    });
    assert(first.mountPolicy==='direct-once',name+': Pins did not use direct-once mount');
    assert(first.mountCount==='1',name+': initial Pins mount count drift');
    assert(first.pins===2,name+': projects did not load directly on conversation');
    assert(first.next.includes('native-projects'),name+': Pins were not inserted directly before native Projects');
    assert(first.track.syntheticMoveNodeErrors.length===0,name+': initial Pins reparent detected');

    await page.evaluate(()=>{
      window.__oldPinsHandle=document.getElementById('ng8-pins');
      window.__oldPinsHandle.dataset.frozenHandle='old-shell-reference';
      const old=document.querySelector('[data-shell="chat-a"]');
      old.setAttribute('aria-hidden','true');
      const next=document.createElement('nav');
      next.className='shell';next.dataset.shell='chat-b';next.dataset.testid='conversation-sidebar';
      next.innerHTML='<div class="primary"><a href="/">Accueil</a><a href="/search">Recherche</a></div><section class="native-projects"><div>Projects</div><a href="/g/g-p-alpha/project">Alpha</a><a href="/g/g-p-beta/project">Beta</a></section><a href="/c/new-chat">Nouveau chat</a>';
      document.body.prepend(next);
      history.pushState({},'', '/c/new-chat');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await page.waitForFunction(()=>{
      const box=document.querySelector('[data-shell="chat-b"] #ng8-pins');
      return box&&box.dataset.ng121MountPolicy==='direct-once'&&box.querySelectorAll('a[data-ng8-pin="1"]').length===2;
    },null,{timeout:7000});

    const remount=await page.evaluate(()=>{
      const active=document.querySelector('[data-shell="chat-b"] #ng8-pins');
      const retired=document.querySelector('[data-shell="chat-a"] [data-ng121-retired="1"]');
      if(!active)window.__ngDomNodeStability.nodeMissingErrors.push('Node cannot be found in the current page.');
      return{
        path:location.pathname,
        activeParent:active?.parentElement?.className||'',
        activeNext:active?.nextElementSibling?.className||'',
        activeCount:active?.dataset.ng121MountCount||'',
        retired:!!retired,
        retiredConnected:!!retired?.isConnected,
        retiredFrozen:retired?.dataset.frozenHandle||'',
        moveErrors:[...window.__ngDomNodeStability.syntheticMoveNodeErrors],
        missingErrors:[...window.__ngDomNodeStability.nodeMissingErrors],
        mounts:[...window.__ngDomNodeStability.mountParents]
      };
    });
    assert(remount.path==='/c/new-chat',name+': fixture unexpectedly navigated away from chat');
    assert(remount.activeCount==='1',name+': active shell Pins were moved instead of freshly mounted');
    assert(remount.activeNext.includes('native-projects'),name+': remounted Pins did not land directly before native Projects: '+JSON.stringify(remount));
    assert(remount.retired&&remount.retiredConnected,name+': stale Pins node was moved/removed instead of retired in place');
    assert(remount.retiredFrozen==='old-shell-reference',name+': stale node handle was mutated after retirement');
    assert(remount.moveErrors.length===0,name+': late shell remount produced a synthetic Cannot moveNode');
    assert(remount.missingErrors.length===0,name+': Node cannot be found after shell remount');
    assert(remount.mounts.length===2,name+': expected exactly one direct mount per ChatGPT shell');

    await page.evaluate(()=>{
      document.querySelector('[data-shell="chat-a"]')?.remove();
      document.dispatchEvent(new CustomEvent('niakgpt:sidebar-projects-reconcile'));
    });
    await page.waitForTimeout(350);
    const afterRemoval=await page.evaluate(()=>({
      active:!!document.querySelector('[data-shell="chat-b"] #ng8-pins'),
      pins:document.querySelectorAll('[data-shell="chat-b"] #ng8-pins a[data-ng8-pin="1"]').length,
      moveErrors:[...window.__ngDomNodeStability.syntheticMoveNodeErrors],
      oldConnected:!!window.__oldPinsHandle?.isConnected
    }));
    assert(afterRemoval.active&&afterRemoval.pins===2,name+': active Pins disappeared after old shell removal');
    assert(afterRemoval.moveErrors.length===0,name+': stale-node cleanup triggered a move');
    assert(afterRemoval.oldConnected===false,name+': old shell reference should disconnect only when host removes its shell');

    const noisy=[...pageErrors,...consoleErrors].filter(x=>/Cannot moveNode|Node cannot be found|HierarchyRequestError/i.test(x));
    assert(noisy.length===0,name+': browser reported DOM node stability errors: '+noisy.join(' | '));
  }finally{
    await context.close();
    await browser.close();
  }
}

console.log('dom-node-stability-v082: PASS direct-once Pins mount + late shell remount + no stale-node reparent');
