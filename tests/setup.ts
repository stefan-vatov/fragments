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
