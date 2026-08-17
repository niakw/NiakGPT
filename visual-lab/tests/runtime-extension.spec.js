const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', '..');
const fixture = fs.readFileSync(path.join(__dirname, '..', 'runtime-fixture.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
const EXPECTED_VERSION = manifest.version;
const CHAT1 = '11111111-1111-4111-8111-111111111111';
const CHAT2 = '22222222-2222-4222-8222-222222222222';
const CHAT3 = '33333333-3333-4333-8333-333333333333';
const P1 = 'g-p-aaaaaaaaaaaaaaaa';
const P2 = 'g-p-bbbbbbbbbbbbbbbb';

function projectRaw(id, name) { return { gizmo: { gizmo: { id, display: { name, description: `${name} project` }, instructions: '' } } }; }
function chatRaw(id, title, projectId, time) { return { id, title, gizmo_id: projectId || null, update_time: time, create_time: time }; }

async function extensionWorker(context) {
  const existing = context.serviceWorkers().find(worker => worker.url().includes('background-v100.js'));
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { predicate: worker => worker.url().includes('background-v100.js'), timeout: 10000 });
}

async function launchRuntime({ onboarding = 'done' } = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niakgpt-runtime-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true, channel: 'chromium', viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  const worker = await extensionWorker(context);
  if (onboarding === 'done') {
    await worker.evaluate(async version => { await chrome.storage.local.set({'niakgpt-onboarding-v100': { status: 'done', version, at: Date.now() }}); }, EXPECTED_VERSION);
  } else if (onboarding === 'update') {
    await worker.evaluate(async version => {
      await chrome.storage.local.remove('niakgpt-onboarding-v100');
      await chrome.storage.local.set({'niakgpt-install-meta-v100': { reason: 'update', previousVersion: '0.9.5', currentVersion: version, changedAt: Date.now() }});
    }, EXPECTED_VERSION);
  }

  const state = { projectByChat: { [CHAT1]: P1, [CHAT2]: P1, [CHAT3]: P2 }, projectRequests: [], conversationGets: 0, sendRequests: 0 };
  const allChats = [
    chatRaw(CHAT1, 'Runtime integration test', P1, 1786608000),
    chatRaw(CHAT2, 'Second conversation', P1, 1786521600),
    chatRaw(CHAT3, 'Research conversation', P2, 1786435200)
  ];

  await context.route('https://chatgpt.com/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method().toUpperCase();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.resourceType() === 'document' && /^\/c\/[0-9a-f-]+$/i.test(url.pathname)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture });
    if (url.pathname === '/api/auth/session') return json({ accessToken: 'visual-lab-token' });
    if (url.pathname === '/backend-api/gizmos/snorlax/sidebar') return json({ items: [projectRaw(P1, 'Studio'), projectRaw(P2, 'Research Lab')], cursor: null });
    if (/^\/backend-api\/gizmos\/g-p-[A-Za-z0-9]+\/conversations$/.test(url.pathname)) {
      state.projectRequests.push(request.url());
      const pid = url.pathname.match(/\/gizmos\/(g-p-[A-Za-z0-9]+)\/conversations/)[1];
      return json({ items: allChats.filter(c => c.gizmo_id === pid), cursor: null });
    }
    if (url.pathname === '/backend-api/conversations') return json({ items: allChats, has_more: false, total: allChats.length });
    const conversationMatch = url.pathname.match(/^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);
    if (conversationMatch) {
      const id = conversationMatch[1];
      if (method === 'PATCH') {
        let body = {}; try { body = request.postDataJSON() || {}; } catch {}
        state.projectByChat[id] = typeof body.gizmo_id === 'string' ? body.gizmo_id : '';
        return json({ id, gizmo_id: state.projectByChat[id] || null });
      }
      if (method === 'GET') {
        state.conversationGets++;
        return json({ id, title: allChats.find(c => c.id === id)?.title || 'Conversation', gizmo_id: state.projectByChat[id] || null, update_time: 1786608000, current_node: 'node-1', mapping: {} });
      }
    }
    if ((url.pathname === '/backend-api/conversation' || url.pathname === '/backend-api/f/conversation') && method === 'POST') {
      state.sendRequests++; await new Promise(resolve => setTimeout(resolve, 850)); return json({ ok: true, conversation_id: CHAT1 });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  const pages = context.pages(); const page = pages[0] || await context.newPage(); const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  async function waitFixture(p) { await expect(p.locator('#native-brand')).toBeVisible({ timeout: 8000 }); await expect(p.locator('#prompt-textarea')).toBeVisible({ timeout: 8000 }); }
  async function open(p = page, id = CHAT1) {
    await p.goto(`https://chatgpt.com/c/${id}`, { waitUntil: 'commit' }); await waitFixture(p);
    await expect(p.locator('#ng8-status')).toBeVisible({ timeout: 12000 }); await expect(p.locator('#ng8-status')).toContainText(EXPECTED_VERSION); return p;
  }
  async function reload(p = page) { await p.reload({ waitUntil: 'commit' }); await waitFixture(p); await expect(p.locator('#ng8-status')).toBeVisible({ timeout: 12000 }); return p; }
  async function close() { await context.close(); fs.rmSync(userDataDir, { recursive: true, force: true }); }
  return { context, worker, page, state, pageErrors, open, reload, close };
}

async function waitReady(page) { await expect.poll(async () => page.locator('html').getAttribute('data-ng86-activity'), { timeout: 10000 }).toBe('ready'); }

test('fresh install exposes skippable onboarding only once', async () => {
  const rt = await launchRuntime({ onboarding: 'fresh' });
  try {
    await rt.open(); const onboarding = rt.page.locator('#ng100-onboarding');
    await expect(onboarding).toBeVisible({ timeout: 5000 }); await expect(onboarding).toContainText('NiakGPT'); await expect(onboarding.locator('[data-skip]')).toBeVisible();
    await onboarding.locator('[data-skip]').click(); await expect(onboarding).toHaveCount(0); await rt.reload(); await rt.page.waitForTimeout(1700); await expect(rt.page.locator('#ng100-onboarding')).toHaveCount(0);
  } finally { await rt.close(); }
});

test('lifecycle update never forces onboarding', async () => {
  const rt = await launchRuntime({ onboarding: 'update' });
  try {
    await rt.open(); await rt.page.waitForTimeout(1800); await expect(rt.page.locator('#ng100-onboarding')).toHaveCount(0);
    const meta = await rt.worker.evaluate(async () => (await chrome.storage.local.get('niakgpt-onboarding-v100'))['niakgpt-onboarding-v100']); expect(meta?.status).toBe('upgrade-skipped');
  } finally { await rt.close(); }
});

test('real extension boots and Project counters use cursor-safe pagination', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); await waitReady(rt.page); await expect(rt.page.locator('#ng8-rail')).toBeVisible();
    await expect.poll(async () => rt.page.locator('html').getAttribute('data-ng8-tab-role'), { timeout: 10000 }).toBe('worker');
    await expect.poll(() => rt.state.projectRequests.length, { timeout: 16000 }).toBeGreaterThanOrEqual(2);
    for (const raw of rt.state.projectRequests) { const u = new URL(raw); expect(u.searchParams.get('cursor')).not.toBe('0'); expect(u.searchParams.get('limit')).toBe('20'); }
    await expect(rt.page.locator('#ng8-pins')).toHaveCount(1); const p1 = rt.page.locator(`#ng8-pins a[href*="${P1}"]`).first();
    await expect(p1).toBeVisible(); await expect.poll(async () => p1.locator('small').textContent(), { timeout: 16000 }).toMatch(/(?:^2$|\[2\])/); expect(rt.pageErrors).toEqual([]);
  } finally { await rt.close(); }
});

test('real activity sensor exposes ATTENTE then analysis state from native DOM signals', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); await waitReady(rt.page); await rt.page.locator('#native-send').click();
    await expect.poll(async () => rt.page.locator('html').getAttribute('data-ng86-activity'), { timeout: 700 }).toBe('waiting');
    const activeChat = rt.page.locator('#lab-chat-active'); await expect(activeChat).toHaveAttribute('data-ng86-activity', 'waiting');
    await expect.poll(async () => rt.page.locator('html').getAttribute('data-ng86-activity'), { timeout: 2500 }).toBe('thinking');
    await expect(rt.page.locator('.ng86-status-state')).toContainText('RÉFLEXION / ANALYSE'); expect(rt.state.sendRequests).toBe(1);
  } finally { await rt.close(); }
});

test('native manual Project move is DOM-verified, locked, and never full-fetches the conversation', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); await waitReady(rt.page);
    await rt.page.locator('#lab-move-native').click();
    await rt.page.getByRole('menuitem', { name: 'Déplacer vers un projet' }).click();
    await rt.page.getByRole('menuitem', { name: 'Research Lab' }).click();
    const row = rt.page.locator('#lab-chat-active');
    await expect(row).toHaveAttribute('data-ng85-manual', '1', { timeout: 8000 }); const lock = row.locator('.ng85-manual-lock'); await expect(lock).toBeVisible();
    expect(rt.state.projectByChat[CHAT1]).toBe(P2); expect(rt.state.conversationGets).toBe(0);
    await lock.click(); await expect(row.locator('.ng85-manual-lock')).toHaveCount(0); await expect(row).toHaveAttribute('data-ng85-manual', '0');
  } finally { await rt.close(); }
});

test('Command Palette applies workspace profile through the real extension', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); await waitReady(rt.page); await rt.page.keyboard.press('Control+Shift+P'); const command = rt.page.locator('#ng100-command'); await expect(command).toBeVisible();
    const input = command.locator('input'); await input.fill('Code / IDE'); const codeCommand = command.getByText('Profil : Code / IDE', { exact: true }); await expect(codeCommand).toBeVisible(); await codeCommand.click();
    await expect(rt.page.locator('html')).toHaveAttribute('data-ng100-profile', 'code'); await expect(command).toHaveCount(0);
  } finally { await rt.close(); }
});

test('Control Center exposes profiles and Safe Mode stops non-essential work', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); await waitReady(rt.page); await expect.poll(async () => rt.page.locator('html').getAttribute('data-ng8-tab-role'), { timeout: 10000 }).toBe('worker');
    const gear = rt.page.locator('#ng90-settings-btn'); await expect(gear).toBeVisible(); await gear.click(); const control = rt.page.locator('#ng90-control'); await expect(control).toBeVisible(); await expect(control.locator('.ng100-profile-section')).toBeVisible();
    const safeInput = control.locator('[data-setting="safeMode"]'); await expect(safeInput).toHaveAttribute('aria-label', 'Activer le Safe Mode'); await expect(safeInput).toHaveAttribute('role', 'switch');
    await safeInput.locator('xpath=..').click(); await expect(safeInput).toBeChecked(); await expect(safeInput).toHaveAttribute('aria-checked', 'true'); await expect(rt.page.locator('html')).toHaveAttribute('data-ng90-safe', '1');
    await expect(rt.page.locator('#ng8-matrix')).toBeHidden(); await expect(rt.page.locator('#ng8-coach')).toBeHidden(); await expect.poll(async () => rt.page.locator('html').getAttribute('data-ng8-tab-role'), { timeout: 6000 }).toBe('client');
  } finally { await rt.close(); }
});

test('two real ChatGPT tabs elect exactly one WORKER', async () => {
  const rt = await launchRuntime();
  try {
    await rt.open(); const second = await rt.context.newPage(); await rt.open(second, CHAT2); await waitReady(rt.page); await waitReady(second);
    await expect.poll(async () => { const roles = await Promise.all([rt.page, second].map(p => p.locator('html').getAttribute('data-ng8-tab-role'))); return roles.sort().join(','); }, { timeout: 10000 }).toBe('client,worker');
  } finally { await rt.close(); }
});
