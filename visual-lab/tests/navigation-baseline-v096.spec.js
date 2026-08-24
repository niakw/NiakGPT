const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', '..');
const fixture = fs.readFileSync(path.join(__dirname, '..', 'runtime-fixture.html'), 'utf8');
const homeFixture = fs.readFileSync(path.join(__dirname, '..', 'real-home-fixture.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

test('synthetic ChatGPT fixture reaches DOMContentLoaded without the extension', async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext();
  try {
    await context.route('https://chatgpt.com/**', async route => {
      const request = route.request();
      if (request.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture });
      return route.fulfill({ status: 204, body: '' });
    });
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await expect(page.locator('[data-testid="conversation-sidebar"]')).toBeVisible();
    expect(await page.evaluate(() => document.readyState)).not.toBe('loading');
  } finally {
    await context.close();
    await browser.close();
  }
});

test('current ChatGPT home mounts the complete quiet shell without reserving host layout space', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niakgpt-home-smoke-'));
  const context = await chromium.launchPersistentContext(dir, {
    headless: true,
    channel: 'chromium',
    viewport: { width: 1710, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
    await worker.evaluate(async version => chrome.storage.local.set({ 'niakgpt-onboarding-v100': { status: 'done', version, at: Date.now() } }), manifest.version);
    await context.route('https://chatgpt.com/**', async route => {
      if (route.request().resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: homeFixture });
      return route.fulfill({ status: 204, body: '' });
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await expect(page.locator('#native-home')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/ng8-ready/, { timeout: 8000 });
    await expect(page.locator('#ng8-rail')).toBeVisible();
    await expect(page.locator('#ng8-status')).toBeVisible();
    await expect(page.locator('#ng8-status')).toContainText(manifest.version);
    await expect(page.locator('#ng8-pins')).toBeVisible();
    await expect(page.locator('#ng8-pins')).toContainText('Miorra');
    await expect(page.locator('#ng8-pins')).toContainText('Niakvio');
    await expect(page.locator('#recent-project-chat')).toHaveAttribute('data-ng8-chat', '1');
    await expect(page.locator('#ng8-matrix')).toBeVisible();
    await expect(page.locator('.ng8-bot')).toHaveCount(3);
    const geometry = await page.evaluate(() => {
      const rail = document.getElementById('ng8-rail').getBoundingClientRect();
      const status = document.getElementById('ng8-status').getBoundingClientRect();
      const composer = document.getElementById('home-composer').getBoundingClientRect();
      const railStyle=getComputedStyle(document.getElementById('ng8-rail'));
      return { rail, status, composer, railOpacity:Number(railStyle.opacity), railPointerEvents:railStyle.pointerEvents, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
    });
    expect(geometry.rail.left).toBeGreaterThan(geometry.composer.right);
    // v131 deliberately tucks the idle/home rail beyond the viewport edge instead of reserving
    // permanent right-side chrome. Its transform must not create horizontal document overflow.
    expect(geometry.rail.left).toBeGreaterThanOrEqual(geometry.width - 12);
    expect(geometry.rail.left).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.rail.right).toBeGreaterThan(geometry.width);
    expect(geometry.railOpacity).toBeLessThanOrEqual(0.01);
    expect(geometry.railPointerEvents).toBe('none');
    expect(geometry.status.bottom).toBeLessThanOrEqual(geometry.height + 0.5);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 2);
    await page.screenshot({ path: path.join(artifacts, 'real-chatgpt-home-bootstrap.png'), fullPage: true });
  } finally {
    await context.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
