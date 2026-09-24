import {
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MarkdownRenderer, Notice, Platform } from "obsidian";
import {
  Blocks,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FilePlus2,
  Folder,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type FragmentsPlugin from "./main";
import type { FragmentsView } from "./view";
import type { Fragment, FragmentLibrary } from "./library";
import { snippetFontFamily } from "./settings";
import { findLanguage, highlightCode, languageLabel, LanguageSuggest } from "./languages";
import { indexFragments, searchFragments, type SearchScope } from "./search";

export interface ShellHandle {
  createFragment: () => Promise<void>;
  openPalette: () => void;
}

interface Props {
  plugin: FragmentsPlugin;
  view: FragmentsView;
  handle: (handle: ShellHandle | null) => void;
}

type Dialog = "palette" | "collection" | null;

const labelScope = (scope: SearchScope): string => {
  if (scope.kind === "starred") return "Starred";
  if (scope.kind === "recent") return "Recent";
  if (scope.kind === "collection") return scope.value ?? "Collection";
  if (scope.kind === "tag") return `#${scope.value}`;
  return "All Snippets";
};

const age = (modified: number): string => {
  const minutes = Math.max(0, Math.floor((Date.now() - modified) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const errorNotice = (error: Error): void => {
  new Notice(error.message);
};

function countTags(entries: Fragment[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of entries)
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20);
}

function useKeyboard(
  view: FragmentsView,
  save: () => Promise<void>,
  setDialog: (dialog: Dialog) => void,
): void {
  useEffect(() => {
    const doc = view.containerEl.ownerDocument;
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog("palette");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!(event.target instanceof HTMLElement && event.target.closest(".fragments-scratchpad")))
          void save();
      }
      if (event.key === "Escape") setDialog(null);
    };
    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [save, setDialog, view]);
}

function useDraft(library: FragmentLibrary, selected: string | null, modified: number | undefined) {
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const savedBody = useRef("");
  const loadedPath = useRef<string | null>(null);
  const pendingDraft = useRef<{ path: string; text: string } | null>(null);

  useEffect(() => {
    if (!selected) {
      setBody("");
      setDraft("");
      return undefined;
    }
    let active = true;
    void library
      .read(selected)
      .then((text) => {
        if (active && (!dirty || loadedPath.current !== selected)) {
          loadedPath.current = selected;
          savedBody.current = text;
          setBody(text);
          setDraft(text);
          setDirty(false);
          pendingDraft.current = null;
        }
      })
      .catch(errorNotice);
    return () => {
      active = false;
    };
  }, [selected, modified, library]);

  useEffect(() => {
    if (!selected || !dirty) return undefined;
    const timer = window.setTimeout(() => {
      const writing = pendingDraft.current;
      if (!writing || writing.path !== selected || writing.text !== draft) return;
      void library
        .saveBody(selected, draft, body)
        .then(() => {
          savedBody.current = draft;
          setBody(draft);
          if (pendingDraft.current === writing) {
            pendingDraft.current = null;
            setDirty(false);
          }
        })
        .catch(errorNotice);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [selected, draft, dirty, library, body]);

  useEffect(
    () => () => {
      const writing = pendingDraft.current;
      if (writing?.path === selected)
        void library.saveBody(writing.path, writing.text, savedBody.current).catch(errorNotice);
    },
    [selected, library],
  );

  const save = useCallback(
    async (notify = true) => {
      if (!selected || !dirty) return;
      try {
        await library.saveBody(selected, draft, body);
        savedBody.current = draft;
        setBody(draft);
        setDirty(false);
        pendingDraft.current = null;
        if (notify) new Notice("Fragment saved");
      } catch (error) {
        if (!notify) throw error;
        errorNotice(error as Error);
      }
    },
    [selected, dirty, library, draft, body],
  );

  const edit = (path: string, text: string): void => {
    pendingDraft.current = { path, text };
    setDraft(text);
    setDirty(true);
  };

  return { body, draft, dirty, save, edit };
}

function Preview({
  body,
  path,
  view,
  plugin,
  language,
}: {
  body: string;
  path: string;
  view: FragmentsView;
  plugin: FragmentsPlugin;
  language: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.empty();
    if (findLanguage(language)?.id === "markdown") {
      void MarkdownRenderer.render(plugin.app, body, element, path, view);
      return;
    }
    const code = element.createEl("pre").createEl("code");
    highlightCode(code, body, language);
  }, [body, path, view, plugin, language]);
  return <div className="fragments-preview markdown-rendered" ref={ref} />;
}

function HighlightedEditor({
  body,
  language,
  onChange,
}: {
  body: string;
  language: string;
  onChange: (text: string) => void;
}) {
  const pre = useRef<HTMLPreElement>(null);
  const code = useRef<HTMLElement>(null);
  useEffect(() => {
    if (code.current) highlightCode(code.current, body, language);
  }, [body, language]);
  return (
    <div className="fragments-highlight-editor">
      <pre ref={pre} aria-hidden="true">
        <code ref={code} />
      </pre>
      <textarea
        className="fragments-editor"
        aria-label="Fragment text"
        spellCheck={false}
        value={body}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (pre.current) {
            pre.current.scrollTop = event.currentTarget.scrollTop;
            pre.current.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        placeholder="Write your fragment…"
      />
    </div>
  );
}

function LanguageInput({
  item,
  library,
  plugin,
}: {
  item: Fragment;
  library: FragmentLibrary;
  plugin: FragmentsPlugin;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(languageLabel(item.language));
  const selected = useRef<string | null>(null);
  const commit = useCallback(
    (value: string) => {
      const choice = findLanguage(value);
      if (!choice) {
        setText(languageLabel(item.language));
        return;
      }
      setText(choice.label);
      if (choice.id !== item.language)
        void library.updateProperties(item.path, { language: choice.id }).catch(errorNotice);
    },
    [item.language, item.path, library],
  );
  useEffect(() => {
    if (!ref.current) return undefined;
    const suggest = new LanguageSuggest(plugin.app, ref.current, (choice) => {
      selected.current = choice.id;
      commit(choice.id);
    });
    return () => suggest.close();
  }, [plugin.app, commit]);
  return (
    <input
      ref={ref}
      aria-label="Language"
      title="Language"
      value={text}
      placeholder="Language"
      autoComplete="off"
      onChange={(event) => {
        selected.current = null;
        setText(event.target.value);
      }}
      onBlur={() => {
        if (selected.current) {
          selected.current = null;
          return;
        }
        commit(text);
      }}
    />
  );
}

function VirtualList({
  items,
  selected,
  select,
}: {
  items: Fragment[];
  selected: string | null;
  select: (path: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setHeight(node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const rowHeight = 88;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + 4);
  return (
    <div
      className="fragments-results"
      ref={viewport}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(start, end).map((item, index) => (
          <button
            key={item.path}
            className={`fragments-result ${selected === item.path ? "is-selected" : ""}`}
            style={{ top: (start + index) * rowHeight }}
            onClick={() => select(item.path)}
          >
            <span className="fragments-result-title">
              {item.title}
              {item.starred && <Star size={12} fill="currentColor" />}
            </span>
            <span className="fragments-result-preview">{item.preview || "No content yet"}</span>
            <span className="fragments-result-meta">
              <span>
                {item.tags.slice(0, 2).map((tag) => (
                  <small key={tag}>#{tag}</small>
                ))}
              </span>
              <time>{age(item.modified)}</time>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function useController({ plugin, view, handle }: Props) {
  const library = plugin.library;
  const revision = useSyncExternalStore(library.subscribe, library.snapshot);
  const entries = useMemo(() => library.entries(), [library, revision]);
  const [scope, setScope] = useState<SearchScope>({ kind: "all" });
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [newCollection, setNewCollection] = useState("");
  const [mobilePane, setMobilePane] = useState<"nav" | "list" | "editor">("list");
  const shortcut = Platform.isMacOS ? "⌘K" : "Ctrl K";
  const selectedItem = entries.find((item) => item.path === selected);
  const { body, draft, dirty, save, edit } = useDraft(
    library,
    selectedItem?.path ?? null,
    selectedItem?.modified,
  );
  const tags = useMemo(() => countTags(entries), [entries]);
  const searchIndex = useMemo(() => indexFragments(entries), [entries]);

  const filtered = useMemo(
    () => searchFragments(searchIndex, { scope, tagFilter, query, sort, includeBody: true }),
    [searchIndex, scope, tagFilter, query, sort],
  );

  useEffect(() => {
    if (selected && filtered.some((item) => item.path === selected)) return;
    setSelected(filtered[0]?.path ?? null);
  }, [selected, entries, filtered]);

  const createFragment = useCallback(async () => {
    try {
      const path = await library.create(scope.kind === "collection" ? scope.value : "");
      setScope(scope.kind === "collection" ? scope : { kind: "all" });
      setQuery("");
      setTagFilter("");
      setSelected(path);
      setMode("edit");
      setMobilePane("editor");
      setDialog(null);
      window.requestAnimationFrame(() => {
        const title = view.contentEl.querySelector<HTMLInputElement>(".fragments-title-wrap input");
        title?.focus();
        title?.select();
      });
    } catch (error) {
      errorNotice(error as Error);
    }
  }, [library, scope, view]);

  useEffect(() => {
    handle({ createFragment, openPalette: () => setDialog("palette") });
    return () => handle(null);
  }, [createFragment, handle]);

  useKeyboard(view, save, setDialog);

  useEffect(() => {
    if (dialog === "palette") {
      setPaletteQuery("");
      setPaletteIndex(0);
    }
  }, [dialog]);

  const selectScope = (next: SearchScope): void => {
    setScope(next);
    setTagFilter("");
    setQuery("");
    setMobilePane("list");
  };
  const choose = (path: string): void => {
    setSelected(path);
    setMobilePane("editor");
  };
  const chooseGlobal = (path: string): void => {
    setScope({ kind: "all" });
    setTagFilter("");
    setQuery("");
    choose(path);
  };
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(draft);
      new Notice("Copied fragment");
    } catch (error) {
      errorNotice(error as Error);
    }
  };
  const toggleStar = async (): Promise<void> => {
    if (!selectedItem) return;
    try {
      await library.updateProperties(selectedItem.path, { starred: !selectedItem.starred });
    } catch (error) {
      errorNotice(error as Error);
    }
  };
  const updateTags = async (value: string): Promise<void> => {
    if (!selectedItem) return;
    try {
      await library.updateProperties(selectedItem.path, {
        tags: value
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean),
      });
    } catch (error) {
      errorNotice(error as Error);
    }
  };
  const rename = async (value: string): Promise<void> => {
    if (!selectedItem || value.trim() === selectedItem.title) return;
    try {
      await save(false);
      setSelected(await library.rename(selectedItem.path, value));
    } catch (error) {
      errorNotice(error as Error);
    }
  };
  const move = async (value: string): Promise<void> => {
    if (!selectedItem || value === selectedItem.collection) return;
    try {
      await save(false);
      setSelected(await library.move(selectedItem.path, value));
    } catch (error) {
      errorNotice(error as Error);
    }
  };
  const trash = async (): Promise<void> => {
    if (!selectedItem || !window.confirm(`Move “${selectedItem.title}” to trash?`)) return;
    try {
      await library.trash(selectedItem.path);
      setSelected(null);
    } catch (error) {
      errorNotice(error as Error);
    }
  };

  const paletteItems = entries
    .filter((item) =>
      `${item.title} ${item.tags.join(" ")}`.toLowerCase().includes(paletteQuery.toLowerCase()),
    )
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 8);
  const choosePalette = (index: number): void => {
    const item = paletteItems[index];
    if (item) {
      choose(item.path);
      setDialog(null);
      return;
    }
    if (index === paletteItems.length) void createFragment();
  };

  return {
    plugin,
    view,
    library,
    entries,
    scope,
    selected,
    query,
    tagFilter,
    sort,
    mode,
    dialog,
    paletteQuery,
    paletteIndex,
    newCollection,
    mobilePane,
    shortcut,
    selectedItem,
    body,
    draft,
    dirty,
    tags,
    filtered,
    searchIndex,
    createFragment,
    setDialog,
    setMobilePane,
    selectScope,
    choose,
    chooseGlobal,
    setQuery,
    setTagFilter,
    setSort,
    setMode,
    copy,
    toggleStar,
    updateTags,
    rename,
    move,
    trash,
    edit,
    save,
    paletteItems,
    choosePalette,
    setPaletteQuery,
    setPaletteIndex,
    setNewCollection,
  };
}

type Controller = ReturnType<typeof useController>;
const AppContext = createContext<Controller | null>(null);
function useAppContext(): Controller {
  const context = useContext(AppContext);
  if (!context) throw new Error("Fragments app context is missing.");
  return context;
}

export function AppShell(props: Props) {
  useSyncExternalStore(props.plugin.subscribeSettings, props.plugin.settingsSnapshot);
  const controller = useController(props);
  const style = {
    "--frag-snippet-font": snippetFontFamily(controller.plugin.settings),
  } as CSSProperties;
  return (
    <AppContext.Provider value={controller}>
      <div className="fragments-app" style={style}>
        <MobileBar />
        <SidebarPane />
        <ListPane />
        <EditorPane />
        <Dialogs />
      </div>
    </AppContext.Provider>
  );
}

function MobileBar() {
  const { setMobilePane, createFragment, view } = useAppContext();
  return (
    <>
      <div className="fragments-mobile-bar">
        <button aria-label="Open navigation" onClick={() => setMobilePane("nav")}>
          <Menu size={18} />
        </button>
        <span>FRAGMENTS</span>
        <button
          aria-label="Search all fragments"
          onClick={() => {
            setMobilePane("editor");
            window.requestAnimationFrame(() => {
              view.contentEl
                .querySelector<HTMLInputElement>(".fragments-global-search input")
                ?.focus();
            });
          }}
        >
          <Search size={18} />
        </button>
        <button aria-label="New fragment" onClick={() => void createFragment()}>
          <Plus size={18} />
        </button>
      </div>
    </>
  );
}

function SidebarPane() {
  const {
    mobilePane,
    shortcut,
    setDialog,
    createFragment,
    scope,
    selectScope,
    entries,
    library,
    tags,
    plugin,
  } = useAppContext();
  return (
    <>
      <aside className={`fragments-sidebar ${mobilePane === "nav" ? "mobile-active" : ""}`}>
        <header className="fragments-brand">
          <div>
            <span className="fragments-brand-mark">F</span>
            <strong>FRAGMENTS</strong>
          </div>
          <button title="Search commands" onClick={() => setDialog("palette")}>
            <kbd>{shortcut}</kbd>
          </button>
        </header>
        <button className="fragments-primary fragments-new" onClick={() => void createFragment()}>
          <Plus size={15} /> New Snippet
        </button>
        <nav className="fragments-navigation" aria-label="Fragments navigation">
          <p className="fragments-section-label">Quick Access</p>
          <button
            className={scope.kind === "all" ? "active" : ""}
            onClick={() => selectScope({ kind: "all" })}
          >
            <Blocks size={14} />
            <span>All Snippets</span>
            <small>{entries.length}</small>
          </button>
          <button
            className={scope.kind === "starred" ? "active" : ""}
            onClick={() => selectScope({ kind: "starred" })}
          >
            <Star size={14} />
            <span>Starred</span>
            <small>{entries.filter((item) => item.starred).length}</small>
          </button>
          <button
            className={scope.kind === "recent" ? "active" : ""}
            onClick={() => selectScope({ kind: "recent" })}
          >
            <Clock3 size={14} />
            <span>Recent</span>
          </button>
          <div className="fragments-section-heading">
            <p className="fragments-section-label">Collections</p>
            <button title="New collection" onClick={() => setDialog("collection")}>
              <Plus size={14} />
            </button>
          </div>
          {library.collections().map((collection) => (
            <button
              key={collection}
              className={scope.kind === "collection" && scope.value === collection ? "active" : ""}
              onClick={() => selectScope({ kind: "collection", value: collection })}
            >
              <Folder size={14} />
              <span>{collection}</span>
              <small>
                {
                  entries.filter(
                    (item) =>
                      item.collection === collection ||
                      item.collection.startsWith(`${collection}/`),
                  ).length
                }
              </small>
            </button>
          ))}
          <div className="fragments-section-heading">
            <p className="fragments-section-label">Tags</p>
            <ChevronDown size={13} />
          </div>
          {tags.map(([tag, count]) => (
            <button
              key={tag}
              className={scope.kind === "tag" && scope.value === tag ? "active" : ""}
              onClick={() => selectScope({ kind: "tag", value: tag })}
            >
              <Tag size={13} />
              <span>#{tag}</span>
              <small>{count}</small>
            </button>
          ))}
        </nav>
        <footer className="fragments-sidebar-footer">
          <span className="fragments-vault-name" title={plugin.app.vault.getName()}>
            Vault · {plugin.app.vault.getName()}
          </span>
        </footer>
      </aside>
    </>
  );
}

function ListPane() {
  const {
    mobilePane,
    query,
    setQuery,
    scope,
    tagFilter,
    setTagFilter,
    tags,
    filtered,
    sort,
    setSort,
    selected,
    choose,
    createFragment,
  } = useAppContext();
  return (
    <>
      <section className={`fragments-list-pane ${mobilePane === "list" ? "mobile-active" : ""}`}>
        <header className="fragments-list-header">
          <div className="fragments-search">
            <Search size={15} />
            <input
              aria-label="Search fragments"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search in ${labelScope(scope)}…`}
            />
          </div>
          <div className="fragments-filter-row">
            <button className={!tagFilter ? "active" : ""} onClick={() => setTagFilter("")}>
              All
            </button>
            {tags.slice(0, 5).map(([tag]) => (
              <button
                key={tag}
                className={tagFilter === tag ? "active" : ""}
                onClick={() => setTagFilter(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="fragments-list-summary">
            <span>{filtered.length.toLocaleString()} snippets</span>
            <button onClick={() => setSort(sort === "recent" ? "name" : "recent")}>
              {sort === "recent" ? "Recent" : "Name"} <ChevronDown size={11} />
            </button>
          </div>
        </header>
        {filtered.length ? (
          <VirtualList items={filtered} selected={selected} select={choose} />
        ) : (
          <div className="fragments-empty">
            No fragments found.
            <button onClick={() => void createFragment()}>Create a fragment</button>
          </div>
        )}
      </section>
    </>
  );
}

function ScratchpadToggle({ open, toggle }: { open: boolean; toggle: () => void }) {
  return (
    <button
      className={`fragments-scratch-toggle ${open ? "mode-active" : ""}`}
      aria-label={open ? "Hide scratchpad" : "Show scratchpad"}
      aria-pressed={open}
      title={open ? "Hide scratchpad" : "Show scratchpad"}
      onClick={toggle}
    >
      {open ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
    </button>
  );
}

type ScratchpadStatus = "loading" | "dirty" | "saving" | "saved" | "error";

interface ScratchpadSession {
  path: string;
  text: string;
  saved: string;
  ready: boolean;
  conflicted: boolean;
  pending: Promise<void>;
  timer?: number;
}

function useScratchpad(library: FragmentLibrary, path: string) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<ScratchpadStatus>("loading");
  const session = useRef<ScratchpadSession | null>(null);

  const flush = useCallback(
    (current: ScratchpadSession) => {
      if (current.timer !== undefined) window.clearTimeout(current.timer);
      current.timer = undefined;
      if (!current.ready || current.conflicted) return;
      const next = current.text;
      current.pending = current.pending
        .then(async () => {
          if (current.conflicted || next === current.saved) return;
          if (session.current === current) setStatus("saving");
          await library.saveScratchpad(current.path, next, current.saved);
          current.saved = next;
          if (session.current === current)
            setStatus(current.text === current.saved ? "saved" : "dirty");
        })
        .catch((error: Error) => {
          current.conflicted = true;
          if (session.current === current) {
            setStatus("error");
            errorNotice(error);
          }
        });
    },
    [library],
  );

  useEffect(() => {
    const current: ScratchpadSession = {
      path,
      text: "",
      saved: "",
      ready: false,
      conflicted: false,
      pending: Promise.resolve(),
    };
    session.current = current;
    setText("");
    setStatus("loading");
    let active = true;
    void library
      .readScratchpad(path)
      .then((loaded) => {
        if (!active) return;
        current.text = loaded;
        current.saved = loaded;
        current.ready = true;
        setText(loaded);
        setStatus("saved");
      })
      .catch((error: Error) => {
        if (!active) return;
        setStatus("error");
        errorNotice(error);
      });
    return () => {
      active = false;
      flush(current);
      if (session.current === current) session.current = null;
    };
  }, [library, path, flush]);

  const editScratchpad = (value: string): void => {
    const current = session.current;
    if (!current?.ready) return;
    current.text = value;
    setText(value);
    if (current.conflicted) return;
    setStatus("dirty");
    if (current.timer !== undefined) window.clearTimeout(current.timer);
    current.timer = window.setTimeout(() => flush(current), 500);
  };

  const saveScratchpad = (): void => {
    if (session.current) flush(session.current);
  };

  return {
    text: session.current?.path === path ? text : "",
    status: session.current?.path === path ? status : "loading",
    editScratchpad,
    saveScratchpad,
  };
}

const scratchpadStatusText: Record<ScratchpadStatus, string> = {
  loading: "Loading…",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved in vault",
  error: "Could not save",
};

function Scratchpad({
  text,
  status,
  onChange,
  onSave,
}: {
  text: string;
  status: ScratchpadStatus;
  onChange: (text: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="fragments-scratchpad" aria-label="Scratchpad">
      <header className="fragments-scratchpad-header">
        <strong>Scratchpad</strong>
        <span aria-live="polite" data-status={status}>
          {scratchpadStatusText[status]}
        </span>
      </header>
      <textarea
        className="fragments-scratchpad-editor"
        aria-label="Scratchpad text"
        spellCheck={false}
        disabled={status === "loading"}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSave}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            event.stopPropagation();
            onSave();
          }
        }}
        placeholder="Type or paste here…"
      />
    </section>
  );
}

function FragmentFooter() {
  const { draft, dirty, selectedItem, save } = useAppContext();
  if (!selectedItem) return null;
  return (
    <footer className="fragments-editor-footer">
      <span>
        {draft.length.toLocaleString()} chars ·{" "}
        {draft.trim() ? draft.trim().split(/\s+/).length : 0} words
      </span>
      <span>{dirty ? "Unsaved changes" : `Last edited ${age(selectedItem.modified)}`}</span>
      <button disabled={!dirty} onClick={() => void save()}>
        {dirty ? "Save changes" : "Saved"}
      </button>
    </footer>
  );
}

function GlobalSearch() {
  const { searchIndex, chooseGlobal, view } = useAppContext();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => (query.trim() ? searchFragments(searchIndex, { query, limit: 12 }) : []),
    [searchIndex, query],
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const doc = view.containerEl.ownerDocument;
    doc.addEventListener("pointerdown", closeOutside);
    return () => doc.removeEventListener("pointerdown", closeOutside);
  }, [open, view]);

  useEffect(() => {
    if (open)
      root.current
        ?.querySelector(`#fragments-global-result-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, query]);

  const select = (path: string): void => {
    chooseGlobal(path);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="fragments-global-search" ref={root}>
      <Search size={15} aria-hidden="true" />
      <input
        ref={input}
        role="combobox"
        aria-label="Search all fragments by title or tag"
        aria-autocomplete="list"
        aria-expanded={open && Boolean(query.trim())}
        aria-controls={open && query.trim() ? "fragments-global-results" : undefined}
        aria-activedescendant={
          open && results[active] ? `fragments-global-result-${active}` : undefined
        }
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value.slice(0, 100));
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (event.key === "Home" && results.length) {
            event.preventDefault();
            setActive(0);
          } else if (event.key === "End" && results.length) {
            event.preventDefault();
            setActive(results.length - 1);
          } else if (event.key === "Enter" && results[active]) {
            event.preventDefault();
            select(results[active].path);
          } else if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
            input.current?.blur();
          }
        }}
        placeholder="Search all fragments…"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear global search"
          onClick={() => {
            setQuery("");
            input.current?.focus();
          }}
        >
          <X size={13} />
        </button>
      )}
      {open && query.trim() && (
        <div className="fragments-global-results" id="fragments-global-results" role="listbox">
          <div className="fragments-global-results-label">All fragments · titles and tags</div>
          {results.length ? (
            results.map((fragment, resultIndex) => (
              <button
                id={`fragments-global-result-${resultIndex}`}
                role="option"
                aria-selected={resultIndex === active}
                className={resultIndex === active ? "is-active" : ""}
                key={fragment.path}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(resultIndex)}
                onClick={() => select(fragment.path)}
              >
                <span className="fragments-global-result-title">{fragment.title}</span>
                <span className="fragments-global-result-detail">
                  {fragment.collection || "All Snippets"}
                  {fragment.tags.length > 0 &&
                    ` · ${fragment.tags.map((tag) => `#${tag}`).join(" ")}`}
                </span>
              </button>
            ))
          ) : (
            <p className="fragments-global-no-results">No matching titles or tags</p>
          )}
          {results.length > 0 && (
            <div className="fragments-global-results-hint" aria-hidden="true">
              ↑ ↓ Navigate · Enter Open · Esc Close
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditorToolbar({
  scratchOpen,
  toggleScratchpad,
}: {
  scratchOpen: boolean;
  toggleScratchpad: () => void;
}) {
  const { selectedItem, setMobilePane, rename, toggleStar, mode, setMode, copy, trash } =
    useAppContext();
  return (
    <header className="fragments-editor-header">
      <button
        className="fragments-back"
        aria-label="Back to fragment list"
        title="Back to fragment list"
        onClick={() => setMobilePane("list")}
      >
        <ChevronRight size={17} />
      </button>
      {selectedItem ? (
        <>
          <div className="fragments-title-wrap">
            <input
              key={`${selectedItem.path}:${selectedItem.title}`}
              aria-label="Fragment title"
              defaultValue={selectedItem.title}
              onBlur={(event) => void rename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <small>{selectedItem.collection || "All Snippets"}</small>
          </div>
          <GlobalSearch />
          <button
            className={selectedItem.starred ? "starred" : ""}
            aria-label={selectedItem.starred ? "Unstar fragment" : "Star fragment"}
            title="Star fragment"
            onClick={() => void toggleStar()}
          >
            <Star size={17} fill={selectedItem.starred ? "currentColor" : "none"} />
          </button>
          <button
            className={mode === "edit" ? "mode-active" : ""}
            aria-label="Edit fragment"
            aria-pressed={mode === "edit"}
            title="Edit"
            onClick={() => setMode("edit")}
          >
            <Pencil size={16} />
          </button>
          <button
            className={mode === "preview" ? "mode-active" : ""}
            aria-label="Preview fragment"
            aria-pressed={mode === "preview"}
            title="Preview"
            onClick={() => setMode("preview")}
          >
            <Eye size={17} />
          </button>
          <ScratchpadToggle open={scratchOpen} toggle={toggleScratchpad} />
          <button
            className="fragments-primary fragments-copy"
            aria-label="Copy fragment"
            title="Copy fragment"
            onClick={() => void copy()}
          >
            <Copy size={16} />
          </button>
          <button title="Move to trash" onClick={() => void trash()}>
            <Trash2 size={16} />
          </button>
        </>
      ) : (
        <>
          <div className="fragments-title-wrap">
            <strong>Fragments</strong>
            <small>All Snippets</small>
          </div>
          <GlobalSearch />
        </>
      )}
    </header>
  );
}

function EditorPane() {
  const {
    mobilePane,
    selectedItem,
    mode,
    updateTags,
    move,
    library,
    draft,
    dirty,
    body,
    edit,
    view,
    plugin,
    createFragment,
  } = useAppContext();
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [scratchOpen, setScratchOpen] = useState(true);
  const {
    text: scratchText,
    status: scratchStatus,
    editScratchpad,
    saveScratchpad,
  } = useScratchpad(library, library.scratchpadPath());
  const cancelTags = useRef(false);
  useEffect(() => setEditingTags(false), [selectedItem?.path]);
  const finishTags = (): void => {
    if (!cancelTags.current) void updateTags(tagDraft);
    cancelTags.current = false;
    setEditingTags(false);
  };
  return (
    <>
      <main className={`fragments-editor-pane ${mobilePane === "editor" ? "mobile-active" : ""}`}>
        <EditorToolbar
          scratchOpen={scratchOpen}
          toggleScratchpad={() => setScratchOpen((open) => !open)}
        />
        {selectedItem ? (
          <>
            <div className={`fragments-editor-workspace ${scratchOpen ? "has-scratchpad" : ""}`}>
              <div className="fragments-fragment-content">
                <div className="fragments-properties">
                  <select
                    aria-label="Collection"
                    value={selectedItem.collection}
                    onChange={(event) => void move(event.target.value)}
                  >
                    <option value="">No collection</option>
                    {library.collections().map((collection) => (
                      <option key={collection} value={collection}>
                        {collection}
                      </option>
                    ))}
                  </select>
                  <LanguageInput
                    key={`${selectedItem.path}:${selectedItem.language}`}
                    item={selectedItem}
                    library={library}
                    plugin={plugin}
                  />
                  <div
                    className={`fragments-tags ${selectedItem.tags.length || editingTags ? "has-tags" : ""}`}
                  >
                    {selectedItem.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                    {editingTags ? (
                      <input
                        className="fragments-tag-input"
                        aria-label="Edit tags"
                        autoFocus
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        onBlur={finishTags}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") {
                            cancelTags.current = true;
                            event.currentTarget.blur();
                            event.stopPropagation();
                          }
                        }}
                        placeholder="tag, tag"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setTagDraft(selectedItem.tags.join(", "));
                          setEditingTags(true);
                        }}
                      >
                        + tag
                      </button>
                    )}
                  </div>
                </div>
                {mode === "edit" ? (
                  <HighlightedEditor
                    body={draft}
                    language={selectedItem.language}
                    onChange={(text) => edit(selectedItem.path, text)}
                  />
                ) : (
                  <Preview
                    body={dirty ? draft : body}
                    path={selectedItem.path}
                    view={view}
                    plugin={plugin}
                    language={selectedItem.language}
                  />
                )}
                <FragmentFooter />
              </div>
              {scratchOpen && (
                <Scratchpad
                  text={scratchText}
                  status={scratchStatus}
                  onChange={editScratchpad}
                  onSave={saveScratchpad}
                />
              )}
            </div>
          </>
        ) : (
          <div className="fragments-welcome">
            <FilePlus2 size={32} />
            <h2>Your fragment library</h2>
            <p>Choose a fragment or create one to begin.</p>
            <button className="fragments-primary" onClick={() => void createFragment()}>
              New Snippet
            </button>
          </div>
        )}
      </main>
    </>
  );
}

function Dialogs() {
  const {
    dialog,
    setDialog,
    paletteQuery,
    setPaletteQuery,
    setPaletteIndex,
    paletteIndex,
    paletteItems,
    choosePalette,
    createFragment,
    newCollection,
    setNewCollection,
    library,
  } = useAppContext();
  return (
    <>
      {dialog && (
        <div
          className="fragments-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          {dialog === "palette" && (
            <div className="fragments-palette" role="dialog" aria-label="Command palette">
              <div className="fragments-palette-search">
                <Search size={19} />
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={(event) => {
                    setPaletteQuery(event.target.value);
                    setPaletteIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setPaletteIndex(Math.min(paletteIndex + 1, paletteItems.length));
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setPaletteIndex(Math.max(paletteIndex - 1, 0));
                    }
                    if (event.key === "Enter") choosePalette(paletteIndex);
                  }}
                  placeholder="Type a command or search…"
                />
              </div>
              <p>Recent snippets</p>
              {paletteItems.map((item, index) => (
                <button
                  className={paletteIndex === index ? "active" : ""}
                  key={item.path}
                  onClick={() => choosePalette(index)}
                >
                  <FilePlus2 size={15} />
                  <span>{item.title}</span>
                  <small>{item.tags[0] ? `#${item.tags[0]}` : ""}</small>
                </button>
              ))}
              <p>Commands</p>
              <button
                className={paletteIndex === paletteItems.length ? "active" : ""}
                onClick={() => void createFragment()}
              >
                <Plus size={15} />
                <span>New snippet</span>
              </button>
            </div>
          )}
          {dialog === "collection" && (
            <div className="fragments-small-dialog" role="dialog" aria-label="New collection">
              <header>
                <h2>New collection</h2>
                <button onClick={() => setDialog(null)}>
                  <X size={17} />
                </button>
              </header>
              <input
                autoFocus
                value={newCollection}
                onChange={(event) => setNewCollection(event.target.value)}
                placeholder="Collection name"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.form?.requestSubmit();
                }}
              />
              <button
                className="fragments-primary"
                onClick={() => {
                  void library
                    .createCollection(newCollection)
                    .then(() => {
                      setNewCollection("");
                      setDialog(null);
                    })
                    .catch(errorNotice);
                }}
              >
                Create collection
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
