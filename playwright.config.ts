import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 8080);
const BASE_URL = process.env.PW_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * All projects use Chromium so CI/local only needs `npx playwright install chromium`.
 * Viewports still cover phone SE → desktop.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    browserName: "chromium",
  },
  projects: [
    {
      name: "mobile-se",
      use: {
        browserName: "chromium",
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-lg",
      use: {
        browserName: "chromium",
        viewport: { width: 414, height: 896 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: process.env.PW_WEB_SERVER ?? "npm run dev -- --host 127.0.0.1 --port 8080",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
