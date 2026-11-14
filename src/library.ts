import { Option, Schema } from "effect";
import { getFrontMatterInfo, normalizePath, TFile, TFolder, type App } from "obsidian";

export interface Fragment {
  path: string;
  title: string;
  collection: string;
  tags: string[];
  starred: boolean;
  language: string;
  modified: number;
  preview: string;
  searchText: string;
}

export interface LibrarySettings {
  folder: string;
}

/** A rename/move moved the file but could not persist its new title. */
export class TitleWriteError extends Error {
  readonly nextPath: string;
  constructor(message: string, nextPath: string) {
    super(message);
    this.name = "TitleWriteError";
    this.nextPath = nextPath;
  }
}

const SCRATCHPAD_NAME = "_fragments-scratchpad.md";

const cleanFolder = (folder: string): string =>
  normalizePath(folder.trim()).replace(/^\/+|\/+$/g, "");
const bodyOf = (source: string): string => {
  const info = getFrontMatterInfo(source);
  return info.exists ? source.slice(info.contentStart).replace(/^\r?\n/, "") : source;
};
const plainPreview = (body: string): string =>
  body
    // Keep the label, drop the link/image target.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Raw HTML tags read as noise in a one-line preview; leave a word break.
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    // Leading list and quote markers, per line.
    .replace(/^\s*(?:[-*+]|\d+[.)]|>)\s+/gm, "")
    // Remaining heading, emphasis, code and strikethrough marks.
    .replace(/[#*_`>[\]~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
const run = async <A>(operation: () => Promise<A>): Promise<A> => {
  try {
    return await operation();
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
};
const decodeString = Schema.decodeUnknownOption(Schema.String);
const decodeBoolean = Schema.decodeUnknownOption(Schema.Boolean);
const decodeBooleanText = Schema.decodeUnknownOption(
  Schema.Literal("true", "yes", "1", "false", "no", "0"),
);
const decodeBooleanNumber = Schema.decodeUnknownOption(Schema.Literal(1, 0));
const decodeTags = Schema.decodeUnknownOption(
  Schema.Union(Schema.Array(Schema.Unknown), Schema.String),
);

// Windows refuses these device names even with an extension.
const RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/** Turns a requested title into a file name every supported platform accepts. */
const safeFileName = (name: string): string => {
  let cleaned = "";
  for (const character of name) {
    // Control characters have no place in a file name.
    const code = character.codePointAt(0) ?? 0;
    cleaned += code < 0x20 || code === 0x7f ? " " : character;
  }
  cleaned = cleaned
    // The nine characters Windows refuses.
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    // Windows strips trailing dots and spaces before adding the extension.
    .replace(/[. ]+$/, "");
  if (!cleaned) return "Untitled";
  if (RESERVED_NAMES.has(cleaned.toLowerCase())) return `_${cleaned}`;
  return cleaned;
};

interface RawFrontmatter {
  title?: unknown;
  tags?: unknown;
  starred?: unknown;
  language?: unknown;
}

interface ParsedMetadata {
  title?: string;
  tags: string[];
  starred: boolean;
  language: string;
}

function parseMetadata(raw: RawFrontmatter | undefined): ParsedMetadata {
  const tagValue = Option.getOrElse(decodeTags(raw?.tags), () => [] as unknown[]);
  // Split scalar tags on commas only: the write path joins tags with commas, so
  // whitespace must stay inside a tag for the round-trip to be lossless. An
  // array is decoded element-wise: one malformed member (an unquoted year, a
  // nested list) must not discard the valid tags around it.
  const values: string[] = Schema.is(Schema.String)(tagValue)
    ? tagValue.split(",")
    : [...tagValue].filter((tag): tag is string => Schema.is(Schema.String)(tag));
  const title = Option.getOrUndefined(decodeString(raw?.title));
  // Tools that write frontmatter do not all agree on booleans: Obsidian's parser
  // yields a string for `starred: "true"` and for YAML-1.1 spellings like `yes`.
  const starredValue = Option.getOrUndefined(decodeBoolean(raw?.starred));
  const starredText = Option.getOrUndefined(decodeBooleanText(raw?.starred));
  const starredNumber = Option.getOrUndefined(decodeBooleanNumber(raw?.starred));
  // Tags are case-insensitive (as in Obsidian). Canonicalise once here so the
  // sidebar counts, the tag scope filter and search all agree on one value.
  return {
    title,
    // The write path joins tags with commas and the UI renders one chip per entry,
    // so a repeated tag would show twice and inflate the sidebar counts. Collapse
    // duplicates after canonicalisation, keeping first-occurrence order.
    tags: [
      ...new Set(values.map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean)),
    ],
    starred:
      starredValue ??
      (starredNumber === 1 ||
        starredText === "true" ||
        starredText === "yes" ||
        starredText === "1"),
    language:
      Option.getOrElse(decodeString(raw?.language), () => "plaintext").trim() || "plaintext",
  };
}

export class FragmentLibrary {
  private readonly fragments = new Map<string, Fragment>();
  private readonly bodyIndex = new Map<string, string>();
  private readonly bodyStamps = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  private generation = 0;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly written = new Map<string, string>();
  private collectionsCache: { revision: number; names: string[] } | null = null;
  private folderExistsCache: { revision: number; exists: boolean } | null = null;
  private readonly reads = new Map<string, number>();
  // Body edits are tracked separately: a star/tag/title write also bumps the
  // file's mtime, which would otherwise make the note look newly edited.
  private readonly edited = new Map<string, number>();
  private readonly reading = new Set<string>();
  private readonly relocations = new Map<string, string>();
  private readonly retryTimers = new Set<string>();
  private readonly retryCounts = new Map<string, number>();
  // Paths whose body read failed past the retry budget: the row must not claim
  // it is still indexing forever.
  private readonly failedIndex = new Set<string>();

  constructor(
    private readonly app: App,
    private readonly settings: LibrarySettings,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): number => this.revision;
  entries = (): Fragment[] => [...this.fragments.values()];
  folder = (): string => cleanFolder(this.settings.folder) || "Fragments";
  scratchpadPath = (): string => `${this.folder()}/${SCRATCHPAD_NAME}`;
  // Whether the configured library folder exists in the vault; the sidebar
  // flags a missing folder instead of looking like an empty library. Cached per
  // revision so a re-render does not walk the vault again.
  folderExists = (): boolean => {
    if (this.folderExistsCache?.revision === this.revision) return this.folderExistsCache.exists;
    const exists = this.app.vault.getAbstractFileByPath(this.folder()) instanceof TFolder;
    this.folderExistsCache = { revision: this.revision, exists };
    return exists;
  };
  // Whether the pad file exists yet; the header must not claim it is saved
  // before the first write creates it.
  // A body whose read has not finished has no known preview; the list shows a
  // neutral state instead of claiming there is no content.
  indexing = (path: string): boolean =>
    this.reading.has(path) || (!this.bodyStamps.has(path) && !this.failedIndex.has(path));

  hasScratchpad = (): boolean =>
    this.app.vault.getAbstractFileByPath(this.scratchpadPath()) instanceof TFile;
  // An external change to the pad file must re-render the open session; the
  // fragment index is unaffected.
  scratchpadChanged = (): void => {
    this.emit();
  };
  // The body the index most recently read for a path, so callers can tell
  // whether a change they are reacting to is one they already hold.
  indexedBody = (path: string): string | undefined => this.bodyIndex.get(path);
  // An external rename moves the file; in-flight drafts and mutations addressed
  // to the old path must land on the file that now exists. Existing entries are
  // rewritten so a chain (A->B->C) never leaves A pointing at a missing path.
  relocate = (from: string, to: string): void => {
    if (from === to) {
      this.relocations.delete(from);
      return;
    }
    for (const [key, value] of this.relocations) {
      if (value === from) this.relocations.set(key, to);
    }
    this.relocations.set(from, to);
    for (const [key, value] of this.relocations) if (key === value) this.relocations.delete(key);
  };
  relocation = (path: string): string | undefined => this.relocations.get(path);
  contains = (path: string): boolean => {
    const folder = this.folder();
    return (
      path.startsWith(`${folder}/`) &&
      path.endsWith(".md") &&
      // Case-insensitive vaults resolve the case variant to the pad file.
      path.toLowerCase() !== `${folder}/${SCRATCHPAD_NAME}`.toLowerCase()
    );
  };

  // Unloading the plugin must stop an in-flight load: the generation bump makes
  // its batch loop exit and suppresses further emits.
  cancel = (): void => {
    this.generation += 1;
  };

  async load(): Promise<void> {
    const generation = ++this.generation;
    // Paths are rebuilt from scratch; stale moves from a previous folder or
    // session must not redirect writes.
    this.relocations.clear();
    // A saved setting may predate this canonicalisation (or the folder may
    // have been renamed with different case). Adopt the vault's casing when an
    // existing folder matches, so the library never silently empties.
    this.settings.folder = this.existingFolder(this.folder()) ?? this.folder();
    this.fragments.clear();
    this.written.clear();
    const files = this.app.vault.getMarkdownFiles().filter((file) => this.contains(file.path));
    // Bodies survive a reload while their file is unchanged: switching folders
    // or renaming an unrelated folder must not re-read the whole corpus.
    const present = new Set(files.map((file) => file.path));
    for (const key of this.bodyIndex.keys()) {
      if (present.has(key)) continue;
      this.bodyIndex.delete(key);
      this.bodyStamps.delete(key);
    }
    for (const file of files) this.updateMetadata(file);
    this.emit();
    const batchSize = 16;
    for (
      let offset = 0;
      offset < files.length && generation === this.generation;
      offset += batchSize
    ) {
      await Promise.all(
        files.slice(offset, offset + batchSize).map((file) => this.indexBody(file)),
      );
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    // One emit once the bodies are indexed; a per-batch emit would make the app
    // rebuild search entries, tags and collection counts for every batch.
    if (generation === this.generation) this.emit();
  }

  async refresh(file: TFile): Promise<void> {
    if (!this.contains(file.path)) return;
    // A refresh means the file changed (create/modify/rename); the mtime check
    // in indexBody is only a reload optimisation, not a change signal.
    this.bodyStamps.delete(file.path);
    // A real change deserves a fresh retry budget.
    this.failedIndex.delete(file.path);
    this.retryCounts.delete(file.path);
    this.updateMetadata(file);
    await this.indexBody(file);
    this.emit();
  }

  remove(path: string): void {
    // Obsidian emits one event for a renamed or deleted folder, not one per
    // descendant file, so evict every indexed path at or below it.
    this.collectionsCache = null;
    this.folderExistsCache = null;
    let changed = false;
    for (const key of this.fragments.keys()) {
      if (key !== path && !key.startsWith(`${path}/`)) continue;
      this.bodyIndex.delete(key);
      this.bodyStamps.delete(key);
      this.written.delete(key);
      this.failedIndex.delete(key);
      this.retryCounts.delete(key);
      // Keep the counter monotonic instead of deleting it: a read that started
      // before this removal must never match the sequence of a later read that
      // reuses the same path, or the deleted file's body would be applied to
      // the re-created one.
      this.reads.set(key, (this.reads.get(key) ?? 0) + 1);
      changed = this.fragments.delete(key) || changed;
    }
    for (const [from, to] of this.relocations) {
      if (from === path || from.startsWith(`${path}/`) || to === path || to.startsWith(`${path}/`))
        this.relocations.delete(from);
    }
    if (changed) this.emit();
  }

  async read(path: string): Promise<string> {
    // Switching back to a note must read after its queued draft saves finish.
    await this.pending.get(path)?.catch(() => undefined);
    const file = this.file(path);
    return bodyOf(await run(() => this.app.vault.cachedRead(file)));
  }

  async readScratchpad(path: string): Promise<string> {
    // Reopening the pad must read after any save queued for the same path has
    // landed, the same way read() does for a fragment body. Otherwise a fresh
    // session adopts the pre-save text as its baseline and can overwrite it.
    await this.pending.get(path)?.catch(() => undefined);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return "";
    if (!(file instanceof TFile)) throw new Error("The scratchpad path is not a Markdown file.");
    return run(() => this.app.vault.read(file));
  }

  async saveScratchpad(path: string, text: string, expected: string): Promise<void> {
    await this.queue(path, async () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) {
        if (expected) throw new Error("The scratchpad file was removed outside Fragments.");
        await this.ensureFolder(path.slice(0, path.lastIndexOf("/")));
        await run(() => this.app.vault.create(path, text));
        return;
      }
      if (!(file instanceof TFile)) throw new Error("The scratchpad path is not a Markdown file.");
      await run(() =>
        this.app.vault.process(file, (source) => {
          if (source !== expected)
            throw new Error(
              "The scratchpad changed outside Fragments. Copy your text, then reopen Fragments before saving.",
            );
          return text;
        }),
      );
    });
  }

  async create(collection = ""): Promise<string> {
    const folder = collection ? `${this.folder()}/${collection}` : this.folder();
    await this.ensureFolder(folder);
    const base = "Untitled fragment";
    let path = `${folder}/${base}.md`;
    let number = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${folder}/${base} ${number++}.md`;
    const file = await run(() =>
      this.app.vault.create(
        path,
        `---\ntitle: ${JSON.stringify(path.split("/").pop()?.slice(0, -3))}\ntags: []\nstarred: false\nlanguage: plaintext\n---\n\n`,
      ),
    );
    await this.refresh(file);
    return path;
  }

  async saveBody(path: string, body: string, expectedBody?: string): Promise<void> {
    await this.queue(path, async () => {
      const file = this.file(path);
      await run(() =>
        this.app.vault.process(file, (source) => {
          // The caller's snapshot may predate a write this library already
          // queued for the same path. Treat the body we last persisted
          // ourselves as current, so our own write is not reported as an
          // external edit.
          const current = bodyOf(source);
          if (
            expectedBody !== undefined &&
            current !== expectedBody &&
            current !== this.written.get(path)
          ) {
            throw new Error(
              "This note changed outside Fragments. Copy your draft, then reopen the note before saving.",
            );
          }
          const info = getFrontMatterInfo(source);
          const header = info.exists ? source.slice(0, info.contentStart) : "";
          // Reuse the separator the note already had. Adding one unconditionally
          // inserts a blank line into notes authored without it.
          const after = info.exists ? source.slice(info.contentStart) : "";
          const separator = after.startsWith("\r\n") ? "\r\n" : after.startsWith("\n") ? "\n" : "";
          return `${header}${separator}${body}`;
        }),
      );
      this.written.set(path, body);
      this.edited.set(path, Date.now());
      await this.refresh(file);
    });
  }

  async updateProperties(
    path: string,
    changes: { tags?: string[]; starred?: boolean; language?: string },
  ): Promise<void> {
    await this.queue(path, async () => {
      const file = this.file(path);
      const previous = this.fragments.get(path)?.modified;
      await run(() =>
        this.app.fileManager.processFrontMatter(file, (matter) => {
          const frontmatter = matter as { tags?: string[]; starred?: boolean; language?: string };
          if (changes.tags) frontmatter.tags = changes.tags;
          if (changes.starred !== undefined) frontmatter.starred = changes.starred;
          if (changes.language !== undefined) frontmatter.language = changes.language;
        }),
      );
      if (previous !== undefined) this.edited.set(path, previous);
      await this.refresh(file);
    });
  }

  async rename(path: string, title: string): Promise<string> {
    const file = this.file(path);
    const requested = title.trim();
    if (!requested) throw new Error("Enter a title.");
    const parent = file.parent?.path ?? this.folder();
    const unique = this.availableTitle(requested, path);
    const safe = safeFileName(unique);
    const next = this.availablePath(parent, safe, file);
    // Check the final, de-duplicated path: an already-taken reserved title
    // becomes "_fragments-scratchpad (1)" and cannot collide with the pad file.
    if (next.toLowerCase() === this.scratchpadPath().toLowerCase())
      throw new Error("That title is reserved for the scratchpad.");
    if (next !== path) {
      await run(() => this.app.fileManager.renameFile(file, next));
      // The file has moved, so re-index it before touching the frontmatter: a
      // rejected frontmatter write must not leave a ghost entry for the old path
      // while the renamed file stays invisible.
      this.remove(path);
      await this.refresh(file);
    }
    try {
      await run(() =>
        this.app.fileManager.processFrontMatter(file, (matter) => {
          const frontmatter = matter as { title?: string };
          frontmatter.title = unique;
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // The file already moved; report where it lives so the UI can follow it.
      throw new TitleWriteError(
        `The note was renamed, but its title was not saved: ${reason}`,
        file.path,
      );
    }
    await this.refresh(file);
    return file.path;
  }

  async move(path: string, collection: string): Promise<string> {
    const file = this.file(path);
    const folder = collection ? `${this.folder()}/${collection}` : this.folder();
    await this.ensureFolder(folder);
    const requestedPath = `${folder}/${file.name}`;
    const occupied = this.app.vault.getAbstractFileByPath(requestedPath);
    const title = this.entries().find((entry) => entry.path === path)?.title ?? file.basename;
    const unique = occupied && occupied !== file ? this.availableTitle(title, path) : title;
    const base = unique === title ? safeFileName(file.basename) : safeFileName(unique);
    const next = this.availablePath(folder, base, file);
    // Only the final path matters: a name that gets suffixed is not the pad file.
    if (next.toLowerCase() === this.scratchpadPath().toLowerCase())
      throw new Error("That filename is reserved for the scratchpad.");
    if (next === path) return path;
    await run(() => this.app.fileManager.renameFile(file, next));
    this.remove(path);
    await this.refresh(file);
    if (unique !== title) {
      try {
        await run(() =>
          this.app.fileManager.processFrontMatter(file, (matter) => {
            const frontmatter = matter as { title?: string };
            frontmatter.title = unique;
          }),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new TitleWriteError(
          `The note was moved, but its title was not saved: ${reason}`,
          file.path,
        );
      }
      await this.refresh(file);
    }
    return file.path;
  }

  async trash(path: string): Promise<void> {
    await run(() => this.app.fileManager.trashFile(this.file(path)));
    this.remove(path);
  }

  async createCollection(name: string): Promise<void> {
    // create() and move() treat a collection as a real nested path, so the
    // dialog must too: sanitise each segment instead of flattening "/" to "-".
    const segments = name
      .split("/")
      .map((segment) => segment.trim().replace(/[\\:*?"<>|]/g, "-"))
      .filter(Boolean);
    // A "." or ".." segment escapes the library root once it reaches the vault
    // API, so reject it instead of creating a traversal path.
    if (segments.some((segment) => segment === "." || segment === ".."))
      throw new Error("Collection names cannot contain “.” or “..” segments.");
    const path = segments.join("/");
    if (!path) throw new Error("Enter a collection name.");
    const target = `${this.folder()}/${path}`;
    // ensureFolder skips every existing path, including files, so a name that
    // collides with a note (or the scratchpad) would silently do nothing.
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing && !(existing instanceof TFolder))
      throw new Error("A file with that name already exists.");
    await this.ensureFolder(target);
    this.emit();
  }

  // Folder-only changes (an empty collection appearing or disappearing) touch no
  // fragment, so the collections cache must be dropped and listeners told.
  folderTreeChanged = (): void => {
    this.collectionsCache = null;
    this.folderExistsCache = null;
    this.emit();
  };

  collections(): string[] {
    // The sidebar and the collection <select> both render this list; the folder
    // tree changes far less often than the editor re-renders.
    if (this.collectionsCache?.revision === this.revision) return this.collectionsCache.names;
    const root = this.app.vault.getAbstractFileByPath(this.folder());
    if (!(root instanceof TFolder)) return [];
    const result: string[] = [];
    const visit = (folder: TFolder, prefix: string): void => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          const name = prefix ? `${prefix}/${child.name}` : child.name;
          result.push(name);
          visit(child, name);
        }
      }
    };
    visit(root, "");
    result.sort((a, b) => a.localeCompare(b));
    this.collectionsCache = { revision: this.revision, names: result };
    return result;
  }

  async changeFolder(folder: string): Promise<void> {
    const requested = cleanFolder(folder) || "Fragments";
    const existing = this.existingFolder(requested);
    if (!existing) throw new Error(`The folder “${requested}” does not exist in this vault.`);
    // Re-entering the folder that is already active (same path, different case or
    // trailing whitespace) must not clear and re-read the whole library.
    if (existing === this.settings.folder) return;
    this.settings.folder = existing;
    await this.load();
  }

  private existingFolder(folder: string): string | undefined {
    const folders = this.app.vault.getAllFolders(true);
    const exact = folders.find((entry) => entry.path === folder);
    if (exact) return exact.path;
    const lower = folder.toLowerCase();
    return folders.find((entry) => entry.path.toLowerCase() === lower)?.path;
  }

  private updateMetadata(file: TFile): void {
    const raw = this.app.metadataCache.getFileCache(file)?.frontmatter as
      | RawFrontmatter
      | undefined;
    this.fragments.set(file.path, this.fragmentFrom(file, parseMetadata(raw)));
  }

  private availableTitle(title: string, currentPath: string): string {
    const used = new Set(
      this.entries()
        .filter((entry) => entry.path !== currentPath)
        .map((entry) => entry.title),
    );
    let result = title;
    for (let counter = 1; used.has(result); counter++) result = `${title} (${counter})`;
    return result;
  }

  private availablePath(folder: string, base: string, current: TFile): string {
    let result = `${folder}/${base}.md`;
    let occupied = this.app.vault.getAbstractFileByPath(result);
    for (let counter = 1; occupied && occupied !== current; counter++) {
      result = `${folder}/${base} (${counter}).md`;
      occupied = this.app.vault.getAbstractFileByPath(result);
    }
    return result;
  }

  private fragmentFrom(file: TFile, matter: ParsedMetadata): Fragment {
    const previous = this.fragments.get(file.path);
    const collection = file.parent?.path.slice(this.folder().length).replace(/^\//, "") ?? "";
    // A blank or whitespace-only frontmatter title is not a usable name, so it
    // falls back to the file name exactly like a missing title does. Non-blank
    // titles are kept verbatim, including any surrounding spaces.
    const title = matter.title?.trim() ? matter.title : file.basename;
    return {
      path: file.path,
      title,
      collection,
      tags: matter.tags,
      starred: matter.starred,
      language: matter.language,
      modified: this.edited.get(file.path) ?? file.stat.mtime,
      preview: previous?.preview ?? "",
      searchText:
        `${title} ${collection} ${matter.tags.join(" ")} ${this.bodyIndex.get(file.path) ?? ""}`.toLowerCase(),
    };
  }

  private async indexBody(file: TFile): Promise<void> {
    const path = file.path;
    const stamp = file.stat.mtime;
    // The body only changes when the file changes; restore the derived fields
    // from the cache instead of reading and parsing the same text again.
    if (this.bodyIndex.has(path) && this.bodyStamps.get(path) === stamp) {
      const item = this.fragments.get(path);
      if (!item) return;
      const body = this.bodyIndex.get(path) ?? "";
      item.preview = plainPreview(body);
      item.searchText =
        `${item.title} ${item.collection} ${item.tags.join(" ")} ${body}`.toLowerCase();
      return;
    }
    const sequence = (this.reads.get(path) ?? 0) + 1;
    this.reads.set(path, sequence);
    this.reading.add(path);
    try {
      const body = bodyOf(await this.app.vault.cachedRead(file));
      // Reads for one path can finish out of order. Only the newest read may
      // replace the preview and the body search index.
      if (this.reads.get(path) !== sequence) return;
      const item = this.fragments.get(path);
      if (!item) return;
      this.bodyIndex.set(file.path, body);
      this.bodyStamps.set(file.path, stamp);
      this.failedIndex.delete(path);
      this.retryCounts.delete(path);
      item.preview = plainPreview(body);
      item.searchText =
        `${item.title} ${item.collection} ${item.tags.join(" ")} ${body}`.toLowerCase();
    } catch {
      // A file may disappear while the background index is reading it, or a
      // transient failure leaves the preview empty. Retry a bounded number of
      // times, then stop: a permanently unreadable file must not schedule reads
      // for the rest of the session.
      const attempts = (this.retryCounts.get(path) ?? 0) + 1;
      if (attempts > 3) {
        this.failedIndex.add(path);
        return;
      }
      this.retryCounts.set(path, attempts);
      if (this.retryTimers.has(path)) return;
      this.retryTimers.add(path);
      window.setTimeout(() => {
        this.retryTimers.delete(path);
        void this.indexBody(file);
      }, 1_000);
    } finally {
      this.reading.delete(path);
    }
  }

  // Follow recorded moves to the file that exists now, with a visited set so a
  // malformed pair can never loop.
  private resolvePath(path: string): string {
    let current = path;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const next = this.relocations.get(current);
      if (!next) return current;
      current = next;
    }
    return current;
  }

  private file(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(this.resolvePath(path));
    if (!(file instanceof TFile) || !this.contains(file.path))
      throw new Error("Fragment is no longer available.");
    return file;
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    for (let count = 1; count <= parts.length; count++) {
      const part = parts.slice(0, count).join("/");
      if (!this.app.vault.getAbstractFileByPath(part)) {
        await run(() => this.app.vault.createFolder(part));
        this.collectionsCache = null;
        this.folderExistsCache = null;
      }
    }
  }

  private async queue(path: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.pending.get(path) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.pending.set(path, current);
    try {
      await current;
    } finally {
      if (this.pending.get(path) === current) this.pending.delete(path);
    }
  }

  private emit(): void {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
}
