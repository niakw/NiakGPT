const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..','..');
const watchdog=fs.readFileSync(path.join(ROOT,'long-run-watchdog-v129.js'),'utf8');
const LEGACY_HEADER='--- CONTINUE — AJOUT EN PARALLÈLE ---';
const LEGACY_MARKER='--- NIAKGPT LONG RUN — REPRISE AUTOMATIQUE ---';
const LEGACY_MESSAGE=`${LEGACY_HEADER}\n${LEGACY_MARKER}\nPoursuis exactement la tâche déjà en cours là où elle en est. Ne fais ni résumé intermédiaire ni demande de confirmation. Termine toutes les étapes de la demande initiale, vérifie le résultat et ne t'arrête qu'une fois le travail réellement terminé. Si le tour précédent vient d'être interrompu par une limite de durée, reprends immédiatement au dernier point utile.`;
const NEW_MESSAGE='↻ Reprise NiakGPT — Continue exactement la tâche en cours au dernier point utile, jusqu’à finalisation et vérification, sans résumé ni confirmation intermédiaire.';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function closeRuntime(context,browser){
  const braveMac=!!process.env.NIAKGPT_EXECUTABLE_PATH&&process.platform==='darwin';
  if(!braveMac){await context.close().catch(()=>{});await browser.close().catch(()=>{});return;}
  for(const signal of ['-TERM','-KILL']){
    try{execFileSync('/usr/bin/pkill',[signal,'-f','Brave Browser'],{stdio:'ignore'});}catch{}
    await sleep(signal==='-TERM'?350:120);
    if(!browser.isConnected())break;
  }
}

async function launchFixture(){
  const browser=await chromium.launch({executablePath:process.env.NIAKGPT_EXECUTABLE_PATH||undefined,headless:process.env.NIAKGPT_HEADLESS==='0'?false:true});
  const context=await browser.newContext({viewport:{width:1100,height:720}});
  const page=await context.newPage();
  const fixture=`<!doctype html><html><body>
    <main><form data-type="unified-composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea></form></main>
    <button id="native-stop" data-testid="stop-generating" aria-label="Stop generating">Stop</button>
    <script>window.__sent=[];document.documentElement.dataset.ng86Activity='thinking';document.documentElement.dataset.ng129TestSegmentMs='240';</script>
  </body></html>`;
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:watchdog});
  return{browser,context,page,close:()=>closeRuntime(context,browser)};
}

test('automatic long-run resume never parks generated protocol in the composer',async()=>{
  const rt=await launchFixture(),page=rt.page;
  try{
    // Deadline arrives while ChatGPT exposes only Stop: NiakGPT must wait without writing anything.
    await page.waitForTimeout(520);
    await expect(page.locator('#prompt-textarea')).toHaveValue('');
    await expect(page.locator('html')).toHaveAttribute('data-ng129-watchdog','waiting-send-control');

    // Simulate the exact protocol left by an older extension build. The current watchdog owns it and may clean it.
    await page.locator('#prompt-textarea').fill(LEGACY_MESSAGE);
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(()=>page.locator('#prompt-textarea').inputValue(),{timeout:1200}).toBe('');

    // When a real Send control becomes available, prime, send, and clear even if the host forgets to clear its controlled draft.
    await page.evaluate(()=>{
      const form=document.querySelector('form'),button=document.createElement('button');
      button.id='send';button.type='button';button.dataset.testid='send-button';button.setAttribute('aria-label','Envoyer');button.textContent='Envoyer';
      button.addEventListener('click',()=>{window.__sent.push(document.getElementById('prompt-textarea').value);document.getElementById('native-stop')?.remove();document.documentElement.dataset.ng86Activity='ready';});
      form.appendChild(button);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(()=>page.evaluate(()=>window.__sent.length),{timeout:1800,intervals:[80,120,180]}).toBe(1);
    const sent=await page.evaluate(()=>window.__sent[0]);
    expect(sent).toBe(NEW_MESSAGE);
    await expect.poll(()=>page.locator('#prompt-textarea').inputValue(),{timeout:1800}).toBe('');
    expect(await page.evaluate(()=>window.__sent.length)).toBe(1);
  }finally{await rt.close();}
});

test('watchdog never erases a protocol-looking draft once the user changed it',async()=>{
  const rt=await launchFixture(),page=rt.page;
  try{
    const userDraft=`${NEW_MESSAGE}\n\nAjout saisi manuellement par l’utilisateur`;
    await page.locator('#prompt-textarea').fill(userDraft);
    await page.waitForTimeout(420);
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(420);
    await expect(page.locator('#prompt-textarea')).toHaveValue(userDraft);
    await expect(page.locator('html')).toHaveAttribute('data-ng129-watchdog','draft-protected');
    expect(await page.evaluate(()=>window.__sent.length)).toBe(0);
  }finally{await rt.close();}
});
