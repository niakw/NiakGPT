const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', '..');
const baseFixture = fs.readFileSync(path.join(__dirname, '..', 'runtime-fixture.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;
const CHAT1='11111111-1111-4111-8111-111111111111';
const CHAT2='22222222-2222-4222-8222-222222222222';
const CHAT3='33333333-3333-4333-8333-333333333333';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';

function projectRaw(id,name){return {gizmo:{gizmo:{id,display:{name,description:`${name} project`},instructions:''}}};}
function chatRaw(id,title,time){return {id,title,update_time:time,create_time:time};}
function currentFixture(){
  let html=baseFixture;
  html=html.replace('</style>','.lab-project-menu{position:fixed;top:50px;right:82px;z-index:30;width:220px;padding:6px;background:#111923;border:1px solid #425466;border-radius:10px}.lab-project-menu[hidden]{display:none}.lab-project-menu button{display:block;width:100%;padding:10px;border:0;background:transparent;color:#e5edf5;text-align:left;border-radius:7px}.lab-project-menu button:hover{background:#243241}</style>');
  html=html.replace('<div class="lab-native-actions"><button id="lab-send-native">Simuler réponse</button><button id="lab-move-native">Déplacer natif</button></div>','<div class="lab-native-actions"><button id="lab-send-native">Simuler réponse</button><button id="lab-move-native" aria-haspopup="menu">Déplacer natif</button></div><div id="lab-project-menu" class="lab-project-menu" role="menu" aria-label="Déplacer vers un projet" hidden><button id="lab-project-option" role="menuitem">Research Lab</button></div>');
  html=html.replace("document.getElementById('native-send').addEventListener('click',window.labSend);document.getElementById('lab-send-native').addEventListener('click',window.labSend);document.getElementById('lab-move-native').addEventListener('click',()=>window.labMove());","document.getElementById('native-send').addEventListener('click',window.labSend);document.getElementById('lab-send-native').addEventListener('click',window.labSend);const moveBtn=document.getElementById('lab-move-native'),moveMenu=document.getElementById('lab-project-menu'),moveOption=document.getElementById('lab-project-option');moveBtn.addEventListener('click',()=>{moveMenu.hidden=!moveMenu.hidden;});moveOption.addEventListener('click',()=>{moveMenu.hidden=true;window.labMove();});");
  return html;
}

async function extensionWorker(context){
  return context.serviceWorkers().find(w=>w.url().includes('background-v100.js')) || context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:10000});
}

async function launch(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-current-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1440,height:900},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const worker=await extensionWorker(context);
  await worker.evaluate(async version=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}}),VERSION);
  const state={projectByChat:{[CHAT1]:P1,[CHAT2]:P1,[CHAT3]:P2},conversationGets:0,sendRequests:0,projectGets:0};
  const chats=[chatRaw(CHAT1,'Runtime integration test',1786608000),chatRaw(CHAT2,'Second conversation',1786521600),chatRaw(CHAT3,'Research conversation',1786435200)];
  const materialize=c=>({...c,gizmo_id:state.projectByChat[c.id]||null});

  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method().toUpperCase();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&/^\/c\/[0-9a-f-]+$/i.test(url.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:currentFixture()});
    if(url.pathname==='/api/auth/session')return json({accessToken:'runtime-current-token'});
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[projectRaw(P1,'Studio'),projectRaw(P2,'Research Lab')],cursor:null});
    const pm=url.pathname.match(/^\/backend-api\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations$/);
    if(pm){state.projectGets++;return json({items:chats.filter(c=>state.projectByChat[c.id]===pm[1]).map(materialize),cursor:null});}
    if(url.pathname==='/backend-api/conversations')return json({items:chats.map(materialize),has_more:false,total:chats.length});
    const cm=url.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);
    if(cm){
      const id=cm[1];
      if(method==='PATCH'){
        let body={};try{body=req.postDataJSON()||{};}catch{}
        state.projectByChat[id]=typeof body.gizmo_id==='string'?body.gizmo_id:'';
        return json({id,gizmo_id:state.projectByChat[id]||null});
      }
      if(method==='GET'){state.conversationGets++;return json({id,gizmo_id:state.projectByChat[id]||null,mapping:{}});}
    }
    if((url.pathname==='/backend-api/conversation'||url.pathname==='/backend-api/f/conversation')&&method==='POST'){
      state.sendRequests++;await new Promise(r=>setTimeout(r,850));return json({ok:true,conversation_id:CHAT1});
    }
    return route.fulfill({status:204,body:''});
  });

  const page=context.pages()[0]||await context.newPage();
  const pageErrors=[],consoleProblems=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleProblems.push(`${m.type()}:${m.text()}`);});
  await page.goto(`https://chatgpt.com/c/${CHAT1}`,{waitUntil:'commit'});
  await expect(page.locator('#prompt-textarea')).toBeVisible({timeout:8000});
  await expect(page.locator('#ng8-status')).toContainText(VERSION,{timeout:12000});
  await expect.poll(()=>page.locator('html').getAttribute('data-ng86-activity'),{timeout:10000}).toBe('ready');
  return {context,worker,page,state,pageErrors,consoleProblems,close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});}};
}

function lifecycleMessages(lines){
  const text=lines.join('\n');
  return ['[NiakGPT cache bus write]','[NiakGPT multitab] lock','Channel is closed','Extension context invalidated'].filter(x=>text.includes(x));
}

test('current activity path sees the real Send click before native thinking DOM',async()=>{
  const rt=await launch();
  try{
    await rt.page.evaluate(()=>{window.__ng105States=[];document.addEventListener('niakgpt:activity-changed',e=>window.__ng105States.push(e.detail?.state));});
    await rt.page.locator('#native-send').click();
    await expect.poll(()=>rt.page.evaluate(()=>window.__ng105States||[]),{timeout:2500}).toContain('waiting');
    await expect.poll(()=>rt.page.locator('html').getAttribute('data-ng86-activity'),{timeout:3000}).toMatch(/thinking|executing|ready/);
    expect(rt.state.sendRequests).toBe(1);
    expect(rt.pageErrors).toEqual([]);
    expect(lifecycleMessages(rt.consoleProblems)).toEqual([]);
  }finally{await rt.close();}
});

test('trusted Project menu move is locked without any full conversation GET',async()=>{
  const rt=await launch();
  try{
    const p2=rt.page.locator(`#ng8-pins a[href*="${P2}"]`).first();
    await expect(p2).toBeVisible({timeout:16000});
    await rt.page.locator('#lab-move-native').click();
    await expect(rt.page.locator('#lab-project-menu')).toBeVisible();
    await rt.page.locator('#lab-project-option').click();
    const row=rt.page.locator(`a[href="/c/${CHAT1}"]`).first();
    await expect(row).toHaveAttribute('data-ng85-manual','1',{timeout:10000});
    await expect(row.locator('.ng85-manual-lock')).toBeVisible();
    expect(rt.state.projectByChat[CHAT1]).toBe(P2);
    expect(rt.state.projectGets).toBeGreaterThan(0);
    expect(rt.state.conversationGets).toBe(0);
    await row.locator('.ng85-manual-lock').click();
    await expect(row).toHaveAttribute('data-ng85-manual','0');
    await expect(row.locator('.ng85-manual-lock')).toHaveCount(0);
    expect(rt.pageErrors).toEqual([]);
    expect(lifecycleMessages(rt.consoleProblems)).toEqual([]);
  }finally{await rt.close();}
});

test('unpacked extension hides native Projects and keeps Project chats stable, active, clickable and OUT-cached',async()=>{
  const rt=await launch();
  try{
    const nativeHeading=rt.page.locator('.nav h3').filter({hasText:/^Projects$/});
    await expect(nativeHeading).toBeHidden({timeout:16000});
    for(const nativeProject of await rt.page.locator('.project-list a').all())await expect(nativeProject).toBeHidden();
    await expect(rt.page.locator('.recent-list')).toBeVisible();
    await expect(rt.page.locator('#lab-chat-active')).toBeVisible();

    const p1=rt.page.locator(`#ng8-pins a[href*="${P1}"]`).first();
    await expect(p1).toBeVisible({timeout:16000});
    await p1.click();
    const drawer=rt.page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${P1}"]`);
    await expect(drawer).toBeVisible();
    const row1=drawer.locator(`.ng109-chat-row[data-chat-row="${CHAT1}"]`);
    const row2=drawer.locator(`.ng109-chat-row[data-chat-row="${CHAT2}"]`);
    await expect(row1).toBeVisible();
    await expect(row2).toBeVisible();
    await expect(row1).toHaveAttribute('data-ng109-active','1');
    await expect(row1.locator('a[data-chat]')).toHaveAttribute('aria-current','page');

    const layout=await rt.page.evaluate(chatId=>{
      const row=document.querySelector(`#ng8-pins .ng109-chat-row[data-chat-row="${chatId}"]`),title=row.querySelector('.ng96-chat-title'),time=row.querySelector('time');
      window.__ngStableProjectRow=row;window.__ngStableProjectTimeX=time.getBoundingClientRect().x;
      return {titleRight:title.getBoundingClientRect().right,timeLeft:time.getBoundingClientRect().left};
    },CHAT1);
    expect(layout.titleRight).toBeLessThanOrEqual(layout.timeLeft+1);

    await rt.page.evaluate(()=>{
      const drawer=document.querySelector('#ng8-pins .ng96-pin-drawer');
      for(let i=0;i<30;i++){const n=document.createElement('i');drawer.appendChild(n);n.remove();}
    });
    await rt.page.waitForTimeout(450);
    expect(await rt.page.evaluate(chatId=>document.querySelector(`#ng8-pins .ng109-chat-row[data-chat-row="${chatId}"]`)===window.__ngStableProjectRow,CHAT1)).toBe(true);
    expect(Math.abs(await rt.page.evaluate(chatId=>document.querySelector(`#ng8-pins .ng109-chat-row[data-chat-row="${chatId}"] time`).getBoundingClientRect().x-window.__ngStableProjectTimeX,CHAT1))).toBeLessThan(1);

    await rt.worker.evaluate(async chatId=>chrome.storage.local.set({'niakgpt-continuity-v100':{schema:1,out:{[chatId]:{out:true,title:'Second conversation',reason:'limit-detected',updatedAt:1787000000000}}}}),CHAT2);
    await expect(row2).toHaveAttribute('data-ng109-out','1',{timeout:6000});
    await expect(row2.locator('.ng109-out-badge')).toHaveText('OUT');
    await expect(drawer.locator('.ng109-chat-row').last()).toHaveAttribute('data-chat-row',CHAT2);
    const cacheOut=await rt.worker.evaluate(async chatId=>{
      const cache=(await chrome.storage.local.get('niakgpt-v08-cache'))['niakgpt-v08-cache'];
      const top=(cache?.chats||[]).find(c=>c.id===chatId),project=Object.values(cache?.projectChats||{}).flat().find(c=>c.id===chatId);
      return {top:top?.out===true,project:project?.out===true};
    },CHAT2);
    expect(cacheOut).toEqual({top:true,project:true});

    await rt.page.evaluate(()=>{window.__ngNativeChatClicks=0;document.getElementById('lab-chat-active').addEventListener('click',e=>{e.preventDefault();window.__ngNativeChatClicks++;});});
    await row1.locator('a[data-chat]').click();
    await expect.poll(()=>rt.page.evaluate(()=>window.__ngNativeChatClicks),{timeout:2500}).toBe(1);
    expect(rt.state.conversationGets).toBe(0);
    expect(rt.pageErrors).toEqual([]);
    expect(lifecycleMessages(rt.consoleProblems)).toEqual([]);
  }finally{await rt.close();}
});
