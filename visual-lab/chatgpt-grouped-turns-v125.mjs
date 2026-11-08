import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const read=name=>fs.readFile(path.join(ROOT,name),'utf8');
const [hostDOM,headers,performanceGuard,app,activity,activityUI,continuity,consumer,interruptions,composerContinuation,scrollGuard,memory,coach,pageBridge]=await Promise.all([
  read('host-dom-v125.js'),
  read('turn-headers-v112.js'),
  read('performance-guard-v112.js'),
  read('app-v090.js'),
  read('activity-v086.js'),
  read('activity-ui-v097.js'),
  read('continuity-v100.js'),
  read('continuity-consumer-v124.js'),
  read('interruption-guard-v119.js'),
  read('composer-continuation-v128.js'),
  read('conversation-scroll-guard-v133.js'),
  read('project-memory-v132.js'),
  read('coach-v101.js'),
  read('page-bridge.js')
]);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [name,src] of Object.entries({app,activity,activityUI,continuity,consumer,interruptions,composerContinuation,scrollGuard,memory,coach})){
  assert(src.includes('__NIAKGPT_HOST_DOM_V125__'),`${name} bypasses canonical grouped-turn/composer adapter`);
}
for(const token of ['data-turn-key','data-content-search-unit-key','data-user-message-bubble','data-conversation-role="assistant"','data-chatgpt-agent-turn-start','data-markdown-text-style="assistant-message"','data-composer-markdown']){
  assert(hostDOM.includes(token),`host DOM adapter missing modern ChatGPT token: ${token}`);
}
assert(pageBridge.includes('data-composer-markdown'),'MAIN-world bridge does not recognize the modern composer');

const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const engines=requested?{[requested]:ALL[requested]}:ALL;
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);

const group=(key,user,assistant)=>`
<section data-turn-key="${key}">
  <div data-content-search-unit-key="${key}:0:user">
    <div data-user-message-bubble="true"><div data-search-result-target>${user}</div></div>
  </div>
  <div data-content-search-unit-key="${key}:2:assistant">
    <span hidden data-chatgpt-agent-turn-start></span>
    <h4 data-conversation-role="assistant">ChatGPT said:</h4>
    <div data-markdown-text-style="assistant-message"><p>${assistant}</p></div>
  </div>
  <div class="turn-action-controls"><button aria-label="Copy">Copy</button></div>
</section>`;

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await context.newPage();
  try{
    const body=`<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0}main{min-height:100vh;padding:24px}
      [data-turn-key]{display:block;margin:18px 0}
      [data-content-search-unit-key]{display:block;min-height:28px}
      form[data-chatgpt-composer]{display:block;position:fixed;left:320px;right:40px;bottom:20px;height:70px}
      [data-composer-markdown]{display:block;min-height:44px;border:1px solid}
    </style></head><body><main>
      <div id="conversation">
        ${group('turn-a','First user prompt','First assistant answer')}
        ${group('turn-b','Second user prompt','Second assistant answer')}
      </div>
      <form data-chatgpt-composer>
        <div class="ProseMirror" data-composer-markdown contenteditable="true" role="textbox" aria-label="Ask ChatGPT"></div>
        <button type="button" data-testid="send-button" aria-label="Send">Send</button>
      </form>
    </main></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body}));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
    await page.addInitScript(()=>{window.__NIAKGPT_DIAGNOSTICS__={set(){}};});
    await page.addScriptTag({content:hostDOM});

    const initial=await page.evaluate(()=> {
      const api=window.__NIAKGPT_HOST_DOM_V125__,main=document.querySelector('main'),composer=api.composer();
      const surfaces=api.surfaces(main);
      return {
        classic:document.querySelectorAll('[data-testid^="conversation-turn-"],[data-message-author-role]').length,
        count:surfaces.length,
        roles:surfaces.map(api.roleOf),
        texts:surfaces.map(el=>(el.textContent||'').replace(/\s+/g,' ').trim()),
        composer:!!composer,
        composerModern:composer?.hasAttribute('data-composer-markdown')||false,
        closestRole:api.roleOf(api.closestTurn(document.querySelector('[data-markdown-text-style="assistant-message"] p')))
      };
    });
    assert(initial.classic===0,`${engine}: fixture accidentally contains legacy turn markers`);
    assert(initial.count===4,`${engine}: grouped renderer expected 4 role surfaces, got ${JSON.stringify(initial)}`);
    assert(initial.roles.join(',')==='user,assistant,user,assistant',`${engine}: grouped role order drift: ${JSON.stringify(initial)}`);
    assert(initial.composer&&initial.composerModern,`${engine}: ProseMirror composer not found: ${JSON.stringify(initial)}`);
    assert(initial.closestRole==='assistant',`${engine}: assistant markdown did not resolve to assistant unit: ${JSON.stringify(initial)}`);

    await page.addScriptTag({content:headers});
    await page.addScriptTag({content:performanceGuard});
    await page.waitForTimeout(420);
    const decorated=await page.evaluate(()=>({
      headers:[...document.querySelectorAll('[data-content-search-unit-key]')].map(el=>el.dataset.ng112Header||''),
      roles:[...document.querySelectorAll('[data-content-search-unit-key]')].map(el=>el.dataset.ng8Role||''),
      longThread:document.documentElement.dataset.ng112LongThread||''
    }));
    assert(decorated.headers.every(v=>v==='1'),`${engine}: turn headers ignored grouped units: ${JSON.stringify(decorated)}`);
    assert(decorated.roles.join(',')==='user,assistant,user,assistant',`${engine}: decorated roles wrong: ${JSON.stringify(decorated)}`);
    assert(decorated.longThread==='0',`${engine}: performance guard did not evaluate grouped units: ${JSON.stringify(decorated)}`);

    await page.evaluate(markup=>{
      const host=document.getElementById('conversation');
      const box=document.createElement('div');box.innerHTML=markup.trim();
      host.appendChild(box.firstElementChild);
    },group('turn-c','Third user prompt','Third assistant answer'));
    await page.waitForTimeout(420);
    const remount=await page.evaluate(()=> {
      const api=window.__NIAKGPT_HOST_DOM_V125__,main=document.querySelector('main'),surfaces=api.surfaces(main);
      return {
        count:surfaces.length,
        roles:surfaces.map(api.roleOf),
        lastHeaders:[...document.querySelectorAll('[data-turn-key="turn-c"] [data-content-search-unit-key]')].map(el=>el.dataset.ng112Header||'')
      };
    });
    assert(remount.count===6&&remount.roles.join(',')==='user,assistant,user,assistant,user,assistant',
      `${engine}: grouped SPA append lost role surfaces: ${JSON.stringify(remount)}`);
    assert(remount.lastHeaders.every(v=>v==='1'),`${engine}: new grouped turn was not decorated after mutation: ${JSON.stringify(remount)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}
console.log(`chatgpt-grouped-turns-v125: ${Object.keys(engines).join(',')} PASS`);
