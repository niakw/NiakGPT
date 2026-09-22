# NiakGPT 0.9.114 — Project catalog recovery and single sidebar authority

## Why this release exists

A field recheck exposed two related failures that the previous diagnostics did not prove away:

- the private Project Memory vault still contained **17 Project directories**, but the root `PROJECTS.json` had been rewritten from a degraded local cache and now advertised only **one Project**;
- ChatGPT's native Projects rows could remain visibly rendered as button/list rows without canonical `/g/g-p-…` links, while the managed NiakGPT block showed only the single locally cached Project and could fall back too low in the sidebar.

The root problem was authority, not rendering polish. A partial browser cache was allowed to become the source of truth for a durable archive, and native Projects detection was too dependent on canonical hrefs or already-known managed identities.

## What changed

### Project Memory cannot shrink the vault from a partial cache

`project-memory-v132.js` now treats the private GitHub vault as a durable catalogue source when local canonical Project identities are incomplete.

- It reads the existing root `PROJECTS.json`.
- It can list the private vault's `projects/` directory through the extension service worker.
- For Project directories missing locally, it reads their `project.json` metadata and restores the canonical `g-p-*` identities into the local cache.
- The cached bootstrap now writes the **union of local Projects and retained vault Projects**, instead of blindly replacing the root catalogue with the current local subset.
- Recovered Project metadata never fabricates `indexedProjectIds` or `serverIndexedAt`; the ChatGPT server index remains the authority for freshness and canonical indexing state.

This also repairs a vault that was already reduced: the remaining per-Project directories are enough to rebuild the catalogue on the next connected 0.9.114 run.

### Native Projects are suppressed as a real section, even without href rows

`sidebar-projects-authority-v112.js` now recognizes a Projects section from its heading plus multiple structural rows/buttons and its Project controls, even when React does not expose canonical Project links on those rows.

The detection still stops at primary navigation and generic Chats boundaries, so suppressing Projects cannot swallow the normal Chats list.

### Managed Projects stay above Chats

`sidebar-projects-v121.js` now normalizes the detected Chats section to its top-level sidebar child before choosing the insertion slot. The managed Project catalogue therefore stays directly above Chats rather than falling back to a generic `after-primary-root` position when ChatGPT wraps the Chats heading in nested controls.

## Regression evidence

The new `visual-lab/project-catalog-recovery-v114.mjs` reproduces both field failures:

1. a private vault with three Project directories but a deliberately shrunk one-Project `PROJECTS.json`; it requires all three canonical Projects to return to the local cache and requires the next bootstrap to keep all three in the root catalogue;
2. a native ChatGPT Projects section made only of button/list rows with no `/g/g-p-*` hrefs; it requires the native section to be hidden as one surface, the generic Chats section to remain visible, and the NiakGPT catalogue to remain above Chats.

The release gate also keeps the existing Project Memory, field, sidebar, cross-engine, hydration and privacy checks in place.
