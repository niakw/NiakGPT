# NiakGPT 0.9.83 — Pins slot + Project Memory bootstrap recovery

0.9.83 addresses three live regressions that were still visible after the 0.9.82 DOM/auth hotfix.

## Pins stay below ChatGPT navigation

The live sidebar can contain hidden or transitional native Projects surfaces above the real ChatGPT controls. Those surfaces are no longer accepted as placement anchors.

NiakGPT now validates both the active sidebar and the candidate slot. A native Projects section must be visible and follow the primary navigation in DOM order and geometry. Otherwise Pins mount directly after the real primary navigation group. The same Pins node is still never reparented.

## Project Memory is visible and recoverable

The optional Project Memory UI now renders immediately when injected and reacts to a stable Control Center render event. It therefore appears even when the Control Center was already open before the optional runtime arrived.

A successful GitHub repository connection now persists a Project bootstrap queue before background history work begins. If a vault is connected but has no successful `lastSyncAt`, 0.9.83 recreates that queue automatically on startup. One WORKER tab owns the actual sync; CLIENT tabs can safely create/observe the persistent queue.

The UI exposes queued Project count, last successful sync and sync errors. This distinguishes “GitHub repository initialized” from “Project history synchronized”.

## Diagnostic copy stability

Live diagnostic updates no longer replace the panel DOM while the user has a non-empty native text selection inside it. Updates resume automatically after the selection is released.

## Regression evidence

- `pins-primary-slot-v083.mjs`: hidden native Projects above primary navigation must be rejected; visible native Projects below primary navigation remain a valid exact slot.
- `diagnostic-selection-v083.mjs`: text selection survives repeated diagnostic updates and refresh resumes afterward.
- `project-memory-v132.mjs`: Project Memory appears when injected into an already-open Control Center and an already-connected/never-synced vault recreates its persistent queue without reconnecting GitHub.
