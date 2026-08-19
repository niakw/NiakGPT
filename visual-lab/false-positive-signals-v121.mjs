import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const [continuityJs,interruptJs,breadcrumbJs]=await Promise.all([
  fs.readFile(path.join(ROOT,'continuity-v100.js'),'utf8'),
  fs.readFile(path.join(ROOT,'interruption-guard-v119.js'),'utf8'),
  fs.readFile(path.join(ROOT,'breadcrumb-v113.js'),'utf8')
]);
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const C='12345678-1111-4111-8111-123456789012';
const P='g-p-niakgpt';
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>NiakGPT</title><style>body{font-family:Arial}aside,main{display:block}#ng119-interruption{position:fixed;bottom:20px;left:20px;padding:10px;background:#111;color:#fff}.hidden{display:none}</style></head><body>
<aside data-testid="conversation-sidebar">
  <a href="/g/${P}/project">NiakGPT</a>
  <section id="ng8-pins"><div class="ng96-chat-entry" data-ng110-active="1"><a data-chat="${C}" data-ng110-active="1" aria-current="page" href="/g/${P}/c/${C}"><span class="ng110-chat-title">Tests de régression</span><time>20/08</time></a></div></section>
  <a id="chat-link" href="/g/${P}/c/${C}">Tests de régression</a>
</aside>
<main><section id="feed"></section><section id="signals"></section><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea></main>
</body></html>`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:800}});
  const page=await context.newPage();
  try{
    await page.addInitScript(({C,P})=>{
      const listeners=[];
      const store={
        // Reproduce the live diagnostic inconsistency: cached chat title drifted to the
        // Project name while the active sidebar row still exposes the real chat title.
        'niakgpt-v08-cache':{projects:[{id:P,name:'NiakGPT'}],chats:[{id:C,title:'NiakGPT',projectId:P}],projectChats:{[P]:[]}},
        // Reproduce stale 0.9.69 OUT state with no trusted native-limit evidence.
        'niakgpt-continuity-v100':{schema:1,out:{[C]:{out:true,reason:'limit-detected-v119',projectId:P,title:'Tests de régression'}}}
      };
      window.__store=store;window.__diag={};
      window.chrome={storage:{local:{
        get:async keys=>{const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter(Boolean).map(k=>[k,store[k]]));},
        set:async obj=>{const changes={};for(const[k,v]of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}for(const fn of listeners)fn(changes,'local');}
      },onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.__NIAKGPT_DIAGNOSTICS__={set:(k,v)=>window.__diag[k]=v};
    },{C,P});
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(`https://chatgpt.com/g/${P}/c/${C}`,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      sessionStorage.setItem('niakgpt-interruption-v119',JSON.stringify({type:'network',at:Date.now(),sample:'Connexion interrompue'}));
    });
    await page.addScriptTag({content:continuityJs});
    await page.addScriptTag({content:interruptJs});
    await page.addScriptTag({content:breadcrumbJs});
    await page.waitForTimeout(550);

    const migrated=await page.evaluate(C=>({
      legacyIncident:sessionStorage.getItem('niakgpt-interruption-v119'),
      newIncident:sessionStorage.getItem('niakgpt-interruption-v120'),
      bar:!!document.getElementById('ng119-interruption'),
      out:window.__store['niakgpt-continuity-v100']?.out?.[C]||null,
      badge:!!document.querySelector('.ng100-out-badge'),
      breadcrumbProject:document.querySelector('#ng100-breadcrumb .ng100-bc-project')?.textContent?.trim()||'',
      breadcrumbChat:document.querySelector('#ng100-breadcrumb .ng100-bc-current')?.textContent?.trim()||'',
      breadcrumbDiag:window.__diag['fil-ariane']||''
    }),C);
    assert(!migrated.legacyIncident&&!migrated.newIncident&&!migrated.bar&&!migrated.out&&!migrated.badge,`legacy false incident/OUT was not purged: ${JSON.stringify(migrated)}`);
    assert(migrated.breadcrumbProject==='NiakGPT'&&migrated.breadcrumbChat==='Tests de régression',`live breadcrumb repeated Project name instead of active chat title: ${JSON.stringify(migrated)}`);
    assert(migrated.breadcrumbDiag==='Accueil › NiakGPT › Tests de régression',`breadcrumb diagnostic stayed stale/wrong: ${JSON.stringify(migrated)}`);

    // Exact class of phrases present in the real conversation: these are content, not UI
    // incidents, and therefore must never create a banner, pause or OUT marker.
    await page.evaluate(()=>{
      const wrap=document.createElement('section');wrap.id='normal-response';wrap.innerHTML=`<article data-testid="conversation-turn-42"><div data-message-author-role="assistant"><div role="status">CONNEXION INTERROMPUE. connection lost. La conversation limit a été testée. Vérification en cours. PRÊT · reprise manuelle préparée.</div></div></article><div>Texte documentaire: network error / conversation too long / continue in a new chat.</div>`;document.getElementById('feed').appendChild(wrap);
    });
    await page.waitForTimeout(500);
    const prose=await page.evaluate(C=>({
      bar:!!document.getElementById('ng119-interruption'),
      pause:document.documentElement.dataset.ng105Verification||'',
      out:window.__store['niakgpt-continuity-v100']?.out?.[C]||null,
      incident:sessionStorage.getItem('niakgpt-interruption-v120')
    }),C);
    assert(!prose.bar&&!prose.pause&&!prose.out&&!prose.incident,`ordinary conversation prose triggered interruption state: ${JSON.stringify(prose)}`);

    await page.evaluate(()=>{const a=document.createElement('div');a.id='network-alert';a.setAttribute('role','alert');a.textContent='Connexion interrompue';document.getElementById('signals').appendChild(a);});
    await page.waitForTimeout(320);
    let state=await page.evaluate(()=>({bar:document.getElementById('ng119-interruption')?.dataset.type||'',incident:JSON.parse(sessionStorage.getItem('niakgpt-interruption-v120')||'null')?.type||''}));
    assert(state.bar==='network'&&state.incident==='network',`real native network alert was not detected: ${JSON.stringify(state)}`);
    await page.evaluate(()=>document.getElementById('network-alert')?.remove());
    await page.waitForTimeout(850);
    state=await page.evaluate(()=>({bar:!!document.getElementById('ng119-interruption'),incident:sessionStorage.getItem('niakgpt-interruption-v120')}));
    assert(!state.bar&&!state.incident,`recovered network incident left a stale NiakGPT banner: ${JSON.stringify(state)}`);

    await page.evaluate(()=>{const a=document.createElement('div');a.id='verify-alert';a.setAttribute('role','status');a.textContent='Vérification en cours';document.getElementById('signals').appendChild(a);});
    await page.waitForTimeout(320);
    state=await page.evaluate(()=>({bar:document.getElementById('ng119-interruption')?.dataset.type||'',pause:document.documentElement.dataset.ng105Verification||''}));
    assert(state.bar==='verify'&&state.pause==='1',`real verification signal did not pause NiakGPT: ${JSON.stringify(state)}`);
    await page.evaluate(()=>document.getElementById('verify-alert')?.remove());
    await page.waitForTimeout(850);
    state=await page.evaluate(()=>({bar:!!document.getElementById('ng119-interruption'),pause:document.documentElement.dataset.ng105Verification||'',incident:sessionStorage.getItem('niakgpt-interruption-v120')}));
    assert(!state.bar&&!state.pause&&!state.incident,`verification recovery left stale pause/banner state: ${JSON.stringify(state)}`);

    await page.evaluate(()=>{const a=document.createElement('div');a.id='limit-alert';a.setAttribute('role','alert');a.textContent='Limite de conversation atteinte. Continuez dans un nouveau chat.';document.getElementById('signals').appendChild(a);});
    await page.waitForTimeout(520);
    state=await page.evaluate(C=>({bar:document.getElementById('ng119-interruption')?.dataset.type||'',out:window.__store['niakgpt-continuity-v100']?.out?.[C]||null}),C);
    assert(state.bar==='limit'&&state.out?.evidence==='native-limit-v120',`real native conversation limit was not marked with trusted evidence: ${JSON.stringify(state)}`);

    console.log(`${engine} live diagnostic regressions: PASS`);
  } finally {
    await browser.close();
  }
}
console.log(`false-positive-signals-v121: ${Object.keys(engines).join(',')} PASS`);
