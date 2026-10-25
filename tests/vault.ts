import type { App, MetadataCache, TFile, TFolder, Vault } from "obsidian";
import { TFolder as Folder, TFile as File } from "obsidian";

export interface TestVault {
  app: App;
  vault: TestVaultApi;
  files: Map<string, { file: TFile; text: string }>;
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

export function createTestVault(): TestVault {
  const files = new Map<string, { file: TFile; text: string }>();
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
    metadataCache: { getFileCache: () => null } as unknown as MetadataCache,
    fileManager: {
      processFrontMatter: async (): Promise<void> => undefined,
      renameFile: async (): Promise<void> => undefined,
      trashFile: async (): Promise<void> => undefined,
    },
  } as unknown as App;

  return { app, vault, files, addFile };
}
