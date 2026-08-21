const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const runtime=fs.readFileSync(path.join(ROOT,'sidebar-truth-v127.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'sidebar-truth-v127.css'),'utf8');
const P=['g-p-aaaaaaaaaaaaaaaa','g-p-bbbbbbbbbbbbbbbb','g-p-cccccccccccccccc','g-p-dddddddddddddddd'];

const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name}}}});
function html(){return `<!doctype html><html><body class="ng8-ready" style="margin:0">
<aside data-testid="conversation-sidebar" style="width:307px;height:900px">
<nav id="native-nav">
  <a id="library" href="/library" style="border:1px solid rgb(79,193,255);box-shadow:inset 0 -1px rgb(79,193,255)">Bibliothèque</a>
  <a href="/tasks">Planification</a><a href="/plugins">Plugins</a><button>Plus</button>
  <section id="native-projects"><h3>Projects</h3>
    ${P.map((id,i)=>`<div data-sidebar-item="true" class="native-project"><a href="/g/${id}/project">${['Films','NiakVIO','NiakGPT','Elias'][i]}</a><button aria-label="Plus d’options">...</button></div>`).join('')}
  </section>
  <section id="ng8-pins" data-ng121-placement-ready="1"><div class="ng8-pin-head">PROJECTS <b>1</b></div><div class="ng8-pin-list"><a data-ng8-pin="1" data-ng121-pid="${P[0]}" href="/g/${P[0]}/project">Films</a></div></section>
  <section><h3>Chats</h3><a href="/c/11111111-1111-4111-8111-111111111111">New chat</a></section>
</nav></aside><main>Conversation</main></body></html>`;}

async function installMocks(page,items){
  await page.evaluate(({items})=>{
    const key='niakgpt-v08-cache';
    const store={[key]:{schema:2,projects:[{id:items[0].gizmo.gizmo.id,name:items[0].gizmo.gizmo.display.name,domOnly:false}],projectInventoryAt:Date.now(),projectInventoryCount:1}};
    const listeners=[];
    window.chrome={storage:{local:{get:async k=>typeof k==='string'?{[k]:store[k]}:{...store},set:async obj=>{for(const [k,v] of Object.entries(obj)){const oldValue=store[k];store[k]=v;for(const fn of listeners)fn({[k]:{oldValue,newValue:v}},'local');}},remove:async k=>{delete store[k];}},onChanged:{addListener:fn=>listeners.push(fn)}}};
    window.__truthStore=store;
    document.addEventListener('niakgpt:rpc-request',event=>{
      const d=event.detail||{};if(!String(d.path||'').startsWith('/backend-api/gizmos/snorlax/sidebar'))return;
      queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{items,total:items.length,cursor:null}}})));
    });
  },{items});
}

test('0.9.73 never replaces a larger native Project inventory with one cached pin',async({page})=>{
  const items=[projectRaw(P[0],'Films'),projectRaw(P[1],'NiakVIO'),projectRaw(P[2],'NiakGPT'),projectRaw(P[3],'Elias')];
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html()}));
  await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111');
  await installMocks(page,items);await page.addStyleTag({content:css});await page.addScriptTag({content:runtime});

  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng127InventoryReady||'')).toBe('');
  await expect(page.locator('#ng8-pins')).toBeHidden();
  await expect(page.locator('#native-projects [data-sidebar-item="true"]')).toHaveCount(4);
  expect(await page.locator('#native-projects [data-ng112-native-projects="1"]').count()).toBe(0);

  await expect.poll(()=>page.evaluate(()=>window.__truthStore['niakgpt-v08-cache'].projectInventoryCount)).toBe(4);
  await expect.poll(()=>page.evaluate(()=>window.__truthStore['niakgpt-v08-cache'].projectInventoryVerified)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__truthStore['niakgpt-v08-cache'].projects.filter(p=>String(p.id).startsWith('g-p-')).length)).toBe(4);

  await page.evaluate(P=>{
    const list=document.querySelector('#ng8-pins .ng8-pin-list');
    for(const id of P.slice(1)){const a=document.createElement('a');a.dataset.ng8Pin='1';a.dataset.ng121Pid=id;a.href=`/g/${id}/project`;a.textContent=id;list.appendChild(a);}
    document.dispatchEvent(new CustomEvent('niakgpt:pins-rendered'));
  },P);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng127InventoryReady||'')).toBe('1');
  await expect(page.locator('#ng8-pins')).toBeVisible();
  await expect.poll(()=>page.locator('#native-projects [data-ng112-native-projects="1"]').count()).toBeGreaterThan(0);
});

test('0.9.73 neutralises NiakGPT border/shadow leakage on native sidebar controls',async({page})=>{
  await page.setContent(html());await page.addStyleTag({content:css});
  const style=await page.locator('#library').evaluate(el=>{const s=getComputedStyle(el);return{border:s.borderTopColor,shadow:s.boxShadow};});
  expect(style.border).toBe('rgba(0, 0, 0, 0)');
  expect(style.shadow).toBe('none');
});

test('0.9.73 cannot self-certify a one-Project inventory on its first scan',async({page})=>{
  const one=[projectRaw(P[0],'Films')];
  const oneHtml=html().replace(P.slice(1).map(id=>new RegExp(`<div data-sidebar-item="true" class="native-project"><a href="/g/${id}/project">[^<]+</a><button aria-label="Plus d’options">\\.\\.\\.</button></div>`)).reduce((s,rx)=>s.replace(rx,''),html());
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:oneHtml}));
  await page.goto('https://chatgpt.com/');await installMocks(page,one);await page.addStyleTag({content:css});await page.addScriptTag({content:runtime});
  await page.waitForTimeout(350);
  expect(await page.evaluate(()=>window.__truthStore['niakgpt-v08-cache'].projectInventoryVerified===true)).toBe(false);
  await expect(page.locator('#ng8-pins')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__truthStore['niakgpt-v08-cache'].projectInventoryVerified===true),{timeout:2500}).toBe(true);
});
