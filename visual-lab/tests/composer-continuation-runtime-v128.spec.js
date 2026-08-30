const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const extensionPath=path.resolve(__dirname,'..','..');
const manifest=JSON.parse(fs.readFileSync(path.join(extensionPath,'manifest.json'),'utf8'));
const HEADER='↳ Suite en parallèle';
const LEGACY='--- CONTINUE — AJOUT EN PARALLÈLE ---';
const CHAT='11111111-1111-4111-8111-111111111111';

test.setTimeout(90000);

async function extensionWorker(context){
  const existing=context.serviceWorkers().find(worker=>worker.url().includes('background-v100.js'));
  if(existing)return existing;
  return context.waitForEvent('serviceworker',{predicate:worker=>worker.url().includes('background-v100.js'),timeout:10000});
}

test('real MV3 static continuation layer prefixes only pre-existing parallel work and never leaves protocol in composer',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-parallel-v128-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1280,height:800},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const fixture=`<!doctype html><html><body><main id="thread"><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">Travail en cours.</div></article><form data-type="unified-composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button type="button" id="send" data-testid="send-button" aria-label="Envoyer">Envoyer</button></form></main><script>
  window.__sent=[];window.__dropNext=false;const e=document.getElementById('prompt-textarea');
  document.getElementById('send').addEventListener('click',()=>{
    const value=e.value;
    if(window.__dropNext){window.__dropNext=false;return;}
    window.__sent.push(value);
    const article=document.createElement('article');article.dataset.testid='conversation-turn-'+(window.__sent.length+1);
    const user=document.createElement('div');user.setAttribute('data-message-author-role','user');user.textContent=value;article.appendChild(user);document.getElementById('thread').insertBefore(article,document.querySelector('form'));
    // Deliberately do NOT clear the textarea: reproduces the real controlled-composer stale draft regression.
  });
  </script></body></html>`;
  try{
    const worker=await extensionWorker(context);
    await worker.evaluate(async version=>{await chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}});},manifest.version);
    await context.route('https://chatgpt.com/**',route=>route.request().resourceType()==='document'?route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}):route.fulfill({status:204,body:''}));
    const page=context.pages()[0]||await context.newPage();
    await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'commit'});
    await expect(page.locator('#prompt-textarea')).toBeVisible({timeout:8000});
    await expect.poll(
      ()=>page.evaluate(()=>({
        hydrated:window.__NIAKGPT_HOST_HYDRATED_100__===true,
        parallel:window.__NIAKGPT_PARALLEL_CONTINUE_128__===true
      })),
      {timeout:12000,intervals:[80,120,180,260,400]}
    ).toEqual({hydrated:true,parallel:true});

    await page.locator('#prompt-textarea').fill('Message depuis une conversation au repos.');await page.locator('#send').click();
    await expect.poll(()=>page.evaluate(()=>window.__sent[0])).toBe('Message depuis une conversation au repos.');
    await page.waitForTimeout(520);

    await page.evaluate(()=>{
      const stop=document.createElement('button');
      stop.id='native-stop';stop.dataset.testid='stop-generating';
      stop.setAttribute('aria-label','Stop generating');stop.textContent='Stop';
      document.body.appendChild(stop);
    });
    await expect(page.locator('#native-stop')).toBeVisible();
    await page.locator('#prompt-textarea').fill('Ajoute ce contrôle sans arrêter ce que tu fais.');await page.locator('#send').click();
    await expect.poll(()=>page.evaluate(()=>window.__sent[1])).toContain(HEADER);
    const active=await page.evaluate(()=>window.__sent[1]);expect(active.startsWith(HEADER)).toBe(true);expect(active).toContain('Ajoute ce contrôle sans arrêter ce que tu fais.');expect(active).not.toContain(LEGACY);expect(active.length).toBeLessThan(230);
    await expect.poll(()=>page.locator('#prompt-textarea').inputValue(),{timeout:2500}).toBe('');
    await expect(page.locator('html')).toHaveAttribute('data-ng128-composer-cleanup','confirmed-clear');

    // If the host does not confirm a send, remove only NiakGPT's prefix and preserve the exact user draft.
    await page.evaluate(()=>window.__dropNext=true);
    await page.locator('#prompt-textarea').fill('Ce texte doit rester si l’envoi natif échoue.');await page.locator('#send').click();
    await expect.poll(()=>page.locator('#prompt-textarea').inputValue(),{timeout:1500}).toBe('Ce texte doit rester si l’envoi natif échoue.');
    await expect(page.locator('html')).toHaveAttribute('data-ng128-composer-cleanup','prefix-stripped');
    expect(await page.evaluate(()=>window.__sent.length)).toBe(2);

    await page.locator('#prompt-textarea').fill('annule');await page.locator('#send').click();
    await expect.poll(()=>page.evaluate(()=>window.__sent[2])).toBe('annule');
  }finally{
    await context.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});
  }
});
