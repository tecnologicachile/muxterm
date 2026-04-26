import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /verify-native-large-output\.spec\.js/,
  reporter: 'list',
  timeout: 120_000,
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    headless: true,
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: 'native-large' }],
});
