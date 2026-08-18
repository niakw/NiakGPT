import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const OUT=path.resolve('artifacts/finalization-v112');
const code=await fs.readFile(path.join(ROOT,'continuity-v112.js'),'utf8');
const ALL_ENGINES={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
if(requested&&!ALL_ENGINES[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const engines=requested?{[requested]:ALL_ENGINES[requested]}:ALL_ENGINES;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const oldId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const newId='cccccccc-cccc-cccc-cccc-cccccccccccc';
const projectId='g-p-niakgpt';

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:780},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(({oldId,projectId})=>{
      const store={
        'niakgpt-v08-cache':{schema:2,at:Date.now(),projects:[{id:projectId,name:'NiakGPT',description:'Extension locale power-user.',instructions:'Priorité stabilité et vitesse.'}],chats:[{id:oldId,title:'Correction interface finale',projectId,updated:Date.now()}]},
        'niakgpt-governance-v085':{autoResync:true,coreProjectIds:[projectId],locks:{}}
      };
      window.__testStore=store;window.__patches=[];
      window.chrome={runtime:{id:'niakgpt-test'},storage:{local:{
        get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},
        set:async obj=>Object.assign(store,obj)
      },onChanged:{addListener:()=>{}}}};
      window.__NIAKGPT_CONTINUITY__={getState:()=>({out:{[oldId]:{projectId,title:'Correction interface finale',history:'UTILISATEUR\nCorrige la sidebar.\n\n---\n\nASSISTANT\nTravail en cours.',sourceUrl:`https://chatgpt.com/c/${oldId}`}}})};
    },{oldId,projectId});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body class="ng8-ready"><main><a href="/c/${oldId}"><button class="ng100-continue">↗</button></a><div id="prompt-textarea" contenteditable="true"></div></main></body></html>`}));
    await page.goto(`https://chatgpt.com/c/${oldId}`,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:code});
    await page.locator('.ng100-continue').click();
    await page.waitForURL(`**/g/${projectId}/project`);
    const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('niakgpt-continuity-pending-v100')||'null'));
    assert(pending?.exactProject===true,'continuation does not carry exactProject');
    assert(pending?.projectId===projectId,`wrong pending Project ${pending?.projectId}`);
    assert(pending?.capsule?.startsWith('Reprends la conversation nommée « NiakGPT > Correction interface finale »'),'continuity prompt name missing');
    assert(pending?.capsule?.includes('PROJECT EXACT À CONSERVER : NiakGPT'),'exact Project instruction missing');
    assert(pending?.capsule?.includes('CONTEXTE COMPLET DISPONIBLE DU FIL PRÉCÉDENT'),'previous history missing');

    await page.goto(`https://chatgpt.com/g/${projectId}/c/${newId}`,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.addEventListener('niakgpt:rpc-request',event=>{
        const d=event.detail||{};if(d.method!=='PATCH')return;window.__patches.push({path:d.path,body:d.body});
        const cache=window.__testStore['niakgpt-v08-cache'];if(!cache.chats.some(c=>d.path.endsWith(c.id)))cache.chats.push({id:d.path.split('/').pop(),title:'Suite',projectId:'',updated:Date.now()});
        setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{}}})),15);
      },true);
    });
    await page.addScriptTag({content:code});
    await page.waitForTimeout(750);
    const result=await page.evaluate(({newId,projectId})=>{
      const store=window.__testStore,cache=store['niakgpt-v08-cache'],gov=store['niakgpt-governance-v085'];
      return{patches:window.__patches,chat:cache.chats.find(c=>c.id===newId),lock:gov.locks?.[newId],pending:sessionStorage.getItem('niakgpt-continuity-pending-v100'),projectId};
    },{newId,projectId});
    assert(result.patches.length===1,`expected one continuity PATCH, got ${result.patches.length}`);
    assert(result.patches[0]?.body?.gizmo_id===projectId,'continuation PATCH targets wrong Project');
    assert(result.chat?.projectId===projectId,'cache continuation Project not locked');
    assert(result.lock?.projectId===projectId&&result.lock?.source==='continuity-exact','governance exact Project lock missing');

    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});
    const analysis={pending:{projectId:pending.projectId,projectName:pending.projectName,chatName:pending.chatName,exactProject:pending.exactProject,capsuleStart:pending.capsule.slice(0,180)},result};
    await page.screenshot({path:path.join(dir,'continuity-exact-project.png'),fullPage:true});
    await fs.writeFile(path.join(dir,'continuity-exact-project.html'),await page.content());
    await fs.writeFile(path.join(dir,'continuity-exact-project.json'),JSON.stringify(analysis,null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`continuity-v112: ${Object.keys(engines).join(',')} PASS`);
