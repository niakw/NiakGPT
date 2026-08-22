const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const ACTIONS=fs.readFileSync(path.join(ROOT,'sidebar-actions-v123.js'),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';

async function lab(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:760}});
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>body{margin:0}aside{width:300px;height:100vh;background:#111}#ng8-pins{width:280px;padding:10px}.ng96-chat-entry{display:grid;grid-template-columns:1fr 36px}.ng113-native-actions{width:32px;height:32px}#ng123-action-menu{position:fixed;left:320px;top:20px;min-width:240px;background:white;color:black;padding:8px}</style></head><body><aside data-testid="conversation-sidebar"><div id="ng8-pins"><div class="ng96-chat-entry"><a data-chat="${CHAT}" href="/c/${CHAT}"><span>Conversation remount</span></a><button class="ng113-native-actions ng113-native-actions-chat" data-ng123-action="chat" data-ng123-id="${CHAT}" aria-label="Actions de la conversation">•••</button></div></div></aside></body></html>`}));
  await page.goto('https://chatgpt.com/remount-toggle-lab');
  await page.evaluate(()=>{
    const local={async get(){return {'niakgpt-v08-cache':{projects:[],chats:[{id:'11111111-1111-4111-8111-111111111111',title:'Conversation remount'}]}};},async set(){}};
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
