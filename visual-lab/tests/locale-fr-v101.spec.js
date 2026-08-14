const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('French locale adapter translates residual native Project actions without touching conversation content', async ({ page }) => {
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="fr"><body>
      <button id="project-action" aria-label="More options"><svg></svg><span>Add to project</span></button>
      <div role="menu"><button role="menuitem"><span>Move to project</span></button></div>
      <p id="conversation-copy">Add to project est cité ici comme contenu de conversation et ne doit pas être modifié.</p>
    </body></html>`
  }));
  await page.goto('https://chatgpt.com/locale-fixture', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: path.join(root, 'locale-fr-v101.js') });
  await page.locator('#project-action').dispatchEvent('pointerdown');

  await expect(page.locator('#project-action span')).toHaveText('Ajouter au projet');
  await expect(page.locator('#project-action')).toHaveAttribute('aria-label', 'Plus d’options');
  await expect(page.getByRole('menuitem')).toHaveText('Déplacer vers un projet');
  await expect(page.locator('#conversation-copy')).toContainText('Add to project est cité ici');
});
