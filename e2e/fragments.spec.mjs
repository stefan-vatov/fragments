import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, libraryRoot } from "./fixtures.mjs";

const title = (page) => page.getByRole("textbox", { name: "Fragment title", exact: true });
const editor = (page) => page.getByRole("textbox", { name: "Fragment text", exact: true });
const search = (page) => page.getByRole("textbox", { name: "Search fragments", exact: true });
const navigation = (page) => page.getByRole("navigation", { name: "Fragments navigation" });
const notePath = (page) => page.locator(".fragments-title-wrap small").getAttribute("title");
const row = (page, name) =>
  page
    .getByRole("listbox", { name: "Fragments", exact: true })
    .getByRole("option")
    .filter({
      has: page.locator(".fragments-result-name").getByText(name, { exact: true }),
    });
const disk = (session, path) => join(session.root, "Fragments Test", libraryRoot, path);
const readNote = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

async function choose(page, name) {
  await search(page).fill(name);
  await row(page, name).click();
  await search(page).fill("");
  await page.getByRole("button", { name: "Edit fragment", exact: true }).click();
  await expect(editor(page)).toBeEditable();
}

test.beforeEach(async ({ app }) => {
  await app.keyboard.press("Escape");
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await search(app).fill("");
});

test("create, rename, edit, star and preview persist ordinary Markdown", async ({
  app,
  session,
}) => {
  await app.getByRole("button", { name: "New Snippet", exact: true }).click();
  await expect(title(app)).toBeFocused();
  await title(app).fill("Playwright notebook");
  await title(app).press("Enter");
  await expect.poll(() => notePath(app)).toBe(`${libraryRoot}/Playwright notebook.md`);
  await editor(app).fill("# Playwright notebook\n\nSaved through the real editor.");
  const path = disk(session, "Playwright notebook.md");
  await expect.poll(() => readFile(path, "utf8")).toContain("Saved through the real editor.");
  await expect
    .poll(() => readFile(path, "utf8"))
    .toMatch(/^---\r?\ntitle: ["']?Playwright notebook["']?\r?\n/m);
  await app.getByRole("button", { name: "Star fragment", exact: true }).click();
  await expect(app.getByRole("button", { name: "Unstar fragment", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => readFile(path, "utf8")).toContain("starred: true");
  await navigation(app)
    .getByRole("button", { name: /^Starred/ })
    .click();
  await expect(row(app, "Playwright notebook")).toBeVisible();
  await app.getByRole("button", { name: "Preview fragment", exact: true }).click();
  await expect(app.locator(".fragments-preview")).toContainText("Saved through the real editor.");
  await app.getByRole("button", { name: "Edit fragment", exact: true }).click();
  await expect(editor(app)).toHaveValue("# Playwright notebook\n\nSaved through the real editor.");
});

test("collection dialog validates, traps focus, cancels and creates nested collections", async ({
  app,
  session,
}) => {
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  const dialog = app.getByRole("dialog", { name: "New collection", exact: true });
  const name = dialog.getByRole("textbox", { name: "Collection name", exact: true });
  await expect(name).toBeFocused();
  await name.fill("../Outside");
  await name.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("cannot contain");
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getAbstractFileByPath(`${root}/Outside`) === null,
        libraryRoot,
      ),
    )
    .toBe(true);
  await name.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Create collection", exact: true }),
  ).toBeFocused();
  await app.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close new collection", exact: true }),
  ).toBeFocused();
  await name.fill("Created/Examples");
  await name.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(navigation(app).getByRole("button", { name: /^Created\/Examples/ })).toBeVisible();
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => Boolean(app.vault.getAbstractFileByPath(`${root}/Created/Examples`)),
        libraryRoot,
      ),
    )
    .toBe(true);
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  await name.fill("Cancelled collection");
  await name.press("Escape");
  await expect(dialog).toHaveCount(0);
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  await expect(name).toHaveValue("");
  await name.fill("Closed collection");
  await dialog.getByRole("button", { name: "Close new collection", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) =>
          ["Cancelled collection", "Closed collection"].every(
            (path) => app.vault.getAbstractFileByPath(`${root}/${path}`) === null,
          ),
        libraryRoot,
      ),
    )
    .toBe(true);
  await app.getByRole("button", { name: "Search commands", exact: true }).click();
  const palette = app.getByRole("dialog", { name: "Command palette", exact: true });
  const query = palette.getByRole("textbox", { name: "Search commands and snippets" });
  await query.fill("Playwright desk");
  await expect(palette.getByRole("button", { name: /Playwright desk/ })).toHaveCount(1);
  await query.press("ArrowDown");
  await query.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(title(app)).toHaveValue("Untitled fragment");
  await expect(title(app)).toBeFocused();
});

test("body search stays scoped and global title or tag search crosses collections", async ({
  app,
  session,
}) => {
  await navigation(app)
    .getByRole("button", { name: /^Examples/ })
    .click();
  await search(app).fill("saffron telescope");
  await expect(row(app, "Playwright desk")).toBeVisible();
  await expect(
    app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option"),
  ).toHaveCount(1);
  await search(app).fill("qa-global");
  await expect(app.getByText("No matches for the current filters.", { exact: true })).toBeVisible();
  await search(app).fill("saffron telescope");
  const global = app.getByRole("combobox", {
    name: "Search all fragments by title or tag",
    exact: true,
  });
  await global.fill("qa-global");
  const results = app.getByRole("listbox", { name: "Fragment search results", exact: true });
  await expect(results.getByRole("option", { name: /Playwright global target/ })).toBeVisible();
  await global.press("Enter");
  await expect(title(app)).toHaveValue("Playwright global target");
  await expect(editor(app)).toHaveValue("A note in the other collection.\n");
  await expect(navigation(app).getByRole("button", { name: /^Examples/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(search(app)).toHaveValue("saffron telescope");
  await editor(app).fill("Draft follows the out-of-filter file.");
  await session.host.evaluate(async (root) => {
    const file = app.vault.getAbstractFileByPath(`${root}/Other/Global target.md`);
    await app.fileManager.renameFile(file, `${root}/Other/Renamed target.md`);
  }, libraryRoot);
  await expect.poll(() => notePath(app)).toBe(`${libraryRoot}/Other/Renamed target.md`);
  await expect(title(app)).toHaveValue("Playwright global target");
  await expect(editor(app)).toHaveValue("Draft follows the out-of-filter file.");
  await expect
    .poll(() => readNote(disk(session, "Other/Renamed target.md")))
    .toContain("Draft follows the out-of-filter file.");
  await expect(search(app)).toHaveValue("saffron telescope");
  await expect(row(app, "Playwright desk")).toBeVisible();
  await global.fill("Playwright desk");
  await results.getByRole("option", { name: /Playwright desk/ }).click();
  await expect(title(app)).toHaveValue("Playwright desk");
});

test("external changes refresh clean notes and cannot overwrite an open dirty draft", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright conflict");
  const path = `${libraryRoot}/Conflict.md`;
  const external =
    "---\ntitle: Playwright conflict\ntags: [qa-conflict]\nlanguage: markdown\n---\n\nExternal editor won.\n";
  await session.host.evaluate(
    async ({ path, text }) => {
      await app.vault.modify(app.vault.getAbstractFileByPath(path), text);
    },
    { path, text: external },
  );
  await expect(editor(app)).toHaveValue("External editor won.\n");
  await session.host.evaluate((path) => {
    const vault = app.vault;
    const original = vault.process;
    window.__fragmentsQaSave = { original, started: false, release: null };
    vault.process = async function (file, ...args) {
      if (file.path === path && !window.__fragmentsQaSave.started) {
        window.__fragmentsQaSave.started = true;
        await new Promise((resolve) => {
          window.__fragmentsQaSave.release = resolve;
        });
      }
      return original.call(this, file, ...args);
    };
  }, path);
  try {
    await editor(app).fill("Local unsaved draft that must survive.");
    await expect
      .poll(() => session.host.evaluate(() => Boolean(window.__fragmentsQaSave?.release)))
      .toBe(true);
    await session.host.evaluate(
      async ({ path, text }) => {
        await app.vault.modify(app.vault.getAbstractFileByPath(path), text);
        window.__fragmentsQaSave.release();
      },
      { path, text: external.replace("External editor won.", "Another external edit won.") },
    );
    await expect(editor(app)).toHaveValue("Local unsaved draft that must survive.");
    await expect
      .poll(() => readFile(disk(session, "Conflict.md"), "utf8"))
      .toContain("Another external edit won.");
    await expect(
      app.getByRole("alert").filter({ hasText: "changed outside Fragments" }),
    ).toBeVisible();
  } finally {
    await session.host.evaluate(() => {
      const gate = window.__fragmentsQaSave;
      if (!gate) return;
      gate.release?.();
      app.vault.process = gate.original;
      delete window.__fragmentsQaSave;
    });
  }
});

test("scratchpad persists across switches and reopening and stays out of the list", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright desk");
  const pad = app.getByRole("textbox", { name: "Scratchpad text", exact: true });
  if (!(await pad.isVisible()))
    await app.getByRole("button", { name: "Show scratchpad", exact: true }).click();
  await expect(pad).toBeEditable();
  await pad.fill("Exploratory scratch text.");
  await expect
    .poll(() => readNote(disk(session, "_fragments-scratchpad.md")))
    .toBe("Exploratory scratch text.");
  await choose(app, "Playwright global target");
  await expect(pad).toHaveValue("Exploratory scratch text.");
  await app.getByRole("button", { name: "Hide scratchpad", exact: true }).click();
  await app.getByRole("button", { name: "Show scratchpad", exact: true }).click();
  await expect(pad).toHaveValue("Exploratory scratch text.");
  await search(app).fill("_fragments-scratchpad");
  await expect(app.getByText("No matches for the current filters.", { exact: true })).toBeVisible();
  await session.host.evaluate((root) => {
    const original = app.vault.process;
    const path = `${root}/_fragments-scratchpad.md`;
    window.__qaScratch = { original, release: null };
    app.vault.process = async function (file, ...args) {
      if (file.path === path)
        await new Promise((resolve) => {
          window.__qaScratch.release = resolve;
        });
      return original.call(this, file, ...args);
    };
  }, libraryRoot);
  try {
    await pad.fill("Local scratch draft awaiting conflict.");
    await expect
      .poll(() => session.host.evaluate(() => Boolean(window.__qaScratch.release)))
      .toBe(true);
    await session.host.evaluate(async (root) => {
      await app.vault.modify(
        app.vault.getAbstractFileByPath(`${root}/_fragments-scratchpad.md`),
        "External scratch text.",
      );
      window.__qaScratch.release();
    }, libraryRoot);
    const reload = app.getByRole("button", { name: "Reload scratchpad", exact: true });
    await expect(reload).toBeVisible();
    await expect(pad).toBeFocused();
    await reload.click();
    await expect(pad).toHaveValue("External scratch text.");
    await expect
      .poll(() => readNote(disk(session, "_fragments-scratchpad.md")))
      .toBe("External scratch text.");
  } finally {
    await session.host.evaluate(() => {
      const gate = window.__qaScratch;
      gate.release?.();
      app.vault.process = gate.original;
      delete window.__qaScratch;
    });
  }
  await session.host.evaluate((root) => {
    const original = app.vault.process;
    let failOnce = true;
    window.__qaTransientScratchOriginal = original;
    app.vault.process = async function (file, ...args) {
      if (file.path === `${root}/_fragments-scratchpad.md` && failOnce) {
        failOnce = false;
        throw new Error("Synthetic temporary write failure");
      }
      return original.call(this, file, ...args);
    };
  }, libraryRoot);
  try {
    await pad.fill("Local scratch survives a temporary write failure.");
    await expect(app.getByRole("region", { name: "Scratchpad", exact: true })).toContainText(
      "Could not save",
    );
    await expect(pad).toHaveValue("Local scratch survives a temporary write failure.");
    // Leaving the field retries its retained draft after the storage recovers.
    await app
      .getByRole("region", { name: "Scratchpad", exact: true })
      .getByText("Scratchpad", { exact: true })
      .click();
    await expect
      .poll(() => readNote(disk(session, "_fragments-scratchpad.md")))
      .toBe("Local scratch survives a temporary write failure.");
    await expect(pad).toHaveValue("Local scratch survives a temporary write failure.");
  } finally {
    await session.host.evaluate(() => {
      app.vault.process = window.__qaTransientScratchOriginal;
      delete window.__qaTransientScratchOriginal;
    });
  }
});

test("delayed rename retains the typed title and the selected file identity", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright rename source");
  const previous = `${libraryRoot}/Rename source.md`;
  const next = `${libraryRoot}/Playwright renamed.md`;
  await session.host.evaluate((path) => {
    const manager = app.fileManager;
    const original = manager.processFrontMatter;
    const file = app.vault.getAbstractFileByPath(path);
    window.__fragmentsQaRename = { original, file, release: null, observedRename: false };
    window.__fragmentsQaRename.event = app.vault.on("rename", (renamed, oldPath) => {
      if (renamed === file && oldPath === path) window.__fragmentsQaRename.observedRename = true;
    });
    manager.processFrontMatter = async function (target, ...args) {
      if (target === file)
        await new Promise((resolve) => {
          window.__fragmentsQaRename.release = resolve;
        });
      return original.call(this, target, ...args);
    };
  }, previous);
  try {
    await title(app).fill("Playwright renamed");
    await title(app).press("Enter");
    await expect
      .poll(() => session.host.evaluate(() => Boolean(window.__fragmentsQaRename?.release)))
      .toBe(true);
    await expect
      .poll(() => session.host.evaluate(() => window.__fragmentsQaRename.observedRename))
      .toBe(true);
    await expect(title(app)).toHaveValue("Playwright renamed");
    await expect(editor(app)).toHaveValue("Rename identity body.\n");
    await session.host.evaluate(() => window.__fragmentsQaRename.release());
    await expect.poll(() => notePath(app)).toBe(next);
    await expect(title(app)).toHaveValue("Playwright renamed");
    await expect
      .poll(() => readFile(disk(session, "Playwright renamed.md"), "utf8"))
      .toMatch(/^title: ["']?Playwright renamed["']?\r?$/m);
    expect(
      await session.host.evaluate(
        ({ previous, next }) => {
          return (
            app.vault.getAbstractFileByPath(previous) === null &&
            app.vault.getAbstractFileByPath(next) === window.__fragmentsQaRename.file
          );
        },
        { previous, next },
      ),
    ).toBe(true);
    await expect(row(app, "Playwright renamed")).toHaveAttribute("aria-selected", "true");
  } finally {
    await session.host.evaluate(() => {
      const gate = window.__fragmentsQaRename;
      if (!gate) return;
      gate.release?.();
      app.vault.offref(gate.event);
      app.fileManager.processFrontMatter = gate.original;
      delete window.__fragmentsQaRename;
    });
  }
});

test("view replacement and plugin reload preserve the app window and the note", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright window note");
  const result = await session.host.evaluate(async (path) => {
    const plugin = app.plugins.plugins.fragments;
    const first = await plugin.activateView();
    const original = first.getContainer();
    const note = app.vault.getAbstractFileByPath(path);
    await first.openFile(note);
    const next = await plugin.activateView();
    const replacementReused = next.getContainer() === original;
    const notePreserved = first.view.file?.path === note.path;
    await app.plugins.disablePlugin("fragments");
    await app.plugins.enablePlugin("fragments");
    const reloaded = await app.plugins.plugins.fragments.activateView();
    const reloadReused = reloaded.getContainer() === original;
    const noteSurvivedReload = first.view.file?.path === note.path;
    const popouts = new Set();
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.getContainer() !== app.workspace.rootSplit) popouts.add(leaf.getContainer());
    });
    return {
      replacementReused,
      notePreserved,
      reloadReused,
      noteSurvivedReload,
      popouts: popouts.size,
      fragmentViews: app.workspace.getLeavesOfType("fragments-view").length,
    };
  }, `${libraryRoot}/Window note.md`);
  expect(result).toEqual({
    replacementReused: true,
    notePreserved: true,
    reloadReused: true,
    noteSurvivedReload: true,
    popouts: 1,
    fragmentViews: 1,
  });
  const reopened = await session.openFragments();
  await reopened.setViewportSize({ width: 1440, height: 1000 });
  await expect(reopened.getByRole("button", { name: "New Snippet", exact: true })).toBeVisible();
  await expect
    .poll(() => readFile(disk(session, "Window note.md"), "utf8"))
    .toContain("Window identity body.");
});
