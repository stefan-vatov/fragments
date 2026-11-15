---
status: normative
scope: [fragments]
validation:
  - scripts/run-e2e.mjs
  - tests/e2e-paths.test.ts
  - .github/workflows/e2e.yml
related:
  - ./architecture/vault-persistence.md
  - ./architecture/application-lifecycle.md
---

# Repository standards

The human-authored Fragments agent notes in `AGENTS.md`
govern local testing and protection of the user's running Obsidian and vaults.
Read the local testing guide, `docs/local-testing.md`, before launching
Obsidian. Its isolated vault/profile, isolated display, session reuse,
interaction evidence, window-identity verification, and cleanup requirements
remain required; unit tests and a successful plugin load do not establish
that the rendered interface works.

Automated Linux UI testing uses a test-owned virtual display, isolated from the
user's X11 and Wayland sessions; a supported Ozone headless backend is an
alternative. Native macOS UI testing uses a dedicated GUI test runner or login
session. Never silently launch tests on, or fall back to, the user's normal
desktop. Visible testing in the user's session requires an explicit user request.
The user's normal Obsidian processes and vaults must remain untouched.

Use an isolated build destination for automated validation, including
`pnpm run check`, as required by the agent notes. The shared development
workbench is not disposable. Operational commands belong in the testing guide.

The published release policy in the README's Releases section requires Conventional
Commits on `main`: fixes produce patches, features produce minor releases,
and breaking changes produce major releases. Release artifacts must keep
the package and Obsidian versions aligned and include the plugin manifest,
JavaScript bundle, and stylesheet. This page adds no new release procedure.
