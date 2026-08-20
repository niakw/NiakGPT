const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const placement=fs.readFileSync(path.join(ROOT,'sidebar-route-placement-v125.js'),'utf8');

function html(){return `<!doctype html><html><body style="margin:0">
<aside data-testid="conversation-sidebar" style="position:fixed;left:0;top:0;width:310px;height:900px;overflow:auto">
  <div class="brand" style="height:52px">ChatGPT</div>
  <nav id="nav">
    <div id="primary"><a href="/">Nouveau chat</a><a href="/search">Recherche</a><a href="/library">Bibliothèque</a><a href="/projects">Projects</a><a href="/tasks">Planification</a><a href="/plugins">Plugins</a></div>
    <section id="ng8-pins"><div class="ng8-pin-head">PROJECTS</div><div class="ng8-pin-list"><a data-ng8-pin="1" href="/g/g-p-aaaaaaaaaaaaaaaa/project">Studio</a></div></section>
    <section id="recents"><h3>Récents</h3><a href="/c/11111111-1111-4111-8111-111111111111">Conversation</a></section>
  </nav>
</aside><main style="margin-left:330px">Page native</main>
</body></html>`;}

test('Projects block stays after native primary menu and before Recents across routes/remounts',async({page})=>{
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html()}));
  await page.goto('https://chatgpt.com/library');
  await page.evaluate(()=>{window.__reconciles=[];document.addEventListener('niakgpt:sidebar-projects-reconcile',e=>window.__reconciles.push(e.detail?.source||''));});
  await page.addScriptTag({content:placement});

  const order=()=>page.evaluate(()=>[...document.querySelector('#nav').children].map(x=>x.id));
  await expect.poll(order).toEqual(['primary','ng8-pins','recents']);
  await expect.poll(()=>page.evaluate(()=>document.getElementById('ng8-pins').dataset.ng125RoutePlacement)).toBe('before-recents');

  for(const route of ['/','/library','/projects','/tasks','/plugins']){
    await page.evaluate(route=>{history.pushState({},'',route);window.dispatchEvent(new PopStateEvent('popstate'));},route);
    await expect.poll(order).toEqual(['primary','ng8-pins','recents']);
  }

  await page.evaluate(()=>{
    const old=document.getElementById('recents');old.remove();
    const next=document.createElement('section');next.id='recents';next.innerHTML='<h3>Récents</h3><a href="/c/22222222-2222-4222-8222-222222222222">Après remount</a>';document.getElementById('nav').appendChild(next);
  });
  await expect.poll(order).toEqual(['primary','ng8-pins','recents']);
  expect(await page.evaluate(()=>window.__reconciles.some(x=>String(x).includes('route-placement-v125')))).toBe(true);
  expect(await page.evaluate(()=>document.getElementById('ng8-pins').getBoundingClientRect().top)).toBeGreaterThanOrEqual(await page.evaluate(()=>document.querySelector('.brand').getBoundingClientRect().bottom));
});

test('when native Project section exists the managed block occupies that exact slot',async({page})=>{
  const body=html().replace('<section id="recents">','<section id="native-projects"><h3>Projects</h3><a href="/g/g-p-bbbbbbbbbbbbbbbb/project">Research</a></section><section id="recents">');
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body}));
  await page.goto('https://chatgpt.com/projects');await page.addScriptTag({content:placement});
  await expect.poll(()=>page.evaluate(()=>[...document.querySelector('#nav').children].map(x=>x.id))).toEqual(['primary','ng8-pins','native-projects','recents']);
  await expect.poll(()=>page.evaluate(()=>document.getElementById('ng8-pins').dataset.ng125RoutePlacement)).toBe('native-projects');
});