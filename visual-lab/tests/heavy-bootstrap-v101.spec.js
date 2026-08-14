const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function installChromeMock() {
  window.__injectAt = 0;
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    ...(window.chrome.runtime || {}),
    getManifest: () => ({ version: '0.9.11' }),
    sendMessage: async message => {
      if (message?.type === 'niakgpt:inject-runtime-v100') {
        window.__injectAt = performance.now();
        document.body.classList.add('ng8-ready');
        return { ok: true, errors: [] };
      }
      return { ok: true };
    }
  };
  window.chrome.storage = {
    ...(window.chrome.storage || {}),
    local: { get: async () => ({}), set: async () => {} }
  };
}

test('continuous giant-thread mutations do not block NiakGPT bootstrap', async ({ page }) => {
  await page.addInitScript(installChromeMock);
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
    window.chrome = window.chrome || {};
    window.chrome.runtime = { ...(window.chrome.runtime || {}), getManifest: () => ({ version:'0.9.11' }) };
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

test('heavy conversation enters auto-light mode, suspends Matrix, and never impersonates manual Safe Mode', async ({ page }) => {
  const turns = Array.from({ length: 70 }, (_, i) => `<article data-testid="conversation-turn-${i}"><div data-message-author-role="${i % 2 ? 'assistant' : 'user'}">tour ${i}</div></article>`).join('');
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="fr" data-ng90-matrix="normal" data-ng90-safe="0" data-ng86-activity="ready"><body><main>${turns}</main></body></html>`
  }));
  await page.goto('https://chatgpt.com/c/cccccccc-cccc-4ccc-8ccc-cccccccccccc', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: path.join(root, 'performance-guard-v101.js') });

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ng8Heavy), { timeout: 2500 }).toBe('1');
  expect(await page.evaluate(() => document.documentElement.dataset.ng101AutoLight)).toBe('1');
  expect(await page.evaluate(() => document.documentElement.dataset.ng90Matrix)).toBe('off');
  expect(await page.evaluate(() => document.documentElement.dataset.ng90Safe)).toBe('0');

  await page.evaluate(() => {
    document.querySelector('main').replaceChildren(document.createElement('p'));
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ng8Heavy), { timeout: 2500 }).toBe('0');
  expect(await page.evaluate(() => document.documentElement.dataset.ng90Matrix)).toBe('normal');
  expect(await page.evaluate(() => document.documentElement.dataset.ng90Safe)).toBe('0');
});
