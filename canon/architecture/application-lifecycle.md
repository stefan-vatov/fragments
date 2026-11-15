---
status: reference
scope: [fragments]
validation:
  - e2e/fragments.spec.mjs
  - tests/plugin-lifecycle.test.tsx
  - tests/popout-reuse.test.tsx
  - tests/startup-second-leaf.test.ts
  - tests/unload-flush.test.tsx
  - tests/unload-without-shell.test.ts
related:
  - ../standards.md
  - ./vault-persistence.md
---

# Application lifecycle

The README's product contract specifies a reusable app
window on desktop and a tab on mobile. Section 5 of `docs/local-testing.md`
requires checking actual window identity through view replacement and plugin
reload; counting Fragments leaves alone is insufficient evidence.

Existing lifecycle tests distinguish explicit opening from workspace restore.
Explicit opening collapses duplicate Fragments leaves. Startup restoration
keeps deliberately restored leaves, preserves their docking, and does not
steal focus. An unrelated note tab must survive opening Fragments; reusing
application space does not authorize replacing that note's view.

If a note replaces Fragments in its app window, explicitly opening Fragments
creates a sibling tab in that same window. The original note remains intact,
and plugin reload preserves the window. A replacement must not leave another
app window behind merely because its previous Fragments view no longer exists.

Existing shutdown tests require pending editor text to be flushed before
views detach. Commands queued before the editor mounts must settle if the
plugin unloads before mounting, so shutdown cannot wait forever on a command
that can no longer execute.

These are documented and tested lifecycle guarantees, not a reconstruction
of the historical decision or its rationale. Unit tests simulate the host;
real Obsidian window behavior requires the isolated interaction and identity
checks specified by the local testing guide.
