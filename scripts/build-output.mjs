// Where the esbuild bundle goes.
//
// A checkout can be symlinked into a live vault's plugin directory (the README
// documents exactly that), so the default must not be the repository root for
// the watch build: every save would redeploy into the running Obsidian window.
const DEV_OUTFILE = "build/main.js";
// The release artifact is main.js at the plugin root.
const BUILD_OUTFILE = "main.js";

export function resolveOutfile(production, env) {
  return env.FRAGMENTS_BUILD_OUTFILE ?? (production ? BUILD_OUTFILE : DEV_OUTFILE);
}
