import { defineConfig, devices } from '@playwright/test'

const previewPort = process.env.PLAYWRIGHT_PORT ?? '4173'
const previewBasePath = process.env.PLAYWRIGHT_BASE_PATH ?? '/Open-Trade/'
const previewBuildCommand = process.env.PLAYWRIGHT_BUILD_COMMAND
  ?? 'npm run build'
const previewUrl = `http://127.0.0.1:${previewPort}${previewBasePath}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: previewUrl,
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
        viewport: { width: 375, height: 720 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command:
      `${previewBuildCommand} && npm run preview -- --host 127.0.0.1 --port ${previewPort} --base ${previewBasePath}`,
    url: previewUrl,
    reuseExistingServer:
      process.env.PLAYWRIGHT_PORT === undefined && !process.env.CI,
    timeout: 120_000,
  },
})
