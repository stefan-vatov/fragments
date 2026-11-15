import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, realpath, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { createRequire } from "node:module";
import { attachObsidian } from "./obsidian-playwright.mjs";
import { testRoot } from "./e2e-paths.mjs";

const root = await testRoot(process.env.FRAGMENTS_TEST_ROOT);
const port = Number(process.env.FRAGMENTS_CDP_PORT);
const executable = process.env.FRAGMENTS_OBSIDIAN_EXECUTABLE;
if (!executable || !Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Set FRAGMENTS_OBSIDIAN_EXECUTABLE and FRAGMENTS_CDP_PORT");
const mode = process.env.FRAGMENTS_DISPLAY_MODE;
for (const directory of ["Fragments Test", "profile"])
  assert.equal(
    await realpath(join(root, directory)),
    join(root, directory),
    "Fixture directories must not be symlinks",
  );
if (process.platform === "linux") {
  if (mode !== "xvfb" || !process.env.DISPLAY)
    throw new Error("Run inside a test-owned Xvfb display with FRAGMENTS_DISPLAY_MODE=xvfb");
} else if (process.platform === "darwin") {
  if (mode !== "dedicated-gui")
    throw new Error(
      "Use a dedicated macOS GUI test session with FRAGMENTS_DISPLAY_MODE=dedicated-gui",
    );
} else {
  throw new Error("This E2E launcher supports Linux and macOS");
}

// Refuse an occupied endpoint before starting, rather than attaching to a
// different Obsidian instance if our child cannot bind the debugging port.
const probe = createServer();
probe.listen(port, "127.0.0.1");
await once(probe, "listening");
await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));

const environment = { ...process.env, FRAGMENTS_TEST_ROOT: root };
delete environment.WAYLAND_DISPLAY;
delete environment.WAYLAND_SOCKET;
const log = await open(join(root, "obsidian.log"), "w");
const child = spawn(
  executable,
  [
    ...(process.platform === "linux" ? ["--ozone-platform=x11"] : []),
    `--user-data-dir=${join(root, "profile")}`,
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    "--disable-gpu",
    "--no-first-run",
  ],
  { env: environment, stdio: ["ignore", log.fd, log.fd] },
);
let launchError;
child.on("error", (error) => {
  launchError = error;
});
const exited = once(child, "exit").catch(() => undefined);
let page;
let suite;
let session;
let forcedStop;
const interrupt = () => {
  process.exitCode = 1;
  suite?.kill("SIGTERM");
  child.kill("SIGTERM");
  forcedStop ??= setTimeout(() => {
    suite?.kill("SIGKILL");
    child.kill("SIGKILL");
  }, 5000);
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);

async function until(operation, description) {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(`Obsidian exited before ${description}; see ${root}/obsidian.log`);
    try {
      const result = await operation();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out: ${description}`, { cause: lastError });
}

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error("Cannot list debugging targets");
  return response.json();
}

try {
  await writeFile(
    join(root, "session.json"),
    JSON.stringify(
      {
        FRAGMENTS_TEST_ROOT: root,
        FRAGMENTS_CDP_PORT: port,
        FRAGMENTS_OBSIDIAN_PID: child.pid,
        FRAGMENTS_DISPLAY_MODE: mode,
        DISPLAY: environment.DISPLAY,
      },
      null,
      2,
    ),
  );
  await until(
    async () =>
      (await targets()).find(
        (candidate) => candidate.type === "page" && candidate.url.endsWith("/index.html"),
      ),
    "Obsidian renderer",
  );
  session = await attachObsidian();
  page = await session.openFragments();
  if (process.argv.includes("--serve")) {
    console.log(
      `Exploratory session ready at http://127.0.0.1:${port}; record: ${root}/session.json`,
    );
    console.log(
      "Run pnpm run test:e2e to attach scenarios, or attachObsidian() for interactive exploration. Stop with Ctrl+C.",
    );
    await exited;
  } else {
    suite = spawn(
      process.execPath,
      [
        createRequire(import.meta.url).resolve("@playwright/test/cli"),
        "test",
        ...process.argv.slice(2),
      ],
      {
        env: environment,
        stdio: "inherit",
        timeout: 600_000,
      },
    );
    const [code] = await once(suite, "exit");
    assert.equal(code, 0, "Rendered pointer/keyboard and Markdown regression suite failed");
    console.log(`Passed UI interactions and Markdown writes using ${mode}`);
  }
} finally {
  if (session) {
    try {
      // Scenarios can replace or reload a view, closing the original popout.
      page = session.host;
      for (const candidate of session.context.pages()) {
        if (!candidate.isClosed() && (await candidate.locator(".fragments-app").count())) {
          page = candidate;
          break;
        }
      }
      await page.screenshot({ path: join(root, "fragments.png") });
      console.log(`Screenshot: ${root}/fragments.png`);
    } catch (error) {
      console.error("Could not capture the test renderer:", error.message);
    }
  }
  if (session)
    await session.browser
      .close()
      .catch((error) => console.error("Disconnect failed:", error.message));
  if (child.exitCode === null && child.signalCode === null && !launchError) {
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.kill("SIGTERM");
    await exited;
    clearTimeout(force);
  }
  await log.close();
  clearTimeout(forcedStop);
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  console.log(
    `Test Obsidian process ${child.pid ?? "(not started)"} stopped; fixture retained at ${root}`,
  );
}
