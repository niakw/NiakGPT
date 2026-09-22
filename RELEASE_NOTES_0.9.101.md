# NiakGPT 0.9.101 — Real Project Memory archives

## Field finding

The private GitHub vault was alive and continuously writing, but it was not actually archiving conversation bodies. Rechecking the live structure showed metadata-only indexes, zero message/part counts, no conversation-part directory, and a Project name polluted by NiakGPT UI metadata.

## Changes

- capture the currently rendered Project chat directly from the DOM to the private vault without any ChatGPT backend request;
- mark DOM snapshots partial so canonical background history can replace them later;
- preserve existing archived transcript metadata when cache bootstrap runs again;
- allow Project Memory's one full-conversation read from an off-chat tab beside an idle peer conversation, while keeping all ordinary NiakGPT traffic quarantined;
- abort those reads as soon as a peer starts generating;
- sanitize polluted Project labels at DOM extraction, cache repair, and vault serialization.

## Upgrade behavior

The extension keeps a fixed manifest key. Updating/reloading the existing unpacked extension preserves its Chrome extension storage and therefore the GitHub App configuration/refresh token. Removing the extension first clears that storage and can require GitHub setup again.

## Verification

Release gates cover current-chat zero-backend behavior, idle-peer vs active-peer network safety, DOM transcript persistence, archive preservation across metadata bootstrap, Project-name sanitation, package/runtime invariants, and the existing sidebar/UX/browser matrices.
