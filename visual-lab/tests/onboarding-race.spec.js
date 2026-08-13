const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'onboarding-v101.js'), 'utf8');

test('onboarding relies on extension lifecycle metadata and persistent storage only', async () => {
  expect(source).toContain('LEGACY_STORAGE_KEYS');
  expect(source).toContain('INSTALL_META');
  expect(source).toContain('chrome.storage.local.get(null)');
  expect(source).toContain("lifecycle?.reason==='install'");
  expect(source).toContain("lifecycle?.reason==='update'");
  expect(source).toContain("status:'upgrade-skipped'");
  expect(source).not.toContain('hasLegacyMirror');

  const match = source.match(/async function shouldShow\(\)\s*\{([\s\S]*?)\n\s*\}\n\s*function close/);
  expect(match, 'shouldShow() source must be inspectable').not.toBeNull();
  const body = match[1];
  expect(body).not.toContain('localStorage');
  expect(body).not.toContain('indexedDB');
  expect(body).toContain('LEGACY_STORAGE_KEYS');
  expect(body).toContain('INSTALL_META');
  expect(body).toContain('chrome.storage.local.get(null)');
  expect(body).toContain("lifecycle?.reason==='install'");
  expect(body).toContain("lifecycle?.reason==='update'");
});

test('onboarding is explicitly skippable and keyboard accessible', async () => {
  expect(source).toContain('data-skip');
  expect(source).toContain("event.key==='Tab'");
  expect(source).toContain("event.key==='Escape'");
  expect(source).toContain("modal.setAttribute('role','dialog')");
  expect(source).toContain("modal.setAttribute('aria-modal','true')");
  expect(source).toContain('trap(event)');
});
