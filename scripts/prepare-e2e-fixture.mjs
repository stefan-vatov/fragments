import { randomBytes } from "node:crypto";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { testRoot } from "./e2e-paths.mjs";

// Mirrors docs/local-testing.md: an isolated vault + profile with only the
// built plugin and synthetic notes, never the user's vault or normal profile.
const root = await testRoot(process.env.FRAGMENTS_TEST_ROOT);

const vault = join(root, "Fragments Test");
const profile = join(root, "profile");
const plugin = join(vault, ".obsidian/plugins/fragments");
await mkdir(root, { recursive: true });
// Preparation is for a fresh fixture; reuse its running session without
// preparing it again. Exclusive mkdir also refuses vault/profile symlinks.
await mkdir(vault);
await mkdir(profile);
await mkdir(join(vault, "Fragments/Examples"), { recursive: true });
await mkdir(plugin, { recursive: true });

const note = (title, tags, starred, language, body) =>
  `---\ntitle: ${title}\ntags: [${tags}]\nstarred: ${starred}\nlanguage: ${language}\n---\n\n${body}`;

await writeFile(
  join(vault, "Fragments/Welcome.md"),
  note(
    "Welcome",
    "testing",
    "false",
    "markdown",
    "# Headless fixture\n\nA synthetic fragment for testing.\n",
  ),
);
await writeFile(
  join(vault, "Fragments/Examples/Desk.md"),
  note("Desk", "studio", "true", "plaintext", "Arrange the desk.\n"),
);
await writeFile(join(vault, ".obsidian/community-plugins.json"), '["fragments"]');
await writeFile(join(vault, ".obsidian/app.json"), '{"safeMode":false}');

await cp(join(root, "build/main.js"), join(plugin, "main.js"));
await cp(join(process.cwd(), "manifest.json"), join(plugin, "manifest.json"));
await cp(join(process.cwd(), "styles.css"), join(plugin, "styles.css"));

const profileJson = {
  vaults: { [randomBytes(8).toString("hex")]: { path: vault, ts: Date.now(), open: true } },
};
await writeFile(join(profile, "obsidian.json"), JSON.stringify(profileJson));
console.log(vault);
