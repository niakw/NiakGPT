const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'visual-stability-v101.css'), 'utf8');
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

test('long-thread surface stays fixed and conversation turns keep flat TOI/CHATGPT styling', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.setContent(`<!doctype html><html lang="fr"><body class="ng8-ready">
    <main>
      <article data-testid="conversation-turn-1" data-ng8-turn="0" data-ng8-role="user"><div data-message-author-role="user"><div class="bg-token-message-surface rounded-3xl" style="background:rgb(80,20,80);border:4px solid red">Question utilisateur</div></div></article>
      <article data-testid="conversation-turn-2" data-ng8-turn="1" data-ng8-role="assistant"><div data-message-author-role="assistant"><section class="rounded-2xl border-2" style="border:4px solid red">Réponse ChatGPT</section><figure class="rounded-xl" id="borderless">Bloc sans bordure</figure></div></article>
      <div style="height:6000px"></div>
    </main>
    <form id="composer" style="border:3px solid red;border-radius:30px"><div class="rounded-3xl" style="border:2px solid red"><textarea id="prompt-textarea"></textarea></div></form>
  </body></html>`);
  await page.addStyleTag({ content: `body.ng8-ready main::before{content:"legacy";position:absolute;inset:0;background:red}body.ng8-ready main{box-shadow:inset 0 0 0 4px red}` });
  await page.addStyleTag({ content: css });

  const user = page.locator('[data-ng8-role="user"]');
  const assistant = page.locator('[data-ng8-role="assistant"]');
  await expect(user).toBeVisible();
  await expect(assistant).toBeVisible();

  const userBefore = await user.evaluate(el => getComputedStyle(el, '::before').content);
  const assistantBefore = await assistant.evaluate(el => getComputedStyle(el, '::before').content);
  expect(userBefore).toBe('"TOI"');
  expect(assistantBefore).toBe('"CHATGPT"');

  expect(await user.evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
  expect(await page.locator('.bg-token-message-surface').evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
  expect(await page.locator('.bg-token-message-surface').evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  const bordered = page.locator('section.rounded-2xl');
  expect(await bordered.evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
  expect(await bordered.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
  expect(await page.locator('#borderless').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
  expect(await page.locator('main').evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  expect(await page.locator('main').evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
  expect(await user.evaluate(el => getComputedStyle(el).contentVisibility)).toBe('auto');
  expect(await page.locator('#composer').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
  expect(await page.locator('#composer').evaluate(el => getComputedStyle(el).borderRadius)).toBe('5px');
  expect(await page.locator('#composer > .rounded-3xl').evaluate(el => getComputedStyle(el).borderRadius)).toBe('5px');

  const before = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return { position: style.position, top: style.top, transform: style.transform, backgroundImage: style.backgroundImage };
  });
  await page.evaluate(() => scrollTo(0, 5200));
  const after = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return { position: style.position, top: style.top, transform: style.transform, backgroundImage: style.backgroundImage };
  });
  expect(before.position).toBe('fixed');
  expect(after.position).toBe('fixed');
  expect(before.top).toBe('0px');
  expect(after.top).toBe('0px');
  expect(before.backgroundImage).toContain('radial-gradient');
  expect(after.backgroundImage).toBe(before.backgroundImage);

  await page.screenshot({ path: path.join(artifacts, 'visual-stability-long-thread.png'), fullPage: false });
});

test('image viewer gets top z-index, hides NiakGPT overlays and always exposes a close button', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.setContent(`<!doctype html><html lang="fr"><body class="ng8-ready">
    <section id="ng8-pins" style="position:fixed;z-index:9999999">PROJECTS</section>
    <main><button id="thumb"><img alt="aperçu" width="420" height="280" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='280'%3E%3Crect width='420' height='280' fill='black'/%3E%3C/svg%3E"></button></main>
  </body></html>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ path: path.join(root, 'visual-stability-v101.js') });
  await page.evaluate(() => {
    document.getElementById('thumb').addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.id = 'native-viewer';
      overlay.setAttribute('role', 'dialog');
      overlay.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:black;z-index:10';
      overlay.innerHTML = `<img width="900" height="600" alt="zoom" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='600'%3E%3Crect width='900' height='600' fill='black'/%3E%3C/svg%3E">`;
      document.body.appendChild(overlay);
      const close = event => { if (event.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', close); } };
      document.addEventListener('keydown', close);
    });
  });

  await page.locator('#thumb').click();
  await expect(page.locator('#ng101-image-close')).toBeVisible();
  await expect(page.locator('#native-viewer')).toHaveClass(/ng101-image-viewer-host/);
  expect(await page.locator('#native-viewer').evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(2_000_000_000);
  expect(await page.locator('#ng8-pins').evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');

  await page.locator('#ng101-image-close').click();
  await expect(page.locator('#native-viewer')).toHaveCount(0);
  await expect(page.locator('#ng101-image-close')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-ng101-image-viewer'))).toBe(false);
});

test('Matrix canvas is rehomed to body so long main scrolling cannot own its compositor layer', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="fr"><body class="ng8-ready"><main><canvas id="ng8-matrix"></canvas><div style="height:9000px"></div></main></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ path: path.join(root, 'visual-stability-v101.js') });
  await expect.poll(() => page.evaluate(() => document.getElementById('ng8-matrix')?.parentElement?.tagName)).toBe('BODY');
  expect(await page.locator('#ng8-matrix').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
});
