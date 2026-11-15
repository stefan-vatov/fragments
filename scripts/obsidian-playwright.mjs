import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { join } from "node:path";
import { testRoot } from "./e2e-paths.mjs";

export async function attachObsidian() {
  const root = await testRoot(process.env.FRAGMENTS_TEST_ROOT);
  const port = Number(process.env.FRAGMENTS_CDP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Set FRAGMENTS_CDP_PORT for the recorded isolated session");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    const context = browser.contexts()[0];
    const host = context.pages().find((page) => page.url().endsWith("/index.html"));
    assert(host, "Missing Obsidian host renderer");
    await host.waitForFunction(() => Boolean(globalThis.app?.workspace?.layoutReady), undefined, {
      timeout: 30_000,
    });
    assert.equal(
      await host.evaluate(() => app.vault.adapter.getBasePath()),
      join(root, "Fragments Test"),
    );
    return {
      browser,
      context,
      host,
      root,
      async openFragments() {
        await host.evaluate(async () => {
          if (!app.plugins.plugins.fragments) {
            await app.plugins.setEnable(true);
            await app.plugins.enablePluginAndSave("fragments");
          }
          await app.plugins.plugins.fragments.activateView();
        });
        let selected;
        await expect
          .poll(
            async () => {
              for (const page of context.pages()) {
                if (!page.isClosed() && (await page.locator(".fragments-app").isVisible())) {
                  selected = page;
                  return true;
                }
              }
              return false;
            },
            { timeout: 15_000, message: "Fragments rendered in its app window" },
          )
          .toBe(true);
        await selected.bringToFront();
        return selected;
      },
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
