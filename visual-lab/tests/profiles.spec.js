const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = path.join(__dirname,'..','artifacts');
fs.mkdirSync(artifacts,{recursive:true});

async function base(page,profile){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./?state=ready');
  await page.addStyleTag({url:'../profiles-v100.css'});
  await page.evaluate(p=>{
    document.documentElement.dataset.ng100Profile=p;
    document.querySelectorAll('pre').forEach(x=>x.dataset.ng8Code='1');
  },profile);
}

test('Code / IDE profile materially strengthens technical surfaces',async({page})=>{
  await base(page,'code');
  const pre=page.locator('pre[data-ng8-code="1"]').first();
  await expect(pre).toBeVisible();
  const shadow=await pre.evaluate(el=>getComputedStyle(el).boxShadow);
  expect(shadow).toContain('rgb');
  const meta=page.locator('.ng8-chat-date').first();
  const family=await meta.evaluate(el=>getComputedStyle(el).fontFamily.toLowerCase());
  expect(family).toContain('consolas');
  await page.screenshot({path:path.join(artifacts,'profile-code-ide.png')});
});

test('Research profile quiets Matrix and increases reading rhythm',async({page})=>{
  await base(page,'research');
  const opacity=Number(await page.locator('#ng8-matrix').evaluate(el=>getComputedStyle(el).opacity));
  expect(opacity).toBeLessThanOrEqual(.09);
  const lineHeight=await page.locator('[data-ng8-role="assistant"]').first().evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
  const fontSize=await page.locator('[data-ng8-role="assistant"]').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(lineHeight/fontSize).toBeGreaterThanOrEqual(1.55);
  await page.screenshot({path:path.join(artifacts,'profile-research.png')});
});

test('High Contrast profile removes Matrix and reinforces readable surfaces',async({page})=>{
  await base(page,'contrast');
  await expect(page.locator('#ng8-matrix')).toBeHidden();
  const text=await page.locator('[data-ng8-role="assistant"]').first().evaluate(el=>getComputedStyle(el).color);
  expect(text).toBe('rgb(255, 255, 255)');
  const border=await page.locator('a[data-ng8-chat="1"]').first().evaluate(el=>getComputedStyle(el).borderTopColor);
  expect(border).not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({path:path.join(artifacts,'profile-high-contrast.png')});
});

test('Command Palette remains dense, readable and keyboard-oriented',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./?state=ready');
  await page.addStyleTag({url:'../commands-v100.css'});
  await page.evaluate(()=>{
    const modal=document.createElement('div');modal.id='ng100-command';modal.className='open';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML=`<div><header><span>⌘</span><input value="profile" aria-label="Rechercher une commande"><kbd>Ctrl ⇧ P</kbd></header><section><button class="sel"><i>&lt;/&gt;</i><span>Profil : Code / IDE</span><small>Workspace</small></button><button><i>▧</i><span>Profil : Research</span><small>Workspace</small></button><button><i>◐</i><span>Profil : High Contrast</span><small>Accessibilité</small></button><button><i>◈</i><span>Basculer Safe Mode</span><small>Performance</small></button></section><footer><span>↑↓ naviguer</span><span>Entrée exécuter</span><span>Échap fermer</span></footer></div>`;document.body.appendChild(modal);
  });
  const modal=page.locator('#ng100-command');
  await expect(modal).toBeVisible();
  const box=await modal.locator(':scope > div').boundingBox();
  expect(box.width).toBeLessThanOrEqual(720.5);
  expect(box.height).toBeLessThan(500);
  await page.screenshot({path:path.join(artifacts,'command-palette.png')});
});
