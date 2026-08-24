const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', '..');
const fixture = fs.readFileSync(path.join(__dirname, '..', 'runtime-fixture.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;
const CHAT1='11111111-1111-4111-8111-111111111111';
const CHAT2='22222222-2222-4222-8222-222222222222';
const CHAT3='33333333-3333-4333-8333-333333333333';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';

const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:`${name} project`},instructions:''}}});
const chatRaw=(id,title,projectId,time)=>({id,title,gizmo_id:projectId,update_time:time,create_time:time});

async function launch(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'niakgpt-audit-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,channel:'chromium',viewport:{width:1440,height:900},args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  let worker=context.serviceWorkers().find(w=>w.url().includes('background-v100.js'));
  if(!worker)worker=await context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:10000});
  await worker.evaluate(async version=>{await chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version,at:Date.now()}});},VERSION);
  const chats=[chatRaw(CHAT1,'Runtime integration test',P1,1786608000),chatRaw(CHAT2,'Second conversation',P1,1786521600),chatRaw(CHAT3,'Research conversation',P2,1786435200)];
  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),u=new URL(req.url()),method=req.method().toUpperCase();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document'&&/^\/c\/[0-9a-f-]+$/i.test(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
    if(u.pathname==='/api/auth/session')return json({accessToken:'audit-token'});
    if(u.pathname==='/backend-api/gizmos/snorlax/sidebar')return json({items:[projectRaw(P1,'Studio'),projectRaw(P2,'Research Lab')],cursor:null});
    if(/^\/backend-api\/gizmos\/g-p-[A-Za-z0-9]+\/conversations$/.test(u.pathname)){
      const pid=u.pathname.match(/\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations/)[1];return json({items:chats.filter(c=>c.gizmo_id===pid),cursor:null});
    }
    if(u.pathname==='/backend-api/conversations')return json({items:chats,has_more:false,total:chats.length});
    const cm=u.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);if(cm&&method==='GET')return json({id:cm[1],title:chats.find(c=>c.id===cm[1])?.title||'Conversation',gizmo_id:chats.find(c=>c.id===cm[1])?.gizmo_id||null,update_time:1786608000,current_node:'node-1',mapping:{}});
    if((u.pathname==='/backend-api/conversation'||u.pathname==='/backend-api/f/conversation')&&method==='POST'){await new Promise(r=>setTimeout(r,600));return json({ok:true,conversation_id:CHAT1});}
    return route.fulfill({status:204,body:''});
  });
  const page=context.pages()[0]||await context.newPage();
  await page.goto(`https://chatgpt.com/c/${CHAT1}`,{waitUntil:'commit'});
  await expect(page.locator('#native-brand')).toBeVisible({timeout:8000});
  await expect(page.locator('#ng8-status')).toBeVisible({timeout:12000});
  await expect(page.locator('#ng8-status')).toContainText(VERSION);
  return{context,page,close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});}};
}

async function waitWorker(page){await expect.poll(()=>page.locator('html').getAttribute('data-ng8-tab-role'),{timeout:10000}).toBe('worker');}

function drift(a,b){return Math.abs((a??0)-(b??0));}

test('pinned Project opens an instant local folder instead of navigating away',async()=>{
  const rt=await launch();
  try{
    await waitWorker(rt.page);
    const pin=rt.page.locator(`#ng8-pins a[href*="${P1}"]`).first();
    await expect(pin).toBeVisible({timeout:12000});
    await expect.poll(async()=>pin.locator('small').textContent(),{timeout:12000}).toMatch(/2|\[2\]/);
    const before=rt.page.url();
    await pin.click();
    expect(rt.page.url()).toBe(before);
    await expect(pin).toHaveAttribute('aria-expanded','true');
    const drawer=rt.page.locator(`.ng96-pin-drawer[data-pid="${P1}"]`);
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Runtime integration test');
    await expect(drawer).toContainText('Second conversation');
    await expect(drawer.locator('[data-chat]')).toHaveCount(2);
    const entry=pin.locator('xpath=..');
    await expect(entry.locator('.ng96-project-open')).toHaveCount(0);
    await expect(entry.locator('.ng113-native-actions-project')).toBeVisible();
  }finally{await rt.close();}
});

test('bottom status geometry is invariant across all activity labels',async()=>{
  const rt=await launch();
  try{
    // #ng8-status is mounted by the core before activity-ui appends its dedicated state cell.
    // Geometry must be measured only after that final owner is present, otherwise the lab
    // itself races the runtime and dereferences a null element before any geometry assertion.
    await expect(rt.page.locator('#ng8-status .ng86-status-state')).toBeVisible({timeout:4000});
    const snapshot=async(state,label)=>rt.page.evaluate(({state,label})=>{
      const bar=document.getElementById('ng8-status'),status=bar.querySelector('.ng86-status-state');
      bar.dataset.ng86Activity=state;status.textContent=label;
      const get=sel=>{const r=bar.querySelector(sel)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;};
      return{version:get('.ng8-version'),project:get('.ng8-status-project'),skynet:get('strong'),state:get('.ng86-status-state')};
    },{state,label});
    const cases=[['ready','PRÊT'],['loading','CHARGEMENT'],['waiting','ATTENTE'],['thinking','RÉFLEXION / ANALYSE'],['executing','EXÉCUTION'],['error','ERREUR']];
    const values=[];for(const [state,label] of cases)values.push(await snapshot(state,label));
    const base=values[0];for(const v of values.slice(1)){
      expect(drift(v.version.x,base.version.x)).toBeLessThanOrEqual(0.6);
      expect(drift(v.project.x,base.project.x)).toBeLessThanOrEqual(0.6);
      expect(drift(v.skynet.x,base.skynet.x)).toBeLessThanOrEqual(0.6);
      expect(drift(v.state.x,base.state.x)).toBeLessThanOrEqual(0.6);
      expect(drift(v.state.w,base.state.w)).toBeLessThanOrEqual(0.2);
    }
  }finally{await rt.close();}
});

test('Matrix and Terminator easter eggs remain mounted while quiet v131 hides BY SKYNET from the passive status capsule',async()=>{
  const rt=await launch();
  try{
    await expect(rt.page.locator('#ng8-matrix')).toBeVisible({timeout:4000});
    await expect(rt.page.locator('.ng8-bot')).toHaveCount(3);
    await expect(rt.page.locator('#ng8-status>strong')).toHaveText('BY SKYNET');
    const quiet=await rt.page.evaluate(()=>{
      const bar=document.getElementById('ng8-status'),mark=bar.querySelector(':scope>strong'),style=getComputedStyle(mark),r=bar.getBoundingClientRect();
      return{display:style.display,width:r.width,height:r.height,viewport:innerWidth};
    });
    expect(quiet.display).toBe('none');
    expect(quiet.width).toBeLessThanOrEqual(Math.min(520,quiet.viewport-18)+1);
    expect(quiet.height).toBeLessThanOrEqual(26);
  }finally{await rt.close();}
});

test('native Sources/Outputs panels and collapsed handles stay left of NiakGPT rail',async()=>{
  const rt=await launch();
  try{
    for(const label of ['Sources','Sorties']){
      await rt.page.evaluate(label=>{
        document.querySelectorAll('.lab-side-trigger,.lab-side-panel').forEach(x=>x.remove());
        const trigger=document.createElement('button');trigger.className='lab-side-trigger';trigger.setAttribute('aria-label',label);trigger.textContent=label;Object.assign(trigger.style,{position:'fixed',right:'0px',top:'150px',width:'70px',height:'32px',zIndex:'10'});document.body.appendChild(trigger);trigger.click();
        setTimeout(()=>{const panel=document.createElement('aside');panel.className='lab-side-panel';panel.setAttribute('role','dialog');panel.innerHTML=`<header><h2>${label}</h2></header><div>Contenu ${label}</div>`;Object.assign(panel.style,{position:'fixed',right:'0px',top:'48px',bottom:'24px',width:'360px',zIndex:'9'});document.body.appendChild(panel);},30);
      },label);
      const trigger=rt.page.locator('.lab-side-trigger');
      await expect(trigger).toHaveClass(/ng96-native-side-trigger/,{timeout:3000});
      const panel=rt.page.locator('.lab-side-panel');
      await expect(panel).toHaveClass(/ng96-native-sidepanel/,{timeout:3000});
      const boxes=await rt.page.evaluate(()=>{const rail=document.getElementById('ng8-rail').getBoundingClientRect(),t=document.querySelector('.lab-side-trigger').getBoundingClientRect(),p=document.querySelector('.lab-side-panel').getBoundingClientRect();return{rail:{left:rail.left},trigger:{right:t.right},panel:{right:p.right}};});
      expect(boxes.trigger.right).toBeLessThanOrEqual(boxes.rail.left-1);
      expect(boxes.panel.right).toBeLessThanOrEqual(boxes.rail.left+1);
      await expect(panel.locator('.ng96-side-close')).toBeVisible();
    }
  }finally{await rt.close();}
});

test('contextual coach changes recommendations with the actual prompt',async()=>{
  const rt=await launch();
  try{
    const editor=rt.page.locator('#prompt-textarea');
    await editor.fill('Optimise le cache chaud de cette extension Chrome sans polling, avec plusieurs onglets, et ajoute des tests Playwright.');
    const coach=rt.page.locator('#ng8-coach[data-ng100-coach="1"]');
    await expect(coach).toBeVisible({timeout:4000});
    await expect(coach).toContainText('Chemin chaud');
    await expect(coach).toContainText('Mesure réelle');
    await expect(coach).toContainText('Architecture cible');
    await expect(coach).toContainText('cache chaud');

    await editor.fill('Revois le design de la barre du bas : aucun décalage entre ATTENTE, ANALYSE et EXÉCUTION, et vérifie les chevauchements responsive.');
    await expect(coach).toContainText('Hiérarchie UX',{timeout:3000});
    await expect(coach).toContainText('États complets');
    await expect(coach).toContainText('Critère visuel');
  }finally{await rt.close();}
});

test('coach stays outside attachment previews instead of covering them',async()=>{
  const rt=await launch();
  try{
    const editor=rt.page.locator('#prompt-textarea');
    await editor.fill('Analyse cette image jointe et donne-moi trois améliorations UX précises.');
    const coach=rt.page.locator('#ng8-coach[data-ng100-coach="1"]');
    await expect(coach).toBeVisible({timeout:4000});
    await rt.page.evaluate(()=>{
      const composer=document.querySelector('[data-type="unified-composer"]');
      const attachment=document.createElement('div');attachment.className='attachment-preview';attachment.setAttribute('data-testid','attachment-preview');attachment.textContent='image.png';Object.assign(attachment.style,{width:'150px',height:'58px',flex:'0 0 150px',border:'1px solid #777'});composer.prepend(attachment);
    });
    const overlap=await rt.page.evaluate(()=>{
      const a=document.querySelector('.attachment-preview').getBoundingClientRect(),c=document.getElementById('ng8-coach').getBoundingClientRect();
      return !(c.right<=a.left||c.left>=a.right||c.bottom<=a.top||c.top>=a.bottom);
    });
    expect(overlap).toBe(false);
  }finally{await rt.close();}
});

test('organizer and pins diagnostics resolve instead of staying in ATTENTE',async()=>{
  const rt=await launch();
  try{
    await rt.page.locator('#ng8-rail [data-tab="diag"]').click();
    const diag=rt.page.locator('#ng8-panel .ng8-diag');
    await expect(diag).toBeVisible({timeout:3000});
    const organizer=diag.locator(':scope > div').filter({hasText:'organizer'}).locator('b');
    const pins=diag.locator(':scope > div').filter({hasText:'pins'}).locator('b');
    await expect.poll(()=>organizer.textContent(),{timeout:6000}).not.toMatch(/^ATTENTE|^$/);
    await expect.poll(()=>pins.textContent(),{timeout:10000}).not.toMatch(/^ATTENTE|^$/);
  }finally{await rt.close();}
});
