import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOutfile } from "../scripts/build-output.mjs";

describe("build output", () => {
  it("keeps the watch build out of the repository root", () => {
    expect(resolveOutfile(false, {})).toBe("build/main.js");
  });

  it("keeps the release artifact at the plugin root", () => {
    expect(resolveOutfile(true, {})).toBe("main.js");
  });

  it("declares a package type the cjs bundle can be loaded as", async () => {
    // jsdom's import.meta.url is not a file URL; vitest runs from the repo root.
    const pkg = await readFile(join(process.cwd(), "package.json"), "utf8");
    const config = await readFile(join(process.cwd(), "esbuild.config.mjs"), "utf8");
    expect(config).toContain('format: "cjs"');
    // `main.js` is CommonJS; a `module` package type would make Node parse it as ESM.
    expect(pkg).toContain('"type": "commonjs"');
    expect(pkg).not.toContain('"type": "module"');
  });

  it("honours an explicit override in both modes", () => {
    expect(resolveOutfile(false, { FRAGMENTS_BUILD_OUTFILE: "out/dev.js" })).toBe("out/dev.js");
    expect(resolveOutfile(true, { FRAGMENTS_BUILD_OUTFILE: "out/release.js" })).toBe(
      "out/release.js",
    );
  });
});
