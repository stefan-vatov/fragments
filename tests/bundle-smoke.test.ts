// @vitest-environment node
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const outdir = await mkdtemp(join(tmpdir(), "fragments-smoke-"));

afterAll(async () => {
  await rm(outdir, { recursive: true, force: true });
});

describe("the built bundle", () => {
  it("bundles the entry and loads as CommonJS", async () => {
    const outfile = join(outdir, "main.js");
    await build({
      entryPoints: [join(process.cwd(), "src/main.ts")],
      bundle: true,
      // Obsidian's package carries typings only; load the test stub instead.
      external: ["electron", ...builtinModules],
      format: "cjs",
      target: "es2020",
      outfile,
      plugins: [
        {
          name: "obsidian-stub",
          setup(builder) {
            builder.onResolve({ filter: /^obsidian$/ }, () => ({
              path: join(process.cwd(), "tests/obsidian-stub.ts"),
            }));
          },
        },
      ],
    });
    const loaded = createRequire(import.meta.url)(outfile) as unknown;
    expect(loaded).toBeTypeOf("object");
  });
});
