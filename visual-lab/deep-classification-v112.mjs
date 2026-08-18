import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const OUT=path.resolve('artifacts/finalization-v112');
const code=await fs.readFile(path.join(ROOT,'reclassify-deep-v112.js'),'utf8');
const ALL_ENGINES={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
if(requested&&!ALL_ENGINES[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const engines=requested?{[requested]:ALL_ENGINES[requested]}:ALL_ENGINES;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:760},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const orphan='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const store={
        'niakgpt-v08-cache':{schema:2,at:Date.now(),projects:[
          {id:'g-p-niakvio',name:'NiakVIO',description:'Streaming TV providers devices'},
          {id:'g-p-films',name:'Films',description:'Cinéma séries anime'},
          {id:'g-p-tech',name:'Tech',description:'Code GitHub développement'}
        ],chats:[{id:orphan,title:'TV job...',projectId:'g-p-does-not-exist',updated:Date.now()}],counts:{'g-p-niakvio':4,'g-p-films':9,'g-p-tech':5}},
        'niakgpt-governance-v085':{autoResync:true,coreProjectIds:['g-p-niakvio','g-p-films','g-p-tech'],locks:{}},
        'niakgpt-reclassify-v101-state':{attempts:{}}
      };
      window.__testStore=store;window.__analysisRequests=0;window.__patches=[];
      window.chrome={runtime:{id:'niakgpt-test'},storage:{local:{
        get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},
        set:async obj=>Object.assign(store,obj)
      },onChanged:{addListener:()=>{}}}};
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><main><h1>Deep classification lab</h1><p>TV job orphan</p></main></body></html>'}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.addEventListener('niakgpt:analysis-request-v112',event=>{
        window.__analysisRequests++;
        const id=event.detail?.id;
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:analysis-response-v112',{detail:{id,ok:true,status:200,data:{messages:[
          {role:'user',text:'Le job TV NiakVIO plante sur les providers Android TV et les devices de streaming.'},
          {role:'assistant',text:'Analyse NiakVIO en cours.'},
          {role:'user',text:'Films cinéma anime Spielberg — ce message ne doit pas être nécessaire au classement.'}
        ]},transport:'lab'}})),20);
      },true);
      document.addEventListener('niakgpt:rpc-request',event=>{
        const d=event.detail||{};if(d.method!=='PATCH')return;window.__patches.push({path:d.path,body:d.body});
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{}}})),15);
      },true);
    });
    await page.addScriptTag({content:code});
    await page.evaluate(()=>document.dispatchEvent(new CustomEvent('niakgpt:server-index-complete')));
    await page.waitForTimeout(2100);
    const result=await page.evaluate(()=>{
      const cache=window.__testStore['niakgpt-v08-cache'];const chat=cache.chats.find(c=>c.id==='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
      return{analysisRequests:window.__analysisRequests,patches:window.__patches,projectId:chat?.projectId||'',diag:window.__NIAKGPT_DIAGNOSTICS__?.snapshot?.()||null};
    });
    assert(result.analysisRequests===1,`expected one deep fetch, got ${result.analysisRequests}`);
    assert(result.patches.length===1,`expected one PATCH, got ${result.patches.length}`);
    assert(result.patches[0]?.body?.gizmo_id==='g-p-niakvio',`wrong target ${JSON.stringify(result.patches)}`);
    assert(result.projectId==='g-p-niakvio',`cache not updated: ${result.projectId}`);
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,'deep-classification.png'),fullPage:true});
    await fs.writeFile(path.join(dir,'deep-classification.html'),await page.content());
    await fs.writeFile(path.join(dir,'deep-classification.json'),JSON.stringify(result,null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`deep-classification-v112: ${Object.keys(engines).join(',')} PASS`);
