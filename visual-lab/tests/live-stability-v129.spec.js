const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..','..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';
const PROJECT='g-p-demo123';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test.setTimeout(70000);

async function closeRuntime(context,browser){
  const braveMac=!!process.env.NIAKGPT_EXECUTABLE_PATH&&process.platform==='darwin';
  if(!braveMac){await context.close().catch(()=>{});await browser.close().catch(()=>{});return;}
  for(const signal of ['-TERM','-KILL']){
    try{execFileSync('/usr/bin/pkill',[signal,'-f','Brave Browser'],{stdio:'ignore'});}catch{}
    await sleep(signal==='-TERM'?350:120);
    if(!browser.isConnected())break;
  }
}

test('0.9.76 live hotfix: hydration shell + real queue + native Project settings + full native limit handoff',async()=>{
  const browser=await chromium.launch({executablePath:process.env.NIAKGPT_EXECUTABLE_PATH||undefined,headless:process.env.NIAKGPT_HEADLESS==='0'?false:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},colorScheme:'dark',reducedMotion:'reduce'});
  const page=await context.newPage();
  const fixture=`<!doctype html><html lang="fr"><body>
  <nav aria-label="Sidebar">
    <div data-sidebar-item="true" id="native-project-row">
      <a id="native-project" href="/g/${PROJECT}/project">Projet Démo</a>
      <button id="native-project-more" type="button" aria-haspopup="menu" aria-label="Options du projet">•••</button>
    </div>
  </nav>
  <div id="ng8-pins"><button id="old-action" class="ng113-native-actions ng113-native-actions-project" data-ng123-action="project" data-ng123-id="${PROJECT}">•••</button></div>
  <main>
    <article data-testid="conversation-turn-1" data-message-author-role="user">Demande initiale complète à terminer.</article>
    <article data-testid="conversation-turn-2" data-message-author-role="assistant">
      Travail partiellement exécuté.
      <div id="limit-card" hidden>Conversation too long — maximum context length. <button id="continue-limit" type="button">Continue in a new chat</button></div>
    </article>
    <form data-type="unified-composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button id="send" hidden type="button" aria-label="Envoyer" data-testid="send-button">↑</button></form>
  </main>
  <button id="native-stop" type="button" data-testid="stop-generating" aria-label="Stop generating">Stop</button>
  <script>
  window.__sent=[];window.__actionClicks=0;window.__routed=false;window.__nativeSettingsClicks=0;
  window.__store={'niakgpt-v08-cache':{projects:[{id:'${PROJECT}',name:'Projet Démo',description:'Description de démonstration',instructions:'Toujours terminer le travail.'}],chats:[{id:'${CHAT}',title:'Fil long',projectId:'${PROJECT}'}]}};
  const local={get:async key=>{const keys=Array.isArray(key)?key:[key];const out={};for(const k of keys)out[k]=window.__store[k];return out;},set:async obj=>Object.assign(window.__store,obj),remove:async key=>{for(const k of (Array.isArray(key)?key:[key]))delete window.__store[k];}};
  window.chrome={storage:{local,onChanged:{addListener:()=>{}}},runtime:{getManifest:()=>({version:'0.9.76'}),sendMessage:async()=>{if(!document.getElementById('ng8-rail')){const rail=document.createElement('aside');rail.id='ng8-rail';rail.innerHTML='<button>Explorer</button>';document.body.appendChild(rail);}if(!document.getElementById('ng8-panel')){const panel=document.createElement('aside');panel.id='ng8-panel';document.body.appendChild(panel);}if(!document.getElementById('ng8-status')){const status=document.createElement('div');status.id='ng8-status';document.body.appendChild(status);}document.body.classList.add('ng8-ready');return{ok:true,errors:[]};}}};
  const editor=document.getElementById('prompt-textarea'),send=document.getElementById('send');
  const syncSend=()=>{send.hidden=!editor.value.trim();};editor.addEventListener('input',syncSend);syncSend();
  send.addEventListener('click',()=>{window.__sent.push(editor.value);editor.value='';editor.dispatchEvent(new InputEvent('input',{bubbles:true}));});
  document.getElementById('native-project').addEventListener('click',event=>{event.preventDefault();window.__routed=true;});
  document.getElementById('native-project-more').addEventListener('click',()=>{document.querySelector('#native-project-menu')?.remove();const menu=document.createElement('div');menu.id='native-project-menu';menu.setAttribute('role','menu');const settings=document.createElement('button');settings.type='button';settings.setAttribute('role','menuitem');settings.textContent='Paramètres du projet';settings.addEventListener('click',()=>{window.__nativeSettingsClicks++;menu.remove();const dialog=document.createElement('div');dialog.id='native-project-settings';dialog.setAttribute('role','dialog');dialog.innerHTML='<h2>Paramètres du projet</h2><label>Nom du projet</label><input value="Projet Démo"><label>Instructions</label><textarea>Toujours terminer le travail.</textarea><label>Mémoire</label><button>Mémoire par défaut</button><label>Accès à la bibliothèque.</label><button>Activé</button><button>Supprimer le projet</button>';document.body.appendChild(dialog);});menu.appendChild(settings);document.body.appendChild(menu);});
  window.__continuityState={out:{}};
  window.__NIAKGPT_CONTINUITY__={
    buildCapsule:(chatId,projectId,history)=>'CONTINUITÉ NIAKGPT — capsule complète\\nHISTORIQUE DU FIL PRÉCÉDENT\\n'+history,
    getState:()=>window.__continuityState,
    markCurrentOut:async()=>{window.__continuityState.out['${CHAT}']={title:'Fil long',projectId:'${PROJECT}',history:'UTILISATEUR\\nDemande initiale complète à terminer.\\n\\n---\\n\\nASSISTANT\\nTravail partiellement exécuté.'};return true;}
  };
  document.documentElement.dataset.ng129TestSegmentMs='1200';
  </script></body></html>`;
  try{
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'load'});

    await page.addScriptTag({content:read('boot-gate-v100.js')});
    await expect(page.locator('#ng8-rail')).toBeVisible({timeout:5000});
    await page.locator('#ng8-rail').evaluate(el=>el.remove());
    await expect(page.locator('#ng8-rail')).toBeVisible({timeout:1200});
    console.log('LIVE_STABILITY_CHECKPOINT shell-retention PASS');

    await page.addScriptTag({content:read('long-run-watchdog-v129.js')});
    await page.addScriptTag({content:read('pin-interaction-rescue-v129.js')});
    await page.addScriptTag({content:read('project-menu-augment-v129.js')});
    await page.addScriptTag({content:read('continuity-native-handoff-v129.js')});

    // Real ChatGPT/Brave shape: the send/queue button does not exist visibly while the
    // composer is empty. The watchdog must prime the composer first, then resolve it.
    await expect.poll(()=>page.evaluate(()=>window.__sent.length),{timeout:3500,intervals:[80,120,180]}).toBe(1);
    const automatic=await page.evaluate(()=>window.__sent[0]);
    expect(automatic).toContain('--- NIAKGPT LONG RUN — REPRISE AUTOMATIQUE ---');
    expect(automatic).toContain('Poursuis exactement la tâche déjà en cours');
    await expect(page.locator('html')).toHaveAttribute('data-ng129-native-busy','1');
    console.log('LIVE_STABILITY_CHECKPOINT watchdog-real-queue PASS');

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

    await page.evaluate(project=>{const menu=document.createElement('div');menu.id='ng123-action-menu';menu.dataset.kind='project';menu.dataset.id=project;menu.innerHTML='<strong>Projet Démo</strong><button type="button" role="menuitem">Renommer…</button>';document.body.appendChild(menu);},PROJECT);
    await expect(page.locator('#ng123-action-menu')).toContainText('Paramètres du projet',{timeout:1500});
    await expect(page.locator('#ng123-action-menu')).toContainText('Nouveau chat dans ce Project');
    await page.locator('#ng123-action-menu [data-ng129-personalize="1"]').click();
    await expect(page.locator('#native-project-settings')).toBeVisible({timeout:2500});
    await expect(page.locator('#native-project-settings')).toContainText('Nom du projet');
    await expect(page.locator('#native-project-settings')).toContainText('Instructions');
    await expect(page.locator('#native-project-settings')).toContainText('Mémoire');
    await expect(page.locator('#native-project-settings')).toContainText('Accès à la bibliothèque');
    await expect(page.locator('#native-project-settings')).toContainText('Supprimer le projet');
    expect(await page.evaluate(()=>window.__nativeSettingsClicks)).toBe(1);
    console.log('LIVE_STABILITY_CHECKPOINT native-project-settings PASS');

    // The native limit CTA is inside the assistant turn on the real site. NiakGPT must
    // intercept it before ChatGPT's default last-message-only handoff.
    await page.locator('#limit-card').evaluate(el=>el.hidden=false);
    await page.locator('#continue-limit').click();
    await expect.poll(()=>page.evaluate(()=>window.__routed),{timeout:2000}).toBe(true);
    const pending=await page.evaluate(()=>window.__store['niakgpt-native-handoff-v129']);
    expect(pending?.projectId).toBe(PROJECT);
    expect(pending?.chatId).toBe(CHAT);
    expect(pending?.capsule).toContain('Projet Démo > Fil long');
    expect(pending?.capsule).toContain('CONTINUITÉ NIAKGPT');
    expect(pending?.capsule).toContain('HISTORIQUE DU FIL PRÉCÉDENT');
    expect(pending?.capsule).toContain('Demande initiale complète à terminer.');
    expect(pending?.historyBytes).toBeGreaterThan(40);

    expect(await page.evaluate(()=>window.__NIAKGPT_PIN_INTERACTION_RESCUE_129__===true)).toBe(true);
    expect(await page.evaluate(()=>window.__NIAKGPT_PROJECT_MENU_AUGMENT_129__===true)).toBe(true);
    expect(await page.evaluate(()=>window.__NIAKGPT_NATIVE_HANDOFF_129__===true)).toBe(true);
    console.log('LIVE_STABILITY_CHECKPOINT native-handoff-full-context PASS');
  }finally{
    await closeRuntime(context,browser);
  }
});
