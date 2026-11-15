---
status: reference
scope: [fragments]
validation:
  - e2e/fragments.spec.mjs
  - tests/body-roundtrip.test.tsx
  - tests/vault-frontmatter.test.ts
  - tests/stale-read.test.tsx
  - tests/external-rename-draft.test.tsx
  - tests/scratchpad-conflict.test.tsx
  - tests/scratchpad-reload.test.tsx
  - tests/scratchpad-reservation.test.tsx
related:
  - ../standards.md
  - ./application-lifecycle.md
---

# Vault persistence

The README's published product contract makes each fragment
an ordinary Markdown note under the selected vault folder. YAML frontmatter
stores `tags`, `starred`, `language`, and an optional `title`; the Markdown body
is the fragment. These files remain editable in Obsidian or another editor.
Collections correspond to subfolders of the library folder.

The README's Use section requires Fragments to read external
file changes and avoid overwriting a note changed while a draft was open.
Edits save after a short pause and through the save command. Renames and moves
that would duplicate a fragment name choose an available suffix such as `(1)`
or `(2)`.

A local rename retains the selected file and typed title while metadata writes
settle. External renames within the configured library retain the open editor
and its draft even when that note is outside the current list filter. Neither
an intermediate indexing gap nor a late vault event authorizes switching the
editor to another note.

The scratchpad is shared across fragments and persists in
`_fragments-scratchpad.md` inside the selected library folder. It survives
closing the window and is excluded from the fragment list. That reserved
path cannot become a fragment through creation, rename, or move. External
scratchpad edits must not be silently overwritten by a pending local draft.
An external-content conflict keeps the local draft visible and fences saves
until an explicit Reload adopts the file. Reload works on its first activation,
including when the textarea blurs or earlier saves are still settling. Temporary
storage failures retain the draft and allow a later save attempt without
discarding the buffer through Reload.

The README's Development section states that no note
content leaves the vault and that Fragments has no telemetry or network calls.
The validation paths above cover storage behavior, not an automated proof
of the absence of network activity.
