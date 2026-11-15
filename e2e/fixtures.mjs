import { test as base, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { attachObsidian } from "../scripts/obsidian-playwright.mjs";

export const libraryRoot = "Fragments/Playwright tests";

async function unload(session) {
  await session.host.evaluate(async () => {
    const plugin = app.plugins.plugins.fragments;
    if (plugin) await plugin.flushDrafts().catch(() => undefined);
    await app.plugins.disablePlugin("fragments");
  });
  await expect
    .poll(() =>
      session.host.evaluate(() =>
        app.workspace
          .getLeavesOfType("fragments-view")
          .some((leaf) => leaf.view.contentEl?.querySelector(".fragments-app")),
      ),
    )
    .toBe(false);
}

async function prepare(session) {
  await unload(session);
  session.previousFolder = await session.host.evaluate(
    () => app.plugins.plugins.fragments?.settings?.folder ?? null,
  );
  await session.host.evaluate(async (root) => {
    const previous = app.vault.getAbstractFileByPath(root);
    if (previous) await app.vault.delete(previous, true);
    await app.vault.createFolder(root);
    await app.vault.createFolder(`${root}/Examples`);
    await app.vault.createFolder(`${root}/Other`);
    const notes = [
      [
        "Examples/Desk.md",
        "Playwright desk",
        ["qa-desk"],
        "A saffron telescope sits on this desk.",
      ],
      [
        "Other/Global target.md",
        "Playwright global target",
        ["qa-global"],
        "A note in the other collection.",
      ],
      ["Conflict.md", "Playwright conflict", ["qa-conflict"], "Original conflict body."],
      ["Rename source.md", "Playwright rename source", [], "Rename identity body."],
      ["Window note.md", "Playwright window note", [], "Window identity body."],
    ];
    for (const [path, title, tags, body] of notes) {
      await app.vault.create(
        `${root}/${path}`,
        `---\ntitle: ${JSON.stringify(title)}\ntags: ${JSON.stringify(tags)}\nstarred: false\nlanguage: markdown\n---\n\n${body}\n`,
      );
    }
    await app.plugins.enablePlugin("fragments");
    const plugin = app.plugins.plugins.fragments;
    // Keep all scenario writes, including the shared scratchpad, in one owned
    // namespace. Reload restores the user's persisted library setting.
    plugin.settings.folder = root;
    await plugin.library.load();
  }, libraryRoot);
}

export const test = base.extend({
  session: [
    async ({}, use) => {
      const session = await attachObsidian();
      try {
        const oldPopouts = session.context.pages().filter((page) => page !== session.host);
        await session.host.evaluate(async () => {
          await app.plugins.plugins.fragments?.flushDrafts().catch(() => undefined);
          const popoutLeaves = [];
          app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.getContainer() !== app.workspace.rootSplit) popoutLeaves.push(leaf);
          });
          for (const leaf of popoutLeaves) leaf.detach();
        });
        await expect.poll(() => oldPopouts.filter((page) => !page.isClosed()).length).toBe(0);
        await use(session);
      } finally {
        try {
          await unload(session);
          await session.host.evaluate(
            async ({ root, previousFolder }) => {
              const directory = app.vault.getAbstractFileByPath(root);
              if (directory) await app.vault.delete(directory, true);
              await app.plugins.enablePlugin("fragments");
              const plugin = app.plugins.plugins.fragments;
              if (plugin && previousFolder) {
                plugin.settings.folder = previousFolder;
                await plugin.saveSettings?.();
                await plugin.library.load();
              }
            },
            { root: libraryRoot, previousFolder: session.previousFolder ?? "Fragments" },
          );
          await session.openFragments();
        } finally {
          await session.browser.close();
        }
      }
    },
    { scope: "worker" },
  ],
  app: async ({ session }, use, info) => {
    const errors = [];
    const listeners = new Map();
    const observe = (page) => {
      const onError = (error) => errors.push({ page: page.url(), message: error.message });
      page.on("pageerror", onError);
      listeners.set(page, onError);
    };
    session.context.pages().forEach(observe);
    session.context.on("page", observe);
    await session.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    let page;
    try {
      await prepare(session);
      page = await session.openFragments();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(page.getByRole("navigation", { name: "Fragments navigation" })).toBeVisible();
      await use(page);
      expect(errors, "Unhandled renderer errors").toEqual([]);
    } finally {
      session.context.off("page", observe);
      for (const [observed, listener] of listeners) observed.off("pageerror", listener);
      const failed = info.status !== info.expectedStatus || errors.length > 0;
      await writeFile(info.outputPath("renderer-errors.json"), JSON.stringify(errors, null, 2));
      try {
        if (failed && page && !page.isClosed()) {
          await page
            .screenshot({ path: info.outputPath("screen.png"), timeout: 5_000 })
            .catch(() => undefined);
        }
      } finally {
        await session.context.tracing.stop(failed ? { path: info.outputPath("trace.zip") } : {});
      }
    }
  },
});
export { expect };
