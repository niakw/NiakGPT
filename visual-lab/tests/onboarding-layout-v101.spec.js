const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'onboarding-v100.css'), 'utf8');
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

function markup() {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body style="margin:0;background:#111">
    <div id="ng100-onboarding" role="dialog" aria-modal="true">
      <div class="ng100-onboard-card">
        <div class="ng100-onboard-progress"><i class="on"></i><i></i><i></i><i></i></div>
        <main>
          <div class="ng100-onboard-hero"><i>⌘</i><div><small>WELCOME TO</small><b>NiakGPT</b><span>ChatGPT, mais pensé comme un vrai workspace power-user.</span></div></div>
          <div class="ng100-onboard-points">
            <div><b>⚡ Event-driven</b><span>Moins de scans, un seul WORKER entre onglets et cache chaud.</span></div>
            <div><b>▤ Projects gouvernés</b><span>Le manuel gagne toujours sur l’automatisation.</span></div>
            <div><b>◉ États visibles</b><span>Chargement, attente, analyse, exécution et erreur directement dans la sidebar.</span></div>
          </div>
        </main>
        <footer><button>Passer</button><em>1 / 4</em><button class="primary">Continuer</button></footer>
      </div>
    </div>
  </body></html>`;
}

for (const viewport of [{ width: 1365, height: 620 }, { width: 1024, height: 540 }]) {
  test(`onboarding stays fully reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(markup());
    await page.addStyleTag({ content: css });

    const card = page.locator('.ng100-onboard-card');
    const main = page.locator('.ng100-onboard-card > main');
    const heroSentence = page.locator('.ng100-onboard-hero span');
    const footer = page.locator('.ng100-onboard-card > footer');
    await expect(card).toBeVisible();
    await expect(heroSentence).toBeVisible();
    await expect(footer).toBeVisible();

    const cardBox = await card.boundingBox();
    const heroBox = await heroSentence.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(cardBox.y).toBeGreaterThanOrEqual(-0.5);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height + 0.5);
    expect(heroBox.y).toBeGreaterThanOrEqual(cardBox.y + 4);
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height + 0.5);

    const dims = await main.evaluate(el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop }));
    expect(dims.clientHeight).toBeGreaterThan(0);
    expect(dims.scrollTop).toBe(0);

    await page.screenshot({ path: path.join(artifacts, `onboarding-${viewport.width}x${viewport.height}.png`) });
  });
}
