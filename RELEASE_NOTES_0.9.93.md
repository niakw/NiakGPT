# NiakGPT 0.9.93 — Project Memory GitHub write serialization

The field error `cached_bootstrap_write_failed:github_http_422:Update is not a fast forward` is a branch-head race, not a missing-folder configuration.

Project Memory now serializes all repository writes through the extension service worker. If another writer advances the branch between the initial ref read and the final ref update, NiakGPT re-reads the current head, rebuilds the tree/commit on that parent, and retries a bounded number of times.

Only actual reference races are retried. Repository-rule or branch-protection 422 responses remain visible.

The `.niakgpt-memory` directory is still managed by NiakGPT and does not need to exist beforehand.
