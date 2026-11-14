// The bundle smoke test runs in the node environment, where none of these DOM
// patches apply; only the jsdom suites need them.
if (typeof HTMLDialogElement !== "undefined") {
  // jsdom does not implement the native dialog methods used by Obsidian's renderer.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (): void {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (): void {
      this.removeAttribute("open");
    };
  }
}

if (typeof Element !== "undefined") {
  // jsdom has no layout engine, so scrollIntoView is missing; list and search code
  // calls it to keep the highlighted row visible.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView(): void {};
  }

  // Obsidian augments DOM elements with helpers the view code relies on.
  type CreateOptions = { text?: string; cls?: string };
  type ObsidianElement = Element & {
    empty?: () => void;
    addClass?: (...classes: string[]) => void;
    removeClass?: (...classes: string[]) => void;
  };
  const proto = Element.prototype as ObsidianElement;
  proto.empty ??= function empty(this: Element): void {
    this.replaceChildren();
  };
  proto.addClass ??= function addClass(this: Element, ...classes: string[]): void {
    this.classList.add(...classes);
  };
  proto.removeClass ??= function removeClass(this: Element, ...classes: string[]): void {
    this.classList.remove(...classes);
  };
  const createEl = function createEl(
    this: Element,
    tag: string,
    options?: CreateOptions,
  ): HTMLElement {
    const element = this.ownerDocument.createElement(tag);
    if (options?.cls) element.className = options.cls;
    if (options?.text !== undefined) element.textContent = options.text;
    this.appendChild(element);
    return element;
  };
  // Obsidian's typings augment Element with overloaded helpers; the runtime
  // stubs only need the (tag, options) shape.
  const helpers = Element.prototype as unknown as Record<string, unknown>;
  helpers.createEl ??= createEl;
  helpers.createDiv ??= function createDiv(this: Element, options?: CreateOptions): HTMLElement {
    return createEl.call(this, "div", options);
  };
}
