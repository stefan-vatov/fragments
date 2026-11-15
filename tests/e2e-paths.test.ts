import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { testRoot } from "../scripts/e2e-paths.mjs";

const owned: string[] = [];
afterEach(async () => {
  for (const path of owned.splice(0).reverse()) await rm(path, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("isolated E2E roots", () => {
  it("accepts a system temporary-directory alias but returns the canonical root", async () => {
    const root = await mkdtemp("/tmp/fragments-ui.");
    const links = await mkdtemp("/tmp/fragments-ui.");
    owned.push(root, links);
    await symlink(await realpath("/tmp"), join(links, "tmp"));
    const alias = join(links, "tmp", root.split("/").at(-1) ?? "");
    expect(await testRoot(alias)).toBe(await realpath(root));
  });

  it("refuses a fixture symlink that redirects into another directory", async () => {
    const root = await mkdtemp("/tmp/fragments-ui.");
    const link = `${root}-alias`;
    owned.push(root, link);
    await symlink(root, link);
    await expect(testRoot(link)).rejects.toThrow("must not be a symlink");
  });

  it("refuses normal vault paths and missing configuration", async () => {
    await expect(testRoot(undefined)).rejects.toThrow("FRAGMENTS_TEST_ROOT");
    await expect(testRoot("/tmp/my-normal-vault")).rejects.toThrow("FRAGMENTS_TEST_ROOT");
  });

  it("refuses to prepare through an existing fixture vault symlink", async () => {
    const root = await mkdtemp("/tmp/fragments-ui.");
    const outside = await mkdtemp("/tmp/fragments-ui.");
    owned.push(root, outside);
    await symlink(outside, join(root, "Fragments Test"));
    const result = spawnSync(process.execPath, ["scripts/prepare-e2e-fixture.mjs"], {
      env: { ...process.env, FRAGMENTS_TEST_ROOT: root },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("EEXIST");
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(outside)).toEqual([]);
  });
});
