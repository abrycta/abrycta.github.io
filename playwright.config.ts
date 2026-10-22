import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT ?? 4322)

/** Smoke tests against the production build in dist/ (run `npm run build` first). */
export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  // CI: a hung test or browser fails the run with a message after 7 minutes (the suite takes about 3) instead of using up the job.
  globalTimeout: process.env.CI ? 7 * 60_000 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `node tests/static-server.mjs dist ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
