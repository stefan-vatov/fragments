// Mutation gate for the pure logic modules: a passing test suite that does not
// notice a mutated operator is not evidence of coverage.
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  mutate: ["src/search.ts", "src/folder-suggest.ts"],
  reporters: ["clear-text", "progress"],
  coverageAnalysis: "perTest",
  concurrency: 2,
  timeoutMS: 60_000,
  thresholds: { high: 80, low: 60, break: 50 },
  tempDirName: ".stryker-tmp",
  vitest: { configFile: "vitest.config.ts" },
};
