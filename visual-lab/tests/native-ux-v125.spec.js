const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const ux=fs.readFileSync(path.join(ROOT,'native-ux-v125.js'),'utf8');
const limit=fs.readFileSync(path.join(ROOT,'continuity-limit-v125.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'native-ux-v125.css'),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';
const PID='g-p-aaaaaaaaaaaaaaaa';

async function base(page){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<!doctype html><html><body>
    <aside data-testid="conversation-sidebar" style="position:fixed;left:0;top:0;width:300px;height:800px">
      <div class="brand" style="height:48px">ChatGPT</div>
      <nav><a href="/library">Bibliothèque</a><a href="/projects">Projects</a>
        <section id="native-projects"><h3>Projects</h3><div data-sidebar-item="true" id="native-project-row"><a href="/g/${PID}/project">Studio</a><button id="native-project-more" aria-label="Plus d’options">•••</button></div></section>
        <section id="ng8-pins"><div class="ng8-pin-list"><div class="ng96-pin-entry" data-pid="${PID}"><a data-ng8-pin="1" data-ng121-pid="${PID}" href="/g/${PID}/project">Studio</a><button class="ng113-native-actions ng113-native-actions-project" data-ng113-actions="project" data-ng113-id="${PID}">•••</button><div class="ng96-pin-drawer"><div class="ng96-folder-list"><div class="ng96-chat-entry"><a data-chat="${CHAT}" href="/c/${CHAT}"><span>Conversation</span></a><button class="ng113-native-actions ng113-native-actions-chat"><span>•••</span></button></div></div></div></div></div></section>
      </nav>
    </aside>
    <main style="margin-left:320px"><article data-message-author-role="assistant" id="prose">La conversation peut atteindre une limite et demander un nouveau chat dans certains cas.</article>
      <form data-type="unified-composer"><textarea id="prompt-textarea"></textarea><button id="plus" type="button">+</button><input id="composer-file" type="file" accept="image/*" hidden></form>
    </main>
    <div class="ng8-bot" style="display:block">BOT</div>
  </body></html>`}));
  await page.goto(`https://chatgpt.com/c/${CHAT}`);
  await page.addStyleTag({content:css});
  await page.evaluate(()=>{
    window.__opened=[];window.open=(url)=>{window.__opened.push(String(url));return null;};
    window.__settingsOpened=0;
    document.getElementById('native-project-more').addEventListener('click',()=>{
      document.querySelector('#native-project-menu')?.remove();const m=document.createElement('div');m.id='native-project-menu';m.setAttribute('role','menu');m.innerHTML='<button role="menuitem">Renommer</button><button id="native-project-settings" role="menuitem">Modifier le projet</button>';document.body.appendChild(m);m.querySelector('#native-project-settings').addEventListener('click',()=>window.__settingsOpened++);
    });
    window.__fileClicks=0;document.getElementById('composer-file').addEventListener('click',()=>window.__fileClicks++,true);
  });
  await page.addScriptTag({content:ux});
}

test('0.9.71 native project/chat/file-picker UX contracts',async({page})=>{
  await base(page);

  await test.step('chat ellipsis full visual target is hit-testable at edges',async()=>{
    const hit=await page.evaluate(()=>{
      const b=document.querySelector('.ng113-native-actions-chat'),r=b.getBoundingClientRect(),pts=[[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2],[r.left+r.width/2,r.top+r.height/2]];
      return{w:r.width,h:r.height,hits:pts.map(([x,y])=>!!document.elementFromPoint(x,y)?.closest?.('.ng113-native-actions-chat'))};
    });
    expect(hit.w).toBeGreaterThanOrEqual(32);expect(hit.h).toBeGreaterThanOrEqual(32);expect(hit.hits).toEqual([true,true,true,true,true]);
  });

  await test.step('Cmd/Ctrl left click explicitly opens custom chat in a new tab',async()=>{
    const link=page.locator(`#ng8-pins a[data-chat="${CHAT}"]`);await link.dispatchEvent('click',{button:0,metaKey:true});
    await expect.poll(()=>page.evaluate(()=>window.__opened.length)).toBe(1);expect(await page.evaluate(()=>window.__opened[0])).toContain(`/c/${CHAT}`);expect(page.url()).toContain(`/c/${CHAT}`);
  });

  await test.step('Project menu contains Paramètres du projet and invokes exact native project action',async()=>{
    await page.evaluate(({PID})=>{const m=document.createElement('div');m.id='ng123-action-menu';m.dataset.kind='project';m.dataset.id=PID;m.innerHTML='<strong>Studio</strong><button role="menuitem">Renommer…</button>';document.body.appendChild(m);},{PID});
    const item=page.getByRole('menuitem',{name:'Paramètres du projet'});await expect(item).toBeVisible();await item.click();await expect.poll(()=>page.evaluate(()=>window.__settingsOpened)).toBe(1);
  });

  await test.step('Browse fallback triggers the real composer file input without touching drag/drop',async()=>{
    await page.evaluate(()=>{const m=document.createElement('div');m.id='attach-menu';m.setAttribute('role','menu');m.innerHTML='<button id="browse" role="menuitem">Parcourir</button>';document.body.appendChild(m);});
    await page.locator('#browse').click();await expect.poll(()=>page.evaluate(()=>window.__fileClicks)).toBeGreaterThan(0);
  });

  await test.step('native settings modal suppresses decorative mascots',async()=>{
    await page.evaluate(()=>{const d=document.createElement('div');d.id='settings-modal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.style.cssText='position:fixed;inset:20px;background:#111';d.textContent='Paramètres';document.body.appendChild(d);});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng125NativeModal)).toBe('1');await expect(page.locator('.ng8-bot')).toBeHidden();
  });
});

test('0.9.71 modern limit card is event driven and prose alone never mounts continuity',async({page})=>{
  await base(page);
  await page.evaluate(()=>{window.__marks=[];window.__NIAKGPT_CONTINUITY__={markCurrentOut:async(reason,meta)=>{window.__marks.push({reason,meta});return true;}};});
  await page.addScriptTag({content:limit});
  await page.waitForTimeout(250);await expect(page.locator('#ng119-interruption')).toHaveCount(0);expect(await page.evaluate(()=>window.__marks.length)).toBe(0);

  await page.evaluate(()=>{const card=document.createElement('section');card.id='native-limit-card';card.innerHTML='<strong>Cette conversation a atteint sa limite maximum.</strong><button type="button">Continuer dans un nouveau chat</button>';document.querySelector('main').appendChild(card);});
  await expect(page.locator('#ng119-interruption[data-ng125-limit="1"]')).toBeVisible();await expect(page.locator('#ng119-interruption .ng100-continue')).toHaveText('CONTINUER LE FIL');
  const marks=await page.evaluate(()=>window.__marks);expect(marks).toHaveLength(1);expect(marks[0].reason).toBe('limit-detected-v125');expect(marks[0].meta.evidence).toBe('native-limit-v120');
  expect(await page.evaluate(()=>document.documentElement.dataset.ng125LimitReady)).toBe('1');
});