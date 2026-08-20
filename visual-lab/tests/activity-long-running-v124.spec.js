const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const activity=fs.readFileSync(path.join(ROOT,'activity-v086.js'),'utf8');
const CHAT='11111111-1111-4111-8111-111111111111';

test('native long-running analysis stays active beyond 10 minutes without text growth',async({page})=>{
  await page.addInitScript(()=>{
    window.chrome={runtime:{getManifest:()=>({version:'0.9.70'})}};
    window.__NIAKGPT_CACHE_BUS__={subscribe:()=>()=>{}};
  });
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body><aside data-testid="conversation-sidebar"><a href="/c/${CHAT}">Current chat</a></aside><main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">Stable response prefix</div></article><button type="button" data-testid="stop-generating" aria-label="Stop generating">Stop</button><textarea id="prompt-textarea"></textarea></main><div id="ng8-status"><span class="ng8-version">NiakGPT</span></div></body></html>`}));
  await page.goto(`https://chatgpt.com/c/${CHAT}`,{waitUntil:'domcontentloaded'});
  await page.clock.install({time:new Date('2026-08-20T20:00:00Z')});
  await page.addScriptTag({content:activity});
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('niakgpt:activity-network',{detail:{phase:'headers'}})));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng86Activity)).toBe('thinking');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng8Running)).toBe('1');
  const url=page.url();
  await page.clock.fastForward(61_000);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(()=>document.documentElement.dataset.ng86Activity)).toBe('thinking');
  expect(await page.evaluate(()=>document.documentElement.dataset.ng8Running)).toBe('1');
  await page.clock.fastForward(10*60*1000);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(()=>document.documentElement.dataset.ng86Activity)).toBe('thinking');
  expect(await page.evaluate(()=>document.documentElement.dataset.ng8Running)).toBe('1');
  expect(await page.locator('a[href*="/c/"]').getAttribute('data-ng86-activity')).toBe('thinking');
  await page.locator('[data-testid="stop-generating"]').evaluate(el=>el.remove());
  await page.clock.fastForward(5_000);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng86Activity)).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.ng8Running)).toBe('0');
});
