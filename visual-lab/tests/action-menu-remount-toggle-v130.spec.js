const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const ACTIONS=fs.readFileSync(path.join(ROOT,'sidebar-actions-v123.js'),'utf8');
const ACTIONS_CSS=fs.readFileSync(path.join(ROOT,'sidebar-actions-v123.css'),'utf8');
const AUTHORITY_CSS=fs.readFileSync(path.join(ROOT,'sidebar-projects-authority-v112.css'),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';

async function lab(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:760}});
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>body{margin:0}aside{width:300px;height:100vh;background:#111}#ng8-pins{width:280px;padding:10px}.ng96-chat-entry{display:grid;grid-template-columns:1fr 36px}.ng113-native-actions{width:32px;height:32px}#ng123-action-menu{position:fixed;left:320px;top:20px;min-width:240px;background:white;color:black;padding:8px}</style></head><body><aside data-testid="conversation-sidebar"><div id="ng8-pins"><div class="ng96-chat-entry"><a data-chat="${CHAT}" href="/c/${CHAT}"><span>Conversation remount</span></a><button class="ng113-native-actions ng113-native-actions-chat" data-ng123-action="chat" data-ng123-id="${CHAT}" aria-label="Actions de la conversation">•••</button></div></div></aside></body></html>`}));
  await page.goto('https://chatgpt.com/remount-toggle-lab');
  await page.evaluate(()=>{
    const local={async get(){return {'niakgpt-v08-cache':{projects:[{id:'g-p-aaaaaaaaaaaaaaaa',name:'Studio',href:'/g/g-p-aaaaaaaaaaaaaaaa/project'}],chats:[{id:'11111111-1111-4111-8111-111111111111',title:'Conversation remount'}]}};},async set(){}};
    const onChanged={addListener(){}};
    if(!window.chrome)window.chrome={};
    window.chrome.storage={local,onChanged};
  });
  await page.addScriptTag({content:ACTIONS});
  return{page,browser};
}

test('chat action second click closes the same semantic menu after trigger DOM remount',async()=>{
  const {page,browser}=await lab();
  try{
    let button=page.locator('#ng8-pins .ng113-native-actions-chat');
    await button.click();
    await expect(page.locator('#ng123-action-menu[data-kind="chat"]')).toHaveCount(1);

    await page.evaluate(()=>{
      const old=document.querySelector('#ng8-pins .ng113-native-actions-chat');
      const replacement=old.cloneNode(true);
      replacement.dataset.remountReplacement='1';
      old.replaceWith(replacement);
    });

    button=page.locator('#ng8-pins .ng113-native-actions-chat[data-remount-replacement="1"]');
    await button.click();
    await expect(page.locator('#ng123-action-menu')).toHaveCount(0);
    await expect(button).toHaveAttribute('aria-expanded','false');
    await expect(button).toBeFocused();
  }finally{await browser.close();}
});


test('Project rename stages an authority-hidden native row and submits exact native rename',async()=>{
  const {page,browser}=await lab();
  try{
    await page.addStyleTag({content:AUTHORITY_CSS});
    await page.addStyleTag({content:ACTIONS_CSS});
    await page.evaluate(()=>{
      const pins=document.getElementById('ng8-pins');
      const project=document.createElement('div');project.className='ng96-pin-entry';project.dataset.pid='g-p-aaaaaaaaaaaaaaaa';
      project.innerHTML='<a data-ng8-pin="1" data-ng121-pid="g-p-aaaaaaaaaaaaaaaa" href="https://chatgpt.com/g/g-p-aaaaaaaaaaaaaaaa/project"><span>Studio</span></a><button class="ng113-native-actions ng113-native-actions-project" data-ng123-action="project" data-ng123-id="g-p-aaaaaaaaaaaaaaaa" aria-label="Actions du Project">•••</button>';
      pins.prepend(project);
      const native=document.createElement('section');native.id='native-projects';native.dataset.ng112NativeProjects='1';
      native.innerHTML='<div data-sidebar-item="true"><a href="/g/g-p-aaaaaaaaaaaaaaaa/project">Studio</a><button id="native-project-options" aria-label="Plus d’options">•••</button></div>';
      document.querySelector('aside').prepend(native);
      window.__nativeRenameSubmits=0;
      document.getElementById('native-project-options').addEventListener('click',()=>{
        document.querySelector('.native-project-menu')?.remove();
        const menu=document.createElement('div');menu.className='native-project-menu';menu.setAttribute('role','menu');
        const rename=document.createElement('button');rename.type='button';rename.setAttribute('role','menuitem');rename.textContent='Renommer';menu.append(rename);document.body.append(menu);
        rename.addEventListener('click',()=>{
          document.getElementById('native-project-dialog')?.remove();
          const dialog=document.createElement('div');dialog.id='native-project-dialog';dialog.setAttribute('role','dialog');
          dialog.innerHTML='<input value="Studio"><button type="button">Enregistrer</button>';document.body.append(dialog);
          dialog.querySelector('button').addEventListener('click',()=>{
            window.__nativeRenameSubmits++;
            const name=dialog.querySelector('input').value;
            document.querySelector('#native-projects a').textContent=name;
            dialog.remove();menu.remove();
          });
        });
      });
      document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));
    });
    const button=page.locator('#ng8-pins .ng113-native-actions-project');
    await button.click();
    await page.getByRole('menuitem',{name:'Renommer…'}).click();
    await page.locator('#ng123-rename-dialog input').fill('Studio Renommé UX');
    await page.locator('#ng123-rename-dialog [data-save]').click();
    await expect(page.locator('#ng123-rename-dialog')).toHaveCount(0,{timeout:7000});
    const result=await page.evaluate(()=>({
      submits:window.__nativeRenameSubmits,
      stage:document.documentElement.dataset.ng123ProjectRename||'',
      nativeName:document.querySelector('#native-projects a')?.textContent||''
    }));
    expect(result,{message:JSON.stringify(result)}).toMatchObject({submits:1,stage:'submitted',nativeName:'Studio Renommé UX'});
  }finally{await browser.close();}
});

test('different semantic action still replaces the open menu rather than toggling it closed',async()=>{
  const {page,browser}=await lab();
  try{
    const first=page.locator('#ng8-pins .ng113-native-actions-chat');
    await first.click();
    await expect(page.locator('#ng123-action-menu')).toHaveAttribute('data-id',CHAT);
    await page.evaluate(()=>{
      const row=document.querySelector('#ng8-pins .ng96-chat-entry');
      const second=row.cloneNode(true),a=second.querySelector('a'),b=second.querySelector('button');
      const id='22222222-2222-4222-8222-222222222222';
      a.dataset.chat=id;a.href=`/c/${id}`;a.textContent='Autre conversation';
      b.dataset.ng123Id=id;b.setAttribute('aria-expanded','false');b.removeAttribute('aria-controls');
      row.after(second);
    });
    const second=page.locator('#ng8-pins .ng113-native-actions-chat[data-ng123-id="22222222-2222-4222-8222-222222222222"]');
    await second.click();
    await expect(page.locator('#ng123-action-menu')).toHaveCount(1);
    await expect(page.locator('#ng123-action-menu')).toHaveAttribute('data-id','22222222-2222-4222-8222-222222222222');
  }finally{await browser.close();}
});
