const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const ux=fs.readFileSync(path.join(ROOT,'native-ux-v126.js'),'utf8');
const uxCss=fs.readFileSync(path.join(ROOT,'native-ux-v126.css'),'utf8');
const limit=fs.readFileSync(path.join(ROOT,'continuity-limit-v125.js'),'utf8');
const continuity=fs.readFileSync(path.join(ROOT,'continuity-live-v126.js'),'utf8');
const PID='g-p-aaaaaaaaaaaaaaaa';
const CHAT='11111111-1111-4111-8111-111111111111';

test.setTimeout(60000);

async function mount(page){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<!doctype html><html><body style="margin:0;background:#0b1016;color:#e6edf4;font-family:Arial">
  <aside data-testid="conversation-sidebar" style="position:fixed;inset:0 auto 0 0;width:310px;background:#101820;padding:8px">
    <div class="brand" style="height:48px">ChatGPT Plus</div>
    <nav><a href="/" style="display:block;padding:8px">Nouveau chat</a><a href="/library" style="display:block;padding:8px">Bibliothèque</a><a href="/projects" style="display:block;padding:8px">Projects</a>
      <section id="native-projects"><h3>Projects</h3><div data-sidebar-item="true" id="native-project-row" style="display:grid;grid-template-columns:1fr 36px"><a id="native-project-link" href="/g/${PID}/project">Studio</a><button id="native-project-more" aria-label="Plus d’options">•••</button></div></section>
      <h3>Récents</h3><a href="/c/${CHAT}">Recent</a>
      <section id="ng8-pins" style="margin-top:10px"><div class="ng8-pin-list"><div class="ng96-pin-entry" data-pid="${PID}" style="display:grid;grid-template-columns:1fr 38px"><a data-ng8-pin="1" data-ng121-pid="${PID}" href="/g/${PID}/project">Studio</a><button class="ng113-native-actions ng113-native-actions-project" data-ng123-action="project" data-ng123-id="${PID}">•••</button><div class="ng96-pin-drawer"><div class="ng96-folder-list"><div class="ng96-chat-entry"><a data-chat="${CHAT}" href="/c/${CHAT}"><span>Conversation</span></a><button class="ng113-native-actions ng113-native-actions-chat"><span>•••</span></button></div></div></div></div></div></section>
    </nav>
  </aside>
  <main style="margin-left:330px;padding:40px"><article data-message-author-role="assistant">Réponse normale parlant éventuellement de limite sans alerte native.</article>
    <form data-type="unified-composer" style="position:fixed;left:360px;right:40px;bottom:40px"><textarea id="prompt-textarea" data-testid="prompt-textarea" style="width:80%;height:80px"></textarea><input id="composer-file" type="file" accept="image/*" hidden></form>
  </main>
  </body></html>`}));
  await page.goto(`https://chatgpt.com/c/${CHAT}`);
  await page.addStyleTag({content:uxCss});
  await page.evaluate(({PID,CHAT})=>{
    const storage={
      'niakgpt-v08-cache':{projects:[{id:PID,name:'Studio'}],chats:[{id:CHAT,title:'Conversation',projectId:PID}],projectChats:{[PID]:[]},counts:{[PID]:1}},
      'niakgpt-continuity-v100':{schema:2,out:{[CHAT]:{projectId:PID,title:'Conversation',history:'UTILISATEUR\nContexte important',sourceUrl:`https://chatgpt.com/c/${CHAT}`,evidence:'native-limit-v120'}}}
    };
    window.chrome={storage:{local:{get:async key=>{if(Array.isArray(key))return Object.fromEntries(key.map(k=>[k,storage[k]]));if(typeof key==='string')return{[key]:storage[key]};return{...storage};},set:async obj=>Object.assign(storage,obj),remove:async key=>{for(const k of Array.isArray(key)?key:[key])delete storage[k];}}}};
    window.__storage=storage;
    window.__NIAKGPT_CONTINUITY__={
      getState:()=>storage['niakgpt-continuity-v100'],
      buildCapsule:(chatId,projectId)=>`CONTINUITÉ NIAKGPT — FIL PRÉCÉDENT ARRIVÉ À SA LIMITE\nPROJECT EXACT À CONSERVER : Studio\nCONVERSATION D’ORIGINE : Conversation\nCHAT=${chatId}\nPROJECT=${projectId}`,
      markCurrentOut:async()=>true
    };
    document.getElementById('native-project-more').addEventListener('click',()=>{
      document.querySelector('#native-project-menu')?.remove();const m=document.createElement('div');m.id='native-project-menu';m.setAttribute('role','menu');m.style.cssText='position:fixed;left:330px;top:150px;z-index:99999;background:#161f29;padding:8px';m.innerHTML='<button role="menuitem">Renommer</button><button id="native-project-settings" role="menuitem">Modifier le projet</button>';document.body.appendChild(m);
      m.querySelector('#native-project-settings').addEventListener('click',()=>{const d=document.createElement('div');d.id='native-project-settings-dialog';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.style.cssText='position:fixed;left:430px;top:120px;width:480px;height:320px;background:#202a34;z-index:100000;padding:20px';d.innerHTML='<h2>Paramètres du projet</h2><label>Instructions <textarea></textarea></label>';document.body.appendChild(d);});
    });
    document.getElementById('native-project-link').addEventListener('click',event=>{event.preventDefault();history.pushState({},'',event.currentTarget.getAttribute('href'));document.getElementById('prompt-textarea').value='';window.dispatchEvent(new PopStateEvent('popstate'));});
  },{PID,CHAT});
  await page.addScriptTag({content:continuity});
  await page.addScriptTag({content:limit});
  await page.addScriptTag({content:ux});
}

test('0.9.72 reported UX is visible in rendered evidence, not just source contracts',async({page},testInfo)=>{
  await mount(page);
  const startUrl=page.url();

  await test.step('Project menu visibly contains settings and opens native popup without redirect',async()=>{
    await page.evaluate(({PID})=>{const m=document.createElement('div');m.id='ng123-action-menu';m.dataset.kind='project';m.dataset.id=PID;m.setAttribute('role','menu');m.style.cssText='position:fixed;left:330px;top:70px;z-index:99999;background:#111;padding:8px';m.innerHTML='<strong>Studio</strong><button role="menuitem">Renommer…</button><button role="menuitem">Actualiser les conversations</button>';document.body.appendChild(m);},{PID});
    const settings=page.getByRole('menuitem',{name:'Paramètres du projet'});await expect(settings).toBeVisible();
    await settings.click();await expect(page.locator('#native-project-settings-dialog')).toBeVisible();expect(page.url()).toBe(startUrl);
    await testInfo.attach('project-settings-popup-v126',{body:await page.screenshot(),contentType:'image/png'});
    await page.locator('#native-project-settings-dialog').evaluate(el=>el.remove());
  });

  await test.step('Chat ellipsis corners are all owned by the button',async()=>{
    const hit=await page.evaluate(()=>{const b=document.querySelector('.ng113-native-actions-chat'),r=b.getBoundingClientRect(),pts=[[r.left+1,r.top+1],[r.right-1,r.top+1],[r.left+1,r.bottom-1],[r.right-1,r.bottom-1],[r.left+r.width/2,r.top+r.height/2]];return{w:r.width,h:r.height,hits:pts.map(([x,y])=>!!document.elementFromPoint(x,y)?.closest('.ng113-native-actions-chat'))};});
    expect(hit.w).toBeGreaterThanOrEqual(36);expect(hit.h).toBeGreaterThanOrEqual(34);expect(hit.hits).toEqual([true,true,true,true,true]);
  });

  await test.step('Modified chat click stays a real anchor default and is not prevented by NiakGPT',async()=>{
    const result=await page.evaluate(({CHAT})=>new Promise(resolve=>{const a=document.querySelector(`a[data-chat="${CHAT}"]`);a.addEventListener('click',event=>queueMicrotask(()=>resolve({prevented:event.defaultPrevented,href:a.href})),{once:true});a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true}));}),{CHAT});
    expect(result.prevented).toBe(false);expect(result.href).toContain(`/c/${CHAT}`);
  });

  await test.step('Browse owns the trusted click and opens the actual file input chooser',async()=>{
    await page.evaluate(()=>{const m=document.createElement('div');m.id='attach-menu';m.setAttribute('role','menu');m.style.cssText='position:fixed;left:450px;bottom:150px;background:#111;padding:8px;z-index:99999';m.innerHTML='<button id="browse" role="menuitem">Parcourir</button>';document.body.appendChild(m);});
    const chooser=page.waitForEvent('filechooser');await page.locator('#browse').click();await chooser;
  });

  await test.step('No continuity UI before a native limit, then handoff injects context only after the limit',async()=>{
    await page.waitForTimeout(180);await expect(page.locator('#ng119-interruption')).toHaveCount(0);
    await page.evaluate(()=>{const card=document.createElement('section');card.id='native-limit-card';card.style.cssText='position:fixed;left:420px;top:120px;background:#3a2020;padding:14px;z-index:90000';card.innerHTML='<strong>Cette conversation a atteint sa limite maximum.</strong><button type="button">Continuer dans un nouveau chat</button>';document.querySelector('main').appendChild(card);});
    await expect(page.locator('#ng119-interruption[data-ng125-limit="1"]')).toBeVisible();
    await page.locator('#ng119-interruption .ng100-continue').click();
    await expect.poll(()=>page.url()).toContain(`/g/${PID}/project`);
    await expect.poll(()=>page.locator('#prompt-textarea').inputValue(),{timeout:8000}).toContain('CONTINUITÉ NIAKGPT');
    const pending=await page.evaluate(()=>window.__storage['niakgpt-continuity-pending-v124']);expect(pending).toBeUndefined();
    await testInfo.attach('continuity-after-real-limit-v126',{body:await page.screenshot(),contentType:'image/png'});
  });

  await test.step('v126 disables the competing v125 direct placement owner',async()=>{
    expect(await page.evaluate(()=>window.__NIAKGPT_SIDEBAR_ROUTE_PLACEMENT_125__)).toBe(true);
  });
});