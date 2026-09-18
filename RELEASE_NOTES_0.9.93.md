# NiakGPT 0.9.93 — Project Memory GitHub write serialization

The field error `cached_bootstrap_write_failed:github_http_422:Update is not a fast forward` is a branch-head race, not a missing-folder configuration.

Project Memory now serializes all repository writes through the extension service worker. If another writer advances the branch between the initial ref read and the final ref update, NiakGPT re-reads the current head, rebuilds the tree/commit on that parent, and retries a bounded number of times.

Only actual reference races are retried. Repository-rule or branch-protection 422 responses remain visible.

The `.niakgpt-memory` directory is still managed by NiakGPT and does not need to exist beforehand.


## User-reported recovery and conversation UX

- Local-only Project recovery no longer duplicates ChatGPT's native Projects surface when the visible native names match the local cache. The local block remains available as a hidden recovery fallback until canonical IDs are known.
- Once a complete canonical Project/chat index exists, classification catches up all unassigned cached conversations, including older history rather than only the recent window.
- Classification stays fully paused on active conversation routes to preserve NiakGPT's zero-background-ChatGPT-network invariant.
- During active generation, `conversation-scroll-guard-v133.js` follows the bottom only when the user is already there. Deliberate upward scrolling disables the pin immediately; returning to the bottom re-arms it.

- Cold/reinstalled caches now request their first canonical Project index after a short ~12 s off-conversation quiet window instead of waiting the normal two-minute background cadence; active conversation routes remain fully quarantined.
