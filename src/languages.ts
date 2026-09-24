import hljs from "highlight.js";
import { AbstractInputSuggest, type App } from "obsidian";

export interface LanguageChoice {
  id: string;
  label: string;
  aliases: string[];
}

const languageChoices: LanguageChoice[] = [
  { id: "plaintext", label: "Plain text", aliases: ["text", "txt"] },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  ...hljs
    .listLanguages()
    .filter((id) => id !== "plaintext" && id !== "markdown")
    .map((id) => {
      const grammar = hljs.getLanguage(id);
      return { id, label: grammar?.name ?? id, aliases: grammar?.aliases ?? [] };
    })
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export function findLanguage(value: string): LanguageChoice | undefined {
  const search = value.trim().toLowerCase();
  if (!search) return languageChoices[0];
  return languageChoices.find(
    (choice) =>
      choice.id === search ||
      choice.label.toLowerCase() === search ||
      choice.aliases.some((alias) => alias.toLowerCase() === search),
  );
}

export function languageLabel(value: string): string {
  return findLanguage(value)?.label ?? value;
}

export function highlightCode(element: HTMLElement, source: string, language: string): void {
  const choice = findLanguage(language);
  element.textContent = source;
  element.removeAttribute("data-highlighted");
  element.className = "";
  if (!choice || choice.id === "plaintext" || source.length > 20_000) return;
  element.classList.add(`language-${choice.id}`);
  hljs.highlightElement(element);
}

export class LanguageSuggest extends AbstractInputSuggest<LanguageChoice> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly choose: (choice: LanguageChoice) => void,
  ) {
    super(app, input);
    this.limit = 50;
  }

  protected getSuggestions(query: string): LanguageChoice[] {
    const search = query.trim().toLowerCase();
    const starts: LanguageChoice[] = [];
    const contains: LanguageChoice[] = [];
    for (const choice of languageChoices) {
      const names = [choice.label.toLowerCase(), choice.id, ...choice.aliases];
      if (names.some((name) => name.startsWith(search))) starts.push(choice);
      else if (names.some((name) => name.includes(search))) contains.push(choice);
    }
    return [...starts, ...contains].slice(0, this.limit);
  }

  renderSuggestion(choice: LanguageChoice, element: HTMLElement): void {
    element.createDiv({ text: choice.label });
    if (choice.id !== choice.label.toLowerCase()) element.createEl("small", { text: choice.id });
  }

  selectSuggestion(choice: LanguageChoice): void {
    this.setValue(choice.label);
    this.close();
    this.choose(choice);
  }
}
