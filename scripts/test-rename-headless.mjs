import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.env.FRAGMENTS_TEST_ROOT ?? "");
const port = Number(process.env.FRAGMENTS_CDP_PORT);
if (
  !/^\/tmp\/fragments-(?:ui|rename)\.[^/]+$/.test(root) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error("Set FRAGMENTS_TEST_ROOT and FRAGMENTS_CDP_PORT for an isolated test session");
}

const response = await fetch(`http://127.0.0.1:${port}/json/list`);
if (!response.ok) throw new Error("Cannot list Obsidian debugging targets");
const targets = await response.json();
const main = targets.find((target) => target.type === "page" && target.url.endsWith("/index.html"));
const popout = targets.find((target) => target.type === "page" && target.url === "about:blank");
if (!main || !popout) throw new Error("Open Fragments in the isolated test vault first");

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 15000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  return { send, evaluate, close: () => socket.close() };
}

const host = await connect(main);
const page = await connect(popout);
const folder = `Rename regression ${randomUUID()}`;
const folderPath = `Fragments/${folder}`;
const expectedVault = join(root, "Fragments Test");
let created = false;

async function until(check, message) {
  for (let attempts = 0; attempts < 100; attempts++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${message}`);
}

async function click(expression) {
  const point = await page.evaluate(`(() => {
    const element = ${expression};
    if (!element) throw new Error('Missing element');
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) throw new Error('Element is not visible');
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  }
}

async function press(key, code, windowsVirtualKeyCode, modifiers = 0) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.send("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode,
      modifiers,
    });
  }
}

async function type(selector, value) {
  await click(`document.querySelector(${JSON.stringify(selector)})`);
  await press("a", "KeyA", 65, 2);
  await page.send("Input.insertText", { text: value });
}

async function clickRow(title) {
  await click(`[...document.querySelectorAll('.fragments-result')].find(row =>
    row.querySelector('.fragments-result-name')?.innerText === ${JSON.stringify(title)})`);
}

const title = () => page.evaluate(`document.querySelector('[aria-label="Fragment title"]')?.value`);
const file = (name) => join(expectedVault, folderPath, `${name}.md`);
const originalContent =
  "---\ntitle: Existing\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\nOriginal fragment body.\n";

try {
  assert.equal(await realpath(root), root, "The test root must not be a symlink");
  assert.equal(
    await realpath(expectedVault),
    expectedVault,
    "The test vault must not be a symlink",
  );
  const vault = await host.evaluate(`app.vault.adapter.getBasePath()`);
  assert.equal(vault, expectedVault, "Connected Obsidian must use the isolated fixture vault");
  await host.evaluate(`(async () => {
    const path = ${JSON.stringify(folderPath)};
    if (app.vault.getAbstractFileByPath(path)) throw Error('Fixture folder already exists');
    await app.vault.createFolder(path);
    await app.vault.createFolder(path + '/Destination');
    const note = await app.vault.create(path + '/Existing.md', ${JSON.stringify(originalContent)});
    await app.plugins.plugins.fragments.library.refresh(note);
  })()`);
  created = true;
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const collection = `[...document.querySelectorAll('.fragments-navigation button')].find(button =>
    [...button.querySelectorAll('span')].some(span => span.innerText === ${JSON.stringify(folder)}))`;
  await until(() => page.evaluate(`!!(${collection})`), "fixture collection appears");
  await click(collection);
  await until(async () => (await title()) === "Existing", "existing fragment selected");

  await click(`document.querySelector('.fragments-new')`);
  await until(async () => (await title()) === "Untitled fragment", "new fragment selected");
  await type('[aria-label="Fragment title"]', "Renamed new");
  await clickRow("Existing");
  await until(async () => {
    try {
      return (await readFile(file("Renamed new"), "utf8")).includes("title: Renamed new");
    } catch {
      return false;
    }
  }, "new fragment renamed");
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(await title(), "Existing", "the later row selection must survive the rename");
  assert.equal(await readFile(file("Existing"), "utf8"), originalContent);

  await click(`document.querySelector('.fragments-new')`);
  await until(async () => (await title()) === "Untitled fragment", "first untitled selected");
  await click(`document.querySelector('.fragments-new')`);
  await until(async () => (await title()) === "Untitled fragment 2", "second untitled selected");
  await type('[aria-label="Search fragments"]', "Untitled fragment");
  await until(
    () => page.evaluate(`document.querySelectorAll('.fragments-result').length === 2`),
    "both untitled fragments match the filter",
  );
  await clickRow("Untitled fragment");
  await until(async () => (await title()) === "Untitled fragment", "first untitled selected");
  await type('[aria-label="Fragment title"]', "Filtered renamed");
  await press("Enter", "Enter", 13);
  await until(async () => {
    try {
      await readFile(file("Filtered renamed"), "utf8");
      return true;
    } catch {
      return false;
    }
  }, "filtered fragment renamed");
  await until(
    async () => (await title()) === "Filtered renamed",
    "renamed fragment stays selected",
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(
    await title(),
    "Filtered renamed",
    "a changed search match must not select the other fragment",
  );
  await type('[aria-label="Fragment text"]', "Body written after rename.");
  await until(
    async () =>
      (await readFile(file("Filtered renamed"), "utf8")).includes("Body written after rename."),
    "edited body saved",
  );
  assert(
    !(await readFile(file("Untitled fragment 2"), "utf8")).includes("Body written after rename."),
  );
  assert.equal(await readFile(file("Existing"), "utf8"), originalContent);
  await type('[aria-label="Search fragments"]', "Existing");
  await until(
    async () => (await title()) === "Existing",
    "a new search selects its matching fragment",
  );
  await type('[aria-label="Search fragments"]', "");
  await until(
    () =>
      page.evaluate(
        `!![...document.querySelectorAll('.fragments-result-name')].find(name => name.innerText === 'Filtered renamed')`,
      ),
    "renamed fragment appears after clearing the search",
  );
  await clickRow("Filtered renamed");
  await until(async () => (await title()) === "Filtered renamed", "renamed fragment reselected");
  const select = '[aria-label="Collection"]';
  const nextOption = await page.evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(select)});
    return select.options[select.selectedIndex + 1]?.value;
  })()`);
  assert.equal(nextOption, `${folder}/Destination`);
  await click(`document.querySelector(${JSON.stringify(select)})`);
  await press("ArrowDown", "ArrowDown", 40);
  await press("Enter", "Enter", 13);
  const moved = join(expectedVault, folderPath, "Destination", "Filtered renamed.md");
  await until(async () => {
    try {
      return (await readFile(moved, "utf8")).includes("Body written after rename.");
    } catch {
      return false;
    }
  }, "renamed fragment moved to the destination collection");
  await until(async () => (await title()) === "Filtered renamed", "moved fragment stays selected");
  assert.equal(await readFile(file("Existing"), "utf8"), originalContent);

  await click(`document.querySelector('[title="New collection"]')`);
  const input = '[aria-label="Collection name"]';
  await until(
    () =>
      page.evaluate(`document.querySelector('dialog')?.open &&
        document.activeElement === document.querySelector(${JSON.stringify(input)})`),
    "new collection input receives focus",
  );
  await page.evaluate(`document.querySelector('[aria-label="Search fragments"]').focus()`);
  assert(
    await page.evaluate(`!!document.activeElement.closest('dialog')`),
    "background controls must not take focus from the dialog",
  );
  for (let i = 0; i < 4; i++) {
    await press("Tab", "Tab", 9);
    assert(await page.evaluate(`!!document.activeElement.closest('dialog')`));
  }
  await type(input, `${folder}/Dialog created`);
  await press("Enter", "Enter", 13);
  await until(async () => {
    try {
      return (await stat(join(expectedVault, folderPath, "Dialog created"))).isDirectory();
    } catch {
      return false;
    }
  }, "Enter creates the collection on disk");
  await until(() => page.evaluate(`!document.querySelector('dialog')`), "collection dialog closes");
  console.log(
    "Passed: rename, selection, filtered edits and move preserved the intended Markdown files; collection dialog focus and Enter worked.",
  );
} finally {
  if (created) {
    await host.evaluate(`(async () => {
      const folder = app.vault.getAbstractFileByPath(${JSON.stringify(folderPath)});
      if (folder) await app.vault.delete(folder, true);
    })()`);
  }
  page.close();
  host.close();
}
