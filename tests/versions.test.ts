import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs from the repo root; the release tooling rewrites these files.
const readJson = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(join(process.cwd(), name), "utf8")) as unknown;

const version = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null && "version" in value
    ? String((value as { version: unknown }).version)
    : undefined;

describe("version files", () => {
  it("keep package.json and manifest.json aligned", async () => {
    const pkg = version(await readJson("package.json"));
    const manifest = version(await readJson("manifest.json"));
    expect(pkg).toBeDefined();
    expect(manifest).toBe(pkg);
  });

  it("record the current minAppVersion in versions.json", async () => {
    const manifest = (await readJson("manifest.json")) as {
      version?: unknown;
      minAppVersion?: unknown;
    };
    const versions = (await readJson("versions.json")) as Record<string, unknown>;
    expect(typeof manifest.version).toBe("string");
    expect(versions[String(manifest.version)]).toBe(manifest.minAppVersion);
  });
});
