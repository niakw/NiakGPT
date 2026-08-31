# NiakGPT 0.9.88 — Field regression hotfix

## Why this release exists

0.9.87 passed its synthetic gates but the authenticated field report still showed the same three requirements failing together: Pins could coexist with or land relative to the wrong native Projects subtree, ChatGPT could still show verification/network disruption while NiakGPT was present, and a connected GitHub vault could remain without Project files.

0.9.88 treats that field evidence as release-blocking.

## Safety boundary

While a visible ChatGPT conversation exists in the current tab or another visible ChatGPT tab/window, NiakGPT emits **zero ChatGPT-backend traffic** through its broker. This includes foreground Project reads and NiakGPT-owned mutations, not only automatic GETs. Native ChatGPT actions are not routed through this broker.

Off-chat, explicit foreground reads remain available only when ChatGPT is not generating, verifying or recovering from a network incident.

## Pins

The managed Pins catalogue is anchored outside the complete native Projects subtree. An expanded native Project and its child conversations can no longer be mistaken for the host into which Pins should be mounted. The native Projects sibling is then suppressed deterministically.

## Project Memory

Selecting a private GitHub vault now writes a real snapshot immediately from the local NiakGPT cache:

- `PROJECTS.json`
- `projects/<id>/project.json`
- `projects/<id>/index.json`
- `projects/<id>/PROJECT_STATE.md`

This write does not require any ChatGPT backend request. Full conversation payloads remain deferred until an off-chat quiet window. Metadata-only bootstrap entries use `parts: 0` so they cannot be mistaken for fully archived conversation history.

## Evidence

`visual-lab/field-regressions-v088.mjs` reproduces all three field failures in one deterministic browser lab. Existing network, Project Memory and Project-switch gates are also updated to the 0.9.88 contract.

As always, fixture CI proves NiakGPT's own behavior against controlled browser fixtures. It is not a substitute for a final authenticated field check on the current ChatGPT production UI.
