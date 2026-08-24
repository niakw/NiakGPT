import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,firefox,webkit} from '@playwright/test';

const ROOT=path.resolve('..');
const [uxJs,uxCss,coachJs]=await Promise.all([
  fs.readFile(path.join(ROOT,'ux-v131.js'),'utf8'),
  fs.readFile(path.join(ROOT,'ux-v131.css'),'utf8'),
  fs.readFile(path.join(ROOT,'coach-v101.js'),'utf8')
]);
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'chromium').trim();
if(!engines[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const out=path.join('artifacts','ux-integral-v131',requested);await fs.mkdir(out,{recursive:true});
const browser=await engines[requested].launch({headless:true});
const context=await browser.newContext({viewport:{width:1720,height:920},colorScheme:'dark',reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const fixture=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#070b10;color:#dce7f1;font:14px Arial,sans-serif;min-height:100%}body{min-height:920px}.left{position:fixed;z-index:4;left:0;top:0;bottom:0;width:310px;padding:12px;background:#09111a;border-right:1px solid #263746}.left a{display:block;padding:9px;color:#c5d1dd;text-decoration:none}.left .native-projects{margin-top:10px;padding-top:8px;border-top:1px solid #263746}.fake{position:absolute;z-index:3;left:520px;top:80px;width:660px;min-height:520px;padding:16px;background:#111922;border:1px solid #344554}.fake a{display:block;padding:7px;color:#cbd5df}main{position:relative;margin-left:310px;min-height:920px;padding:100px 80px}.thread{width:min(820px,100%);margin:auto}.turn{padding:14px;margin:12px 0;background:#121b24}.composer{position:fixed;left:590px;right:270px;bottom:80px;min-height:70px;padding:10px;border:1px solid #425466;border-radius:18px;background:#111922}.composer textarea{width:100%;min-height:44px;background:transparent;color:white;border:0;resize:none}.composer button{float:right}.project-card{padding:8px;border:1px solid #455467}.project-card a{display:block}.ng8-pin-head{display:flex;justify-content:space-between}.ng8-pin-list a{display:grid;grid-template-columns:24px 1fr auto}.ng8-pin-list i{font-style:normal}.ng8-pin-list small{font-size:10px}
#ng8-rail{position:fixed;right:0;top:0;bottom:24px;width:46px;z-index:20;background:#0b1219}#ng8-rail button{display:block;width:38px;height:40px}#ng8-status{position:fixed;left:0;right:0;bottom:0;height:24px;z-index:20;background:#007acc}#ng8-panel{position:fixed;right:46px;top:0;bottom:24px;width:372px;transform:translateX(430px)}
</style></head><body class="ng8-ready">
<aside class="left" data-testid="conversation-sidebar" aria-label="Historique des conversations">
  <a href="/">Nouveau chat</a><a href="/library">Bibliothèque</a><a href="/search">Recherche</a>
  <section class="native-projects"><h2>Projets</h2><a href="/g/g-p-alpha/project">Alpha</a><a href="/g/g-p-beta/project">Beta</a></section>
  <a href="/c/22222222-2222-4222-8222-222222222222">Conversation récente</a>
</aside>
<aside class="fake" id="central-bait" aria-label="Panneau contextuel">
  <h2>Résultats</h2>
  <div class="project-card"><a href="/g/g-p-a/project">A</a><a href="/g/g-p-b/project">B</a><a href="/g/g-p-c/project">C</a><a href="/g/g-p-d/project">D</a><a href="/g/g-p-e/project">E</a><a href="/c/33333333-3333-4333-8333-333333333333">Chat</a></div>
  <section id="ng8-pins"><div class="ng8-pin-head"><span>PROJECTS</span><b>2</b></div><div class="ng8-pin-list"><a data-ng8-pin="1" href="/g/g-p-alpha/project" style="--ng-project:#4fc1ff"><i>▤</i><span>Alpha</span><small>24/08 [4]</small></a><a data-ng8-pin="1" href="/g/g-p-beta/project" style="--ng-project:#c586c0"><i>▤</i><span>Beta</span><small>24/08 [2]</small></a></div></section>
</aside>
<main><div class="thread"><div class="turn" data-message-author-role="user">Refais une passe intégrale.</div><div class="turn" data-message-author-role="assistant">Travail en cours.</div></div><form class="composer" data-type="unified-composer" onsubmit="return false"><textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea><button type="button" data-testid="send-button" aria-label="Envoyer">↑</button></form></main>
<aside id="ng8-rail" aria-label="Outils NiakGPT"><button aria-label="Explorer">▤</button><button aria-label="Sommaire">☷</button><button data-q aria-label="Quick Open">⌘</button></aside><aside id="ng8-panel"></aside><div id="ng8-status"><span class="ng8-version">NiakGPT 0.9.76</span><span class="ng8-status-project">Alpha</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng8-core-state">PRÊT</span></div>
<script>window.__store={'niakgpt-v08-cache':{projects:[{id:'g-p-alpha',name:'Alpha'},{id:'g-p-beta',name:'Beta'}],chats:[]}};window.chrome={storage:{local:{get:async key=>{const keys=Array.isArray(key)?key:[key];const out={};for(const k of keys)out[k]=window.__store[k];return out;}},onChanged:{addListener:()=>{}}},runtime:{getManifest:()=>({version:'0.9.76'})}};</script>
</body></html>`;
try{
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:uxCss});
  const hiddenBefore=await page.locator('#ng8-pins').evaluate(el=>getComputedStyle(el).visibility==='hidden');assert(hiddenBefore,'misplaced Project block must be hidden before verified placement');
  await page.addScriptTag({content:uxJs});
  await page.waitForTimeout(220);

  const placement=await page.evaluate(()=>{const pins=document.getElementById('ng8-pins'),left=document.querySelector('.left'),bait=document.getElementById('central-bait');return{mounted:pins?.dataset.ng131Mounted,parentLeft:!!pins&&left.contains(pins),insideBait:!!pins&&bait.contains(pins),visible:pins?getComputedStyle(pins).visibility:null,surface:document.documentElement.dataset.ng131Surface};});
  assert(placement.mounted==='1',`Project block not verified: ${JSON.stringify(placement)}`);assert(placement.parentLeft,'Project block was not moved to the actual left sidebar');assert(!placement.insideBait,'Project block remained in central fake sidebar');assert(placement.visible==='visible','verified Project block stayed hidden');assert(placement.surface==='conversation','conversation surface misclassified');

  const shell=await page.evaluate(()=>{const body=getComputedStyle(document.body),status=document.getElementById('ng8-status').getBoundingClientRect(),rail=getComputedStyle(document.getElementById('ng8-rail'));return{paddingRight:body.paddingRight,paddingBottom:body.paddingBottom,statusWidth:status.width,statusLeft:status.left,statusRight:status.right,railWidth:rail.width,railOpacity:rail.opacity,scrollWidth:document.documentElement.scrollWidth,innerWidth};});
  assert(shell.paddingRight==='0px'&&shell.paddingBottom==='0px',`permanent body reservation survived: ${JSON.stringify(shell)}`);assert(shell.statusWidth<600,`status still spans the viewport: ${JSON.stringify(shell)}`);assert(shell.scrollWidth<=shell.innerWidth,`horizontal overflow: ${JSON.stringify(shell)}`);

  await page.addScriptTag({content:coachJs});
  await page.locator('#prompt-textarea').fill('Analyse intégralement cette interface, corrige les problèmes UX et vérifie les régressions avant de terminer.');
  await page.waitForTimeout(260);
  const collapsed=await page.evaluate(()=>{const box=document.getElementById('ng8-coach'),detail=box?.querySelector('.ng131-coach-detail'),r=box?.getBoundingClientRect();return{exists:!!box,hidden:detail?.hidden,height:r?.height||0,text:box?.innerText||''};});
  assert(collapsed.exists,'compact prompt coach missing');assert(collapsed.hidden===true,'prompt coach detail opened automatically');assert(collapsed.height<=46,`collapsed prompt coach is still huge: ${JSON.stringify(collapsed)}`);assert(!collapsed.text.includes('DEMANDE ORIGINALE — À CONSERVER INTÉGRALEMENT'),'full technical prompt leaked while collapsed');
  await page.locator('#ng8-coach [data-toggle]').click();await page.waitForTimeout(40);
  const expanded=await page.evaluate(()=>({hidden:document.querySelector('#ng8-coach .ng131-coach-detail')?.hidden,preview:document.querySelector('#ng8-coach .ng100-prompt-preview')?.textContent||''}));assert(expanded.hidden===false,'coach did not expand on explicit request');assert(expanded.preview.includes('Analyse intégralement cette interface')&&expanded.preview.length>120,'expanded coach lost optimization content');
  await page.keyboard.press('Escape');assert(await page.locator('#ng8-coach .ng131-coach-detail').evaluate(el=>el.hidden),'Escape did not collapse prompt coach');

  await page.evaluate(()=>{history.pushState({},'', '/');window.dispatchEvent(new PopStateEvent('popstate'));});await page.waitForTimeout(80);
  const home=await page.evaluate(()=>({surface:document.documentElement.dataset.ng131Surface,railPointer:getComputedStyle(document.getElementById('ng8-rail')).pointerEvents,railOpacity:getComputedStyle(document.getElementById('ng8-rail')).opacity}));assert(home.surface==='home',`home surface not detected: ${JSON.stringify(home)}`);assert(home.railPointer==='none'&&Number(home.railOpacity)===0,`right rail still intrudes on home: ${JSON.stringify(home)}`);

  assert(errors.length===0,`browser errors: ${JSON.stringify(errors)}`);
  await page.screenshot({path:path.join(out,'ux-integral.png'),fullPage:true});
  await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify({browser:requested,placement,shell,collapsed,expanded,home,errors},null,2),'utf8');
  console.log(`ux-integral-v131 ${requested}: PASS sidebar-placement+quiet-shell+compact-coach+home`);
}catch(error){
  try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});await fs.writeFile(path.join(out,'failure.html'),await page.content(),'utf8');await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:String(error?.stack||error),errors},null,2),'utf8');}catch{}
  throw error;
}finally{await context.close();await browser.close();}
