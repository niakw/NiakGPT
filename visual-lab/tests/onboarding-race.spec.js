const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'onboarding-v100.js'), 'utf8');

test('first-install detection relies only on persistent extension storage', async () => {
  expect(source).toContain('LEGACY_STORAGE_KEYS');
  expect(source).toContain('chrome.storage.local.get(null)');
  expect(source).not.toContain('hasLegacyMirror');

  const match = source.match(/async function shouldShow\(\)\s*\{([\s\S]*?)\n\s*\}\n\s*function close/);
  expect(match, 'shouldShow() source must be inspectable').not.toBeNull();
  const body = match[1];
  expect(body).not.toContain('localStorage');
  expect(body).not.toContain('indexedDB');
  expect(body).toContain('LEGACY_STORAGE_KEYS');
  expect(body).toContain('chrome.storage.local.get(null)');
  expect(body).toContain("status:'upgrade-skipped'");
});
