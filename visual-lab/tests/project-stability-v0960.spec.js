const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

function runtime(name) {
  return fs.readFileSync(path.join(root, name), 'utf8')
    .replace("location.hostname!=='chatgpt.com'||", 'false||')
    .replace("location.hostname !== 'chatgpt.com' ||", 'false ||');
}
function projectRuntime() {
  return runtime('project-folders-v110.js').replace(
    "const currentCid=()=>cidFromHref(location.pathname);",
    "const currentCid=()=>window.__testCurrentCid||cidFromHref(location.pathname);"
  );
}
async function installStorageMock(page, store) {
  await page.addScriptTag({ content: `(() => {
    window.__store=${JSON.stringify(store)}; window.__listeners=[]; window.__rpc=[];
    const emit=changes=>window.__listeners.forEach(fn=>fn(changes,'local'));
    window.chrome={runtime:{id:'lab'},storage:{local:{get:async keys=>Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,window.__store[k]])):{[keys]:window.__store[keys]},set:async obj=>{const changes={};for(const [k,v] of Object.entries(obj)){changes[k]={oldValue:window.__store[k],newValue:v};window.__store[k]=v;}emit(changes);}},onChanged:{addListener:fn=>window.__listeners.push(fn)}}};
    window.__NIAKGPT_CACHE_BUS__={get:async()=>window.__store['niakgpt-v08-cache'],subscribe(fn){window.__cacheSub=fn;queueMicrotask(()=>fn(window.__store['niakgpt-v08-cache']));return()=>{};},async update(fn){const old=window.__store['niakgpt-v08-cache'],next=await fn(old);if(next!==old){window.__store['niakgpt-v08-cache']=next;emit({'niakgpt-v08-cache':{oldValue:old,newValue:next}});window.__cacheSub?.(next);}return window.__store['niakgpt-v08-cache'];}};
    document.addEventListener('niakgpt:rpc-request',e=>{window.__rpc.push(e.detail);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:e.detail.id,ok:true,status:200,data:e.detail.body||{}}})));});
    window.__setStore=(k,v)=>{const old=window.__store[k];window.__store[k]=v;emit({[k]:{oldValue:old,newValue:v}});if(k==='niakgpt-v08-cache')window.__cacheSub?.(v);};
  })()` });
}

test('0.9.60 native Projects authority survives full sidebar-root rerender', async ({ page }) => {
  await page.setContent(`<style>body{background:#071019;color:#dce7f1}nav{width:310px}</style><nav data-testid="conversation-sidebar"><div id="native" class="group/sidebar-expando-section"><button><span>Projets</span></button><div class="group/project-unfurl-row"><div role="button">NiakGPT</div></div></div><div id="gpts"><h2>GPTs</h2></div><section id="ng8-pins"><b>PROJECTS NIAKGPT</b></section></nav>`);
  await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'sidebar-projects-authority-v109.css'), 'utf8') });
  await page.addScriptTag({ content: runtime('sidebar-projects-authority-v110.js') });
  await expect.poll(() => page.locator('#native').evaluate(e => getComputedStyle(e).display)).toBe('none');

  await page.evaluate(() => {
    document.querySelector('nav').outerHTML = `<nav data-testid="conversation-sidebar"><section id="native2" class="group/foo/sidebar-expando-section"><button>Projects</button><div class="group/project-unfurl-row"><div role="button">Films</div></div></section><div id="gpts2"><h2>GPTs</h2></div><section id="ng8-pins"><b>PROJECTS NIAKGPT</b></section></nav>`;
  });
  await expect.poll(() => page.locator('#native2').evaluate(e => getComputedStyle(e).display)).toBe('none');
  await expect(page.locator('#gpts2')).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, '0960-visual-authority-root-rerender.png'), fullPage: true });

  await page.locator('#ng8-pins').evaluate(e => e.remove());
  await expect.poll(() => page.locator('#native2').evaluate(e => getComputedStyle(e).display)).not.toBe('none');
});

test('0.9.60 Project chat rows stay stable, clickable, focused and OUT-aware', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 650 });
  await page.setContent(`<style>body{background:#071019;color:#dce7f1;font-family:system-ui}#ng8-pins{width:340px}#ng8-pins>a{display:grid;grid-template-columns:24px 1fr 50px}</style><a id="native-chat" href="/g/g-p-x/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">native route</a><div id="ng8-pins"><a data-ng8-pin="1" href="/g/g-p-x/project"><span>◆</span><span>NiakGPT</span><small>3</small></a></div>`);
  const cache={projects:[{id:'g-p-x',name:'NiakGPT'}],chats:[],projectChats:{'g-p-x':[
    {id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Titre actif extrêmement long qui doit rester tronqué sans faire bouger la date',projectId:'g-p-x',updated:1786900000000},
    {id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',title:'Deuxième conversation',projectId:'g-p-x',updated:1786800000000},
    {id:'cccccccc-cccc-cccc-cccc-cccccccccccc',title:'Conversation limite',projectId:'g-p-x',updated:1786700000000}
  ]}};
  await installStorageMock(page, {'niakgpt-v08-cache':cache,'niakgpt-continuity-v100':{out:{}}});
  await page.evaluate(() => { window.__testCurrentCid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; });
  await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'pin-folders-v096.css'), 'utf8') + fs.readFileSync(path.join(root, 'project-chat-ux-v109.css'), 'utf8') });
  await page.addScriptTag({ content: projectRuntime() });
  await page.locator('#ng8-pins a[data-ng8-pin="1"]').click();
  await expect(page.locator('.ng109-chat-row')).toHaveCount(3);
  await expect(page.locator('.ng109-chat-row[data-ng109-active="1"]')).toHaveAttribute('data-chat-row','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  const initial = await page.evaluate(() => {
    const row=document.querySelector('.ng109-chat-row'), title=row.querySelector('.ng96-chat-title'), time=row.querySelector('time');
    window.__stableRow=row; window.__timeX=time.getBoundingClientRect().x;
    return {titleRight:title.getBoundingClientRect().right,timeLeft:time.getBoundingClientRect().left};
  });
  expect(initial.titleRight).toBeLessThanOrEqual(initial.timeLeft+1);

  await page.evaluate(() => {
    const r=window.__store['niakgpt-v08-cache']; window.__setStore('niakgpt-v08-cache',{...r,at:Date.now()});
    for(let i=0;i<25;i++){const x=document.createElement('i');document.querySelector('.ng96-pin-drawer').appendChild(x);x.remove();}
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.querySelector('.ng109-chat-row')===window.__stableRow)).toBe(true);
  expect(Math.abs(await page.evaluate(() => document.querySelector('.ng109-chat-row time').getBoundingClientRect().x-window.__timeX))).toBeLessThan(1);

  await page.evaluate(() => { window.__testCurrentCid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.ng109-chat-row[data-ng109-active="1"]')).toHaveAttribute('data-chat-row','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  expect(await page.evaluate(() => document.querySelector('.ng109-chat-row')===window.__stableRow)).toBe(true);

  await page.evaluate(() => window.__setStore('niakgpt-continuity-v100',{out:{'cccccccc-cccc-cccc-cccc-cccccccccccc':{out:true,title:'Conversation limite',updatedAt:1787000000000,reason:'limit-detected'}}}));
  await expect(page.locator('.ng109-chat-row[data-ng109-out="1"] .ng109-out-badge')).toHaveCount(1);
  await expect(page.locator('.ng109-chat-row').last()).toHaveAttribute('data-chat-row','cccccccc-cccc-cccc-cccc-cccccccccccc');

  await page.evaluate(() => { window.__nativeClicks=0; document.getElementById('native-chat').addEventListener('click',e=>{e.preventDefault();window.__nativeClicks++;}); });
  await page.locator('a[data-chat="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]').click();
  await expect.poll(() => page.evaluate(() => window.__nativeClicks)).toBe(1);
  await page.screenshot({ path: path.join(artifacts, '0960-visual-project-folders-stable.png'), fullPage: true });
});
