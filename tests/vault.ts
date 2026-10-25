import type { App, MetadataCache, TFile, TFolder, Vault } from "obsidian";
import { TFolder as Folder, TFile as File } from "obsidian";

export interface TestVault {
  app: App;
  vault: TestVaultApi;
  files: Map<string, { file: TFile; text: string }>;
  trashed: Map<string, { file: TFile; text: string }>;
  addFile: (path: string, text: string, mtime?: number) => TFile;
}

export interface TestVaultApi {
  getName: () => string;
  getMarkdownFiles: () => TFile[];
  getAbstractFileByPath: (path: string) => TFile | TFolder | null;
  cachedRead: (file: TFile) => Promise<string>;
  read: (file: TFile) => Promise<string>;
  process: (file: TFile, fn: (source: string) => string) => Promise<string>;
  create: (path: string, text: string) => Promise<TFile>;
  createFolder: (path: string) => Promise<TFolder>;
  getAllFolders: (includeRoot?: boolean) => TFolder[];
}

const folderOf = (path: string): string => path.split("/").slice(0, -1).join("/");

interface FrontmatterRecord {
  [key: string]: unknown;
}

const unquote = (value: string): string =>
  (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
    ? value.slice(1, -1)
    : value;

const parseValue = (raw: string): unknown => {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => unquote(item.trim()));
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return unquote(value);
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const parseFrontmatter = (text: string): FrontmatterRecord | null => {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  const record: FrontmatterRecord = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (entry) record[entry[1]] = parseValue(entry[2]);
  }
  return record;
};

const serializeValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => String(item)).join(", ")}]`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(String(value ?? ""));
};

const withFrontmatter = (text: string, record: FrontmatterRecord): string => {
  const match = FRONTMATTER.exec(text);
  const body = match ? text.slice(match[0].length) : text;
  const header = Object.entries(record)
    .map(([key, value]) => `${key}: ${serializeValue(value)}`)
    .join("\n");
  return `---\n${header}\n---\n${body}`;
};

export function createTestVault(): TestVault {
  const files = new Map<string, { file: TFile; text: string }>();
  const trashed = new Map<string, { file: TFile; text: string }>();
  const folders = new Map<string, TFolder>();
  const root = new Folder();
  root.path = "/";

  const folder = (path: string): TFolder => {
    if (!path) return root;
    const existing = folders.get(path);
    if (existing) return existing;
    const created = new Folder();
    created.path = path;
    created.name = path.split("/").pop() ?? path;
    created.parent = folder(folderOf(path));
    created.parent.children.push(created);
    folders.set(path, created);
    return created;
  };

  const addFile = (path: string, text: string, mtime = Date.now()): TFile => {
    const file = new File();
    file.path = path;
    file.name = path.split("/").pop() ?? path;
    file.basename = file.name.replace(/\.md$/, "");
    file.parent = folder(folderOf(path));
    file.stat = { ctime: mtime, mtime, size: text.length };
    file.parent.children.push(file);
    files.set(path, { file, text });
    return file;
  };

  const vault: TestVaultApi = {
    getName: () => "Test vault",
    getMarkdownFiles: () => [...files.values()].map((entry) => entry.file),
    getAbstractFileByPath: (path) => files.get(path)?.file ?? folders.get(path) ?? null,
    cachedRead: async (file) => files.get(file.path)?.text ?? "",
    read: async (file) => files.get(file.path)?.text ?? "",
    process: async (file, fn) => {
      const entry = files.get(file.path);
      if (!entry) throw new Error("file is missing");
      entry.text = fn(entry.text);
      return entry.text;
    },
    create: async (path, text) => addFile(path, text),
    createFolder: async (path) => folder(path),
    getAllFolders: (includeRoot = false) => [...(includeRoot ? [root] : []), ...folders.values()],
  };

  const app = {
    vault: vault as unknown as Vault,
    metadataCache: {
      getFileCache: (file: TFile) => {
        const entry = files.get(file.path);
        if (!entry) return null;
        const frontmatter = parseFrontmatter(entry.text);
        return frontmatter ? { frontmatter } : null;
      },
    } as unknown as MetadataCache,
    fileManager: {
      processFrontMatter: async (file: TFile, fn: (data: FrontmatterRecord) => void) => {
        const entry = files.get(file.path);
        if (!entry) throw new Error("file is missing");
        const record = parseFrontmatter(entry.text) ?? {};
        fn(record);
        entry.text = withFrontmatter(entry.text, record);
      },
      renameFile: async (): Promise<void> => undefined,
      trashFile: async (file: TFile): Promise<void> => {
        const entry = files.get(file.path);
        if (!entry) throw new Error("file is missing");
        files.delete(file.path);
        trashed.set(file.path, entry);
        const parent = file.parent;
        if (parent) parent.children = parent.children.filter((child) => child !== file);
      },
    },
  } as unknown as App;

  return { app, vault, files, trashed, addFile };
}
