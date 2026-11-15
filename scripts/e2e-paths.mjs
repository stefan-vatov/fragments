import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

// macOS aliases /tmp to /private/tmp. Resolve that system directory while
// refusing fixture symlinks that could redirect tests into a normal vault.
export async function testRoot(value) {
  if (!value) throw new Error("Set FRAGMENTS_TEST_ROOT to a /tmp/fragments-… directory");
  const requested = resolve(value);
  const name = basename(requested);
  const temporary = await realpath("/tmp");
  if (
    !/^fragments-(?:ui|rename)\.[^/]+$/.test(name) ||
    (await realpath(dirname(requested))) !== temporary
  ) {
    throw new Error("Set FRAGMENTS_TEST_ROOT to a /tmp/fragments-… directory");
  }
  const root = join(temporary, name);
  try {
    if ((await lstat(root)).isSymbolicLink())
      throw new Error("The test root must not be a symlink");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return root;
}
