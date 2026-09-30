import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      NEXT_TEST_SERVER: "1",
      NEXT_PUBLIC_APP_URL: baseURL,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET:
        "e2e-only-auth-secret-not-for-production-7bcb62e44a7d",
      RATE_LIMIT_REQUESTS: "10000",
      ANALYTICS_PERSISTENCE: "none",
      ANALYTICS_CONSOLE: "false",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
