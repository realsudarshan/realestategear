import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3106";
const mockApiUrl = "http://127.0.0.1:3011";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "node e2e/fixtures/mock-api.mjs",
          url: `${mockApiUrl}/health`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
        {
          command: "npm run build && npm run start:e2e",
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            API_INTERNAL_URL: mockApiUrl,
            API_URL: mockApiUrl,
            NEXT_PUBLIC_API_URL: mockApiUrl,
          },
        },
      ],
});
