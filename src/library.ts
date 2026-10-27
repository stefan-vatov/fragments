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

const SCRATCHPAD_NAME = "_fragments-scratchpad.md";

const cleanFolder = (folder: string): string =>
  normalizePath(folder.trim()).replace(/^\/+|\/+$/g, "");
const bodyOf = (source: string): string => {
  const info = getFrontMatterInfo(source);
  return info.exists ? source.slice(info.contentStart).replace(/^\r?\n/, "") : source;
};
const plainPreview = (body: string): string =>
  body
    .replace(/[#*_`>[\]]/g, "")
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
const decodeTags = Schema.decodeUnknownOption(
  Schema.Union(Schema.Array(Schema.String), Schema.String),
);

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
  const tagValue = Option.getOrElse(decodeTags(raw?.tags), () => [] as string[]);
  // Split scalar tags on commas only: the write path joins tags with commas, so
  // whitespace must stay inside a tag for the round-trip to be lossless.
  const values = Schema.is(Schema.String)(tagValue) ? tagValue.split(",") : tagValue;
  const title = Option.getOrUndefined(decodeString(raw?.title));
  // Tags are case-insensitive (as in Obsidian). Canonicalise once here so the
  // sidebar counts, the tag scope filter and search all agree on one value.
  return {
    title,
    tags: values.map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean),
    starred: Option.getOrElse(decodeBoolean(raw?.starred), () => false),
    language:
      Option.getOrElse(decodeString(raw?.language), () => "plaintext").trim() || "plaintext",
  };
}

export class FragmentLibrary {
  private readonly fragments = new Map<string, Fragment>();
  private readonly bodyIndex = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  private generation = 0;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly written = new Map<string, string>();
  private readonly reads = new Map<string, number>();

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
  contains = (path: string): boolean => {
    const folder = this.folder();
    return (
      path.startsWith(`${folder}/`) &&
      path.endsWith(".md") &&
      path !== `${folder}/${SCRATCHPAD_NAME}`
    );
  };

  async load(): Promise<void> {
    const generation = ++this.generation;
    // A saved setting may predate this canonicalisation (or the folder may
    // have been renamed with different case). Adopt the vault's casing when an
    // existing folder matches, so the library never silently empties.
    this.settings.folder = this.existingFolder(this.folder()) ?? this.folder();
    this.fragments.clear();
    this.bodyIndex.clear();
    this.written.clear();
    const files = this.app.vault.getMarkdownFiles().filter((file) => this.contains(file.path));
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
      if (
        generation === this.generation &&
        (offset % 64 === 0 || offset + batchSize >= files.length)
      )
        this.emit();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  async refresh(file: TFile): Promise<void> {
    if (!this.contains(file.path)) return;
    this.updateMetadata(file);
    await this.indexBody(file);
    this.emit();
  }

  remove(path: string): void {
    // Obsidian emits one event for a renamed or deleted folder, not one per
    // descendant file, so evict every indexed path at or below it.
    let changed = false;
    for (const key of this.fragments.keys()) {
      if (key !== path && !key.startsWith(`${path}/`)) continue;
      this.bodyIndex.delete(key);
      this.written.delete(key);
      this.reads.delete(key);
      changed = this.fragments.delete(key) || changed;
    }
    if (changed) this.emit();
  }

  async read(path: string): Promise<string> {
    const file = this.file(path);
    return bodyOf(await run(() => this.app.vault.cachedRead(file)));
  }

  async readScratchpad(path: string): Promise<string> {
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
          return `${header}${header ? "\n" : ""}${body}`;
        }),
      );
      this.written.set(path, body);
      await this.refresh(file);
    });
  }

  async updateProperties(
    path: string,
    changes: { tags?: string[]; starred?: boolean; language?: string },
  ): Promise<void> {
    await this.queue(path, async () => {
      const file = this.file(path);
      await run(() =>
        this.app.fileManager.processFrontMatter(file, (matter) => {
          const frontmatter = matter as { tags?: string[]; starred?: boolean; language?: string };
          if (changes.tags) frontmatter.tags = changes.tags;
          if (changes.starred !== undefined) frontmatter.starred = changes.starred;
          if (changes.language !== undefined) frontmatter.language = changes.language;
        }),
      );
      await this.refresh(file);
    });
  }

  async rename(path: string, title: string): Promise<string> {
    const file = this.file(path);
    const requested = title.trim();
    if (!requested) throw new Error("Enter a title.");
    const parent = file.parent?.path ?? this.folder();
    const requestedPath = `${parent}/${requested.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    if (requestedPath === this.scratchpadPath())
      throw new Error("That title is reserved for the scratchpad.");
    const unique = this.availableTitle(requested, path);
    const safe = unique.replace(/[\\/:*?"<>|]/g, "-");
    const next = this.availablePath(parent, safe, file);
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
      throw new Error(`The note was renamed, but its title was not saved: ${reason}`, {
        cause: error,
      });
    }
    await this.refresh(file);
    return file.path;
  }

  async move(path: string, collection: string): Promise<string> {
    const file = this.file(path);
    const folder = collection ? `${this.folder()}/${collection}` : this.folder();
    await this.ensureFolder(folder);
    const requestedPath = `${folder}/${file.name}`;
    if (requestedPath === this.scratchpadPath())
      throw new Error("That filename is reserved for the scratchpad.");
    const occupied = this.app.vault.getAbstractFileByPath(requestedPath);
    const title = this.entries().find((entry) => entry.path === path)?.title ?? file.basename;
    const unique = occupied && occupied !== file ? this.availableTitle(title, path) : title;
    const base = unique === title ? file.basename : unique.replace(/[\\/:*?"<>|]/g, "-");
    const next = this.availablePath(folder, base, file);
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
        throw new Error(`The note was moved, but its title was not saved: ${reason}`, {
          cause: error,
        });
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
    const path = name
      .split("/")
      .map((segment) => segment.trim().replace(/[\\:*?"<>|]/g, "-"))
      .filter(Boolean)
      .join("/");
    if (!path) throw new Error("Enter a collection name.");
    await this.ensureFolder(`${this.folder()}/${path}`);
    this.emit();
  }

  collections(): string[] {
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
    return result.sort((a, b) => a.localeCompare(b));
  }

  async changeFolder(folder: string): Promise<void> {
    const requested = cleanFolder(folder) || "Fragments";
    const existing = this.existingFolder(requested);
    if (!existing) throw new Error(`The folder “${requested}” does not exist in this vault.`);
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
    const title = matter.title ?? file.basename;
    return {
      path: file.path,
      title,
      collection,
      tags: matter.tags,
      starred: matter.starred,
      language: matter.language,
      modified: file.stat.mtime,
      preview: previous?.preview ?? "",
      searchText:
        `${title} ${collection} ${matter.tags.join(" ")} ${this.bodyIndex.get(file.path) ?? ""}`.toLowerCase(),
    };
  }

  private async indexBody(file: TFile): Promise<void> {
    const path = file.path;
    const sequence = (this.reads.get(path) ?? 0) + 1;
    this.reads.set(path, sequence);
    try {
      const body = bodyOf(await this.app.vault.cachedRead(file));
      // Reads for one path can finish out of order. Only the newest read may
      // replace the preview and the body search index.
      if (this.reads.get(path) !== sequence) return;
      const item = this.fragments.get(path);
      if (!item) return;
      this.bodyIndex.set(file.path, body);
      item.preview = plainPreview(body);
      item.searchText =
        `${item.title} ${item.collection} ${item.tags.join(" ")} ${body}`.toLowerCase();
    } catch {
      // A file may disappear while the background index is reading it.
    }
  }

  private file(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || !this.contains(file.path))
      throw new Error("Fragment is no longer available.");
    return file;
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    for (let count = 1; count <= parts.length; count++) {
      const part = parts.slice(0, count).join("/");
      if (!this.app.vault.getAbstractFileByPath(part))
        await run(() => this.app.vault.createFolder(part));
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
