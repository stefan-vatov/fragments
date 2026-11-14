// jsdom does not implement the native dialog methods used by Obsidian's renderer.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (): void {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (): void {
    this.removeAttribute("open");
  };
}

// jsdom has no layout engine, so scrollIntoView is missing; list and search code
// calls it to keep the highlighted row visible.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// Obsidian augments DOM elements with helpers the view code relies on.
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
