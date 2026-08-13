const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const fixture = fs.readFileSync(path.join(__dirname, '..', 'runtime-fixture.html'), 'utf8');

test('synthetic ChatGPT fixture reaches DOMContentLoaded without the extension', async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext();
  try {
    await context.route('https://chatgpt.com/**', async route => {
      const request = route.request();
      if (request.resourceType() === 'document') {
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture });
      }
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
