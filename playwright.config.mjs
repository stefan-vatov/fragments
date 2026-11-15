import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { testRoot } from "./scripts/e2e-paths.mjs";

const root = await testRoot(process.env.FRAGMENTS_TEST_ROOT);
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: join(root, "playwright-results"),
  reporter: [["list"], ["json", { outputFile: join(root, "playwright-results.json") }]],
});
