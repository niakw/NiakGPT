const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function assertNoHorizontalOverflow(page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.clientWidth + 2);
}

async function assertComposerFlow(page, { coachExpected = true } = {}) {
  const composer = page.locator('.lab-composer');
  await expect(composer).toBeVisible();
  const composerBox = await composer.boundingBox();
  expect(composerBox).not.toBeNull();

  const coach = page.locator('#ng8-coach');
  if (!coachExpected) {
    await expect(coach).toBeHidden();
    return;
  }

  await expect(coach).toBeVisible();
  const coachBox = await coach.boundingBox();
  expect(coachBox).not.toBeNull();
  expect(coachBox.y + coachBox.height).toBeLessThanOrEqual(composerBox.y + 2);
}

const states = {
  ready: 'PRÊT',
  loading: 'CHARGEMENT',
  waiting: 'ATTENTE',
  thinking: 'RÉFLEXION / ANALYSE',
  executing: 'EXÉCUTION',
  error: 'ERREUR'
};

for (const [state, label] of Object.entries(states)) {
  test(`desktop activity state: ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`./?state=${state}`);
    await expect(page.locator('.ng86-status-state')).toHaveText(label);
    await assertNoHorizontalOverflow(page);
    await assertComposerFlow(page, { coachExpected: state === 'ready' || state === 'error' });

    const chat = page.locator('#lab-chat-active');
    await expect(chat).toHaveAttribute('data-ng86-activity', state);
    if (state === 'ready') {
      await expect(chat).not.toHaveClass(/ng86-active-chat/);
    } else {
      await expect(chat).toHaveClass(/ng86-active-chat/);
      const border = await chat.evaluate(el => getComputedStyle(el).borderLeftColor);
      expect(border).not.toBe('rgba(0, 0, 0, 0)');
      const project = page.locator('a[href="/g/g-p-1111111111111111/project"]').first();
      await expect(project).toHaveAttribute('data-ng86-activity', state);
    }

    await page.screenshot({ path: path.join(artifacts, `desktop-${state}.png`) });
  });
}

test('laptop layout keeps composer and status usable', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('./?state=thinking');
  await assertNoHorizontalOverflow(page);
  await assertComposerFlow(page, { coachExpected: false });
  const status = await page.locator('#ng8-status').boundingBox();
  expect(status).not.toBeNull();
  expect(status.y + status.height).toBeLessThanOrEqual(768.5);
  await page.screenshot({ path: path.join(artifacts, 'laptop-thinking.png') });
});

test('activity panel has an accessible close control and no viewport overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?scene=activity&state=executing');
  const panel = page.locator('#lab-activity');
  await expect(panel).toBeVisible();
  const close = page.locator('#lab-activity .ng8-activity-close');
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifacts, 'activity-panel.png') });
});

test('heavy thread remains structurally stable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?scene=heavy&state=executing');
  await expect(page.locator('.lab-turn')).toHaveCount(84);
  await assertNoHorizontalOverflow(page);
  await assertComposerFlow(page, { coachExpected: false });
  await page.locator('.lab-main').evaluate(el => { el.scrollTop = Math.floor(el.scrollHeight * .55); });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(artifacts, 'heavy-thread-midscroll.png') });
});

test('Project Governance modal fits desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?scene=governance&state=ready');
  const modal = page.locator('#ng85-governance');
  await expect(modal).toBeVisible();
  const card = await page.locator('.ng85-governance-card').boundingBox();
  expect(card).not.toBeNull();
  expect(card.width).toBeLessThan(1370);
  expect(card.height).toBeLessThanOrEqual(810.5);
  await page.screenshot({ path: path.join(artifacts, 'project-governance.png') });
});
