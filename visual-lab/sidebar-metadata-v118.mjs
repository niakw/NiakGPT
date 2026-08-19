import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const [metadataJs,metadataCss]=await Promise.all(['sidebar-metadata-v118.js','sidebar-metadata-v118.css'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const GOOD='g-p-good',BAD='dom-p-date1708',CID='11111111-1111-4111-8111-111111111111';
      window.__labRaw={schema:2,at:1,projects:[{id:GOOD,name:'Studio',href:`/g/${GOOD}/project`,domOnly:false},{id:BAD,name:'17/08',href:`/c/${CID}`,domOnly:true}],chats:[{id:CID,title:'Chat test',projectId:BAD,href:`/g/${GOOD}/c/${CID}`,updated:1}],counts:{[GOOD]:1,[BAD]:1},projectChats:{[BAD]:[]},indexedProjectIds:[GOOD,BAD]};
      window.__subs=[];
      window.__NIAKGPT_CACHE_BUS__={async get(){await new Promise(r=>setTimeout(r,90));return window.__labRaw;},peek(){return window.__labRaw;},async update(fn){window.__labRaw=fn(window.__labRaw)||window.__labRaw;for(const sub of [...window.__subs])sub(window.__labRaw);return window.__labRaw;},subscribe(fn){window.__subs.push(fn);return()=>{window.__subs=window.__subs.filter(x=>x!==fn);};}};
      window.chrome={storage:{local:{async get(){return{'niakgpt-v08-cache':window.__labRaw};},async set(obj){if(obj['niakgpt-v08-cache'])window.__labRaw=obj['niakgpt-v08-cache'];}},onChanged:{addListener(){}}}};
      window.__NIAKGPT_DIAGNOSTICS__={set(){}};
    });
    const html=`<!doctype html><html><body><nav data-testid="conversation-sidebar"><section id="native-projects"><h3>Projects</h3><a href="/g/g-p-good/project">Studio</a><button>Afficher plus</button></section><section id="recents"><a id="chat" href="/c/11111111-1111-4111-8111-111111111111"><span>Chat test</span><span class="ng8-chat-date">17/08</span><span class="ng8-chat-project">17/08</span></a></section><section id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-good/project"><span>Studio</span></a></section></nav></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:metadataCss});
    const started=Date.now();
    await page.evaluate(metadataJs);
    const injectionMs=Date.now()-started;
    const state=await page.evaluate(()=>({
      ready:window.__NIAKGPT_METADATA_READY_118__||'',
      nativeDisplay:getComputedStyle(document.getElementById('native-projects')).display,
      nativeClasses:[...document.getElementById('native-projects').classList],
      dateTag:document.querySelector('#chat .ng8-chat-date')?.tagName||'',
      fakeBadge:!!document.querySelector('#chat .ng8-chat-project'),
      badProjects:(window.__labRaw.projects||[]).filter(p=>p.id==='dom-p-date1708').length,
      chatProject:(window.__labRaw.chats||[]).find(c=>c.id==='11111111-1111-4111-8111-111111111111')?.projectId||'',
      badCount:Object.prototype.hasOwnProperty.call(window.__labRaw.counts||{},'dom-p-date1708'),
      badIndexed:(window.__labRaw.indexedProjectIds||[]).includes('dom-p-date1708'),
      authorityMarks:document.querySelectorAll('[data-ng112-native-projects],.ng107-native-project-row,.ng107-native-project-cluster,.ng108-native-project-expando,.ng8-native-project-link-suppressed').length,
    }));
    assert(injectionMs>=70,`async metadata injection returned before delayed cache read (${injectionMs}ms)`);
    assert(state.ready==='ready',`metadata injection resolved before readiness: ${JSON.stringify(state)}`);
    assert(state.nativeDisplay!=='none',`metadata module suppressed native Projects: ${JSON.stringify(state)}`);
    assert(state.authorityMarks===0,`metadata module created authority marks: ${JSON.stringify(state)}`);
    assert(state.dateTag==='TIME','date metadata was not normalized to <time>');
    assert(!state.fakeBadge,'date-shaped fake Project badge survived');
    assert(state.badProjects===0&&!state.badCount&&!state.badIndexed,'date-shaped ghost Project survived cache cleanup');
    assert(state.chatProject==='g-p-good',`chat Project recovery failed: ${JSON.stringify(state)}`);
    console.log(`${engine} sidebar metadata async barrier + hygiene: PASS · ${injectionMs}ms`);
  }finally{
    await context.close();
    await browser.close();
  }
}
console.log(`sidebar-metadata-v118: ${Object.keys(engines).join(',')} PASS`);
