const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const patchGuard = src => src
  .replace("location.hostname !== 'chatgpt.com' ||", 'false ||')
  .replace("location.hostname!=='chatgpt.com'||", 'false||');

function chromeShim(store) {
  return `(()=>{const store=${JSON.stringify(store)};const listeners=[];const norm=keys=>{if(keys==null)return{...store};if(typeof keys==='string')return{[keys]:store[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==='object'){const out={};for(const [k,v] of Object.entries(keys))out[k]=store[k]===undefined?v:store[k];return out;}return{};};window.chrome={runtime:{getManifest:()=>({version:'0.9.52'})},storage:{local:{get:async keys=>norm(keys),set:async obj=>{const changes={};for(const [k,v] of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}for(const fn of [...listeners])fn(changes,'local');},remove:async keys=>{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}},onChanged:{addListener:fn=>listeners.push(fn)}}};window.__niakStore=store;})();`;
}

test('production bootstrap never injects retired hotcache and all runtime files exist', async () => {
  const background = read('background-v100.js');
  const mainBlock = background.match(/const\s+MAIN_RUNTIME\s*=\s*\[(.*?)\];/s)?.[1] || '';
  const mainFiles = [...mainBlock.matchAll(/["']([^"']+\.js)["']/g)].map(m => m[1]);
  expect(mainFiles).toEqual(['page-bridge.js']);
  expect(background).not.toContain("'hotcache-main-v084.js'");
  expect(background).not.toContain("'activity-main-v087.js'");
  expect(background).toContain("'runtime-integrity-v101.js'");

  const isolatedBlock = background.match(/const\s+ISOLATED_RUNTIME\s*=\s*\[(.*?)\];/s)?.[1] || '';
  const isolatedFiles = [...isolatedBlock.matchAll(/["']([^"']+\.js)["']/g)].map(m => m[1]);
  for (const file of [...mainFiles, ...isolatedFiles]) {
    expect(fs.existsSync(path.join(ROOT, file)), `missing runtime file ${file}`).toBeTruthy();
  }

  const manifest = JSON.parse(read('manifest.json'));
  for (const entry of manifest.content_scripts || []) {
    for (const css of entry.css || []) expect(fs.existsSync(path.join(ROOT, css)), `missing manifest CSS ${css}`).toBeTruthy();
  }
  expect(JSON.stringify(manifest)).not.toContain('style.css');
});

test('stale 0-main-project state repairs itself and renders Projects', async ({ page }) => {
  const projects = Array.from({ length: 5 }, (_, i) => ({
    id: `g-p-project${i + 1}`,
    name: `Project ${i + 1}`,
    href: `/legacy/${i + 1}`,
    domOnly: true
  }));
  const chats = Array.from({ length: 8 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    title: `Conversation ${i + 1}`,
    projectId: projects[i % projects.length].id,
    updated: 1786900000000 - i * 1000
  }));
  const counts = Object.fromEntries(projects.map((p, i) => [p.id, chats.filter(c => c.projectId === p.id).length]));
  const store = {
    'niakgpt-v08-cache': { schema: 2, projects, chats, counts, indexedProjectIds: projects.map(p => p.id), serverIndexedAt: 1786900000000 },
    'niakgpt-governance-v085': { seeded: true, coreProjectIds: [], hiddenProjectIds: [], locks: {}, autoResync: false }
  };

  await page.setContent(`<nav data-testid="conversation-sidebar"><a href="/c/${chats[0].id}">Conversation 1</a></nav><header><span>ChatGPT</span></header><main><div id="prompt-textarea" contenteditable="true"></div></main>`);
  await page.addScriptTag({ content: chromeShim(store) });
  await page.evaluate(() => {
    document.documentElement.dataset.ng8TabRole = 'client';
    document.documentElement.dataset.ng86Activity = 'ready';
    document.documentElement.dataset.ng90Matrix = 'off';
    document.documentElement.dataset.ng8Hotcache = 'READY';
    document.documentElement.dataset.ng8HotcacheEntries = '0';
    window.__diag = {};
    window.__NIAKGPT_DIAGNOSTICS__ = { set: (key, value) => { window.__diag[key] = value; } };
  });

  await page.addScriptTag({ content: patchGuard(read('cache-bus-v096.js')) });
  await page.addScriptTag({ content: patchGuard(read('runtime-integrity-v101.js')) });
  await page.waitForTimeout(180);

  const repaired = await page.evaluate(() => ({
    gov: window.__niakStore['niakgpt-governance-v085'],
    cache: window.__niakStore['niakgpt-v08-cache'],
    hot: document.documentElement.dataset.ng8Hotcache || '',
    diag: window.__diag
  }));
  expect(repaired.gov.coreProjectIds).toHaveLength(5);
  expect(new Set(repaired.gov.coreProjectIds)).toEqual(new Set(projects.map(p => p.id)));
  expect(repaired.cache.projects.every(p => p.domOnly === false && p.href === `/g/${p.id}/project`)).toBeTruthy();
  expect(repaired.hot).toBe('');
  expect(repaired.diag.hotcache).toContain('OFF');
  expect(repaired.diag['intégrité']).toContain('5/5');

  await page.addScriptTag({ content: patchGuard(read('app-v090.js')) });
  await expect(page.locator('#ng8-pins')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#ng8-pins [data-ng8-pin="1"]')).toHaveCount(5);
});
