import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos críticos de punta a punta. Requieren Supabase local con el seed recién cargado:
 *   npx supabase db reset && npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
