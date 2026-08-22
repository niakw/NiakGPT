const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..','..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';
const PROJECT='g-p-demo123';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test.setTimeout(60000);

async function closeRuntime(context,browser){
  const braveMac=!!process.env.NIAKGPT_EXECUTABLE_PATH&&process.platform==='darwin';
  if(!braveMac){await context.close().catch(()=>{});await browser.close().catch(()=>{});return;}
  // Hosted macOS runners occasionally leave Brave's helper/process pipe alive even after
  // every assertion has completed. Kill only Brave in this dedicated runner so teardown
  // can never turn a passing browser gate into a 60s timeout.
  for(const signal of ['-TERM','-KILL']){
    try{execFileSync('/usr/bin/pkill',[signal,'-f','Brave Browser'],{stdio:'ignore'});}catch{}
    await sleep(signal==='-TERM'?350:120);
    if(!browser.isConnected())break;
  }
}

test('0.9.76 long-run recovery + remount-safe pins + Project context + native limit handoff',async()=>{
  const browser=await chromium.launch({
    executablePath:process.env.NIAKGPT_EXECUTABLE_PATH||undefined,
    headless:process.env.NIAKGPT_HEADLESS==='0'?false:true
  });
  const context=await browser.newContext({viewport:{width:1280,height:800},colorScheme:'dark',reducedMotion:'reduce'});
  const page=await context.newPage();
  const fixture=`<!doctype html><html lang="fr"><body>
  <a id="native-project" href="/g/${PROJECT}/project">Projet Démo</a>
  <div id="ng8-pins"><button id="old-action" class="ng113-native-actions ng113-native-actions-project" data-ng123-action="project" data-ng123-id="${PROJECT}">•••</button></div>
  <main>
    <div id="limit-card" hidden>Conversation too long — maximum context length. <button id="continue-limit" type="button">Continue in a new chat</button></div>
    <form data-type="unified-composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button id="send" type="button" aria-label="Envoyer" data-testid="send-button">↑</button></form>
  </main>
  <button id="native-stop" type="button" data-testid="stop-generating" aria-label="Stop generating">Stop</button>
  <script>
  window.__sent=[];window.__actionClicks=0;window.__routed=false;
  window.__store={'niakgpt-v08-cache':{projects:[{id:'${PROJECT}',name:'Projet Démo',description:'Description de démonstration',instructions:'Toujours terminer le travail.'}],chats:[{id:'${CHAT}',title:'Fil long',projectId:'${PROJECT}'}]}};
  const local={get:async key=>{const keys=Array.isArray(key)?key:[key];const out={};for(const k of keys)out[k]=window.__store[k];return out;},set:async obj=>Object.assign(window.__store,obj),remove:async key=>{for(const k of (Array.isArray(key)?key:[key]))delete window.__store[k];}};
  window.chrome={storage:{local,onChanged:{addListener:()=>{}}}};window.chrome.storage.local=local;window.chrome.storage.onChanged={addListener:()=>{}};
  const editor=document.getElementById('prompt-textarea');document.getElementById('send').addEventListener('click',()=>{window.__sent.push(editor.value);editor.value='';editor.dispatchEvent(new InputEvent('input',{bubbles:true}));});
  document.getElementById('native-project').addEventListener('click',event=>{event.preventDefault();window.__routed=true;});
  window.__NIAKGPT_CONTINUITY__={buildCapsule:()=> 'CONTINUITÉ NIAKGPT — capsule complète',getState:()=>({out:{}}),markCurrentOut:async()=>true};
  // Keep the production 4m40 rolling semantics, but compress one segment enough for CI
  // without letting several artificial segments elapse before Playwright can observe #1.
  document.documentElement.dataset.ng129TestSegmentMs='1200';
  </script></body></html>`;
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'domcontentloaded'});

    await page.addScriptTag({content:read('long-run-watchdog-v129.js')});
    await page.addScriptTag({content:read('pin-interaction-rescue-v129.js')});
    await page.addScriptTag({content:read('project-menu-augment-v129.js')});
    await page.addScriptTag({content:read('continuity-native-handoff-v129.js')});

    await expect.poll(()=>page.evaluate(()=>window.__sent.length),{timeout:2800,intervals:[80,120,180]}).toBe(1);
    const automatic=await page.evaluate(()=>window.__sent[0]);
    expect(automatic).toContain('--- NIAKGPT LONG RUN — REPRISE AUTOMATIQUE ---');
    expect(automatic).toContain('Poursuis exactement la tâche déjà en cours');
    await expect(page.locator('html')).toHaveAttribute('data-ng129-native-busy','1');
    console.log('LIVE_STABILITY_CHECKPOINT watchdog-auto PASS');

    // A following rolling deadline must never overwrite a real user draft.
    await page.locator('#prompt-textarea').fill('Brouillon utilisateur à préserver');
    await page.waitForTimeout(2100);
    expect(await page.evaluate(()=>window.__sent.length)).toBe(1);
    await expect(page.locator('#prompt-textarea')).toHaveValue('Brouillon utilisateur à préserver');
    await expect(page.locator('html')).toHaveAttribute('data-ng129-watchdog','draft-protected');
    console.log('LIVE_STABILITY_CHECKPOINT draft-protection PASS');

    await page.locator('#prompt-textarea').fill('annule');await page.locator('#send').click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(()=>window.__sent.length)).toBe(2);
    await expect(page.locator('html')).toHaveAttribute('data-ng129-watchdog','cancelled');
    await page.locator('#native-stop').evaluate(el=>el.remove());
    console.log('LIVE_STABILITY_CHECKPOINT cancel PASS');

    await page.locator('#old-action').dispatchEvent('pointerdown',{button:0,clientX:30,clientY:30});
    await page.evaluate(project=>{const old=document.getElementById('old-action'),next=document.createElement('button');next.id='new-action';next.className='ng113-native-actions ng113-native-actions-project';next.dataset.ng123Action='project';next.dataset.ng123Id=project;next.textContent='•••';next.addEventListener('click',()=>window.__actionClicks++);old.replaceWith(next);},PROJECT);
    await page.locator('body').dispatchEvent('pointerup',{button:0,clientX:30,clientY:30});
    await expect.poll(()=>page.evaluate(()=>window.__actionClicks),{timeout:1000}).toBe(1);
    console.log('LIVE_STABILITY_CHECKPOINT remount-click PASS');

    await page.evaluate(project=>{const menu=document.createElement('div');menu.id='ng123-action-menu';menu.dataset.kind='project';menu.dataset.id=project;menu.innerHTML='<strong>Projet Démo</strong><button type="button">Renommer…</button>';document.body.appendChild(menu);},PROJECT);
    await expect(page.locator('#ng123-action-menu')).toContainText('Personnaliser le Project',{timeout:1500});
    await expect(page.locator('#ng123-action-menu')).toContainText('Nouveau chat dans ce Project');
    await expect(page.locator('#ng123-action-menu .ng129-project-context')).toContainText('Description de démonstration');
    await expect(page.locator('#ng123-action-menu .ng129-project-context')).toContainText('Toujours terminer le travail.');
    console.log('LIVE_STABILITY_CHECKPOINT project-context PASS');

    await page.locator('#limit-card').evaluate(el=>el.hidden=false);
    await page.locator('#continue-limit').click();
    await expect.poll(()=>page.evaluate(()=>window.__routed),{timeout:2000}).toBe(true);
    const pending=await page.evaluate(()=>window.__store['niakgpt-native-handoff-v129']);
    expect(pending?.projectId).toBe(PROJECT);
    expect(pending?.chatId).toBe(CHAT);
    expect(pending?.capsule).toContain('Projet Démo > Fil long');
    expect(pending?.capsule).toContain('CONTINUITÉ NIAKGPT');

    expect(await page.evaluate(()=>window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__===true)).toBe(true);
    expect(await page.evaluate(()=>window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__===true)).toBe(true);
    expect(await page.evaluate(()=>window.__NIAKGPT_NATIVE_HANDOFF_129__===true)).toBe(true);
    console.log('LIVE_STABILITY_CHECKPOINT native-handoff PASS');
  }finally{
    await closeRuntime(context,browser);
  }
});
