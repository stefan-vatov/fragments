import { describe, expect, it } from "vitest";
import { resolveOutfile } from "../scripts/build-output.mjs";

describe("build output", () => {
  it("keeps the watch build out of the repository root", () => {
    expect(resolveOutfile(false, {})).toBe("build/main.js");
  });

  it("keeps the release artifact at the plugin root", () => {
    expect(resolveOutfile(true, {})).toBe("main.js");
  });

  it("honours an explicit override in both modes", () => {
    expect(resolveOutfile(false, { FRAGMENTS_BUILD_OUTFILE: "out/dev.js" })).toBe("out/dev.js");
    expect(resolveOutfile(true, { FRAGMENTS_BUILD_OUTFILE: "out/release.js" })).toBe(
      "out/release.js",
    );
  });
});
