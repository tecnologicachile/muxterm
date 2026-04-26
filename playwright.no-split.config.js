import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /verify-multipane-no-split\.spec\.js/,
  reporter: 'list',
  timeout: 60_000,
  use: { trace: 'off', screenshot: 'off', video: 'off', headless: true, ignoreHTTPSErrors: true },
  projects: [{ name: 'no-split' }],
});
