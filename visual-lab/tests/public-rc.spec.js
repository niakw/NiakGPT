const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = path.join(__dirname,'..','artifacts');
fs.mkdirSync(artifacts,{recursive:true});

async function noOverflow(page){
  const d=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(d.sw).toBeLessThanOrEqual(d.cw+2);
}

test('Public RC Control Center fits desktop and exposes safe controls',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./rc.html?scene=control');
  const modal=page.locator('#ng90-control');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('role','dialog');
  await expect(modal).toHaveAttribute('aria-modal','true');
  const card=await page.locator('.ng90-card').boundingBox();
  expect(card).not.toBeNull();
  expect(card.width).toBeLessThan(1380);
  expect(card.height).toBeLessThanOrEqual(828);
  await expect(page.getByText('SAFE MODE')).toBeVisible();
  await expect(page.getByText('PERFORMANCE & CACHE')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:path.join(artifacts,'public-rc-control-center.png')});
});

test('Public RC Control Center remains usable on laptop',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto('./rc.html?scene=control');
  await expect(page.locator('#ng90-control')).toBeVisible();
  await expect(page.locator('.ng90-card')).toBeVisible();
  await noOverflow(page);
  const close=await page.locator('#ng90-control [data-close]').boundingBox();
  expect(close).not.toBeNull();
  expect(close.x+close.width).toBeLessThanOrEqual(1024);
  await page.screenshot({path:path.join(artifacts,'public-rc-control-laptop.png')});
});

test('Safe Mode visually removes non-essential work surfaces',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./rc.html?scene=safe');
  await expect(page.locator('#ng8-matrix')).toBeHidden();
  await expect(page.locator('#ng8-coach')).toBeHidden();
  await expect(page.locator('.ng90-safe-badge')).toHaveText('SAFE');
  await expect(page.locator('.lab-composer')).toBeVisible();
  await expect(page.locator('#ng8-status')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:path.join(artifacts,'public-rc-safe-mode.png')});
});
