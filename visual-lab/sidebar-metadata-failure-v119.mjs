import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const metadataJs=await fs.readFile(path.join(ROOT,'sidebar-metadata-v118.js'),'utf8');
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      window.__raw={projects:[{id:'dom-date',name:'17/08',domOnly:true}],chats:[{id:'c1',title:'Chat',projectId:'dom-date',href:'/g/g-p-good/c/c1'}],counts:{'dom-date':1},projectChats:{'dom-date':[]},indexedProjectIds:['dom-date']};
      window.__writes=0;window.__subscriptions=0;window.__diag=[];
      window.__NIAKGPT_CACHE_BUS__={get:async()=>window.__raw,peek:()=>window.__raw,update:async()=>{window.__writes++;throw new Error('forced_write_failure');},subscribe:()=>{window.__subscriptions++;return()=>{};}};
      window.chrome={storage:{local:{get:async()=>({'niakgpt-v08-cache':window.__raw}),set:async()=>{window.__writes++;throw new Error('forced_write_failure');}},onChanged:{addListener:()=>{}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag.push(`${k}:${v}`)};
    });
    const html='<!doctype html><html><body><nav data-testid="conversation-sidebar"><a href="/c/c1"><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a></nav></body></html>';
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(async js=>{let rejected=false,error='';try{await eval(js);}catch(err){rejected=true;error=String(err?.message||err);}return{rejected,error,ready:window.__NIAKGPT_METADATA_READY_118__||'',writes:window.__writes,subscriptions:window.__subscriptions,bad:(window.__raw.projects||[]).some(p=>p.id==='dom-date'),diag:window.__diag};},metadataJs);
    assert(outcome.rejected,`metadata barrier swallowed a persistence failure: ${JSON.stringify(outcome)}`);
    assert(outcome.ready==='error',`metadata barrier advertised ready after persistence failure: ${JSON.stringify(outcome)}`);
    assert(outcome.writes>=2,`metadata barrier did not perform its bounded retry: ${JSON.stringify(outcome)}`);
    assert(outcome.subscriptions===0,`metadata subscription armed after failed initial sanitation: ${JSON.stringify(outcome)}`);
    assert(outcome.bad,`failure fixture unexpectedly mutated the source cache: ${JSON.stringify(outcome)}`);
    assert(outcome.diag.some(v=>v.includes('ERREUR')&&v.includes('forced_write_failure')),`metadata failure diagnostic missing: ${JSON.stringify(outcome)}`);
    console.log(`${engine} sidebar metadata persistence failure barrier: PASS`);
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-metadata-failure-v119: ${Object.keys(engines).join(',')} PASS`);
await import('./sidebar-metadata-concurrency-v119.mjs');
await import('./sidebar-metadata-lifecycle-v119.mjs');
