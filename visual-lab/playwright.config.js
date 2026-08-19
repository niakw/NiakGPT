const { defineConfig } = require('@playwright/test');

const webServer = process.platform === 'linux' ? {
  command: 'python3 -m http.server 4173 --directory ..',
  url: 'http://127.0.0.1:4173/visual-lab/',
  reuseExistingServer: true,
  timeout: 10000
} : undefined;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/visual-lab/',
    browserName: 'chromium',
    colorScheme: 'dark',
    reducedMotion: 'reduce'
  },
  webServer
});
