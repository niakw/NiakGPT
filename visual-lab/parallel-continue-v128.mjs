import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const script=await fs.readFile(path.join(ROOT,'composer-continuation-v128.js'),'utf8');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'chromium').trim();
if(!engines[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const HEADER='↳ Suite en parallèle';
const LEGACY='--- CONTINUE — AJOUT EN PARALLÈLE ---';
const LEGACY_GATE_SIGNATURE='idle+thinking+executing+cancel+native-stop+contenteditable+visual';
const out=path.join('artifacts','parallel-continue-v128',requested);await fs.mkdir(out,{recursive:true});
const browser=await engines[requested].launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},colorScheme:'dark',reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const fixture=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#101214;color:#f3f5f7;font:15px Arial,sans-serif}main{width:min(820px,92vw);margin:40px auto 140px}.turn{margin:14px 0;padding:14px 16px;border-radius:14px;background:#1b1f24;white-space:pre-wrap}.turn.user{margin-left:16%;background:#252b32}.state{position:fixed;top:16px;right:18px;padding:7px 11px;border:1px solid #46515f;border-radius:999px;background:#181c21}.composer{position:fixed;left:15%;right:15%;bottom:30px;display:flex;gap:10px;align-items:flex-end;padding:12px;border:1px solid #46515f;border-radius:20px;background:#20242a}.composer textarea,.composer [contenteditable=true]{flex:1;min-height:48px;max-height:180px;padding:10px;border:0;outline:0;background:transparent;color:inherit;white-space:pre-wrap}.composer button{width:44px;height:44px;border:0;border-radius:50%}</style></head><body><div class="state" id="state">PRÊT</div><main id="thread"><div class="turn">Travail principal déjà lancé.</div></main><form class="composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button type="button" id="send" data-testid="send-button" aria-label="Envoyer">↑</button></form><script>
window.__sent=[];
window.__editor=()=>document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]');
window.__text=el=>String('value'in el?el.value:el.innerText||el.textContent||'');
window.__clear=el=>{if('value'in el){el.value='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));}else{el.textContent='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));}};
window.__send=()=>{const el=window.__editor(),text=window.__text(el);window.__sent.push(text);const turn=document.createElement('div');turn.className='turn user';turn.textContent=text;document.getElementById('thread').appendChild(turn);window.__clear(el);};
document.getElementById('send').addEventListener('click',window.__send);
document.addEventListener('keydown',event=>{const el=window.__editor();if(event.target===el&&event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.isComposing){event.preventDefault();window.__send();}});
</script></body></html>`;
try{
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{window.__NIAKGPT_HOST_HYDRATED_100__=true;});
  await page.addScriptTag({content:script});

  await page.locator('#prompt-textarea').fill('Message normal');await page.locator('#send').click();
  let sent=await page.evaluate(()=>window.__sent.slice());assert(sent[0]==='Message normal',`idle send mutated: ${JSON.stringify(sent[0])}`);
  await page.waitForTimeout(520);

  await page.evaluate(()=>{document.documentElement.dataset.ng86Activity='thinking';document.getElementById('state').textContent='ANALYSE';});
  await page.locator('#prompt-textarea').fill('Ajoute aussi une vérification réseau.');await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert(sent[1]?.startsWith(HEADER),`thinking click missing marker: ${JSON.stringify(sent[1])}`);assert(sent[1]?.includes('Ajoute aussi une vérification réseau.'),'thinking click lost user text');assert(!sent[1]?.includes(LEGACY),'legacy verbose marker leaked');assert(sent[1]?.length<220,'parallel prefix became verbose again');

  await page.evaluate(()=>{document.documentElement.dataset.ng86Activity='executing';document.getElementById('state').textContent='EXÉCUTION';});
  await page.locator('#prompt-textarea').fill('Et documente le résultat final.');await page.locator('#prompt-textarea').press('Enter');sent=await page.evaluate(()=>window.__sent.slice());
  assert(sent[2]?.startsWith(HEADER),`executing Enter missing marker: ${JSON.stringify(sent[2])}`);assert(sent[2]?.includes('Et documente le résultat final.'),'executing Enter lost user text');

  await page.evaluate(()=>document.documentElement.dataset.ng86Activity='thinking');await page.locator('#prompt-textarea').fill('arrête');await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert(sent[3]==='arrête',`explicit cancellation was overridden: ${JSON.stringify(sent[3])}`);

  await page.evaluate(()=>{document.documentElement.dataset.ng86Activity='ready';const stop=document.createElement('button');stop.id='native-stop';stop.dataset.testid='stop-generating';stop.setAttribute('aria-label','Stop generating');stop.textContent='Stop';document.body.appendChild(stop);});
  await page.locator('#prompt-textarea').fill('Ajout détecté via le bouton Stop natif.');await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert(sent[4]?.startsWith(HEADER),`native busy fallback missing marker: ${JSON.stringify(sent[4])}`);

  await page.evaluate(()=>{document.getElementById('native-stop')?.remove();document.documentElement.dataset.ng86Activity='thinking';const old=document.getElementById('prompt-textarea');const div=document.createElement('div');div.id='prompt-textarea';div.dataset.testid='prompt-textarea';div.contentEditable='true';old.replaceWith(div);});
  await page.locator('#prompt-textarea').fill('Test éditeur contenteditable moderne.');await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert(sent[5]?.startsWith(HEADER),`contenteditable missing marker: ${JSON.stringify(sent[5])}`);assert(sent[5]?.includes('Test éditeur contenteditable moderne.'),'contenteditable lost user text');

  await page.locator('#prompt-textarea').fill(`${HEADER} — déjà marqué.`);await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert((sent[6]?.match(/↳ Suite en parallèle/g)||[]).length===1,`marker duplicated: ${JSON.stringify(sent[6])}`);

  await page.locator('#prompt-textarea').fill(`${LEGACY}\nAncien brouillon déjà marqué.`);await page.locator('#send').click();sent=await page.evaluate(()=>window.__sent.slice());
  assert((sent[7]?.match(/--- CONTINUE — AJOUT EN PARALLÈLE ---/g)||[]).length===1,`legacy marker migration duplicated: ${JSON.stringify(sent[7])}`);

  const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,overlays:document.querySelectorAll('#ng128-parallel-continue,.ng128-parallel-continue').length,turns:document.querySelectorAll('.turn.user').length}));
  assert(geometry.scrollWidth<=geometry.innerWidth,`visual horizontal overflow: ${JSON.stringify(geometry)}`);assert(geometry.overlays===0,'parallel continuation created an unwanted overlay');assert(geometry.turns===8,`rendered message count drift: ${geometry.turns}`);
  assert(errors.length===0,`browser errors: ${JSON.stringify(errors)}`);
  await page.screenshot({path:path.join(out,'parallel-continuation.png'),fullPage:true});
  await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify({browser:requested,sent,geometry,errors,legacyGate:LEGACY_GATE_SIGNATURE},null,2),'utf8');
  console.log(`parallel-continue-v128 ${requested}: PASS concise+idle+thinking+executing+cancel+native-stop+contenteditable+migration+visual`);
}catch(error){
  try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});await fs.writeFile(path.join(out,'failure.html'),await page.content(),'utf8');await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:String(error?.stack||error),errors},null,2),'utf8');}catch{}
  throw error;
}finally{await context.close();await browser.close();}
