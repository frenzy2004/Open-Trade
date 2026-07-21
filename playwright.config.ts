import { defineConfig, devices } from '@playwright/test'

const previewPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
if (!Number.isSafeInteger(previewPort) || previewPort < 1 || previewPort > 65_535) {
  throw new RangeError('PLAYWRIGHT_PORT must be an integer from 1 to 65535')
}
const previewOrigin = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: `${previewOrigin}/Open-Trade/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-touch',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command:
      `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: `${previewOrigin}/Open-Trade/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
