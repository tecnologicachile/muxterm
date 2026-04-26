import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /verify-native-multipane\.spec\.js/,
  reporter: 'list',
  timeout: 90_000,
  use: { trace: 'off', screenshot: 'off', video: 'off', headless: true, ignoreHTTPSErrors: true },
  projects: [{ name: 'native-multipane' }],
});
