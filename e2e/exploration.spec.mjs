import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, libraryRoot } from "./fixtures.mjs";

const title = (page) => page.getByRole("textbox", { name: "Fragment title", exact: true });
const editor = (page) => page.getByRole("textbox", { name: "Fragment text", exact: true });
const search = (page) => page.getByRole("textbox", { name: "Search fragments", exact: true });
const navigation = (page) => page.getByRole("navigation", { name: "Fragments navigation" });
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

test("deleting the file externally keeps the draft and offers recovery", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright conflict");
  const path = `${libraryRoot}/Conflict.md`;
  const draft = "Unsaved draft kept after external delete.";
  await editor(app).fill(draft);
  await expect(app.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  await session.host.evaluate(async (path) => {
    const file = app.vault.getAbstractFileByPath(path);
    if (file) await app.vault.delete(file);
  }, path);
  await expect(app.getByText(/deleted fragment.s unsaved draft was kept/i)).toBeVisible();
  await expect(app.getByRole("button", { name: "Copy draft", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      session.host.evaluate((path) => app.vault.getAbstractFileByPath(path) === null, path),
    )
    .toBe(true);
  await app.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(app.getByRole("button", { name: "Copy draft", exact: true })).toHaveCount(0);
});

test("trash removes the open note and moves selection on", async ({ app, session }) => {
  await choose(app, "Playwright rename source");
  await app.evaluate(() => {
    window.__fragmentsQaConfirm = window.confirm;
    window.confirm = () => true;
  });
  try {
    await app.getByRole("button", { name: "Move to trash", exact: true }).click();
    await expect(row(app, "Playwright rename source")).toHaveCount(0);
    await expect
      .poll(() =>
        session.host.evaluate(
          (path) => app.vault.getAbstractFileByPath(path) === null,
          `${libraryRoot}/Rename source.md`,
        ),
      )
      .toBe(true);
    await expect(app.getByRole("button", { name: "Edit fragment", exact: true })).toBeVisible();
  } finally {
    await app.evaluate(() => {
      window.confirm = window.__fragmentsQaConfirm;
      delete window.__fragmentsQaConfirm;
    });
  }
});

test("filters, sort and combined search stay consistent", async ({ app }) => {
  await choose(app, "Playwright desk");
  await app.getByRole("button", { name: "Star fragment", exact: true }).click();
  await navigation(app)
    .getByRole("button", { name: /^Starred/ })
    .click();
  await expect(row(app, "Playwright desk")).toBeVisible();
  await expect(
    app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option"),
  ).toHaveCount(1);
  await navigation(app)
    .getByRole("button", { name: /^Recent/ })
    .click();
  await expect(row(app, "Playwright conflict")).toBeVisible();
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await search(app).fill("saffron telescope");
  await expect(row(app, "Playwright desk")).toBeVisible();
  await navigation(app).getByRole("button", { name: "#qa-desk 1" }).click();
  await expect(
    app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option"),
  ).toHaveCount(1);
  await search(app).fill("no-such-fragment");
  await expect(app.getByText("No matches for the current filters.", { exact: true })).toBeVisible();
  await app.getByRole("button", { name: "All", exact: true }).click();
  await search(app).fill("");
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  const sort = app.getByRole("button", { name: "Sort", exact: true });
  if ((await sort.textContent()).includes("Recent")) await sort.click();
  await expect(sort).toContainText("Name");
  await expect
    .poll(
      async () =>
        (await app
          .getByRole("listbox", { name: "Fragments", exact: true })
          .getByRole("option")
          .first()
          .textContent()) ?? "",
    )
    .toContain("Playwright conflict");
});

test("notes without or with broken frontmatter keep their shape", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    await app.vault.create(`${root}/Bare note.md`, "Bare body.\n");
    await app.vault.create(
      `${root}/Broken note.md`,
      '---\ntitle: "Unclosed\ntags: [a, b\n---\n\nBroken body.\n',
    );
  }, libraryRoot);
  await expect(row(app, "Bare note")).toBeVisible();
  await choose(app, "Bare note");
  await editor(app).fill("Edited bare body.");
  await expect.poll(() => readNote(disk(session, "Bare note.md"))).toBe("Edited bare body.");
  await app.getByRole("button", { name: "+ tag", exact: true }).click();
  await app.getByRole("textbox", { name: "Edit tags", exact: true }).fill("baretag");
  await app.getByRole("textbox", { name: "Edit tags", exact: true }).press("Enter");
  await expect.poll(() => readNote(disk(session, "Bare note.md"))).toContain("baretag");
  await expect.poll(() => readNote(disk(session, "Bare note.md"))).toContain("Edited bare body.");
  await choose(app, "Broken note");
  await expect(title(app)).toHaveValue("Broken note");
  await expect(editor(app)).toHaveValue("Broken body.\n");
});

test("moving a note with a dirty draft keeps the draft in the new collection", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright global target");
  await editor(app).fill("Draft travels with the collection move.");
  await expect(app.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  await app.getByRole("combobox", { name: "Collection", exact: true }).selectOption("Examples");
  await expect.poll(() => readNote(disk(session, "Other/Global target.md"))).toBe("");
  await expect
    .poll(() => readNote(disk(session, "Examples/Global target.md")))
    .toContain("Draft travels with the collection move.");
  await expect(editor(app)).toHaveValue("Draft travels with the collection move.");
  await expect(app.getByRole("combobox", { name: "Collection", exact: true })).toHaveValue(
    "Examples",
  );
});

test("tag editing cancels on Escape and commits on Enter", async ({ app, session }) => {
  await choose(app, "Playwright desk");
  const tags = app.getByRole("textbox", { name: "Edit tags", exact: true });
  if ((await tags.count()) === 0) {
    await app.getByRole("button", { name: "+ tag", exact: true }).click();
  }
  await tags.fill("cancelledtag");
  await tags.press("Escape");
  await expect(tags).toHaveCount(0);
  await expect
    .poll(() => readNote(disk(session, "Examples/Desk.md")))
    .not.toContain("cancelledtag");
  await app.getByRole("button", { name: "+ tag", exact: true }).click();
  await app.getByRole("textbox", { name: "Edit tags", exact: true }).fill("committedtag");
  await app.getByRole("textbox", { name: "Edit tags", exact: true }).press("Enter");
  await expect.poll(() => readNote(disk(session, "Examples/Desk.md"))).toContain("committedtag");
});

test("collection names reject whitespace and duplicates without side effects", async ({
  app,
  session,
}) => {
  const dialog = () => app.getByRole("dialog", { name: "New collection", exact: true });
  const name = () => dialog().getByRole("textbox", { name: "Collection name", exact: true });
  const directories = () =>
    session.host.evaluate(
      (root) =>
        (app.vault.getAbstractFileByPath(root)?.children ?? [])
          .filter((child) => child.children)
          .map((child) => child.name)
          .sort(),
      libraryRoot,
    );
  const before = await directories();
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  await name().fill("   ");
  await name().press("Enter");
  await expect(dialog()).toBeVisible();
  expect(await directories()).toEqual(before);
  await name().fill("Examples");
  await name().press("Enter");
  await expect(dialog()).toHaveCount(0);
  expect(await directories()).toEqual(before);
});

test("keyboard arrows move the selection and Enter opens the fragment", async ({ app }) => {
  await search(app).fill("Playwright");
  const rows = app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option");
  const names = app.locator(".fragments-result-name");
  const before = await names.first().textContent();
  await rows.first().click();
  await app.locator(".fragments-results").click({ position: { x: 30, y: 12 } });
  await app.keyboard.press("ArrowDown");
  const selected = await app
    .locator(".fragments-result.is-selected .fragments-result-name")
    .textContent();
  expect(selected).not.toBe(before);
  await app.keyboard.press("Enter");
  await expect(title(app)).toHaveValue(selected ?? "");
});

test("cancelling trash keeps the note and the selection", async ({ app, session }) => {
  await choose(app, "Playwright rename source");
  const path = `${libraryRoot}/Rename source.md`;
  await app.evaluate(() => {
    window.__fragmentsQaConfirm = window.confirm;
    window.confirm = () => false;
  });
  try {
    await app.getByRole("button", { name: "Move to trash", exact: true }).click();
    await expect(row(app, "Playwright rename source")).toBeVisible();
    await expect(title(app)).toHaveValue("Playwright rename source");
    await expect
      .poll(() =>
        session.host.evaluate((path) => app.vault.getAbstractFileByPath(path) !== null, path),
      )
      .toBe(true);
  } finally {
    await app.evaluate(() => {
      window.confirm = window.__fragmentsQaConfirm;
      delete window.__fragmentsQaConfirm;
    });
  }
});

test("renaming onto an existing title creates a unique note instead of overwriting", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright rename source");
  await title(app).fill("Playwright desk");
  await app.keyboard.press("Enter");
  await expect.poll(() => title(app).inputValue()).toBe("Playwright desk (1)");
  await expect
    .poll(() => readNote(disk(session, "Examples/Desk.md")))
    .toContain("A saffron telescope sits on this desk.");
  await expect
    .poll(() => readNote(disk(session, "Playwright desk (1).md")))
    .toContain("Rename identity body.");
});

test("empty library creates a first fragment from the empty state", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    const folder = app.vault.getAbstractFileByPath(root);
    for (const child of [...folder.children]) await app.vault.delete(child, true);
  }, libraryRoot);
  await expect(
    app.getByText("Choose a fragment or create one to begin.", { exact: true }),
  ).toBeVisible();
  await expect(app.locator(".fragments-result")).toHaveCount(0);
  await app.getByRole("main").getByRole("button", { name: "New Snippet", exact: true }).click();
  await expect(title(app)).toHaveValue(/Untitled fragment/);
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getAbstractFileByPath(`${root}/Untitled fragment.md`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
});

test("editing a CRLF note keeps its line endings", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    await app.vault.create(
      `${root}/CRLF note.md`,
      "---\r\ntitle: CRLF note\r\ntags: []\r\nlanguage: plaintext\r\n---\r\n\r\nline one\r\nline two\r\n",
    );
  }, libraryRoot);
  await choose(app, "CRLF note");
  await editor(app).fill("edited crlf body");
  await expect
    .poll(async () =>
      session.host.evaluate(async (path) => {
        const file = app.vault.getAbstractFileByPath(path);
        return file ? await app.vault.adapter.read(file.path) : "";
      }, `${libraryRoot}/CRLF note.md`),
    )
    .toContain("\r\n---\r\n\r\nedited crlf body");
});

test("moving a duplicate title into a collection keeps both notes", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    const create = async (path, title, body) =>
      app.vault.create(
        path,
        `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\n${body}`,
      );
    await create(`${root}/Dup.md`, "Dup title", "root dup body");
    await create(`${root}/Examples/Dup.md`, "Dup title", "examples dup body");
  }, libraryRoot);
  await search(app).fill("Dup title");
  const source = app.locator(`[role="option"][data-path="${libraryRoot}/Dup.md"]`);
  await expect(source).toHaveCount(1);
  await source.click();
  await expect(app.locator(".fragments-title-wrap small")).toHaveAttribute(
    "title",
    `${libraryRoot}/Dup.md`,
  );
  await app.getByRole("combobox", { name: "Collection", exact: true }).selectOption("Examples");
  await expect(title(app)).toHaveValue("Dup title (1)");
  await expect
    .poll(() => readNote(disk(session, "Examples/Dup.md")))
    .toContain("examples dup body");
  await expect
    .poll(() => readNote(disk(session, "Examples/Dup title (1).md")))
    .toContain("root dup body");
});

test("external frontmatter edits refresh and survive a body save", async ({ app, session }) => {
  const note = `${libraryRoot}/Ext Title.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Ext Title\ntags: [first]\nstarred: false\nlanguage: plaintext\n---\n\nbody for external title test",
    );
  }, note);
  await choose(app, "Ext Title");
  await expect(title(app)).toHaveValue("Ext Title");
  await session.host.evaluate(async (path) => {
    const file = app.vault.getAbstractFileByPath(path);
    await app.vault.process(file, (text) =>
      text
        .replace("title: Ext Title", "title: Externally Renamed")
        .replace("tags: [first]", "tags: [first, second]"),
    );
  }, note);
  await expect(title(app)).toHaveValue("Externally Renamed");
  await expect(app.locator("main")).toContainText("#second");
  await editor(app).fill("body saved after external title change");
  await expect
    .poll(() => readNote(disk(session, "Ext Title.md")))
    .toContain("title: Externally Renamed");
  await expect
    .poll(() => readNote(disk(session, "Ext Title.md")))
    .toContain("body saved after external title change");
});

test("a non-string or duplicated frontmatter title falls back to the filename", async ({
  app,
  session,
}) => {
  await session.host.evaluate(async (root) => {
    const files = {
      "num title.md": "---\ntitle: 12345\ntags: []\nlanguage: plaintext\n---\n\nnumber title body",
      "dup title.md":
        "---\ntitle: First\ntitle: Second\ntags: []\nlanguage: plaintext\n---\n\ndup body",
      "null title.md": "---\ntitle: null\ntags: []\nlanguage: plaintext\n---\n\nnull body",
    };
    for (const [file, text] of Object.entries(files))
      await app.vault.create(`${root}/${file}`, text);
  }, libraryRoot);
  await expect.poll(() => readNote(disk(session, "num title.md"))).toContain("number title body");
  await choose(app, "num title");
  await expect(title(app)).toHaveValue("num title");
  await choose(app, "dup title");
  await expect(title(app)).toHaveValue("dup title");
  await choose(app, "null title");
  await expect(title(app)).toHaveValue("null title");
});

test("deeply nested collection notes are indexed and listed", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    for (const folder of [`${root}/deep`, `${root}/deep/a`, `${root}/deep/a/b`])
      await app.vault.createFolder(folder);
    await app.vault.create(
      `${root}/deep/a/b/Deep note.md`,
      "---\ntitle: Deep note\ntags: [deep]\nlanguage: plaintext\n---\n\ndeep body",
    );
  }, libraryRoot);
  await expect(row(app, "Deep note")).toBeVisible();
  await expect(navigation(app).getByRole("button", { name: /^deep\/a\/b/ })).toBeVisible();
  await choose(app, "Deep note");
  await expect(editor(app)).toHaveValue("deep body");
});

test("a stale second window cannot overwrite a newer save", async ({ app, session }) => {
  const note = `${libraryRoot}/XWindow.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: XWindow\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed body",
    );
  }, note);
  await session.host.evaluate(async () => {
    const leaf = app.workspace.openPopoutLeaf();
    await leaf.setViewState({ type: "fragments-view", active: true });
  });
  let other;
  for (let attempt = 0; attempt < 40 && !other; attempt++) {
    for (const candidate of session.context.pages()) {
      if (candidate === app) continue;
      if (
        await candidate
          .evaluate(() => !!document.querySelector(".fragments-app"))
          .catch(() => false)
      ) {
        other = candidate;
        break;
      }
    }
    if (!other) await app.waitForTimeout(250);
  }
  expect(other).toBeTruthy();
  try {
    await choose(app, "XWindow");
    await choose(other, "XWindow");
    await editor(app).fill("A TEXT WINS");
    await expect.poll(() => readNote(disk(session, "XWindow.md"))).toContain("A TEXT WINS");
    await editor(other).fill("B TEXT OVERWRITES");
    await other.waitForTimeout(1500);
    await expect.poll(() => readNote(disk(session, "XWindow.md"))).toContain("A TEXT WINS");
    await expect
      .poll(async () => {
        for (const page of [session.host, app, other]) {
          const text = await page
            .locator("body")
            .innerText()
            .catch(() => "");
          if (text.includes("changed outside Fragments")) return true;
        }
        return false;
      })
      .toBe(true);
  } finally {
    await session.host.evaluate(async () => {
      const leaves = [];
      app.workspace.iterateAllLeaves((leaf) => {
        if (
          leaf.getContainer() !== app.workspace.rootSplit &&
          leaf.view?.getViewType?.() === "fragments-view"
        )
          leaves.push(leaf);
      });
      leaves.slice(1).forEach((leaf) => leaf.detach());
    });
  }
});

test("a title edit made just before a collection change is not lost", async ({ app, session }) => {
  await choose(app, "Playwright rename source");
  await title(app).fill("Renamed Before Move");
  await app.getByRole("combobox", { name: "Collection", exact: true }).selectOption("Examples");
  await expect(title(app)).toHaveValue("Renamed Before Move");
  await expect
    .poll(() => readNote(disk(session, "Examples/Renamed Before Move.md")))
    .toContain("Rename identity body.");
});

test("a dirty draft in another window survives a trash there", async ({ app, session }) => {
  const note = `${libraryRoot}/XTrashDraft.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: XTrashDraft\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed body",
    );
  }, note);
  await session.host.evaluate(async () => {
    const leaf = app.workspace.openPopoutLeaf();
    await leaf.setViewState({ type: "fragments-view", active: true });
  });
  let other;
  for (let attempt = 0; attempt < 40 && !other; attempt++) {
    for (const candidate of session.context.pages()) {
      if (candidate === app) continue;
      if (
        await candidate
          .evaluate(() => !!document.querySelector(".fragments-app"))
          .catch(() => false)
      ) {
        other = candidate;
        break;
      }
    }
    if (!other) await app.waitForTimeout(250);
  }
  expect(other).toBeTruthy();
  try {
    await choose(app, "XTrashDraft");
    await choose(other, "XTrashDraft");
    await editor(other).fill("B REGISTERED DRAFT");
    await expect(other.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
    await app.evaluate(() => {
      window.__fragmentsQaConfirm = window.confirm;
      window.confirm = () => true;
    });
    await app.getByRole("button", { name: "Move to trash", exact: true }).click();
    await expect
      .poll(async () => {
        for (const page of [app, other]) {
          const text = await page
            .locator("body")
            .innerText()
            .catch(() => "");
          if (/deleted fragment.s unsaved draft was kept/i.test(text)) return true;
        }
        return false;
      })
      .toBe(true);
  } finally {
    await app.evaluate(() => {
      window.confirm = window.__fragmentsQaConfirm;
      delete window.__fragmentsQaConfirm;
    });
    await session.host.evaluate(async () => {
      const leaves = [];
      app.workspace.iterateAllLeaves((leaf) => {
        if (
          leaf.getContainer() !== app.workspace.rootSplit &&
          leaf.view?.getViewType?.() === "fragments-view"
        )
          leaves.push(leaf);
      });
      leaves.slice(1).forEach((leaf) => leaf.detach());
    });
  }
});

test("a note ending at the frontmatter fence keeps a separator and a clean body", async ({
  app,
  session,
}) => {
  const note = `${libraryRoot}/MatterNoNL.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Custom Matter Title\ntags: [alpha]\nstarred: true\nlanguage: plaintext\n---",
    );
  }, note);
  await choose(app, "Custom Matter Title");
  await editor(app).fill("new body after no-newline frontmatter");
  await expect.poll(() => readNote(disk(session, "MatterNoNL.md"))).not.toContain("---new body");
  await expect
    .poll(() => readNote(disk(session, "MatterNoNL.md")))
    .toContain("---\nnew body after no-newline frontmatter");
  await session.host.evaluate(async () => {
    await app.plugins.disablePlugin("fragments");
    await app.plugins.enablePlugin("fragments");
  });
  const reopened = await session.openFragments();
  await reopened
    .getByRole("textbox", { name: "Search fragments", exact: true })
    .fill("Custom Matter Title");
  await expect(row(reopened, "Custom Matter Title")).toBeVisible();
  await row(reopened, "Custom Matter Title").click();
  await expect(editor(reopened)).toHaveValue("new body after no-newline frontmatter");
});

test("creating a snippet inside a selected collection lands in that collection", async ({
  app,
  session,
}) => {
  await navigation(app)
    .getByRole("button", { name: /^Examples/ })
    .click();
  await app
    .getByRole("complementary")
    .getByRole("button", { name: "New Snippet", exact: true })
    .click();
  await expect(title(app)).toBeFocused();
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getAbstractFileByPath(`${root}/Examples/Untitled fragment.md`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
});

test("moving the open file between folders externally keeps the draft", async ({
  app,
  session,
}) => {
  const note = `${libraryRoot}/MoveExternal.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: MoveExternal\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed move body",
    );
  }, note);
  await choose(app, "MoveExternal");
  await editor(app).fill("MOVE DRAFT CONTENT");
  await expect(app.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  await session.host.evaluate(
    async ({ path, next }) => {
      const file = app.vault.getFileByPath(path);
      await app.fileManager.renameFile(file, next);
    },
    { path: note, next: `${libraryRoot}/Examples/MoveExternal.md` },
  );
  await expect(app.locator(".fragments-title-wrap small")).toHaveAttribute(
    "title",
    `${libraryRoot}/Examples/MoveExternal.md`,
  );
  await expect(editor(app)).toHaveValue("MOVE DRAFT CONTENT");
  await expect
    .poll(() => readNote(disk(session, "Examples/MoveExternal.md")))
    .toContain("MOVE DRAFT CONTENT");
});

test("the global search combobox opens the top match on Enter", async ({ app, session }) => {
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Global Entry QA\ntags: [globalqa]\nstarred: false\nlanguage: plaintext\n---\n\nglobal body",
    );
  }, `${libraryRoot}/Global Entry QA.md`);
  const global = app.getByRole("combobox", {
    name: "Search all fragments by title or tag",
    exact: true,
  });
  await global.fill("Global Entry QA");
  await global.press("Enter");
  await expect.poll(() => title(app).inputValue()).toBe("Global Entry QA");
});

test("renaming a note to an existing collection name keeps both", async ({ app, session }) => {
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Folder Name QA\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nfolder name body",
    );
  }, `${libraryRoot}/Folder Name QA.md`);
  await choose(app, "Folder Name QA");
  await title(app).fill("Examples");
  await title(app).press("Enter");
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getFileByPath(`${root}/Examples.md`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getAbstractFileByPath(`${root}/Examples`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
});

test("renaming to a title used in another collection gets a unique title", async ({
  app,
  session,
}) => {
  await session.host.evaluate(async (root) => {
    const mk = async (path, title) =>
      app.vault.create(
        path,
        `---\ntitle: ${JSON.stringify(title)}\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\n${title} body`,
      );
    await mk(`${root}/UniqueRoot.md`, "Unique Root");
    await mk(`${root}/Examples/UniqueTaken.md`, "Unique Taken");
  }, libraryRoot);
  await choose(app, "Unique Root");
  await title(app).fill("Unique Taken");
  await title(app).press("Enter");
  await expect(title(app)).toHaveValue("Unique Taken (1)");
  await expect
    .poll(() => readNote(disk(session, "Examples/UniqueTaken.md")))
    .toContain("Unique Taken body");
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getFileByPath(`${root}/Unique Taken (1).md`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
});

test("renaming the library folder externally keeps the library and setting", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright desk");
  try {
    await session.host.evaluate(async (root) => {
      const folder = app.vault.getAbstractFileByPath(root);
      await app.fileManager.renameFile(folder, `${root}Renamed`);
    }, libraryRoot);
    await expect
      .poll(() => session.host.evaluate(() => app.plugins.plugins.fragments.settings.folder))
      .toBe(`${libraryRoot}Renamed`);
    await expect
      .poll(() =>
        session.host.evaluate(
          (root) => app.vault.getFileByPath(`${root}Renamed/Examples/Desk.md`) !== null,
          libraryRoot,
        ),
      )
      .toBe(true);
  } finally {
    await session.host.evaluate(async (root) => {
      const folder = app.vault.getAbstractFileByPath(`${root}Renamed`);
      if (folder) await app.fileManager.renameFile(folder, root);
    }, libraryRoot);
  }
});

test("trashing a note inside a collection updates its count", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    await app.vault.create(
      `${root}/Examples/Counted.md`,
      "---\ntitle: Counted\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\ncounted body",
    );
  }, libraryRoot);
  const examples = () => navigation(app).getByRole("button", { name: /^Examples/ });
  await expect(examples()).toContainText("2");
  await choose(app, "Counted");
  await app.evaluate(() => {
    window.__fragmentsQaConfirm = window.confirm;
    window.confirm = () => true;
  });
  try {
    await app.getByRole("button", { name: "Move to trash", exact: true }).click();
    await expect(examples()).toContainText("1");
  } finally {
    await app.evaluate(() => {
      window.confirm = window.__fragmentsQaConfirm;
      delete window.__fragmentsQaConfirm;
    });
  }
});

test("external creates appear and sort mode survives a reload", async ({ app, session }) => {
  await session.host.evaluate(async (root) => {
    await app.vault.create(
      `${root}/External New.md`,
      "---\ntitle: External New\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nexternal new body",
    );
  }, libraryRoot);
  await expect(row(app, "External New")).toBeVisible();
  const sort = app.getByRole("button", { name: "Sort", exact: true });
  if ((await sort.textContent()).includes("Recent")) await sort.click();
  await expect(sort).toContainText("Name");
  await session.host.evaluate(async () => {
    await app.plugins.disablePlugin("fragments");
    await app.plugins.enablePlugin("fragments");
  });
  const reopened = await session.openFragments();
  await expect(reopened.getByRole("button", { name: "Sort", exact: true })).toContainText("Name");
});

test("an open preview refreshes on external edits", async ({ app, session }) => {
  const note = `${libraryRoot}/Preview Refresh.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Preview Refresh\ntags: []\nstarred: false\nlanguage: markdown\n---\n\noriginal **body**",
    );
  }, note);
  await choose(app, "Preview Refresh");
  await app.getByRole("button", { name: "Preview fragment", exact: true }).click();
  await expect(app.locator(".fragments-preview")).toContainText("original");
  await session.host.evaluate(async (path) => {
    const file = app.vault.getFileByPath(path);
    await app.vault.modify(
      file,
      "---\ntitle: Preview Refresh\ntags: []\nstarred: false\nlanguage: markdown\n---\n\nexternal **update**",
    );
  }, note);
  await expect(app.locator(".fragments-preview")).toContainText("external");
  await expect(app.locator(".fragments-preview strong")).toHaveText("update");
});

test("rapid plugin reloads flush a dirty draft", async ({ app, session }) => {
  const note = `${libraryRoot}/Reload Draft.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Reload Draft\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed",
    );
  }, note);
  await choose(app, "Reload Draft");
  await editor(app).fill("RELOAD DRAFT TEXT");
  await session.host.evaluate(async () => {
    for (let i = 0; i < 2; i++) {
      await app.plugins.disablePlugin("fragments");
      await app.plugins.enablePlugin("fragments");
    }
  });
  await expect
    .poll(() => readNote(disk(session, "Reload Draft.md")))
    .toContain("RELOAD DRAFT TEXT");
});

test("copying a fragment copies the unsaved draft", async ({ app, session }) => {
  const note = `${libraryRoot}/Copy Draft.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Copy Draft\ntags: []\nstarred: false\nlanguage: markdown\n---\n\npersisted copy body",
    );
  }, note);
  await choose(app, "Copy Draft");
  await app.evaluate(() => {
    window.__fragmentsQaClipboard = navigator.clipboard.writeText.bind(navigator.clipboard);
    window.__fragmentsQaCopied = null;
    navigator.clipboard.writeText = async (text) => {
      window.__fragmentsQaCopied = text;
      return window.__fragmentsQaClipboard(text).catch(() => undefined);
    };
  });
  try {
    await editor(app).fill("DRAFT COPY TEXT");
    await app.getByRole("button", { name: "Copy fragment", exact: true }).click();
    await expect.poll(() => app.evaluate(() => window.__fragmentsQaCopied)).toBe("DRAFT COPY TEXT");
  } finally {
    await app.evaluate(() => {
      navigator.clipboard.writeText = window.__fragmentsQaClipboard;
      delete window.__fragmentsQaClipboard;
      delete window.__fragmentsQaCopied;
    });
  }
});

test("scratchpad visibility survives a plugin reload", async ({ app, session }) => {
  await choose(app, "Playwright desk");
  const hide = app.getByRole("button", { name: "Hide scratchpad", exact: true });
  if (await hide.count()) await hide.click();
  await expect(app.getByRole("button", { name: "Show scratchpad", exact: true })).toBeVisible();
  await session.host.evaluate(async () => {
    await app.plugins.disablePlugin("fragments");
    await app.plugins.enablePlugin("fragments");
  });
  const reopened = await session.openFragments();
  await expect(
    reopened.getByRole("button", { name: "Show scratchpad", exact: true }),
  ).toBeVisible();
});

test("copying in preview copies the persisted body", async ({ app, session }) => {
  const note = `${libraryRoot}/Preview Copy.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Preview Copy\ntags: []\nstarred: false\nlanguage: markdown\n---\n\npreview copy body",
    );
  }, note);
  await choose(app, "Preview Copy");
  await app.getByRole("button", { name: "Preview fragment", exact: true }).click();
  await app.evaluate(() => {
    window.__fragmentsQaClipboard = navigator.clipboard.writeText.bind(navigator.clipboard);
    window.__fragmentsQaCopied = null;
    navigator.clipboard.writeText = async (text) => {
      window.__fragmentsQaCopied = text;
      return window.__fragmentsQaClipboard(text).catch(() => undefined);
    };
  });
  try {
    await app.getByRole("button", { name: "Copy fragment", exact: true }).click();
    await expect
      .poll(() => app.evaluate(() => window.__fragmentsQaCopied))
      .toBe("preview copy body");
  } finally {
    await app.evaluate(() => {
      navigator.clipboard.writeText = window.__fragmentsQaClipboard;
      delete window.__fragmentsQaClipboard;
      delete window.__fragmentsQaCopied;
    });
  }
});

test("starring inside a collection updates the starred count", async ({ app }) => {
  await navigation(app)
    .getByRole("button", { name: /^Examples/ })
    .click();
  const starred = () => navigation(app).getByRole("button", { name: /^Starred/ });
  const before = Number((await starred().textContent()).replace(/\D/g, ""));
  await row(app, "Playwright desk").click();
  await app.getByRole("button", { name: "Star fragment", exact: true }).click();
  await expect(starred()).toContainText(String(before + 1));
});

test("a filtered-out selection cannot be trashed", async ({ app }) => {
  await choose(app, "Playwright desk");
  await search(app).fill("zzz-hides-everything");
  await expect(app.getByRole("button", { name: "Move to trash", exact: true })).toHaveCount(0);
});

test("trashing a dirty note flushes the draft first", async ({ app, session }) => {
  const note = `${libraryRoot}/Trash Flush.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Trash Flush\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nold trash body",
    );
  }, note);
  await choose(app, "Trash Flush");
  await editor(app).fill("TRASH FLUSH DRAFT");
  await expect(app.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  await session.host.evaluate(() => {
    window.__fragmentsQaTrashOriginal = app.fileManager.trashFile;
    window.__fragmentsQaTrashCapture = null;
    app.fileManager.trashFile = async function (file, ...rest) {
      window.__fragmentsQaTrashCapture = await app.vault.cachedRead(file).catch(() => "");
      return window.__fragmentsQaTrashOriginal.call(app.fileManager, file, ...rest);
    };
  });
  await app.evaluate(() => {
    window.__fragmentsQaConfirm = window.confirm;
    window.confirm = () => true;
  });
  try {
    await app.getByRole("button", { name: "Move to trash", exact: true }).click();
    await expect
      .poll(() => session.host.evaluate(() => window.__fragmentsQaTrashCapture ?? ""))
      .toContain("TRASH FLUSH DRAFT");
    await expect
      .poll(() =>
        session.host.evaluate((path) => app.vault.getAbstractFileByPath(path) === null, note),
      )
      .toBe(true);
  } finally {
    await app.evaluate(() => {
      window.confirm = window.__fragmentsQaConfirm;
      delete window.__fragmentsQaConfirm;
    });
    await session.host.evaluate(() => {
      if (window.__fragmentsQaTrashOriginal) {
        app.fileManager.trashFile = window.__fragmentsQaTrashOriginal;
        delete window.__fragmentsQaTrashOriginal;
        delete window.__fragmentsQaTrashCapture;
      }
    });
  }
});

test("rapid star toggles settle on a consistent state", async ({ app, session }) => {
  await choose(app, "Playwright desk");
  const star = app.getByRole("button", { name: /Star fragment|Unstar fragment/ });
  const before = await star.getAttribute("aria-label");
  for (let index = 0; index < 6; index++) await star.click({ force: true }).catch(() => {});
  await expect.poll(() => star.getAttribute("aria-label")).toBe(before);
  await expect.poll(() => readNote(disk(session, "Examples/Desk.md"))).toContain("starred: false");
});

test("creating a collection with the button creates the folder", async ({ app, session }) => {
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  const dialog = app.getByRole("dialog", { name: "New collection", exact: true });
  await dialog.getByRole("textbox", { name: "Collection name", exact: true }).fill("Button Only");
  await dialog.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getAbstractFileByPath(`${root}/Button Only`) !== null,
        libraryRoot,
      ),
    )
    .toBe(true);
});

test("editing a note moves it to the top of Recent", async ({ app }) => {
  const sort = app.getByRole("button", { name: "Sort", exact: true });
  if ((await sort.textContent()).includes("Name")) await sort.click();
  await expect(sort).toContainText("Recent");
  await choose(app, "Playwright conflict");
  await editor(app).fill("recent bump body");
  await expect(app.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await expect(app.locator(".fragments-result").first()).toContainText("Playwright conflict");
});

test("unstarring inside the starred filter updates the count", async ({ app }) => {
  await choose(app, "Playwright desk");
  await app.getByRole("button", { name: "Star fragment", exact: true }).click();
  await expect(app.getByRole("button", { name: "Unstar fragment", exact: true })).toBeVisible();
  await navigation(app)
    .getByRole("button", { name: /^Starred/ })
    .click();
  await expect(row(app, "Playwright desk")).toBeVisible();
  const starred = () => navigation(app).getByRole("button", { name: /^Starred/ });
  const before = Number((await starred().textContent()).replace(/\D/g, ""));
  await row(app, "Playwright desk").click();
  await app.getByRole("button", { name: "Unstar fragment", exact: true }).click();
  await expect(starred()).toContainText(String(before - 1));
  await expect(row(app, "Playwright desk")).toHaveCount(0);
});

test("tags dedupe case-insensitively on commit", async ({ app, session }) => {
  await choose(app, "Playwright desk");
  const tags = app.getByRole("textbox", { name: "Edit tags", exact: true });
  if ((await tags.count()) === 0)
    await app.getByRole("button", { name: "+ tag", exact: true }).click();
  await tags.fill("qa, qa, QA, qa");
  await tags.press("Enter");
  await expect.poll(() => readNote(disk(session, "Examples/Desk.md"))).toContain("  - qa");
  await expect.poll(() => readNote(disk(session, "Examples/Desk.md"))).not.toContain("  - QA");
});

test("case-only rename keeps a single file", async ({ app, session }) => {
  await choose(app, "Playwright rename source");
  await title(app).fill("playwright rename source");
  await title(app).press("Enter");
  await expect(title(app)).toHaveValue("playwright rename source");
  await expect
    .poll(() =>
      session.host.evaluate(
        (root) => app.vault.getFiles().filter((file) => /rename source/i.test(file.path)).length,
        libraryRoot,
      ),
    )
    .toBe(1);
});

test("changing collection in preview keeps the preview", async ({ app, session }) => {
  await choose(app, "Playwright desk");
  await app.getByRole("button", { name: "Preview fragment", exact: true }).click();
  await expect(app.locator(".fragments-preview")).toContainText("saffron telescope");
  await app.getByRole("combobox", { name: "Collection", exact: true }).selectOption("Other");
  await expect(app.locator(".fragments-preview")).toContainText("saffron telescope");
  await expect.poll(() => readNote(disk(session, "Other/Desk.md"))).toContain("saffron telescope");
});

test("changing the sidebar filter resets the list scroll", async ({ app, session }) => {
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await session.host.evaluate(async (root) => {
    for (let index = 0; index < 60; index++) {
      await app.vault.create(
        `${root}/Scroll ${index}.md`,
        `---\ntitle: Scroll ${index}\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nscroll body ${index}`,
      );
    }
  }, libraryRoot);
  const list = app.locator(".fragments-results");
  await expect
    .poll(() => list.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await list.evaluate((element) => {
    element.scrollTop = 1200;
  });
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await navigation(app)
    .getByRole("button", { name: /^Starred/ })
    .click();
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
});

test("the list tag chip filters the fragment list", async ({ app }) => {
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  const chip = app
    .getByRole("region", { name: "Fragment list" })
    .getByRole("button", { name: /^#qa-desk/ })
    .first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(row(app, "Playwright desk")).toBeVisible();
  await expect(
    app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option"),
  ).toHaveCount(1);
});

test("rapid sort toggles stay consistent", async ({ app }) => {
  const sort = app.getByRole("button", { name: "Sort", exact: true });
  const start = (await sort.textContent()).includes("Recent") ? "Recent" : "Name";
  const other = start === "Recent" ? "Name" : "Recent";
  for (let index = 0; index < 5; index++) {
    await sort.click();
    await expect(sort).toContainText(index % 2 === 0 ? other : start);
  }
});

test("starring in preview keeps the preview open", async ({ app }) => {
  await choose(app, "Playwright desk");
  await app.getByRole("button", { name: "Preview fragment", exact: true }).click();
  await expect(app.locator(".fragments-preview")).toBeVisible();
  await app.getByRole("button", { name: "Star fragment", exact: true }).click();
  await expect(app.locator(".fragments-preview")).toBeVisible();
  await expect(app.getByRole("button", { name: "Unstar fragment", exact: true })).toBeVisible();
});

test("body text that looks like frontmatter stays in the body", async ({ app, session }) => {
  const note = `${libraryRoot}/Body Inject.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Body Inject\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed body",
    );
  }, note);
  await choose(app, "Body Inject");
  const injected = "---\ntitle: Fake Title\ntags: [fake]\n---\n\ninjected body";
  await editor(app).fill(injected);
  await expect
    .poll(() => readNote(disk(session, "Body Inject.md")))
    .toContain("---\ntitle: Fake Title");
  await session.host.evaluate(async () => {
    await app.plugins.disablePlugin("fragments");
    await app.plugins.enablePlugin("fragments");
  });
  const reopened = await session.openFragments();
  await choose(reopened, "Body Inject");
  await expect(title(reopened)).toHaveValue("Body Inject");
  await expect(editor(reopened)).toHaveValue(injected);
});

test("rapid external edits keep the local draft and the external file", async ({
  app,
  session,
}) => {
  const note = `${libraryRoot}/Rapid Conflict.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: Rapid Conflict\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nseed conflict",
    );
  }, note);
  await choose(app, "Rapid Conflict");
  await editor(app).fill("LOCAL DRAFT");
  await session.host.evaluate(async (path) => {
    const file = app.vault.getFileByPath(path);
    await app.vault.modify(
      file,
      "---\ntitle: Rapid Conflict\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nexternal one",
    );
    await app.vault.modify(
      file,
      "---\ntitle: Rapid Conflict\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nexternal two",
    );
  }, note);
  await app.getByRole("textbox", { name: "Fragment title", exact: true }).press("ControlOrMeta+s");
  await expect.poll(() => readNote(disk(session, "Rapid Conflict.md"))).toContain("external two");
  await expect(editor(app)).toHaveValue("LOCAL DRAFT");
  await expect
    .poll(async () =>
      [
        ...(await app.locator(".notice").allTextContents()),
        ...(await session.host.locator(".notice").allTextContents()),
      ].join("\n"),
    )
    .toContain("changed outside Fragments");
});

test("renaming under an active filter updates the filtered list", async ({ app }) => {
  await choose(app, "Playwright rename source");
  await search(app).fill("Playwright rename");
  await expect(row(app, "Playwright rename source")).toBeVisible();
  await title(app).fill("Playwright rename renamed");
  await title(app).press("Enter");
  await expect(row(app, "Playwright rename renamed")).toBeVisible();
  await title(app).fill("Totally Different");
  await title(app).press("Enter");
  await expect(row(app, "Totally Different")).toHaveCount(0);
});

test("the list search matches tag queries", async ({ app }) => {
  await navigation(app)
    .getByRole("button", { name: /^All Snippets/ })
    .click();
  await search(app).fill("#qa-desk");
  await expect(row(app, "Playwright desk")).toBeVisible();
  await expect(
    app.getByRole("listbox", { name: "Fragments", exact: true }).getByRole("option"),
  ).toHaveCount(1);
});

async function openSecondWindow(session, page) {
  await session.host.evaluate(async () => {
    const leaf = app.workspace.openPopoutLeaf();
    await leaf.setViewState({ type: "fragments-view", active: true });
  });
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const candidate of session.context.pages()) {
      if (candidate === page) continue;
      if (
        await candidate
          .evaluate(() => !!document.querySelector(".fragments-app"))
          .catch(() => false)
      )
        return candidate;
    }
    await page.waitForTimeout(250);
  }
  return undefined;
}

async function closeExtraWindows(session, keep) {
  await session.context.pages().forEach(async () => {});
  await session.host.evaluate(async () => {
    const leaves = [];
    app.workspace.iterateAllLeaves((leaf) => {
      if (
        leaf.getContainer() !== app.workspace.rootSplit &&
        leaf.view?.getViewType?.() === "fragments-view"
      )
        leaves.push(leaf);
    });
    leaves.slice(1).forEach((leaf) => leaf.detach());
  });
}

test("metadata changes merge across two windows", async ({ app, session }) => {
  const note = `${libraryRoot}/XMeta Merge.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(
      path,
      "---\ntitle: XMeta Merge\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nxmeta body",
    );
  }, note);
  const other = await openSecondWindow(session, app);
  expect(other).toBeTruthy();
  try {
    await choose(app, "XMeta Merge");
    await choose(other, "XMeta Merge");
    await app.getByRole("button", { name: "Star fragment", exact: true }).click();
    await expect(app.getByRole("button", { name: "Unstar fragment", exact: true })).toBeVisible();
    const tags = other.getByRole("textbox", { name: "Edit tags", exact: true });
    if ((await tags.count()) === 0)
      await other.getByRole("button", { name: "+ tag", exact: true }).click();
    await tags.fill("merged");
    await tags.press("Enter");
    await expect.poll(() => readNote(disk(session, "XMeta Merge.md"))).toContain("starred: true");
    await expect.poll(() => readNote(disk(session, "XMeta Merge.md"))).toContain("merged");
  } finally {
    await closeExtraWindows(session, app);
  }
});

test("a collection created in one window appears in the other", async ({ app, session }) => {
  const other = await openSecondWindow(session, app);
  expect(other).toBeTruthy();
  try {
    await other.getByRole("button", { name: "New collection", exact: true }).click();
    const dialog = other.getByRole("dialog", { name: "New collection", exact: true });
    await dialog.getByRole("textbox", { name: "Collection name", exact: true }).fill("Cross Coll");
    await dialog.getByRole("textbox", { name: "Collection name", exact: true }).press("Enter");
    await expect(navigation(app).getByRole("button", { name: /^Cross Coll/ })).toBeVisible();
  } finally {
    await closeExtraWindows(session, app);
  }
});

test("renaming a collection folder while dirty keeps the draft recoverable", async ({
  app,
  session,
}) => {
  await choose(app, "Playwright desk");
  await editor(app).fill("UNSAVED FOLDER DRAFT");
  await expect(app.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
  try {
    await session.host.evaluate(async (root) => {
      const folder = app.vault.getAbstractFileByPath(`${root}/Examples`);
      await app.fileManager.renameFile(folder, `${root}/Examples Renamed`);
    }, libraryRoot);
    await expect(app.getByRole("button", { name: "Copy draft", exact: true })).toBeVisible();
    await expect(app.getByText("Fragment is no longer available.")).toHaveCount(0);
  } finally {
    await session.host.evaluate(async (root) => {
      const folder = app.vault.getAbstractFileByPath(`${root}/Examples Renamed`);
      if (folder) await app.fileManager.renameFile(folder, `${root}/Examples`);
    }, libraryRoot);
  }
});

test("renaming on blur commits the title", async ({ app }) => {
  await choose(app, "Playwright rename source");
  await title(app).fill("Blur Committed");
  await editor(app).click();
  await expect.poll(() => title(app).inputValue()).toBe("Blur Committed");
  await expect(row(app, "Blur Committed")).toBeVisible();
});

test("notes without frontmatter are indexed and saved as body text", async ({ app, session }) => {
  const note = `${libraryRoot}/No Matter.md`;
  await session.host.evaluate(async (path) => {
    await app.vault.create(path, "hello no frontmatter");
  }, note);
  await expect
    .poll(() =>
      session.host.evaluate(
        () =>
          app.plugins.plugins.fragments.library
            .entries()
            .filter((entry) => (entry.title ?? "").includes("No Matter")).length,
      ),
    )
    .toBeGreaterThan(0);
  await choose(app, "No Matter");
  await expect(title(app)).toHaveValue("No Matter");
  await editor(app).fill("hello no frontmatter edited");
  await expect
    .poll(() => readNote(disk(session, "No Matter.md")))
    .toBe("hello no frontmatter edited");
});

// Known defects found by exploratory testing on 2026-11-15. Enable each test
// together with its fix so the regression stays pinned.
test("save-conflict feedback is visible in the Fragments window", async ({ app, session }) => {
  await choose(app, "Playwright conflict");
  const path = `${libraryRoot}/Conflict.md`;
  await editor(app).fill("Local draft while the file changes outside.");
  await session.host.evaluate(async (path) => {
    await app.vault.modify(
      app.vault.getAbstractFileByPath(path),
      "---\ntitle: Playwright conflict\ntags: [qa-conflict]\nlanguage: markdown\n---\n\nExternal wins.\n",
    );
  }, path);
  await title(app).press("ControlOrMeta+s");
  await expect(app.getByRole("alert").or(app.locator(".notice")).first()).toContainText(
    "changed outside Fragments",
  );
});

test("an over-long title reports failure and keeps the persisted title", async ({ app }) => {
  await app.getByRole("button", { name: "New Snippet", exact: true }).click();
  await title(app).fill("L".repeat(300));
  await editor(app).click();
  await expect(app.getByRole("alert").or(app.locator(".notice")).first()).toBeVisible();
  await expect(title(app)).not.toHaveValue("L".repeat(300));
});

test("clearing the title does not report Saved for an unpersisted state", async ({ app }) => {
  await choose(app, "Playwright desk");
  await title(app).fill("");
  await editor(app).click();
  await expect.poll(() => title(app).inputValue()).toBe("Playwright desk");
  await expect(app.getByRole("button", { name: "Saved", exact: true })).toHaveCount(0);
});

test("an over-long collection name reports failure in the dialog", async ({ app }) => {
  await app.getByRole("button", { name: "New collection", exact: true }).click();
  const dialog = app.getByRole("dialog", { name: "New collection", exact: true });
  const name = dialog.getByRole("textbox", { name: "Collection name", exact: true });
  await name.fill("C".repeat(300));
  await name.press("Enter");
  await expect(dialog.getByRole("alert").or(dialog.locator(".notice")).first()).toBeVisible();
});

test("the advertised Ctrl+K shortcut opens the command palette", async ({ app }) => {
  await app.getByRole("textbox", { name: "Fragment title", exact: true }).click();
  await app.keyboard.press("Control+k");
  await expect(app.getByRole("dialog", { name: "Command palette", exact: true })).toBeVisible();
});
