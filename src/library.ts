import { Effect, Option, Schema } from "effect";
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
const run = <A>(operation: () => Promise<A>): Promise<A> =>
  Effect.runPromise(Effect.tryPromise(operation));
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
  const values = Schema.is(Schema.String)(tagValue) ? tagValue.split(/[,\s]+/) : tagValue;
  const title = Option.getOrUndefined(decodeString(raw?.title));
  return {
    title,
    tags: values.map((tag) => tag.replace(/^#/, "")).filter(Boolean),
    starred: Option.getOrElse(decodeBoolean(raw?.starred), () => false),
    language: Option.getOrElse(decodeString(raw?.language), () => ""),
  };
}

export class FragmentLibrary {
  private readonly fragments = new Map<string, Fragment>();
  private readonly bodyIndex = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  private generation = 0;
  private readonly pending = new Map<string, Promise<void>>();

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
  contains = (path: string): boolean =>
    path.startsWith(`${this.folder()}/`) && path.endsWith(".md");

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.fragments.clear();
    this.bodyIndex.clear();
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
    this.bodyIndex.delete(path);
    if (this.fragments.delete(path)) this.emit();
  }

  async read(path: string): Promise<string> {
    const file = this.file(path);
    return bodyOf(await run(() => this.app.vault.cachedRead(file)));
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
        `---\ntitle: ${JSON.stringify(path.split("/").pop()?.slice(0, -3))}\ntags: []\nstarred: false\n---\n\n`,
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
          if (expectedBody !== undefined && bodyOf(source) !== expectedBody) {
            throw new Error(
              "This note changed outside Fragments. Copy your draft, then reopen the note before saving.",
            );
          }
          const info = getFrontMatterInfo(source);
          const header = info.exists ? source.slice(0, info.contentStart) : "";
          return `${header}${header ? "\n" : ""}${body}`;
        }),
      );
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
    const safe = title.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!safe) throw new Error("Enter a title.");
    const next = `${file.parent?.path}/${safe}.md`;
    if (next !== path && this.app.vault.getAbstractFileByPath(next))
      throw new Error("A fragment with that title already exists.");
    await run(() => this.app.fileManager.renameFile(file, next));
    await run(() =>
      this.app.fileManager.processFrontMatter(file, (matter) => {
        const frontmatter = matter as { title?: string };
        frontmatter.title = title.trim();
      }),
    );
    this.remove(path);
    await this.refresh(file);
    return file.path;
  }

  async move(path: string, collection: string): Promise<string> {
    const file = this.file(path);
    const folder = collection ? `${this.folder()}/${collection}` : this.folder();
    await this.ensureFolder(folder);
    const next = `${folder}/${file.name}`;
    if (next !== path && this.app.vault.getAbstractFileByPath(next))
      throw new Error("A fragment with that title already exists there.");
    await run(() => this.app.fileManager.renameFile(file, next));
    this.remove(path);
    await this.refresh(file);
    return file.path;
  }

  async trash(path: string): Promise<void> {
    await run(() => this.app.fileManager.trashFile(this.file(path)));
    this.remove(path);
  }

  async createCollection(name: string): Promise<void> {
    const safe = name.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!safe) throw new Error("Enter a collection name.");
    await this.ensureFolder(`${this.folder()}/${safe}`);
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
    this.settings.folder = cleanFolder(folder) || "Fragments";
    await this.load();
  }

  private updateMetadata(file: TFile): void {
    const raw = this.app.metadataCache.getFileCache(file)?.frontmatter as
      | RawFrontmatter
      | undefined;
    this.fragments.set(file.path, this.fragmentFrom(file, parseMetadata(raw)));
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
    try {
      const body = bodyOf(await this.app.vault.cachedRead(file));
      const item = this.fragments.get(file.path);
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
