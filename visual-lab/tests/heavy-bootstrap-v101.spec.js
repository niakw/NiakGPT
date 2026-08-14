const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('continuous giant-thread mutations do not block NiakGPT bootstrap', async ({ page }) => {
  await page.addInitScript(() => {
    window.__injectAt = 0;
    window.chrome = {
      runtime: {
        getManifest: () => ({ version: '0.9.11' }),
        sendMessage: async message => {
          if (message?.type === 'niakgpt:inject-runtime-v100') {
            window.__injectAt = performance.now();
            document.body.classList.add('ng8-ready');
            return { ok: true, errors: [] };
          }
          return { ok: true };
        }
      },
      storage: { local: { get: async () => ({}), set: async () => {} } }
    };
  });
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="fr"><body><nav></nav><main><div id="stream"></div></main><textarea id="prompt-textarea"></textarea></body></html>'
  }));
  await page.goto('https://chatgpt.com/c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { waitUntil: 'load' });
  await page.evaluate(() => {
    const stream = document.getElementById('stream');
    window.__mutationTimer = setInterval(() => {
      const node = document.createElement('span'); node.textContent = String(performance.now()); stream.appendChild(node);
      if (stream.childElementCount > 200) stream.firstElementChild?.remove();
    }, 20);
  });
  const started = await page.evaluate(() => performance.now());
  await page.addScriptTag({ path: path.join(root, 'boot-gate-v100.js') });
  await expect.poll(() => page.evaluate(() => window.__injectAt), { timeout: 5000 }).toBeGreaterThan(0);
  const elapsed = await page.evaluate(start => window.__injectAt - start, started);
  expect(elapsed).toBeLessThan(3800);
  await page.evaluate(() => clearInterval(window.__mutationTimer));
});

test('activity tracker keeps deep main observer disabled during navigation loading', async ({ page }) => {
  await page.addInitScript(() => {
    window.__mainObserverStarts = 0;
    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeMutationObserver {
      observe(target, options) {
        if (target?.tagName === 'MAIN' && options?.subtree && options?.characterData) window.__mainObserverStarts += 1;
        return super.observe(target, options);
      }
    };
    window.BroadcastChannel = class { addEventListener(){} postMessage(){} close(){} };
    window.chrome = { runtime: { getManifest: () => ({ version:'0.9.11' }) } };
  });
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="fr"><body><nav></nav><main><article data-message-author-role="assistant">ancien message</article></main><textarea id="prompt-textarea"></textarea><div id="ng8-status"></div></body></html>'
  }));
  await page.goto('https://chatgpt.com/c/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: path.join(root, 'activity-ui-v097.js') });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.documentElement.dataset.ng86Activity)).toBe('loading');
  expect(await page.evaluate(() => window.__mainObserverStarts)).toBe(0);
});
